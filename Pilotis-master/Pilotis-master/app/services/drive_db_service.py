# app/services/drive_db_service.py
import os
import io
import json
import urllib.parse
import secrets
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from app.models.settings import DriveCredentials, DriveToken
from app.extensions import db
from app.utils.encryption import encrypt, decrypt


class DriveDBService:
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    @classmethod
    def _get_credentials(cls):
        """Récupère les credentials depuis la BDD"""
        creds_record = DriveCredentials.query.first()
        if not creds_record:
            raise Exception("Aucune configuration Google Drive trouvée en BDD")
        
        token_record = DriveToken.query.first()
        if not token_record:
            raise Exception("Aucun token Google Drive trouvé")
        
        token_data = token_record.get_token()
        if not token_data:
            raise Exception("Token invalide")
        
        creds = Credentials(
            token=token_data.get('token'),
            refresh_token=token_data.get('refresh_token'),
            token_uri=token_data.get('token_uri') or creds_record.token_uri,
            client_id=creds_record.client_id,
            client_secret=creds_record.get_client_secret(),
            scopes=cls.SCOPES
        )
        
        # Rafraîchir si expiré
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            cls._save_token(creds)
        
        return creds
    
    @classmethod
    def _save_token(cls, creds):
        """Sauvegarde le token en BDD"""
        token_data = {
            'token': creds.token,
            'refresh_token': creds.refresh_token,
            'token_uri': creds.token_uri,
            'client_id': creds.client_id,
            'client_secret': creds.client_secret,
            'scopes': creds.scopes,
            'expiry': creds.expiry.isoformat() if creds.expiry else None
        }
        
        token_record = DriveToken.query.first()
        if token_record:
            token_record.set_token(token_data)
            token_record.expires_at = creds.expiry
            token_record.updated_at = datetime.utcnow()
        else:
            token_record = DriveToken(
                expires_at=creds.expiry
            )
            token_record.set_token(token_data)
            db.session.add(token_record)
        
        db.session.commit()
        print("✅ Token Drive sauvegardé en BDD")
    
    @classmethod
    def save_credentials(cls, client_id, client_secret, project_id=None, folder_id=None, auth_uri=None, token_uri=None):
        """Sauvegarde les credentials en BDD avec l'ID du dossier"""
        creds_record = DriveCredentials.query.first()
        if creds_record:
            creds_record.client_id = client_id
            creds_record.set_client_secret(client_secret)
            creds_record.project_id = project_id
            if folder_id:
                creds_record.folder_id = folder_id
            if auth_uri:
                creds_record.auth_uri = auth_uri
            if token_uri:
                creds_record.token_uri = token_uri
        else:
            creds_record = DriveCredentials(
                client_id=client_id,
                project_id=project_id,
                folder_id=folder_id,
                auth_uri=auth_uri or "https://accounts.google.com/o/oauth2/auth",
                token_uri=token_uri or "https://oauth2.googleapis.com/token"
            )
            creds_record.set_client_secret(client_secret)
            db.session.add(creds_record)
        
        db.session.commit()
        print("✅ Credentials Drive sauvegardés en BDD")
        return creds_record
    
    @classmethod
    def clear_token(cls):
        """Supprime le token (déconnexion)"""
        DriveToken.query.delete()
        db.session.commit()
        print("🗑️ Token Drive supprimé de la BDD")
    
    @classmethod
    def clear_credentials(cls):
        """Supprime toutes les credentials (réinitialisation complète)"""
        DriveCredentials.query.delete()
        DriveToken.query.delete()
        db.session.commit()
        print("🗑️ Toutes les données Drive supprimées de la BDD")
    
    @classmethod
    def is_configured(cls):
        """Vérifie si Drive est configuré"""
        creds = DriveCredentials.query.first()
        token = DriveToken.query.first()
        return creds is not None and token is not None
    
    @classmethod
    def get_folder_id(cls):
        """Récupère l'ID du dossier Drive depuis la BDD ou .env"""
        creds_record = DriveCredentials.query.first()
        if creds_record and creds_record.folder_id:
            return creds_record.folder_id
        
        # Fallback sur .env
        folder_id = os.getenv("GOOGLE_DRIVE_CV_FOLDER_ID")
        if not folder_id:
            raise Exception("Aucun ID de dossier Drive configuré")
        return folder_id
    
    @classmethod
    def file_exists_by_hash(cls, file_hash, folder_id=None):
        """Vérifie si un fichier avec le même hash existe déjà dans le dossier Drive"""
        creds = cls._get_credentials()
        service = build('drive', 'v3', credentials=creds)
        target_folder = folder_id if folder_id else cls.get_folder_id()
        
        response = service.files().list(
            q=f"'{target_folder}' in parents and trashed=false",
            fields='files(id, name, webViewLink, md5Checksum)',
            pageSize=100
        ).execute()
        
        files = response.get('files', [])
        for file in files:
            if file.get('md5Checksum') == file_hash:
                return file
        
        return None
    
    @classmethod
    def upload_file(cls, file_content, filename, mime_type='application/pdf', folder_id=None):
        """Upload un fichier vers Google Drive"""
        creds = cls._get_credentials()
        service = build('drive', 'v3', credentials=creds)
        
        target_folder = folder_id if folder_id else cls.get_folder_id()
        
        file_metadata = {
            'name': filename,
            'parents': [target_folder]
        }
        
        media = MediaIoBaseUpload(
            io.BytesIO(file_content),
            mimetype=mime_type,
            resumable=True
        )
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,webViewLink,md5Checksum'
        ).execute()
        
        return {
            'drive_file_id': file.get('id'),
            'drive_link': file.get('webViewLink'),
            'md5Checksum': file.get('md5Checksum')
        }
    
    @classmethod
    def download_file(cls, file_id):
        """Télécharge un fichier depuis Google Drive"""
        creds = cls._get_credentials()
        service = build('drive', 'v3', credentials=creds)
        
        request = service.files().get_media(fileId=file_id)
        file_content = io.BytesIO()
        downloader = MediaIoBaseDownload(file_content, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        return file_content.getvalue()
    
    @classmethod
    def get_auth_url(cls, redirect_uri="http://localhost:5000/api/drive/callback"):
        """Génère l'URL d'authentification OAuth avec un état aléatoire"""
        creds_record = DriveCredentials.query.first()
        if not creds_record:
            raise Exception("Aucune configuration Drive trouvée")
        
        client_secret = creds_record.get_client_secret()
        if not client_secret:
            raise Exception("Client secret non configuré")
        
        # Générer un état aléatoire sécurisé
        state = secrets.token_urlsafe(32)
        
        # Paramètres OAuth requis
        params = {
            'client_id': creds_record.client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(cls.SCOPES),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state
        }
        
        # Construire l'URL
        auth_url = "https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode(params)
        
        print(f"🔑 URL d'authentification générée")
        print(f"   Client ID: {creds_record.client_id[:30]}...")
        print(f"   Redirect URI: {redirect_uri}")
        print(f"   State: {state[:20]}...")
        
        return auth_url, state
    
    @classmethod
    def exchange_code(cls, code, redirect_uri="http://localhost:5000/api/drive/callback"):
        """Échange le code d'autorisation contre un token"""
        import requests
        
        creds_record = DriveCredentials.query.first()
        if not creds_record:
            raise Exception("Aucune configuration Drive trouvée")
        
        client_secret = creds_record.get_client_secret()
        if not client_secret:
            raise Exception("Client secret non configuré")
        
        # Préparer la requête token
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            'code': code,
            'client_id': creds_record.client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        print(f"🔄 Échange du code contre un token...")
        
        response = requests.post(token_url, data=data)
        
        if response.status_code != 200:
            error_data = response.json()
            print(f"❌ Erreur échange token: {error_data}")
            raise Exception(f"Erreur échange token: {error_data.get('error_description', 'Unknown error')}")
        
        token_data = response.json()
        
        # Créer un objet credentials
        creds = Credentials(
            token=token_data.get('access_token'),
            refresh_token=token_data.get('refresh_token'),
            token_uri=token_url,
            client_id=creds_record.client_id,
            client_secret=client_secret,
            scopes=cls.SCOPES
        )
        
        # Sauvegarder le token
        cls._save_token(creds)
        print("✅ Token OAuth sauvegardé avec succès")
        
        return creds