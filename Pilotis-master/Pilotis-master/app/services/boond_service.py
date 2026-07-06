import os
import time
import json
import hmac
import hashlib
import base64
import logging
import requests
import re
import math
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

from app.models.settings import AppSetting, LinkedInAccount
from app.models.job_requisition import JobRequisition, ImportLog
from app.models.contact import Contact
from app.models.post_validation import PostValidation
from app.extensions import db
from app.utils.notifications import send_email, send_sms

load_dotenv()

logger = logging.getLogger(__name__)

MAX_PAGES = 200

# ── State mapping (shared) ────────────────────────────────────────────────────
BOOND_STATE_MAP: dict = {
    0: "Prospect",
    1: "Client",
    2: "Partenaire",
    3: "Archivé",
    4: "Autre",
    5: "Autre",
    6: "Partenaire",
    7: "Partenaire",
    8: "Autre",
    9: "Autre",
}

# ── BoondManager action type codes ────────────────────────────────────────────
ACTION_TYPE_APPEL        = 61
ACTION_TYPE_SUIVI        = 11
ACTION_TYPE_RDV          = 60
ACTION_TYPE_EMAIL        = 62
ACTION_TYPE_PRESENTATION = 10
ACTION_TYPE_CV_CANDIDAT  = 0
ACTION_TYPES_ENTRETIEN   = {12, 40, 43, 60}
ACTION_TYPES_CV          = {10, 0}
ACTION_TYPE_CV           = 10
ACTION_TYPE_CONTRAT      = -1


def base64url_encode(data: str) -> str:
    return base64.urlsafe_b64encode(data.encode()).rstrip(b'=').decode()


