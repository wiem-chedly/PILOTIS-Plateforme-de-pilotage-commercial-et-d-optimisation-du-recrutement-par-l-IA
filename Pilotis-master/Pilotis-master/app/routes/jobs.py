# app/routes/jobs.py
"""
Blueprint pour les opportunités (AO), sync Boond, génération de posts IA,
stats, debug, permissions.

URL prefix : /api
"""

from flask import Blueprint, jsonify, request, current_app
from datetime import datetime, timedelta
import threading
import uuid
import requests
import os
import json

from concurrent.futures import ThreadPoolExecutor

from app.models.job_requisition import JobRequisition, ImportLog
from app.models.settings import AppSetting
from app.models.permissions import RolePermission
from app.models.contact import Contact
from app.extensions import db
from app.utils.authentification import login_required, config_access_required
from flask import session
from app.models.users import User

def apply_rbac_job_filter(query):
    role = session.get('user_role')
    if not role or role == 'super_admin':
        return query
        
    user_id = session.get('user_id')
    org_id = session.get('organization_id')
    
    user = User.query.get(user_id) if user_id else None
    org_name = user.client_nom if user and user.client_nom else None
    
    if not org_name and org_id:
        from app.models.organization import Organization
        org = Organization.query.get(org_id)
        if org:
            org_name = org.name
            
    if org_name:
        return query.filter(JobRequisition.client_nom == org_name)
    
    return query.filter(JobRequisition.requisition_id == -1)


jobs_bp = Blueprint("jobs", __name__)

_tasks: dict     = {}
post_cache       = {}
cache_lock       = threading.Lock()
executor         = ThreadPoolExecutor(max_workers=3)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _convert_date(date_str: str):
    try:
        jour, mois, an = date_str.split("/")
        an_full = 2000 + int(an) if int(an) < 50 else 1900 + int(an)
        return datetime(an_full, int(mois), int(jour))
    except Exception:
        return None


def _opportunity_dict(b: JobRequisition) -> dict:
    return {
        "id":          b.requisition_id,
        "date":        b.date,
        "titre":       b.titre,
        "client":      b.client_nom,
        "etat":        b.etat_complet,
        "progression": b.progression,
        "manager":     b.manager_nom,
        "budget_ht":   b.budget_ht,
        "date_import": b.date_import.isoformat() if b.date_import else None,
    }


def _opportunity_detail(b: JobRequisition) -> dict:
    return {
        "requisition_id":  b.requisition_id,
        "boond_id":        b.boond_id,
        "reference":       b.reference,
        "date":            b.date,
        "titre":           b.titre,
        "type_offre":      b.type_offre,
        "client_nom":      b.client_nom,
        "contact_nom":     b.contact_nom,
        "statut":          b.statut,
        "progression":     b.progression,
        "etat_complet":    b.etat_complet,
        "manager_nom":     b.manager_nom,
        "agence_nom":      b.agence_nom,
        "devise":          b.devise,
        "budget_ht":       b.budget_ht,
        "ca_pondere":      b.ca_pondere,
        "duree":           b.duree,
        "date_demarrage":  b.date_demarrage,
        "pos_actif":       b.pos_actif,
        "date_import":     b.date_import.isoformat() if b.date_import else None,
        "description":     b.description,
        "criteres":        b.criteres,
    }


# ── OPPORTUNITIES ──────────────────────────────────────────────────────────────

import threading
_opportunity_creation_lock = threading.Lock()

