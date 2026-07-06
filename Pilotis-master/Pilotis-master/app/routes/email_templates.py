# app/routes/email_templates.py

from flask import Blueprint, jsonify, request
from app.models.email_template import EmailTemplate
from app.models.candidate import Candidate
from app.models.candidate_many import CandidateMany
from app.models.job_requisition import JobRequisition
from app.services.template_service import TemplateService
from app.extensions import db
from app.utils.authentification import login_required, config_access_required
from app.utils.notifications import send_email
from datetime import datetime

email_templates_bp = Blueprint('email_templates', __name__)

# ==================== CRUD TEMPLATES ====================

@email_templates_bp.route('/email-templates', methods=['GET'])
@login_required
def get_templates():
    templates = EmailTemplate.query.order_by(EmailTemplate.created_at.desc()).all()
    return jsonify([t.to_dict() for t in templates])


@email_templates_bp.route('/email-templates/<int:template_id>', methods=['GET'])
@login_required
def get_template(template_id):
    template = EmailTemplate.query.get_or_404(template_id)
    return jsonify(template.to_dict())


@email_templates_bp.route('/email-templates', methods=['POST'])
@login_required
@config_access_required
def create_template():
    data = request.json
    
    if not data.get('name_template') or not data.get('subject') or not data.get('body'):
        return jsonify({"error": "Nom, sujet et corps sont requis"}), 400
    
    template = EmailTemplate(
        name_template=data['name_template'],
        subject=data['subject'],
        body=data['body'],
        description=data.get('description', ''),
        is_active=data.get('is_active', True)
    )
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Template '{template.name_template}' créé avec succès",
        "template": template.to_dict()
    }), 201


@email_templates_bp.route('/email-templates/<int:template_id>', methods=['PUT'])
@login_required
@config_access_required
def update_template(template_id):
    template = EmailTemplate.query.get_or_404(template_id)
    data = request.json
    
    template.name_template = data.get('name_template', template.name_template)
    template.subject = data.get('subject', template.subject)
    template.body = data.get('body', template.body)
    template.description = data.get('description', template.description)
    template.is_active = data.get('is_active', template.is_active)
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Template '{template.name_template}' mis à jour",
        "template": template.to_dict()
    })


@email_templates_bp.route('/email-templates/<int:template_id>', methods=['DELETE'])
@login_required
@config_access_required
def delete_template(template_id):
    template = EmailTemplate.query.get_or_404(template_id)
    name = template.name_template
    
    db.session.delete(template)
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": f"Template '{name}' supprimé"
    })


# ==================== VARIABLES ====================

@email_templates_bp.route('/email-templates/variables', methods=['GET'])
@login_required
def get_variables():
    return jsonify({
        "variables": TemplateService.get_variables(),
        "count": len(TemplateService.get_variables())
    })


# ==================== PRÉVISUALISATION ====================

@email_templates_bp.route('/email-templates/preview', methods=['POST'])
@login_required
def preview_template():
    data = request.json
    subject = data.get('subject', '')
    body = data.get('body', '')
    candidate_id = data.get('candidate_id')
    application_id = data.get('application_id')
    
    preview = TemplateService.preview_template(subject, body, candidate_id, application_id)
    
    return jsonify(preview)


