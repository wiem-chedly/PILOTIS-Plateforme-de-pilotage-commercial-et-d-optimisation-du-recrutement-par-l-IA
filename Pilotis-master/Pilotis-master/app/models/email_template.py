# app/models/email_template.py

from app.extensions import db
from datetime import datetime

class EmailTemplate(db.Model):
    __tablename__ = 'email_templates'
    
    id_template = db.Column(db.Integer, primary_key=True)
    name_template = db.Column(db.String(100), nullable=False)
    subject = db.Column(db.String(500), nullable=False)
    body = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<EmailTemplate {self.name_template}>'
    
    def to_dict(self):
        """Convertit l'objet en dictionnaire pour l'API"""
        return {
            'id_template': self.id_template,
            'name_template': self.name_template,
            'subject': self.subject,
            'body': self.body,
            'description': self.description,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def get_active_templates(cls):
        """Retourne tous les templates actifs"""
        return cls.query.filter_by(is_active=True).all()
    
    @classmethod
    def get_by_name(cls, name):
        """Retourne un template par son nom"""
        return cls.query.filter_by(name_template=name).first()