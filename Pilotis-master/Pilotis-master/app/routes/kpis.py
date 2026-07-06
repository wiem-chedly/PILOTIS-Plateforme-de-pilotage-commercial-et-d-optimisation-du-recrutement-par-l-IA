from app.utils.route_cache import cache_route
"""
routes/kpis.py — Dedicated blueprint for commercial KPI endpoints.

Endpoints
---------
GET /kpis/commercial
    Returns conversion, performance, and commerciaux KPIs for a date window.
    Query params:
      start_date  – YYYY-MM-DD (default: first day of current/previous month)
      end_date    – YYYY-MM-DD (default: last day of current/previous month)

GET /kpis/action-types (debug)
    Returns a sample of raw actions with their `typeOf` codes so you can
    verify which codes map to CV / Entretien / Signature in your BoondManager.
""" 

import calendar
import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

kpis_bp = Blueprint("kpis_bp", __name__, url_prefix="/kpis")


# ── Date helpers ──────────────────────────────────────────────────────────────

def _last_month_range(ref: datetime):
    first_of_this = ref.replace(day=1)
    last_prev_end = first_of_this - timedelta(days=1)
    last_prev_start = last_prev_end.replace(day=1)
    return (
        last_prev_start.strftime("%Y-%m-%d"),
        last_prev_end.strftime("%Y-%m-%d"),
    )


def _resolve_window(now: datetime):
    """
    Default window:
    - If today is in the first 7 days of the month → previous month
    - Otherwise → current month
    """
    if now.day <= 7:
        return _last_month_range(now)
    year  = now.year
    month = now.month
    last_day = calendar.monthrange(year, month)[1]
    return f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last_day:02d}"


def _parse_dates():
    now = datetime.now()
    start = request.args.get("start_date", "").strip()
    end   = request.args.get("end_date",   "").strip()
    if not start or not end:
        start, end = _resolve_window(now)
    return start, end


# ── Routes ────────────────────────────────────────────────────────────────────

@kpis_bp.route("/commercial", methods=["GET"])
@cache_route(timeout_seconds=300)
def get_commercial_kpis():
    """
    GET /kpis/commercial?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD

    Returns all commercial KPIs for the given period:
      - conversion  (nb_ao, nb_cv, nb_entretiens, nb_signatures, taux_*)
      - performance (avg timing in days between pipeline milestones)
      - commerciaux (per-person leaderboard sorted by nb_signatures desc)
      - trends      (comparison with the previous month)
    """
    from ..services.kpi_service import KpiService

    start_date, end_date = _parse_dates()
    logger.warning("[KPI ROUTE] GET /kpis/commercial %s → %s", start_date, end_date)

    try:
        data = KpiService.get_commercial_kpis(start_date=start_date, end_date=end_date)
        
        # Calculate trends by fetching the previous month
        try:
            d1 = datetime.fromisoformat(start_date)
            prev_end = d1 - timedelta(days=1)
            prev_start = prev_end.replace(day=1)
            prev_start_str = prev_start.strftime("%Y-%m-%d")
            prev_end_str = prev_end.strftime("%Y-%m-%d")
            
            prev_data = KpiService.get_commercial_kpis(start_date=prev_start_str, end_date=prev_end_str)
            
            c_ao = data['conversion'].get('nb_ao') or 0
            p_ao = prev_data['conversion'].get('nb_ao') or 0
            trend_ao = round(((c_ao - p_ao) / p_ao * 100)) if p_ao else (c_ao * 100)
            
            c_tx = data['conversion'].get('taux_signature_ao') or 0
            p_tx = prev_data['conversion'].get('taux_signature_ao') or 0
            trend_tx = round((c_tx - p_tx) * 100, 1)
            
            c_sig = data['conversion'].get('nb_signatures') or 0
            p_sig = prev_data['conversion'].get('nb_signatures') or 0
            trend_sig = round(((c_sig - p_sig) / p_sig * 100)) if p_sig else (c_sig * 100)
            
            data['trends'] = {
                'nb_ao': trend_ao,
                'taux_signature_ao': trend_tx,
                'nb_signatures': trend_sig
            }
        except Exception as e:
            logger.warning("Could not calculate trends: %s", e)
            data['trends'] = {}

        return jsonify({"success": True, **data})
    except Exception as e:
        logger.exception("[KPI ROUTE] Unexpected error")
        return jsonify({"success": False, "error": str(e)}), 500