@jobs_bp.route("/opportunities", methods=["GET", "POST"])
def get_opportunities():
    if request.method == "POST":
        with _opportunity_creation_lock:
            data = request.json
            if not data:
                return jsonify({"error": "Données manquantes"}), 400
            if not data.get('titre') or not data.get('client_nom'):
                return jsonify({"error": "Titre et client sont obligatoires"}), 400
            try:
                reference = data.get('reference', '')
                titre = data.get('titre', '')
                client_nom = data.get('client_nom', '')
                
                # Anti-doublon (Référence OU Titre + Client)
                existing = None
                if reference:
                    existing = JobRequisition.query.filter_by(reference=reference).first()
                else:
                    existing = JobRequisition.query.filter_by(titre=titre, client_nom=client_nom).first()

                if existing:
                    return jsonify({
                        "success": False,
                        "error": "Une opportunité identique existe déjà",
                        "existing_id": existing.requisition_id,
                        "existing_titre": existing.titre
                    }), 409
                    
                today = datetime.now().strftime('%d/%m/%Y')
                
                # --- Synchronisation vers BoondManager ---
                boond_id = data.get('boond_id')
                if not boond_id:
                    from app.services.boond_service import BoondService
                    boond_svc = BoondService()
                    created_boond_id = boond_svc.create_opportunity(data)
                    if created_boond_id:
                        boond_id = str(created_boond_id)
                # -----------------------------------------

                new_opp = JobRequisition(
                    boond_id       = boond_id,
                    reference      = reference,
                    date           = data.get('date', today),
                    titre          = data.get('titre', ''),
                    type_offre     = data.get('type_offre', 'Prestation'),
                    client_nom     = data.get('client_nom', ''),
                    contact_nom    = data.get('contact_nom', ''),
                    statut         = data.get('statut', 'En cours'),
                    progression    = data.get('progression', '0/25%'),
                    etat_complet   = data.get('etat_complet', 'En cours 0/25%'),
                    manager_nom    = data.get('manager_nom', ''),
                    agence_nom     = "OMICRONE",
                    devise         = data.get('devise', 'EUR Euro'),
                    budget_ht      = float(data.get('budget_ht', 0)),
                    ca_pondere     = float(data.get('ca_pondere', 0)),
                    duree          = data.get('duree', ''),
                    date_demarrage = data.get('date_demarrage', ''),
                    pos_actif      = data.get('pos_actif', 0),
                    description    = data.get('description', ''),
                    criteres       = data.get('criteres', '')
                )
                db.session.add(new_opp)
                db.session.commit()
                return jsonify({
                    "success": True,
                    "requisition_id": new_opp.requisition_id,
                    "message": "Opportunité créée avec succès"
                }), 201
            except Exception as e:
                db.session.rollback()
                return jsonify({"error": str(e)}), 500

    # GET
    statut_filter     = request.args.get("statut", "all")
    progression_filter = request.args.get("progression", "all")
    semaine_filter    = request.args.get("semaine", "false").lower() == "true"
    query = JobRequisition.query
    query = apply_rbac_job_filter(query)
    if statut_filter == "en_cours":
        query = query.filter(JobRequisition.etat_complet.like("En cours%"))
    if progression_filter != "all":
        query = query.filter(JobRequisition.etat_complet == f"En cours {progression_filter}")
    besoins = query.all()
    if semaine_filter:
        cutoff  = datetime.now() - timedelta(days=7)
        besoins = [b for b in besoins if _convert_date(b.date) and _convert_date(b.date) >= cutoff]
    return jsonify([_opportunity_dict(b) for b in besoins])


@jobs_bp.route("/opportunities/<int:requisition_id>/boond-id", methods=["PUT"])
def update_boond_id(requisition_id):
    data     = request.json
    boond_id = data.get('boond_id')
    if not boond_id:
        return jsonify({"error": "boond_id requis"}), 400
    opp = JobRequisition.query.get(requisition_id)
    if not opp:
        return jsonify({"error": "Opportunité non trouvée"}), 404
    opp.boond_id = str(boond_id)
    db.session.commit()
    return jsonify({"success": True, "message": f"boond_id {boond_id} associé"})


@jobs_bp.route("/opportunities/all")
def get_all_opportunities():
    query = JobRequisition.query
    query = apply_rbac_job_filter(query)
    besoins = query.all()
    result  = [_opportunity_dict(b) for b in besoins]
    return jsonify({
        "count":        len(result),
        "budget_total": sum(b.budget_ht or 0 for b in besoins),
        "opportunites": result,
    })


