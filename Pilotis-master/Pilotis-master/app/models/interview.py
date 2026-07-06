# app/models/interview.py
import uuid as _uuid
from app.extensions import db
from datetime import datetime


class Interview(db.Model):
    """
    Représente un processus d'entretien en 2 étapes :
      1. Quiz technique généré par Qwen et envoyé au candidat (lien public)
      2. Entretien Google Meet confirmé par le commercial si le quiz est réussi
    """
    __tablename__ = 'interviews'

    id = db.Column(db.Integer, primary_key=True)

    # Liens relationnels
    candidate_id = db.Column(
        db.Integer, db.ForeignKey('candidates.id_candidate'), nullable=False
    )
    job_requisition_id = db.Column(
        db.Integer, db.ForeignKey('job_requisitions.requisition_id'), nullable=False
    )
    created_by_email = db.Column(db.String(255), nullable=True)  # email du commercial

    # ── Quiz ──────────────────────────────────────────────────────────────────
    quiz_token = db.Column(
        db.String(36), unique=True, nullable=False,
        default=lambda: str(_uuid.uuid4())
    )
    # JSON complet des questions (avec bonnes réponses) — jamais envoyé au frontend
    quiz_questions = db.Column(db.Text, nullable=True)
    # JSON des réponses soumises par le candidat
    quiz_answers = db.Column(db.Text, nullable=True)
    # Score de 0.0 à 1.0 calculé automatiquement
    quiz_score = db.Column(db.Float, nullable=True)
    # JSON avec détail par question (correct/incorrect + explication)
    quiz_detail = db.Column(db.Text, nullable=True)
    quiz_sent_at = db.Column(db.DateTime, nullable=True)
    quiz_completed_at = db.Column(db.DateTime, nullable=True)

    # ── Statut global ─────────────────────────────────────────────────────────
    # 'quiz_sent' → 'quiz_completed' → 'confirmed' | 'rejected' | 'cancelled'
    status = db.Column(db.String(30), nullable=False, default='quiz_sent')

    # ── Entretien final (rempli par le commercial lors de la confirmation) ─────
    interview_date = db.Column(db.DateTime, nullable=True)
    meet_link = db.Column(db.String(500), nullable=True)
    confirmation_sent_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # ── Relations ─────────────────────────────────────────────────────────────
    candidate = db.relationship('Candidate', backref='interviews')
    job = db.relationship('JobRequisition', backref='interviews')

    def quiz_score_pct(self):
        """Retourne le score en pourcentage (0-100)."""
        if self.quiz_score is None:
            return None
        return round(self.quiz_score * 100)

    def to_dict(self):
        import json
        detail = None
        if self.quiz_detail:
            try:
                detail = json.loads(self.quiz_detail)
            except Exception:
                pass
        return {
            'id': self.id,
            'candidate_id': self.candidate_id,
            'candidate_name': f"{self.candidate.first_name or ''} {self.candidate.last_name or ''}".strip(),
            'candidate_email': self.candidate.email,
            'job_id': self.job_requisition_id,
            'job_title': self.job.titre if self.job else None,
            'job_client': self.job.client_nom if self.job else None,
            'created_by_email': self.created_by_email,
            'status': self.status,
            'quiz_score': self.quiz_score,
            'quiz_score_pct': self.quiz_score_pct(),
            'quiz_detail': detail,
            'quiz_sent_at': self.quiz_sent_at.isoformat() if self.quiz_sent_at else None,
            'quiz_completed_at': self.quiz_completed_at.isoformat() if self.quiz_completed_at else None,
            'interview_date': self.interview_date.isoformat() if self.interview_date else None,
            'meet_link': self.meet_link,
            'confirmation_sent_at': self.confirmation_sent_at.isoformat() if self.confirmation_sent_at else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat(),
        }

    def __repr__(self):
        return f'<Interview {self.id} candidate={self.candidate_id} status={self.status}>'
