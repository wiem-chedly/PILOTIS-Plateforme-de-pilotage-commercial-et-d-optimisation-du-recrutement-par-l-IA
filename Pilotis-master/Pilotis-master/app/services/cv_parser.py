import pdfplumber
from docx import Document
import json
import requests
import os
import re


# ── Domain keyword mapping (Python-level fallback) ─────────────────────────────
DOMAIN_KEYWORDS = {
    "logiciel":   ["génie logiciel", "genie logiciel", "software", "développement logiciel",
                   "software engineering", "architecture logicielle", "cycle ingénieur",
                   "développeur", "developer", "ingénieur logiciel", "informatique",
                   "java", "python", "c++", "c#", ".net", "kotlin", "scala", "php", "ruby",
                   "cobol", "programmation"],
    "web":        ["web", "fullstack", "full stack", "frontend", "backend", "flask", "django",
                   "react", "angular", "vue", "nodejs", "next.js", "nextjs", "spring boot",
                   "laravel", "symfony", "html", "css", "javascript", "typescript",
                   "application web", "site web"],
    "mobile":     ["mobile", "android", "ios", "flutter", "react native", "systèmes mobiles",
                   "systemes mobiles", "embarqués et mobiles", "swift", "xamarin",
                   "android studio", "application mobile"],
    "embarque":   ["embarqué", "embarque", "iot", "stm32", "arduino", "raspberry",
                   "systèmes embarqués", "fpga", "temps réel", "rtos", "firmware"],
    "data":       ["data", "machine learning", "deep learning", "ia", "intelligence artificielle",
                   "data engineer", "data analyst", "big data", "tensorflow", "pytorch",
                   "pandas", "numpy", "spark", "hadoop", "scikit", "nlp", "computer vision"],
    "devops":     ["devops", "docker", "kubernetes", "ci/cd", "pipeline", "cloud", "jenkins",
                   "ansible", "terraform", "github actions", "gitlab ci", "sre"],
    "cybersecurite": ["cybersecurite", "cyber", "sécurité", "security", "pentest", "soc",
                      "cryptographie", "réseaux", "siem", "firewall", "iam"],
    "finance":    ["finance", "banque", "assurance", "trading", "risque", "credit", "bfi"],
    "cloud":      ["aws", "azure", "gcp", "google cloud", "amazon web", "cloud computing",
                   "infrastructure cloud"],
    "e-commerce": ["e-commerce", "ecommerce", "boutique", "shop", "marketplace"],
}


def _detect_domains_from_text(cv_text):
    """Detecte les domaines metier depuis le texte brut du CV."""
    text_lower = cv_text.lower()
    found = []
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            found.append(domain)
    return found[:3]  # Max 3 domaines

def parse_cv(file_path):
    """Extrait le texte d'un CV (PDF, DOCX, ou texte brut)."""
    text = ''
    if file_path.endswith('.pdf'):
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text
        except Exception as e:
            print(f"Erreur parsing PDF {file_path}: {e}")
    elif file_path.endswith('.docx'):
        try:
            doc = Document(file_path)
            for para in doc.paragraphs:
                text += para.text + '\n'
        except Exception as e:
            print(f"Erreur parsing DOCX {file_path}: {e}")
    else:
        try:
            with open(file_path, 'r', errors='ignore') as f:
                text = f.read()
        except Exception as e:
            print(f"Erreur lecture fichier {file_path}: {e}")
    return text


