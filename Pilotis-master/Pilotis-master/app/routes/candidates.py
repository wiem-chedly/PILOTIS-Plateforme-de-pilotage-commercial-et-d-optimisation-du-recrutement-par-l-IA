# app/routes/candidates.py
"""
Blueprint pour toutes les routes candidates.

URL prefix : /api
Routes :
    GET    /candidates
    GET    /candidates/<id>
    GET    /candidates/<id>/cv
    GET    /candidates/<id>/matching-opportunities
    PUT    /candidates/<id>/link
    PATCH  /candidates/<id>/link-decision
    DELETE /candidates/<id>
    POST   /candidates/<id>/reanalyze
    POST   /scan-emails
    POST   /extract-ao-from-image
    POST   /boond/create-opportunity
"""

from flask import Blueprint, jsonify, request, Response, current_app, session
from datetime import datetime, timedelta
import os
import json
import threading

from app.models.job_requisition import JobRequisition
from app.models.candidate import Candidate
from app.models.contact import Contact
from app.services.ai_analyzer import smart_match
from app.extensions import db
from sqlalchemy import or_

candidates_bp = Blueprint("candidates", __name__)

import re

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def extract_linkedin_url(cv_text):
    if not cv_text:
        return None
    patterns = [
        r'(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+/?',
        r'(?:https?://)?(?:www\.)?linkedin\.com/pub/[\w\-]+/?'
    ]
    for pattern in patterns:
        match = re.search(pattern, cv_text, re.IGNORECASE)
        if match:
            url = match.group(0)
            if not url.startswith('http'):
                url = 'https://' + url
            return url
    return None

def _convert_date(date_str: str):
    try:
        jour, mois, an = date_str.split("/")
        an_full = 2000 + int(an) if int(an) < 50 else 1900 + int(an)
        return datetime(an_full, int(mois), int(jour))
    except Exception:
        return None


# ── Idée 8 : Recalcul automatique des scores quand un AO est créé/modifié ────
def _recalculate_all_candidate_scores(app, job):
    """
    Recalcule le score de tous les candidats actifs pour un AO donné.
    Lance en thread daemon, n'impacte pas les performances du serveur.
    """
    def _run():
        with app.app_context():
            from app.models.candidate import Candidate as _Cand
            from app.services.ai_analyzer import smart_match as _sm
            from app.extensions import db as _db
            import json as _json
            candidates = _Cand.query.filter(
                _Cand.job_requisition_id == job.requisition_id
            ).all()
            if not candidates:
                print(f"[Idea8] Aucun candidat lié à l'offre {job.requisition_id}")
                return
            print(f"[Idea8] Recalcul scores pour {len(candidates)} candidat(s) -> AO {job.titre}")
            for c in candidates:
                try:
                    profile = _json.loads(c.cv_profile) if c.cv_profile else None
                    if not profile:
                        continue
                    score, justif, explanation, confidence = _sm(
                        profile, job.titre or "", job.description or "", job.criteres or ""
                    )
                    c.match_score = score
                    c.match_justification = justif
                    c.match_explanation = explanation
                    c.match_confidence = confidence
                except Exception as e:
                    print(f"[Idea8] Erreur candidat {c.id_candidate}: {e}")
            _db.session.commit()
            print(f"[Idea8] Recalcul terminé pour AO {job.requisition_id}")

    t = threading.Thread(target=_run, daemon=True, name=f"recalc-ao-{job.requisition_id}")
    t.start()


def apply_rbac_candidate_filter(query):
    role = session.get('user_role')
    if not role or role == 'super_admin':
        return query
        
    user_id = session.get('user_id')
    org_id = session.get('organization_id')
    
    from app.models.users import User
    user = User.query.get(user_id) if user_id else None
    org_name = user.client_nom if user and user.client_nom else None
    
    if not org_name and org_id:
        from app.models.organization import Organization
        org = Organization.query.get(org_id)
        if org:
            org_name = org.name
            
    if org_name:
        return query.outerjoin(
            JobRequisition, Candidate.job_requisition_id == JobRequisition.requisition_id
        ).filter(
            or_(
                JobRequisition.client_nom == org_name,
                Candidate.organization_id == org_id if org_id else False
            )
        )
    
    return query.filter(Candidate.id_candidate == -1)

# ── GET /candidates ────────────────────────────────────────────────────────────
@candidates_bp.route("/candidates", methods=["GET"])
def get_candidates():
    query = apply_rbac_candidate_filter(Candidate.query)
    candidates = query.order_by(Candidate.created_at.desc()).all()
    result = []
    for c in candidates:
        job_title = None
        job_client = None
        if c.job_requisition_id:
            job = JobRequisition.query.get(c.job_requisition_id)
            if job:
                job_title = job.titre
                job_client = job.client_nom

        contact_name = None
        if c.recipient_contact_id:
            contact = Contact.query.get(c.recipient_contact_id)
            if contact:
                contact_name = contact.name

        linkedin_url = c.linkedin_profile_url if hasattr(c, 'linkedin_profile_url') and c.linkedin_profile_url else None
        if not linkedin_url and hasattr(c, 'cv_parsed') and c.cv_parsed:
            linkedin_url = extract_linkedin_url(c.cv_parsed)
        # Récupération du vrai score hybride depuis CandidateMany si le candidat est lié à une offre
        matching_score = c.match_score
        match_justification = c.match_justification
        
        app_status = None
        application_id = None
        if c.job_requisition_id:
            from app.models.candidate_many import CandidateMany
            app_link = CandidateMany.query.filter_by(
                candidate_id=c.id_candidate, 
                requisition_id=c.job_requisition_id
            ).first()
            if app_link:
                app_status = app_link.status
                application_id = app_link.id_many
                if app_link.match_score is not None:
                    matching_score = app_link.match_score
                    match_justification = app_link.match_justification

        result.append({
            'id': c.id_candidate,
            'first_name': c.first_name or "",
            'last_name': c.last_name or "",
            'email': c.email,
            'phone': c.phone,
            'source': c.source,
            'matching_score': matching_score,
            'match_justification': match_justification,
            'match_explanation': c.match_explanation if hasattr(c, 'match_explanation') else None,
            'match_confidence': c.match_confidence if hasattr(c, 'match_confidence') else None,
            'cv_profile': c.cv_profile if hasattr(c, 'cv_profile') else None,
            'cv_path': c.cv_path,
            'skills': json.loads(c.skills) if c.skills else [],
            'job_title': job_title,
            'job_requisition_id': c.job_requisition_id,
            'company': job_client,
            'contact_name': contact_name,
            'created_at': c.created_at.isoformat(),
            'link_status': c.link_status,
            'suggested_job_id': c.suggested_job_requisition_id,
            'suggested_job_title': c.suggested_job.titre if c.suggested_job_requisition_id and c.suggested_job else None,
            'location': c.location if hasattr(c, 'location') else None,
            'linkedin_profile_url': linkedin_url,
            'app_status': app_status,
            'application_id': application_id,
        })
    return jsonify(result)


