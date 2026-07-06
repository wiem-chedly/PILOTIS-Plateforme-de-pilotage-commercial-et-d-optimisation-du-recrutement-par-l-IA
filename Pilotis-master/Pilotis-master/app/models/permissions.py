# app/models/permissions.py
from app.extensions import db
from datetime import datetime

class RolePermission(db.Model):
    __tablename__ = 'role_permissions'  # Nom de la table
    
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(50), nullable=False)  # 'admin' ou 'commercial'
    page = db.Column(db.String(100), nullable=False)  # 'dashboard', 'config', etc.
    can_view = db.Column(db.Boolean, default=True)  # True = peut voir, False = ne peut pas voir
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Pour éviter d'avoir deux fois la même permission pour le même rôle et la même page
    __table_args__ = (db.UniqueConstraint('role', 'page', name='unique_role_page'),)
    
    def __repr__(self):
        return f"<Permission {self.role} - {self.page}: {self.can_view}>"