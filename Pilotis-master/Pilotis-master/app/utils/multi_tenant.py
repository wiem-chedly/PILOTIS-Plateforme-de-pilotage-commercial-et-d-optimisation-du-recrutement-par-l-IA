"""
Utils pour le filtrage multi-tenant.
Gère la séparation des données par organisation (entreprise).
"""
from flask import session
from functools import wraps

def get_current_organization_id():
    """Retourne l'ID de l'organisation de l'utilisateur connecté"""
    return session.get('organization_id')

def get_current_user_role():
    """Retourne le rôle de l'utilisateur connecté"""
    return session.get('user_role')

def is_super_admin():
    """Vérifie si l'utilisateur est super_admin"""
    return session.get('user_role') == 'super_admin'

def is_manager():
    """Vérifie si l'utilisateur est manager"""
    return session.get('user_role') == 'manager'

def is_commercial():
    """Vérifie si l'utilisateur est commercial"""
    return session.get('user_role') == 'commercial'

def filter_by_organization(query, model, organization_column='organization_id'):
    """
    Filtre une requête SQLAlchemy selon l'organisation de l'utilisateur.
    - super_admin: voit tout (pas de filtre)
    - manager/commercial: voit uniquement les données de son organisation
    """
    user_role = get_current_user_role()
    org_id = get_current_organization_id()
    
    if user_role == 'super_admin':
        return query
    
    if org_id:
        return query.filter(getattr(model, organization_column) == org_id)
    
    return query.filter(False)

def get_organization_filter_condition(model, organization_column='organization_id'):
    """
    Retourne une condition de filtre pour les requêtes.
    Utile pour les jointures complexes.
    """
    user_role = get_current_user_role()
    org_id = get_current_organization_id()
    
    if user_role == 'super_admin':
        return None
    
    if org_id:
        return getattr(model, organization_column) == org_id
    
    return False


def tenant_required(f):
    """Décorateur pour les routes qui nécessitent une organisation"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not is_super_admin() and not get_current_organization_id():
            return jsonify({"error": "Aucune organisation associée à cet utilisateur"}), 403
        return f(*args, **kwargs)
    return decorated_function