@email_templates_bp.route('/email-templates/<int:template_id>/preview', methods=['GET'])
@login_required
def preview_existing_template(template_id):
    """Prévisualise un template avec les données d'un candidat spécifique (GET)"""
    template = EmailTemplate.query.get_or_404(template_id)
    candidate_id = request.args.get('candidate_id', type=int)
    application_id = request.args.get('application_id', type=int)
    
    if not candidate_id:
        return jsonify({"error": "candidate_id requis"}), 400
    
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404
    
    # Récupérer l'offre
    job_title = ""
    job_client = ""
    match_score = ""
    
    if application_id:
        app = CandidateMany.query.get(application_id)
        if app:
            job = JobRequisition.query.get(app.requisition_id)
            if job:
                job_title = job.titre or ""
                job_client = job.client_nom or ""
                match_score = str(app.match_score) if app.match_score else ""
    
    # Remplacer les variables
    subject = template.subject or ""
    body = template.body or ""
    
    replacements = {
        '{{ candidate_name }}': f"{candidate.first_name or ''} {candidate.last_name or ''}".strip(),
        '{{ candidate_first_name }}': candidate.first_name or '',
        '{{ candidate_last_name }}': candidate.last_name or '',
        '{{ candidate_email }}': candidate.email or '',
        '{{ candidate_phone }}': candidate.phone or '',
        '{{ job_title }}': job_title,
        '{{ job_client }}': job_client,
        '{{ job_reference }}': '',
        '{{ match_score }}': match_score,
        '{{ company }}': 'OMICRONE',
        '{{ date }}': datetime.now().strftime('%d/%m/%Y'),
        '{{ year }}': datetime.now().strftime('%Y'),
        '{{ dashboard_link }}': 'http://localhost:8080/candidats',
    }
    
    for key, value in replacements.items():
        subject = subject.replace(key, value)
        body = body.replace(key, value)
    
    return jsonify({
        "subject": subject,
        "body": body,
        "candidate_name": replacements['{{ candidate_name }}'],
        "candidate_email": candidate.email,
        "job_title": job_title,
        "match_score": match_score,
        "template_name": template.name_template,
        "template_id": template.id_template
    })


# ==================== ROUTES POUR CANDIDATS.TSX ====================

@email_templates_bp.route('/email-templates/<int:template_id>/candidates', methods=['GET'])
@login_required
def get_candidates_for_template(template_id):
    """Récupère les candidats éligibles pour un template (avec filtrage par score)"""
    template = EmailTemplate.query.get_or_404(template_id)
    
    # Déterminer le seuil de score selon le nom du template
    threshold_min = 0
    threshold_max = 100
    name_lower = template.name_template.lower()
    
    if "match" in name_lower and "non" not in name_lower:
        threshold_min = 70
        threshold_max = 100
    elif "review" in name_lower:
        threshold_min = 40
        threshold_max = 69
    elif "non" in name_lower and "match" in name_lower:
        threshold_min = 0
        threshold_max = 39
    
    # Récupérer tous les candidats avec leurs applications
    candidates = Candidate.query.order_by(Candidate.created_at.desc()).all()
    result = []
    
    for candidate in candidates:
        applications = CandidateMany.query.filter_by(candidate_id=candidate.id_candidate).all()
        
        filtered_apps = []
        for app in applications:
            # Filtrer par score si nécessaire
            app_score = app.match_score or 0
            if threshold_min <= app_score <= threshold_max:
                job = JobRequisition.query.get(app.requisition_id)
                filtered_apps.append({
                    "id_many": app.id_many,
                    "requisition_id": app.requisition_id,
                    "titre": job.titre if job else "Offre inconnue",
                    "client": job.client_nom if job else "Client inconnu",
                    "match_score": app_score,
                    "status": app.status
                })
        
        if filtered_apps:
            result.append({
                "id": candidate.id_candidate,
                "first_name": candidate.first_name or "",
                "last_name": candidate.last_name or "",
                "email": candidate.email,
                "phone": candidate.phone or "",
                "cv_drive_link": candidate.cv_path,
                "applications": filtered_apps
            })
    
    return jsonify(result)


