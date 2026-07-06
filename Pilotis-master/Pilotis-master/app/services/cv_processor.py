# app/services/cv_processor.py
import tempfile
import os
import hashlib
import re
import json
from PyPDF2 import PdfReader
from io import BytesIO
import zipfile
from datetime import datetime

from app.services.cv_ocr_parser import parse_cv_with_ocr, preprocess_for_ai
from app.services.ai_analyzer import analyze_cv_with_ai
from app.services.cv_parser import parse_cv_with_ai, extract_cv_profile
from app.services.drive_db_service import DriveDBService
from app.models.candidate import Candidate
from app.models.candidate_many import CandidateMany
from app.models.job_requisition import JobRequisition
from app.models.contact import Contact
from app.extensions import db


# ==================== VALIDATION DES CV ====================

def compute_file_hash(file_data):
    """Calcule le hash SHA256 du fichier pour détection des doublons"""
    return hashlib.sha256(file_data).hexdigest()


def validate_cv_file(attachment_data, filename):
    """
    Valide le fichier CV avant traitement.
    Règles :
      - Extension obligatoire : .pdf, .doc ou .docx uniquement
      - Taille minimum : 50 KB (un vrai CV a du poids)
      - Taille maximum : 10 MB
      - PDF : entre 1 et 15 pages, pas vide
      - DOCX : structure XML valide
    Retourne (is_valid, error_message, file_type, file_size)
    """

    # 1. Extension stricte — PDF ou Word uniquement
    valid_extensions = ['.pdf', '.doc', '.docx']
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in valid_extensions:
        return (
            False,
            f"❌ Format refusé : '{file_ext}'. Seuls les fichiers PDF, DOC et DOCX sont acceptés comme CV.",
            None, 0
        )

    # 2. Vérification de la taille
    file_size_kb = len(attachment_data) / 1024
    file_size_mb = len(attachment_data) / (1024 * 1024)

    if file_size_mb > 10:
        return (
            False,
            f"❌ Fichier trop volumineux : {file_size_mb:.1f} MB (maximum 10 MB).",
            None, 0
        )

    # Seuil minimum relevé à 50 KB — un vrai CV contient du texte et une mise en page
    if file_size_kb < 50:
        return (
            False,
            f"❌ Fichier trop court : {file_size_kb:.1f} KB (minimum 50 KB). "
            f"Ce document est trop léger pour être un CV complet.",
            None, 0
        )

    file_type = file_ext.replace('.', '')

    # 3. Vérification de l'intégrité interne
    try:
        if file_type == 'pdf':
            pdf_reader = PdfReader(BytesIO(attachment_data))
            nb_pages = len(pdf_reader.pages)

            if nb_pages == 0:
                return False, "❌ PDF vide (0 page détectée).", None, 0

            if nb_pages > 15:
                return (
                    False,
                    f"❌ PDF trop long : {nb_pages} pages (maximum 15 pour un CV).",
                    None, 0
                )

            # Vérifier qu'il y a du texte extractible (pas seulement une image scannée illisible)
            total_text = ""
            for page in pdf_reader.pages[:3]:  # Tester les 3 premières pages
                try:
                    total_text += page.extract_text() or ""
                except Exception:
                    pass

            if len(total_text.strip()) < 80:
                return (
                    False,
                    "❌ PDF non lisible : aucun texte extractible détecté. "
                    "Le fichier est peut-être une image scannée sans OCR.",
                    None, 0
                )

        elif file_type in ['doc', 'docx']:
            try:
                with zipfile.ZipFile(BytesIO(attachment_data)) as zf:
                    if 'word/document.xml' not in zf.namelist():
                        return False, "❌ Fichier DOCX invalide (structure XML incorrecte).", None, 0
            except zipfile.BadZipFile:
                if file_type == 'docx':
                    return False, "❌ Fichier DOCX corrompu ou illisible.", None, 0
                # .doc ancien format — on laisse passer, l'OCR traitera

    except Exception as e:
        return False, f"❌ Fichier corrompu ou illisible : {str(e)[:120]}", None, 0

    return True, "OK", file_type, len(attachment_data)