@jobs_bp.route("/opportunities/cibles")
def get_opportunities_cibles():
    cutoff = datetime.now() - timedelta(days=7)
    query = JobRequisition.query.filter(JobRequisition.etat_complet == "En cours 0/25%")
    query = apply_rbac_job_filter(query)
    toutes = query.all()
    cibles = sorted(
        [c for c in toutes if _convert_date(c.date) and _convert_date(c.date) >= cutoff],
        key=lambda x: _convert_date(x.date) or datetime.min,
        reverse=True,
    )
    result = []
    from app.models.candidate_many import CandidateMany
    from sqlalchemy import func
    for c in cibles:
        opp_dict = _opportunity_dict(c)
        max_score = db.session.query(func.max(CandidateMany.match_score)).filter_by(requisition_id=c.requisition_id).scalar()
        opp_dict["best_match_score"] = int(max_score) if max_score is not None else 0
        result.append(opp_dict)
        
    return jsonify({
        "count":        len(result),
        "budget_total": sum(c.budget_ht or 0 for c in cibles),
        "opportunites": result,
    })



@jobs_bp.route("/opportunities/recent")
def get_opportunities_recent():
    """
    GET /api/opportunities/recent?limit=N
    Retourne les N AOs les plus récemment importés dans Pilotis,
    triés par date_import décroissante. Utilisé par le widget
    "Activités récentes" du Dashboard.
    """
    limit = min(int(request.args.get("limit", 10)), 50)
    query = JobRequisition.query
    query = apply_rbac_job_filter(query)
    aos = (
        query
        .order_by(JobRequisition.date_import.desc())
        .limit(limit)
        .all()
    )
    result = []
    for ao in aos:
        result.append({
            "requisition_id":      ao.requisition_id,
            "titre":               ao.titre,
            "client_nom":          ao.client_nom,
            "etat_complet":        ao.etat_complet,
            "date":                ao.date,
            "date_import":         ao.date_import.isoformat() if ao.date_import else None,
            "responsable_manager": ao.responsable_manager,
            "agence":              ao.agence,
            "budget_ht":           ao.budget_ht,
        })
    return jsonify(result)


@jobs_bp.route("/opportunities/monthly-evolution")
def get_monthly_evolution():
    """
    GET /api/opportunities/monthly-evolution
    Retourne le nombre d'AOs créés par mois sur les 12 derniers mois
    (depuis la base locale Pilotis). Utilisé par le graphique
    "Évolution mensuelle" du Dashboard.
    """
    from collections import defaultdict
    MONTHS_FR = ["","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]

    cutoff = datetime.now() - timedelta(days=365)
    query = JobRequisition.query.filter(
        JobRequisition.date_import >= cutoff
    )
    query = apply_rbac_job_filter(query)
    aos = query.all()

    counts = defaultdict(lambda: {"contrats": 0, "objectifs": 0})

    for ao in aos:
        try:
            dt = ao.date_import
            if not dt:
                continue
            key = (dt.year, dt.month)
            counts[key]["contrats"] += 1
            # objectif arbitraire : 20 % de plus que le réel, min 5
            counts[key]["objectifs"] = max(5, int(counts[key]["contrats"] * 1.2))
        except Exception:
            continue

    # Construire la liste triée des 12 derniers mois
    result = []
    now = datetime.now()
    for i in range(11, -1, -1):
        # mois i en arrière
        target_month = (now.month - i - 1) % 12 + 1
        target_year  = now.year + ((now.month - i - 1) // 12)
        key = (target_year, target_month)
        data = counts.get(key, {"contrats": 0, "objectifs": 0})
        result.append({
            "month":     MONTHS_FR[target_month],
            "contrats":  data["contrats"],
            "objectifs": data["objectifs"],
        })

    return jsonify(result)


@jobs_bp.route("/opportunities/stats")
def get_opportunities_stats():
    cutoff       = datetime.now() - timedelta(days=7)
    etats_cibles = ["En cours 0/25%", "En cours 25/50%", "En cours 50/75%", "En cours 75/90%"]
    query = JobRequisition.query.filter(JobRequisition.etat_complet.like("En cours%"))
    query = apply_rbac_job_filter(query)
    tous_en_cours = query.all()
    stats = {}
    for etat in etats_cibles:
        items = [i for i in tous_en_cours
                 if i.etat_complet == etat and _convert_date(i.date) and _convert_date(i.date) >= cutoff]
        stats[etat] = {"count": len(items), "budget_total": sum(i.budget_ht or 0 for i in items)}
    total_en_cours = sum(1 for i in tous_en_cours if _convert_date(i.date) and _convert_date(i.date) >= cutoff)
    query_all = apply_rbac_job_filter(JobRequisition.query)
    toutes     = query_all.all()
    week_items = [i for i in toutes if _convert_date(i.date) and _convert_date(i.date) >= cutoff]
    return jsonify({
        "par_progression":      stats,
        "total_en_cours":       total_en_cours,
        "total_semaine":        len(week_items),
        "budget_total_semaine": sum(i.budget_ht or 0 for i in week_items),
        "periode":              "7 derniers jours",
    })


@jobs_bp.route("/opportunities/<int:requisition_id>")
def get_opportunity_detail(requisition_id):
    besoin = JobRequisition.query.get(requisition_id)
    if not besoin:
        return jsonify({"error": "Opportunité non trouvée"}), 404
    return jsonify(_opportunity_detail(besoin))


@jobs_bp.route("/opportunities/recent")
def get_recent_opportunities():
    query = JobRequisition.query
    query = apply_rbac_job_filter(query)
    recent = query.order_by(JobRequisition.date_import.desc()).limit(10).all()
    return jsonify([{
        "id":    o.requisition_id,
        "titre": o.titre,
        "client": o.client_nom,
        "date":  o.date_import.isoformat() if o.date_import else None
    } for o in recent])


# ── SYNC BOOND ─────────────────────────────────────────────────────────────────

@jobs_bp.route("/sync", methods=["POST"])
def trigger_sync():
    from app.services.boond_service import BoondService
    app = current_app._get_current_object()

    def run():
        with app.app_context():
            try:
                BoondService().sync_opportunities()
            except Exception as e:
                print(f"❌ Sync error: {e}")

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"success": True, "message": "Synchronisation lancée"})


