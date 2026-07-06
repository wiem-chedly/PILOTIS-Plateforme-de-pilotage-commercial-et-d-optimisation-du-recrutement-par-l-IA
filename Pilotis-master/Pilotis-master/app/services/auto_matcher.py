# app/services/auto_matcher.py
"""
Service de matching automatique entre CV et offres.
Les scores sont stockés UNIQUEMENT dans candidate_many (table de liaison).
Chaque candidat a un score DIFFÉRENT pour chaque offre.
LIMITE : Seules les offres des 7 derniers jours sont traitées.
ACCEPTE les descriptions courtes (même 1 caractère)

CORRECTION : match_single_opportunity retourne les 3 meilleurs (top 3)
"""

from datetime import datetime, timedelta
from app.models.candidate import Candidate
from app.models.candidate_many import CandidateMany
from app.models.job_requisition import JobRequisition
from app.extensions import db
from app.services.ai_analyzer import analyze_cv_with_ai, analyze_semantic_match_with_ai
from sqlalchemy.exc import IntegrityError
import json


class AutoMatcher:
    """Service de matching automatique - stocke les scores uniquement dans candidate_many"""

    @classmethod
    def _calculate_hybrid_score(cls, cv_profile_text, opp):
        """Calcule le score avec la méthode hybride (Sémantique IA + Algorithme Amin)"""
        if not cv_profile_text:
            return 0, "CV vide ou introuvable"
            
        # 0. Vérification de l'offre (Si l'offre n'a ni description ni critères)
        has_description = opp.description and len(opp.description.strip()) > 10
        has_criteres = opp.criteres and len(opp.criteres.strip()) > 5
        
        if not has_description and not has_criteres:
            # L'offre est vide, on ne gaspille pas d'appel IA et on donne un score faible direct
            return 15, "Les critères et compétences requises ne sont pas spécifiés dans l'offre, rendant une évaluation précise impossible."
            
        # 1. Appel IA Sémantique
        analysis = analyze_semantic_match_with_ai(
            cv_profile_text, 
            opp.titre or "", 
            opp.description or "", 
            opp.criteres or ""
        )
        
        # 2. Formules Mathématiques d'Amin
        exact_matches = analysis.get("exact_matches", [])
        semantic_matches = analysis.get("semantic_matches", [])
        missing_skills = analysis.get("missing_critical_skills", [])
        
        total_required = len(exact_matches) + len(semantic_matches) + len(missing_skills)
        if total_required == 0:
            total_required = 5
            
        points = (len(exact_matches) * 10) + (len(semantic_matches) * 6)
        max_points = total_required * 10
        
        base_score = (points / max_points) * 100 if max_points > 0 else 0
        
        # 3. Pénalité d'Expérience (Amin) avec nouveaux mots-clés Management
        opp_text = (str(opp.titre) + " " + str(opp.description)).lower()
        job_level = "junior"
        
        # Mots clés indiquant qu'on cherche un profil expérimenté ou manager
        senior_keywords = [
            "senior", "expert", "confirmé", "confirme", 
            "manager", "directeur", "lead", "chef de projet", 
            "coordonnateur", "coordinateur", "responsable"
        ]
        
        if any(kw in opp_text for kw in senior_keywords):
            job_level = "senior"
            
        candidate_level = "junior"
        motivation_score = 0
        if cv_profile_text:
            try:
                prof = json.loads(cv_profile_text)
                candidate_level = prof.get("level", "junior")
                motivation_score = prof.get("motivation_score", 0)
            except:
                pass
                
        penalty = 0
        if job_level == "senior" and candidate_level in ["etudiant", "junior"]:
            penalty = 0.50 # Malus sévère de 50% pour écart d'expérience (ex: stagiaire vs coordonnateur)
            
        score = base_score * (1 - penalty)
        
        # 4. Bonus de Motivation
        bonus = (motivation_score / 100) * 5
        score = min(100, score + bonus)
        
        # Génération de l'explication RH
        justification_parts = []
        
        if base_score >= 70:
            justification_parts.append("Forte correspondance technique validée sur la majorité des compétences clés.")
        elif base_score >= 40:
            justification_parts.append("Compétences techniques partiellement alignées avec les besoins du poste.")
        else:
            justification_parts.append("Le profil présente trop peu des compétences techniques requises par l'offre.")
            
        if penalty > 0:
            justification_parts.append(f"Cependant, le candidat manque d'expérience (profil {candidate_level}) pour ce poste qui exige un niveau {job_level}.")
            
        ia_expl = analysis.get('analysis_explanation', '').strip()
        if ia_expl:
            justification_parts.append(ia_expl)
            
        justification = " ".join(justification_parts)
        
        return int(score), justification

    @classmethod
    def match_all_new_opportunities(cls):
        """
        Match TOUS les CV avec les offres 0/25% des 7 DERNIERS JOURS.
        Stocke les scores uniquement dans candidate_many.
        ACCEPTE les descriptions courtes (même 1 caractère).
        """
        print("\n" + "="*60)
        print("🤖 MATCHING AUTOMATIQUE - DÉMARRAGE")
        print("="*60)

        cutoff = datetime.now() - timedelta(days=10)
        opportunities = JobRequisition.query.filter(
            JobRequisition.etat_complet == "En cours 0/25%",
            JobRequisition.date_import >= cutoff
        ).order_by(JobRequisition.date_import.desc()).all()

        if not opportunities:
            print("ℹ️ Aucune nouvelle opportunité 0/25% dans les 7 derniers jours")
            return 0

        print(f"📊 {len(opportunities)} opportunité(s) des 7 derniers jours à traiter")

        candidates = Candidate.query.all()
        print(f"👥 {len(candidates)} candidat(s) à analyser")

        matches_updated = 0

        for opp in opportunities:
            print(f"\n📌 Opportunité: {opp.titre} (Date: {opp.date_import.strftime('%d/%m/%Y') if opp.date_import else 'N/C'})")

            has_description = opp.description is not None and len(opp.description.strip()) > 0
            has_criteres = opp.criteres is not None and len(opp.criteres.strip()) > 0

            if not has_description or not has_criteres:
                print(f"   ⚠️ Description ou critères manquants → Score faible direct")
            else:
                print(f"   ✅ Description et critères présents → calcul IA")

            opp_matches = 0

            for candidate in candidates:
                existing = CandidateMany.query.filter_by(
                    candidate_id=candidate.id_candidate,
                    requisition_id=opp.requisition_id
                ).first()

                if existing:
                    continue  # Déjà traité

                # Calcul du score
                if not candidate.cv_parsed:
                    score = 0
                    justification = "CV non disponible"
                    status_icon = "❌"
                else:
                    try:
                        cv_profile_text = candidate.cv_profile if candidate.cv_profile else candidate.cv_parsed
                        score, justification = cls._calculate_hybrid_score(cv_profile_text, opp)
                        status_icon = "✅" if score >= 70 else "📌" if score >= 40 else "⚠️"
                    except Exception as e:
                        score = 0
                        justification = f"Erreur: {str(e)[:100]}"
                        status_icon = "❌"

                auto_status = 'accepted' if score >= 70 else ('rejected' if score < 40 else 'pending')
                application = CandidateMany(
                    candidate_id=candidate.id_candidate,
                    requisition_id=opp.requisition_id,
                    match_score=score,
                    match_justification=justification,
                    status=auto_status
                )

                try:
                    db.session.merge(application)
                    opp_matches += 1
                    matches_updated += 1
                    print(f"   {status_icon} {candidate.first_name} {candidate.last_name}: {score}%")

                except IntegrityError as e:
                    db.session.rollback()
                    if "UniqueViolation" in str(e) or "duplicate" in str(e):
                        print(f"   ⏭️ {candidate.first_name} {candidate.last_name}: déjà existant")
                    else:
                        print(f"   ❌ Erreur: {e}")

            db.session.commit()
            print(f"   → {opp_matches} candidature(s) traitée(s)")

        print("\n" + "="*60)
        print(f"✅ MATCHING TERMINÉ")
        print(f"   📊 Total candidatures traitées: {matches_updated}")
        print("="*60 + "\n")

        return matches_updated

    @classmethod
    def match_single_opportunity(cls, opportunity_id):
        """
        Match tous les CV avec une opportunité spécifique.

        CORRECTION : Retourne les 3 meilleurs candidats (top 3) au lieu de 5.
        ACCEPTE les descriptions courtes.
        """
        opportunity = JobRequisition.query.get(opportunity_id)
        if not opportunity:
            return {"error": "Opportunité non trouvée"}

        print(f"\n🔍 Matching spécifique pour: {opportunity.titre}")

        has_description = opportunity.description is not None and len(opportunity.description.strip()) > 0
        has_criteres = opportunity.criteres is not None and len(opportunity.criteres.strip()) > 0

        if not has_description or not has_criteres:
            print(f"   ⚠️ Offre sans description ou critères → score faible direct")

        candidates = Candidate.query.all()
        matches = []

        for candidate in candidates:
            existing = CandidateMany.query.filter_by(
                candidate_id=candidate.id_candidate,
                requisition_id=opportunity_id
            ).first()

            if existing:
                # Score existant → utiliser tel quel
                matches.append({
                    "id": candidate.id_candidate,
                    "first_name": candidate.first_name,
                    "last_name": candidate.last_name,
                    "email": candidate.email,
                    "cv_drive_link": candidate.cv_path,
                    "match_score": existing.match_score,
                    "justification": existing.match_justification
                })
                continue

            # Calcul du score
            if not candidate.cv_parsed:
                score = 0
                justification = "CV non disponible"
            else:
                try:
                    cv_profile_text = candidate.cv_profile if candidate.cv_profile else candidate.cv_parsed
                    score, justification = cls._calculate_hybrid_score(cv_profile_text, opportunity)
                except Exception as e:
                    score = 0
                    justification = f"Erreur: {str(e)[:100]}"

            auto_status = 'accepted' if score >= 70 else ('rejected' if score < 40 else 'pending')
            application = CandidateMany(
                candidate_id=candidate.id_candidate,
                requisition_id=opportunity_id,
                match_score=score,
                match_justification=justification,
                status=auto_status
            )
            db.session.merge(application)

            matches.append({
                "id": candidate.id_candidate,
                "first_name": candidate.first_name,
                "last_name": candidate.last_name,
                "email": candidate.email,
                "cv_drive_link": candidate.cv_path,
                "match_score": score,
                "justification": justification
            })

        db.session.commit()

        # Trier par score décroissant et garder les 3 meilleurs
        matches.sort(key=lambda x: x["match_score"], reverse=True)
        top_matches = matches[:3]  

        print(f"✅ {len(matches)} candidature(s) - Top 3 scores: {[m['match_score'] for m in top_matches]}")

        return {
            "opportunity_id": opportunity_id,
            "opportunity_title": opportunity.titre,
            "candidates": top_matches
        }

    @classmethod
    def match_single_candidate(cls, candidate_id):
        """
        Match un seul candidat avec toutes les offres 0/25% des 7 derniers jours.
        Retourne la meilleure opportunité (meilleur score) ou None.
        """
        candidate = Candidate.query.get(candidate_id)
        if not candidate:
            return {"error": "Candidat non trouvé"}

        print(f"\n🔍 Matching global pour le candidat sans référence: {candidate.first_name} {candidate.last_name}")

        cutoff = datetime.now() - timedelta(days=10)
        opportunities = JobRequisition.query.filter(
            JobRequisition.etat_complet == "En cours 0/25%",
            JobRequisition.date_import >= cutoff
        ).all()

        if not opportunities:
            print("ℹ️ Aucune offre 0/25% récente trouvée.")
            return None

        best_score = -1
        best_match = None

        for opp in opportunities:
            existing = CandidateMany.query.filter_by(
                candidate_id=candidate.id_candidate,
                requisition_id=opp.requisition_id
            ).first()

            if existing:
                score = existing.match_score
                justification = existing.match_justification
            else:
                if not candidate.cv_parsed:
                    score = 0
                    justification = "CV non disponible"
                else:
                    try:
                        cv_profile_text = candidate.cv_profile if candidate.cv_profile else candidate.cv_parsed
                        score, justification = cls._calculate_hybrid_score(cv_profile_text, opp)
                    except Exception as e:
                        score = 0
                        justification = f"Erreur: {str(e)[:100]}"

                auto_status = 'pending' # Toujours en attente pour un candidat sans réf (suggested)
                application = CandidateMany(
                    candidate_id=candidate.id_candidate,
                    requisition_id=opp.requisition_id,
                    match_score=score,
                    match_justification=justification,
                    status=auto_status
                )
                db.session.merge(application)

            if score > best_score:
                best_score = score
                best_match = {
                    "opportunity_id": opp.requisition_id,
                    "opportunity_title": opp.titre,
                    "score": score,
                    "justification": justification
                }

        db.session.commit()

        if best_match and best_match['score'] > 0:
            print(f"✅ Meilleur match pour {candidate.first_name}: {best_match['opportunity_title']} avec {best_match['score']}%")
            return best_match
        return None
    @classmethod
    def get_score_for_candidate(cls, candidate_id, opportunity_id):
        """Récupère le score d'un candidat pour une offre spécifique."""
        application = CandidateMany.query.filter_by(
            candidate_id=candidate_id,
            requisition_id=opportunity_id
        ).first()

        if application:
            return {
                "score": application.match_score,
                "justification": application.match_justification,
                "status": application.status
            }
        return None

    @classmethod
    def get_all_scores_for_candidate(cls, candidate_id):
        """Récupère TOUS les scores d'un candidat (pour toutes les offres)."""
        applications = CandidateMany.query.filter_by(
            candidate_id=candidate_id
        ).all()

        results = []
        for app in applications:
            offre = JobRequisition.query.get(app.requisition_id)
            results.append({
                "opportunity_id": app.requisition_id,
                "opportunity_title": offre.titre if offre else "Inconnue",
                "score": app.match_score,
                "justification": app.match_justification,
                "status": app.status
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results

    @classmethod
    def get_statistics(cls):
        """Affiche les statistiques du matching."""
        print("\n" + "="*60)
        print("📊 STATISTIQUES DU MATCHING")
        print("="*60)

        total_candidates = Candidate.query.count()

        cutoff = datetime.now() - timedelta(days=10)
        total_opportunities = JobRequisition.query.filter(
            JobRequisition.etat_complet == "En cours 0/25%",
            JobRequisition.date_import >= cutoff
        ).count()

        total_applications = CandidateMany.query.count()

        from sqlalchemy import func
        apps_per_opp = db.session.query(
            CandidateMany.requisition_id,
            func.count(CandidateMany.id_many).label('count')
        ).group_by(CandidateMany.requisition_id).all()

        avg_apps = sum(c for _, c in apps_per_opp) / len(apps_per_opp) if apps_per_opp else 0

        avg_score = db.session.query(func.avg(CandidateMany.match_score)).scalar() or 0

        print(f"\n📈 Données générales:")
        print(f"   Candidats: {total_candidates}")
        print(f"   Opportunités 0/25% (7 derniers jours): {total_opportunities}")
        print(f"   Candidatures: {total_applications}")
        print(f"   Score moyen: {avg_score:.1f}%")
        print(f"   Moyenne candidatures par offre: {avg_apps:.1f}")

        high = CandidateMany.query.filter(CandidateMany.match_score >= 70).count()
        medium = CandidateMany.query.filter(CandidateMany.match_score.between(40, 69)).count()
        low = CandidateMany.query.filter(CandidateMany.match_score.between(1, 39)).count()
        zero = CandidateMany.query.filter(CandidateMany.match_score == 0).count()

        print(f"\n📊 Répartition des scores:")
        print(f"   Haut score (70-100%): {high}")
        print(f"   Score moyen (40-69%): {medium}")
        print(f"   Score faible (1-39%): {low}")
        print(f"   Score nul (0%): {zero}")

        print("="*60 + "\n")

        return {
            "total_candidates": total_candidates,
            "total_opportunities": total_opportunities,
            "total_applications": total_applications,
            "avg_score": float(avg_score),
            "avg_apps_per_opp": float(avg_apps),
            "distribution": {
                "high": high, "medium": medium, "low": low, "zero": zero
            }
        }
