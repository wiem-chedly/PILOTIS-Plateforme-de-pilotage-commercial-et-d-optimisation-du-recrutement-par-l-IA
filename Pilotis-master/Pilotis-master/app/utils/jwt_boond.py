import base64
import json
import hmac
import hashlib
import time

def base64url_encode(data):
    """
    Encode en base64 URL-safe (sans les caractères spéciaux)
    Utilisé par JWT
    """
    if isinstance(data, dict):
        data = json.dumps(data, separators=(',', ':'))
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    # Encodage base64 standard
    encoded = base64.b64encode(data)
    # Remplacer + et / par - et _ (pour URL-safe)
    encoded = encoded.replace(b'+', b'-').replace(b'/', b'_')
    # Enlever le padding =
    encoded = encoded.rstrip(b'=')
    
    return encoded.decode('utf-8')

def generate_boond_jwt(client_key, client_token, user_token):
    """
    Génère le token JWT pour le header X-Jwt-Client-Boondmanager
    
    Args:
        client_key: La clé client (pour signer)
        client_token: Le token client
        user_token: Le token utilisateur
    
    Returns:
        str: Le token JWT complet
    """
    # 1. Créer le header (partie 1)
    header = {
        "alg": "HS256",
        "typ": "JWT"
    }
    header_b64 = base64url_encode(header)
    
    # 2. Créer le payload avec les tokens (partie 2)
    payload = {
        "userToken": user_token,
        "clientToken": client_token,
        "time": int(time.time()),  # Timestamp actuel en secondes
        "mode": "normal"
    }
    payload_b64 = base64url_encode(payload)
    
    # 3. Créer la signature (partie 3)
    message = f"{header_b64}.{payload_b64}"
    
    # Signer avec HMAC SHA256 en utilisant client_key comme clé
    signature = hmac.new(
        key=client_key.encode('utf-8'),
        msg=message.encode('utf-8'),
        digestmod=hashlib.sha256
    ).digest()
    
    signature_b64 = base64url_encode(signature)
    
    # 4. Assembler le token complet
    jwt_token = f"{header_b64}.{payload_b64}.{signature_b64}"
    
    return jwt_token


# Fonction de test pour vérifier
if __name__ == "__main__":
    # Test avec des valeurs d'exemple
    test_token = generate_boond_jwt(
        "test_client_key",
        "test_client_token", 
        "test_user_token"
    )
    print(f"🔐 Token JWT de test: {test_token}")