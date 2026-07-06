from datetime import datetime
from ..extensions import db

class Shortlist(db.Model):
    __tablename__ = "shortlists"

    id = db.Column(db.Integer, primary_key=True)
    ao_id = db.Column(db.Integer, db.ForeignKey("ao_requests.id", ondelete="CASCADE"))
    consultant_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"))
    rank = db.Column(db.Integer)
    status = db.Column(db.String(20), default="PENDING")  # PENDING / SENT / VALIDATED
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
