# app/services/cv_parser_service.py
"""
Transforme les données brutes de l'API DoYouBuzz en format structuré,
et sauvegarde également dans la table Candidate principale.
"""
import json
from datetime import datetime
from app.extensions import db


def extract_candidate_data(resume_json: dict) -> dict:
    """
    Transforme les données brutes retournées par DoYouBuzzService.get_resume_details()
    en dictionnaire structuré (compatible CVImport et Candidate).
    """
    return {
        'full_name':  resume_json.get('fullName', ''),
        'first_name': resume_json.get('firstName', ''),
        'last_name':  resume_json.get('lastName', ''),
        'email':      resume_json.get('email', ''),
        'phone':      resume_json.get('phone', ''),
        'skills':     [s.get('name', '') for s in resume_json.get('skills', [])],
        'languages':  [l.get('name', '') for l in resume_json.get('languages', [])],
        'experiences': [
            {
                'company':    exp.get('companyName', ''),
                'title':      exp.get('title', ''),
                'start_date': exp.get('startDate', ''),
                'end_date':   exp.get('endDate', ''),
                'description':exp.get('description', ''),
            }
            for exp in resume_json.get('experiences', [])
        ],
        'educations': [
            {
                'school':     edu.get('schoolName', ''),
                'degree':     edu.get('degree', ''),
                'field':      edu.get('field', ''),
                'start_date': edu.get('startDate', ''),
                'end_date':   edu.get('endDate', ''),
            }
            for edu in resume_json.get('educations', [])
        ],
    }


def save_to_candidates(parsed: dict) -> dict:
    """
    Sauvegarde également le profil dans la table Candidate principale
    (create ou update selon l'email).
    Retourne { 'action': 'created'|'updated'|'skipped' }.
    """
    from app.models.candidate import Candidate

    email = (parsed.get('email') or '').strip().lower()
    if not email:
        return {'action': 'skipped', 'reason': 'no_email'}

    skills_json = json.dumps(parsed.get('skills', []), ensure_ascii=False)
    cv_profile  = json.dumps({
        'first_name':   parsed.get('first_name', ''),
        'last_name':    parsed.get('last_name', ''),
        'skills_raw':   parsed.get('skills', []),
        'languages':    parsed.get('languages', []),
        'experiences':  parsed.get('experiences', []),
        'educations':   parsed.get('educations', []),
        'motivation_score': 0,
    }, ensure_ascii=False)

    existing = Candidate.query.filter(Candidate.email.ilike(email)).first()

    if existing:
        if parsed.get('first_name'): existing.first_name = parsed['first_name'][:30]
        if parsed.get('last_name'):  existing.last_name  = parsed['last_name'][:30]
        if parsed.get('phone') and not existing.phone:
            existing.phone = parsed['phone'][:20]
        existing.skills     = skills_json
        existing.cv_profile = cv_profile
        existing.updated_at = datetime.utcnow()
        db.session.commit()
        return {'action': 'updated', 'id': existing.id_candidate}

    candidate = Candidate(
        email      = email,
        first_name = (parsed.get('first_name') or '')[:30],
        last_name  = (parsed.get('last_name')  or '')[:30],
        phone      = (parsed.get('phone')       or '')[:20] or None,
        source     = 'doyoubuzz',
        skills     = skills_json,
        cv_profile = cv_profile,
    )
    db.session.add(candidate)
    db.session.commit()
    return {'action': 'created', 'id': candidate.id_candidate}