def is_valid_cv_content(text):
    """
    Vérifie que le contenu extrait est bien un CV (et non une lettre, facture, contrat...).
    Règles :
      - Minimum 500 caractères de texte utile
      - Doit contenir suffisamment de mots-clés typiques d'un CV
    Retourne (is_valid, message, confidence_score)
    """
    if not text:
        return False, "❌ Document vide — aucun texte extrait.", 0

    text_length = len(text.strip())

    # Seuil minimum relevé à 500 caractères : une lettre de motivation courte
    # ou un document erroné sera rejeté ici
    if text_length < 500:
        return (
            False,
            f"❌ Document trop court : {text_length} caractères détectés (minimum 500). "
            f"Ce fichier ne ressemble pas à un CV complet.",
            0
        )

    cv_keywords = {
        'high': [
            # Sections typiques d'un CV
            'expérience', 'experience', 'expériences professionnelles',
            'compétence', 'competence', 'compétences techniques',
            'formation', 'formations', 'diplôme', 'diplome',
            'stage', 'stages', 'alternance',
            'projet', 'projets',
            'curriculum vitae', 'cv',
            'poste', 'emploi', 'mission',
        ],
        'medium': [
            'parcours', 'professionnel', 'profil',
            'langues', 'langue',
            'informatique', 'outils', 'logiciels',
            'certification', 'certifications',
            'responsabilité', 'responsabilités',
            'management', 'encadrement',
        ],
        'low': [
            'email', 'téléphone', 'telephone', 'adresse',
            'nationalité', 'nationalite',
            'permis', 'conduire',
            'centres d\'intérêt', 'loisirs', 'hobby',
            'référence', 'reference',
        ]
    }

    text_lower = text.lower()

    high_score   = sum(1 for kw in cv_keywords['high']   if kw in text_lower)
    medium_score = sum(1 for kw in cv_keywords['medium'] if kw in text_lower)
    low_score    = sum(1 for kw in cv_keywords['low']    if kw in text_lower)

    total_score = (high_score * 3) + (medium_score * 2) + low_score

    found_keywords = [kw for kw in cv_keywords['high'] if kw in text_lower][:5]
    if len(found_keywords) < 3:
        found_keywords += [kw for kw in cv_keywords['medium'] if kw in text_lower and kw not in found_keywords][:3]

    # Seuil renforcé : doit avoir au moins 2 mots-clés "high" OU un score total >= 8
    if high_score >= 2 or total_score >= 8:
        return (
            True,
            f"✅ CV valide — {len(found_keywords)} indicateurs détectés : {', '.join(found_keywords)}",
            min(total_score / 25, 1.0)
        )
    elif total_score >= 4:
        return (
            False,
            f"❌ Document douteux : seulement {len(found_keywords)} indicateurs CV trouvés. "
            f"Ce fichier pourrait être une lettre, une facture ou un autre document.",
            total_score / 25
        )
    else:
        return (
            False,
            f"❌ Ce document n'est pas reconnu comme un CV (aucun indicateur CV trouvé). "
            f"Veuillez soumettre un CV au format PDF ou Word.",
            0
        )


# ==================== UTILITAIRES EMAIL ====================

def _clean_email_address(raw: str) -> str:
    if not raw:
        return ""
    match = re.search(r'<([^>]+)>', raw)
    if match:
        return match.group(1).strip().lower()
    match = re.search(r'[\w.\-+]+@[\w.\-]+\.\w{2,}', raw)
    if match:
        return match.group(0).strip().lower()
    return raw.strip().lower()


def _find_contact_by_email(email: str):
    if not email:
        return None
    return Contact.query.filter(
        Contact.email.ilike(email),
        Contact.is_active == True
    ).first()


