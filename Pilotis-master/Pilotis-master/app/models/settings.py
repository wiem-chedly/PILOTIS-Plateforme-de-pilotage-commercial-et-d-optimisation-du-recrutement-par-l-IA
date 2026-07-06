# app/models/settings.py
from app.extensions import db
from datetime import datetime
from app.utils.encryption import encrypt, decrypt

class AppSetting(db.Model):
    __tablename__ = 'app_settings'
    
    key = db.Column(db.String(255), primary_key=True)
    value = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    SENSITIVE_KEYS = ['boond_client_key', 'boond_client_token', 'boond_user_token']

    def get_value(self):
        if self.key in self.SENSITIVE_KEYS and self.value:
            try:
                return decrypt(self.value)
            except Exception as e:
                print(f"❌ Erreur déchiffrement {self.key}: {e}")
                return self.value
        return self.value

    def set_value(self, new_value):
        if self.key in self.SENSITIVE_KEYS and new_value:
            try:
                self.value = encrypt(new_value)
            except Exception as e:
                print(f"❌ Erreur chiffrement {self.key}: {e}")
                self.value = new_value
        else:
            self.value = new_value

    def __repr__(self):
        return f"<AppSetting {self.key}>"


class LinkedInAccount(db.Model):
    __tablename__ = 'linkedin_accounts'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    access_token = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    email = db.Column(db.String(255), nullable=True)  
    notify_enabled = db.Column(db.Boolean, default=True)
    notify_by_email = db.Column(db.Boolean, default=True)
    notify_in_app = db.Column(db.Boolean, default=True)

    def get_token(self):
        if self.access_token:
            try:
                decrypted = decrypt(self.access_token)
                if decrypted == "None" or decrypted == "":
                    return None
                return decrypted
            except Exception as e:
                print(f"❌ Erreur déchiffrement token LinkedIn {self.name}: {e}")
                return self.access_token
        return None

    def set_token(self, raw_token):
        if raw_token:
            try:
                self.access_token = encrypt(raw_token)
            except Exception as e:
                print(f"❌ Erreur chiffrement token LinkedIn {self.name}: {e}")
                self.access_token = raw_token
        else:
            self.access_token = None

    def __repr__(self):
        return f"<LinkedInAccount {self.name}>"


class LinkedInSettings(db.Model):
    """Paramètres de l'application LinkedIn (OAuth)"""
    __tablename__ = 'linkedin_settings'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(255), nullable=False)
    client_secret = db.Column(db.Text, nullable=False)  # chiffré
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_client_secret(self):
        """Déchiffre le client secret"""
        if self.client_secret:
            try:
                return decrypt(self.client_secret)
            except Exception as e:
                print(f"❌ Erreur déchiffrement client secret LinkedIn: {e}")
                return self.client_secret
        return None

    def set_client_secret(self, raw_secret):
        """Chiffre et stocke le client secret"""
        if raw_secret:
            try:
                self.client_secret = encrypt(raw_secret)
            except Exception as e:
                print(f"❌ Erreur chiffrement client secret LinkedIn: {e}")
                self.client_secret = raw_secret
        else:
            self.client_secret = None

    def __repr__(self):
        return f"<LinkedInSettings id={self.id}>"


class EmailSettings(db.Model):
    """Paramètres d'envoi d'email (SMTP)"""
    __tablename__ = 'email_settings'

    id = db.Column(db.Integer, primary_key=True)
    server = db.Column(db.String(255), nullable=False, default='smtp.gmail.com')
    port = db.Column(db.Integer, nullable=False, default=587)
    use_tls = db.Column(db.Boolean, default=True)
    username = db.Column(db.String(255), nullable=False)
    password = db.Column(db.Text, nullable=False)  # chiffré
    default_sender = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_password(self):
        """Déchiffre le mot de passe"""
        if self.password:
            try:
                return decrypt(self.password)
            except Exception as e:
                print(f"❌ Erreur déchiffrement mot de passe email: {e}")
                return self.password
        return None

    def set_password(self, raw_password):
        """Chiffre et stocke le mot de passe"""
        if raw_password:
            try:
                self.password = encrypt(raw_password)
            except Exception as e:
                print(f"❌ Erreur chiffrement mot de passe email: {e}")
                self.password = raw_password
        else:
            self.password = None

    def __repr__(self):
        return f'<EmailSettings id={self.id}>'