# ── GET /candidates/<id> ───────────────────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>", methods=["GET"])
def get_candidate_detail(candidate_id):
    query = apply_rbac_candidate_filter(Candidate.query)
    candidate = query.filter(Candidate.id_candidate == candidate_id).first()
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    job_title = None
    if candidate.job_requisition_id:
        job = JobRequisition.query.get(candidate.job_requisition_id)
        if job:
            job_title = job.titre

    contact_name = None
    if candidate.recipient_contact_id:
        contact = Contact.query.get(candidate.recipient_contact_id)
        if contact:
            contact_name = contact.name

    return jsonify({
        'id': candidate.id_candidate,
        'first_name': candidate.first_name,
        'last_name': candidate.last_name,
        'email': candidate.email,
        'phone': candidate.phone,
        'source': candidate.source,
        'matching_score': candidate.match_score,
        'match_justification': candidate.match_justification,
        'cv_path': candidate.cv_path,
        'skills': json.loads(candidate.skills) if candidate.skills else [],
        'job_title': job_title,
        'contact_name': contact_name,
        'created_at': candidate.created_at.isoformat()
    })


# ── GET /candidates/<id>/cv ────────────────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/cv", methods=["GET", "OPTIONS"])
def get_candidate_cv(candidate_id):
    if request.method == 'OPTIONS':
        response = Response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404
    if not candidate.cv_path:
        return jsonify({"error": "Aucun CV associé"}), 404

    cv_path = candidate.cv_path
    
    if cv_path.startswith('http'):
        # ✅ Lien Google Drive → redirection directe vers Drive
        from flask import redirect
        return redirect(cv_path)

    if not os.path.isabs(cv_path):
        cv_path = os.path.join(PROJECT_ROOT, cv_path)
        cv_path = os.path.normpath(cv_path)

    if not os.path.exists(cv_path):
        return jsonify({"error": "Fichier CV introuvable"}), 404

    filename = f"CV_{candidate.first_name or 'candidat'}_{candidate.last_name or ''}.pdf".replace(' ', '_')
    inline = request.args.get('inline', 'false').lower() == 'true'
    disposition = 'inline' if inline else 'attachment'

    with open(cv_path, 'rb') as f:
        cv_data = f.read()

    response = Response(cv_data)
    if cv_path.lower().endswith('.pdf'):
        response.headers['Content-Type'] = 'application/pdf'
    else:
        response.headers['Content-Type'] = 'application/octet-stream'
    response.headers['Content-Disposition'] = f'{disposition}; filename="{filename}"'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


# ── GET /candidates/<id>/cv-url ──────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/cv-url", methods=["GET"])
def get_candidate_cv_url(candidate_id):
    """Retourne l'URL Drive du CV d'un candidat (pour ouverture directe)."""
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404
    if not candidate.cv_path:
        return jsonify({"error": "Aucun CV associé"}), 404
    return jsonify({"cv_url": candidate.cv_path, "is_drive": candidate.cv_path.startswith('http')})

# ── GET /candidates/<id>/matching-opportunities ───────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/matching-opportunities", methods=["GET"])
def get_matching_opportunities(candidate_id):
    """
    Retourne les offres compatibles pour un candidat.
    Utilise smart_match avec cv_profile si disponible.
    """
    import json as _json
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    cutoff = datetime.now() - timedelta(days=7)
    besoins = JobRequisition.query.filter(
        JobRequisition.etat_complet == "En cours 0/25%"
    ).all()

    all_opportunities = [
        b for b in besoins
        if _convert_date(b.date) and _convert_date(b.date) >= cutoff
    ]

    if not all_opportunities:
        return jsonify({"matching_opportunities": []})

    from app.services.auto_matcher import AutoMatcher
    
    cv_profile_text = candidate.cv_profile if candidate.cv_profile else candidate.cv_parsed

    matching = []
    for opp in all_opportunities:
        try:
            score, justif = AutoMatcher._calculate_hybrid_score(cv_profile_text, opp)
            print(f"Offre {opp.requisition_id} ({opp.titre}) -> score {score}")
            matching.append({
                "id": opp.requisition_id,
                "titre": opp.titre,
                "reference": opp.reference,
                "score": score,
                "justification": justif,
                "explanation": justif,  # La justification RH détaillée sert d'explication
                "confidence": "high"
            })
        except Exception as e:
            print(f"Erreur offre {opp.requisition_id}: {e}")

    matching.sort(key=lambda x: x["score"], reverse=True)
    return jsonify({"matching_opportunities": matching})


# ── PUT /candidates/<id>/link ──────────────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/link", methods=["PUT"])
def link_candidate_to_opportunity(candidate_id):
    data = request.json
    opportunity_id = data.get("opportunity_id")
    if not opportunity_id:
        return jsonify({"error": "opportunity_id requis"}), 400

    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    job = JobRequisition.query.get(opportunity_id)
    if not job:
        return jsonify({"error": "Offre non trouvée"}), 404

    candidate.job_requisition_id = opportunity_id
    candidate.match_score = data.get("score", 0)
    candidate.match_justification = data.get("justification", "")

    # Recalculate smart score with new hybrid engine
    from app.services.auto_matcher import AutoMatcher
    cv_profile_text = candidate.cv_profile if candidate.cv_profile else candidate.cv_parsed
    
    try:
        score, justif = AutoMatcher._calculate_hybrid_score(cv_profile_text, job)
        candidate.match_score = score
        candidate.match_justification = justif
        candidate.match_explanation = justif
        candidate.match_confidence = "high"
        
        # Save to CandidateMany
        from app.models.candidate_many import CandidateMany
        application = CandidateMany.query.filter_by(
            candidate_id=candidate.id_candidate,
            requisition_id=opportunity_id
        ).first()
        if not application:
            application = CandidateMany(
                candidate_id=candidate.id_candidate,
                requisition_id=opportunity_id
            )
            db.session.add(application)
            
        application.match_score = score
        application.match_justification = justif
        application.match_explanation = justif
        application.match_confidence = "high"
        application.status = 'accepted' if score >= 70 else ('rejected' if score < 40 else 'pending')
        
    except Exception as e:
        print(f"[link] hybrid_score error: {e}")

    db.session.commit()
    return jsonify({"success": True, "message": "Candidat associé à l'offre"})


