import os
import requests
import json
from app.models.candidate import Candidate
from app.models.searched_profile import SearchedProfile
from app.utils.notifications import send_email

class OutreachService:
    @classmethod
    def generate_personalized_email(cls, candidate, profile):
        """Génère un email d'approche très personnalisé avec l'IA"""
        
        # Extraire les infos utiles
        skills = json.loads(candidate.skills) if candidate.skills else []
        skills_str = ", ".join(skills[:5])
        
        prompt = f"""
        Tu es recruteur chez Pilotis. Tu dois écrire un email de "chasse" (sourcing) très court et percutant à un candidat.
        
        Informations du candidat :
        - Prénom : {candidate.first_name or 'Candidat'}
        - Compétences clés : {skills_str}
        
        Informations du poste proposé :
        - Titre/Profil : {profile.name}
        - Description : {profile.description}
        
        RÈGLES :
        - Sois professionnel mais chaleureux
        - Commence par "Bonjour [Prénom]"
        - Mentionne une ou deux de ses compétences pour montrer que tu as vraiment lu son profil
        - Propose un court échange téléphonique
        - L'email doit être en français
        - NE METS PAS d'objet, juste le corps du mail
        - Sois direct et concis (maximum 4 phrases)
        
        Rédige l'email maintenant :
        """
        
        ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
        
        try:
            response = requests.post(
                ollama_url,
                json={
                    "model": "qwen2.5:7b",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 200}
                },
                timeout=900
            )
            
            if response.status_code == 200:
                result = response.json().get("response", "").strip()
                return result
        except Exception as e:
            print(f"Erreur génération email Qwen: {e}")
            
        # Fallback si l'IA échoue
        return f"Bonjour {candidate.first_name},\n\nVotre profil a attiré notre attention pour le poste de {profile.name}. Seriez-vous disponible pour un court échange téléphonique ?\n\nCordialement,\nL'équipe Recrutement"

    @classmethod
    def send_outreach_emails(cls, profile_id, candidate_ids):
        """Envoie les emails personnalisés à une liste de candidats"""
        profile = SearchedProfile.query.get(profile_id)
        if not profile:
            return {"success": False, "error": "Profil introuvable"}
            
        results = []
        for cid in candidate_ids:
            candidate = Candidate.query.get(cid)
            if not candidate or not candidate.email:
                results.append({"id": cid, "status": "error", "error": "Candidat ou email introuvable"})
                continue
                
            try:
                # 1. Générer le contenu
                email_body = cls.generate_personalized_email(candidate, profile)
                subject = f"Opportunité chez Pilotis : {profile.name}"
                
                # 2. Envoyer l'email
                send_email(candidate.email, subject, email_body)
                
                results.append({
                    "id": cid, 
                    "email": candidate.email,
                    "status": "success"
                })
            except Exception as e:
                results.append({
                    "id": cid, 
                    "email": candidate.email,
                    "status": "error",
                    "error": str(e)
                })
                
        return {"success": True, "results": results}
