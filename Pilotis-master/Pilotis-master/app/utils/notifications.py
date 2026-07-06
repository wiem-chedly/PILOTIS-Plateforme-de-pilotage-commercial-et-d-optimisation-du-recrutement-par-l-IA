import logging
import re
from flask import current_app
from flask_mail import Message

logger = logging.getLogger(__name__)

def get_email_config():
    """Récupère la configuration email depuis la base de données."""
    from app.models.settings import EmailSettings
    return EmailSettings.query.first()


def _build_html_email(body: str, subject: str = "") -> str:
    """
    Enveloppe le corps texte brut dans un beau template HTML email responsive.
    Convertit les sauts de ligne en <br> et les URLs en liens cliquables.
    """
    # Convertir les URLs en liens cliquables
    url_pattern = r'(https?://[^\s]+)'
    body_linked = re.sub(url_pattern, r'<a href="\1" style="color:#4F46E5;text-decoration:underline;">\1</a>', body)

    # Convertir les sauts de ligne en <br>
    body_html = body_linked.replace('\n', '<br>')

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:12px;">
                <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Pilotis Recrutement</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">{subject}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              <div style="color:#374151;font-size:15px;line-height:1.8;">
                {body_html}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="background:#ffffff;padding:0 40px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border-radius:0 0 16px 16px;border:1px solid #E5E7EB;border-top:none;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;color:#6B7280;font-size:12px;">
                Cet email a été envoyé automatiquement par la plateforme <strong style="color:#4F46E5;">Pilotis</strong>.
              </p>
              <p style="margin:0;color:#9CA3AF;font-size:11px;">
                &copy; 2025 Pilotis &middot; Tous droits réservés
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_email(to, subject, body):
    """Envoie un email via Flask-Mail en utilisant la configuration de la base.
    Envoie automatiquement en texte brut ET en HTML stylisé (responsive)."""
    from app import mail

    email_cfg = get_email_config()

    if not email_cfg:
        logger.warning("Configuration email manquante dans la base, simulation d'envoi")
        logger.info(f"SIMULATION EMAIL a {to}")
        logger.info(f"Sujet: {subject}")
        logger.info(f"Corps: {body[:200]}...")
        return False, "Configuration email manquante"

    if not email_cfg.username or not email_cfg.get_password():
        logger.warning("Email ou mot de passe manquant dans la base, simulation")
        logger.info(f"SIMULATION EMAIL a {to}")
        return False, "Identifiants manquants"

    try:
        app = current_app._get_current_object()

        with app.app_context():
            app.config['MAIL_SERVER'] = email_cfg.server.strip() if email_cfg.server else 'smtp.gmail.com'
            app.config['MAIL_PORT'] = email_cfg.port
            app.config['MAIL_USE_TLS'] = email_cfg.use_tls
            app.config['MAIL_USERNAME'] = email_cfg.username.strip() if email_cfg.username else ''
            app.config['MAIL_PASSWORD'] = email_cfg.get_password().strip() if email_cfg.get_password() else ''
            app.config['MAIL_DEFAULT_SENDER'] = email_cfg.default_sender.strip() if email_cfg.default_sender else app.config['MAIL_USERNAME']

            from app import mail as mail_instance
            mail_instance.init_app(app)

            # Generer le HTML stylise automatiquement depuis le corps texte
            html_body = _build_html_email(body, subject)

            msg = Message(subject, recipients=[to], body=body, html=html_body)
            mail_instance.send(msg)
            logger.info(f"Email HTML envoye a {to}")
            return True, None

    except Exception as e:
        logger.error(f"Erreur envoi email: {e}")
        logger.info(f"SIMULATION EMAIL a {to} (apres erreur)")
        return False, str(e)


def send_sms(to, message):
    """Envoie un SMS via Twilio si configuré, sinon simulation."""
    import os
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    from_ = os.getenv('TWILIO_PHONE_NUMBER')

    if not all([account_sid, auth_token, from_]):
        logger.warning("Twilio non configure, SMS simule")
        logger.info(f"SIMULATION SMS a {to}")
        logger.info(f"Message: {message[:100]}...")
        return

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        client.messages.create(body=message, from_=from_, to=to)
        logger.info(f"SMS envoye a {to}")
    except Exception as e:
        logger.error(f"Erreur envoi SMS: {e}")
        logger.info(f"SIMULATION SMS a {to} (apres erreur)")
