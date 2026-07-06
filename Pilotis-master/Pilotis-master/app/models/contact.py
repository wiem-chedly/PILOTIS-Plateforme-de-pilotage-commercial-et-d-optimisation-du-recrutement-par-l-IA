from datetime import datetime
from app.extensions import db

class Contact(db.Model):
    __tablename__ = 'contacts'
    
    id_contact = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    organization = db.relationship('Organization', backref='contacts')

    # Champs OAuth pour la connexion Gmail
    oauth_provider = db.Column(db.String(50), nullable=True)
    oauth_refresh_token = db.Column(db.String(500), nullable=True)
    oauth_email = db.Column(db.String(255), nullable=True)
    oauth_connected = db.Column(db.Boolean, default=False)
    oauth_expires_at = db.Column(db.DateTime, nullable=True)
    last_scan_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f"<Contact {self.name} ({self.email})>"