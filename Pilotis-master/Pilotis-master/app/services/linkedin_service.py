import requests
import time
from app.models.settings import LinkedInAccount
from flask import current_app

def get_user_id_with_retry(access_token, max_retries=3):
    """Récupère l'ID LinkedIn à partir d'un token"""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    for attempt in range(max_retries):
        try:
            # Récupérer le profil utilisateur
            user_resp = requests.get(
                "https://api.linkedin.com/v2/userinfo",
                headers=headers,
                timeout=900
            )
            
            if user_resp.status_code == 200:
                return user_resp.json()["sub"], "person", None
            
            # Si ce n'est pas un profil utilisateur, peut-être une page ?
            return None, None, user_resp.text
            
        except requests.exceptions.ConnectionError as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                return None, None, str(e)
        except Exception as e:
            return None, None, str(e)
    
    return None, None, "Max retries exceeded"

def get_organization_urn(access_token):
    """Récupère l'URN de la page entreprise si le token a les droits"""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    try:
        # Récupérer les organisations associées au token
        org_resp = requests.get(
            "https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee",
            headers=headers,
            timeout=900
        )
        
        if org_resp.status_code == 200:
            data = org_resp.json()
            elements = data.get('elements', [])
            if elements:
                # Prendre la première organisation
                org_urn = elements[0].get('organizationalTarget')
                return org_urn, None
        return None, org_resp.text if org_resp.status_code != 200 else "Aucune organisation trouvée"
    except Exception as e:
        return None, str(e)

def post_to_linkedin(access_token, content, is_organization=False, organization_urn=None):
    """Publie sur LinkedIn (profil ou page entreprise)"""
    user_id, account_type, error = get_user_id_with_retry(access_token)
    
    if not user_id and not organization_urn:
        return False, error or "Impossible de récupérer l'identifiant"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
    }
    
    # Déterminer l'author (profil ou page)
    if is_organization and organization_urn:
        author = organization_urn
    else:
        author = f"urn:li:person:{user_id}"
    
    post_body = {
        "author": author,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": content},
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
    }
    
    post_resp = requests.post("https://api.linkedin.com/v2/ugcPosts", json=post_body, headers=headers)
    
    if post_resp.status_code == 201:
        post_urn = post_resp.headers.get('X-RestLi-Id', '')
        post_url = f"https://www.linkedin.com/feed/update/{post_urn}/" if post_urn else None
        return True, None, post_urn, post_url
    else:
        
        try:
            error_data = post_resp.json()
            # LinkedIn renvoie souvent une liste d'erreurs
            if 'message' in error_data:
                error_message = error_data['message']
            elif 'errors' in error_data and len(error_data['errors']) > 0:
                error_message = error_data['errors'][0].get('message', '')
                # Détection de DUPLICATE_POST dans le message ou le code
                if 'DUPLICATE_POST' in str(error_data):
                    error_message = "Ce post est un doublon d'une publication récente. Modifiez le contenu et réessayez."
            else:
                error_message = post_resp.text
        except:
            error_message = post_resp.text
        return False, error_message, None, None

def post_to_all_accounts(content):
    """Publie sur tous les comptes LinkedIn enregistrés"""
    print("\n" + "="*60)
    print("🚀 DÉBUT DE LA PUBLICATION MULTI-COMPTES")
    print("="*60)
    
    accounts = LinkedInAccount.query.all()
    print(f"📊 Nombre de comptes trouvés dans la base : {len(accounts)}")
    
    if len(accounts) == 0:
        print("❌ AUCUN COMPTE TROUVÉ ! Vérifiez la table linkedin_accounts")
        print("="*60)
        return []
    
    results = []
    
    for i, account in enumerate(accounts):
        print(f"\n--- COMPTE {i+1}/{len(accounts)} ---")
        print(f"📝 Nom du compte : {account.name}")
        print(f"🆔 ID : {account.id}")
        
        # DÉCHIFFRER LE TOKEN AVANT DE L'UTILISER
        token_dechiffre = account.get_token()
        print(f"🔑 Début du token déchiffré : {token_dechiffre[:30]}..." if token_dechiffre else "❌ Token vide")
        print(f"📅 Créé le : {account.created_at}")
        
        # Vérifier si c'est une page entreprise
        is_organization = "page" in account.name.lower() or "omicrone" in account.name.lower()
        print(f"🏷️ Type : {'Page entreprise' if is_organization else 'Profil personnel'}")
        
        # Récupérer l'URN de l'organisation si nécessaire
        organization_urn = None
        if is_organization:
            print(f"🔍 Récupération de l'URN de la page...")
            organization_urn, error = get_organization_urn(token_dechiffre)  # ← UTILISER LE TOKEN DÉCHIFFRÉ
            if error:
                print(f"❌ Erreur récupération page : {error}")
                results.append({
                    "account_id": account.id,
                    "account_name": account.name,
                    "success": False,
                    "error": f"Erreur récupération page: {error}"
                })
                continue
            else:
                print(f"✅ URN récupérée : {organization_urn}")
        
        # Publier avec le token déchiffré
        print(f"📤 Envoi du post à l'API LinkedIn...")
        success, error = post_to_linkedin(
            token_dechiffre,  
            content, 
            is_organization=is_organization,
            organization_urn=organization_urn
        )
        
        if success:
            print(f"✅ SUCCÈS ! Post publié sur {account.name}")
        else:
            print(f"❌ ÉCHEC : {error}")
        
        results.append({
            "account_id": account.id,
            "account_name": account.name,
            "success": success,
            "error": error
        })
    
    successes = sum(1 for r in results if r["success"])
    print("\n" + "="*60)
    print(f"📊 RÉSULTAT FINAL : {successes}/{len(results)} succès")
    print("="*60)
    
    return results