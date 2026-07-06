from flask import Blueprint, jsonify, session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.extensions import db
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.models.job_requisition import JobRequisition
from app.models.candidate_many import CandidateMany

recruitment_stats_bp = Blueprint("recruitment_stats_bp", __name__, url_prefix="/api/stats/recruitment")

from app.utils.route_cache import cache_route

@recruitment_stats_bp.route("/", methods=["GET"])
def get_recruitment_stats():
    try:
        # --- 1. Sourcing ---
        total_candidates = db.session.query(func.count(Candidate.id_candidate)).scalar() or 0

        sources_query = db.session.query(Candidate.source, func.count(Candidate.id_candidate)).group_by(Candidate.source).all()
        sources_distribution = [{"name": s[0] if s[0] else "Autre", "value": s[1]} for s in sources_query]

        # La qualité par source sera calculée plus bas avec les liens principaux

        location_query = db.session.query(Candidate.location, func.count(Candidate.id_candidate)).filter(Candidate.location.isnot(None)).group_by(Candidate.location).order_by(func.count(Candidate.id_candidate).desc()).limit(8).all()
        location_distribution = [{"name": l[0], "value": l[1]} for l in location_query]

        six_months_ago = datetime.utcnow() - timedelta(days=180)
        recent_candidates = db.session.query(Candidate.created_at).filter(Candidate.created_at >= six_months_ago).all()
        
        monthly_counts = {}
        for (created_at,) in recent_candidates:
            if created_at:
                month_str = created_at.strftime('%Y-%m')
                monthly_counts[month_str] = monthly_counts.get(month_str, 0) + 1
                
        monthly_candidates = [{"month": k, "total": v} for k, v in sorted(monthly_counts.items())]

        linkedin_candidates = db.session.query(func.count(Candidate.id_candidate)).filter(Candidate.source.ilike('%linkedin%')).scalar() or 0
        email_candidates    = db.session.query(func.count(Candidate.id_candidate)).filter(Candidate.source.ilike('%mail%')).scalar() or 0

        # --- 2. Matching ---
        explicit_links      = db.session.query(func.count(Candidate.id_candidate)).filter(Candidate.job_requisition_id.isnot(None)).scalar() or 0
        suggested_links     = db.session.query(func.count(Candidate.id_candidate)).filter(Candidate.suggested_job_requisition_id.isnot(None)).scalar() or 0
        suggested_confirmed = db.session.query(func.count(Candidate.id_candidate)).filter(Candidate.suggested_job_requisition_id.isnot(None), Candidate.link_status == 'confirmed').scalar() or 0
        suggested_rejected  = db.session.query(func.count(Candidate.id_candidate)).filter(Candidate.suggested_job_requisition_id.isnot(None), Candidate.link_status == 'rejected').scalar() or 0

        total_suggestions_acted = suggested_confirmed + suggested_rejected
        ai_accuracy_pct = round((suggested_confirmed / total_suggestions_acted) * 100, 2) if total_suggestions_acted > 0 else 0
        
        # --- Score Moyen Matching AOs ---
        subquery = db.session.query(
            CandidateMany.requisition_id, 
            func.max(CandidateMany.match_score).label('max_score')
        ).group_by(CandidateMany.requisition_id).subquery()
        avg_top_match = db.session.query(func.avg(subquery.c.max_score)).scalar() or 0

        # Calcul du score IA moyen sur les candidatures actives (rattachées)
        primary_links_query = db.session.query(CandidateMany).join(
            Candidate, (CandidateMany.candidate_id == Candidate.id_candidate) & 
                       (CandidateMany.requisition_id == Candidate.job_requisition_id)
        )
        
        avg_many = primary_links_query.with_entities(func.avg(CandidateMany.match_score)).filter(CandidateMany.match_score > 0).scalar()
        if avg_many:
            avg_match_score = avg_many
        else:
            avg_match_score = db.session.query(func.avg(Candidate.match_score)).filter(Candidate.match_score > 0).scalar() or 0

        total_applications = primary_links_query.with_entities(func.count(CandidateMany.id_many)).scalar() or 0
        apps_accepted = primary_links_query.with_entities(func.count(CandidateMany.id_many)).filter(CandidateMany.status.in_(['accepted', 'linked'])).scalar() or 0
        apps_rejected = primary_links_query.with_entities(func.count(CandidateMany.id_many)).filter(CandidateMany.status == 'rejected').scalar() or 0
        apps_pending  = primary_links_query.with_entities(func.count(CandidateMany.id_many)).filter(CandidateMany.status == 'pending').scalar() or 0

        # Calcul de la qualité par source en utilisant le score réel des liens principaux
        source_quality_query = primary_links_query.with_entities(Candidate.source, func.avg(CandidateMany.match_score)).filter(CandidateMany.match_score > 0).group_by(Candidate.source).all()
        source_quality = [{"name": s[0] if s[0] else "Autre", "avgScore": round(s[1], 2)} for s in source_quality_query]

        applications_status_chart = [
            {"name": "En attente", "value": apps_pending,  "color": "#d97706"},
            {"name": "Acceptées",  "value": apps_accepted, "color": "#059669"},
            {"name": "Rejetées",   "value": apps_rejected, "color": "#e11d48"},
        ]

        # --- 3. Interviews ---
        total_interviews     = db.session.query(func.count(Interview.id)).scalar() or 0
        quiz_completed       = db.session.query(func.count(Interview.id)).filter(Interview.status.in_(['quiz_completed', 'confirmed', 'rejected'])).scalar() or 0
        interviews_confirmed = db.session.query(func.count(Interview.id)).filter(Interview.status == 'confirmed').scalar() or 0
        interviews_rejected  = db.session.query(func.count(Interview.id)).filter(Interview.status == 'rejected').scalar() or 0

        quiz_completion_rate = round((quiz_completed / total_interviews) * 100, 2) if total_interviews > 0 else 0
        avg_quiz_score = db.session.query(func.avg(Interview.quiz_score)).scalar() or 0

        interview_status_chart = [
            {"name": "En attente",  "value": max(0, total_interviews - quiz_completed), "color": "#d97706"},
            {"name": "Complétés",   "value": quiz_completed, "color": "#0891b2"},
            {"name": "Confirmés",   "value": interviews_confirmed, "color": "#059669"},
            {"name": "Rejetés",     "value": interviews_rejected,  "color": "#e11d48"},
        ]

        # --- 4. AOs ---
        def _convert_date(date_str):
            try:
                jour, mois, an = date_str.split("/")
                an_full = 2000 + int(an) if int(an) < 50 else 1900 + int(an)
                return datetime(an_full, int(mois), int(jour))
            except Exception:
                return None

        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        # On filtre par En cours 0/25% pour correspondre aux opportunités cibles
        all_aos = JobRequisition.query.filter(JobRequisition.etat_complet == "En cours 0/25%").all()
        recent_aos = [ao for ao in all_aos if _convert_date(ao.date) and _convert_date(ao.date) >= seven_days_ago]
        
        total_aos = len(recent_aos)
        total_pipeline_value = sum(ao.ca_pondere or 0 for ao in recent_aos)
        
        aos_by_status_query = db.session.query(JobRequisition.statut, func.count(JobRequisition.requisition_id)).group_by(JobRequisition.statut).all()
        aos_by_status = [{"name": s[0] or "Inconnu", "value": s[1]} for s in aos_by_status_query]

        # --- 5. Searched Profiles ---
        try:
            from app.models.searched_profile import SearchedProfile
            total_profiles  = db.session.query(func.count(SearchedProfile.id)).scalar() or 0
            active_profiles = db.session.query(func.count(SearchedProfile.id)).filter(SearchedProfile.is_active == True).scalar() or 0
        except Exception:
            total_profiles, active_profiles = 0, 0

        # --- 6. LinkedIn ---
        try:
            from app.models.linkedin_engagement import LinkedInEngagement
            from app.models.post_validation import PostValidation
            
            user_role = session.get("user_role")
            org_id = session.get("organization_id")
            
            eng_query = db.session.query(LinkedInEngagement).join(
                PostValidation, LinkedInEngagement.post_validation_id == PostValidation.id
            ).filter(PostValidation.linkedin_post_url.isnot(None))
            
            if user_role in ["manager", "commercial"] and org_id:
                from app.models.organization import Organization
                org = Organization.query.get(org_id)
                if org:
                    eng_query = eng_query.join(
                        JobRequisition, PostValidation.opportunity_id == JobRequisition.requisition_id
                    ).filter(JobRequisition.client_nom == org.name)
                    
            total_linkedin_engagements = eng_query.with_entities(func.count(LinkedInEngagement.id)).scalar() or 0
        except Exception as e:
            total_linkedin_engagements = 0

        linkedin_conversion = round((linkedin_candidates / total_linkedin_engagements) * 100, 2) if total_linkedin_engagements > 0 else 0

        # --- 7. Funnel ---
        funnel_data = [
            {"name": "Total Candidats",        "value": total_candidates},
            {"name": "Rattachés à une offre",  "value": explicit_links + suggested_confirmed},
            {"name": "Quiz Envoyés",            "value": total_interviews},
            {"name": "Quiz Complétés",          "value": quiz_completed},
            {"name": "Entretiens Confirmés",    "value": interviews_confirmed},
        ]

        # --- 8. Scatter ---
        scatter_query = primary_links_query.join(
            Interview, Candidate.id_candidate == Interview.candidate_id
        ).with_entities(
            CandidateMany.match_score, Interview.quiz_score
        ).filter(CandidateMany.match_score.isnot(None), Interview.quiz_score.isnot(None)).all()
        
        scatter_data = [{"aiScore": s[0], "quizScore": round(s[1] * 100, 2)} for s in scatter_query]

        return jsonify({
            "success": True,
            "data": {
                "global_kpis": {
                    "total_candidates":           total_candidates,
                    "avg_match_score":            round(avg_match_score, 2),
                    "ai_accuracy_pct":            ai_accuracy_pct,
                    "quiz_completion_rate":       quiz_completion_rate,
                    "avg_quiz_score":             round(avg_quiz_score * 100, 2),
                    "interviews_confirmed":       interviews_confirmed,
                    "total_aos":                  total_aos,
                    "pipeline_value":             total_pipeline_value,
                    "total_linkedin_engagements": total_linkedin_engagements,
                    "linkedin_conversion_rate":   linkedin_conversion,
                    "total_profiles":             total_profiles,
                    "active_profiles":            active_profiles,
                    "total_applications":         total_applications,
                    "linkedin_candidates":        linkedin_candidates,
                    "email_candidates":           email_candidates,
                },
                "sourcing": {
                    "distribution": sources_distribution,
                    "quality":      source_quality,
                    "by_location":  location_distribution,
                    "monthly":      monthly_candidates,
                },
                "matching": {
                    "explicit_links":            explicit_links,
                    "suggested_total":           suggested_links,
                    "suggested_confirmed":       suggested_confirmed,
                    "suggested_rejected":        suggested_rejected,
                    "avg_top_match":             round(avg_top_match, 2),
                    "apps_accepted":             apps_accepted,
                    "apps_rejected":             apps_rejected,
                    "apps_pending":              apps_pending,
                    "applications_status_chart": applications_status_chart,
                },
                "interviews": {
                    "total":       total_interviews,
                    "completed":   quiz_completed,
                    "confirmed":   interviews_confirmed,
                    "rejected":    interviews_rejected,
                    "pending":     max(0, total_interviews - quiz_completed),
                    "status_chart": interview_status_chart,
                },
                "aos": {
                    "total":     total_aos,
                    "by_status": aos_by_status,
                },
                "funnel":  funnel_data,
                "scatter": scatter_data,
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500