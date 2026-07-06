from app.extensions import db
from datetime import datetime

class Candidate(db.Model):
    __tablename__ = 'candidates'
    
    id_candidate = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    first_name = db.Column(db.String(30), nullable=True)
    last_name = db.Column(db.String(30), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    source = db.Column(db.String(50), nullable=False)
    cv_path = db.Column(db.String(200), nullable=True)
    cv_parsed = db.Column(db.Text, nullable=True)
    cv_file_hash = db.Column(db.String(64), nullable=True, index=True)
    cv_file_size = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    job_requisition_id = db.Column(db.Integer, db.ForeignKey('job_requisitions.requisition_id'), nullable=True)
    
    # MULTI-TENANT: Organization assignment
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)

    # Analyse IA de base
    skills = db.Column(db.Text, nullable=True)
    match_score = db.Column(db.Integer, nullable=True)
    match_justification = db.Column(db.Text, nullable=True)

    # Profil structuré enrichi (smart matching)
    cv_profile = db.Column(db.Text, nullable=True)
    match_explanation = db.Column(db.Text, nullable=True)
    match_confidence = db.Column(db.String(10), nullable=True)

    recipient_contact_id = db.Column(db.Integer, db.ForeignKey('contacts.id_contact'), nullable=True)

    # Liaison suggérée par référence email
    suggested_job_requisition_id = db.Column(db.Integer, db.ForeignKey('job_requisitions.requisition_id'), nullable=True)
    link_status = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(100), nullable=True)

    # LinkedIn / Google Form collection
    linkedin_profile_url = db.Column(db.String(300), nullable=True)
    google_form_response_id = db.Column(db.String(200), nullable=True, unique=True)

    # Relations
    job = db.relationship('JobRequisition', foreign_keys=[job_requisition_id], backref='candidates')
    suggested_job = db.relationship('JobRequisition', foreign_keys=[suggested_job_requisition_id], backref='suggested_candidates')
    recipient_contact = db.relationship('Contact', backref='candidates_received')
    organization = db.relationship('Organization', backref='candidates')

    def __repr__(self):
        return f'<Candidate {self.email}>'