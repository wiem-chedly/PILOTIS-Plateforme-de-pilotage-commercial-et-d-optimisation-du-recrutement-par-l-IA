import json
import requests
import os
import re

_match_cache = {}

# ── Familles technologiques (Idee 1) ─────────────────────────────────────────
# Allows partial credit when candidate has a related technology (same family)
TECH_FAMILIES = {
    "js_frontend":   ["javascript", "typescript", "react", "reactjs", "angular", "angularjs",
                      "vue", "vuejs", "nextjs", "nuxt", "svelte", "jquery"],
    "java_backend":  ["java", "spring", "spring boot", "springboot", "hibernate", "maven",
                      "gradle", "kotlin", "jvm", "jpa", "jakarta"],
    "dotnet":        ["c#", ".net", "asp.net", "dotnet", "entity framework", "blazor", "wpf"],
    "python":        ["python", "django", "flask", "fastapi", "pandas", "numpy", "sqlalchemy"],
    "php":           ["php", "symfony", "laravel", "wordpress", "composer"],
    "mobile":        ["android", "ios", "swift", "kotlin", "flutter", "react native",
                      "xamarin", "android studio", "javafx"],
    "sql_db":        ["sql", "mysql", "postgresql", "postgres", "oracle", "sql server",
                      "mariadb", "sqlite"],
    "nosql_db":      ["mongodb", "redis", "cassandra", "firebase", "elasticsearch",
                      "dynamodb", "couch"],
    "devops":        ["docker", "kubernetes", "jenkins", "gitlab ci", "github actions",
                      "ci/cd", "terraform", "ansible", "helm"],
    "cloud":         ["aws", "azure", "gcp", "google cloud", "s3", "lambda", "ec2"],
    "data":          ["machine learning", "deep learning", "tensorflow", "pytorch", "scikit",
                      "spark", "hadoop", "power bi", "tableau", "data science", "ia"],
    "cobol_legacy":  ["cobol", "mainframe", "jcl", "pl/i"],
    "node_backend":  ["node", "nodejs", "express", "nestjs", "fastify"],
}

# ── Mots-cles de niveau dans les offres ──────────────────────────────────────
LEVEL_KEYWORDS = {
    "expert":    ["architecte", "architect", "cto", "expert", "lead technique", "tech lead",
                  "principal engineer", "12 ans", "15 ans", "10+ ans"],
    "senior":    ["senior", "confirmé", "confirme", "7 ans", "8 ans", "9 ans",
                  "10 ans", "5+ ans", "6 ans"],
    "confirme":  ["confirmé", "confirme", "3 ans", "4 ans", "5 ans", "intermédiaire"],
    "junior":    ["junior", "débutant", "debutant", "1 an", "2 ans"],
    "etudiant":  ["stage", "alternance", "apprenti", "etudiant", "étudiant", "pfe"],
    "directeur": ["directeur", "manager", "chef de projet", "responsable", "head of",
                  "vp ", "vice president"],
}

LEVEL_ORDER = ["etudiant", "junior", "confirme", "senior", "expert", "directeur"]

