# app/routes/gmail_auth_routes.py
from flask import Blueprint, request, jsonify, session, redirect
from app.services.gmail_oauth_service import GmailOAuthService
from app.models.contact import Contact
from app.models.users import User
from app.models.settings import GmailSettings
from app.extensions import db
from app.utils.authentification import login_required, role_required
from datetime import datetime

bp = Blueprint('gmail_auth', __name__, url_prefix='/api/gmail-auth')


# ==================== ROUTES POUR LA CONNEXION DES UTILISATEURS ====================

@bp.route('/connect/<int:contact_id>', methods=['GET'])
def connect_contact(contact_id):
    """Génère l'URL d'authentification pour un contact spécifique"""
    try:
        auth_url = GmailOAuthService.get_auth_url(contact_id)
        return jsonify({'auth_url': auth_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@bp.route('/connect/current', methods=['GET'])
@login_required
def connect_current_user():
    """Connecte le compte Gmail de l'utilisateur courant"""
    user_id = session.get('user_id')
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Utilisateur non trouvé'}), 404
    
    contact = Contact.query.filter_by(email=user.email).first()
    
    if not contact:
        contact = Contact(
            name=f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email.split('@')[0],
            email=user.email,
            is_active=True
        )
        db.session.add(contact)
        db.session.commit()
        print(f"✅ Contact créé pour l'utilisateur {user.email}")
    
    try:
        auth_url = GmailOAuthService.get_auth_url(contact.id_contact)
        return jsonify({'auth_url': auth_url})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@bp.route('/callback', methods=['GET'])
def oauth_callback():
    """Callback OAuth Gmail après authentification"""
    code = request.args.get('code')
    state = request.args.get('state')
    
    if not code:
        return jsonify({'error': 'Code manquant'}), 400
    
    try:
        token_data = GmailOAuthService.exchange_code_for_tokens(code)
        
        if 'error' in token_data:
            return jsonify({'error': token_data.get('error_description', 'Erreur OAuth')}), 400
        
        contact_id = int(state) if state else None
        
        if contact_id:
            contact = Contact.query.get(contact_id)
            if contact:
                contact.oauth_provider = 'gmail'
                contact.oauth_refresh_token = GmailOAuthService._encrypt_token(token_data.get('refresh_token'))
                contact.oauth_email = token_data.get('email')
                contact.oauth_connected = True
                contact.oauth_expires_at = datetime.utcnow()
                db.session.commit()
                print(f"✅ Gmail connecté pour {contact.email}")
        
        return redirect('http://localhost:8080/appels-offres?oauth=success')
        
    except Exception as e:
        print(f"❌ Erreur OAuth: {e}")
        return redirect('http://localhost:8080/appels-offres?oauth=error')


@bp.route('/status/<int:contact_id>', methods=['GET'])
def get_contact_status(contact_id):
    """Vérifie le statut OAuth d'un contact"""
    contact = Contact.query.get(contact_id)
    if not contact:
        return jsonify({'connected': False, 'provider': None, 'email': None})
    
    return jsonify({
        'connected': contact.oauth_connected or False,
        'provider': contact.oauth_provider,
        'email': contact.oauth_email or contact.email
    })


@bp.route('/status/current', methods=['GET'])
@login_required
def get_current_user_status():
    """Vérifie si l'utilisateur courant a connecté son Gmail"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'connected': False, 'email': None})
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'connected': False, 'email': None})
    
    contact = Contact.query.filter_by(email=user.email).first()
    
    if not contact or not contact.oauth_connected:
        return jsonify({'connected': False, 'email': None})
    
    return jsonify({
        'connected': True,
        'email': contact.oauth_email or contact.email
    })


@bp.route('/disconnect/<int:contact_id>', methods=['POST'])
def disconnect_contact(contact_id):
    """Déconnecte le compte Gmail d'un contact"""
    contact = Contact.query.get(contact_id)
    if contact:
        contact.oauth_connected = False
        contact.oauth_refresh_token = None
        contact.oauth_email = None
        contact.oauth_expires_at = None
        db.session.commit()
        print(f"✅ Gmail déconnecté pour {contact.email}")
    
    return jsonify({'success': True})


@bp.route('/disconnect/current', methods=['POST'])
@login_required
def disconnect_current_user():
    """Déconnecte le compte Gmail de l'utilisateur courant"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Non authentifié'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Utilisateur non trouvé'}), 404
    
    contact = Contact.query.filter_by(email=user.email).first()
    
    if contact:
        contact.oauth_connected = False
        contact.oauth_refresh_token = None
        contact.oauth_email = None
        contact.oauth_expires_at = None
        db.session.commit()
        print(f"✅ Gmail déconnecté pour {user.email}")
    
    return jsonify({'success': True})


# ==================== ROUTES POUR LA CONFIGURATION GMAIL (ADMIN) ====================

@bp.route('/settings', methods=['GET'])
@login_required
@role_required('super_admin', 'manager')
def get_gmail_settings():
    """Récupère les paramètres Gmail depuis la base de données"""
    settings = GmailSettings.query.first()
    
    if not settings:
        return jsonify({
            'exists': False,
            'client_id': '',
            'redirect_uri': 'http://localhost:5000/api/gmail-auth/callback'
        })
    
    return jsonify({
        'exists': True,
        'client_id': settings.client_id,
        'redirect_uri': settings.redirect_uri or 'http://localhost:5000/api/gmail-auth/callback'
    })


@bp.route('/settings', methods=['POST'])
@login_required
@role_required('super_admin', 'manager')
def save_gmail_settings():
    """Sauvegarde les paramètres Gmail dans la base de données"""
    data = request.json
    
    if not data.get('client_id'):
        return jsonify({'error': 'Client ID est requis'}), 400
    
    settings = GmailSettings.query.first()
    
    if not settings:
        # CRÉATION d'une nouvelle configuration
        if not data.get('client_secret'):
            return jsonify({'error': 'Client Secret est requis pour la création'}), 400
        settings = GmailSettings()
        db.session.add(settings)
        settings.client_id = data['client_id']
        settings.set_client_secret(data['client_secret'])
        settings.redirect_uri = data.get('redirect_uri', 'http://localhost:5000/api/gmail-auth/callback')
    else:
        # MODIFICATION d'une configuration existante
        settings.client_id = data['client_id']
        # Ne mettre à jour le secret que s'il est fourni et non vide
        if data.get('client_secret') and data['client_secret'].strip():
            settings.set_client_secret(data['client_secret'])
        if data.get('redirect_uri'):
            settings.redirect_uri = data['redirect_uri']
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Paramètres Gmail sauvegardés'})


@bp.route('/settings', methods=['DELETE'])
@login_required
@role_required('super_admin', 'manager')
def delete_gmail_settings():
    """Supprime les paramètres Gmail de la base de données"""
    settings = GmailSettings.query.first()
    if settings:
        db.session.delete(settings)
        db.session.commit()
    
    return jsonify({'success': True, 'message': 'Paramètres Gmail supprimés'})