@jobs_bp.route("/import-logs")
def get_import_logs():
    logs = ImportLog.query.order_by(ImportLog.date_import.desc()).limit(50).all()
    return jsonify([{
        "id":               log.id_logs,
        "date":             log.date_import.isoformat(),
        "statut":           log.statut,
        "message":          log.message,
        "nombre_importes":  log.nombre_importes,
    } for log in logs])


@jobs_bp.route("/test-boond-connection", methods=["POST"])
def test_boond_connection():
    try:
        from app.services.boond_service import BoondService
        service  = BoondService()
        url      = f"{service.base_url}/opportunities"
        response = requests.get(url, headers=service._headers(), params={'page[size]': 1}, timeout=900)
        if response.status_code == 200:
            return jsonify({"success": True, "message": "✅ Connexion réussie !"})
        else:
            return jsonify({"success": False, "message": f"❌ Erreur {response.status_code}"}), 400
    except Exception as e:
        return jsonify({"success": False, "message": f"❌ Impossible de contacter l'API: {str(e)}"}), 500


# ── AI POST GENERATION ────────────────────────────────────────────────────────

def _prepare_prompt(titre: str, description: str = "", criteres: str = "", reference: str = "") -> tuple:
    prompt_setting = AppSetting.query.filter_by(key="ai_prompt").first()
    if not prompt_setting or not prompt_setting.get_value():
        raise ValueError("❌ Aucun prompt AI configuré. Veuillez en créer un dans Configuration.")

    custom_prompt  = prompt_setting.get_value()
    active_contacts = Contact.query.filter_by(is_active=True).all()
    active_emails  = [c.email for c in active_contacts]
    email_count    = len(active_emails)
    email_signature = ",".join(sorted(active_emails)) if active_emails else "aucun"

    if email_count == 0:
        active_message = ""
    elif email_count == 1:
        active_message = f"📩 Envoyez votre CV à : {active_emails[0]}"
    else:
        emails_list    = ", ".join(active_emails[:-1])
        active_message = f"📩 Envoyez votre CV à : {emails_list} ou {active_emails[-1]}"

    # Contourner la limitation stricte du LLM en insérant le lien directement dans la variable {actifs}
    form_setting = AppSetting.query.filter_by(key="google_form_url").first()
    form_url = form_setting.value if form_setting else ""
    if form_url:
        active_message += f"\n📋 Postulez directement ici : {form_url}"

    desc_text = description[:500] if description else "Non spécifiée"
    comp_text = criteres[:300] if criteres else "Non spécifiées"

    try:
        prompt = custom_prompt.format(
            titre       = titre,
            description = desc_text,
            competences = comp_text,
            entreprise  = "OMICRONE",
            localisation = "Paris",
            omicrone    = "📩 Contact : info@omicrone.fr",
            actifs      = active_message,
            reference   = reference or "Non spécifiée",
        )
    except KeyError as e:
        print(f"❌ Erreur de formatage du prompt: {e}")
        prompt = f"""Génère un post LinkedIn pour recruter un(e) {titre} chez OMICRONE à Paris (Référence: {reference or 'Non spécifiée'}).

DESCRIPTION DU POSTE :
{desc_text}

COMPÉTENCES RECHERCHÉES :
{comp_text}

📩 Contact : info@omicrone.fr
{active_message}

IMPORTANT: Réponds UNIQUEMENT en français."""
        print(f"⚠️ Fallback utilisé à cause de l'erreur: {e}")

    prompt    += "\n\nIMPORTANT: Réponds UNIQUEMENT en français. Ne traduis jamais en chinois ou autre langue. Utilise seulement le français. Ne mélange pas les langues."
    cache_key  = f"{titre}_{reference}_{email_signature}_{form_url}"
    return prompt, cache_key


