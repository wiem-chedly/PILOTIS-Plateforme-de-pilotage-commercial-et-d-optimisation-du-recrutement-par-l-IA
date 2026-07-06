import time
from functools import wraps
from flask import request

_route_cache = {}

def cache_route(timeout_seconds=300):
    """
    Décorateur simple pour cacher les réponses JSON des routes Flask.
    Utilise l'URL complète (avec paramètres GET) comme clé.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Ne cache que les requêtes GET
            if request.method != "GET":
                return f(*args, **kwargs)

            cache_key = request.url
            current_time = time.time()

            # Vérifier si on a un cache valide
            if cache_key in _route_cache:
                entry = _route_cache[cache_key]
                if current_time - entry['time'] < timeout_seconds:
                    # Renvoyer la réponse cachée (c'est déjà un tuple ou un objet Response)
                    return entry['response']
                else:
                    # Expiré
                    del _route_cache[cache_key]

            # Exécuter la fonction réelle
            response = f(*args, **kwargs)

            # Mettre en cache (uniquement si le code HTTP est 200)
            if hasattr(response, "status_code") and getattr(response, "status_code") == 200:
                _route_cache[cache_key] = {
                    'response': response,
                    'time': current_time
                }
            elif isinstance(response, tuple) and len(response) == 2 and response[1] == 200:
                _route_cache[cache_key] = {
                    'response': response,
                    'time': current_time
                }
            elif not hasattr(response, "status_code") and not isinstance(response, tuple):
                 # Flask jsonify returns Response object which has status_code, but if it returns a string/dict
                 # flask auto-wraps it later. Usually APIs return jsonify()
                _route_cache[cache_key] = {
                    'response': response,
                    'time': current_time
                }

            return response
        return decorated_function
    return decorator