# ── PATCH /candidates/<id>/link-decision ──────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/link-decision", methods=["PATCH", "OPTIONS"])
def link_decision(candidate_id):
    """
    Accepte ou rejette une liaison suggérée candidat ↔ AO.
    Body: { "action": "accept" | "reject" }
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    data = request.json
    action = data.get("action") if data else None
    if action not in ("accept", "reject"):
        return jsonify({"error": "action doit être 'accept' ou 'reject'"}), 400

    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    if not candidate.suggested_job_requisition_id:
        return jsonify({"error": "Aucune liaison suggérée pour ce candidat"}), 400

    if action == "accept":
        candidate.job_requisition_id = candidate.suggested_job_requisition_id
        candidate.link_status = "confirmed"
        candidate.suggested_job_requisition_id = None
        print(f"[LinkDecision] Candidat {candidate_id} → liaison acceptée")
    else:
        candidate.suggested_job_requisition_id = None
        candidate.link_status = "rejected"
        print(f"[LinkDecision] Candidat {candidate_id} → liaison rejetée")

    db.session.commit()
    return jsonify({"success": True, "status": candidate.link_status})


# ── DELETE /candidates/<id> ────────────────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>", methods=["DELETE"])
def delete_candidate(candidate_id):
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouv\u00e9"}), 404
    try:
        # Supprimer d'abord les entretiens li\u00e9s (NOT NULL constraint sur candidate_id)
        from app.models.interview import Interview
        Interview.query.filter_by(candidate_id=candidate_id).delete()

        if candidate.cv_path and os.path.exists(candidate.cv_path):
            try:
                os.remove(candidate.cv_path)
            except Exception:
                pass
        db.session.delete(candidate)
        db.session.commit()
        return jsonify({"success": True, "message": "Candidat supprim\u00e9"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



# ── POST /candidates/<id>/reanalyze ───────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/reanalyze", methods=["POST"])
def reanalyze_candidate(candidate_id):
    """
    Re-analyse le profil CV d'un candidat existant avec le parser amélioré.
    """
    candidate = Candidate.query.filter_by(id_candidate=candidate_id).first()
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    cv_text = candidate.cv_parsed
    if not cv_text:
        return jsonify({"error": "Pas de texte CV stocké pour ce candidat"}), 400

    try:
        from app.services.cv_parser import extract_cv_profile

        print(f"[Reanalyze] Candidat {candidate_id} ({candidate.first_name} {candidate.last_name})")
        profile = extract_cv_profile(cv_text)
        candidate.cv_profile = json.dumps(profile, ensure_ascii=False)

        all_skills = list(profile.get("skills_raw", []))
        for sk in profile.get("skills_confirmed", {}).keys():
            if sk not in all_skills:
                all_skills.append(sk)
        candidate.skills = json.dumps(all_skills)

        job_id = candidate.job_requisition_id or candidate.suggested_job_requisition_id
        if job_id:
            job = JobRequisition.query.get(job_id)
            if job:
                print(f"[Reanalyze] Recalcul score AO: {job.titre}")
                score, justif, explanation, confidence = smart_match(
                    profile,
                    job.titre or "",
                    job.description or "",
                    job.criteres or ""
                )
                candidate.match_score = score
                candidate.match_justification = justif
                candidate.match_explanation = explanation
                candidate.match_confidence = confidence
                print(f"[Reanalyze] Nouveau score: {score}% | confiance={confidence}")

        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Profil de {candidate.first_name} {candidate.last_name} re-analysé",
            "profile": {
                "level": profile.get("level"),
                "skills_confirmed": list(profile.get("skills_confirmed", {}).keys()),
                "skills_raw_count": len(profile.get("skills_raw", [])),
                "domain": profile.get("domain", []),
            },
            "new_score": candidate.match_score
        })

    except Exception as e:
        db.session.rollback()
        print(f"[Reanalyze] Erreur: {e}")
        return jsonify({"error": str(e)}), 500


# ── POST /scan-emails ─────────────────────────────────────────────────────────
@candidates_bp.route("/scan-emails", methods=["POST"])
def scan_emails_manual():
    """Déclenche un scan manuel (Gmail OAuth) en arrière-plan."""
    app = current_app._get_current_object()

    def _run():
        with app.app_context():
            try:
                from app.services.multi_email_scanner import scan_all_contacts
                scan_all_contacts()
                print("[scan-emails] Scan manuel terminé")
            except Exception as e:
                print(f"[scan-emails] Erreur: {e}")

    t = threading.Thread(target=_run, daemon=True, name="manual-email-scan")
    t.start()
    return jsonify({"success": True, "message": "Scan POP3 lancé en arrière-plan"})


# ── POST /extract-ao-from-image ───────────────────────────────────────────────
@candidates_bp.route("/extract-ao-from-image", methods=["POST"])
def extract_ao_from_image():
    print("Réception d'une image pour extraction...")
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Fichier vide"}), 400

    import tempfile
    temp_path = None
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            temp_path = tmp.name
        from app.services.ocr_service import extract_ao_data_from_image
        extracted_data = extract_ao_data_from_image(temp_path)
        if extracted_data and extracted_data.get('titre'):
            return jsonify({"success": True, "data": extracted_data})
        else:
            return jsonify({"success": False, "error": "Impossible d'extraire les données"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


# ── POST /boond/create-opportunity ────────────────────────────────────────────
@candidates_bp.route("/boond/create-opportunity", methods=["POST"])
def create_opportunity_in_boond():
    data = request.json
    if not data or not data.get('titre') or not data.get('client_nom'):
        return jsonify({"error": "Titre et client obligatoires"}), 400
    try:
        from app.services.boond_service import BoondService
        service = BoondService()
        boond_id = service.create_opportunity(data)
        if boond_id:
            return jsonify({"success": True, "boond_id": boond_id, "message": "Opportunité créée dans BoondManager"})
        else:
            return jsonify({"success": False, "error": "Erreur lors de la création"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── POST /candidates/auto-link-unlinked ────────────────────────────────────────
@candidates_bp.route("/candidates/auto-link-unlinked", methods=["POST"])
def auto_link_unlinked_candidates():
    """
    Trouve tous les candidats non liés à un AO (job_requisition_id IS NULL,
    link_status != 'rejected') et les associe automatiquement à l'offre
    ayant le meilleur score de matching.
    Exécution en arrière-plan pour ne pas bloquer la requête.
    """
    app = current_app._get_current_object()

    def _run():
        with app.app_context():
            from app.models.candidate import Candidate as _Cand
            from app.models.job_requisition import JobRequisition as _Job
            from app.models.candidate_many import CandidateMany
            from app.services.auto_matcher import AutoMatcher
            from app.extensions import db as _db

            # 1. Candidats non liés et non rejetés
            unlinked = _Cand.query.filter(
                _Cand.job_requisition_id.is_(None)
            ).filter(
                or_(_Cand.link_status != 'rejected', _Cand.link_status.is_(None))
            ).all()

            if not unlinked:
                print("[AutoLink] Aucun candidat non lié trouvé.")
                return

            # 2. Offres actives "En cours"
            cutoff = datetime.now() - timedelta(days=7)
            besoins = _Job.query.filter(
                _Job.etat_complet == "En cours 0/25%"
            ).all()

            active_opps = [
                b for b in besoins
                if _convert_date(b.date) and _convert_date(b.date) >= cutoff
            ]

            if not active_opps:
                print("[AutoLink] Aucune offre active trouvée.")
                return

            print(f"[AutoLink] {len(unlinked)} candidat(s) non lié(s) → {len(active_opps)} offre(s) active(s)")

            linked_count = 0
            for cand in unlinked:
                cv_profile_text = cand.cv_profile if cand.cv_profile else cand.cv_parsed
                if not cv_profile_text:
                    # Allow linking candidates without a CV profile (e.g., LinkedIn only)
                    cv_profile_text = ""
                    print(f"[AutoLink] Candidat {cand.id_candidate} sans profil/CV, utilisation du texte vide.")

                best_score = -1
                best_opp = None
                best_justif = ""

                for opp in active_opps:
                    try:
                        score, justif = AutoMatcher._calculate_hybrid_score(cv_profile_text, opp)
                        if score > best_score:
                            best_score = score
                            best_opp = opp
                            best_justif = justif
                    except Exception as e:
                        print(f"[AutoLink] Erreur score candidat {cand.id_candidate} / offre {opp.requisition_id}: {e}")

                if best_opp and best_score >= 0:
                    cand.job_requisition_id = best_opp.requisition_id
                    cand.match_score = best_score
                    cand.match_justification = best_justif
                    cand.match_explanation = best_justif
                    cand.match_confidence = "high"
                    cand.link_status = "confirmed"

                    # Créer CandidateMany
                    app_link = CandidateMany.query.filter_by(
                        candidate_id=cand.id_candidate,
                        requisition_id=best_opp.requisition_id
                    ).first()
                    if not app_link:
                        app_link = CandidateMany(
                            candidate_id=cand.id_candidate,
                            requisition_id=best_opp.requisition_id
                        )
                        _db.session.add(app_link)

                    app_link.match_score = best_score
                    app_link.match_justification = best_justif
                    app_link.match_explanation = best_justif
                    app_link.match_confidence = "high"
                    app_link.status = 'accepted' if best_score >= 70 else ('rejected' if best_score < 40 else 'pending')

                    linked_count += 1
                    print(f"[AutoLink] Candidat {cand.id_candidate} → Offre {best_opp.requisition_id} ({best_opp.titre}) score={best_score}%")

            _db.session.commit()
            print(f"[AutoLink] Terminé — {linked_count}/{len(unlinked)} candidat(s) lié(s) automatiquement.")

    t = threading.Thread(target=_run, daemon=True, name="auto-link-unlinked")
    t.start()
    return jsonify({"success": True, "message": "Auto-liaison des candidats lancée en arrière-plan"})


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE ENTRETIENS — Quiz IA + Planification Google Meet
# ═══════════════════════════════════════════════════════════════════════════════

# ── POST /candidates/<id>/send-quiz ───────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/send-quiz", methods=["POST"])
def send_quiz_to_candidate(candidate_id):
    """
    Génère un quiz par Qwen basé sur l'AO du candidat, l'enregistre et
    envoie un email au candidat avec un lien unique (public, sans login).
    """
    from app.models.interview import Interview
    from app.services.quiz_generator import generate_quiz
    from app.services.interview_email_service import send_quiz_invitation

    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    job_id = candidate.job_requisition_id
    if not job_id:
        return jsonify({"error": "Ce candidat n'est pas encore lié à un AO"}), 400

    job = JobRequisition.query.get(job_id)
    if not job:
        return jsonify({"error": "AO non trouvé"}), 404

    # Éviter les doublons : vérifier si un quiz actif existe déjà
    existing = Interview.query.filter_by(
        candidate_id=candidate_id,
        job_requisition_id=job_id
    ).filter(Interview.status.in_(["quiz_sent", "quiz_completed"])).first()

    if existing:
        return jsonify({
            "error": "Un quiz a déjà été envoyé à ce candidat",
            "interview_id": existing.id,
            "status": existing.status
        }), 409

    # Email du commercial depuis le body ou session
    data = request.json or {}
    created_by = data.get("created_by_email", "")

    try:
        # 1. Générer les questions via Qwen
        print(f"[Interview] Génération quiz pour AO: {job.titre}")
        questions = generate_quiz(job)

        # 2. Créer l'entrée Interview en DB
        interview = Interview(
            candidate_id=candidate_id,
            job_requisition_id=job_id,
            created_by_email=created_by,
            quiz_questions=json.dumps(questions, ensure_ascii=False),
            quiz_sent_at=datetime.utcnow(),
            status="quiz_sent"
        )
        db.session.add(interview)
        db.session.commit()

        # 3. Envoyer l'email au candidat (en background)
        # ⚠️ On passe uniquement les IDs — les objets SQLAlchemy ne sont pas
        # thread-safe car la session se ferme à la fin de la requête.
        app = current_app._get_current_object()
        _candidate_id = candidate_id
        _interview_id = interview.id

        def _send(flask_app, cand_id, iview_id):
            with flask_app.app_context():
                from app.models.interview import Interview as _Interview
                _cand = Candidate.query.get(cand_id)
                _iview = _Interview.query.get(iview_id)
                if not _cand or not _iview:
                    return
                _job = JobRequisition.query.get(_iview.job_requisition_id)
                if not _job:
                    return
                send_quiz_invitation(_cand, _job, _iview)

        threading.Thread(target=_send, args=(app, _candidate_id, _interview_id), daemon=True).start()

        print(f"[Interview] Quiz envoyé au candidat {candidate_id} — token: {interview.quiz_token}")
        return jsonify({
            "success": True,
            "message": f"Quiz envoyé à {candidate.email}",
            "interview_id": interview.id,
            "quiz_token": interview.quiz_token,
            "questions_count": len(questions)
        })

    except Exception as e:
        db.session.rollback()
        print(f"[Interview] Erreur send-quiz: {e}")
        return jsonify({"error": str(e)}), 500


# ── POST /interviews/<id>/resend-quiz ─────────────────────────────────────────
@candidates_bp.route("/interviews/<int:interview_id>/resend-quiz", methods=["POST", "OPTIONS"])
def resend_quiz_email(interview_id):
    """
    Renvoie l'email du quiz à un candidat dont l'envoi précédent a échoué.
    Ne régénère PAS les questions — réutilise l'interview existants.
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    from app.models.interview import Interview
    from app.services.interview_email_service import send_quiz_invitation

    interview = Interview.query.get(interview_id)
    if not interview:
        return jsonify({"error": "Entretien non trouvé"}), 404

    if interview.status not in ("quiz_sent", "quiz_completed"):
        return jsonify({"error": f"Impossible de renvoyer un quiz au statut '{interview.status}'"}), 400

    app = current_app._get_current_object()
    _interview_id = interview_id

    def _send(flask_app, iview_id):
        with flask_app.app_context():
            from app.models.interview import Interview as _Interview
            _iview = _Interview.query.get(iview_id)
            if not _iview:
                return
            _cand = Candidate.query.get(_iview.candidate_id)
            _job  = JobRequisition.query.get(_iview.job_requisition_id)
            if _cand and _job:
                send_quiz_invitation(_cand, _job, _iview)
                print(f"[Interview] Quiz RE-envoyé au candidat {_cand.email} (interview {iview_id})")

    threading.Thread(target=_send, args=(app, _interview_id), daemon=True).start()

    return jsonify({
        "success": True,
        "message": f"Email du quiz renvoyé (interview #{interview_id})"
    })


