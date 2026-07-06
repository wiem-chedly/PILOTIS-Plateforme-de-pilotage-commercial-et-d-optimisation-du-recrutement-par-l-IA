# app/services/profile_matcher.py

from app.models.candidate import Candidate
from app.models.candidate_many import CandidateMany
from app.models.job_requisition import JobRequisition
from app.models.searched_profile import SearchedProfile
import json
from datetime import datetime
import re

class ProfileMatcher:
    """Service pour matcher des profils recherchés avec des candidats"""
    
    # Mapping des noms de pays (français ↔ anglais)
    COUNTRY_MAPPING = {
        'Tunisie': 'Tunisia',
        'Tunisia': 'Tunisia',
        'Maroc': 'Morocco',
        'Morocco': 'Morocco',
        'France': 'France',
        'Algérie': 'Algeria',
        'Algeria': 'Algeria',
        'Belgique': 'Belgium',
        'Belgium': 'Belgium',
        'Suisse': 'Switzerland',
        'Switzerland': 'Switzerland',
        'Canada': 'Canada',
        'Sénégal': 'Senegal',
        'Senegal': 'Senegal',
        "Côte d'Ivoire": 'Ivory Coast',
        'Ivory Coast': 'Ivory Coast',
        'Cameroun': 'Cameroon',
        'Cameroon': 'Cameroon',
    }
    
    @classmethod
    def normalize_country(cls, country_name):
        """Normalise le nom du pays (français → anglais)"""
        if not country_name:
            return ""
        return cls.COUNTRY_MAPPING.get(country_name, country_name)
    
    @classmethod
    def extract_education_level(cls, cv_text):
        """Extrait le niveau de formation du CV"""
        if not cv_text:
            return 0
        
        cv_lower = cv_text.lower()
        
        # Chercher les diplômes
        if 'doctorat' in cv_lower or 'phd' in cv_lower:
            return 9
        if 'bac+7' in cv_lower or 'bac+8' in cv_lower:
            return 8
        if 'bac+6' in cv_lower or 'master' in cv_lower or 'ingénieur' in cv_lower:
            return 6
        if 'bac+5' in cv_lower or 'master 2' in cv_lower:
            return 6
        if 'bac+4' in cv_lower or 'master 1' in cv_lower:
            return 5
        if 'bac+3' in cv_lower or 'licence' in cv_lower:
            return 4
        if 'bac+2' in cv_lower or 'bts' in cv_lower or 'dut' in cv_lower:
            return 3
        if 'bac+1' in cv_lower or 'deug' in cv_lower:
            return 2
        if 'bac' in cv_lower or 'baccalaureat' in cv_lower:
            return 1
        
        return 0
    
    @classmethod
    def match_candidate_with_profile(cls, candidate, profile):
        """
        Calcule le score de correspondance entre un candidat et un profil recherché
        Score total sur 100 points
        """
        score = 0
        details = []
        
        # 1. Matching des compétences (25 points max)
        if profile.skills:
            candidate_skills = json.loads(candidate.skills) if candidate.skills else []
            profile_skills = json.loads(profile.skills) if profile.skills else []
            
            if profile_skills:
                matched_skills = [s for s in profile_skills if s in candidate_skills]
                skill_percent = (len(matched_skills) / len(profile_skills)) * 100
                skill_score = (skill_percent / 100) * 25
                score += skill_score
                details.append({
                    "category": "Compétences",
                    "score": round(skill_score, 1),
                    "percent": round(skill_percent, 1),
                    "matched": matched_skills,
                    "total": len(profile_skills),
                    "max": 25
                })
        
        # 2. Matching de la localisation (25 points max)
        if profile.countries:
            candidate_country = cls.normalize_country(candidate.location or "")
            profile_countries = [cls.normalize_country(c) for c in json.loads(profile.countries) if profile.countries]
            
            if candidate_country in profile_countries:
                score += 25
                details.append({
                    "category": "Localisation",
                    "score": 25,
                    "percent": 100,
                    "matched": candidate.location,
                    "expected": profile_countries,
                    "max": 25
                })
            elif profile.is_foreign_allowed:
                score += 12.5
                details.append({
                    "category": "Localisation",
                    "score": 12.5,
                    "percent": 50,
                    "matched": candidate.location,
                    "expected": profile_countries,
                    "max": 25
                })
            else:
                score += 0
                details.append({
                    "category": "Localisation",
                    "score": 0,
                    "percent": 0,
                    "matched": candidate.location,
                    "expected": profile_countries,
                    "max": 25
                })
        
        # 3. Matching de l'expérience (25 points max)
        candidate_exp = cls._extract_experience_from_cv(candidate.cv_parsed or "")
        min_exp = profile.min_experience or 0
        max_exp = profile.max_experience or 20
        
        if candidate_exp == 0:
            exp_score = 0
            exp_percent = 0
            note = "Expérience non détectée"
        elif min_exp <= candidate_exp <= max_exp:
            exp_score = 25
            exp_percent = 100
            note = f"Expérience {candidate_exp} ans (dans la fourchette {min_exp}-{max_exp} ans)"
        elif candidate_exp < min_exp:
            ratio = candidate_exp / min_exp if min_exp > 0 else 0
            exp_score = ratio * 25
            exp_percent = ratio * 100
            note = f"Expérience {candidate_exp} ans (insuffisante, besoin {min_exp} ans min)"
        else:
            exp_score = 25
            exp_percent = 100
            note = f"Expérience {candidate_exp} ans (supérieure à {max_exp} ans)"
        
        score += exp_score
        details.append({
            "category": "Expérience",
            "score": round(exp_score, 1),
            "percent": round(exp_percent, 1),
            "matched": f"{candidate_exp} ans" if candidate_exp > 0 else "Non détectée",
            "expected": f"{min_exp}-{max_exp} ans",
            "note": note,
            "max": 25
        })
        
        # 4. Matching de la formation (25 points max) - NOUVEAU
        candidate_education_level = cls.extract_education_level(candidate.cv_parsed or "")
        profile_education_level = profile.education_level if hasattr(profile, 'education_level') else 0
        
        if profile_education_level == 0:
            # Pas de contrainte de formation
            edu_score = 25
            edu_percent = 100
            note = "Aucune contrainte de formation"
        elif candidate_education_level == 0:
            edu_score = 0
            edu_percent = 0
            note = "Formation non détectée dans le CV"
        elif candidate_education_level >= profile_education_level:
            edu_score = 25
            edu_percent = 100
            note = f"Formation niveau {candidate_education_level} (requis: {profile_education_level}) ✅"
        else:
            # Niveau insuffisant
            ratio = candidate_education_level / profile_education_level
            edu_score = ratio * 25
            edu_percent = ratio * 100
            note = f"Formation niveau {candidate_education_level} (insuffisant, besoin niveau {profile_education_level})"
        
        score += edu_score
        details.append({
            "category": "Formation",
            "score": round(edu_score, 1),
            "percent": round(edu_percent, 1),
            "matched": f"Niveau {candidate_education_level}" if candidate_education_level > 0 else "Non détectée",
            "expected": f"Niveau {profile_education_level}" if profile_education_level > 0 else "Aucun",
            "note": note,
            "max": 25
        })
        
        # Score final (déjà sur 100 points)
        final_score = round(score)
        
        return final_score, details
    
    @classmethod
    def _extract_experience_from_cv(cls, cv_text):
        """Extraction des années d'expérience à partir du CV"""
        if not cv_text:
            return 0
        
        # Chercher les années dans le CV
        years = re.findall(r'19[89]\d|20[0-2]\d', cv_text)
        if not years:
            return 0
        
        current_year = datetime.now().year
        exp_years = []
        
        for year_str in years:
            year = int(year_str)
            if 1990 <= year <= current_year:
                exp = current_year - year
                if 0 <= exp <= 40:
                    exp_years.append(exp)
        
        if not exp_years:
            return 0
        
        return min(exp_years)
    
    @classmethod
    def find_matching_candidates(cls, profile_id, limit=50):
        """Trouve tous les candidats correspondant à un profil"""
        profile = SearchedProfile.query.get(profile_id)
        if not profile:
            return []
        
        profile_countries = [cls.normalize_country(c) for c in json.loads(profile.countries)] if profile.countries else []
        
        candidates = Candidate.query.all()
        results = []
        
        for candidate in candidates:
            candidate_country = cls.normalize_country(candidate.location or "")
            
            if not profile.is_foreign_allowed:
                if candidate_country and candidate_country not in profile_countries:
                    continue
            
            score, details = cls.match_candidate_with_profile(candidate, profile)
            if score > 0:
                results.append({
                    "candidate": candidate,
                    "score": score,
                    "match_details": details
                })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    @classmethod
    def get_match_summary(cls, profile_id):
        """Résumé du matching pour un profil"""
        matches = cls.find_matching_candidates(profile_id)
        
        serializable_matches = []
        from app.models.candidate_many import CandidateMany
        
        for m in matches:
            candidate = m["candidate"]
            
            # Vérifier si le candidat est déjà dans un processus (AO)
            is_engaged = False
            if candidate.job_requisition_id:
                is_engaged = True
            
            active_apps = CandidateMany.query.filter_by(candidate_id=candidate.id_candidate).filter(CandidateMany.status != 'rejected').count()
            if active_apps > 0:
                is_engaged = True
                
            serializable_matches.append({
                "candidate_id": candidate.id_candidate,
                "candidate_name": f"{candidate.first_name or ''} {candidate.last_name or ''}".strip(),
                "email": candidate.email,
                "score": m["score"],
                "cv_drive_link": candidate.cv_path,
                "is_engaged": is_engaged,
                "details": m["match_details"]
            })
        
        return {
            "total_candidates_matched": len(serializable_matches),
            "high_score": len([m for m in serializable_matches if m["score"] >= 70]),
            "medium_score": len([m for m in serializable_matches if 40 <= m["score"] < 70]),
            "low_score": len([m for m in serializable_matches if m["score"] < 40]),
            "matches": serializable_matches
        }