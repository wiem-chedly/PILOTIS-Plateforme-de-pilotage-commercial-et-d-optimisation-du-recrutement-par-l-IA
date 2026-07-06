# app/models/users.py
from app.extensions import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users_pilotis'  
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Rôles valides: 'super_admin' | 'manager' | 'commercial'
    role = db.Column(db.String(50), nullable=False, default='commercial')
    
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relie l'utilisateur à son compte LinkedIn
    linkedin_account_id = db.Column(db.Integer, db.ForeignKey('linkedin_accounts.id'), nullable=True)
    linkedin_account = db.relationship('LinkedInAccount', backref='user', uselist=False)
    
    # SAAS MULTI-TENANT: relation vers la société
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    
    # Nom de l'entreprise du commercial/manager (pour filtrage direct)
    client_nom = db.Column(db.String(200), nullable=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        org_name = None
        if self.organization_id and self.organization:
            org_name = self.organization.name
        return {
            'id': self.id,
            'email': self.email,
            'role': self.role,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'organization_id': self.organization_id,
            'organization_name': org_name,
            'client_nom': self.client_nom,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self):
        return f"<User {self.email} ({self.role})>"