def build_jwt(user_token: str, client_token: str, client_key: str) -> str:
    header = json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":"))
    payload = json.dumps({
        "userToken": user_token,
        "clientToken": client_token,
        "time": int(time.time()),
        "mode": "normal"
    }, separators=(",", ":"))
    h = base64url_encode(header)
    p = base64url_encode(payload)
    sig = base64.urlsafe_b64encode(
        hmac.new(client_key.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{h}.{p}.{sig}"


def build_auth_header() -> str:
    service = BoondService()
    return build_jwt(
        service.user_token,
        service.client_token,
        service.client_key,
    )


_PROGRESSION_VALUES = {"0/25%", "25/50%", "50/75%", "75/90%"}
_PROGRESSION_CODE_MAP = {
    "1": "0/25%", "2": "25/50%", "3": "50/75%", "4": "75/90%",
    "5": "50/75%", "6": "75/90%",
    1: "0/25%", 2: "25/50%", 3: "50/75%", 4: "75/90%",
    5: "50/75%", 6: "75/90%",
}

_TYPE_LIBELLE = {1: "Régie", 2: "Forfait", 3: "Portage", 4: "Prestation"}
_DEVISE_MAP   = {0: "EUR Euro", 1: "USD Dollar", 2: "GBP Livre"}
_STATUT_MAP   = {
    0: "En cours", 1: "Gagné", 2: "Perdu",
    3: "Abandonné", 4: "Reporté", 5: "En cours", 6: "En cours",
}

def _trunc(value, max_len: int) -> str:
    s = str(value) if value is not None else ""
    return s[:max_len]

def _format_date(iso_date: str) -> str:
    try:
        d = iso_date[:10]
        return f"{d[8:10]}/{d[5:7]}/{d[2:4]}"
    except Exception:
        return ""

_STATE_TO_PROGRESSION = {5: "50/75%", 6: "75/90%"}

def _get_progression(attrs: dict) -> str:
    state = attrs.get("state")
    sr = attrs.get("stateReason") or {}
    if isinstance(sr, dict):
        detail = sr.get("detail", "")
        if detail in _PROGRESSION_VALUES:
            return detail
        if detail and str(detail) in _PROGRESSION_CODE_MAP:
            return _PROGRESSION_CODE_MAP[str(detail)]
    if state in _STATE_TO_PROGRESSION:
        return _STATE_TO_PROGRESSION[state]
    if state == 0:
        return "0/25%"
    for field in ("progression", "progress", "step", "currentStep", "statusDetail"):
        val = attrs.get(field, "")
        if val in _PROGRESSION_VALUES:
            return val
        if str(val) in _PROGRESSION_CODE_MAP:
            return _PROGRESSION_CODE_MAP[str(val)]
    for v in (attrs.get("customFields") or {}).values():
        if v in _PROGRESSION_VALUES:
            return v
    for val in attrs.values():
        if isinstance(val, str):
            if val in _PROGRESSION_VALUES:
                return val
            m = re.search(r"(\d+)/(\d+)%", val)
            if m:
                candidate = f"{m.group(1)}/{m.group(2)}%"
                if candidate in _PROGRESSION_VALUES:
                    return candidate
    return ""

def _get_relation(relations: dict, type_name: str, item_id) -> dict:
    if not item_id:
        return {}
    return relations.get(f"{type_name}_{item_id}", {})


# ==================== MULTI-TENANT HELPER (POUR SCHEDULER) ====================

def _get_default_organization_id():
    """
    Récupère la première organisation existante en base de données.
    Utilisé quand il n'y a pas de session HTTP (scheduler).
    """
    try:
        from app.models.organization import Organization
        org = Organization.query.first()
        if org:
            logger.info(f"[Multi-Tenant] Organisation par défaut trouvée: {org.name} (ID: {org.id})")
            return org.id
        else:
            logger.warning("[Multi-Tenant] Aucune organisation trouvée en base")
            return None
    except Exception as e:
        logger.error(f"[Multi-Tenant] Erreur récupération organisation: {e}")
        return None


def _get_current_organization_id():
    """
    Récupère l'ID de l'organisation de manière 100% automatique :
    - En contexte HTTP (requête utilisateur) : depuis la session de l'utilisateur connecté
    - En contexte scheduler (pas de requête) : depuis la base de données (première organisation)
    """
    try:
        from flask import has_request_context, session
        
        # Cas 1: Contexte HTTP avec utilisateur connecté
        if has_request_context() and session.get('organization_id'):
            org_id = session.get('organization_id')
            logger.debug(f"[Multi-Tenant] Organisation depuis session: {org_id}")
            return org_id
    except Exception as e:
        logger.debug(f"[Multi-Tenant] Pas de session HTTP valide: {e}")
    
    # Cas 2: Pas de contexte HTTP (scheduler) ou pas d'utilisateur connecté
    logger.debug("[Multi-Tenant] Utilisation de l'organisation par défaut (base de données)")
    return _get_default_organization_id()


class BoondService:
    def __init__(self):
        self.base_url = self._get_setting('boond_api_url')
        self.client_key = self._get_setting('boond_client_key')
        self.client_token = self._get_setting('boond_client_token')
        self.user_token = self._get_setting('boond_user_token')
        
        missing = []
        if not self.base_url: missing.append('boond_api_url')
        if not self.client_key: missing.append('boond_client_key')
        if not self.client_token: missing.append('boond_client_token')
        if not self.user_token: missing.append('boond_user_token')
        
        if missing:
            error_msg = f"Configurations manquantes: {', '.join(missing)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info(f"✅ BoondService initialisé avec URL: {self.base_url}")

    def _get_setting(self, key):
        setting = AppSetting.query.filter_by(key=key).first()
        if setting:
            return setting.get_value()
        return None

    def _headers(self) -> Dict:
        return {
            "Accept": "application/json",
            "X-Jwt-Client-Boondmanager": build_jwt(
                self.user_token, self.client_token, self.client_key
            ),
        }

    def _paginate(self, endpoint: str, params: Dict = None, max_pages: int = MAX_PAGES) -> List[Dict]:
        params = params.copy() if params else {}
        all_items = []
        page = 1
        page_size = 500

        while page <= max_pages:
            try:
                params["maxResults"] = page_size
                params["page"] = page

                resp = requests.get(
                    f"{self.base_url}/{endpoint}",
                    headers=self._headers(),
                    params=params,
                    timeout=900,
                )
                resp.raise_for_status()
                body = resp.json()
                data = body.get("data", [])

                if not data:
                    break

                all_items.extend(data)

                if len(data) < page_size:
                    break

                links = body.get("links") or {}
                if links and not links.get("next"):
                    break

                meta = body.get("meta") or {}
                total = meta.get("total") or meta.get("totalCount") or meta.get("count") or meta.get("totalItems")
                if total is not None and len(all_items) >= int(total):
                    break

                page += 1
            except Exception as e:
                logger.error(f"Erreur pagination {endpoint}: {e}")
                break

        return all_items

    def get_companies(self) -> List[Dict]:
        return self._paginate("companies", max_pages=5)

    def get_projects(self, year: int = None) -> List[Dict]:
        all_projects = self._paginate("projects", max_pages=20)
        if year is None:
            return all_projects
        filtered = []
        for proj in all_projects:
            attrs = proj.get("attributes") or {}
            start = (attrs.get("startDate") or "")[:4]
            end = (attrs.get("endDate") or "")[:4]
            try:
                if end and int(end) < year:
                    continue
                if start and int(start) > year:
                    continue
            except (ValueError, TypeError):
                pass
            filtered.append(proj)
        return filtered

    def get_all_contacts(self, start_date: str = None, end_date: str = None) -> List[Dict]:
        params = {}
        if start_date or end_date:
            params["period"] = "created"
            if start_date:
                params["startDate"] = start_date
            if end_date:
                params["endDate"] = end_date
        return self._paginate("contacts", params=params, max_pages=MAX_PAGES)

    def get_all_actions(self, start_date: str = None, end_date: str = None, type_of: int = None) -> List[Dict]:
        params: dict = {"period": "started"}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        if type_of is not None:
            params["typeOf"] = type_of
        return self._paginate("actions", params=params, max_pages=MAX_PAGES)

    def get_positionings(self, start_date: str = None, end_date: str = None) -> List[Dict]:
        params: dict = {}
        if start_date or end_date:
            params["period"] = "updated"
            if start_date:
                params["startDate"] = start_date
            if end_date:
                params["endDate"] = end_date
        return self._paginate("positionings", params=params, max_pages=MAX_PAGES)

    def get_opportunities(self, start_date: str = None, end_date: str = None) -> List[Dict]:
        params: dict = {}
        if start_date:
            params["period"] = "created"
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        try:
            return self._paginate("opportunities", params=params, max_pages=20)
        except Exception as exc:
            logger.warning(f"get_opportunities failed: {exc}")
            return []

    def get_resources(self) -> List[Dict]:
        return self._paginate("resources", params={}, max_pages=10)

    def get_users(self) -> List[Dict]:
        return self._paginate("managers", params={}, max_pages=10)

    def _fetch_opportunities_page(self, page: int, per_page: int) -> Optional[requests.Response]:
        params = {
            "page": page,
            "per_page": per_page,
            "include": "company,contact,mainManager,agency,notes,customFields",
            "sort": "-createdAt",
            "filter[status]": "all",
        }
        for attempt in range(3):
            try:
                resp = requests.get(
                    f"{self.base_url}/opportunities",
                    headers=self._headers(),
                    params=params,
                    timeout=900,
                )
                if resp.status_code == 200:
                    return resp
            except Exception:
                pass
            if attempt < 2:
                time.sleep(2 ** attempt)
        return None

    def create_opportunity(self, opp_data: dict) -> str:
        client_nom = opp_data.get('client_nom', '')
        title = opp_data.get('titre', 'Nouvelle Opportunité')
        reference = opp_data.get('reference', '')
        
        try:
            if reference:
                existing = JobRequisition.query.filter_by(reference=reference).first()
            elif title and client_nom:
                existing = JobRequisition.query.filter_by(titre=title, client_nom=client_nom).first()
            else:
                existing = None
                
            if existing and existing.boond_id:
                logger.info(f"Opportunité déjà dans BoondManager (ID: {existing.boond_id})")
                return existing.boond_id
        except Exception as e:
            logger.warning(f"Impossible de vérifier l'anti-doublon local: {e}")

        attributes = {
            "title": title,
            "description": opp_data.get('description', ''),
            "reference": reference
        }
        
        state_map = {
            "Nouveau": 0, "En cours": 0, "Soumis": 0,
            "Gagné": 1, "Perdu": 2, "Abandonné": 3
        }
        statut_str = opp_data.get('statut', 'En cours')
        attributes["state"] = state_map.get(statut_str, 0)
        
        budget = opp_data.get('budget_ht')
        if budget:
            try:
                attributes['estimatesExcludingTax'] = float(budget)
            except:
                pass
                
        date_dem = opp_data.get('date_demarrage', '')
        if date_dem and '/' in date_dem:
            try:
                parts = date_dem.split('/')
                if len(parts) == 3:
                    attributes['startDate'] = f"{parts[2]}-{parts[1]}-{parts[0]}"
            except:
                pass
        
        payload = {
            "data": {
                "type": "opportunities",
                "attributes": attributes
            }
        }
        
        if client_nom:
            try:
                from app.models.company import Company
                company = Company.query.filter(Company.name.ilike(client_nom)).order_by(Company.id.asc()).first()
                if not company:
                    company = Company.query.filter(Company.name.ilike(f"%{client_nom}%")).order_by(Company.id.asc()).first()
                    
                if company and company.boond_id:
                    contact_id = None
                    try:
                        c_resp = requests.get(f"{self.base_url}/contacts", headers=self._headers(), params={'companies': company.boond_id, 'maxResults': 1})
                        if c_resp.status_code == 200:
                            c_data = c_resp.json().get('data', [])
                            if c_data:
                                contact_id = c_data[0]['id']
                    except Exception:
                        pass
                        
                    if not contact_id:
                        try:
                            ct_payload = {
                                'data': {
                                    'type': 'contact',
                                    'attributes': {'firstName': '-', 'lastName': '-'},
                                    'relationships': {
                                        'company': {
                                            'data': {'type': 'company', 'id': str(company.boond_id)}
                                        }
                                    }
                                }
                            }
                            ct_resp = requests.post(f"{self.base_url}/contacts", headers=self._headers(), json=ct_payload)
                            if ct_resp.status_code in [200, 201]:
                                contact_id = ct_resp.json()['data']['id']
                        except Exception:
                            pass
                    
                    if contact_id:
                        payload["data"]["relationships"] = {
                            "company": {
                                "data": {"type": "company", "id": str(company.boond_id)}
                            },
                            "contact": {
                                "data": {"type": "contact", "id": str(contact_id)}
                            }
                        }
            except Exception as e:
                logger.warning(f"Erreur recherche company locale: {e}")
                
        try:
            url = f"{self.base_url}/opportunities"
            r = requests.post(url, headers=self._headers(), json=payload)
            r.raise_for_status()
            data = r.json()
            return data.get('data', {}).get('id')
        except Exception as e:
            logger.error(f"Erreur création opportunité: {e}")
            return None

    def fetch_all_opportunities(self) -> List[dict]:
        PER_PAGE = 100
        all_records = []
        page = 1
        total_pages = 1

        logger.info("=== Fetching opportunities from BoondManager ===")

        resp = self._fetch_opportunities_page(page, PER_PAGE)
        if not resp:
            logger.error("Failed to fetch page 1")
            return []

        body = resp.json()
        total_rows = int(resp.headers.get("X-Total-Count", 0))
        if total_rows == 0:
            total_rows = body.get("meta", {}).get("totals", {}).get("rows", 0)
        requisitions = body.get("data", [])
        page_size_real = len(requisitions)

        if total_rows > 0 and page_size_real > 0:
            total_pages = math.ceil(total_rows / page_size_real)

        relations = {f"{item['type']}_{item['id']}": item.get("attributes", {}) for item in body.get("included", [])}
        for req in requisitions:
            all_records.append({"requisition": req, "relations": relations, "from_boond_sync": True})

        for page in range(2, total_pages + 1):
            resp = self._fetch_opportunities_page(page, PER_PAGE)
            if not resp:
                logger.error(f"Failed page {page} — stopping")
                break
            body = resp.json()
            requisitions = body.get("data", [])
            if not requisitions:
                break
            relations = {f"{item['type']}_{item['id']}": item.get("attributes", {}) for item in body.get("included", [])}
            for req in requisitions:
                all_records.append({"requisition": req, "relations": relations, "from_boond_sync": True})
            time.sleep(0.5)

        return all_records

    def _build_requisition_data(self, req_data: dict) -> dict:
        req = req_data["requisition"]
        relations = req_data["relations"]
        attrs = req.get("attributes", {})
        rels = req.get("relationships", {})

        def rel_attrs(rel_key, type_name):
            rel_data = (rels.get(rel_key) or {}).get("data") or {}
            return _get_relation(relations, type_name, rel_data.get("id"))

        client = rel_attrs("company", "company")
        contact = rel_attrs("contact", "contact")
        manager = rel_attrs("mainManager", "resource")
        agency = rel_attrs("agency", "agency")

        statut = _STATUT_MAP.get(attrs.get("state", 0), "En cours")
        progression = _get_progression(attrs)
        etat_complet = f"{statut} {progression}" if progression else statut

        description = ""
        criteres = ""

        for rel_key, rel_value in relations.items():
            if rel_key.startswith("note_"):
                note_text = rel_value.get('content') or rel_value.get('text') or ''
                if note_text:
                    description += note_text + "\n"

        custom_fields = attrs.get('customFields')
        if isinstance(custom_fields, dict):
            desc_custom = custom_fields.get('description') or custom_fields.get('comment') or ''
            if desc_custom:
                description = desc_custom
            crit_custom = custom_fields.get('criteres') or custom_fields.get('requiredSkills') or ''
            if crit_custom:
                criteres = crit_custom

        return {
            "boond_id": _trunc(req["id"], 100),
            "reference": _trunc(attrs.get("reference", ""), 50),
            "date": _trunc(_format_date(attrs.get("creationDate", "")), 20),
            "titre": _trunc(attrs.get("title", ""), 200),
            "type_offre": _trunc(_TYPE_LIBELLE.get(attrs.get("typeOf", 1), f"Type {attrs.get('typeOf', 1)}"), 50),
            "client_nom": _trunc(client.get("name", ""), 200),
            "contact_nom": _trunc(f"{contact.get('firstName', '')} {contact.get('lastName', '')}".strip(), 200),
            "statut": _trunc(statut, 50),
            "progression": _trunc(progression, 20),
            "etat_complet": _trunc(etat_complet, 100),
            "manager_nom": _trunc(f"{manager.get('firstName', '')} {manager.get('lastName', '')}".strip(), 200),
            "agence_nom": _trunc(agency.get("name", ""), 200),
            "devise": _trunc(_DEVISE_MAP.get(attrs.get("currency", 0), f"Devise {attrs.get('currency', 0)}"), 50),
            "budget_ht": attrs.get("estimatesExcludingTax", 0) or 0,
            "ca_pondere": attrs.get("turnoverWeightedExcludingTax", 0.0) or 0.0,
            "duree": _trunc("Indéterminée" if attrs.get("duration") == 255 else f"{attrs.get('duration', 0)} jours", 50),
            "date_demarrage": _trunc(attrs.get("startDate", "Immédiate"), 50),
            "pos_actif": attrs.get("numberOfActivePositionings", 0) or 0,
            "description": _trunc(description, 5000),
            "criteres": _trunc(criteres, 5000),
            "_from_boond_sync": req_data.get("from_boond_sync", True),
        }

    def sync_opportunities(self) -> int:
        start_time = datetime.now(timezone.utc)
        logger.info("🚀 Starting opportunity sync")
        
        # Récupérer l'organisation (gère automatiquement session HTTP ou scheduler)
        current_org_id = _get_current_organization_id()
        logger.info(f"[Multi-Tenant] Organisation utilisée pour la sync: {current_org_id}")
        
        try:
            all_records = self.fetch_all_opportunities()
        except Exception as exc:
            msg = f"Fetch error: {exc}"
            self._log_import(start_time, "ERROR", msg, 0)
            return 0

        if not all_records:
            self._log_import(start_time, "WARNING", "No data retrieved from Boond", 0)
            return 0

        count_add = count_upd = 0
        try:
            for rec in all_records:
                data = self._build_requisition_data(rec)
                existing = JobRequisition.query.filter_by(boond_id=data["boond_id"]).first()

                if existing:
                    obj = existing
                    action = "update"
                    count_upd += 1
                else:
                    obj = JobRequisition(boond_id=data["boond_id"])
                    # Assignation automatique de l'organisation (clé étrangère)
                    if current_org_id:
                        obj.organization_id = current_org_id
                        logger.debug(f"[Multi-Tenant] Nouvel AO assigné à l'organisation {current_org_id}")
                    db.session.add(obj)
                    action = "add"
                    count_add += 1

                for field, value in data.items():
                    if field not in ["boond_id", "_from_boond_sync"]:
                        setattr(obj, field, value)

                if action == "add":
                    obj.date_import = start_time

            db.session.commit()
            total = JobRequisition.query.count()
            msg = f"Import réussi — {total} besoins (ajouts: {count_add}, maj: {count_upd})"
            self._log_import(start_time, "SUCCESS", msg, len(all_records))
            
            self._notify_commercials_for_new_opportunities(start_time)
            self._trigger_auto_matching()
            
            return len(all_records)
        except Exception as exc:
            db.session.rollback()
            msg = f"Save error: {exc}"
            self._log_import(start_time, "ERROR", msg, 0)
            return 0

    def _log_import(self, start_time, statut, message, nombre):
        try:
            log = ImportLog(
                date_import=start_time,
                statut=statut,
                message=message,
                nombre_importes=nombre,
            )
            db.session.add(log)
            db.session.commit()
        except Exception as e:
            logger.error(f"Could not write ImportLog: {e}")

    def _trigger_auto_matching(self):
        import threading
        from flask import current_app
        
        app_obj = current_app._get_current_object()
        
        def run_auto_matching():
            with app_obj.app_context():
                try:
                    from app.services.auto_matcher import AutoMatcher
                    AutoMatcher.match_all_new_opportunities()
                except Exception as e:
                    logger.error(f"Erreur matching automatique: {e}")
        
        threading.Thread(target=run_auto_matching, daemon=True).start()

    def _generate_post_for_opportunity(self, opportunity: JobRequisition) -> str:
        try:
            titre = opportunity.titre
            reference = opportunity.reference or ""
            prompt_setting = AppSetting.query.filter_by(key="ai_prompt").first()
            if not prompt_setting or not prompt_setting.get_value():
                return f"🚀 Nous recrutons un {titre} (Référence: {reference})... (post généré automatiquement)"

            custom_prompt = prompt_setting.get_value()
            active_contacts = Contact.query.filter_by(is_active=True).all()
            active_emails = [c.email for c in active_contacts]
            
            omicrone_message = "📩 Contact : info@omicrone.fr"
            if len(active_emails) == 0:
                active_message = ""
            elif len(active_emails) == 1:
                active_message = f"📩 Envoyez votre CV à : {active_emails[0]}"
            else:
                emails_list = ", ".join(active_emails[:-1])
                active_message = f"📩 Envoyez votre CV à : {emails_list} ou {active_emails[-1]}"

            try:
                prompt = custom_prompt.format(
                    titre=titre,
                    entreprise="OMICRONE",
                    localisation="Paris",
                    omicrone=omicrone_message,
                    actifs=active_message,
                    reference=reference or "Non spécifiée",
                )
            except KeyError:
                prompt = f"Génère un post LinkedIn pour recruter un {titre} chez OMICRONE à Paris (Référence: {reference or 'Non spécifiée'})."

            prompt += "\n\nIMPORTANT: Réponds UNIQUEMENT en français."

            ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
            response = requests.post(
                ollama_url,
                json={"model": "qwen2.5:7b", "prompt": prompt, "stream": False, "options": {"num_predict": 400, "temperature": 0.3}},
                timeout=900
            )

            if response.status_code == 200:
                return response.json()["response"]
            return f"🚀 Nous recrutons un {titre} (Référence: {reference})... (post généré automatiquement)"

        except Exception:
            return f"🚀 Nous recrutons un {titre} (Référence: {reference})... (post généré automatiquement)"

    def _notify_commercials_for_opportunity(self, opportunity: JobRequisition, post_content: str):
        accounts = LinkedInAccount.query.filter_by(notify_enabled=True).all()
        if not accounts:
            return

        base_url = os.getenv("FRONTEND_URL", "http://localhost:8080")

        for account in accounts:
            existing = PostValidation.query.filter_by(
                account_id=account.id,
                opportunity_id=opportunity.requisition_id
            ).first()
            
            if existing:
                continue

            validation = PostValidation(
                account_id=account.id,
                opportunity_id=opportunity.requisition_id,
                post_content=post_content,
                status='pending'
            )
            db.session.add(validation)
            db.session.flush()
            validation_link = f"{base_url}/validate/{validation.uuid}"

            if account.notify_by_email and account.email:
                subject = f"[OMICRONE] Post LinkedIn prêt à publier : {opportunity.titre}"
                body = f"Bonjour {account.name},\n\nUn post LinkedIn a été généré automatiquement pour l'opportunité suivante :\n\n📌 {opportunity.titre}\n🏢 {opportunity.client_nom}\n\nPour voir, modifier et publier le post, cliquez ici :\n{validation_link}\n\nCordialement,\nL'équipe OMICRONE"
                send_email(account.email, subject, body)

        db.session.commit()

    def _notify_commercials_for_new_opportunities(self, since_datetime: datetime):
        recent_opportunities = JobRequisition.query.filter(JobRequisition.date_import >= since_datetime).all()
        for opp in recent_opportunities:
            post_content = self._generate_post_for_opportunity(opp)
            self._notify_commercials_for_opportunity(opp, post_content)


def _log_import(start_time, statut, message, nombre):
    try:
        log = ImportLog(
            date_import=start_time, statut=statut,
            message=message, nombre_importes=nombre,
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        logger.error("Could not write ImportLog: %s", e)


def get_all_companies() -> List[Dict]:
    return BoondService().get_companies()


def get_companies_dict() -> Dict:
    companies = get_all_companies()
    companies_dict = {}
    for company in companies:
        company_id = company.get("id")
        if company_id and "attributes" in company:
            attrs = company["attributes"]
            state_code = attrs.get("state", 0)
            companies_dict[company_id] = {
                "name": attrs.get("name", ""),
                "state": BOOND_STATE_MAP.get(state_code, "Autre"),
                "state_code": state_code,
            }
    return companies_dict


def get_all_contacts(start_date: str, end_date: str) -> List[Dict]:
    return BoondService().get_all_contacts(start_date=start_date, end_date=end_date)


def get_projects_for_year(year: int) -> List[Dict]:
    return BoondService().get_projects(year=year)