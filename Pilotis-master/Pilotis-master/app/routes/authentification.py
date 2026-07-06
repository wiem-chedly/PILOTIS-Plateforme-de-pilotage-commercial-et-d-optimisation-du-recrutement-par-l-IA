from flask import Blueprint, request, jsonify, session
from app.models.users import User
from app.models.organization import Organization
from app.models.settings import LinkedInAccount
from app.extensions import db
from app.utils.authentification import login_required, role_required

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

import re

def is_valid_email(email):
    pattern = r"^[^@]+@[^@]+\.[^@]+$"
    return re.match(pattern, email) is not None

# ---------------------------------------------------------------------------
# PUBLIC — Register (gardé pour la transition)
# ---------------------------------------------------------------------------
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email et mot de passe requis'}), 400
    
    email = data['email']
    password = data['password']
    
    if not is_valid_email(email):
        return jsonify({'error': "Le format de l'email est invalide"}), 400
        
    if len(password) < 6:
        return jsonify({'error': 'Le mot de passe doit contenir au moins 6 caractères'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Un compte existe déjà avec cette adresse email.'}), 400
    
    user = User(
        email=email,
        role=data.get('role', 'commercial')
    )
    user.set_password(password)
    
    linkedin_account = LinkedInAccount.query.filter_by(email=email).first()
    if linkedin_account:
        user.linkedin_account_id = linkedin_account.id
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Compte créé'}), 201

# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email et mot de passe requis'}), 400
    
    email = data['email']
    password = data['password']
    
    if not is_valid_email(email):
        return jsonify({'error': "Le format de l'email est invalide"}), 400
        
    if len(password) < 6:
        return jsonify({'error': 'Le mot de passe doit contenir au moins 6 caractères'}), 400
    
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': "Aucun compte n'est associé à cette adresse email."}), 404
        
    if not user.check_password(password):
        return jsonify({'error': 'Le mot de passe est incorrect.'}), 401
    
    # Récupérer le nom de l'organisation si applicable
    org_name = None
    if user.organization_id:
        org = Organization.query.get(user.organization_id)
        if org:
            org_name = org.name
    
    session['user_id'] = user.id
    session['user_role'] = user.role
    session['organization_id'] = user.organization_id
    session.permanent = True
    
    has_token = False
    if user.linkedin_account_id:
        account = LinkedInAccount.query.get(user.linkedin_account_id)
        if account:
            has_token = account.get_token() is not None
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'organization_id': user.organization_id,
            'organization_name': org_name,
            'linkedin_account_id': user.linkedin_account_id,
            'has_token': has_token
        }
    })

# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------
@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------
@auth_bp.route('/me', methods=['GET'])
def me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Non connecté'}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    
    org_name = None
    if user.organization_id:
        org = Organization.query.get(user.organization_id)
        if org:
            org_name = org.name
    
    has_token = False
    if user.linkedin_account_id:
        account = LinkedInAccount.query.get(user.linkedin_account_id)
        if account:
            has_token = account.get_token() is not None
    
    return jsonify({
        'id': user.id,
        'email': user.email,
        'role': user.role,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'organization_id': user.organization_id,
        'organization_name': org_name,
        'linkedin_account_id': user.linkedin_account_id,
        'has_token': has_token
    })

# ---------------------------------------------------------------------------
# Admin / Manager — Gestion des utilisateurs
# ---------------------------------------------------------------------------

@auth_bp.route('/admin/users', methods=['GET'])
@login_required
@role_required('super_admin', 'manager', 'commercial')
def admin_list_users():
    """
    super_admin → tous les utilisateurs
    manager/commercial → les membres de leur organisation
    """
    current_role = session.get('user_role')
    current_org = session.get('organization_id')

    if current_role == 'super_admin':
        # Afficher tous les utilisateurs (managers et commerciaux)
        users = User.query.all()
    else:
        # Manager ou Commercial : afficher tous les membres de son org (managers et commerciaux)
        users = User.query.filter(
            User.role.in_(['manager', 'commercial']),
            User.organization_id == current_org
        ).all()

    return jsonify([u.to_dict() for u in users])


@auth_bp.route('/admin/users', methods=['POST'])
@login_required
@role_required('super_admin', 'manager')
def admin_create_user():
    """
    super_admin → crée un manager pour une organisation existante
    manager     → crée un commercial dans son organisation
    """
    data = request.json
    current_role = session.get('user_role')
    current_org_id = session.get('organization_id')

    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name', '')
    last_name = data.get('last_name', '')

    if not email or not password:
        return jsonify({'error': 'Email et mot de passe requis'}), 400
    if not is_valid_email(email):
        return jsonify({'error': 'Format email invalide'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Mot de passe trop court (min 6 caractères)'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Cet email est déjà utilisé'}), 400

    if current_role == 'super_admin':
        role = data.get('role', 'manager')
        if role not in ['super_admin', 'manager', 'commercial']:
            return jsonify({'error': 'Rôle invalide'}), 400
        org_id = data.get('organization_id')
        if role in ['manager', 'commercial'] and not org_id:
            if role == 'manager':
                return jsonify({'error': 'L\'entreprise est obligatoire pour un manager'}), 400
            else:
                return jsonify({'error': 'L\'entreprise est obligatoire pour un commercial'}), 400
    else:
        # Manager : créer manager ou commercial dans son org
        role = data.get('role', 'commercial')
        if role not in ['manager', 'commercial']:
            return jsonify({'error': 'Rôle invalide'}), 400
        org_id = current_org_id
        if not org_id:
            if role == 'manager':
                return jsonify({'error': 'L\'entreprise est obligatoire pour un manager'}), 400
            else:
                return jsonify({'error': 'L\'entreprise est obligatoire pour un commercial'}), 400

    user = User(
        email=email,
        role=role,
        first_name=first_name,
        last_name=last_name,
        organization_id=org_id
    )
    user.set_password(password)

    linkedin_account = LinkedInAccount.query.filter_by(email=email).first()
    if linkedin_account:
        user.linkedin_account_id = linkedin_account.id

    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Compte {role} créé', 'user': user.to_dict()}), 201