# ── Domaines metier ───────────────────────────────────────────────────────────
DOMAIN_KEYWORDS = {
    "finance":     ["banque", "finance", "assurance", "trading", "bourse", "cacib",
                    "bnp", "societe generale", "credit", "leasing", "bfi"],
    "sante":       ["sante", "santé", "medical", "hôpital", "hopital", "pharma",
                    "clinique", "soins"],
    "industrie":   ["industrie", "manufacturing", "usine", "production", "automobile",
                    "aero", "aéronautique"],
    "telecom":     ["telecom", "telecoms", "orange", "sfr", "bouygues", "reseau",
                    "5g", "4g", "nsa"],
    "e-commerce":  ["e-commerce", "ecommerce", "retail", "marketplace", "boutique en ligne"],
    "energie":     ["energie", "énergie", "electricite", "utilities", "engie", "total"],
    "rh":          ["ressources humaines", "rh", "paie", "talent", "recrutement"],
    "logiciel":    ["logiciel", "software", "informatique", "génie logiciel", "ingénierie",
                    "développement", "développeur", "programmation", "developer",
                    "ingénieur", "engineer", "it ", "java", "python", "c++", "c#", ".net",
                    "kotlin", "scala", "golang", "rust", "php", "ruby"],
    "data":        ["data", "données", "data science", "machine learning", "ia",
                    "intelligence artificielle", "big data", "analytics", "datalake",
                    "donnees", "tensorflow", "pytorch", "pandas", "spark", "hadoop",
                    "power bi", "tableau", "qlik", "etl", "datawarehouse"],
    "bi":          ["bi", "business intelligence", "décisionnel", "power bi",
                    "tableau", "qlik", "etl", "datawarehouse"],
    "cloud":       ["cloud", "aws", "azure", "gcp", "finops", "cloud computing",
                    "infrastructures", "systèmes", "amazon web", "google cloud"],
    "cybersecurite":["cybersecurite", "cyber", "sécurité", "security", "pentest",
                    "soc", "iam", "cryptographie", "réseaux", "siem", "firewall"],
    "devops":      ["devops", "infrastructure", "cicd", "ci/cd", "platform", "sre",
                    "conteneurisation", "kubernetes", "docker", "jenkins", "ansible",
                    "terraform", "gitlab ci", "github actions"],
    "web":         ["web", "application web", "site web", "front", "back", "full stack",
                    "fullstack", "react", "angular", "vue", "nextjs", "nodejs",
                    "javascript", "typescript", "html", "css", "django", "flask",
                    "spring", "laravel", "symfony"],
    "mobile":      ["mobile", "application mobile", "android", "ios", "app store",
                    "flutter", "react native", "swift", "kotlin", "xamarin"],
    "embarque":    ["embarqué", "embarque", "iot", "stm32", "arduino", "raspberry",
                    "fpga", "temps réel", "rtos", "firmware"],
}


# ── Ponderation par recence (Idee 2) ─────────────────────────────────────────
import datetime as _dt
_CURRENT_YEAR = _dt.datetime.now().year

def _recency_weight(proof_strings):
    """
    Extrait l'annee la plus recente depuis les preuves (ex: 'Stage X (2024)')
    et retourne un coefficient de ponderation :
    Annee courante -> 1.0 | -1 an -> 0.9 | -2 ans -> 0.75 | -3 ans -> 0.6 | < -3 ans -> 0.4
    """
    years = []
    for proof in proof_strings:
        m = re.search(r'\b(20\d{2})\b', str(proof))
        if m:
            years.append(int(m.group(1)))
    if not years:
        return 0.85  # annee inconnue -> poids neutre moyen
    most_recent = max(years)
    gap = _CURRENT_YEAR - most_recent
    if gap <= 0:   return 1.0
    if gap == 1:   return 0.9
    if gap == 2:   return 0.75
    if gap == 3:   return 0.6
    return 0.4



def _get_family(skill_lower):
    """Retourne la famille d'une competence ou None."""
    for family, members in TECH_FAMILIES.items():
        if skill_lower in members:
            return family
    return None


def _detect_level_in_text(text_lower):
    """Detecte le niveau requis dans le texte d'une offre."""
    for level, kws in LEVEL_KEYWORDS.items():
        for kw in kws:
            if kw in text_lower:
                return level
    return None


def _detect_domain_in_text(text_lower):
    """Detecte le domaine metier dans le texte d'une offre."""
    found = []
    for domain, kws in DOMAIN_KEYWORDS.items():
        if any(kw in text_lower for kw in kws):
            found.append(domain)
    return found


def _level_gap_penalty(candidate_level, job_level):
    """
    Idee 4 — Disqualificateurs durs.
    Retourne (penalite 0-1, message) selon l'ecart de niveau.
    Un score est multiplie par (1 - penalite).
    """
    if not job_level or not candidate_level:
        return 0.0, None

    # Directeur / manager : toujours incompatible avec etudiant/junior
    if job_level == "directeur":
        if candidate_level in ["etudiant", "junior"]:
            return 0.85, "Poste directeur/manager incompatible avec profil etudiant/junior"
        if candidate_level == "confirme":
            return 0.4, "Poste directeur/manager souhaite profil senior minimum"
        return 0.0, None

    try:
        cand_idx = LEVEL_ORDER.index(candidate_level)
        job_idx  = LEVEL_ORDER.index(job_level)
    except ValueError:
        return 0.0, None

    gap = job_idx - cand_idx
    if gap >= 3:
        return 0.75, f"Ecart de niveau trop important ({candidate_level} vs {job_level} requis)"
    if gap == 2:
        return 0.5, f"Niveau {candidate_level} insuffisant pour un poste {job_level}"
    if gap == 1:
        return 0.2, f"Niveau {candidate_level} leger pour un poste {job_level}"
    return 0.0, None  # gap <= 0 : OK ou sur-qualifie


