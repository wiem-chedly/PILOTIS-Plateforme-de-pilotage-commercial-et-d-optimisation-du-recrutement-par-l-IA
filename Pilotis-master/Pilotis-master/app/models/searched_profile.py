# app/models/searched_profile.py

from app.extensions import db
from datetime import datetime
import json

class SearchedProfile(db.Model):
    __tablename__ = 'searched_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255))
    
    # Critères de recherche
    skills = db.Column(db.Text, nullable=True)           # JSON: ["Java", "Python", "SQL"]
    min_experience = db.Column(db.Integer, default=0)    # années
    max_experience = db.Column(db.Integer, nullable=True)
    
    # Localisation
    countries = db.Column(db.Text, nullable=True)        # JSON: ["France", "Tunisia"]
    is_foreign_allowed = db.Column(db.Boolean, default=True)
    
    # Contrat
    contract_types = db.Column(db.Text, nullable=True)   # JSON: ["CDI", "CDD", "Freelance"]
    
    # Langues
    languages = db.Column(db.Text, nullable=True)        # JSON: [{"name": "Français", "level": "C1"}, ...]
    
    # Statut
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'skills': json.loads(self.skills) if self.skills else [],
            'min_experience': self.min_experience,
            'max_experience': self.max_experience,
            'countries': json.loads(self.countries) if self.countries else [],
            'is_foreign_allowed': self.is_foreign_allowed,
            'contract_types': json.loads(self.contract_types) if self.contract_types else [],
            'languages': json.loads(self.languages) if self.languages else [],
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def set_skills(self, skills_list):
        self.skills = json.dumps(skills_list) if skills_list else None
    
    def set_countries(self, countries_list):
        self.countries = json.dumps(countries_list) if countries_list else None
    
    def set_contract_types(self, types_list):
        self.contract_types = json.dumps(types_list) if types_list else None
    
    def set_languages(self, languages_list):
        self.languages = json.dumps(languages_list) if languages_list else None