# app/services/linkedin_form_collector.py
"""
Collecteur de candidatures LinkedIn via Google Form.

Flow :
    1. Lit les nouvelles réponses du Google Sheet lié au Google Form de candidature
    2. Valide chaque réponse STRICTEMENT (email, nom, fichier CV, contenu CV)
       → Si invalide : fichier Drive supprimé, candidat NON créé en base
    3. Si toutes les validations passent : crée le candidat en base
    4. Évite les doublons via google_form_response_id (horodatage unique) ET email
"""

import logging
import re
import os
import hashlib
from datetime import datetime

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
NAME_REGEX  = re.compile(r"^[a-zA-ZÀ-ÿ\s'-]+$")


def _delete_drive_file(drive_service, file_url: str):
    """Supprime un fichier de Google Drive à partir de son URL (silencieux si erreur)."""
    try:
        m = re.search(r'id=([a-zA-Z0-9_-]+)', file_url) or re.search(r'd/([a-zA-Z0-9_-]+)', file_url)
        if m:
            drive_service.files().delete(fileId=m.group(1), supportsAllDrives=True).execute()
            logger.info("[LinkedIn Form] 🗑️  Fichier Drive supprimé (rejet): %s", file_url[:70])
    except Exception as e:
        logger.warning("[LinkedIn Form] Suppression Drive échouée: %s", e)


