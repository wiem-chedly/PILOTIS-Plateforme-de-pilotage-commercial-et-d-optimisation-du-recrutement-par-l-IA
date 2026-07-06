"""
interview_email_service.py — Service d'envoi d'emails pour le module Entretiens

Utilise send_email() existant depuis app.utils.notifications.
"""

import logging
import os

logger = logging.getLogger(__name__)

FRONTEND_BASE_URL = os.getenv("FRONTEND_URL", "http://localhost:8080")


def send_quiz_invitation(candidate, job, interview):
    """
    Email envoyé au CANDIDAT avec le lien unique vers son quiz.
    Le candidat n'a pas besoin de se connecter à Pilotis.
    """
    from app.utils.notifications import send_email

    quiz_url = f"{FRONTEND_BASE_URL}/quiz/{interview.quiz_token}"
    first_name = candidate.first_name or candidate.email.split("@")[0]

    subject = f"Test de présélection — {job.titre}"

    body = f"""Bonjour {first_name},

Suite à votre candidature pour le poste de {job.titre}{f' chez {job.client_nom}' if job.client_nom else ''}, nous vous invitons à compléter un test de présélection technique.

Ce test comporte 6 questions à choix multiples et prend environ 10 à 15 minutes.

🔗 Accédez à votre test ici :
{quiz_url}

⚠️  Ce lien vous est personnel. Ne le partagez pas.
⏳  Vous pouvez y répondre quand vous le souhaitez.

Si vous avez des questions, n'hésitez pas à contacter votre recruteur.

Bonne chance !

Cordialement,
L'équipe Pilotis Recrutement
"""
    try:
        send_email(candidate.email, subject, body)
        logger.info("[InterviewEmail] Invitation quiz envoyée à %s", candidate.email)
    except Exception as e:
        logger.error("[InterviewEmail] Erreur envoi invitation: %s", e)


def send_interview_confirmation(candidate, job, interview):
    """
    Email envoyé au CANDIDAT une fois le commercial a confirmé l'entretien.
    Contient le lien Google Meet (ou adresse) + date/heure.
    """
    from app.utils.notifications import send_email

    first_name = candidate.first_name or candidate.email.split("@")[0]

    # Formatage de la date en français
    date_str = _format_date_fr(interview.interview_date)

    subject = f"Entretien confirmé — {job.titre} — {date_str}"

    meet_section = ""
    if interview.meet_link:
        meet_section = f"🎥 Lien Google Meet : {interview.meet_link}\n"
    else:
        from app.models.pilotis_config import PilotisConfig
        address = PilotisConfig.get("office_address", "Adresse à confirmer")
        meet_section = f"📍 Lieu : {address}\n"

    body = f"""Bonjour {first_name},

Suite à votre test de présélection, nous avons le plaisir de vous confirmer un entretien pour le poste suivant.

━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Poste    : {job.titre}
{f'🏢 Client   : {job.client_nom}' if job.client_nom else ''}
📅 Date     : {date_str}
{meet_section}━━━━━━━━━━━━━━━━━━━━━━━━━

Merci d'être présent(e) quelques minutes avant l'heure prévue.
N'hésitez pas à tester votre connexion à l'avance si l'entretien a lieu en visioconférence.

Nous vous souhaitons un excellent entretien !

Cordialement,
L'équipe Pilotis Recrutement
"""
    try:
        send_email(candidate.email, subject, body)
        logger.info("[InterviewEmail] Confirmation envoyée à %s", candidate.email)
    except Exception as e:
        logger.error("[InterviewEmail] Erreur envoi confirmation: %s", e)


def send_quiz_completed_notification(commercial_email, candidate, job, interview):
    """
    Email de notification interne au commercial quand un candidat a soumis son quiz.
    Le commercial voit aussi la notification dans NotificationBell.
    """
    from app.utils.notifications import send_email

    score_pct = interview.quiz_score_pct()
    first_name = f"{candidate.first_name or ''} {candidate.last_name or ''}".strip()

    subject = f"[Pilotis] Test complété — {first_name} — {job.titre} ({score_pct}%)"

    body = f"""Bonjour,

Le candidat suivant vient de compléter son test de présélection.

Candidat  : {first_name} ({candidate.email})
Poste     : {job.titre}
Score     : {score_pct}% ({interview.quiz_score and round(interview.quiz_score * 6, 1):.1f}/6)

👉 Connectez-vous à Pilotis pour valider ou rejeter ce candidat :
{FRONTEND_BASE_URL}/entretiens

Cordialement,
Pilotis — Notifications automatiques
"""
    try:
        send_email(commercial_email, subject, body)
        logger.info("[InterviewEmail] Notif commercial envoyée à %s", commercial_email)
    except Exception as e:
        logger.error("[InterviewEmail] Erreur notif commercial: %s", e)


def _format_date_fr(dt) -> str:
    """Formate une datetime en français lisible."""
    if not dt:
        return "Date à confirmer"
    DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    MONTHS = ["", "janvier", "février", "mars", "avril", "mai", "juin",
              "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    try:
        day_name = DAYS[dt.weekday()]
        return f"{day_name} {dt.day} {MONTHS[dt.month]} {dt.year} à {dt.strftime('%H:%M')}"
    except Exception:
        return str(dt)
