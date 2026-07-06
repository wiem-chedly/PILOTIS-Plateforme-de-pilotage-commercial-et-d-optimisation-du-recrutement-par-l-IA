from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from ..extensions import db

class AORequest(db.Model):
    __tablename__ = "ao_requests"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id", ondelete="SET NULL"))
    required_skills = db.Column(ARRAY(db.Text))
    seniority = db.Column(db.String(20))
    location = db.Column(db.String(100))
    tJM_max = db.Column(db.Numeric(10,2))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    status = db.Column(db.String(20), default="OPEN")  # OPEN / IN_PROGRESS / CLOSED
    created_by = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    match_scores = db.relationship("MatchScore", backref="ao_request", lazy=True, cascade="all, delete-orphan")
    shortlists = db.relationship("Shortlist", backref="ao_request", lazy=True, cascade="all, delete-orphan")
    linkedin_contacts = db.relationship("LinkedInContact", backref="ao_request", lazy=True, cascade="all, delete-orphan")
