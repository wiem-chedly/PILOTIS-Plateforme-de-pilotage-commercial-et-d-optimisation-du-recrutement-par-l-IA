from datetime import datetime
from ..extensions import db

class Mission(db.Model):
    __tablename__ = "missions"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id", ondelete="SET NULL"))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    consultant_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    tJM_client = db.Column(db.Numeric(10,2))
    cost = db.Column(db.Numeric(10,2))
    margin = db.Column(db.Numeric(5,2))
    status = db.Column(db.String(20), default="ONGOING")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
