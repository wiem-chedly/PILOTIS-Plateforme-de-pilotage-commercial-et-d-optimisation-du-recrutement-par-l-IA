# app/models/candidate_many.py
from app.extensions import db
from datetime import datetime

class CandidateMany(db.Model):
    """Table de liaison entre candidats et offres (many-to-many)"""
    __tablename__ = 'candidate_many'
    
    id_many = db.Column(db.Integer, primary_key=True)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidates.id_candidate'), nullable=False)
    requisition_id = db.Column(db.Integer, db.ForeignKey('job_requisitions.requisition_id'), nullable=False)
    
    # Informations sur l'application
    match_score = db.Column(db.Integer, nullable=True)
    match_justification = db.Column(db.Text, nullable=True)
    match_explanation = db.Column(db.Text, nullable=True)
    match_confidence = db.Column(db.String(10), nullable=True)
    
    # Statut de la candidature
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    candidate = db.relationship('Candidate', backref=db.backref('many_applications', cascade='all, delete-orphan'), foreign_keys=[candidate_id])
    opportunity = db.relationship('JobRequisition', backref='many_applications', foreign_keys=[requisition_id])
    
    # ========== AJOUTER CETTE SECTION POUR ÉVITER LES DOUBLONS ==========
    __table_args__ = (
        db.UniqueConstraint('candidate_id', 'requisition_id', 
                            name='unique_candidate_requisition'),
    )
    # ====================================================================
    
    def __repr__(self):
        return f'<CandidateMany {self.candidate_id} -> {self.requisition_id}>'