@kpis_bp.route("/action-types", methods=["GET"])
@cache_route(timeout_seconds=300)
def debug_action_types():
    """
    GET /kpis/action-types?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD

    Debug endpoint: returns up to 80 actions with their typeOf codes so you
    can verify which code maps to CV / Entretien / Signature in your env.
    """
    from ..services.boond_service import BoondService

    start_date, end_date = _parse_dates()
    logger.warning("[KPI DEBUG] GET /kpis/action-types %s → %s", start_date, end_date)

    try:
        boond   = BoondService()
        actions = boond.get_all_actions(start_date=start_date, end_date=end_date)

        sample = []
        for action in actions[:80]:
            attrs = action.get("attributes") or {}
            sample.append({
                "id":      action.get("id"),
                "typeOf":  attrs.get("typeOf"),
                "title":   attrs.get("title") or attrs.get("comment", "")[:80],
                "date":    attrs.get("startDate") or attrs.get("date"),
            })

        # Aggregate typeOf counts for quick overview
        type_counts: dict = {}
        for action in actions:
            t = str((action.get("attributes") or {}).get("typeOf", "?"))
            type_counts[t] = type_counts.get(t, 0) + 1

        return jsonify({
            "success":     True,
            "period":      {"start": start_date, "end": end_date},
            "total":       len(actions),
            "type_counts": type_counts,
            "sample":      sample,
        })
    except Exception as e:
        logger.exception("[KPI DEBUG] Error fetching action types")
        return jsonify({"success": False, "error": str(e)}), 500