@email_templates_bp.route('/email-templates/send-custom', methods=['POST'])
@login_required
def send_custom_email():
    """Envoie un email personnalisé depuis Candidats.tsx"""
    data = request.json
    candidate_id = data.get('candidate_id')
    application_id = data.get('application_id')
    subject = data.get('subject')
    body = data.get('body')
    
    if not candidate_id or not subject or not body:
        return jsonify({"error": "Données manquantes"}), 400
    
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404
    
    # Récupérer les infos de l'offre
    job_title = ""
    job_client = ""
    match_score = ""
    
    if application_id:
        app = CandidateMany.query.get(application_id)
        if app:
            job = JobRequisition.query.get(app.requisition_id)
            if job:
                job_title = job.titre or ""
                job_client = job.client_nom or ""
                match_score = str(app.match_score) if app.match_score else ""
    
    # Remplacer les variables
    replacements = {
        '{{ candidate_name }}': f"{candidate.first_name or ''} {candidate.last_name or ''}".strip(),
        '{{ candidate_first_name }}': candidate.first_name or '',
        '{{ candidate_last_name }}': candidate.last_name or '',
        '{{ candidate_email }}': candidate.email or '',
        '{{ candidate_phone }}': candidate.phone or '',
        '{{ job_title }}': job_title,
        '{{ job_client }}': job_client,
        '{{ job_reference }}': '',
        '{{ match_score }}': match_score,
        '{{ company }}': 'OMICRONE',
        '{{ date }}': datetime.now().strftime('%d/%m/%Y'),
        '{{ year }}': datetime.now().strftime('%Y'),
        '{{ dashboard_link }}': 'http://localhost:8080/candidats',
    }
    
    for key, value in replacements.items():
        subject = subject.replace(key, value)
        body = body.replace(key, value)
    
    # Envoyer l'email
    success, message = send_email(candidate.email, subject, body)
    
    if success:
        return jsonify({
            "success": True, 
            "message": f"Email envoyé à {candidate.email}"
        })
    else:
        return jsonify({"error": message}), 500


# ==================== ENVOI D'EMAILS ====================

@email_templates_bp.route('/email-templates/<int:template_id>/send', methods=['POST'])
@login_required
def send_template_email(template_id):
    """Envoie un email à un candidat spécifique avec une offre spécifique"""
    template = EmailTemplate.query.get_or_404(template_id)
    data = request.json
    candidate_id = data.get('candidate_id')
    application_id = data.get('application_id')
    
    if not candidate_id:
        return jsonify({"error": "candidate_id requis"}), 400
    
    candidate = Candidate.query.get(candidate_id)
    if not candidate:
        return jsonify({"error": "Candidat non trouvé"}), 404
    
    if not template.is_active:
        return jsonify({"error": "Ce template est inactif"}), 400
    
    # Récupérer l'application spécifique
    application = None
    if application_id:
        application = CandidateMany.query.get(application_id)
    
    # Rendre le template
    subject, body = TemplateService.render_template(template, candidate, application)
    
    if not subject or not body:
        return jsonify({"error": "Erreur lors du rendu du template"}), 500
    
    # Envoyer l'email
    success, message = send_email(candidate.email, subject, body)
    
    if success:
        return jsonify({
            "success": True,
            "message": f"Email envoyé à {candidate.first_name} {candidate.last_name} ({candidate.email})"
        })
    else:
        return jsonify({
            "success": False,
            "error": message
        }), 500