def _extract_phone_from_text(text):
    if not text:
        return ""
    
    text = text.replace('\n', ' ').replace('\r', ' ')
    
    patterns = [
        r'(?:0[67][\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})',
        r'(?:\+33|0033)[\s.-]?[1-9][\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}',
        r'(?:\+216|00216)[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{3}',
        r'(?:\+212|00212)[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}',
        r'\(\+216\)\s*(\d{8})',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text)
        if matches:
            phone = matches[0]
            phone = re.sub(r'[\s.-]', '', phone)
            if phone.startswith('0') and len(phone) == 10:
                phone = '+33' + phone[1:]
            elif phone.startswith('0033'):
                phone = '+' + phone[2:]
            
            digits = re.sub(r'[^\d]', '', phone)
            if 8 <= len(digits) <= 15:
                print(f"   📞 Téléphone trouvé par regex: {phone}")
                return phone
    return ""


def _extract_name_from_text(text):
    if not text:
        return {"first_name": "", "last_name": ""}
    
    result = {"first_name": "", "last_name": ""}
    lines = text.split('\n')[:30]
    
    for line in lines:
        line_lower = line.lower()
        if 'prénom' in line_lower or 'prenom' in line_lower:
            match = re.search(r'(?:prénom|prenom)[\s:]+([A-Za-zÀ-ÿ\-]+)', line, re.IGNORECASE)
            if match and not result["first_name"]:
                result["first_name"] = match.group(1).strip().capitalize()
        if 'nom' in line_lower:
            match = re.search(r'nom[\s:]+([A-Za-zÀ-ÿ\-]+)', line, re.IGNORECASE)
            if match and not result["last_name"]:
                result["last_name"] = match.group(1).strip().upper()
    
    if not result["first_name"] or not result["last_name"]:
        first_line = lines[0] if lines else ""
        name_match = re.search(r'^([A-Z][a-zÀ-ÿ]+)\s+([A-Z]{2,})', first_line)
        if name_match:
            result["first_name"] = result["first_name"] or name_match.group(1).capitalize()
            result["last_name"] = result["last_name"] or name_match.group(2).upper()
    
    return result


def _extract_job_reference(subject: str) -> str | None:
    patterns = [
        r'(?:r[ée]f(?:[ée]rence)?|ref|code|poste)\s*[:#]?\s*([A-Z0-9][\w\-]{3,})',
        r'\b(BPM\d+)\b',
        r'\b(REF[\-_]?\d+)\b',
        r'\b(AO\d{4}[\-_]?\d+)\b',
        r'\b([A-Z]{2,6}[\-_]\d{4,})\b',
    ]
    for pattern in patterns:
        m = re.search(pattern, subject, re.IGNORECASE)
        if m:
            ref = m.group(1).upper()
            print(f"   🔑 Référence offre extraite: {ref}")
            return ref
    return None

def analyze_email_body(body_text, email_subject=""):
    """
    Idée 6 (Amin) : Analyse le corps de l'email pour extraire des signaux de motivation.
    Retourne un dict: { motivation_score, extra_skills, ao_reference, mentions_company }
    """
    if not body_text or len(body_text.strip()) < 20:
        return {"motivation_score": 0, "extra_skills": [], "ao_reference": None, "mentions_company": False}

    result = {"motivation_score": 0, "extra_skills": [], "ao_reference": None, "mentions_company": False}
    text_lower = body_text.lower()

    # Detect AO reference in body
    ref_match = re.search(r'r[e\u00e9]f[e\u00e9]?rence\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_]{3,14})', body_text, re.IGNORECASE)
    if not ref_match:
        ref_match = re.search(r'\b(BPM\d+|REF[-_]?\d+|AO\d{4}[-_]?\d*|[A-Z]{2,}[-_]?\d{4,})\b', body_text, re.IGNORECASE)
    if not ref_match:
        ref_match = re.search(r'\b(?:ao|ref|offre|poste|code)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-_]{3,14})\b', body_text, re.IGNORECASE)
    if ref_match:
        result["ao_reference"] = ref_match.group(1).upper()
        result["motivation_score"] += 3

    # Company mention signals
    company_signals = ["pilotis", "votre entreprise", "votre societe", "votre equipe", "votre offre"]
    if any(s in text_lower for s in company_signals):
        result["mentions_company"] = True
        result["motivation_score"] += 2

    # Motivation keywords
    motivation_kws = [
        "passionné", "passionne", "motivé", "motive", "enchanté", "enchante",
        "ravi", "enthousiaste", "interesse", "intéressé",
        "correspondre", "profil", "rejoindre", "contribution",
        "expérience", "experience", "competence"
    ]
    for kw in motivation_kws:
        if kw in text_lower:
            result["motivation_score"] = min(10, result["motivation_score"] + 1)

    # Extract extra skills
    tech_kws = [
        "python", "java", "javascript", "react", "angular", "spring", ".net",
        "docker", "kubernetes", "aws", "azure", "sql", "mongodb", "agile", "scrum",
        "devops", "git", "microservices", "rest api", "graphql"
    ]
    for tk in tech_kws:
        if tk in text_lower:
            result["extra_skills"].append(tk)

    result["motivation_score"] = min(10, result["motivation_score"])
    return result


