# app/routes/linkedin.py
"""
Blueprint pour toutes les routes LinkedIn, contacts, validations et settings.

URL prefix : /api
Routes :
    GET/POST   /settings
    GET/POST   /linkedin-settings
    GET/POST   /email-settings
    GET        /linkedin/status
    GET        /linkedin/login
    GET        /linkedin/callback
    GET        /linkedin/status-redirect
    POST       /linkedin/logout
    POST       /linkedin/post
    GET/POST   /linkedin/accounts
    PUT        /linkedin/accounts/<id>
    DELETE     /linkedin/accounts/<id>
    GET        /linkedin/connect/<id>
    GET/POST   /contacts
    PUT/DELETE /contacts/<id>
    GET        /contacts/active
    GET        /validations/<uuid>
    POST       /validations/<uuid>/accept
    POST       /validations/<uuid>/reject
    POST       /validations/<uuid>/save
    GET        /validations/pending
    POST       /share-and-notify
"""

from flask import Blueprint, jsonify, request, session, redirect, url_for, current_app
from datetime import datetime
import os

from app.models.settings import AppSetting, LinkedInAccount, LinkedInSettings, EmailSettings
from app.models.linkedin_engagement import LinkedInEngagement

from app.models.contact import Contact
from app.models.post_validation import PostValidation
from app.models.job_requisition import JobRequisition
from app.services.linkedin_service import post_to_linkedin
from app.extensions import db
from app.utils.authentification import login_required, config_access_required
from app.utils.notifications import send_email

linkedin_bp = Blueprint("linkedin_routes", __name__)


# ── SETTINGS ──────────────────────────────────────────────────────────────────

@linkedin_bp.route("/settings", methods=["GET"])
def get_settings():
    settings = AppSetting.query.all()
    result = {}
    for s in settings:
        result[s.key] = s.get_value()
    return jsonify(result)


@linkedin_bp.route("/settings", methods=["POST"])
def update_settings():
    data = request.json
    if not data:
        return jsonify({"error": "Données manquantes"}), 400
    for key, value in data.items():
        setting = AppSetting.query.get(key)
        if setting:
            setting.set_value(value)
        else:
            new_setting = AppSetting(key=key)
            new_setting.set_value(value)
            db.session.add(new_setting)
    db.session.commit()
    return jsonify({"success": True, "message": "Paramètres mis à jour"})


@linkedin_bp.route("/linkedin-settings", methods=["GET"])
@login_required
@config_access_required
def get_linkedin_settings():
    settings = LinkedInSettings.query.first()
    if not settings:
        return jsonify({"error": "Aucun paramètre LinkedIn"}), 404
    return jsonify({
        "client_id": settings.client_id,
        "client_secret": settings.get_client_secret()
    })


@linkedin_bp.route("/linkedin-settings", methods=["POST"])
@login_required
@config_access_required
def update_linkedin_settings():
    data = request.json
    settings = LinkedInSettings.query.first()
    if not settings:
        settings = LinkedInSettings()
        db.session.add(settings)
    settings.client_id = data.get("client_id", "")
    if "client_secret" in data and data["client_secret"]:
        settings.set_client_secret(data["client_secret"])
    db.session.commit()
    return jsonify({"success": True})


@linkedin_bp.route("/email-settings", methods=["GET"])
@login_required
@config_access_required
def get_email_settings():
    settings = EmailSettings.query.first()
    if not settings:
        return jsonify({"error": "Aucun paramètre email"}), 404
    return jsonify({
        "server": settings.server,
        "port": settings.port,
        "use_tls": settings.use_tls,
        "username": settings.username,
        "password": settings.get_password(),
        "default_sender": settings.default_sender
    })


@linkedin_bp.route("/email-settings", methods=["POST"])
@login_required
@config_access_required
def update_email_settings():
    data = request.json
    settings = EmailSettings.query.first()
    if not settings:
        settings = EmailSettings()
        db.session.add(settings)
    settings.server         = data.get("server", "smtp.gmail.com")
    settings.port           = data.get("port", 587)
    settings.use_tls        = data.get("use_tls", True)
    settings.username       = data.get("username", "")
    if "password" in data and data["password"]:
        settings.set_password(data["password"])
    settings.default_sender = data.get("default_sender", "")
    db.session.commit()
    return jsonify({"success": True})


# ── LINKEDIN OAuth ─────────────────────────────────────────────────────────────

def _get_linkedin_oauth_config():
    settings = LinkedInSettings.query.first()
    if not settings:
        return None, None
    return settings.client_id, settings.get_client_secret()


