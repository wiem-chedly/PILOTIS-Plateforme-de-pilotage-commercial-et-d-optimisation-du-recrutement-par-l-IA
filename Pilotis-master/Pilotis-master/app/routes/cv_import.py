# app/routes/cv_import.py
"""
Blueprint DoYouBuzz — les routes Flask sont sous /cv/*
Le proxy Vite rewrite /api → '' donc le frontend appelle /api/cv/import
qui arrive à Flask comme /cv/import.
"""
import json
from flask import Blueprint, jsonify, request
from app.services.doyoubuzz_service import DoYouBuzzService
from app.services.cv_parser_service import extract_candidate_data, save_to_candidates
from app.models.cv_import import CVImport
from app.extensions import db

cv_bp = Blueprint('cv', __name__, url_prefix='/cv')


# ── POST /cv/import ────────────────────────────────────────────────────────────
@cv_bp.route('/import', methods=['POST'])
def import_cvs():
    """
    Importe tous les candidats du mois courant depuis DoYouBuzz.
    Sauvegarde dans CVImport (log brut) ET dans Candidate (table principale).
    """
    service = DoYouBuzzService()
    import time
    try:
        # On ne récupère pas que les CVs de ce mois-ci, on inclut le mois précédent
        resumes = service.get_all_resumes(filter_current_month=True)
        results  = []
        created  = updated = skipped = errors = 0

        for resume in resumes:
            try:
                time.sleep(0.1)  # pause pour éviter le Rate Limiting (Timeout 15s)
                details = service.get_resume_details(resume['id'])
                parsed  = extract_candidate_data(details)

                # 1. Sauvegarde dans CVImport (log brut — comme le code collègue)
                cv = CVImport(
                    full_name  = parsed.get('full_name'),
                    first_name = parsed.get('first_name'),
                    last_name  = parsed.get('last_name'),
                    email      = parsed.get('email'),
                    phone      = parsed.get('phone'),
                    skills     = ', '.join(parsed.get('skills',    [])),
                    languages  = ', '.join(parsed.get('languages', [])),
                    raw_data   = json.dumps(details),
                )
                db.session.add(cv)

                created += 1
                results.append(parsed)

            except Exception as e:
                errors += 1
                print(f"[DoYouBuzz] Erreur profil {resume.get('id')}: {e}")

        db.session.commit()

        return jsonify({
            'success': True,
            'message': (
                f"{created} créé(s), {updated} mis à jour, "
                f"{skipped} ignoré(s), {errors} erreur(s)"
            ),
            'stats': {
                'created': created,
                'updated': updated,
                'skipped': skipped,
                'errors':  errors,
                'total':   len(resumes),
            },
            'data': results,
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ── GET /cv/import/history ─────────────────────────────────────────────────────
@cv_bp.route('/import/history', methods=['GET'])
def get_import_history():
    """Retourne les 30 derniers CVs importés."""
    logs = CVImport.query.order_by(CVImport.created_at.desc()).limit(30).all()
    return jsonify([{
        'id':         l.id,
        'full_name':  l.full_name,
        'email':      l.email,
        'skills':     l.skills,
        'created_at': l.created_at.isoformat(),
    } for l in logs])


# ── GET /cv/import/test-connection ─────────────────────────────────────────────
@cv_bp.route('/import/test-connection', methods=['GET'])
def test_doyoubuzz_connection():
    """Teste la connexion à l'API DoYouBuzz."""
    service = DoYouBuzzService()
    result  = service.test_connection()
    status  = 200 if result.get('success') else 502
    return jsonify(result), status


# ── GET /cv/import/preview ─────────────────────────────────────────────────────
@cv_bp.route('/import/preview', methods=['GET'])
def preview_doyoubuzz():
    """Aperçu des 5 premiers profils sans sauvegarder."""
    service = DoYouBuzzService()
    try:
        resumes  = service.get_all_resumes(filter_current_month=False)[:5]
        previews = []
        for r in resumes:
            details  = service.get_resume_details(r['id'])
            previews.append(extract_candidate_data(details))
        return jsonify({'success': True, 'count': len(previews), 'data': previews})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500