# ── GET /interviews ────────────────────────────────────────────────────────────
@candidates_bp.route("/interviews", methods=["GET"])
def list_interviews():
    """
    Retourne tous les entretiens pour la page Entretiens.
    Filtres optionnels: ?status=quiz_completed&email=xxx
    """
    from app.models.interview import Interview
    from app.models.job_requisition import JobRequisition
    from flask import session
    from app.models.organization import Organization

    status_filter = request.args.get("status")
    email_filter = request.args.get("email")

    query = Interview.query

    user_role = session.get("user_role")
    org_id = session.get("organization_id")
    if user_role in ["manager", "commercial"] and org_id:
        org = Organization.query.get(org_id)
        if org:
            query = query.join(JobRequisition, Interview.job_requisition_id == JobRequisition.requisition_id)
            query = query.filter(JobRequisition.client_nom == org.name)

    if status_filter:
        statuses = status_filter.split(",")
        query = query.filter(Interview.status.in_(statuses))

    if email_filter:
        query = query.filter(Interview.created_by_email == email_filter)

    interviews = query.order_by(Interview.created_at.desc()).all()
    return jsonify([i.to_dict() for i in interviews])


# ── GET /interviews/completed ──────────────────────────────────────────────────
@candidates_bp.route("/interviews/completed", methods=["GET"])
def list_completed_interviews():
    """
    Retourne les entretiens dont le candidat a soumis le quiz (quiz_completed).
    Utilisé par NotificationBell pour notifier le commercial.
    Filtre par email du commercial : ?email=xxx
    """
    from app.models.interview import Interview
    from app.models.job_requisition import JobRequisition
    from flask import session
    from app.models.organization import Organization

    email = request.args.get("email")
    query = Interview.query.filter_by(status="quiz_completed")

    user_role = session.get("user_role")
    org_id = session.get("organization_id")
    if user_role in ["manager", "commercial"] and org_id:
        org = Organization.query.get(org_id)
        if org:
            query = query.join(JobRequisition, Interview.job_requisition_id == JobRequisition.requisition_id)
            query = query.filter(JobRequisition.client_nom == org.name)

    if email:
        query = query.filter(Interview.created_by_email == email)

    interviews = query.order_by(Interview.quiz_completed_at.desc()).all()
    return jsonify([i.to_dict() for i in interviews])


