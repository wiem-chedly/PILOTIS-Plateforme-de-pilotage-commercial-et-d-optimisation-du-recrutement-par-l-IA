from flask import Blueprint, request, jsonify
from app.models.organization import Organization
from app.extensions import db
from app.services.company_enricher import enrich_company_data, generate_random_secret_key
from app.utils.authentification import login_required, role_required

org_auth_bp = Blueprint('org_auth', __name__, url_prefix='/api/organization')


@org_auth_bp.route('/enrich', methods=['GET'])
def enrich():
    """Route d'enrichissement automatique depuis l'URL du site"""
    url = request.args.get('url', '')
    name = request.args.get('name', '')
    
    if not url and not name:
        return jsonify({'error': 'URL or Name is required'}), 400

    try:
        data = enrich_company_data(url, name)
        return jsonify(data), 200
    except Exception as e:
        # Always return valid JSON so CORS headers are present
        return jsonify({
            'success': False,
            'error': str(e),
            'name': name,
            'website': url,
            'phone': '',
            'contact_email': '',
            'sector': 'TECHNOLOGY',
            'num_employees': 10,
            'description': '',
            'linkedin_url': '',
        }), 200


@org_auth_bp.route('/register', methods=['POST'])
@login_required
@role_required('super_admin')
def register_organization():
    """
    Crée une nouvelle organisation (entreprise cliente).
    Seul le super_admin peut appeler cette route.
    Aucun utilisateur/manager n'est créé ici — le manager est ajouté séparément
    depuis la page Configuration > Utilisateurs.
    """
    data = request.json
    if not data or not data.get('name'):
        return jsonify({'error': 'Le nom de la société est obligatoire.'}), 400

    # Vérifier si une organisation avec ce nom existe déjà
    existing = Organization.query.filter(
        Organization.name.ilike(data['name'].strip())
    ).first()
    if existing:
        return jsonify({'error': f'Une entreprise nommée "{data["name"]}" existe déjà.'}), 400

    # Créer l'organisation
    org = Organization(
        name=data['name'].strip(),
        website=data.get('website'),
        email=data.get('contact_email'),
        phone=data.get('phone'),
        sector=data.get('sector', 'TECHNOLOGY'),
        num_employees=int(data.get('num_employees', 10)),
        description=data.get('description'),
        linkedin_url=data.get('linkedin_url'),
        secret_key=generate_random_secret_key()
    )
    
    db.session.add(org)
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'message': f'Entreprise "{org.name}" créée avec succès.',
        'organization': {'id': org.id, 'name': org.name}
    }), 201