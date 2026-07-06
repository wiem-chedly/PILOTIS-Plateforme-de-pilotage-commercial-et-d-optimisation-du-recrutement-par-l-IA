from datetime import datetime
from ..extensions import db

class MatchScore(db.Model):
    __tablename__ = "match_scores"

    id = db.Column(db.Integer, primary_key=True)
    ao_id = db.Column(db.Integer, db.ForeignKey("ao_requests.id", ondelete="CASCADE"))
    consultant_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"))
    score = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