def smart_match(cv_profile, job_titre, job_desc, job_criteres):
    """
    Matching intelligent candidat <> offre.
    Utilise le profil structure extrait par Qwen (cv_profile).

    Inclut :
    - Base : skills_confirmed (40%) + skills_raw (25%)
    - Idee 1 : familles technologiques (credit partiel pour technos proches)
    - Idee 4 : disqualificateurs durs (plafond selon ecart de niveau)
    - Idee 7 : explication detaillee ligne par ligne

    Retourne : (score 0-100, justification_courte, explication_longue, confidence)
    """
    if not cv_profile:
        return 0, "Profil non disponible", "", "low"

    job_text_lower = (job_titre + " " + job_desc + " " + job_criteres).lower()
    skills_confirmed = cv_profile.get("skills_confirmed", {})  # {skill: [preuves]}
    skills_raw       = [s.lower() for s in cv_profile.get("skills_raw", [])]
    candidate_level  = cv_profile.get("level", "junior")
    candidate_domain = [d.lower() for d in cv_profile.get("domain", [])]

    explanation_lines = []
    score_confirmed   = 0.0   # Part confirmee par projets (poids 40%)
    score_raw         = 0.0   # Part skills listes seulement (poids 25%)
    score_level       = 0.0   # Niveau (poids 20%)
    score_domain      = 0.0   # Domaine metier (poids 15%)

    # ── 1. Extraire les skills requis dans l'offre ────────────────────────────
    # Liste elargie de technologies reconnues
    all_tech = set()
    for members in TECH_FAMILIES.values():
        all_tech.update(members)

    job_required_skills = set()
    for tech in all_tech:
        if tech in job_text_lower:
            job_required_skills.add(tech)
    # Ajout de mots-cles metier specifiques
    extra_kws = ["cobol", "business analyst", "ba", "chef de projet", "scrum master",
                 "product owner", "data analyst", "devops engineer", "support", "loan",
                 "full stack", "fullstack", "apache camel", "rest api", "microservices"]
    for kw in extra_kws:
        if kw in job_text_lower:
            job_required_skills.add(kw)

    if not job_required_skills:
        # Offre sans skills identifies : scoring minimal base sur niveau+domaine uniquement
        expl = "Aucune competence technique precise identifiee dans l'offre — scoring base sur niveau et domaine."
        return 30, expl, expl, "low"

    # ── 2. Skills confirmes par projets (poids 40%) ───────────────────────────
    confirmed_matched  = []
    confirmed_partial  = []
    confirmed_missing  = []

    confirmed_skills_lower = {s.lower(): proofs for s, proofs in skills_confirmed.items()}

    for req_skill in job_required_skills:
        req_family = _get_family(req_skill)

        # Correspondance exacte confirmee
        if req_skill in confirmed_skills_lower:
            proofs = confirmed_skills_lower[req_skill]
            proof_str = ", ".join(proofs[:2])
            confirmed_matched.append((req_skill, proof_str))
            score_confirmed += 1.0

        else:
            # ── Correspondance par prefixe / sous-chaine ──────────────────────
            # Ex: req="java" matche confirmed="java se", "java ee", "javafx"
            # Ex: req="spring boot" matche confirmed="spring"
            prefix_found = False
            for cand_skill, proofs in confirmed_skills_lower.items():
                if cand_skill.startswith(req_skill) or req_skill.startswith(cand_skill):
                    proof_str = ", ".join(proofs[:2])
                    confirmed_matched.append((req_skill, proof_str))
                    score_confirmed += 1.0
                    prefix_found = True
                    break
            if prefix_found:
                continue

            # Correspondance partielle via famille (Idee 1)
            partial_found = False
            if req_family:
                for cand_skill, proofs in confirmed_skills_lower.items():
                    if _get_family(cand_skill) == req_family:
                        proof_str = ", ".join(proofs[:1])
                        confirmed_partial.append((req_skill, cand_skill, proof_str))
                        recency = _recency_weight(proofs)
                        score_confirmed += 0.5 * recency  # credit partiel avec recence
                        partial_found = True
                        break
            if not partial_found:
                # Déduction intelligente: Si "full stack" est demandé, et le candidat a confirmé un front et un back
                if req_skill in ["full stack", "fullstack"]:
                    has_front = any(_get_family(cand) == "js_frontend" for cand in confirmed_skills_lower.keys())
                    has_back = any(_get_family(cand) in ["java_backend", "python", "dotnet", "php", "node_backend"] for cand in confirmed_skills_lower.keys())
                    if has_front and has_back:
                        confirmed_partial.append((req_skill, "frontend & backend", "Déduit des technologies projets"))
                        score_confirmed += 0.8  # Fort crédit partiel
                        continue

                confirmed_missing.append(req_skill)

    max_confirmed = len(job_required_skills)
    pct_confirmed = (score_confirmed / max_confirmed) * 40 if max_confirmed > 0 else 0

    for skill, proof in confirmed_matched:
        explanation_lines.append(f"Confirme : {skill} — {proof} (+{round(40/max_confirmed, 1)} pts)")
    for req, cand, proof in confirmed_partial:
        explanation_lines.append(f"Partiel  : {req} ~ {cand} (meme famille) — {proof} (+{round(20/max_confirmed, 1)} pts)")
    for skill in confirmed_missing:
        explanation_lines.append(f"Manquant : {skill} non confirme dans les projets")

    # ── 3. Skills bruts (listes seulement, poids 25%) ────────────────────────
    raw_matched = []
    for req_skill in job_required_skills:
        if req_skill in confirmed_skills_lower:
            continue  # deja compte
        req_family = _get_family(req_skill)
        if req_skill in skills_raw:
            raw_matched.append(req_skill)
            score_raw += 1.0
        elif req_family:
            for rs in skills_raw:
                if _get_family(rs) == req_family:
                    raw_matched.append(f"{req_skill}~{rs}")
                    score_raw += 0.4
                    break

    pct_raw = (score_raw / max_confirmed) * 25 if max_confirmed > 0 else 0
    if raw_matched:
        explanation_lines.append(f"Liste sans projet : {', '.join(raw_matched[:5])} (+{round(pct_raw, 1)} pts)")

    # ── 4. Niveau (poids 20%) ─────────────────────────────────────────────────
    job_level = _detect_level_in_text(job_text_lower)
    penalty, penalty_msg = _level_gap_penalty(candidate_level, job_level)

    if job_level:
        if penalty == 0.0:
            score_level = 20
            explanation_lines.append(f"Niveau OK : {candidate_level} pour poste {job_level} (+20 pts)")
        elif penalty <= 0.2:
            score_level = 14
            explanation_lines.append(f"Niveau leger : {candidate_level} pour poste {job_level} (+14 pts) — {penalty_msg}")
        elif penalty <= 0.5:
            score_level = 6
            explanation_lines.append(f"Niveau insuffisant : {penalty_msg} (+6 pts)")
        else:
            score_level = 0
            explanation_lines.append(f"Disqualifiant : {penalty_msg} (0 pts)")
    else:
        score_level = 14  # niveau non precise dans l'offre : score neutre
        explanation_lines.append(f"Niveau non precise dans l'offre (+14 pts)")

    # ── 5. Domaine métier (poids 15%) ─────────────────────────────────────────
    job_domains = _detect_domain_in_text(job_text_lower)

    # ── Inférence de domaine depuis les skills requis si aucun domaine détecté ──
    if not job_domains and job_required_skills:
        _SKILL_DOMAIN_MAP = {
            "java": "logiciel", "python": "logiciel", "c#": "logiciel",
            ".net": "logiciel", "kotlin": "logiciel", "scala": "logiciel",
            "php": "logiciel", "ruby": "logiciel",
            "react": "web", "angular": "web", "vue": "web",
            "javascript": "web", "typescript": "web", "nodejs": "web",
            "django": "web", "flask": "web", "spring boot": "web",
            "android": "mobile", "ios": "mobile", "flutter": "mobile",
            "swift": "mobile", "react native": "mobile",
            "docker": "devops", "kubernetes": "devops", "jenkins": "devops",
            "aws": "cloud", "azure": "cloud", "gcp": "cloud",
            "tensorflow": "data", "pytorch": "data", "spark": "data",
            "machine learning": "data", "sql": "logiciel", "mysql": "logiciel",
        }
        inferred = set()
        for sk in job_required_skills:
            d = _SKILL_DOMAIN_MAP.get(sk)
            if d:
                inferred.add(d)
        if inferred:
            job_domains = list(inferred)
            explanation_lines.append(f"Domaine infere depuis les skills requis: {', '.join(job_domains)}")

    if job_domains and candidate_domain:
        common_domains = set(job_domains) & set(candidate_domain)
        if common_domains:
            score_domain = 15
            explanation_lines.append(f"Domaine match : {', '.join(common_domains)} (+15 pts)")
        else:
            score_domain = 5
            explanation_lines.append(f"Domaine different : offre {job_domains} vs candidat {candidate_domain} (+5 pts)")
    elif job_domains and not candidate_domain:
        # Offre a un domaine mais candidat inconnu → neutre
        score_domain = 8
        explanation_lines.append(f"Domaine candidat non identifie (offre: {job_domains}) (+8 pts)")
    elif not job_domains and candidate_domain:
        # Candidat a un domaine mais offre générique → crédit partiel candidat
        score_domain = 12
        explanation_lines.append(f"Domaine candidat: {', '.join(candidate_domain)} (offre générique) (+12 pts)")
    else:
        score_domain = 10  # aucun domaine identifie des deux côtés : neutre
        explanation_lines.append("Domaine non identifie (+10 pts)")

    # ── 6. Score final avec disqualificateur dur ──────────────────────────────
    raw_score = pct_confirmed + pct_raw + score_level + score_domain
    final_score = int(min(raw_score * (1 - penalty), 100))

    if penalty >= 0.75:
        final_score = min(final_score, 25)  # plafond dur
    elif penalty >= 0.5:
        final_score = min(final_score, 45)

    # ── 7. Indicateur de confiance ────────────────────────────────────────────
    nb_confirmed = len(skills_confirmed)
    exp_months   = cv_profile.get("total_experience_months", 0)
    if nb_confirmed >= 2 and exp_months > 0:
        confidence = "high"
    elif nb_confirmed >= 1 or exp_months > 0 or len(skills_raw) >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    # Justification courte
    if final_score >= 70:
        justification = f"Forte correspondance ({nb_confirmed} skills confirmes, niveau {candidate_level})"
    elif final_score >= 40:
        justification = f"Correspondance partielle ({len(confirmed_matched)} confirmes, {len(confirmed_partial)} approches)"
    elif penalty >= 0.5:
        justification = penalty_msg or "Ecart de niveau important"
    else:
        justification = f"Faible correspondance ({len(job_required_skills)} skills requis, {len(confirmed_matched)} confirmes)"

    # Explication complete (Idee 7)
    explanation_lines.insert(0, f"Score : {final_score}/100 | Niveau candidat : {candidate_level} | Confiance : {confidence}")
    explanation = "\n".join(explanation_lines)

    print(f"[SmartMatch] '{job_titre}' -> score {final_score} | confiance={confidence}")
    return final_score, justification, explanation, confidence