@email_templates_bp.route('/email-templates/<int:template_id>/send-batch', methods=['POST'])
@login_required
def send_batch_emails(template_id):
    """Envoie des emails à plusieurs candidats avec leurs offres spécifiques"""
    template = EmailTemplate.query.get_or_404(template_id)
    data = request.json
    selections = data.get('selections', [])
    custom_subject = data.get('custom_subject')
    custom_body = data.get('custom_body')
    
    if not selections:
        return jsonify({"error": "Aucune sélection"}), 400
    
    if not template.is_active:
        return jsonify({"error": "Ce template est inactif"}), 400
    
    results = []
    success_count = 0
    failed_count = 0
    
    for selection in selections:
        candidate_id = selection.get('candidate_id')
        application_id = selection.get('application_id')
        
        if not candidate_id:
            results.append({"error": "candidate_id manquant", "success": False})
            failed_count += 1
            continue
        
        candidate = Candidate.query.get(candidate_id)
        if not candidate:
            results.append({"candidate_id": candidate_id, "error": "Candidat non trouvé", "success": False})
            failed_count += 1
            continue
        
        # Récupérer l'application spécifique
        application = None
        if application_id:
            application = CandidateMany.query.get(application_id)
        
        # Rendre le template
        if custom_subject and custom_body:
            subject = custom_subject
            body = custom_body
            # Remplacer les variables quand même
            data_vars = TemplateService.get_candidate_data(candidate, application)
            for var, value in data_vars.items():
                subject = subject.replace(f"{{{{ {var} }}}}", str(value))
                body = body.replace(f"{{{{ {var} }}}}", str(value))
        else:
            subject, body = TemplateService.render_template(template, candidate, application)
        
        # Envoyer l'email
        success, message = send_email(candidate.email, subject, body)
        
        if success:
            success_count += 1
            results.append({
                "candidate_id": candidate_id,
                "candidate_name": f"{candidate.first_name} {candidate.last_name}",
                "email": candidate.email,
                "success": True
            })
        else:
            failed_count += 1
            results.append({
                "candidate_id": candidate_id,
                "candidate_name": f"{candidate.first_name} {candidate.last_name}",
                "email": candidate.email,
                "success": False,
                "error": message
            })
    
    return jsonify({
        "success": success_count > 0,
        "total": len(selections),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results
    })


# ==================== AUTO EMAIL (selon score) ====================

@email_templates_bp.route('/email-templates/auto-send', methods=['POST'])
@login_required
def auto_send_emails():
    """Envoie automatiquement les emails selon le score du candidat"""
    from app.services.auto_email import AutoEmailService
    
    data = request.json
    selections = data.get('selections', [])
    
    if not selections:
        return jsonify({"error": "Aucune sélection"}), 400
    
    result = AutoEmailService.send_auto_emails(selections)
    
    return jsonify(result)


@email_templates_bp.route('/email-templates/candidates-by-score', methods=['GET'])
@login_required
def get_candidates_by_score():
    """Récupère les candidats groupés par score (Match, Review, Non-match)"""
    from app.services.auto_email import AutoEmailService
    
    result = AutoEmailService.get_candidates_by_score()
    
    return jsonify(result)


@email_templates_bp.route('/email-templates/templates-by-score', methods=['GET'])
@login_required
def get_templates_by_score():
    """Vérifie que tous les templates nécessaires existent"""
    from app.services.auto_email import AutoEmailService
    
    templates = {
        "match": AutoEmailService.get_template_by_score(80),
        "review": AutoEmailService.get_template_by_score(50),
        "non_match": AutoEmailService.get_template_by_score(20)
    }
    
    result = {}
    for key, template in templates.items():
        result[key] = {
            "exists": template is not None,
            "name": template.name_template if template else None,
            "id": template.id_template if template else None
        }
    
    return jsonify(result)


# ==================== TEST D'ENVOI ====================

@email_templates_bp.route('/email-templates/<int:template_id>/test', methods=['POST'])
@login_required
@config_access_required
def test_template_email(template_id):
    """Envoie un email de test avec le template"""
    template = EmailTemplate.query.get_or_404(template_id)
    data = request.json
    test_email = data.get('test_email')
    
    if not test_email:
        return jsonify({"error": "Email de test requis"}), 400
    
    # Prévisualiser avec données d'exemple
    preview = TemplateService.preview_template(template.subject, template.body)
    
    # Envoyer l'email
    success, message = send_email(test_email, f"[TEST] {preview['subject']}", preview['body'])
    
    if success:
        return jsonify({
            "success": True,
            "message": f"Email de test envoyé à {test_email}"
        })
    else:
        return jsonify({
            "success": False,
            "error": message
        }), 500