@linkedin_bp.route("/linkedin/status")
def linkedin_status():
    token_info = session.get("linkedin_oauth_token")
    return jsonify({"connected": token_info is not None})


@linkedin_bp.route("/linkedin/login")
def linkedin_login():
    client_id, _ = _get_linkedin_oauth_config()
    if not client_id:
        return jsonify({"error": "LinkedIn Client ID non configuré"}), 500
    redirect_uri = url_for('linkedin_routes.linkedin_callback', _external=True)
    auth_url = (
        f"https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code&client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=openid%20profile%20email%20w_member_social"
    )
    return redirect(auth_url)


@linkedin_bp.route("/linkedin/callback")
def linkedin_callback():
    import requests as _req
    code = request.args.get('code')
    client_id, client_secret = _get_linkedin_oauth_config()
    if not client_id or not client_secret:
        return jsonify({"error": "Configuration LinkedIn manquante"}), 500

    token_url = "https://www.linkedin.com/oauth/v2/accessToken"
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': url_for('linkedin_routes.linkedin_callback', _external=True),
        'client_id': client_id,
        'client_secret': client_secret
    }
    response = _req.post(token_url, data=data)
    if response.status_code != 200:
        return jsonify({"error": "Échec de l'obtention du token"}), 400

    token_data   = response.json()
    access_token = token_data.get('access_token')
    if not access_token:
        return jsonify({"error": "Token manquant"}), 400

    # Récupérer les infos utilisateur
    headers = {'Authorization': f'Bearer {access_token}'}
    userinfo_resp = _req.get('https://api.linkedin.com/v2/userinfo', headers=headers)
    email = name = None
    if userinfo_resp.status_code == 200:
        userinfo = userinfo_resp.json()
        email = userinfo.get('email')
        given  = userinfo.get('given_name', '')
        family = userinfo.get('family_name', '')
        name   = f"{given} {family}".strip() or userinfo.get('name') or email
    else:
        print("❌ Impossible de récupérer l'email LinkedIn")

    if email:
        account = LinkedInAccount.query.filter_by(email=email).first()
        if not account:
            account = LinkedInAccount(
                name=name or email,
                email=email,
                notify_enabled=True,
                notify_by_email=True,
                notify_in_app=True
            )
            db.session.add(account)
            db.session.flush()
        account.set_token(access_token)
        db.session.commit()

        user_id = session.get('user_id')
        if user_id:
            from app.models.users import User
            user = User.query.get(user_id)
            if user and user.linkedin_account_id != account.id:
                user.linkedin_account_id = account.id
                db.session.commit()

    session['linkedin_oauth_token'] = access_token
    return redirect(url_for('linkedin_routes.linkedin_status_redirect'))


@linkedin_bp.route("/linkedin/status-redirect")
def linkedin_status_redirect():
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    return redirect(f"{frontend_url}/appels-offres?linkedin=connected")


@linkedin_bp.route("/linkedin/logout", methods=["POST"])
def linkedin_logout():
    session.pop("linkedin_oauth_token", None)
    return jsonify({"success": True})


@linkedin_bp.route("/linkedin/post", methods=["POST"])
def linkedin_post():
    token_info = session.get("linkedin_oauth_token")
    if not token_info:
        return jsonify({"error": "Non connecté à LinkedIn"}), 401

    data       = request.get_json()
    content    = data.get("content")
    account_id = data.get("account_id")
    if not content:
        return jsonify({"error": "Contenu manquant"}), 400

    from app.services.linkedin_service import post_to_all_accounts

    if account_id:
        account = LinkedInAccount.query.get(account_id)
        if not account:
            return jsonify({"error": "Compte LinkedIn non trouvé"}), 404
        if not account.access_token:
            return jsonify({"error": "Ce compte LinkedIn n'a pas de token"}), 400
        success, error, _, _ = post_to_linkedin(account.get_token(), content)
        return jsonify({"success": success, "account": account.name, "error": error})
    else:
        results   = post_to_all_accounts(content)
        successes = sum(1 for r in results if r["success"])
        return jsonify({
            "success": successes > 0,
            "total": len(results),
            "success_count": successes,
            "results": results,
        })


# ── LINKEDIN ACCOUNTS ─────────────────────────────────────────────────────────

