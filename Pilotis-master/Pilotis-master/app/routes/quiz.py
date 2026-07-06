"""
quiz.py — Routes publiques pour le quiz de présélection candidat

Ces routes sont accessibles SANS authentification.
Le candidat reçoit un lien unique par email et répond au quiz.

URL prefix : /api
Routes:
    GET  /quiz/<token>         → retourne les questions (sans bonnes réponses)
    POST /quiz/<token>/submit  → reçoit les réponses, évalue, notifie le commercial
"""

import json
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from app.extensions import db
from app.models.interview import Interview
from app.models.candidate import Candidate
from app.models.job_requisition import JobRequisition

logger = logging.getLogger(__name__)

quiz_bp = Blueprint("quiz", __name__)


@quiz_bp.route("/quiz/<token>", methods=["GET", "OPTIONS"])
def get_quiz(token):
    """
    Retourne les questions du quiz pour ce token.
    Les bonnes réponses (champ 'correct') sont SUPPRIMÉES de la réponse.
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    interview = Interview.query.filter_by(quiz_token=token).first()
    if not interview:
        return jsonify({"error": "Lien invalide ou expiré"}), 404

    if interview.status == "quiz_completed":
        return jsonify({"error": "Ce quiz a déjà été soumis", "already_done": True}), 400

    if interview.status not in ("quiz_sent",):
        return jsonify({"error": "Ce lien n'est plus valide"}), 400

    if not interview.quiz_questions:
        return jsonify({"error": "Quiz non disponible"}), 404

    try:
        questions_full = json.loads(interview.quiz_questions)
    except Exception:
        return jsonify({"error": "Erreur de lecture du quiz"}), 500

    # Supprimer les bonnes réponses et explications avant d'envoyer au frontend
    questions_safe = []
    for q in questions_full:
        questions_safe.append({
            "num": q["num"],
            "text": q["text"],
            "choices": q["choices"]
            # 'correct' et 'explanation' ne sont PAS inclus
        })

    # Récupérer les infos publiques pour afficher dans la page
    candidate = Candidate.query.get(interview.candidate_id)
    job = JobRequisition.query.get(interview.job_requisition_id)

    return jsonify({
        "questions": questions_safe,
        "total": len(questions_safe),
        "job_title": job.titre if job else "Poste technique",
        "candidate_name": f"{candidate.first_name or ''} {candidate.last_name or ''}".strip()
                          if candidate else "",
    })


@quiz_bp.route("/quiz/<token>/submit", methods=["POST", "OPTIONS"])
def submit_quiz(token):
    """
    Reçoit les réponses du candidat, calcule le score, notifie le commercial.

    Body JSON attendu :
    {
        "answers": {
            "1": "B",
            "2": "A",
            "3": "D",
            ...
        }
    }
    """
    if request.method == "OPTIONS":
        return jsonify({}), 200

    interview = Interview.query.filter_by(quiz_token=token).first()
    if not interview:
        return jsonify({"error": "Lien invalide ou expiré"}), 404

    if interview.status == "quiz_completed":
        return jsonify({"error": "Ce quiz a déjà été soumis", "already_done": True}), 400

    data = request.json or {}
    candidate_answers = data.get("answers", {})

    if not candidate_answers:
        return jsonify({"error": "Aucune réponse fournie"}), 400

    # Charger les questions avec les bonnes réponses
    try:
        questions = json.loads(interview.quiz_questions)
    except Exception:
        return jsonify({"error": "Erreur interne"}), 500

    # Évaluation déterministe (pas besoin de Qwen)
    from app.services.quiz_generator import evaluate_answers
    result = evaluate_answers(questions, candidate_answers)

    # Mise à jour de l'interview
    interview.quiz_answers = json.dumps(candidate_answers)
    interview.quiz_score = result["score"]
    interview.quiz_detail = json.dumps(result["detail"], ensure_ascii=False)
    interview.quiz_completed_at = datetime.utcnow()
    interview.status = "quiz_completed"

    db.session.commit()

    logger.info(
        "[Quiz] Token %s — candidat %s — score %.0f%%",
        token, interview.candidate_id, result["score"] * 100
    )

    # Notification email au commercial (en background pour ne pas bloquer)
    try:
        candidate = Candidate.query.get(interview.candidate_id)
        job = JobRequisition.query.get(interview.job_requisition_id)
        if interview.created_by_email and candidate and job:
            from app.services.interview_email_service import send_quiz_completed_notification
            import threading
            threading.Thread(
                target=send_quiz_completed_notification,
                args=(interview.created_by_email, candidate, job, interview),
                daemon=True
            ).start()
    except Exception as e:
        logger.error("[Quiz] Erreur notification commercial: %s", e)

    return jsonify({
        "success": True,
        "message": "Vos réponses ont bien été enregistrées. Vous recevrez un email si votre candidature est retenue.",
        "score_pct": round(result["score"] * 100),
        "correct_count": result["correct_count"],
        "total": result["total"]
    })