# ─────────────────────────────────────────────────────────────────────────────
# Fonction legacy (gardee pour compatibilite avec le code existant)
# ─────────────────────────────────────────────────────────────────────────────
def match_candidate_with_opportunity(cv_text, skills_text, job_titre, job_desc, job_criteria):
    """
    Matching rapide legacy — utilise maintenant smart_match si possible.
    Retourne (score, justification).
    """
    # Construire un profil minimal depuis skills_text
    skills_list = []
    if skills_text:
        try:
            parsed = json.loads(skills_text)
            skills_list = [s.lower() for s in parsed] if isinstance(parsed, list) else []
        except Exception:
            skills_list = [s.strip().lower() for s in skills_text.split(',') if s.strip()]

    minimal_profile = {
        "level": "junior",
        "total_experience_months": 0,
        "domain": [],
        "skills_confirmed": {},
        "skills_raw": skills_list
    }
    score, justif, _, _ = smart_match(minimal_profile, job_titre, job_desc, job_criteria)
    return score, justif


def analyze_cv_with_ai(cv_text, job_description="", job_criteres=""):
    """
    Analyse complete avec IA (utilisee apres association ou extraction simple).
    """
    if job_description or job_criteres:
        prompt = f"""Tu es un expert en recrutement technique. Compare le CV suivant avec la description du poste.

CV DU CANDIDAT :
{cv_text[:3000]}

DESCRIPTION DU POSTE :
{job_description[:2000] if job_description else 'Non specifiee'}

COMPETENCES REQUISES :
{job_criteres[:1000] if job_criteres else 'Non specifiees'}

Reponds UNIQUEMENT au format JSON valide :
- "skills": liste des competences techniques extraites du CV (au moins 3)
- "score": un nombre entre 0 et 100
- "justification": une courte phrase

Exemple : {{"skills": ["Python", "SQL"], "score": 85, "justification": "Bonne correspondance"}}
"""
    else:
        prompt = f"""Extrait les competences techniques du CV suivant.

CV : {cv_text[:3000]}

Reponds UNIQUEMENT au format JSON avec la cle "skills".
Exemple : {{"skills": ["Python", "SQL"]}}
"""

    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
    try:
        response = requests.post(ollama_url, json={
            "model": "qwen2.5:7b",
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1}
        }, timeout=120)
        if response.status_code == 200:
            result = response.json().get("response", "")
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                if not job_description and not job_criteres:
                    return {"skills": data.get("skills", []), "score": 0, "justification": ""}
                return {
                    "skills": data.get("skills", []),
                    "score": data.get("score", 0),
                    "justification": data.get("justification", "")
                }
    except Exception as e:
        print(f"Erreur analyse IA: {e}")
    return {"skills": [], "score": 0, "justification": "Erreur"}