@kpis_bp.route("/recent-activities", methods=["GET"])
@cache_route(timeout_seconds=300)
def get_recent_activities():
    """
    GET /kpis/recent-activities?limit=15&days=30

    Retourne les N dernières activités BoondManager (tous types) :
    appels, RDV, emails, entretiens, notes, présentations CV, suivi mission…
    triées par date décroissante.
    """
    from ..services.boond_service import BoondService

    # Libellés identiques à BoondManager (vérifiés depuis l'interface Boond)
    # typeOf → label exact affiché dans l'onglet Actions de BoondManager
    TYPE_LABELS = {
        # ── Vérifiés depuis screenshots BoondManager ────────────────────────
        2:  "Note",               # Le plus fréquent — "Note" dans Boond
        1:  "Rappel / To do",     # "Rappel / To do" dans Boond
        60: "Rendez-vous",
        62: "Email",
        61: "Appel",
        # ── Autres types CRM ───────────────────────────────────────────────
        11: "Suivi Mission",
        10: "Présentation CV",
        3:  "Note interne",
        4:  "Tâche",
        5:  "RDV client",
        20: "Contrat",
        30: "Réunion",
        50: "Suivi commercial",
        # ── Candidat ───────────────────────────────────────────────────────
        0:  "CV Envoi Client",
        12: "Entretien Tél.",
        40: "Entretien Physique",
        43: "Entretien TEL ESN",
    }

    limit = min(int(request.args.get("limit", 15)), 50)
    days  = min(int(request.args.get("days",  30)), 90)

    now       = datetime.now()
    start_dt  = now - timedelta(days=days)
    start_str = start_dt.strftime("%Y-%m-%d")
    end_str   = now.strftime("%Y-%m-%d")

    logger.warning("[KPI RECENT] Fetching activities %s → %s", start_str, end_str)

    try:
        boond   = BoondService()
        actions = boond.get_all_actions(start_date=start_str, end_date=end_str)

        # Build resource map  id → name
        try:
            resources    = boond.get_resources()
            resource_map = {}
            for res in resources:
                rid = str(res.get("id", ""))
                a   = res.get("attributes") or {}
                first = a.get("firstName") or ""
                last  = a.get("name") or a.get("lastName") or ""
                name  = f"{first} {last}".strip()
                if rid and name:
                    resource_map[rid] = name
        except Exception:
            resource_map = {}

        # Build company map  id → name
        try:
            companies    = boond.get_companies()
            company_map  = {}
            for co in companies:
                cid  = str(co.get("id", ""))
                ca   = co.get("attributes") or {}
                name = ca.get("name") or ca.get("title") or ca.get("label") or ""
                if cid and name:
                    company_map[cid] = name
            logger.warning("[KPI RECENT] company_map built: %d entries", len(company_map))
        except Exception as e:
            logger.warning("[KPI RECENT] could not build company_map: %s", e)
            company_map = {}

        # Sort by startDate descending and take the most recent N
        def _action_date(a: dict) -> str:
            attrs = a.get("attributes") or {}
            return attrs.get("startDate") or attrs.get("date") or ""

        # Debug: log typeOf distribution seen in this window
        type_counts_debug: dict = {}
        for a in actions:
            t = str((a.get("attributes") or {}).get("typeOf", "?"))
            type_counts_debug[t] = type_counts_debug.get(t, 0) + 1
        logger.warning("[KPI RECENT] typeOf distribution: %s", type_counts_debug)

        sorted_actions = sorted(actions, key=_action_date, reverse=True)[:limit]

        result = []
        for action in sorted_actions:
            attrs = action.get("attributes") or {}
            rels  = action.get("relationships") or {}

            # Date
            raw_date = attrs.get("startDate") or attrs.get("date") or ""
            date_str = raw_date[:10] if raw_date else ""
            try:
                date_display = datetime.fromisoformat(date_str).strftime("%d/%m/%Y")
            except ValueError:
                date_display = date_str

            # Type label
            type_of   = attrs.get("typeOf")
            try:
                type_of = int(type_of)
            except (TypeError, ValueError):
                type_of = -1
            type_label = TYPE_LABELS.get(type_of, f"Action ({type_of})")

            # Commercial name from relationships
            commercial = "—"
            for key in ("mainManager", "createdBy", "user", "manager", "resource"):
                rel_data = (rels.get(key) or {}).get("data")
                if isinstance(rel_data, dict) and rel_data.get("id"):
                    commercial = resource_map.get(str(rel_data["id"]), f"id={rel_data['id']}")
                    break

            # Client / Company name — resolve from company_map using relationship ID
            client = "—"
            comp_data = (rels.get("company") or {}).get("data")
            if isinstance(comp_data, dict):
                comp_id = str(comp_data.get("id", ""))
                # 1st: try name embedded in the relationship object itself
                embedded = comp_data.get("title") or comp_data.get("name") or ""
                if embedded:
                    client = embedded
                # 2nd: look up in company_map built from /companies
                elif comp_id and comp_id in company_map:
                    client = company_map[comp_id]
                # 3rd: keep ID visible but cleaner
                elif comp_id:
                    client = f"Société #{comp_id}"

            # Detail — texte de l'action (colonne "Action" dans BoondManager)
            # BoondManager retourne le comment en HTML ("<div>mail de prosp</div>")
            # → on strip les balises HTML avec html.parser (pas de dépendance externe)
            raw_detail = (
                attrs.get("comment")
                or attrs.get("title")
                or attrs.get("description")
                or attrs.get("content")
                or attrs.get("note")
                or attrs.get("text")
                or ""
            )
            # Strip HTML tags
            import html as html_mod
            from html.parser import HTMLParser
            class _Stripper(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.parts = []
                def handle_data(self, data):
                    self.parts.append(data)
            s = _Stripper()
            s.feed(raw_detail)
            detail = html_mod.unescape(" ".join(s.parts)).strip()
            # Tronquer proprement sans couper un mot
            if len(detail) > 80:
                detail = detail[:77].rsplit(" ", 1)[0] + "…"

            result.append({
                "date":       date_display,
                "commercial": commercial,
                "type":       type_label,
                "client":     client,
                "detail":     detail,
            })

        return jsonify({"success": True, "data": result})

    except Exception as e:
        logger.exception("[KPI RECENT] Error fetching recent activities")
        return jsonify({"success": False, "error": str(e)}), 500



@kpis_bp.route("/monthly-evolution", methods=["GET"])
@cache_route(timeout_seconds=300)
def get_monthly_evolution():
    """
    GET /kpis/monthly-evolution

    Fetches all BoondManager opportunities for the last 12 months (one wide
    API call) and groups them by their creationDate month.

    Returns a list of 12 items:
      [{ "month": "Avr", "contrats": 14, "objectifs": 17 }, ...]
    """
    from ..services.boond_service import BoondService
    from collections import defaultdict
    import calendar

    MONTHS_FR = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
                 "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

    now = datetime.now()
    # Wide window : first day 12 months ago → today
    start_12m = (now.replace(day=1) - timedelta(days=365)).strftime("%Y-%m-%d")
    end_today  = now.strftime("%Y-%m-%d")

    logger.warning("[KPI MONTHLY] Fetching opps %s → %s from BoondManager", start_12m, end_today)

    try:
        boond = BoondService()
        opportunities = boond.get_opportunities(start_date=start_12m, end_date=end_today)
        logger.warning("[KPI MONTHLY] %d opportunities fetched", len(opportunities))
    except Exception as e:
        logger.exception("[KPI MONTHLY] BoondManager fetch error")
        return jsonify({"success": False, "error": str(e)}), 500

    # Group by (year, month) using creationDate or startDate
    counts: dict = defaultdict(int)
    for opp in opportunities:
        attrs = opp.get("attributes") or {}
        raw   = attrs.get("creationDate") or attrs.get("startDate") or ""
        if not raw:
            continue
        try:
            dt = datetime.fromisoformat(raw[:10])
            counts[(dt.year, dt.month)] += 1
        except ValueError:
            continue

    # Build ordered list of last 12 months
    result = []
    for i in range(11, -1, -1):
        # compute (year, month) for i months ago
        month = (now.month - i - 1) % 12 + 1
        year  = now.year + ((now.month - i - 1) // 12)
        nb    = counts.get((year, month), 0)
        obj   = max(5, int(nb * 1.2)) if nb > 0 else 0
        result.append({
            "month":     MONTHS_FR[month],
            "contrats":  nb,
            "objectifs": obj,
        })

    return jsonify({"success": True, "data": result})