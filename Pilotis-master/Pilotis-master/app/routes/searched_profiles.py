# app/routes/searched_profiles.py

from flask import Blueprint, jsonify, request
from app.models.searched_profile import SearchedProfile
from app.services.profile_matcher import ProfileMatcher
from app.extensions import db
from app.utils.authentification import login_required, config_access_required

searched_profiles_bp = Blueprint('searched_profiles', __name__)

# ==================== CRUD PROFILS ====================

@searched_profiles_bp.route('/searched-profiles', methods=['GET'])
@login_required
def get_profiles():
    profiles = SearchedProfile.query.order_by(SearchedProfile.created_at.desc()).all()
    return jsonify([p.to_dict() for p in profiles])

@searched_profiles_bp.route('/searched-profiles/<int:profile_id>', methods=['GET'])
@login_required
def get_profile(profile_id):
    profile = SearchedProfile.query.get_or_404(profile_id)
    return jsonify(profile.to_dict())

@searched_profiles_bp.route('/searched-profiles', methods=['POST'])
@login_required
@config_access_required
def create_profile():
    data = request.json
    
    profile = SearchedProfile(
        name=data.get('name'),
        description=data.get('description', ''),
        min_experience=data.get('min_experience', 0),
        max_experience=data.get('max_experience'),
        is_foreign_allowed=data.get('is_foreign_allowed', True),
        is_active=data.get('is_active', True)
    )
    
    profile.set_skills(data.get('skills', []))
    profile.set_countries(data.get('countries', []))
    profile.set_contract_types(data.get('contract_types', []))
    profile.set_languages(data.get('languages', []))
    
    db.session.add(profile)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Profil '{profile.name}' créé",
        "profile": profile.to_dict()
    }), 201

@searched_profiles_bp.route('/searched-profiles/<int:profile_id>', methods=['PUT'])
@login_required
@config_access_required
def update_profile(profile_id):
    profile = SearchedProfile.query.get_or_404(profile_id)
    data = request.json
    
    profile.name = data.get('name', profile.name)
    profile.description = data.get('description', profile.description)
    profile.min_experience = data.get('min_experience', profile.min_experience)
    profile.max_experience = data.get('max_experience', profile.max_experience)
    profile.is_foreign_allowed = data.get('is_foreign_allowed', profile.is_foreign_allowed)
    profile.is_active = data.get('is_active', profile.is_active)
    
    profile.set_skills(data.get('skills', []))
    profile.set_countries(data.get('countries', []))
    profile.set_contract_types(data.get('contract_types', []))
    profile.set_languages(data.get('languages', []))
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Profil '{profile.name}' mis à jour",
        "profile": profile.to_dict()
    })

@searched_profiles_bp.route('/searched-profiles/<int:profile_id>', methods=['DELETE'])
@login_required
@config_access_required
def delete_profile(profile_id):
    profile = SearchedProfile.query.get_or_404(profile_id)
    name = profile.name
    
    db.session.delete(profile)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Profil '{name}' supprimé"
    })

# ==================== MATCHING ====================

@searched_profiles_bp.route('/searched-profiles/<int:profile_id>/match', methods=['GET'])
@login_required
def match_profile(profile_id):
    """Trouve les candidats correspondant au profil"""
    summary = ProfileMatcher.get_match_summary(profile_id)
    return jsonify(summary)

@searched_profiles_bp.route('/searched-profiles/<int:profile_id>/match/<int:candidate_id>', methods=['GET'])
@login_required
def match_single_candidate(profile_id, candidate_id):
    """Score de matching pour un candidat spécifique"""
    from app.models.candidate import Candidate
    
    profile = SearchedProfile.query.get_or_404(profile_id)
    candidate = Candidate.query.get_or_404(candidate_id)
    
    score, details = ProfileMatcher.match_candidate_with_profile(candidate, profile)
    
    return jsonify({
        "candidate_id": candidate_id,
        "candidate_name": f"{candidate.first_name} {candidate.last_name}",
        "score": score,
        "match_details": details
    })

# ==================== OUTREACH (CHASSE) ====================

@searched_profiles_bp.route('/searched-profiles/<int:profile_id>/outreach', methods=['POST'])
@login_required
def send_outreach_emails(profile_id):
    """Génère et envoie des emails personnalisés aux candidats sélectionnés"""
    data = request.json
    candidate_ids = data.get('candidate_ids', [])
    
    if not candidate_ids:
        return jsonify({"success": False, "error": "Aucun candidat sélectionné"}), 400
        
    from app.services.outreach_service import OutreachService
    result = OutreachService.send_outreach_emails(profile_id, candidate_ids)
    
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 400