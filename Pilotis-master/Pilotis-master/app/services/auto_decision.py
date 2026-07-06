# app/services/auto_decision.py
from app.models.candidate import Candidate
from app.models.candidate_many import CandidateMany
from app.models.job_requisition import JobRequisition
from app.extensions import db
from app.utils.notifications import send_email
from datetime import datetime
import re

class AutoDecision:
    """Gère les décisions automatiques basées sur les scores de matching"""
    
    # Seuils de décision
    THRESHOLD_MATCH = 70      # ≥ 70% → Match
    THRESHOLD_REVIEW = 40     # 40-69% → À examiner
    # < 40% → Non match
    
    @classmethod
    def classify_single_application(cls, application):
        """
        Classifie UNE candidature spécifique
        Retourne: (decision, score, justification, is_foreign)
        """
        if not application:
            return "no_application", 0, "Aucune candidature trouvée", False
        
        candidate = Candidate.query.get(application.candidate_id)
        score = application.match_score or 0
        is_foreign = cls._is_foreign_candidate(candidate) if candidate else False
        
        # La décision est basée UNIQUEMENT sur le score
        if score >= cls.THRESHOLD_MATCH:
            decision = "match"
            justification = f"Score élevé ({score}%) - Correspondance excellente"
        elif score >= cls.THRESHOLD_REVIEW:
            decision = "review"
            justification = f"Score moyen ({score}%) - À examiner manuellement"
        else:
            decision = "non_match"
            justification = f"Score faible ({score}%) - Non retenu"
        
        return decision, score, justification, is_foreign
    
    @classmethod
    def _is_foreign_candidate(cls, candidate):
        """
        Détecte si le candidat est étranger basé sur le numéro de téléphone
        """
        if not candidate.phone:
            return False
        
        phone = candidate.phone.strip().replace(' ', '').replace('-', '').replace('.', '')
        
        # Formats TUNISIENS (NON ÉTRANGER)
        if phone.startswith('+216') or phone.startswith('00216'):
            return False
        if re.match(r'^[2,5,9][0-9]{7}$', phone):
            return False
        
        # Formats FRANÇAIS (NON ÉTRANGER)
        if phone.startswith('+33') or phone.startswith('0033'):
            return False
        if re.match(r'^0[1-9][0-9]{8}$', phone):
            return False
        
        # TOUT LE RESTE EST ÉTRANGER
        return True
    
    @classmethod
    def classify_candidate(cls, candidate_id):
        """
        Classifie un candidat basé sur son meilleur score
        """
        candidate = Candidate.query.get(candidate_id)
        if not candidate:
            return None, None, "Candidat non trouvé", None, [], False
        
        # Récupérer toutes les applications du candidat
        applications = CandidateMany.query.filter_by(candidate_id=candidate_id).all()
        
        if not applications:
            return "no_application", 0, "Aucune candidature trouvée", None, [], cls._is_foreign_candidate(candidate)
        
        # Analyser chaque application
        all_decisions = []
        for app in applications:
            offre = app.opportunity
            if offre:
                decision, score, justification, is_foreign = cls.classify_single_application(app)
                all_decisions.append({
                    "application_id": app.id_many,
                    "opportunity_id": offre.requisition_id,
                    "opportunity_title": offre.titre,
                    "opportunity_reference": offre.reference,
                    "opportunity_client": offre.client_nom,
                    "score": score,
                    "decision": decision,
                    "justification": justification,
                    "status": app.status,
                    "is_foreign": is_foreign
                })
        
        # Prendre le meilleur score pour la décision globale
        best_app = max(applications, key=lambda x: x.match_score or 0)
        best_score = best_app.match_score or 0
        best_offer = best_app.opportunity
        
        # Décision globale basée sur le score
        if best_score >= cls.THRESHOLD_MATCH:
            decision = "match"
            justification = f"Score élevé ({best_score}%) - Correspondance excellente"
        elif best_score >= cls.THRESHOLD_REVIEW:
            decision = "review"
            justification = f"Score moyen ({best_score}%) - À examiner manuellement"
        else:
            decision = "non_match"
            justification = f"Score faible ({best_score}%) - Non retenu"
        
        is_foreign = cls._is_foreign_candidate(candidate)
        
        return decision, best_score, justification, best_offer, all_decisions, is_foreign
    
    @classmethod
    def execute_decision(cls, candidate_id):
        """Exécute l'action correspondant à la décision pour le meilleur score"""
        decision, score, justification, best_offer, all_decisions, is_foreign = cls.classify_candidate(candidate_id)
        
        candidate = Candidate.query.get(candidate_id)
        
        if not candidate:
            return {"success": False, "error": "Candidat non trouvé"}
        
        result = {
            "candidate_id": candidate_id,
            "candidate_name": f"{candidate.first_name} {candidate.last_name}",
            "candidate_email": candidate.email,
            "candidate_phone": candidate.phone,
            "decision": decision,
            "score": score,
            "justification": justification,
            "all_decisions": all_decisions,
            "is_foreign": is_foreign,
            "actions_taken": []
        }
        
        if decision == "match":
            result = cls._handle_match(candidate, best_offer, score, result)
        elif decision == "non_match":
            result = cls._handle_non_match(candidate, best_offer, score, result)
        elif decision == "review":
            result = cls._handle_review(candidate, best_offer, score, result)
        
        if best_offer:
            best_app = CandidateMany.query.filter_by(
                candidate_id=candidate_id,
                requisition_id=best_offer.requisition_id
            ).first()
            if best_app:
                if decision == "match":
                    best_app.status = 'accepted'
                elif decision == "non_match":
                    best_app.status = 'rejected'
                db.session.commit()
        
        return result
    
    @classmethod
    def execute_decision_for_application(cls, candidate_id, application_id):
        """Exécute l'action pour une candidature spécifique"""
        application = CandidateMany.query.get(application_id)
        if not application:
            return {"success": False, "error": "Candidature non trouvée"}
        
        candidate = Candidate.query.get(candidate_id)
        offre = application.opportunity
        decision, score, justification, is_foreign = cls.classify_single_application(application)
        
        result = {
            "candidate_id": candidate_id,
            "application_id": application_id,
            "candidate_name": f"{candidate.first_name} {candidate.last_name}" if candidate else "Inconnu",
            "candidate_phone": candidate.phone if candidate else None,
            "opportunity_title": offre.titre if offre else "Inconnue",
            "decision": decision,
            "score": score,
            "justification": justification,
            "is_foreign": is_foreign,
            "actions_taken": []
        }
        
        if decision == "match":
            result["actions_taken"].append(f"Match pour l'offre {offre.titre if offre else 'Inconnue'}")
        elif decision == "non_match":
            result["actions_taken"].append(f"Non match pour l'offre {offre.titre if offre else 'Inconnue'}")
        
        if decision == "match":
            application.status = 'accepted'
        elif decision == "non_match":
            application.status = 'rejected'
        db.session.commit()
        
        return result
    
    @classmethod
    def _handle_match(cls, candidate, best_offer, score, result):
        subject = f"[PILOTIS] Félicitations ! Votre candidature est retenue - {best_offer.titre}"
        body = f"""
Bonjour {candidate.first_name} {candidate.last_name},

Félicitations ! Votre candidature pour le poste de {best_offer.titre} a été retenue.

📊 Score de matching: {score}%
📌 Offre: {best_offer.titre}
🏢 Client: {best_offer.client_nom}

Nous reviendrons vers vous très rapidement pour organiser un entretien.

Cordialement,
L'équipe PILOTIS
"""
        cls._send_email(candidate.email, subject, body)
        result["actions_taken"].append(f"Email de confirmation envoyé à {candidate.email}")
        return result
    
    @classmethod
    def _handle_non_match(cls, candidate, best_offer, score, result):
        subject = f"[PILOTIS] Suite à votre candidature - {best_offer.titre}"
        body = f"""
Bonjour {candidate.first_name} {candidate.last_name},

Nous vous remercions pour votre candidature au poste de {best_offer.titre}.

Après étude de votre profil, nous ne donnons pas suite à votre candidature.
Nous conservons votre CV dans notre base pour de futures opportunités.

Cordialement,
L'équipe PILOTIS
"""
        cls._send_email(candidate.email, subject, body)
        result["actions_taken"].append(f"Email de non-retenu envoyé à {candidate.email}")
        return result
    
    @classmethod
    def _handle_review(cls, candidate, best_offer, score, result):
        result["actions_taken"].append(f"À examiner manuellement - Score: {score}%")
        print(f"\n🔔 [ACTION REQUISE] Candidat à examiner: {candidate.first_name} {candidate.last_name}")
        print(f"   Offre: {best_offer.titre}")
        print(f"   Score: {score}%")
        return result
    
    @classmethod
    def _send_email(cls, to_email, subject, body):
        try:
            send_email(to_email, subject, body)
            print(f"📧 Email envoyé à {to_email}")
        except Exception as e:
            print(f"⚠️ Erreur envoi email: {e}")