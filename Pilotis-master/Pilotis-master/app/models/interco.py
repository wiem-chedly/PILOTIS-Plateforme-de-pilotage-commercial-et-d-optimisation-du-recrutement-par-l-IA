from datetime import datetime
from ..extensions import db


class Interco(db.Model):
    """
    Cache table for BoondManager resources tagged as intercontract.
    Refreshed on each /intercos call via interco_service.
    """

    __tablename__ = "intercos"

    id      = db.Column(db.Integer, primary_key=True)

    # Boond resource id (string because Boond IDs can be large)
    boond_id = db.Column(db.String(50), unique=True, nullable=False)
    name     = db.Column(db.String(200), nullable=False)

    # Category computed from config thresholds
    # Values: "recrutement_recent" | "sortie_prochaine" | "sortie_mission"
    category = db.Column(db.String(50), nullable=True)

    # Sales responsible — name string resolved from BoondManager mainManager
    sales_responsable = db.Column(db.String(200), nullable=True)

    # Mission dates from BoondManager resource attributes
    mission_start = db.Column(db.Date, nullable=True)
    mission_end   = db.Column(db.Date, nullable=True)

    # Hire date — resource.attributes.creationDate
    hire_date = db.Column(db.Date, nullable=True)

    # Last commercial action on this interco (denormalised for display speed)
    derniere_action_date = db.Column(db.Date, nullable=True)
    derniere_action_desc = db.Column(db.String(300), nullable=True)

    # Status derived from actions: "sans_action" | "en_cours" | "positionne"
    statut = db.Column(db.String(30), nullable=True)

    synced_at  = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)