@auth_bp.route('/admin/users/<int:user_id>', methods=['PUT'])
@login_required
@role_required('super_admin', 'manager')
def admin_update_user(user_id):
    """Modifier le rôle ou les infos d'un utilisateur"""
    data = request.json
    current_role = session.get('user_role')
    current_org = session.get('organization_id')

    target = User.query.get(user_id)
    if not target:
        return jsonify({'error': 'Utilisateur non trouvé'}), 404

    # Empêcher autosuppression
    if target.id == session.get('user_id'):
        return jsonify({'error': 'Vous ne pouvez pas modifier votre propre compte'}), 403

    # Manager : vérifier que la cible est bien dans son org
    if current_role == 'manager':
        if target.organization_id != current_org:
            return jsonify({'error': 'Accès interdit — utilisateur hors de votre organisation'}), 403
        if target.role not in ['commercial', 'manager']:
            return jsonify({'error': 'Vous ne pouvez modifier que des utilisateurs de votre organisation'}), 403

    # Mettre à jour les champs autorisés
    if 'email' in data:
        new_email = data['email']
        if not is_valid_email(new_email):
            return jsonify({'error': 'Format email invalide'}), 400
        existing = User.query.filter_by(email=new_email).first()
        if existing and existing.id != target.id:
            return jsonify({'error': 'Cet email est déjà utilisé'}), 400
        target.email = new_email
    if 'first_name' in data:
        target.first_name = data['first_name']
    if 'last_name' in data:
        target.last_name = data['last_name']
    if 'role' in data and current_role == 'super_admin':
        new_role = data['role']
        if new_role not in ['super_admin', 'manager', 'commercial']:
            return jsonify({'error': 'Rôle invalide'}), 400
        target.role = new_role
    if 'organization_id' in data and current_role == 'super_admin':
        target.organization_id = data['organization_id']

    db.session.commit()
    return jsonify({'success': True, 'message': f'Utilisateur {target.email} mis à jour'})


@auth_bp.route('/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
@role_required('super_admin', 'manager')
def admin_delete_user(user_id):
    """Supprimer un utilisateur"""
    current_role = session.get('user_role')
    current_org = session.get('organization_id')

    target = User.query.get(user_id)
    if not target:
        return jsonify({'error': 'Utilisateur non trouvé'}), 404

    if target.id == session.get('user_id'):
        return jsonify({'error': 'Vous ne pouvez pas supprimer votre propre compte'}), 403

    # Manager : peut supprimer membres de son org
    if current_role == 'manager':
        if target.organization_id != current_org:
            return jsonify({'error': 'Accès interdit — utilisateur hors de votre organisation'}), 403
        if target.role not in ['commercial', 'manager']:
            return jsonify({'error': 'Vous ne pouvez supprimer que des utilisateurs de votre organisation'}), 403

    db.session.delete(target)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Utilisateur {target.email} supprimé'})


# ---------------------------------------------------------------------------
# Super Admin — liste des organisations (pour créer un manager lié)
# ---------------------------------------------------------------------------
@auth_bp.route('/admin/organizations', methods=['GET'])
@login_required
@role_required('super_admin')
def list_organizations():
    """Liste toutes les organisations (pour le super_admin)"""
    from app.models.organization import Organization
    orgs = Organization.query.all()
    return jsonify([{
        'id': o.id,
        'name': o.name,
        'email': o.email,
        'website': o.website,
        'sector': o.sector,
        'created_at': o.created_at.isoformat() if o.created_at else None,
    } for o in orgs])

@auth_bp.route('/admin/organizations/<int:org_id>', methods=['PUT'])
@login_required
@role_required('super_admin')
def update_organization(org_id):
    """Modifier une entreprise (pour le super_admin)"""
    from app.models.organization import Organization
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organisation introuvable.'}), 404

    data = request.json
    if 'name' in data:
        org.name = data['name']
    if 'email' in data:
        org.email = data['email']
    if 'website' in data:
        org.website = data['website']
    if 'sector' in data:
        org.sector = data['sector']
    if 'phone' in data:
        org.phone = data['phone']
    if 'address' in data:
        org.address = data['address']

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Organisation "{org.name}" mise à jour.',
        'organization': {
            'id': org.id,
            'name': org.name,
            'email': org.email,
            'website': org.website,
            'sector': org.sector,
            'phone': org.phone,
            'address': org.address,
            'created_at': org.created_at.isoformat() if org.created_at else None,
        }
    })

@auth_bp.route('/admin/organizations/<int:org_id>', methods=['DELETE'])
@login_required
@role_required('super_admin')
def delete_organization(org_id):
    """Supprime une entreprise et tous ses utilisateurs associes (pour le super_admin)"""
    from app.models.organization import Organization
    from app.models.users import User
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'error': 'Organisation introuvable.'}), 404

    org_name = org.name
    user_count = User.query.filter_by(organization_id=org_id).count()

    # La suppression en cascade (all, delete-orphan) supprime automatiquement les users lies
    db.session.delete(org)
    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'Organisation "{org_name}" supprimee avec {user_count} utilisateur(s) associe(s).'
    })