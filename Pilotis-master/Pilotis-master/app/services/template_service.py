# app/services/template_service.py

from datetime import datetime
from app.models.candidate import Candidate
from app.models.candidate_many import CandidateMany
from app.models.job_requisition import JobRequisition

class TemplateService:
    """Service pour la gestion des templates email"""
    
    VARIABLES = {
        "{{ candidate_name }}": "Nom complet du candidat",
        "{{ candidate_first_name }}": "Prénom du candidat",
        "{{ candidate_last_name }}": "Nom du candidat",
        "{{ candidate_email }}": "Email du candidat",
        "{{ candidate_phone }}": "Téléphone du candidat",
        "{{ job_title }}": "Titre du poste",
        "{{ job_client }}": "Nom du client",
        "{{ job_reference }}": "Référence de l'offre",
        "{{ match_score }}": "Score de matching (%)",
        "{{ company }}": "Nom de l'entreprise (OMICRONE)",
        "{{ date }}": "Date du jour",
        "{{ year }}": "Année en cours",
        "{{ dashboard_link }}": "Lien vers le dashboard"
    }
    
    @classmethod
    def get_variables(cls):
        return cls.VARIABLES
    
    @classmethod
    def get_application_by_id(cls, application_id):
        """Récupère une candidature spécifique par son ID"""
        return CandidateMany.query.get(application_id)
    
    @classmethod
    def get_candidate_data(cls, candidate, application=None):
        """Récupère toutes les données d'un candidat avec application spécifique"""
        if not candidate:
            return cls._get_mock_data()
        
        # Utiliser l'application spécifique si fournie
        if application:
            # Récupérer l'offre correspondante
            job = JobRequisition.query.get(application.requisition_id) if application.requisition_id else None
            
            # Score de l'application
            score = str(application.match_score) if application.match_score else "0"
            
            # Titre du poste
            job_title = job.titre if job else "Poste non spécifié"
            job_client = job.client_nom if job else "OMICRONE"
            job_reference = job.reference if job else "REF-001"
        else:
            # Fallback: prendre la meilleure candidature
            best_app = cls.get_best_application(candidate)
            job = None
            if best_app and best_app.requisition_id:
                job = JobRequisition.query.get(best_app.requisition_id)
            
            score = str(best_app.match_score) if best_app and best_app.match_score else "0"
            job_title = job.titre if job else "Poste non spécifié"
            job_client = job.client_nom if job else "OMICRONE"
            job_reference = job.reference if job else "REF-001"
        
        return {
            "candidate_name": f"{candidate.first_name or ''} {candidate.last_name or ''}".strip() or "Candidat",
            "candidate_first_name": candidate.first_name or "Prénom",
            "candidate_last_name": candidate.last_name or "Nom",
            "candidate_email": candidate.email or "candidat@example.com",
            "candidate_phone": candidate.phone or "Non renseigné",
            "job_title": job_title,
            "job_client": job_client,
            "job_reference": job_reference,
            "match_score": score,
            "company": "OMICRONE",
            "date": datetime.now().strftime("%d/%m/%Y"),
            "year": datetime.now().strftime("%Y"),
            "dashboard_link": "http://localhost:8080/decisions"
        }
    
    @classmethod
    def get_best_application(cls, candidate):
        """Récupère la meilleure candidature d'un candidat"""
        if not candidate:
            return None
        
        applications = CandidateMany.query.filter_by(candidate_id=candidate.id_candidate).all()
        
        if applications:
            valid_apps = [app for app in applications if app.match_score and app.match_score > 0]
            if valid_apps:
                return max(valid_apps, key=lambda x: x.match_score or 0)
            return max(applications, key=lambda x: x.match_score or 0)
        
        return None
    
    @classmethod
    def _get_mock_data(cls):
        return {
            "candidate_name": "Jean Dupont",
            "candidate_first_name": "Jean",
            "candidate_last_name": "Dupont",
            "candidate_email": "jean.dupont@example.com",
            "candidate_phone": "06 12 34 56 78",
            "job_title": "Développeur Full Stack",
            "job_client": "OMICRONE",
            "job_reference": "REF-2025-001",
            "match_score": "85",
            "company": "OMICRONE",
            "date": datetime.now().strftime("%d/%m/%Y"),
            "year": datetime.now().strftime("%Y"),
            "dashboard_link": "http://localhost:8080/decisions"
        }
    
    @classmethod
    def preview_template(cls, subject, body, candidate_id=None, application_id=None):
        """Prévisualise un template pour un candidat et une application spécifique"""
        
        candidate = None
        if candidate_id:
            candidate = Candidate.query.get(candidate_id)
        
        application = None
        if application_id:
            application = cls.get_application_by_id(application_id)
        
        if candidate:
            preview_data = cls.get_candidate_data(candidate, application)
        else:
            preview_data = cls._get_mock_data()
        
        preview_subject = subject
        preview_body = body
        
        for var, value in preview_data.items():
            preview_subject = preview_subject.replace(f"{{{{ {var} }}}}", str(value))
            preview_subject = preview_subject.replace(f"{{{{ {var} }}}}", str(value))
            preview_body = preview_body.replace(f"{{{{ {var} }}}}", str(value))
            preview_body = preview_body.replace(f"{{{{ {var} }}}}", str(value))
        
        return {
            "subject": preview_subject,
            "body": preview_body,
            "candidate_name": preview_data["candidate_name"],
            "candidate_email": preview_data["candidate_email"],
            "job_title": preview_data["job_title"],
            "match_score": preview_data["match_score"]
        }
    
    @classmethod
    def render_template(cls, template, candidate, application=None):
        """Rend un template pour un candidat et une application spécifique"""
        if not template or not candidate:
            return None, None
        
        data = cls.get_candidate_data(candidate, application)
        
        subject = template.subject
        body = template.body
        
        for var, value in data.items():
            subject = subject.replace(f"{{{{ {var} }}}}", str(value))
            subject = subject.replace(f"{{{{ {var} }}}}", str(value))
            body = body.replace(f"{{{{ {var} }}}}", str(value))
            body = body.replace(f"{{{{ {var} }}}}", str(value))
        
        return subject, body