# ── PATCH /interviews/<id>/confirm ────────────────────────────────────────────
@candidates_bp.route("/interviews/<int:interview_id>/confirm", methods=["PATCH"])
def confirm_interview(interview_id):
    """
    Marque l'entretien comme confirmé.
    Si calendly_managed=true (Calendly gère les emails), pas d'envoi d'email Pilotis.
    Body JSON (tout optionnel) : { "notes": "...", "calendly_managed": true }
    """
    from app.models.interview import Interview
    from app.services.interview_email_service import send_interview_confirmation

    interview = Interview.query.get(interview_id)
    if not interview:
        return jsonify({"error": "Entretien non trouv\u00e9"}), 404

    if interview.status not in ("quiz_completed", "quiz_sent"):
        return jsonify({"error": f"Impossible de confirmer un entretien au statut '{interview.status}'"}), 400

    data = request.json or {}
    calendly_managed = data.get("calendly_managed", False)
    notes = data.get("notes", "")

    interview.notes = notes
    interview.status = "confirmed"
    interview.confirmation_sent_at = datetime.utcnow()

    db.session.commit()

    # N'envoie pas d'email Pilotis si Calendly g\u00e8re d\u00e9j\u00e0 les notifications
    if not calendly_managed:
        candidate = Candidate.query.get(interview.candidate_id)
        job = JobRequisition.query.get(interview.job_requisition_id)
        if candidate and job:
            app = current_app._get_current_object()
            _interview_id = interview_id

            def _send(flask_app, iview_id):
                with flask_app.app_context():
                    from app.models.interview import Interview as _Interview
                    _iview = _Interview.query.get(iview_id)
                    if not _iview:
                        return
                    _cand = Candidate.query.get(_iview.candidate_id)
                    _job = JobRequisition.query.get(_iview.job_requisition_id)
                    if _cand and _job:
                        send_interview_confirmation(_cand, _job, _iview)

            threading.Thread(target=_send, args=(app, _interview_id), daemon=True).start()

    return jsonify({
        "success": True,
        "message": "Entretien confirm\u00e9" + ("" if calendly_managed else " et email envoy\u00e9 au candidat"),
        "interview": interview.to_dict()
    })



# ── PATCH /interviews/<id>/reject ─────────────────────────────────────────────
@candidates_bp.route("/interviews/<int:interview_id>/reject", methods=["PATCH"])
def reject_interview(interview_id):
    """Le commercial rejette le candidat après le quiz."""
    from app.models.interview import Interview

    interview = Interview.query.get(interview_id)
    if not interview:
        return jsonify({"error": "Entretien non trouvé"}), 404

    data = request.json or {}
    interview.status = "rejected"
    interview.notes = data.get("notes", interview.notes)
    db.session.commit()

    return jsonify({"success": True, "message": "Candidat rejeté"})


# ── DELETE /interviews/<id> ────────────────────────────────────────────────────
@candidates_bp.route("/interviews/<int:interview_id>", methods=["DELETE"])
def delete_interview(interview_id):
    """Annule et supprime un entretien."""
    from app.models.interview import Interview

    interview = Interview.query.get(interview_id)
    if not interview:
        return jsonify({"error": "Entretien non trouv\u00e9"}), 404

    db.session.delete(interview)
    db.session.commit()
    return jsonify({"success": True})


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE CALENDLY — Synchronisation des événements planifiés
# ═══════════════════════════════════════════════════════════════════════════════

