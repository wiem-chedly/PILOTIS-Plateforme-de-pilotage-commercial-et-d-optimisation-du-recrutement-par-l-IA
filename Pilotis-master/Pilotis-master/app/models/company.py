from datetime import datetime
from ..extensions import db

class Company(db.Model):
    __tablename__ = "companies"

    id = db.Column(db.Integer, primary_key=True)
    boond_id = db.Column(db.Integer, unique=True, nullable=True)

    name = db.Column(db.String(100), nullable=False)
    group_name = db.Column(db.String(100))             # Canonical group name (e.g., "BNP Paribas")
    status = db.Column(db.String(30), nullable=False)  # Client / Prospect / Partenaire
    sector = db.Column(db.String(100))                 # sector/industry

    contact_email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)

    # Conversion rates — computed by sync_companies
    taux_rdv    = db.Column(db.Float, nullable=True)
    taux_appel  = db.Column(db.Float, nullable=True)

    # Raw counters (stored for transparency / Excel export)
    nb_contacts = db.Column(db.Integer, nullable=True)
    nb_rdv      = db.Column(db.Integer, nullable=True)
    nb_appel    = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    missions    = db.relationship("Mission",  backref="company", lazy=True)
    ao_requests = db.relationship("AORequest", backref="company", lazy=True)