def _generate_post(titre: str, task_id: str, prompt: str, cache_key: str):
    try:
        with cache_lock:
            if cache_key in post_cache:
                _tasks[task_id] = {"status": "finished", "result": {"post": post_cache[cache_key]}}
                return

        ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
        start_time = datetime.now()
        response   = requests.post(
            ollama_url,
            json={"model": "qwen2.5:7b", "prompt": prompt, "stream": False, "options": {"num_predict": 400, "temperature": 0.3}},
            timeout=900
        )
        elapsed = (datetime.now() - start_time).total_seconds()
        response.raise_for_status()
        generated = response.json()["response"]
        print(f"✅ Post généré en {elapsed:.1f}s — {len(generated)} caractères")

        with cache_lock:
            post_cache[cache_key] = generated

        _tasks[task_id] = {"status": "finished", "result": {"post": generated}}

    except requests.exceptions.Timeout:
        _tasks[task_id] = {"status": "failed", "error": "Timeout — Le modèle est trop lent"}
    except Exception as e:
        _tasks[task_id] = {"status": "failed", "error": str(e)}


@jobs_bp.route("/generate_linkedin_post", methods=["POST"])
def generate_linkedin_post():
    data  = request.get_json()
    titre = data.get("titre")
    description = data.get("description", "")
    criteres = data.get("criteres", "")
    reference = data.get("reference", "")
    
    if not titre:
        return jsonify({"error": "Titre requis"}), 400

    task_id = str(uuid.uuid4())
    try:
        prompt, cache_key = _prepare_prompt(titre, description, criteres, reference)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Erreur de préparation: {str(e)}"}), 500

    with cache_lock:
        if cache_key in post_cache:
            _tasks[task_id] = {"status": "finished", "result": {"post": post_cache[cache_key]}}
            return jsonify({"task_id": task_id, "status": "queued", "cached": True})

    _tasks[task_id] = {"status": "processing"}
    executor.submit(_generate_post, titre, task_id, prompt, cache_key)
    queue_size = executor._work_queue.qsize() if hasattr(executor, '_work_queue') else 0
    return jsonify({
        "task_id":        task_id,
        "status":         "queued",
        "queue_position": queue_size + 1,
        "estimated_time": f"{(queue_size + 1) * 3} minutes"
    })


@jobs_bp.route("/task_status/<task_id>")
def task_status(task_id):
    task = _tasks.get(task_id)
    if not task:
        return jsonify({"status": "not_found"}), 404
    return jsonify(task)


# ── PERMISSIONS ────────────────────────────────────────────────────────────────