# ── POST /calendly/sync ────────────────────────────────────────────────────────
@candidates_bp.route("/calendly/sync", methods=["POST"])
def sync_calendly_events():
    """
    Synchronise les événements Calendly planifiés avec les entretiens Pilotis.
    Matching : invitee_email (Calendly) ↔ candidate.email (Pilotis)
    Met à jour interview_date et meet_link pour les entretiens confirmés.
    Nécessite : AppSetting['calendly_token'] (Personal Access Token Calendly)
    """
    import requests as _req
    from app.models.interview import Interview
    from app.models.settings import AppSetting

    # 1. Récupérer le token Calendly
    token_setting = AppSetting.query.filter_by(key='calendly_token').first()
    if not token_setting or not token_setting.value:
        return jsonify({"error": "Token Calendly non configuré. Ajoutez-le dans Configuration."}), 400

    token = token_setting.value.strip()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    try:
        # 2. Récupérer l'URI de l'utilisateur Calendly
        me_resp = _req.get("https://api.calendly.com/users/me", headers=headers, timeout=10)
        if me_resp.status_code != 200:
            return jsonify({"error": f"Token Calendly invalide ({me_resp.status_code})"}), 400
        user_uri = me_resp.json()["resource"]["uri"]
        print(f"[Calendly Sync] User URI: {user_uri}")

        # 3. Récupérer les événements planifiés (actifs, 60 derniers et 90 prochains jours)
        from datetime import timezone, timedelta
        now = datetime.utcnow().replace(tzinfo=timezone.utc)
        min_start = (now - timedelta(days=60)).isoformat()
        max_start = (now + timedelta(days=90)).isoformat()

        events_resp = _req.get(
            "https://api.calendly.com/scheduled_events",
            headers=headers,
            params={
                "user": user_uri,
                "status": "active",
                "min_start_time": min_start,
                "max_start_time": max_start,
                "count": 100,
            },
            timeout=15
        )
        if events_resp.status_code != 200:
            return jsonify({"error": f"Erreur récupération événements Calendly ({events_resp.status_code})"}), 500

        events = events_resp.json().get("collection", [])
        print(f"[Calendly Sync] {len(events)} événement(s) trouvé(s)")

        updated = []
        skipped = []

        for event in events:
            event_uri  = event["uri"]
            start_time = event.get("start_time")  # ISO 8601
            location   = event.get("location", {})

            # Extraire le lien Google Meet depuis la location
            meet_link = None
            if location.get("type") == "google_meet":
                meet_link = location.get("join_url")
            elif location.get("type") == "zoom":
                meet_link = location.get("join_url")
            elif location.get("join_url"):
                meet_link = location.get("join_url")

            # 4. Récupérer les invités de cet événement
            event_uuid = event_uri.split("/")[-1]
            invitees_resp = _req.get(
                f"https://api.calendly.com/scheduled_events/{event_uuid}/invitees",
                headers=headers,
                timeout=10
            )
            if invitees_resp.status_code != 200:
                continue

            invitees = invitees_resp.json().get("collection", [])

            for invitee in invitees:
                invitee_email = invitee.get("email", "").lower().strip()
                if not invitee_email:
                    continue

                # 5. Trouver le candidat correspondant dans Pilotis
                candidate = Candidate.query.filter(
                    db.func.lower(Candidate.email) == invitee_email
                ).first()

                if not candidate:
                    skipped.append(invitee_email)
                    continue

                # 6. Trouver l'entretien confirmé le plus récent pour ce candidat
                interview = Interview.query.filter_by(
                    candidate_id=candidate.id_candidate,
                    status="confirmed"
                ).order_by(Interview.confirmation_sent_at.desc()).first()

                if not interview:
                    skipped.append(f"{invitee_email} (pas d'entretien confirmé)")
                    continue

                # 7. Mettre à jour la date et le lien Meet
                try:
                    from datetime import timezone
                    dt_aware = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    interview.interview_date = dt_aware.astimezone(timezone.utc).replace(tzinfo=None)
                except Exception:
                    pass

                if meet_link:
                    interview.meet_link = meet_link

                db.session.commit()
                candidate_name = f"{candidate.first_name or ''} {candidate.last_name or ''}".strip() or candidate.email
                updated.append({
                    "candidate": candidate_name,
                    "email": invitee_email,
                    "date": start_time,
                    "meet_link": meet_link
                })
                print(f"[Calendly Sync] ✅ {candidate_name} → {start_time} | Meet: {meet_link}")

        return jsonify({
            "success": True,
            "updated": len(updated),
            "skipped": len(skipped),
            "details": updated,
            "message": f"{len(updated)} entretien(s) synchronisé(s) depuis Calendly"
        })

    except Exception as e:
        print(f"[Calendly Sync] ❌ Erreur: {e}")
        return jsonify({"error": str(e)}), 500


# ── GET /calendly/token ────────────────────────────────────────────────────────
@candidates_bp.route("/calendly/token", methods=["GET"])
def get_calendly_token():
    """Retourne si un token Calendly est configuré (masqué)."""
    from app.models.settings import AppSetting
    s = AppSetting.query.filter_by(key='calendly_token').first()
    has_token = bool(s and s.value and s.value.strip())
    return jsonify({"configured": has_token})


# ── POST /calendly/token ───────────────────────────────────────────────────────
@candidates_bp.route("/calendly/token", methods=["POST"])
def save_calendly_token():
    """Sauvegarde le Personal Access Token Calendly."""
    from app.models.settings import AppSetting
    data = request.json or {}
    token = data.get("token", "").strip()
    if not token:
        return jsonify({"error": "Token manquant"}), 400
    s = AppSetting.query.filter_by(key='calendly_token').first()
    if s:
        s.value = token
    else:
        s = AppSetting(key='calendly_token', value=token)
        db.session.add(s)
    db.session.commit()
    return jsonify({"success": True, "message": "Token Calendly sauvegardé"})


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE WIEM — Candidatures N:N (CandidateMany) + Auto-Decision + Localisation
# ═══════════════════════════════════════════════════════════════════════════════

# ── GET /candidates/<id>/applications ─────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/applications", methods=["GET"])
def get_candidate_applications(candidate_id):
    """Retourne toutes les candidatures N:N d'un candidat."""
    from app.models.candidate_many import CandidateMany
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    applications = CandidateMany.query.filter_by(candidate_id=candidate_id).all()
    result = []
    for app in applications:
        result.append({
            "id_many": app.id_many,
            "candidate_id": app.candidate_id,
            "requisition_id": app.requisition_id,
            "titre": app.opportunity.titre if app.opportunity else None,
            "reference": app.opportunity.reference if app.opportunity else None,
            "client": app.opportunity.client_nom if app.opportunity else None,
            "match_score": app.match_score,
            "match_justification": app.match_justification,
            "status": app.status,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None
        })
    return jsonify({"applications": result})