def analyze_semantic_match_with_ai(candidate_profile_text, job_titre, job_desc, job_criteres):
    """
    Analyse sémantique pure par l'IA (Approche Wiem) : retourne un JSON avec exact_matches, semantic_matches, etc.
    Ne demande pas de score sur 100.
    """
    prompt = f"""Tu es un expert en recrutement IT. Ton rôle est d'analyser sémantiquement l'adéquation entre un profil candidat et une offre d'emploi.

PROFIL DU CANDIDAT (Compétences et expérience) :
{candidate_profile_text[:2000]}

OFFRE D'EMPLOI :
Titre : {job_titre}
Description : {job_desc[:1500] if job_desc else 'Non specifiee'}
Critères : {job_criteres[:1000] if job_criteres else 'Non specifiees'}

TA MISSION :
Identifie les compétences requises par l'offre qui sont présentes dans le profil du candidat, celles qui sont sémantiquement proches (ex: React et Next.js), et celles qui manquent.

RÉPONDS UNIQUEMENT AU FORMAT JSON STRICT avec cette structure exacte :
{{
  "exact_matches": ["compétence 1", "compétence 2"],
  "semantic_matches": [
    {{"required": "Compétence requise", "found": "Compétence trouvée", "justification": "Pourquoi c'est proche"}}
  ],
  "missing_critical_skills": ["compétence manquante 1"],
  "analysis_explanation": "Une explication RH globale de 2 phrases résumant l'adéquation technique."
}}
"""
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
    try:
        response = requests.post(ollama_url, json={
            "model": "qwen2.5:7b",
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1}
        }, timeout=1800)
        
        if response.status_code == 200:
            result = response.json().get("response", "")
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
    except Exception as e:
        print(f"Erreur analyse sémantique IA: {e}")
    
    # Fallback si l'IA échoue
    return {
        "exact_matches": [],
        "semantic_matches": [],
        "missing_critical_skills": ["Erreur d'analyse IA"],
        "analysis_explanation": "L'analyse IA n'a pas pu aboutir."
    }