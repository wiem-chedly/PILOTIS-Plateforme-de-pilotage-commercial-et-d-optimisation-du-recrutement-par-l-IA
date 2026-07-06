from datetime import datetime
from ..extensions import db

class FinancialReport(db.Model):
    __tablename__ = "financial_reports"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    report_type = db.Column(db.String(50))  # DASHBOARD / MISSION / CLIENT
    file_path = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