# ── POST /candidates/<id>/applications/batch ───────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/applications/batch", methods=["POST"])
def add_candidate_applications_batch(candidate_id):
    """Ajoute plusieurs candidatures N:N en batch."""
    from app.models.candidate_many import CandidateMany
    data = request.json
    opportunities = data.get("opportunities", [])

    if not opportunities:
        return jsonify({"error": "Aucune offre sélectionnée"}), 400

    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404

    success_count = 0
    failed_count = 0
    results = []

    for opp_data in opportunities:
        opportunity_id = opp_data.get("id")
        score = opp_data.get("score", 0)
        justification = opp_data.get("justification", "")

        if not opportunity_id:
            failed_count += 1
            continue

        job = JobRequisition.query.get(opportunity_id)
        if not job:
            results.append({"opportunity_id": opportunity_id, "success": False, "message": "Offre non trouvée"})
            failed_count += 1
            continue

        existing = CandidateMany.query.filter_by(
            candidate_id=candidate_id, requisition_id=opportunity_id
        ).first()
        if existing:
            results.append({"opportunity_id": opportunity_id, "success": False, "message": "Déjà postulé"})
            failed_count += 1
            continue

        auto_status = 'accepted' if score >= 70 else ('rejected' if score < 40 else 'pending')
        application = CandidateMany(
            candidate_id=candidate_id,
            requisition_id=opportunity_id,
            match_score=score,
            match_justification=justification,
            status=auto_status
        )
        db.session.add(application)
        results.append({"opportunity_id": opportunity_id, "success": True, "message": "Ajouté"})
        success_count += 1

    db.session.commit()
    return jsonify({
        "success": success_count > 0,
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results
    }), 201


# ── DELETE /candidates/<id>/applications/<requisition_id> ─────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/applications/<int:requisition_id>", methods=["DELETE"])
def remove_candidate_application(candidate_id, requisition_id):
    """Supprime une candidature N:N spécifique."""
    from app.models.candidate_many import CandidateMany
    application = CandidateMany.query.filter_by(
        candidate_id=candidate_id, requisition_id=requisition_id
    ).first()
    if not application:
        return jsonify({"error": "Candidature non trouvée"}), 404
    db.session.delete(application)
    db.session.commit()
    return jsonify({"success": True, "message": "Candidature supprimée"})


# ── POST /candidates/<id>/applications/<app_id>/decision ──────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/applications/<int:application_id>/decision", methods=["POST"])
def update_application_decision(candidate_id, application_id):
    """Met à jour le statut d'une candidature N:N spécifique."""
    from app.models.candidate_many import CandidateMany
    data = request.json
    new_decision = data.get("decision")

    application = CandidateMany.query.filter_by(
        id_many=application_id, candidate_id=candidate_id
    ).first()
    if not application:
        return jsonify({"error": "Candidature non trouvée"}), 404

    if new_decision == "accepted":
        application.status = 'accepted'
    elif new_decision == "rejected":
        application.status = 'rejected'
    else:
        application.status = 'pending'

    db.session.commit()
    return jsonify({"success": True, "new_status": application.status})


# ── GET /candidates/all-with-decisions ────────────────────────────────────────
@candidates_bp.route("/candidates/all-with-decisions", methods=["GET"])
def get_all_candidates_with_decisions():
    """Retourne tous les candidats avec leurs décisions IA multi-offres (système Wiem)."""
    from app.models.candidate_many import CandidateMany
    from app.services.auto_decision import AutoDecision

    candidates = Candidate.query.order_by(Candidate.created_at.desc()).all()
    result = []

    for candidate in candidates:
        applications = CandidateMany.query.filter_by(candidate_id=candidate.id_candidate).all()
        decisions = []
        for app in applications:
            offre = app.opportunity
            if offre:
                decision, score, justification, is_foreign = AutoDecision.classify_single_application(app)
                decisions.append({
                    "application_id": app.id_many,
                    "opportunity_id": offre.requisition_id,
                    "opportunity_title": offre.titre,
                    "opportunity_client": offre.client_nom,
                    "score": score,
                    "decision": decision,
                    "justification": justification,
                    "status": app.status,
                    "applied_at": app.applied_at.isoformat() if app.applied_at else None
                })

        decisions.sort(key=lambda x: x["score"], reverse=True)

        if decisions:
            best = decisions[0]
            result.append({
                "candidate_id": candidate.id_candidate,
                "first_name": candidate.first_name or "",
                "last_name": candidate.last_name or "",
                "email": candidate.email,
                "phone": candidate.phone or "",
                "source": candidate.source,
                "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                "global_decision": best["decision"],
                "global_score": best["score"],
                "global_justification": best["justification"],
                "best_opportunity": {
                    "id": best["opportunity_id"],
                    "title": best["opportunity_title"],
                    "client": best["opportunity_client"]
                },
                "decisions": decisions
            })
        else:
            result.append({
                "candidate_id": candidate.id_candidate,
                "first_name": candidate.first_name or "",
                "last_name": candidate.last_name or "",
                "email": candidate.email,
                "phone": candidate.phone or "",
                "source": candidate.source,
                "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
                "global_decision": "pending",
                "global_score": 0,
                "global_justification": "Aucune candidature trouvée",
                "best_opportunity": None,
                "decisions": []
            })

    return jsonify(result)


# ── GET /candidates/<id>/decision ─────────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/decision", methods=["GET"])
def get_candidate_decision(candidate_id):
    """Retourne la décision IA globale pour un candidat (meilleur score)."""
    from app.services.auto_decision import AutoDecision
    decision, score, justification, best_offer, all_decisions, is_foreign = AutoDecision.classify_candidate(candidate_id)
    return jsonify({
        "candidate_id": candidate_id,
        "decision": decision,
        "score": score,
        "justification": justification,
        "is_foreign": is_foreign,
        "best_offer": {
            "id": best_offer.requisition_id if best_offer else None,
            "titre": best_offer.titre if best_offer else None,
            "client": best_offer.client_nom if best_offer else None,
        } if best_offer else None,
        "all_decisions": all_decisions
    })


# ── POST /candidates/<id>/auto-decision ───────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/auto-decision", methods=["POST"])
def auto_decision(candidate_id):
    """Exécute la décision automatique (email accept/reject) pour un candidat."""
    from app.services.auto_decision import AutoDecision
    result = AutoDecision.execute_decision(candidate_id)
    return jsonify(result)