# ── Modèles Wiem — Gmail OAuth ──────────────────────────────────────────────

class GmailSettings(db.Model):
    """Paramètres OAuth Gmail pour la réception automatique de CVs"""
    __tablename__ = 'gmail_settings'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Text, nullable=True)
    client_secret = db.Column(db.Text, nullable=True)  # Chiffré
    redirect_uri = db.Column(db.Text, nullable=True)
    access_token = db.Column(db.Text, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expiry = db.Column(db.DateTime, nullable=True)
    email = db.Column(db.String(255), nullable=True)
    is_connected = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_client_secret(self):
        """Déchiffre le client secret"""
        if self.client_secret:
            try:
                return decrypt(self.client_secret)
            except Exception as e:
                print(f"❌ Erreur déchiffrement client secret Gmail: {e}")
                return self.client_secret
        return None

    def set_client_secret(self, raw_secret):
        """Chiffre et stocke le client secret"""
        if raw_secret:
            try:
                self.client_secret = encrypt(raw_secret)
            except Exception as e:
                print(f"❌ Erreur chiffrement client secret Gmail: {e}")
                self.client_secret = raw_secret
        else:
            self.client_secret = None

    def __repr__(self):
        return f'<GmailSettings email={self.email}>'


# ── Modèles Wiem — Google Drive ─────────────────────────────────────────────

class DriveCredentials(db.Model):
    """Credentials OAuth Google Drive"""
    __tablename__ = 'drive_credentials'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Text, nullable=True)
    client_secret = db.Column(db.Text, nullable=True)  # Chiffré
    project_id = db.Column(db.String(255), nullable=True)
    folder_id = db.Column(db.String(255), nullable=True)
    auth_uri = db.Column(db.Text, default='https://accounts.google.com/o/oauth2/auth')
    token_uri = db.Column(db.Text, default='https://oauth2.googleapis.com/token')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_client_secret(self):
        """Déchiffre le client secret"""
        if self.client_secret:
            try:
                return decrypt(self.client_secret)
            except Exception as e:
                print(f"❌ Erreur déchiffrement client secret Drive: {e}")
                return self.client_secret
        return None

    def set_client_secret(self, raw_secret):
        """Chiffre et stocke le client secret"""
        if raw_secret:
            try:
                self.client_secret = encrypt(raw_secret)
            except Exception as e:
                print(f"❌ Erreur chiffrement client secret Drive: {e}")
                self.client_secret = raw_secret
        else:
            self.client_secret = None

    def __repr__(self):
        return f'<DriveCredentials project={self.project_id}>'


class DriveToken(db.Model):
    """Token OAuth Google Drive stocké en base"""
    __tablename__ = 'drive_tokens'

    id = db.Column(db.Integer, primary_key=True)
    token_data = db.Column(db.Text, nullable=True)  # JSON chiffré (utilisé par DriveDBService)
    # Colonnes legacy compatibles
    token = db.Column(db.Text, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    token_uri = db.Column(db.Text, nullable=True)
    client_id = db.Column(db.Text, nullable=True)
    client_secret = db.Column(db.Text, nullable=True)
    scopes = db.Column(db.Text, nullable=True)
    expiry = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_token(self):
        """Déchiffre et retourne le token sous forme de dict"""
        if self.token_data:
            try:
                import json
                return json.loads(decrypt(self.token_data))
            except Exception as e:
                print(f"❌ Erreur déchiffrement token Drive: {e}")
                return None
        return None

    def set_token(self, token_dict):
        """Chiffre et stocke le token"""
        if token_dict:
            try:
                import json
                self.token_data = encrypt(json.dumps(token_dict, default=str))
            except Exception as e:
                print(f"❌ Erreur chiffrement token Drive: {e}")
                self.token_data = None
        else:
            self.token_data = None

    def __repr__(self):
        return f'<DriveToken id={self.id}>'