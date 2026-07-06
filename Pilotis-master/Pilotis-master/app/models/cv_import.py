# app/models/cv_import.py
from app.extensions import db
from datetime import datetime


class CVImport(db.Model):
    """Stocke les profils importés depuis DoYouBuzz / Showcase."""
    __tablename__ = 'cv_imports'

    id         = db.Column(db.Integer, primary_key=True)
    full_name  = db.Column(db.String(200))
    first_name = db.Column(db.String(100))
    last_name  = db.Column(db.String(100))
    email      = db.Column(db.String(120))
    phone      = db.Column(db.String(50))
    skills     = db.Column(db.Text)    # virgule-séparé
    languages  = db.Column(db.Text)    # virgule-séparé
    raw_data   = db.Column(db.Text)    # JSON brut
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<CVImport {self.email}>'