def _extract_phone_regex(text):
    """Regex ameliore pour detecter les telephones tunisiens, francais et internationaux."""
    patterns = [
        r'\+216\s?\d{2}\s?\d{3}\s?\d{3}',   # Tunisien: +216 21 957 749
        r'\+33\s?[1-9](?:[\s.]\d{2}){4}',     # Francais: +33 6 12 34 56 78
        r'(?:0|\+\d{1,3})\s?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}',  # Generic
        r'\+?\d[\d\s.()-]{7,15}\d',           # Fallback international
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            phone = re.sub(r'[^\d+]', '', m.group())
            if len(phone) >= 8:
                return phone
    return None


def parse_cv_with_ai(cv_text):
    """
    Utilise Ollama pour extraire prenom, nom et telephone du CV.
    Retourne un dict {'first_name': ..., 'last_name': ..., 'phone': ...}
    """
    prompt = f"""Tu es un expert en analyse de CV. Extrais UNIQUEMENT les informations suivantes du CV ci-dessous.

REGLES TRES STRICTES :
1. Le NOM et PRENOM sont toujours situes TOUT EN HAUT du CV, c'est generalement le texte le plus grand/visible.
2. Le prenom vient AVANT le nom (ex: "Mohamed Amin" est le prenom, "Kaboubi" est le nom).
3. NE CONFONDS PAS le nom/prenom avec :
   - Les noms de formations (ex: "Sciences Informatiques", "Genie Logiciel")
   - Les specialites (ex: "Systemes Embarques", "Architecture Logicielle")
   - Les noms d'entreprises ou d'ecole (ex: "ESPRIT", "CACIB", "Technix")
   - Les noms de technologies (ex: "Spring Boot", "Angular")
4. Si le nom complet est en MAJUSCULES (ex: "KABOUBI"), c'est probablement le NOM DE FAMILLE.
5. Le telephone peut etre au format tunisien (+216 XX XXX XXX) ou francais (+33 X XX XX XX XX).

Exemple correct pour un CV commencant par "MOHAMED AMIN KABOUBI / Etudiant en Genie Logiciel" :
{{"first_name": "Mohamed Amin", "last_name": "Kaboubi", "phone": "+216 21957749"}}

Exemple INCORRECT a NE PAS faire :
{{"first_name": "Systemes", "last_name": "Embarques", "phone": ""}}

Reponds UNIQUEMENT au format JSON, rien d'autre :
{{"first_name": "...", "last_name": "...", "phone": "..."}}

Texte du CV (debut) :
{cv_text[:2000]}
"""
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
    try:
        response = requests.post(
            ollama_url,
            json={
                "model": "qwen2.5:7b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 200}
            },
            timeout=1800  # 30 min — les gros CVs peuvent être lents
        )
        if response.status_code == 200:
            result = response.json().get("response", "")
            print(f"[CV Parser] Reponse IA : {result[:200]}")
            json_match = re.search(r'\{.*?\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                first = data.get('first_name', '').strip()
                last = data.get('last_name', '').strip()
                phone = data.get('phone', '').strip()

                bad_keywords = [
                    'informatique', 'logiciel', 'embarque', 'architecture',
                    'systemes', 'sciences', 'genie', 'technologie', 'ingenierie',
                    'formation', 'experience', 'competences', 'stage', 'master',
                    'licence', 'bachelor', 'ecole', 'universite'
                ]
                combined = (first + ' ' + last).lower()
                if any(kw in combined for kw in bad_keywords):
                    print(f"[CV Parser] Mauvaise extraction ({first} {last}), tentative regex...")
                    first_lines = cv_text.strip().split('\n')[:5]
                    for line in first_lines:
                        line = line.strip()
                        parts = line.split()
                        if 2 <= len(parts) <= 4 and all(p.replace('-', '').isalpha() for p in parts):
                            if len(parts) >= 3:
                                first = ' '.join(parts[:-1])
                                last = parts[-1]
                            else:
                                first = parts[0]
                                last = parts[1]
                            print(f"[CV Parser] Regex fallback: {first} {last}")
                            break

                return {
                    'first_name': first,
                    'last_name': last,
                    'phone': phone
                }
    except Exception as e:
        print(f"Erreur appel IA : {e}")
    return {'first_name': '', 'last_name': '', 'phone': ''}


def extract_cv_profile(cv_text):
    """
    Extrait un profil structure complet depuis le texte du CV via Qwen.
    Fonctionne pour tout format de CV (1 ou 2 colonnes, FR/EN, junior/senior...).
    Appele UNE SEULE FOIS par candidat — resultat stocke en DB.

    Retourne un dict :
    {
      "level": "etudiant|junior|confirme|senior|expert",
      "total_experience_months": <int>,
      "domain": ["web", "mobile", ...],
      "skills_confirmed": {"Spring Boot": ["Projet X (2024)", "Stage Y (2023)"], ...},
      "skills_raw": ["Java", "Python", ...]
    }
    """
    prompt = f"""Tu es un expert RH. Analyse ce CV et extrais UNIQUEMENT le JSON suivant.

REGLES STRICTES :
1. "level" : deduis le niveau depuis le titre, l'experience totale et les responsabilites :
   - "etudiant" : en cours de formation, peu ou pas d'experience professionnelle
   - "junior" : 0-2 ans d'experience professionnelle reelle
   - "confirme" : 3-6 ans
   - "senior" : 7-12 ans
   - "expert" : 12+ ans ou architecte / CTO / expert reconnu

2. "total_experience_months" : additionne la duree de TOUS les postes/stages (pas la formation).
   Si duree non precisee, compte 6 mois par defaut par experience.

3. "domain" : liste des domaines ou spécialités informatiques identifiés. Choisis parmi : logiciel, web, mobile, data, bi, cloud, devops, cybersecurite, finance, sante, industrie, telecom.
   (Ex: Si le diplôme est "Ingénierie du logiciel" ou "Sécurité", renseigne "logiciel" ou "cybersecurite"). Laisse vide si incertain.

4. "skills_confirmed" : pour chaque competence technique utilisee dans un PROJET ou une
   EXPERIENCE (pas juste listee dans la section competences), note le projet/experience et l'annee.
   FORMAT : {{"NomSkill": ["Projet A (2024)", "Stage B (2023)"]}}
   N'inclus une competence que si elle est reellement utilisee dans au moins un projet/experience.

5. "skills_raw" : toutes les competences listees dans la section competences/skills,
   meme sans preuve de projet. Inclus langages, frameworks, outils, BDD, etc.

REPONDS UNIQUEMENT avec ce JSON exact (pas de texte autour) :
{{
  "level": "...",
  "total_experience_months": 0,
  "domain": [],
  "skills_confirmed": {{}},
  "skills_raw": []
}}

Texte du CV :
{cv_text[:8000]}
"""
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
    default = {
        "level": "junior",
        "total_experience_months": 0,
        "domain": [],
        "skills_confirmed": {},
        "skills_raw": []
    }
    try:
        response = requests.post(
            ollama_url,
            json={
                "model": "qwen2.5:7b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 1500}
            },
            timeout=1800  # 30 min — les gros CVs peuvent être lents
        )
        if response.status_code == 200:
            result = response.json().get("response", "")
            cleaned = result.strip()
            for fence in ["```json", "```"]:
                if cleaned.startswith(fence):
                    cleaned = cleaned[len(fence):]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            m = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if m:
                data = json.loads(m.group())
                profile = {
                    "level": data.get("level", "junior"),
                    "total_experience_months": int(data.get("total_experience_months", 0)),
                    "domain": data.get("domain", []),
                    "skills_confirmed": data.get("skills_confirmed", {}),
                    "skills_raw": data.get("skills_raw", [])
                }

                # ── Normalisation skills_confirmed ────────────────────────────────
                # Qwen retourne parfois des cles composees : "Java SE, MySQL, Eclipse" → on les eclate
                normalized_confirmed = {}
                for skill_key, proofs in profile["skills_confirmed"].items():
                    # Si la cle contient une virgule, c'est une ligne "Technologies : X, Y, Z"
                    parts = [s.strip() for s in re.split(r'[,;]', skill_key) if s.strip()]
                    if len(parts) > 1:
                        for part in parts:
                            if len(part) >= 2:  # ignore les fragments trop courts
                                normalized_confirmed[part] = proofs
                    else:
                        normalized_confirmed[skill_key] = proofs
                profile["skills_confirmed"] = normalized_confirmed

                # ── Fallback domaine : si Qwen n'a rien trouve, on detecte depuis le texte ──
                if not profile["domain"]:
                    detected = _detect_domains_from_text(cv_text)
                    if detected:
                        profile["domain"] = detected
                        print(f"[CV Profile] Domain fallback Python: {detected}")

                # ── Fallback skills_confirmed : si 0 confirmes mais skills_raw > 0 ──
                # Cherche les skills_raw qui apparaissent pres de mots-cles projet/stage
                if not profile["skills_confirmed"] and profile["skills_raw"]:
                    text_lower = cv_text.lower()
                    project_markers = ["projet", "project", "stage", "mission", "internship",
                                       "développé", "développement", "réalisé", "implémenté",
                                       "technologies", "technologie", "réalisation", "experience"]
                    has_projects = any(m in text_lower for m in project_markers)
                    if has_projects:
                        confirmed = {}
                        for skill in profile["skills_raw"]:  # Tous les skills (plus de limite à 10)
                            skill_lower = skill.lower()
                            # Cherche toutes les occurrences du skill dans le texte
                            start = 0
                            while True:
                                idx = text_lower.find(skill_lower, start)
                                if idx == -1:
                                    break
                                # Fenetre de contexte elargie : 300 chars avant/apres
                                context = cv_text[max(0, idx - 300):idx + 300]
                                if any(mk in context.lower() for mk in project_markers):
                                    confirmed[skill] = ["Detecte dans les projets/experiences"]
                                    break
                                start = idx + 1
                        if confirmed:
                            profile["skills_confirmed"] = confirmed
                            print(f"[CV Profile] skills_confirmed fallback: {list(confirmed.keys())}")

                print(f"[CV Profile] level={profile['level']} | "
                      f"exp={profile['total_experience_months']}m | "
                      f"domain={profile['domain']} | "
                      f"skills_raw={len(profile['skills_raw'])} | "
                      f"confirmed={len(profile['skills_confirmed'])}")
                return profile
    except Exception as e:
        print(f"[CV Profile] Erreur Qwen : {e}")
    return default
