from app.extensions import db
from datetime import datetime

class Organization(db.Model):
    __tablename__ = 'organizations'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    website = db.Column(db.String(255), nullable=True)
    email = db.Column(db.String(150), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    sector = db.Column(db.String(100), nullable=True)
    num_employees = db.Column(db.Integer, default=10)
    
    # Enriched extra data
    description = db.Column(db.Text, nullable=True)
    linkedin_url = db.Column(db.String(255), nullable=True)
    
    # Random secret key specific to the organization
    secret_key = db.Column(db.String(50), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to users (fully qualified path to avoid conflict with the other User model)
    users = db.relationship('app.models.users.User', backref='organization', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"<Organization {self.name}>"