def collect_linkedin_candidates(app) -> dict:
    """
    Orchestre la collecte des candidatures depuis le Google Sheet.

    Returns:
        dict: {"created": int, "skipped": int, "errors": int}
    """
    stats = {"created": 0, "skipped": 0, "errors": 0}

    with app.app_context():
        from app.extensions import db
        from app.models.candidate import Candidate
        from app.models.job_requisition import JobRequisition
        from app.models.settings import AppSetting
        from app.services.google_sheets_service import GoogleSheetsService
        from app.services.cv_processor import validate_cv_file, is_valid_cv_content
        from app.services.cv_parser import parse_cv, extract_cv_profile, parse_cv_with_ai, _extract_phone_regex
        from app.services.location_service import detect_location
        from werkzeug.utils import secure_filename
        from googleapiclient.discovery import build as _build_drive

        # ── Config ──────────────────────────────────────────────────────────────
        sheet_setting = AppSetting.query.filter_by(key="google_form_sheet_id").first()
        if not sheet_setting or not sheet_setting.value:
            logger.info("[LinkedIn Form] Aucun spreadsheet_id configuré — collecte ignorée")
            return stats

        spreadsheet_id = sheet_setting.value.strip()

        try:
            service = GoogleSheetsService()
        except RuntimeError as exc:
            logger.warning("[LinkedIn Form] Service non disponible: %s", exc)
            return stats

        responses = service.get_responses(spreadsheet_id)
        if not responses:
            return stats

        # ── Traiter chaque réponse ────────────────────────────────────────────
        for row in responses:
            cv_path_tmp = None
            cv_link     = None
            try:
                # ── Extraction des champs ─────────────────────────────────────
                response_id = row.get("Horodateur", row.get("Horodatage", row.get("Timestamp", ""))).strip()
                email       = row.get("Email", "").strip().lower()
                name        = row.get("Colonne 1", row.get("Nom Complet", row.get("Nom", ""))).strip()
                ref         = row.get("Référence AO", "").strip().upper() or None
                cv_link     = row.get("Lien CV", row.get("cv", row.get("CV", ""))).strip() or None

                # ──────────────────────────────────────────────────────────────
                # ÉTAPE 1 : VALIDATIONS FORMULAIRE (email, nom, lien drive)
                # Si invalide → supprimer fichier Drive si présent, puis passer
                # ──────────────────────────────────────────────────────────────

                if not response_id:
                    logger.warning("[LinkedIn Form] REJETÉ — horodatage manquant")
                    stats["skipped"] += 1
                    continue

                if not email or not EMAIL_REGEX.match(email):
                    logger.warning("[LinkedIn Form] REJETÉ — email invalide: '%s'", email)
                    stats["skipped"] += 1
                    if cv_link and "drive.google.com" in cv_link:
                        _delete_drive_file(_build_drive('drive', 'v3', credentials=service.creds), cv_link)
                    continue

                if not name or not NAME_REGEX.match(name):
                    logger.warning("[LinkedIn Form] REJETÉ — nom invalide (chiffres/caractères spéciaux): '%s'", name)
                    stats["skipped"] += 1
                    if cv_link and "drive.google.com" in cv_link:
                        _delete_drive_file(_build_drive('drive', 'v3', credentials=service.creds), cv_link)
                    continue

                if not cv_link or "drive.google.com" not in cv_link:
                    logger.warning("[LinkedIn Form] REJETÉ — pas de lien CV Google Drive pour %s", email)
                    stats["skipped"] += 1
                    continue

                # ──────────────────────────────────────────────────────────────
                # ÉTAPE 2 : ANTI-DOUBLON (avant tout traitement lourd)
                # ──────────────────────────────────────────────────────────────

                if Candidate.query.filter_by(google_form_response_id=response_id).first():
                    logger.info("[LinkedIn Form] Doublon horodatage — ignoré: %s", response_id)
                    stats["skipped"] += 1
                    continue

                if Candidate.query.filter_by(email=email).first():
                    logger.info("[LinkedIn Form] Doublon email — ignoré: %s", email)
                    stats["skipped"] += 1
                    continue

                # ──────────────────────────────────────────────────────────────
                # ÉTAPE 3 : TÉLÉCHARGEMENT DU FICHIER DRIVE
                # ──────────────────────────────────────────────────────────────

                logger.info("[LinkedIn Form] Téléchargement CV Drive pour %s ...", email)
                cv_bytes = service.download_drive_file(cv_link)

                if not cv_bytes:
                    logger.warning("[LinkedIn Form] REJETÉ — échec téléchargement Drive pour %s", email)
                    stats["skipped"] += 1
                    continue

                # ──────────────────────────────────────────────────────────────
                # ÉTAPE 4 : VALIDATION FORMAT (PDF ou Word uniquement)
                # ──────────────────────────────────────────────────────────────

                # Détection par magic bytes (ignorer l'extension du nom original)
                if cv_bytes.startswith(b'%PDF-'):
                    ext = '.pdf'
                elif cv_bytes.startswith(b'PK\x03\x04'):
                    ext = '.docx'
                elif cv_bytes.startswith(b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1'):
                    ext = '.doc'
                else:
                    logger.warning("[LinkedIn Form] REJETÉ — format inconnu (ni PDF ni Word) pour %s", email)
                    stats["skipped"] += 1
                    _delete_drive_file(_build_drive('drive', 'v3', credentials=service.creds), cv_link)
                    continue

                cv_filename = secure_filename(f"{email}_cv{ext}")

                # Validation taille + structure interne
                file_valid, error_msg, file_type, file_size = validate_cv_file(cv_bytes, cv_filename)
                if not file_valid:
                    logger.warning("[LinkedIn Form] REJETÉ (Fichier invalide) pour %s: %s", email, error_msg)
                    stats["skipped"] += 1
                    _delete_drive_file(_build_drive('drive', 'v3', credentials=service.creds), cv_link)
                    continue

                # ──────────────────────────────────────────────────────────────
                # ÉTAPE 5 : EXTRACTION TEXTE + VALIDATION CONTENU (vrai CV ?)
                # ──────────────────────────────────────────────────────────────

                os.makedirs("uploads/cv", exist_ok=True)
                cv_path_tmp = os.path.join("uploads/cv", cv_filename)
                with open(cv_path_tmp, 'wb') as f:
                    f.write(cv_bytes)

                cv_text = parse_cv(cv_path_tmp)

                content_valid, content_msg, confidence = is_valid_cv_content(cv_text)
                if not content_valid:
                    logger.warning("[LinkedIn Form] REJETÉ (Contenu non-CV) pour %s: %s", email, content_msg)
                    stats["skipped"] += 1
                    try:
                        os.remove(cv_path_tmp)
                        cv_path_tmp = None
                    except Exception:
                        pass
                    _delete_drive_file(_build_drive('drive', 'v3', credentials=service.creds), cv_link)
                    continue

                logger.info("[LinkedIn Form] ✅ CV valide pour %s (confiance: %.0f%%)", email, confidence * 100)

                # ══════════════════════════════════════════════════════════════
                # TOUTES LES VALIDATIONS PASSÉES → CRÉER LE CANDIDAT
                # ══════════════════════════════════════════════════════════════

                parts      = name.split(" ", 1)
                last_name  = parts[0][:30] if parts else ""
                first_name = parts[1][:30] if len(parts) > 1 else ""

                candidate = Candidate(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    source="LinkedIn",
                    linkedin_profile_url=None,
                    google_form_response_id=response_id,
                    created_at=datetime.utcnow(),
                )

                # ── Hash et métadonnées ───────────────────────────────────────
                file_hash = hashlib.sha256(cv_bytes).hexdigest()
                candidate.cv_file_hash = file_hash
                candidate.cv_file_size = len(cv_bytes)
                candidate.cv_parsed    = cv_text

                # ── Déplacement vers dossier Drive linkedin_pilotis ───────────
                existing_cv = Candidate.query.filter_by(cv_file_hash=file_hash).first()
                if existing_cv and existing_cv.cv_path and "drive.google.com" in existing_cv.cv_path:
                    logger.info("[LinkedIn Form] CV identique déjà dans Drive — réutilisation du lien.")
                    candidate.cv_path = existing_cv.cv_path
                else:
                    m_id = re.search(r'id=([a-zA-Z0-9_-]+)', cv_link) or re.search(r'd/([a-zA-Z0-9_-]+)', cv_link)
                    if m_id:
                        source_file_id  = m_id.group(1)
                        linkedin_folder = os.getenv("GOOGLE_DRIVE_LINKEDIN_FOLDER_ID")
                        try:
                            _drive = _build_drive('drive', 'v3', credentials=service.creds)
                            _md5 = hashlib.md5(cv_bytes).hexdigest()
                            _existing = _drive.files().list(
                                q=f"'{linkedin_folder}' in parents and trashed=false",
                                fields='files(id, name, webViewLink, md5Checksum)',
                                supportsAllDrives=True,
                                includeItemsFromAllDrives=True,
                                pageSize=200
                            ).execute().get('files', [])

                            _dup = next((f for f in _existing if f.get('md5Checksum') == _md5), None)
                            if _dup:
                                candidate.cv_path = _dup.get('webViewLink')
                            else:
                                _meta = _drive.files().get(
                                    fileId=source_file_id, supportsAllDrives=True, fields='id,name,parents'
                                ).execute()
                                _parents = ','.join(_meta.get('parents', []))
                                _updated = _drive.files().update(
                                    fileId=source_file_id,
                                    addParents=linkedin_folder,
                                    removeParents=_parents,
                                    supportsAllDrives=True,
                                    body={'name': cv_filename},
                                    fields='id,webViewLink,parents'
                                ).execute()
                                candidate.cv_path = _updated.get('webViewLink')
                                logger.info("[LinkedIn Form] CV déplacé dans linkedin_pilotis: %s", candidate.cv_path)
                        except Exception as e:
                            logger.error("[LinkedIn Form] Echec déplacement Drive: %s", e)
                            candidate.cv_path = cv_link
                    else:
                        candidate.cv_path = cv_link

                # ── Enrichissement IA ─────────────────────────────────────────
                phone = _extract_phone_regex(cv_text)
                if not phone:
                    ai_data = parse_cv_with_ai(cv_text)
                    phone = ai_data.get('phone', '')
                candidate.phone    = phone[:20] if phone else None
                candidate.location = detect_location(phone, cv_text)

                logger.info("[LinkedIn Form] Extraction profil Qwen pour %s...", email)
                profile = extract_cv_profile(cv_text)
                candidate.cv_profile = __import__('json').dumps(profile, ensure_ascii=False)
                all_skills = list(profile.get("skills_raw", []))
                for sk in profile.get("skills_confirmed", {}).keys():
                    if sk not in all_skills:
                        all_skills.append(sk)
                candidate.skills = __import__('json').dumps(all_skills)

                # ── Matching AO ───────────────────────────────────────────────
                if ref:
                    job = JobRequisition.query.filter(
                        (JobRequisition.reference == ref) |
                        (JobRequisition.boond_id == ref)
                    ).first()
                    if job:
                        candidate.suggested_job_requisition_id = job.requisition_id
                        candidate.link_status = "suggested"
                        if candidate.cv_profile:
                            from app.services.ai_analyzer import smart_match
                            import json
                            score, justif, explanation, conf = smart_match(
                                json.loads(candidate.cv_profile),
                                job.titre or "", job.description or "", job.criteres or ""
                            )
                            candidate.match_score         = score
                            candidate.match_justification = justif
                            candidate.match_explanation   = explanation
                            candidate.match_confidence    = conf

                # ── SAUVEGARDE EN BASE (seulement si tout est valide) ─────────
                db.session.add(candidate)
                db.session.commit()

                if not ref:
                    from app.services.auto_matcher import AutoMatcher
                    best_match = AutoMatcher.match_single_candidate(candidate.id_candidate)
                    if best_match:
                        candidate.job_requisition_id           = best_match['opportunity_id']
                        candidate.suggested_job_requisition_id = best_match['opportunity_id']
                        candidate.link_status                  = 'linked'
                        candidate.match_score                  = best_match['score']
                        candidate.match_justification          = best_match['justification']
                        db.session.commit()

                stats["created"] += 1
                logger.info("[LinkedIn Form] ✅ Candidat créé: %s <%s>", name, email)

            except Exception as exc:
                db.session.rollback()
                stats["errors"] += 1
                logger.error("[LinkedIn Form] Erreur ligne %s: %s", row, exc)
                # Nettoyage fichier temp en cas d'exception
                if cv_path_tmp:
                    try:
                        os.remove(cv_path_tmp)
                    except Exception:
                        pass

        logger.info(
            "[LinkedIn Form] Collecte terminée — créés=%d | ignorés=%d | erreurs=%d",
            stats["created"], stats["skipped"], stats["errors"],
        )
        return stats


def start_linkedin_form_collector(app, interval_seconds: int = 600):
    """
    Lance un thread daemon qui collecte les réponses Google Form
    toutes les `interval_seconds` secondes (défaut : 10 min).
    """
    import threading
    import time

    from app.models.settings import AppSetting

    def _loop():
        logger.info("[LinkedIn Form] Thread démarré — collecte toutes les %ds", interval_seconds)
        while True:
            time.sleep(interval_seconds)
            try:
                with app.app_context():
                    sheet_setting = AppSetting.query.filter_by(key="google_form_sheet_id").first()
                    if not sheet_setting or not sheet_setting.value:
                        continue
                collect_linkedin_candidates(app)
            except Exception as exc:
                logger.error("[LinkedIn Form] Erreur thread: %s", exc)

    t = threading.Thread(target=_loop, daemon=True, name="linkedin-form-collector")
    t.start()
    logger.info("[LinkedIn Form] Collecte automatique activée (toutes les %d min)", interval_seconds // 60)