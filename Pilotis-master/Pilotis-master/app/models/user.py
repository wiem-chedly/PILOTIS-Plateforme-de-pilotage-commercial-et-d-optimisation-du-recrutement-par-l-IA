from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from ..extensions import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # DG / MANAGER / RH / COMMERCIAL / CONSULTANT / ADMIN
    phone = db.Column(db.String(20))
    salary = db.Column(db.Numeric(10,2))
    tJM = db.Column(db.Numeric(10,2))
    available = db.Column(db.Boolean, default=True)
    skills = db.Column(ARRAY(db.Text))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    missions = db.relationship("Mission", backref="consultant", lazy=True)
    ao_requests_created = db.relationship("AORequest", backref="creator", lazy=True)
    alerts = db.relationship("Alert", backref="user", lazy=True)
    financial_reports = db.relationship("FinancialReport", backref="user", lazy=True)
    system_logs = db.relationship("SystemLog", backref="user", lazy=True)
    roles = db.relationship("Role", secondary="user_roles", backref="users")
