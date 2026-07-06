from functools import wraps
from flask import session, jsonify

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Non authentifié'}), 401
        return f(*args, **kwargs)
    return decorated_function

def role_required(*roles):
    """Vérifie que l'utilisateur a l'un des rôles autorisés."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_role' not in session:
                return jsonify({'error': 'Non authentifié'}), 401
            if session['user_role'] not in roles:
                return jsonify({'error': 'Accès interdit'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def config_access_required(f):
    """Bloque les commerciaux de la page config entière."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_role' not in session:
            return jsonify({'error': 'Non authentifié'}), 401
        if session['user_role'] == 'commercial':
            return jsonify({'error': 'Accès réservé aux managers et administrateurs'}), 403
        return f(*args, **kwargs)
    return decorated_function