# ── POST /candidates/auto-decision/all ────────────────────────────────────────
@candidates_bp.route("/candidates/auto-decision/all", methods=["POST"])
def auto_decision_all():
    """Exécute la décision automatique pour toutes les candidatures 'pending'."""
    from app.models.candidate_many import CandidateMany
    from app.services.auto_decision import AutoDecision
    applications = CandidateMany.query.filter_by(status='pending').all()
    results = []
    for app in applications:
        result = AutoDecision.execute_decision_for_application(app.candidate_id, app.id_many)
        results.append(result)
    return jsonify({"success": True, "processed": len(results), "results": results})


# ── GET /candidates/match-for-opportunity/<id> ────────────────────────────────
@candidates_bp.route("/candidates/match-for-opportunity/<int:opportunity_id>", methods=["GET"])
def get_candidates_for_opportunity(opportunity_id):
    """Retourne les 3 meilleurs candidats pour une opportunité (auto-matching)."""
    from app.models.candidate_many import CandidateMany
    from app.services.auto_matcher import AutoMatcher
    from sqlalchemy import desc

    opportunity = JobRequisition.query.get(opportunity_id)
    if not opportunity:
        return jsonify({"error": "Opportunité non trouvée"}), 404

    # Candidatures existantes avec score → retourner directement
    applications = CandidateMany.query.filter_by(
        requisition_id=opportunity_id
    ).filter(CandidateMany.match_score.isnot(None)).order_by(
        desc(CandidateMany.match_score)
    ).limit(3).all()

    if applications:
        candidates = []
        for app in applications:
            candidate = Candidate.query.get(app.candidate_id)
            if candidate:
                candidates.append({
                    "id": candidate.id_candidate,
                    "first_name": candidate.first_name,
                    "last_name": candidate.last_name,
                    "email": candidate.email,
                    "cv_drive_link": getattr(candidate, 'cv_drive_link', None),
                    "match_score": app.match_score,
                    "justification": app.match_justification
                })
        return jsonify({"candidates": candidates, "newly_matched": False})

    # Pas de candidatures → lancer le matching en arrière-plan
    app_obj = current_app._get_current_object()

    def run_matching():
        with app_obj.app_context():
            try:
                AutoMatcher.match_single_opportunity(opportunity_id)
                print(f"✅ Matching terminé pour {opportunity.titre}")
            except Exception as e:
                print(f"❌ Erreur matching: {e}")

    threading.Thread(target=run_matching, daemon=True).start()
    return jsonify({
        "candidates": [],
        "newly_matched": True,
        "message": "Matching en cours, rafraîchissez dans quelques secondes"
    })


# ── POST /notify-top-candidates/<id> ──────────────────────────────────────────
@candidates_bp.route("/notify-top-candidates/<int:opportunity_id>", methods=["POST"])
def notify_top_candidates(opportunity_id):
    """Envoie un email aux 3 meilleurs candidats pour une opportunité."""
    from app.models.candidate_many import CandidateMany
    from app.utils.notifications import send_email

    opportunity = JobRequisition.query.get(opportunity_id)
    if not opportunity:
        return jsonify({'error': 'Opportunité non trouvée'}), 404

    top_applications = CandidateMany.query.filter_by(
        requisition_id=opportunity_id
    ).order_by(CandidateMany.match_score.desc()).limit(3).all()

    if not top_applications:
        return jsonify({'message': 'Aucun candidat trouvé pour cette opportunité'}), 200

    notifications_sent = []
    for app in top_applications:
        candidate = Candidate.query.get(app.candidate_id)
        if candidate and candidate.email:
            subject = f"📢 Nouvelle opportunité: {opportunity.titre}"
            body = f"""Bonjour {candidate.first_name or ''} {candidate.last_name or ''},

Une nouvelle opportunité correspond à votre profil chez {opportunity.client_nom} !
📌 Poste: {opportunity.titre}
🏢 Client: {opportunity.client_nom}

Contactez-nous pour plus d'informations.
Cordialement, L'équipe Pilotis"""
            success, _ = send_email(candidate.email, subject, body)
            notifications_sent.append({
                'candidate_id': candidate.id_candidate,
                'candidate_email': candidate.email,
                'candidate_name': f"{candidate.first_name or ''} {candidate.last_name or ''}".strip(),
                'match_score': app.match_score,
                'sent': success
            })

    return jsonify({
        'success': True,
        'opportunity_id': opportunity_id,
        'opportunity_title': opportunity.titre,
        'notifications_sent': notifications_sent
    })


# ── GET /candidates/<id>/location ─────────────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/location", methods=["GET"])
def get_candidate_location(candidate_id):
    """Détecte la localisation d'un candidat via regex/dictionnaire."""
    from app.services.location_service import detect_location
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404
    location = detect_location(candidate.phone, candidate.cv_parsed)
    return jsonify({
        "candidate_id": candidate_id,
        "candidate_name": f"{candidate.first_name} {candidate.last_name}",
        "country": location
    })


# ── POST /candidates/<id>/location/update ─────────────────────────────────────
@candidates_bp.route("/candidates/<int:candidate_id>/location/update", methods=["POST"])
def update_candidate_location(candidate_id):
    """Met à jour la localisation d'un candidat en base."""
    from app.services.location_service import detect_location, is_international
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404
    
    location = detect_location(candidate.phone, candidate.cv_parsed)
    if location:
        candidate.country = location
        candidate.is_foreign = is_international(location)
        db.session.commit()
        return jsonify({"success": True, "country": location, "is_foreign": candidate.is_foreign})
    
    return jsonify({"success": False, "message": "Localisation introuvable"})


# ── POST /candidates/locations/update-all ─────────────────────────────────────
@candidates_bp.route("/candidates/locations/update-all", methods=["POST"])
def update_all_candidates_locations():
    """Met à jour la localisation de tous les candidats."""
    from app.services.location_service import detect_location, is_international
    candidates = Candidate.query.all()
    updated = 0
    
    for candidate in candidates:
        location = detect_location(candidate.phone, candidate.cv_parsed)
        if location:
            candidate.country = location
            candidate.is_foreign = is_international(location)
            updated += 1
            print(f"📍 {candidate.first_name} {candidate.last_name}: {location}")
            
    db.session.commit()
    return jsonify({"success": True, "updated": updated, "message": f"{updated} candidats mis à jour"})


# ── GET /candidates/locations/stats ───────────────────────────────────────────
@candidates_bp.route("/candidates/locations/stats", methods=["GET"])
def get_locations_stats():
    """Statistiques de localisation des candidats."""
    from sqlalchemy import func
    total = Candidate.query.count()
    by_country = db.session.query(
        Candidate.country, func.count(Candidate.id_candidate)
    ).filter(Candidate.country.isnot(None)).group_by(Candidate.country).all()

    return jsonify({
        "total": total,
        "by_country": [{"country": c, "count": cnt} for c, cnt in by_country]
    })