@jobs_bp.route('/permissions')
@login_required
def get_permissions():
    permissions = RolePermission.query.all()
    result = {}
    for perm in permissions:
        if perm.role not in result:
            result[perm.role] = {}
        result[perm.role][perm.page] = perm.can_view
    return jsonify(result)


@jobs_bp.route('/permissions', methods=['POST'])
@login_required
@config_access_required
def update_permissions():
    data = request.json
    for role, pages in data.items():
        for page, can_view in pages.items():
            perm = RolePermission.query.filter_by(role=role, page=page).first()
            if perm:
                perm.can_view = can_view
            else:
                db.session.add(RolePermission(role=role, page=page, can_view=can_view))
    db.session.commit()
    return jsonify({'success': True})


# ── DEBUG ──────────────────────────────────────────────────────────────────────

@jobs_bp.route("/debug/etats")
def debug_etats():
    en_cours     = JobRequisition.query.filter(JobRequisition.etat_complet.like("En cours%")).all()
    distribution = {}
    for item in en_cours:
        distribution[item.etat_complet] = distribution.get(item.etat_complet, 0) + 1
    exemples = [{
        "id":    e.requisition_id,
        "titre": (e.titre[:50] + "…") if len(e.titre) > 50 else e.titre,
        "etat":  e.etat_complet,
        "date":  e.date,
    } for e in en_cours[:10]]
    return jsonify({
        "total_en_cours": len(en_cours),
        "distribution":   distribution,
        "exemples":        exemples,
    })


@jobs_bp.route("/debug/origins")
def debug_origins():
    """
    Inspecte l'origine de chaque AO en base locale.
    boond_id = NULL  → créé manuellement dans Pilotis (pas sync Boond)
    boond_id = XXXXX → importé depuis BoondManager
    """
    tous = JobRequisition.query.order_by(JobRequisition.date_import.desc()).all()

    manuels  = [a for a in tous if not a.boond_id]
    boond    = [a for a in tous if a.boond_id]

    def _fmt(a):
        return {
            "id":          a.requisition_id,
            "titre":       a.titre,
            "client":      a.client_nom,
            "date":        a.date,
            "etat":        a.etat_complet,
            "boond_id":    a.boond_id or "❌ NULL (manuel)",
            "date_import": a.date_import.isoformat() if a.date_import else None,
        }

    # Focus sur les AOs "En cours 0/25%" qui posent problème
    focus = [a for a in tous if a.etat_complet == "En cours 0/25%"]

    return jsonify({
        "total_en_base":        len(tous),
        "depuis_boondmanager":  len(boond),
        "crees_manuellement":   len(manuels),
        "focus_en_cours_0_25":  [_fmt(a) for a in focus],
        "aos_manuels":          [_fmt(a) for a in manuels[:20]],
    })


