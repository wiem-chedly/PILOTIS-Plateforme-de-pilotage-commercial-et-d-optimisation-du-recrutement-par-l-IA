# app/services/gmail_oauth_service.py
import base64
import requests
import socket
import time
import ssl
import os
import urllib3
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import googleapiclient.discovery
from googleapiclient.errors import HttpError
from app.utils.encryption import encrypt, decrypt
from app.models.settings import GmailSettings

# ==================== CONFIGURATION SSL ET TIMEOUT ====================
ssl._create_default_https_context = ssl._create_unverified_context
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
socket.setdefaulttimeout(900)


class GmailOAuthService:
    
    @staticmethod
    def _get_settings():
        settings = GmailSettings.query.first()
        if not settings:
            raise Exception("Configuration Gmail non trouvée")
        return settings
    
    @staticmethod
    def _encrypt_token(token):
        if not token:
            return None
        try:
            return encrypt(token)
        except Exception as e:
            print(f"❌ Erreur chiffrement: {e}")
            return token
    
    @staticmethod
    def _decrypt_token(encrypted_token):
        if not encrypted_token:
            return None
        try:
            return decrypt(encrypted_token)
        except Exception as e:
            print(f"❌ Erreur déchiffrement: {e}")
            return encrypted_token
    
    @staticmethod
    def get_auth_url(contact_id):
        settings = GmailOAuthService._get_settings()
        client_id = settings.client_id
        redirect_uri = settings.redirect_uri or 'http://localhost:5000/api/gmail-auth/callback'
        
        url = (f"https://accounts.google.com/o/oauth2/v2/auth?"
               f"client_id={client_id}"
               f"&response_type=code"
               f"&redirect_uri={redirect_uri}"
               f"&scope=https://www.googleapis.com/auth/gmail.readonly email"
               f"&access_type=offline"
               f"&prompt=consent"
               f"&state={contact_id}")
        return url
    
    @staticmethod
    def exchange_code_for_tokens(code):
        settings = GmailOAuthService._get_settings()
        client_id = settings.client_id
        client_secret = settings.get_client_secret()
        redirect_uri = settings.redirect_uri or 'http://localhost:5000/api/gmail-auth/callback'
        
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        session = requests.Session()
        session.verify = False
        response = session.post(token_url, data=data, timeout=900)
        token_data = response.json()
        
        if 'access_token' in token_data:
            userinfo = session.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f"Bearer {token_data['access_token']}"},
                timeout=900
            )
            if userinfo.status_code == 200:
                token_data['email'] = userinfo.json().get('email')
        
        session.close()
        return token_data
    
    @staticmethod
    def refresh_access_token(refresh_token):
        settings = GmailOAuthService._get_settings()
        client_id = settings.client_id
        client_secret = settings.get_client_secret()
        
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            'refresh_token': refresh_token,
            'client_id': client_id,
            'client_secret': client_secret,
            'grant_type': 'refresh_token'
        }
        
        session = requests.Session()
        session.verify = False
        response = session.post(token_url, data=data, timeout=900)
        session.close()
        return response.json()
    
    @staticmethod
    def get_gmail_service(contact):
        """Construit le service Gmail API - Version sans authorize()"""
        from google.oauth2.credentials import Credentials as OAuth2Credentials
        from google.auth.transport.requests import Request
        
        refresh_token = GmailOAuthService._decrypt_token(contact.oauth_refresh_token) if contact.oauth_refresh_token else None
        
        if not refresh_token:
            raise Exception("Pas de refresh token pour ce contact")
        
        settings = GmailOAuthService._get_settings()
        
        # Créer les credentials
        creds = OAuth2Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.client_id,
            client_secret=settings.get_client_secret(),
            scopes=['https://www.googleapis.com/auth/gmail.readonly']
        )
        
        # Rafraîchir le token si nécessaire
        if creds.expired:
            creds.refresh(Request())
        
        # Construire le service - l'API gère l'authentification automatiquement
        service = googleapiclient.discovery.build(
            'gmail', 'v1', 
            credentials=creds,
            cache_discovery=False
        )
        
        return service
    
    @staticmethod
    def fetch_recent_emails(contact, max_results=10):
        """Récupère et traite les emails récents d'un contact avec pièces jointes"""
        try:
            service = GmailOAuthService.get_gmail_service(contact)
            scanned_email = contact.email
            
            print(f"   🔍 Scan du compte: {scanned_email}")
            
            # Rechercher les emails avec pièces jointes
            results = service.users().messages().list(
                userId='me',
                q='has:attachment',
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            emails = []
            
            for msg in messages:
                message = service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='full'
                ).execute()
                
                headers = message['payload'].get('headers', [])
                subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sans sujet')
                from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Inconnu')
                to_email = next((h['value'] for h in headers if h['name'] == 'To'), '')
                
                print(f"   📧 Message: {subject[:80]}..." if len(subject) > 80 else f"   📧 Message: {subject}")
                print(f"      De: {from_email}")
                print(f"      À: {to_email}")
                print(f"      Compte scanné: {scanned_email}")
                
                attachments_count = 0
                
                if 'parts' in message['payload']:
                    for part in message['payload']['parts']:
                        if part.get('filename') and part.get('body', {}).get('attachmentId'):
                            attachment_id = part['body']['attachmentId']
                            attachment = service.users().messages().attachments().get(
                                userId='me',
                                messageId=msg['id'],
                                id=attachment_id
                            ).execute()
                            
                            file_data = base64.urlsafe_b64decode(attachment['data'])
                            
                            from app.services.cv_processor import process_cv_from_gmail
                            process_cv_from_gmail(
                                attachment_data=file_data,
                                filename=part['filename'],
                                from_email=from_email,
                                to_email=to_email,
                                subject=subject,
                                scanned_email=scanned_email
                            )
                            attachments_count += 1
                
                emails.append({
                    'id': msg['id'],
                    'subject': subject,
                    'from': from_email,
                    'to': to_email,
                    'snippet': message.get('snippet', ''),
                    'attachments_count': attachments_count
                })
            
            return emails
            
        except HttpError as error:
            print(f"   ❌ Erreur Gmail API pour {contact.email}: {error}")
            if error.resp.status == 401:
                print(f"   🔑 Token expiré - Reconnexion nécessaire")
                contact.oauth_connected = False
                from app.extensions import db
                db.session.commit()
            return []
        except Exception as e:
            print(f"   ❌ Erreur pour {contact.email}: {e}")
            return []