# ==================== EXTRACTION LINKEDIN ====================

def extract_linkedin_url(text: str) -> str | None:
    """
    Extrait l'URL LinkedIn depuis le texte du CV
    """
    if not text:
        return None
    
    patterns = [
        r'(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-]+\/?',
        r'(?:https?:\/\/)?(?:www\.)?linkedin\.com\/pub\/[\w\-]+\/?',
        r'linkedin\.com\/in\/[\w\-]+',
        r'linkedin\.com\/pub\/[\w\-]+'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            url = match.group(0)
            if not url.startswith('http'):
                url = 'https://' + url
            print(f"   🔗 LinkedIn trouvé: {url}")
            return url
    return None


# ==================== TRAITEMENT PRINCIPAL ====================

def process_cv_from_gmail(attachment_data, filename, from_email, to_email, subject, scanned_email=None, body_text=""):
    """
    Traite un CV reçu par Gmail avec validation complète
    UPLOAD SUR DRIVE SEULEMENT APRÈS VALIDATION DU CONTENU
    ET VÉRIFICATION GLOBALE DES DOUBLONS PAR HASH
    """
    temp_path = None
    try:
        print(f"\n   📄 Traitement du CV: {filename}")
        
        # ==================== ÉTAPE 1 : VALIDATION DU FICHIER ====================
        print(f"   🔍 Validation du fichier...")
        file_valid, error_msg, file_type, file_size = validate_cv_file(attachment_data, filename)
        
        if not file_valid:
            print(f"   ❌ CV REJETÉ: {error_msg}")
            return False
        
        print(f"   ✅ Format valide: {file_type} ({file_size/1024:.1f}KB)")
        
        # ==================== ÉTAPE 2 : HASH ====================
        file_hash = compute_file_hash(attachment_data)
        print(f"   🔑 Hash: {file_hash[:16]}...")
        
        # ==================== ÉTAPE 3 : VÉRIFICATION DOUBLON GLOBAL ====================
        existing_by_hash = Candidate.query.filter_by(cv_file_hash=file_hash).first()
        
        if existing_by_hash:
            print(f"   ⚠️ CV déjà existant (hash identique) - candidat: {existing_by_hash.email}")
            print(f"   🔄 Récupération des infos existantes")
            cv_drive_link = existing_by_hash.cv_path
            cv_drive_file_id = ""
            cv_text = existing_by_hash.cv_parsed
            skills = json.loads(existing_by_hash.skills) if existing_by_hash.skills else []
            
            first_name = existing_by_hash.first_name or ''
            last_name = existing_by_hash.last_name or ''
            phone = existing_by_hash.phone or ''
            country_ia = existing_by_hash.location or ''
            city_ia = ''
            linkedin_url = existing_by_hash.linkedin_profile_url if hasattr(existing_by_hash, 'linkedin_profile_url') else None
            try:
                profile_data_ai = json.loads(existing_by_hash.cv_profile) if getattr(existing_by_hash, 'cv_profile', None) else {}
            except Exception:
                profile_data_ai = {}
            
            print(f"   📋 Données existantes: {first_name} {last_name}")
        else:
            # ==================== ÉTAPE 4 : EXTRACTION DU TEXTE ====================
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_type}') as tmp:
                tmp.write(attachment_data)
                temp_path = tmp.name
            
            print(f"   🔍 Extraction du texte...")
            cv_text_raw = parse_cv_with_ocr(temp_path)
            
            # Seuil relevé à 500 caractères pour cohérence avec is_valid_cv_content
            if not cv_text_raw or len(cv_text_raw.strip()) < 500:
                print(f"   ❌ Texte insuffisant ({len(cv_text_raw or '')} caractères — min 500 requis)")
                return False
            
            cv_text = preprocess_for_ai(cv_text_raw)
            print(f"   📄 Texte extrait: {len(cv_text)} caractères")
            
            # ==================== ÉTAPE 5 : VALIDATION DU CONTENU ====================
            print(f"   🔍 Validation du contenu...")
            content_valid, content_msg, confidence = is_valid_cv_content(cv_text)
            
            if not content_valid:
                print(f"   ❌ CV REJETÉ - Contenu: {content_msg}")
                return False
            
            print(f"   ✅ {content_msg} (confiance: {confidence*100:.0f}%)")
            
            # ==================== ÉTAPE 6 : UPLOAD SUR DRIVE ====================
            try:
                import hashlib
                md5_hash = hashlib.md5(attachment_data).hexdigest()
                mail_folder = os.getenv("GOOGLE_DRIVE_MAIL_FOLDER_ID")
                existing_drive_file = DriveDBService.file_exists_by_hash(md5_hash, folder_id=mail_folder)
                
                if existing_drive_file:
                    cv_drive_link = existing_drive_file.get('webViewLink')
                    cv_drive_file_id = existing_drive_file.get('id')
                    print(f"   📤 CV déjà présent sur Drive (Upload ignoré)")
                else:
                    result = DriveDBService.upload_file(attachment_data, filename, 'application/pdf', folder_id=mail_folder)
                    cv_drive_link = result['drive_link']
                    cv_drive_file_id = result['drive_file_id']
                    print(f"   📤 Nouveau CV uploadé sur Drive")
            except Exception as e:
                print(f"   ⚠️ Échec de l'upload Drive, sauvegarde locale... ({e})")
                # Create uploads directory if it doesn't exist
                os.makedirs('uploads', exist_ok=True)
                # Ensure unique filename to prevent overwrites
                local_filename = f"{file_hash[:8]}_{filename}"
                local_path = os.path.join('uploads', local_filename)
                with open(local_path, 'wb') as f:
                    f.write(attachment_data)
                cv_drive_link = local_path
                cv_drive_file_id = ""
                print(f"   💾 CV sauvegardé localement: {local_path}")
            
            # ==================== ÉTAPE 7 : EXTRACTION IA ====================
            print(f"   🤖 Extraction IA des données de base...")
            base_data = parse_cv_with_ai(cv_text)
            
            first_name = base_data.get('first_name', '') or ''
            last_name = base_data.get('last_name', '') or ''
            phone = base_data.get('phone', '') or ''
            
            print(f"   🤖 Extraction IA du profil détaillé...")
            profile_data_ai = extract_cv_profile(cv_text)
            skills = profile_data_ai.get('skills_raw', [])
            
            country_ia = ""
            city_ia = ""
            
            # ==================== ÉTAPE 7.5 : EXTRACTION LINKEDIN ====================
            linkedin_url = extract_linkedin_url(cv_text)
            
            print(f"   📋 IA: prénom={first_name!r}, nom={last_name!r}, skills={len(skills)}")
            if linkedin_url:
                print(f"   🔗 LinkedIn extrait: {linkedin_url}")
            
            # Fallback regex
            if not first_name or not last_name:
                name_data = _extract_name_from_text(cv_text)
                first_name = first_name or name_data.get('first_name', '')
                last_name = last_name or name_data.get('last_name', '')
            
            if not phone:
                phone = _extract_phone_from_text(cv_text)
        
        # ==================== ÉTAPE 8 : EMAIL EXPÉDITEUR ====================
        sender_email_clean = _clean_email_address(from_email)
        if not sender_email_clean:
            print(f"   ❌ Email expéditeur invalide")
            return False
        
        # ==================== ÉTAPE 8.5 : ANALYSE DU CORPS (MOTIVATION) ====================
        motivation_data = analyze_email_body(body_text, subject)
        if motivation_data["motivation_score"] > 0:
            print(f"   💡 Idée 6 : Score motivation = {motivation_data['motivation_score']}/10")
        
        # Merge extra skills from email body into cv skills
        for es in motivation_data["extra_skills"]:
            if es.lower() not in [s.lower() for s in skills]:
                skills.append(es)

        # ==================== ÉTAPE 9 : DÉTECTION DE L'OFFRE ====================
        job_requisition_id = None
        job = None
        match_score = 0
        match_justification = ""
        
        if 'cv_text' not in dir() and not existing_by_hash:
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_type}') as tmp:
                tmp.write(attachment_data)
                temp_path = tmp.name
            cv_text_raw = parse_cv_with_ocr(temp_path)
            cv_text = preprocess_for_ai(cv_text_raw) if cv_text_raw else ""
        
        ref = _extract_job_reference(subject or '')
        if not ref:
            ref = motivation_data.get("ao_reference")
        
        if ref:
            job = JobRequisition.query.filter_by(reference=ref).first()
            if job:
                job_requisition_id = job.requisition_id
                print(f"   🔗 Offre trouvée: {job.titre}")
                try:
                    from app.services.auto_matcher import AutoMatcher
                    profile_json_text = json.dumps({
                        "skills_raw": skills,
                        "skills_confirmed": profile_data_ai.get("skills_confirmed", {}),
                        "level": profile_data_ai.get("level", "junior"),
                        "domain": profile_data_ai.get("domain", []),
                        "total_experience_months": profile_data_ai.get("total_experience_months", 0),
                        "motivation_score": motivation_data["motivation_score"],
                        "motivation_extra_skills": motivation_data["extra_skills"]
                    }, ensure_ascii=False)
                    
                    match_score, match_justification = AutoMatcher._calculate_hybrid_score(profile_json_text, job)
                    
                    # Le score de motivation est déjà intégré dans le hybrid_score, mais on peut rajouter la note dans la justification.
                    if motivation_data["motivation_score"] > 0:
                        match_justification += " De plus, une forte motivation a été détectée dans l'email de candidature."
                        
                    print(f"   📊 Score matching final: {match_score}%")
                except Exception as e:
                    print(f"   ⚠️ Erreur calcul score: {e}")
        
        # ==================== ÉTAPE 10 : CONTACT DESTINATAIRE ====================
        email_destinataire = scanned_email if scanned_email else to_email
        to_email_clean = _clean_email_address(email_destinataire)
        recipient_contact_id = None
        
        if to_email_clean:
            contact = _find_contact_by_email(to_email_clean)
            if contact:
                recipient_contact_id = contact.id_contact
                print(f"   👤 Contact destinataire: {contact.name} ({contact.email})")
        
        # ==================== ÉTAPE 11 : CRÉATION/MISE À JOUR CANDIDAT ====================
        existing = Candidate.query.filter(Candidate.email.ilike(sender_email_clean)).first()
        
        if existing:
            print(f"   🔄 Mise à jour candidat existant: {sender_email_clean}")
            if first_name:
                existing.first_name = first_name[:30]
            if last_name:
                existing.last_name = last_name[:30]
            if phone:
                existing.phone = phone[:20]
            existing.cv_path = cv_drive_link
            existing.cv_parsed = cv_text if 'cv_text' in dir() else existing.cv_parsed
            existing.cv_file_hash = file_hash
            existing.cv_file_size = file_size
            existing.cv_file_type = file_type
            existing.cv_original_filename = filename
            existing.skills = json.dumps(skills) if skills else "[]"
            if linkedin_url:
                existing.linkedin_url = linkedin_url[:500]
            if country_ia:
                existing.country = country_ia[:100]
            if city_ia:
                existing.city = city_ia[:100]
            if recipient_contact_id:
                existing.recipient_contact_id = recipient_contact_id
            existing.updated_at = datetime.utcnow()
            db.session.commit()
            candidate_id = existing.id_candidate
            print(f"   ✅ Candidat mis à jour: {first_name} {last_name}")
        else:
            print(f"   ✅ Création nouveau candidat: {sender_email_clean}")
            candidate = Candidate(
                email=sender_email_clean,
                first_name=first_name[:30] if first_name else '',
                last_name=last_name[:30] if last_name else '',
                phone=phone[:20] if phone else None,
                source='email',
                cv_path=cv_drive_link,
                cv_parsed=cv_text if 'cv_text' in dir() else '',
                cv_file_hash=file_hash,
                cv_file_size=file_size,
                skills=json.dumps(skills) if skills else "[]",
                linkedin_profile_url=linkedin_url[:300] if linkedin_url else None,
                job_requisition_id=job_requisition_id,
                recipient_contact_id=recipient_contact_id,
                location=country_ia[:100] if country_ia else None
            )
            
            # Save cv_profile with motivation info to database
            profile_data = {
                "first_name": first_name,
                "last_name": last_name,
                "skills_raw": skills,
                "skills_confirmed": profile_data_ai.get("skills_confirmed", {}),
                "level": profile_data_ai.get("level", "junior"),
                "domain": profile_data_ai.get("domain", []),
                "total_experience_months": profile_data_ai.get("total_experience_months", 0),
                "motivation_score": motivation_data["motivation_score"],
                "motivation_extra_skills": motivation_data["extra_skills"]
            }
            candidate.cv_profile = json.dumps(profile_data, ensure_ascii=False)
            db.session.add(candidate)
            db.session.commit()
            candidate_id = candidate.id_candidate
            print(f"   ✅ Candidat créé: {first_name or 'Non'} {last_name or 'Non'}")
        
        # ==================== ÉTAPE 12 : LIAISON OFFRE ====================
        if job_requisition_id and job:
            existing_app = CandidateMany.query.filter_by(
                candidate_id=candidate_id,
                requisition_id=job_requisition_id
            ).first()
            
            if not existing_app:
                app_status = 'rejected'
                if match_score is not None:
                    if match_score >= 70:
                        app_status = 'linked'
                    elif match_score >= 40:
                        app_status = 'pending'
                else:
                    app_status = 'pending'

                new_app = CandidateMany(
                    candidate_id=candidate_id,
                    requisition_id=job_requisition_id,
                    match_score=match_score,
                    match_justification=match_justification,
                    status=app_status
                )
                db.session.add(new_app)
                db.session.commit()
                print(f"   ✅ Offre liée: {job.titre} (score: {match_score}%)")
        else:
            print(f"   🔍 Pas de référence, exécution du matching global...")
            from app.services.auto_matcher import AutoMatcher
            best_match = AutoMatcher.match_single_candidate(candidate_id)
            if best_match:
                candidate_obj = Candidate.query.get(candidate_id)
                candidate_obj.job_requisition_id = best_match['opportunity_id']
                candidate_obj.suggested_job_requisition_id = best_match['opportunity_id']
                candidate_obj.link_status = 'linked'
                candidate_obj.match_score = best_match['score']
                candidate_obj.match_justification = best_match['justification']
                db.session.commit()
                print(f"   ✅ AO '{best_match['opportunity_title']}' lié avec succès pour le candidat {candidate_id}")
        
        # ==================== ÉTAPE 13 : LOCALISATION ====================
        try:
            from app.services.location_service import detect_location
            candidate_obj = Candidate.query.get(candidate_id)
            location = detect_location(candidate_obj.phone, candidate_obj.cv_parsed)
            candidate_obj.location = location or country_ia or None
            db.session.commit()
            print(f"   📍 Localisation: {candidate_obj.location or 'non détectée'}")
        except Exception as e:
            print(f"   ⚠️ Erreur localisation: {e}")
        
        print(f"   ✅ CV traité avec succès: {filename}")
        return True
        
    except Exception as e:
        import traceback
        print(f"   ❌ Erreur traitement CV: {e}")
        traceback.print_exc()
        return False
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)