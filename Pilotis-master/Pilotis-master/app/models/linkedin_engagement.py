from app.extensions import db
from datetime import datetime


class LinkedInEngagement(db.Model):
    __tablename__ = 'linkedin_engagements'

    id                  = db.Column(db.Integer, primary_key=True)
    post_validation_id  = db.Column(db.Integer, db.ForeignKey('post_validations.id'), nullable=True)
    opportunity_id      = db.Column(db.Integer, db.ForeignKey('job_requisitions.requisition_id'), nullable=True)
    engagement_type     = db.Column(db.String(20))      
    person_name         = db.Column(db.String(200))
    person_headline     = db.Column(db.String(300))
    person_linkedin_url = db.Column(db.String(300))
    comment_text        = db.Column(db.Text)            
    engagement_date     = db.Column(db.String(50))
    collected_at        = db.Column(db.DateTime, default=datetime.utcnow)

    post_validation = db.relationship('PostValidation', backref='engagements')
    opportunity     = db.relationship('JobRequisition', backref='linkedin_engagements')

    def to_dict(self):
        return {
            'id':             self.id,
            'type':           self.engagement_type,
            'name':           self.person_name,
            'headline':       self.person_headline,
            'profile_url':    self.person_linkedin_url,
            'comment':        self.comment_text,
            'date':           self.engagement_date,
            'collected_at':   self.collected_at.isoformat() if self.collected_at else None,
            'opportunity_id': self.opportunity_id,
        }