@linkedin_bp.route("/linkedin/accounts", methods=["GET"])
def get_linkedin_accounts():
    accounts = LinkedInAccount.query.order_by(LinkedInAccount.created_at.desc()).all()
    return jsonify([{
        "id": a.id,
        "name": a.name,
        "email": a.email,
        "access_token": a.get_token() if a.get_token() else None,
        "notify_enabled": a.notify_enabled,
        "notify_by_email": a.notify_by_email,
        "notify_in_app": a.notify_in_app,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in accounts])


@linkedin_bp.route("/linkedin/accounts", methods=["POST"])
def add_linkedin_account():
    data = request.json
    if not data or not data.get("name"):
        return jsonify({"error": "Nom requis"}), 400
    account = LinkedInAccount(
        name=data["name"],
        email=data.get("email"),
        notify_enabled=data.get("notify_enabled", True),
        notify_by_email=data.get("notify_by_email", True),
        notify_in_app=data.get("notify_in_app", True),
    )
    if data.get("access_token"):
        account.set_token(data["access_token"])
    db.session.add(account)
    db.session.commit()
    return jsonify({"success": True, "id": account.id, "message": f"Compte {data['name']} ajouté"})


@linkedin_bp.route("/linkedin/accounts/<int:account_id>", methods=["PUT"])
def update_linkedin_account(account_id):
    account = LinkedInAccount.query.get(account_id)
    if not account:
        return jsonify({"error": "Compte non trouvé"}), 404
    data = request.json
    if not data:
        return jsonify({"error": "Données manquantes"}), 400
    if "name" in data:             account.name = data["name"]
    if "email" in data:            account.email = data.get("email")
    if "access_token" in data:     account.set_token(data["access_token"])
    if "notify_enabled" in data:   account.notify_enabled = data["notify_enabled"]
    if "notify_by_email" in data:  account.notify_by_email = data["notify_by_email"]
    if "notify_in_app" in data:    account.notify_in_app = data["notify_in_app"]
    db.session.commit()
    return jsonify({"success": True, "message": f"Compte {account.name} mis à jour"})


@linkedin_bp.route("/linkedin/accounts/<int:account_id>", methods=["DELETE"])
def delete_linkedin_account(account_id):
    account = LinkedInAccount.query.get(account_id)
    if not account:
        return jsonify({"error": "Compte non trouvé"}), 404
    db.session.delete(account)
    db.session.commit()
    return jsonify({"success": True, "message": f"Compte {account.name} supprimé"})


@linkedin_bp.route("/linkedin/connect/<int:account_id>")
def linkedin_connect(account_id):
    session['oauth_account_id'] = account_id
    return redirect(url_for("linkedin_routes.linkedin_login"))


# ── CONTACTS ──────────────────────────────────────────────────────────────────

@linkedin_bp.route("/contacts", methods=["GET"])
@login_required
def get_contacts():
    user_role = session.get('user_role')
    org_id = session.get('organization_id')
    query = Contact.query
    if user_role in ['manager', 'commercial'] and org_id:
        query = query.filter_by(organization_id=org_id)
    contacts = query.order_by(Contact.created_at.desc()).all()
    return jsonify([{
        "id_contact": c.id_contact,
        "name": c.name,
        "email": c.email,
        "is_active": c.is_active,
        "organization_id": c.organization_id,
        "organization_name": c.organization.name if c.organization else None,
        "created_at": c.created_at.isoformat() if c.created_at else None
    } for c in contacts])


@linkedin_bp.route("/contacts", methods=["POST"])
@login_required
def add_contact():
    data = request.json
    if not data or not data.get("name") or not data.get("email"):
        return jsonify({"error": "Nom et email requis"}), 400
    if Contact.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Cet email existe déjà"}), 400
        
    user_role = session.get('user_role')
    org_id = session.get('organization_id')
    contact_org = org_id if user_role in ['manager', 'commercial'] else data.get("organization_id")

    contact = Contact(
        name=data["name"],
        email=data["email"],
        is_active=data.get("is_active", True),
        organization_id=contact_org
    )
    db.session.add(contact)
    db.session.commit()
    return jsonify({"success": True, "id_contact": contact.id_contact}), 201


@linkedin_bp.route("/contacts/<int:contact_id>", methods=["PUT"])
@login_required
def update_contact(contact_id):
    contact = Contact.query.filter_by(id_contact=contact_id).first_or_404()
    
    user_role = session.get('user_role')
    org_id = session.get('organization_id')
    if user_role in ['manager', 'commercial'] and contact.organization_id != org_id:
        return jsonify({"error": "Accès refusé"}), 403

    data = request.json
    if "name" in data:
        contact.name = data["name"]
    if "email" in data:
        existing = Contact.query.filter_by(email=data["email"]).first()
        if existing and existing.id_contact != contact_id:
            return jsonify({"error": "Email déjà utilisé"}), 400
        contact.email = data["email"]
    if "is_active" in data:
        contact.is_active = data["is_active"]
    db.session.commit()
    return jsonify({"success": True})


@linkedin_bp.route("/contacts/<int:contact_id>", methods=["DELETE"])
@login_required
def delete_contact(contact_id):
    contact = Contact.query.filter_by(id_contact=contact_id).first_or_404()
    
    user_role = session.get('user_role')
    org_id = session.get('organization_id')
    if user_role in ['manager', 'commercial'] and contact.organization_id != org_id:
        return jsonify({"error": "Accès refusé"}), 403

    db.session.delete(contact)
    db.session.commit()
    return jsonify({"success": True})


@linkedin_bp.route("/contacts/active", methods=["GET"])
@login_required
def get_active_contacts():
    user_role = session.get('user_role')
    org_id = session.get('organization_id')
    query = Contact.query.filter_by(is_active=True)
    if user_role in ['manager', 'commercial'] and org_id:
        query = query.filter_by(organization_id=org_id)
    contacts = query.order_by(Contact.created_at.desc()).all()
    return jsonify([{
        "id_contact": c.id_contact,
        "name": c.name,
        "email": c.email,
        "organization_id": c.organization_id,
        "organization_name": c.organization.name if c.organization else None,
        "is_active": c.is_active
    } for c in contacts])


# ── VALIDATIONS ───────────────────────────────────────────────────────────────

@linkedin_bp.route("/validations/<string:validation_uuid>", methods=["GET"])
def get_validation(validation_uuid):
    """Récupère une validation par son UUID"""
    validation = PostValidation.query.filter_by(uuid=validation_uuid).first_or_404()
    account = LinkedInAccount.query.get(validation.account_id)
    return jsonify({
        "id": validation.id,
        "uuid": validation.uuid,
        "post_content": validation.post_content,
        "status": validation.status,
        "opportunity": {
            "id": validation.opportunity.requisition_id,
            "titre": validation.opportunity.titre,
            "client": validation.opportunity.client_nom
        },
        "account_email": account.email if account else None,
        "created_at": validation.created_at.isoformat() if validation.created_at else None
    })


@linkedin_bp.route("/validations/<string:validation_uuid>/accept", methods=["POST"])
def accept_validation(validation_uuid):
    """Accepte et publie le post sur LinkedIn"""
    data       = request.json
    final_post = data.get("final_post")
    validation = PostValidation.query.filter_by(uuid=validation_uuid).first_or_404()
    if validation.status != 'pending':
        return jsonify({"error": "Validation déjà traitée"}), 400
    account = LinkedInAccount.query.get(validation.account_id)
    if not account or not account.access_token:
        return jsonify({"error": "Compte LinkedIn non configuré"}), 400
    post_to_publish = final_post if final_post else validation.post_content
    success, error, post_urn, post_url = post_to_linkedin(account.get_token(), post_to_publish)
    if success:
        validation.status         = 'accepted'
        validation.selected_email = account.email
        validation.responded_at   = datetime.now()
        validation.posted_at      = datetime.now()
        # Store LinkedIn post URN for Apify scraping
        if post_urn:
            validation.linkedin_post_urn = post_urn
            validation.linkedin_post_url = post_url
            validation.scrape_status     = 'idle'
        db.session.commit()
        return jsonify({"success": True, "message": "Post publié avec succès"})
    else:
        return jsonify({"success": False, "error": error}), 500


@linkedin_bp.route("/validations/<string:validation_uuid>/reject", methods=["POST"])
def reject_validation(validation_uuid):
    """Refuse la publication"""
    validation = PostValidation.query.filter_by(uuid=validation_uuid).first_or_404()
    if validation.status != 'pending':
        return jsonify({"error": "Validation déjà traitée"}), 400
    validation.status       = 'rejected'
    validation.responded_at = datetime.now()
    db.session.commit()
    return jsonify({"success": True, "message": "Publication refusée"})


@linkedin_bp.route("/validations/<string:validation_uuid>/save", methods=["POST"])
def save_validation(validation_uuid):
    """Sauvegarde les modifications du post (sans publier)"""
    data          = request.json
    modified_post = data.get("modified_post")
    if not modified_post:
        return jsonify({"error": "Contenu modifié manquant"}), 400
    validation = PostValidation.query.filter_by(uuid=validation_uuid).first_or_404()
    validation.post_content = modified_post
    db.session.commit()
    return jsonify({"success": True, "message": "Modifications sauvegardées"})


@linkedin_bp.route('/validations/pending')
@login_required
def get_pending_validations():
    """Récupère les validations en attente pour un commercial"""
    email = request.args.get('email')
    if not email:
        return jsonify([])
    account = LinkedInAccount.query.filter_by(email=email).first()
    if not account:
        return jsonify([])
    validations = PostValidation.query.filter_by(
        account_id=account.id,
        status='pending'
    ).order_by(PostValidation.created_at.desc()).all()
    return jsonify([{
        'id': v.id,
        'uuid': v.uuid,
        'post_content': v.post_content,
        'status': v.status,
        'opportunity': {
            'id': v.opportunity.requisition_id,
            'titre': v.opportunity.titre,
            'client': v.opportunity.client_nom
        },
        'created_at': v.created_at.isoformat() if v.created_at else None
    } for v in validations])


@linkedin_bp.route("/share-and-notify", methods=["POST"])
def share_and_notify():
    """Crée une notification pour un commercial spécifique"""
    data           = request.json
    titre          = data.get("titre")
    post_content   = data.get("post_content")
    opportunity_id = data.get("opportunity_id")
    account_id     = data.get("account_id")

    if not titre or not post_content or not opportunity_id or not account_id:
        return jsonify({"error": "Données manquantes"}), 400

    opp = JobRequisition.query.get(opportunity_id)
    if not opp:
        return jsonify({"error": "Opportunité non trouvée"}), 404

    account = LinkedInAccount.query.get(account_id)
    if not account:
        return jsonify({"error": "Compte non trouvé"}), 404

    validation = PostValidation(
        account_id=account_id,
        opportunity_id=opportunity_id,
        post_content=post_content,
        status='pending'
    )
    db.session.add(validation)
    db.session.commit()

    if account.notify_by_email and account.email:
        base_url        = os.getenv("FRONTEND_URL", "http://localhost:8080")
        validation_link = f"{base_url}/validate/{validation.uuid}"
        subject = f"[PILOTIS] Nouveau post à valider : {titre}"
        body = f"""
Bonjour {account.name},

Un nouveau post LinkedIn est prêt à être publié sur votre compte :

📌 {titre}
🏢 {opp.client_nom}

Pour voir, modifier et publier le post, cliquez ici :
{validation_link}

Cordialement,
L'équipe PILOTIS
"""
        send_email(account.email, subject, body)

    return jsonify({"success": True, "message": "Notification envoyée"})


# ── APIFY SETTINGS ────────────────────────────────────────────────────────────

@linkedin_bp.route("/debug/apify-config", methods=["GET"])
@login_required
def debug_apify_config():
    """Debug : affiche les valeurs brutes stockées en base pour Apify."""
    token_setting = AppSetting.query.filter_by(key='apify_api_token').first()
    actor_setting = AppSetting.query.filter_by(key='apify_actor_id').first()
    return jsonify({
        "token_raw":   repr(token_setting.value) if token_setting else None,
        "token_len":   len(token_setting.value) if token_setting else 0,
        "token_first10": token_setting.value.strip()[:10] if token_setting and token_setting.value else None,
        "actor_raw":   repr(actor_setting.value) if actor_setting else None,
        "actor_slug":  actor_setting.value.strip().replace("/", "~") if actor_setting and actor_setting.value else None,
    })


@linkedin_bp.route("/apify-settings", methods=["GET"])
@login_required
@config_access_required
def get_apify_settings():
    """Retourne la configuration Apify (token en clair, comme Boond API URL)."""
    keys = ['apify_api_token', 'apify_actor_id', 'apify_webhook_url', 'linkedin_li_at_cookie']
    settings = {}
    for k in keys:
        s = AppSetting.query.filter_by(key=k).first()
        settings[k] = s.value if s else ''
    return jsonify(settings)


@linkedin_bp.route("/apify-settings", methods=["POST"])
@login_required
@config_access_required
def update_apify_settings():
    """Sauvegarde la configuration Apify en base (texte clair, comme Boond)."""
    data = request.json or {}
    allowed = ['apify_api_token', 'apify_actor_id', 'apify_webhook_url', 'linkedin_li_at_cookie']
    for key in allowed:
        if key in data and data[key]:
            setting = AppSetting.query.filter_by(key=key).first()
            if setting:
                setting.value = data[key]
            else:
                s = AppSetting(key=key, value=data[key])
                db.session.add(s)
    db.session.commit()
    return jsonify({"success": True, "message": "Configuration Apify sauvegardée"})


# ── LINKEDIN ENGAGEMENT (Apify) ───────────────────────────────────────────────

@linkedin_bp.route("/linkedin/posts/<int:pv_id>/scrape", methods=["POST"])
@login_required
def scrape_post_engagement(pv_id):
    """Lance le scraping Apify (2 runs : likers + commenters)."""
    pv = PostValidation.query.get_or_404(pv_id)

    if not pv.linkedin_post_url:
        return jsonify({"error": "Aucune URL de post LinkedIn enregistrée pour cette validation"}), 400

    if pv.scrape_status == 'pending':
        return jsonify({"message": "Scraping déjà en cours, patientez...", "status": "pending"}), 200

    # Webhook URL est optionnel — sans lui on utilisera le polling frontend
    webhook_setting = AppSetting.query.filter_by(key='apify_webhook_url').first()
    webhook = (webhook_setting.value if webhook_setting else os.getenv('APIFY_WEBHOOK_URL', '')) or ''

    try:
        from app.services.apify_service import trigger_scrape_all
        run_likers, run_comments = trigger_scrape_all(pv.linkedin_post_url, webhook)
        pv.scrape_status           = 'pending'
        pv.apify_run_id            = run_likers.get('id')    # run des likes
        pv.apify_run_id_comments   = run_comments.get('id') # run des commentaires
        db.session.commit()
        return jsonify({
            "success":        True,
            "run_likers":     run_likers.get('id'),
            "run_commenters": run_comments.get('id'),
            "message":        "Scraping lancé (likes + commentaires) — résultats dans 2 à 5 minutes"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@linkedin_bp.route("/linkedin/webhook/apify", methods=["POST"])
def apify_webhook():
    """Webhook appelé par Apify quand un run est terminé (likers OU commenters)."""
    data   = request.json or {}
    run_id = data.get("resource", {}).get("id")
    status = data.get("resource", {}).get("status", "")

    if not run_id:
        return jsonify({"error": "run_id manquant"}), 400

    # Chercher le PostValidation correspondant au run (likers ou commenters)
    pv = (PostValidation.query.filter_by(apify_run_id=run_id).first() or
          PostValidation.query.filter_by(apify_run_id_comments=run_id).first())

    if not pv:
        return jsonify({"error": "PostValidation introuvable pour ce run_id"}), 404

    # Déterminer si c'est le run likers ou commenters
    is_likers_run    = (pv.apify_run_id == run_id)
    engagement_type  = 'like' if is_likers_run else 'comment'

    if status == "FAILED":
        # Ne passer en erreur que si les DEUX runs échouent
        if is_likers_run:
            pv.apify_run_id = None
        else:
            pv.apify_run_id_comments = None

        if not pv.apify_run_id and not pv.apify_run_id_comments:
            pv.scrape_status = 'error'
        db.session.commit()
        return jsonify({"success": False, "error": f"Apify run {engagement_type} failed"})

    try:
        from app.services.apify_service import fetch_run_results
        items = fetch_run_results(run_id)

        # Supprimer les anciens engagements du même type pour ce post
        LinkedInEngagement.query.filter_by(
            post_validation_id=pv.id,
            engagement_type=engagement_type
        ).delete()

        saved = 0
        for item in items:
            eng = LinkedInEngagement(
                post_validation_id  = pv.id,
                opportunity_id      = pv.opportunity_id,
                engagement_type     = engagement_type,
                person_name         = (item.get('name') or item.get('authorName') or '')[:200],
                person_headline     = (item.get('subtitle') or item.get('authorHeadline') or item.get('headline') or '')[:300],
                person_linkedin_url = (item.get('url_profile') or item.get('authorProfileUrl') or item.get('profileUrl') or item.get('url') or '')[:300],
                comment_text        = item.get('content') or item.get('text') or item.get('comment') if engagement_type == 'comment' else None,
                engagement_date     = str(item.get('datetime') or item.get('date') or ''),
            )
            db.session.add(eng)
            saved += 1

        # Vérifier si les deux runs sont terminés
        all_done = True
        if is_likers_run:
            pv.apify_run_id = None  # marquer ce run comme consommé
        else:
            pv.apify_run_id_comments = None

        if pv.apify_run_id is not None or pv.apify_run_id_comments is not None:
            all_done = False  # l'autre run est encore en attente

        if all_done:
            pv.scrape_status   = 'done'
            pv.last_scraped_at = datetime.utcnow()

        db.session.commit()
        print(f"[Apify Webhook] {saved} {engagement_type}s sauvegardés (pv={pv.id}) | {'done' if all_done else 'waiting other run'}")
        return jsonify({"success": True, "saved": saved, "type": engagement_type})

    except Exception as e:
        pv.scrape_status = 'error'
        db.session.commit()
        return jsonify({"error": str(e)}), 500


@linkedin_bp.route("/linkedin/posts/<int:pv_id>/poll", methods=["POST"])
@login_required
def poll_scrape_status(pv_id):
    """
    Polling endpoint : vérifie le statut des runs Apify et traite les résultats
    quand ils sont terminés. Appelé par le frontend toutes les 15 secondes.
    """
    from app.services.apify_service import fetch_run_results, get_run_status

    pv = PostValidation.query.get_or_404(pv_id)
    if pv.scrape_status != 'pending':
        return jsonify({"status": pv.scrape_status})

    run_ids = {
        "like":    pv.apify_run_id,
        "comment": pv.apify_run_id_comments,
    }

    for eng_type, run_id in run_ids.items():
        if not run_id:
            continue
        try:
            run_data = get_run_status(run_id)
            status   = run_data.get("status", "")

            if status == "SUCCEEDED":
                items = fetch_run_results(run_id)
                LinkedInEngagement.query.filter_by(
                    post_validation_id=pv.id,
                    engagement_type=eng_type
                ).delete()
                for item in items:
                    db.session.add(LinkedInEngagement(
                        post_validation_id  = pv.id,
                        opportunity_id      = pv.opportunity_id,
                        engagement_type     = eng_type,
                        person_name         = (item.get('name') or item.get('authorName') or '')[:200],
                        person_headline     = (item.get('subtitle') or item.get('authorHeadline') or item.get('headline') or '')[:300],
                        person_linkedin_url = (item.get('url_profile') or item.get('authorProfileUrl') or item.get('profileUrl') or item.get('url') or '')[:300],
                        comment_text        = (item.get('content') or item.get('text') or item.get('comment') or '') if eng_type == 'comment' else None,
                        engagement_date     = str(item.get('datetime') or item.get('date') or ''),
                    ))
                if eng_type == 'like':
                    pv.apify_run_id = None
                else:
                    pv.apify_run_id_comments = None

            elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
                if eng_type == 'like':
                    pv.apify_run_id = None
                else:
                    pv.apify_run_id_comments = None
        except Exception as ex:
            print(f"[Poll] Erreur run {run_id} ({eng_type}): {ex}")

    # Done quand les 2 runs sont terminés
    if pv.apify_run_id is None and pv.apify_run_id_comments is None:
        pv.scrape_status   = 'done'
        pv.last_scraped_at = datetime.utcnow()

    db.session.commit()
    return jsonify({"status": pv.scrape_status})


@linkedin_bp.route("/linkedin/posts/<int:pv_id>/engagement", methods=["GET"])
def get_post_engagement(pv_id):
    """Retourne les interactions stockées en base pour un post."""
    pv   = PostValidation.query.get_or_404(pv_id)
    engs = LinkedInEngagement.query.filter_by(post_validation_id=pv_id)\
                                   .order_by(LinkedInEngagement.collected_at.desc()).all()

    comments = [e.to_dict() for e in engs if e.engagement_type == 'comment']
    likes    = [e.to_dict() for e in engs if e.engagement_type == 'like']

    return jsonify({
        "status":         pv.scrape_status or 'idle',
        "post_url":       pv.linkedin_post_url,
        "post_content":   (pv.post_content[:120] + '...' if pv.post_content and len(pv.post_content) > 120 else pv.post_content or ''),
        "opportunity_id": pv.opportunity_id,
        "last_scraped":   pv.last_scraped_at.isoformat() if pv.last_scraped_at else None,
        "total_comments": len(comments),
        "total_likes":    len(likes),
        "comments":       comments,
        "likes":          likes,
    })


@linkedin_bp.route("/linkedin/engagement/all", methods=["GET"])
@login_required
def get_all_engagement():
    """Retourne tous les posts LinkedIn avec leurs interactions (page dashboard)."""
    user_role = session.get("user_role")
    org_id = session.get("organization_id")
    
    query = PostValidation.query.filter(
        PostValidation.linkedin_post_url.isnot(None)
    )

    if user_role in ["manager", "commercial"] and org_id:
        from app.models.organization import Organization
        from app.models.job_requisition import JobRequisition
        org = Organization.query.get(org_id)
        if org:
            query = query.join(JobRequisition, PostValidation.opportunity_id == JobRequisition.requisition_id)
            query = query.filter(JobRequisition.client_nom == org.name)

    posts = query.order_by(PostValidation.posted_at.desc()).all()

    result = []
    for pv in posts:
        engs = LinkedInEngagement.query.filter_by(post_validation_id=pv.id).all()
        opp  = pv.opportunity
        result.append({
            "post_validation_id": pv.id,
            "post_url":           pv.linkedin_post_url,
            "post_content":       (pv.post_content[:120] + '...' if pv.post_content and len(pv.post_content) > 120 else pv.post_content or ''),
            "opportunity_id":     pv.opportunity_id,
            "opportunity_titre":  opp.titre if opp else 'N/A',
            "opportunity_client": opp.client_nom if opp else '',
            "posted_at":          pv.posted_at.isoformat() if pv.posted_at else None,
            "scrape_status":      pv.scrape_status or 'idle',
            "last_scraped":       pv.last_scraped_at.isoformat() if pv.last_scraped_at else None,
            "total_comments":     sum(1 for e in engs if e.engagement_type == 'comment'),
            "total_likes":        sum(1 for e in engs if e.engagement_type == 'like'),
            "comments": [{
                "id":          e.id,
                "name":        e.person_name,
                "headline":    e.person_headline,
                "profile_url": e.person_linkedin_url,
                "comment":     e.comment_text,
                "date":        e.engagement_date,
            } for e in engs if e.engagement_type == 'comment'],
            "likes": [{
                "id":          e.id,
                "name":        e.person_name,
                "headline":    e.person_headline,
                "profile_url": e.person_linkedin_url,
            } for e in engs if e.engagement_type == 'like'],
        })
    return jsonify(result)


@linkedin_bp.route("/linkedin/posts/<int:pv_id>", methods=["DELETE"])
@login_required
def delete_linkedin_post(pv_id):
    """Supprime une publication LinkedIn de la base de données (et ses interactions associées)."""
    pv = PostValidation.query.get_or_404(pv_id)
    
    # Supprimer d'abord les engagements associés pour éviter les conflits de clé étrangère
    LinkedInEngagement.query.filter_by(post_validation_id=pv_id).delete()
    
    db.session.delete(pv)
    db.session.commit()
    return jsonify({"success": True, "message": "Publication supprimée avec succès"})


# ── GOOGLE FORM SETTINGS ──────────────────────────────────────────────────────

@linkedin_bp.route("/google-form-settings", methods=["GET"])
@login_required
def get_google_form_settings():
    """Retourne la configuration du Google Form (spreadsheet_id, form_url)."""
    keys = ["google_form_sheet_id", "google_form_url"]
    result = {}
    for k in keys:
        s = AppSetting.query.filter_by(key=k).first()
        result[k] = s.value if s else ""
    return jsonify(result)


@linkedin_bp.route("/google-form-settings", methods=["POST"])
@login_required
def update_google_form_settings():
    """Sauvegarde la configuration du Google Form."""
    data = request.json or {}
    allowed = ["google_form_sheet_id", "google_form_url"]
    for key in allowed:
        if key in data:
            setting = AppSetting.query.filter_by(key=key).first()
            if setting:
                setting.value = data[key]
            else:
                db.session.add(AppSetting(key=key, value=data[key]))
    db.session.commit()
    return jsonify({"success": True, "message": "Configuration Google Form sauvegardée"})


@linkedin_bp.route("/collect-linkedin-forms", methods=["POST"])
@login_required
def collect_linkedin_forms():
    """
    Déclenche manuellement la collecte des candidatures depuis le Google Form.
    Lance en arrière-plan pour ne pas bloquer la réponse HTTP.
    """
    import threading
    app_obj = current_app._get_current_object()

    def _run():
        try:
            from app.services.linkedin_form_collector import collect_linkedin_candidates
            stats = collect_linkedin_candidates(app_obj)
            print(
                f"[LinkedIn Form] Collecte manuelle terminée — "
                f"créés={stats['created']} ignorés={stats['skipped']} erreurs={stats['errors']}"
            )
        except Exception as exc:
            print(f"[LinkedIn Form] Erreur collecte manuelle: {exc}")

    t = threading.Thread(target=_run, daemon=True, name="linkedin-form-manual")
    t.start()
    return jsonify({
        "success": True,
        "message": "Collecte lancée en arrière-plan — actualisez la liste des candidats dans quelques secondes."
    })