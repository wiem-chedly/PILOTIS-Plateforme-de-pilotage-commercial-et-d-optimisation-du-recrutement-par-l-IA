from cryptography.fernet import Fernet
import os

SECRET_KEY = "t5pod8weBjiRjfXA93i4RtD3wQ_S4R2r63zmp-uwXAQ="

print(f"Initialisation du chiffrement avec la clé: {SECRET_KEY[:10]}...")

# Initialiser le chiffrement
try:
    # Convertir la clé en bytes
    key_bytes = SECRET_KEY.encode('utf-8')
    
    # Créer le cipher
    cipher = Fernet(key_bytes)
    print("Chiffrement initialisé avec SUCCÈS !")
    
    # Test immédiat pour vérifier
    test = "test123"
    encrypted = cipher.encrypt(test.encode()).decode()
    decrypted = cipher.decrypt(encrypted.encode()).decode()
    
    if test == decrypted:
        print("TEST RÉUSSI : le chiffrement fonctionne parfaitement !")
        print(f"   Test: '{test}' => '{encrypted[:20]}...' => '{decrypted}'")
    else:
        print("TEST ÉCHOUÉ - Problème inattendu")
        
except Exception as e:
    print(f"ERREUR : {e}")
    cipher = None

def encrypt(text):
    """Chiffre un texte"""
    if not text or cipher is None:
        return text
    try:
        encrypted_bytes = cipher.encrypt(text.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')
    except Exception as e:
        print(f"Erreur chiffrement : {e}")
        return text

def decrypt(encrypted_text):
    """Déchiffre un texte"""
    if not encrypted_text or cipher is None:
        return encrypted_text
    try:
        decrypted_bytes = cipher.decrypt(encrypted_text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        print(f"Erreur déchiffrement : {e}")
        return encrypted_text