@jobs_bp.route("/debug/boond-raw/<boond_id>")
def debug_boond_raw(boond_id):
    """
    Récupère les données brutes depuis l'API BoondManager pour un AO donné.
    Utile pour diagnostiquer les bugs de mapping de progression.
    Ex: GET /api/debug/boond-raw/2135
    """
    try:
        from app.services.boond_service import BoondService
        import requests as _req

        svc = BoondService()
        url = f"{svc.base_url}/opportunities/{boond_id}"
        resp = _req.get(url, headers=svc._headers(), timeout=900)

        if resp.status_code != 200:
            return jsonify({
                "error": f"Boond API returned {resp.status_code}",
                "body":  resp.text[:500]
            }), resp.status_code

        raw = resp.json()
        attrs = (raw.get("data") or {}).get("attributes", {})

        # Extrait les champs clés pour le diagnostic
        return jsonify({
            "boond_id":        boond_id,
            "raw_state":       attrs.get("state"),
            "raw_stateReason": attrs.get("stateReason"),
            "raw_title":       attrs.get("title"),
            "raw_reference":   attrs.get("reference"),
            "raw_progression": attrs.get("progression"),
            "raw_progress":    attrs.get("progress"),
            "raw_step":        attrs.get("step"),
            "raw_customFields": attrs.get("customFields"),
            # Données complètes pour inspection
            "full_attributes": attrs,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ── SOURCING PROACTIF ──────────────────────────────────────────────────────────

@jobs_bp.route("/opportunities/<int:requisition_id>/matching-candidates", methods=["GET"])
def get_matching_candidates(requisition_id):
    """
    Sourcing proactif : recherche dans le vivier les candidats libres correspondant
    à une offre donnée. Exclut les candidats déjà assignés à un poste.
    
    Returns JSON: { matching_candidates: [...], total_scanned: N, job_titre: str }
    """
    from app.models.candidate import Candidate
    from app.services.ai_analyzer import smart_match
    import json as _json

    # 1. Vérifier que l'offre existe
    job = JobRequisition.query.get(requisition_id)
    if not job:
        return jsonify({"error": "Opportunité non trouvée"}), 404

    # 2. Récupérer les candidats libres (non assignés à un poste validé)
    #    On inclut ceux avec status "suggested" car pas encore confirmés
    available_candidates = Candidate.query.filter(
        Candidate.job_requisition_id.is_(None),
        Candidate.cv_profile.isnot(None)
    ).all()

    total_scanned = len(available_candidates)
    results = []

    job_titre    = job.titre or ""
    job_desc     = job.description or ""
    job_criteres = job.criteres or ""

    # 3. Scorer chaque candidat disponible
    for candidate in available_candidates:
        try:
            profile = _json.loads(candidate.cv_profile)
            if not profile:
                continue

            score, justif, explanation, confidence = smart_match(
                profile, job_titre, job_desc, job_criteres
            )

            # Filtrer les profils trop faibles (< 30%)
            if score < 30:
                continue

            results.append({
                "id":            candidate.id_candidate,
                "last_name":     candidate.last_name or "",
                "first_name":    candidate.first_name or "",
                "email":         candidate.email or "",
                "phone":         candidate.phone or "",
                "source":        candidate.source or "",
                "score":         score,
                "justification": justif,
                "explanation":   explanation,
                "confidence":    confidence,
                "cv_path":       bool(candidate.cv_path),
                "skills":        _json.loads(candidate.skills) if candidate.skills else [],
                "link_status":   candidate.link_status,
                "location":      candidate.location or "",
            })
        except Exception as e:
            print(f"[Sourcing] Erreur candidat {candidate.id_candidate}: {e}")
            continue

    # 4. Trier par score décroissant
    results.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "job_titre":           job_titre,
        "job_id":              requisition_id,
        "total_scanned":       total_scanned,
        "total_matched":       len(results),
        "matching_candidates": results,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# MODULE WIEM — Extraction OCR depuis image + Drive + Cache IA
# ═══════════════════════════════════════════════════════════════════════════════

# ── POST /extract-ao-from-image (version améliorée Wiem) ──────────────────────
@jobs_bp.route("/extract-ao-from-image-v2", methods=["POST"])
def extract_ao_from_image_v2():
    """
    Version améliorée de l'extraction OCR (Wiem) :
    - Limite 10MB
    - apply_clean=True (nettoyage structuré : RÉSUMÉ/CONTEXTE/DÉTAILS)
    - Timer d'analyse
    """
    import tempfile
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Fichier vide"}), 400

    if hasattr(file, 'content_length') and file.content_length and file.content_length > 10 * 1024 * 1024:
        return jsonify({"error": "Fichier trop volumineux (max 10 MB)"}), 400

    temp_path = None
    start_time = datetime.now()

    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            temp_path = tmp.name

        from app.services.ocr_service import extract_ao_data_from_image
        extracted_data = extract_ao_data_from_image(temp_path, apply_clean=True)

        elapsed = (datetime.now() - start_time).total_seconds()

        if extracted_data and extracted_data.get('titre'):
            extracted_data['_analysis_time_seconds'] = round(elapsed, 2)
            return jsonify({"success": True, "data": extracted_data})
        else:
            return jsonify({
                "success": False,
                "error": "Impossible d'extraire les données",
                "partial_data": extracted_data if extracted_data else None
            }), 400

    except Exception as e:
        print(f"❌ Erreur extraction OCR v2: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


# ── GET/POST /drive/credentials ───────────────────────────────────────────────
@jobs_bp.route("/drive/credentials", methods=["GET"])
@login_required
@config_access_required
def get_drive_credentials():
    """Récupère les credentials Drive configurés."""
    from app.models.settings import DriveCredentials
    creds = DriveCredentials.query.first()
    if not creds:
        return jsonify({"exists": False})
    return jsonify({
        "exists": True,
        "client_id": creds.client_id,
        "project_id": creds.project_id,
        "folder_id": creds.folder_id,
        "has_secret": bool(creds.client_secret)
    })


@jobs_bp.route("/drive/credentials", methods=["POST"])
@login_required
@config_access_required
def save_drive_credentials():
    """Sauvegarde les credentials Drive."""
    from app.services.drive_db_service import DriveDBService
    data = request.json
    if not data.get('client_id') or not data.get('client_secret'):
        return jsonify({"error": "Client ID et Client Secret requis"}), 400
    DriveDBService.save_credentials(
        client_id=data['client_id'],
        client_secret=data['client_secret'],
        project_id=data.get('project_id'),
        folder_id=data.get('folder_id'),
        auth_uri=data.get('auth_uri', "https://accounts.google.com/o/oauth2/auth"),
        token_uri=data.get('token_uri', "https://oauth2.googleapis.com/token")
    )
    return jsonify({"success": True, "message": "Credentials sauvegardés"})


# ── GET /drive/status ─────────────────────────────────────────────────────────
@jobs_bp.route("/drive/status", methods=["GET"])
@login_required
@config_access_required
def get_drive_status():
    """Vérifie si Google Drive est connecté."""
    from app.models.settings import DriveToken
    token = DriveToken.query.first()
    connected = token is not None
    return jsonify({
        "connected": connected,
        "email": "Compte Google connecté" if connected else None,
        "message": "Connecté à Google Drive" if connected else "Non connecté"
    })


# ── POST /drive/disconnect ────────────────────────────────────────────────────
@jobs_bp.route("/drive/disconnect", methods=["POST"])
@login_required
@config_access_required
def disconnect_drive():
    """Déconnecte Google Drive."""
    from app.services.drive_db_service import DriveDBService
    DriveDBService.clear_token()
    return jsonify({"success": True, "message": "Déconnecté de Google Drive"})


# ── GET /drive/auth-url ───────────────────────────────────────────────────────
@jobs_bp.route("/drive/auth-url", methods=["GET"])
@login_required
@config_access_required
def get_drive_auth_url():
    """Génère l'URL OAuth Google Drive."""
    from flask import session as flask_session
    from app.services.drive_db_service import DriveDBService
    try:
        auth_url, state = DriveDBService.get_auth_url()
        flask_session['drive_flow_state'] = state
        return jsonify({"auth_url": auth_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ── GET /drive/callback ───────────────────────────────────────────────────────
@jobs_bp.route("/drive/callback", methods=["GET"])
def drive_callback():
    """Callback OAuth Google Drive."""
    from flask import session as flask_session, redirect
    from app.services.drive_db_service import DriveDBService
    code = request.args.get('code')
    if not code:
        return jsonify({"error": "Code manquant"}), 400
    try:
        DriveDBService.exchange_code(code)
        flask_session.pop('drive_flow_state', None)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
        return redirect(f"{frontend_url}/config?drive=connected")
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ── GET /ia-cache-stats ───────────────────────────────────────────────────────
@jobs_bp.route("/ia-cache-stats", methods=["GET"])
def get_ia_cache_stats():
    """Statistiques du cache IA."""
    try:
        from app.services.ai_analyzer import _match_cache
        size = len(_match_cache)
        return jsonify({"cache_size": size, "message": f"{size} entrées en cache"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── POST /ia-cache-clear ──────────────────────────────────────────────────────
@jobs_bp.route("/ia-cache-clear", methods=["POST"])
def clear_ia_cache():
    """Vide le cache IA."""
    try:
        from app.services.ai_analyzer import _match_cache
        _match_cache.clear()
        return jsonify({"success": True, "message": "Cache IA vidé"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500