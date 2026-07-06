# app/models/post_validation.py
import uuid
from app.extensions import db
from datetime import datetime

class PostValidation(db.Model):
    __tablename__ = 'post_validations'
    
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    account_id = db.Column(db.Integer, db.ForeignKey('linkedin_accounts.id'), nullable=False)
    opportunity_id = db.Column(db.Integer, db.ForeignKey('job_requisitions.requisition_id'), nullable=False)
    post_content = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='pending')
    selected_email = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    responded_at = db.Column(db.DateTime)
    posted_at = db.Column(db.DateTime)

    # LinkedIn post tracking
    linkedin_post_urn      = db.Column(db.String(200), nullable=True)   # urn:li:ugcPost:xxx
    linkedin_post_url      = db.Column(db.String(500), nullable=True)   # URL publique du post
    scrape_status          = db.Column(db.String(20),  default='idle')  # idle|pending|done|error
    apify_run_id           = db.Column(db.String(100), nullable=True)   # run likers
    apify_run_id_comments  = db.Column(db.String(100), nullable=True)   # run commenters
    last_scraped_at        = db.Column(db.DateTime,    nullable=True)

    # Relation avec cascade de suppression
    account = db.relationship(
        'LinkedInAccount',
        backref=db.backref('post_validations', cascade='all, delete-orphan')
    )
    opportunity = db.relationship('JobRequisition')

    def __repr__(self):
        return f"<PostValidation {self.uuid} - {self.status}>"