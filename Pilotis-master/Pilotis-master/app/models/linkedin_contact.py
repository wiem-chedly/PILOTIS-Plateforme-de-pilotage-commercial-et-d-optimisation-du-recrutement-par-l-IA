from datetime import datetime
from ..extensions import db

class LinkedInContact(db.Model):
    __tablename__ = "linkedin_contacts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    linkedin_url = db.Column(db.String(200))
    ao_id = db.Column(db.Integer, db.ForeignKey("ao_requests.id", ondelete="CASCADE"))
    status = db.Column(db.String(20), default="NOT_CONTACTED")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
