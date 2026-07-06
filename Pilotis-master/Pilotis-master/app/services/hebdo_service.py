"""
Weekly synthesis service.

Single Responsibility: compute the weekly commercial activity synthesis and
persist it as WeeklyKpi rows. Never touches routes or models directly.

Week logic
──────────
• Default = previous Mon–Fri (so data is ready for Monday morning meeting).
• get_previous_week_range() always returns the LAST fully completed week.

Boond data sources
──────────────────
• boond.get_all_actions(start, end)   → actions in the week window
• boond.get_positionings(start, end)  → positionings updated in the window
• boond.get_resources()               → all resources for manager name map + interco ids

Action classification (typeOf) — verified from production API
──────────────────────────────────────────────────────────────
  PROSPECTION_TYPES    = {1, 2, 61, 62}   Note + Appel + Email
  SUIVI_TYPE           = 11               Suivi de Mission
  POSITIONNEMENT_TYPES = {10, 0}          Présentation CV + CV Envoi Client

  ⚠ ENTRETIENS: NOT counted from actions.
    typeOf=60 (Rendez-vous Contact) is a general meeting tag used for NRP calls,
    internal points, etc. — it inflated Anna Ivanova's entretiens to 4 when
    Boond UI showed 0. Entretiens are counted ONLY from positionings state {4, 5}.

Positioning states — verified from Boond UI 2026-03-30
───────────────────────────────────────────────────────
  0 = CV Envoyé Client
  1 = CV Envoyé SSII
  2 = Gagné / Contrat Signé   ← weekly signatures
  4 = Entretien Physique       ← weekly entretiens
  5 = Entretien Client TEL     ← weekly entretiens

NOTE: Positionings use 'createdBy' (not 'mainManager') for sales attribution.
"""

import logging
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from .boond_service import BoondService
from .config_service import get_config
from ..models.weekly_kpi import WeeklyKpi
from ..extensions import db

logger = logging.getLogger(__name__)

# ── Action type constants ─────────────────────────────────────────────────────
PROSPECTION_TYPES    = {1, 2, 61, 62}   # Note + Appel + Email
POSITIONNEMENT_TYPES = {10, 0}           # Présentation CV + CV Envoi Client
SUIVI_TYPE           = 11                # Suivi de Mission
# typeOf {12, 40, 43, 60} are NOT used for entretien counting —
# only kept for the day-history display label (_type_label)
ENTRETIEN_DISPLAY_TYPES = {12, 40, 43, 60}

# ── Positioning states ────────────────────────────────────────────────────────
POS_STATES_ENTRETIEN = {4, 5}   # Entretien Physique + Client TEL
POS_STATE_SIGNE      = 2        # Gagné / Contrat Signé

# ── French labels ─────────────────────────────────────────────────────────────
_MONTHS_FR = [
    "", "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]
_DAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


# ─────────────────────────────────────────────────────────────────────────────
# Public helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_previous_week_range() -> Tuple[date, date]:
    """Return (monday, friday) of the last fully completed business week."""
    today             = date.today()
    days_since_monday = today.weekday()   # 0 = Monday
    last_monday       = today - timedelta(days=days_since_monday + 7)
    last_friday       = last_monday + timedelta(days=4)
    return last_monday, last_friday


def format_week_label(start: date, end: date) -> str:
    """'Semaine du 16 au 20 mars 2026'"""
    if start.month == end.month:
        return (
            f"Semaine du {start.day} au {end.day} "
            f"{_MONTHS_FR[end.month]} {end.year}"
        )
    return (
        f"Semaine du {start.day} {_MONTHS_FR[start.month]} "
        f"au {end.day} {_MONTHS_FR[end.month]} {end.year}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Main computation
# ─────────────────────────────────────────────────────────────────────────────

def compute_hebdo_synthese(
    week_start: Optional[date] = None,
    week_end: Optional[date] = None,
) -> dict:
    """
    Main entry point — called by GET /hebdo/synthese.
    Returns the full weekly synthesis dict and persists WeeklyKpi rows.
    """
    if not week_start or not week_end:
        week_start, week_end = get_previous_week_range()

    start_str = week_start.isoformat()
    end_str   = week_end.isoformat()

    boond  = BoondService()
    config = get_config()

    # ── Fetch raw data ────────────────────────────────────────────────────────
    actions      = boond.get_all_actions(start_date=start_str, end_date=end_str)
    positionings = boond.get_positionings(start_date=start_str, end_date=end_str)
    resources    = boond.get_resources()

    logger.info(
        "[HEBDO] week %s–%s | actions=%d positionings=%d resources=%d",
        start_str, end_str, len(actions), len(positionings), len(resources),
    )

    # ── Lookup maps ───────────────────────────────────────────────────────────
    manager_map: Dict[str, str] = _build_manager_map(resources)

    interco_ids: set = {
        str(r.get("id", ""))
        for r in resources
        if _is_interco(r)
    }

    # ── STEP 1: classify ACTIONS per sales ────────────────────────────────────
    # Counts: prospection, suivi_mission, positionnements only.
    # Entretiens are NOT counted here — see STEP 2.
    sales_data: Dict[str, dict] = {}

    for action in actions:
        attrs   = action.get("attributes") or {}
        rels    = action.get("relationships") or {}
        type_of = _to_int(attrs.get("typeOf"))
        if type_of is None:
            continue

        sales_name = _resolve_main_manager(rels, manager_map)
        entry      = _get_or_create(sales_data, sales_name)

        if type_of in PROSPECTION_TYPES:
            entry["prospection"] += 1
        elif type_of == SUIVI_TYPE:
            entry["suivi_mission"] += 1
        elif type_of in POSITIONNEMENT_TYPES:
            entry["positionnements"] += 1
        # typeOf in ENTRETIEN_DISPLAY_TYPES → skipped for counting,
        # only used in the day-history display label below

        # Day-level detail (for DetailSales view)
        action_date = (attrs.get("startDate") or "")[:10]
        if action_date:
            entry["actions_by_day"].setdefault(action_date, []).append({
                "type":        _type_label(type_of),
                "description": attrs.get("title") or attrs.get("comment", ""),
                "company":     _get_company_name(rels),
            })

    # ── STEP 2: entretiens + signatures from POSITIONINGS ────────────────────
    # Entretiens = positionings state {4, 5}  (Entretien Physique / Client TEL)
    # Signatures = positionings state 2       (Gagné / Contrat Signé)
    # Both use createdBy (= "Respo" column in Boond UI), not mainManager.
    for pos in positionings:
        state = _to_int((pos.get("attributes") or {}).get("state"))
        rels  = pos.get("relationships") or {}

        sales_name = _resolve_created_by(rels, manager_map)
        if not sales_name or sales_name == "Inconnu":
            continue

        entry = _get_or_create(sales_data, sales_name)

        if state in POS_STATES_ENTRETIEN:
            entry["entretiens"] += 1

        elif state == POS_STATE_SIGNE:
            entry["signatures"] += 1
            # Check if the positioned resource is an interco
            dep = (rels.get("dependsOn") or {}).get("data") or {}
            if str(dep.get("id", "")) in interco_ids:
                entry["interco_sign"] += 1

    # ── STEP 3: interco stats per sales ──────────────────────────────────────
    interco_by_sales = _compute_interco_by_sales(
        resources=resources,
        interco_ids=interco_ids,
        positionings=positionings,
        manager_map=manager_map,
        config=config,
    )

    # ── STEP 4: build final sales list ───────────────────────────────────────
    sales_list = []
    for name, entry in sales_data.items():
        pos   = entry["positionnements"]
        ent   = entry["entretiens"]
        signs = entry["signatures"]
        intercos = interco_by_sales.get(name, {
            "recrutement_recent": 0, "sortie_prochaine": 0,
            "sortie_mission": 0, "positionnes": 0, "total": 0,
        })
        sales_list.append({
            "name":            name,
            "prospection":     entry["prospection"],
            "suivi_mission":   entry["suivi_mission"],
            "positionnements": pos,
            "entretiens":      ent,
            "signatures":      signs,
            "taux_pos_ent":    round(ent / pos, 2)    if pos  > 0 else None,
            "taux_ent_sign":   round(signs / ent, 2)  if ent  > 0 else None,
            "intercos":        intercos,
        })

    sales_list.sort(
        key=lambda x: x["positionnements"] + x["entretiens"] + x["signatures"],
        reverse=True,
    )

    # ── Team totals ───────────────────────────────────────────────────────────
    totals = {
        "prospections":    sum(s["prospection"]     for s in sales_list),
        "positionnements": sum(s["positionnements"] for s in sales_list),
        "entretiens":      sum(s["entretiens"]       for s in sales_list),
        "signatures":      sum(s["signatures"]       for s in sales_list),
    }

    # ── Alerts ────────────────────────────────────────────────────────────────
    alerts = _compute_alerts(
        sales_list=sales_list,
        resources=resources,
        interco_ids=interco_ids,
        config=config,
    )

    # ── Persist ───────────────────────────────────────────────────────────────
    _persist_weekly_kpis(week_start, week_end, sales_list)

    return {
        "week_label":  format_week_label(week_start, week_end),
        "week_start":  start_str,
        "week_end":    end_str,
        "team_totals": totals,
        "sales":       sales_list,
        "alerts":      alerts,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Sales detail (for DetailSales page)
# ─────────────────────────────────────────────────────────────────────────────

def get_sales_detail(
    sales_name: str,
    week_start: Optional[date] = None,
    week_end: Optional[date] = None,
) -> dict:
    """
    Returns a detailed breakdown for one sales person.
    Called by GET /hebdo/sales/<sales_name>.
    """
    if not week_start or not week_end:
        week_start, week_end = get_previous_week_range()

    start_str = week_start.isoformat()
    end_str   = week_end.isoformat()

    boond        = BoondService()
    actions      = boond.get_all_actions(start_date=start_str, end_date=end_str)
    positionings = boond.get_positionings(start_date=start_str, end_date=end_str)
    resources    = boond.get_resources()
    config       = get_config()

    manager_map = _build_manager_map(resources)

    # ── Intercos assigned to this sales ──────────────────────────────────────
    interco_detail = []
    for r in resources:
        if not _is_interco(r):
            continue
        rels   = r.get("relationships") or {}
        mgr    = (rels.get("mainManager") or {}).get("data") or {}
        mgr_id = str(mgr.get("id", ""))
        if manager_map.get(mgr_id) != sales_name:
            continue
        attrs = r.get("attributes") or {}
        name  = f"{attrs.get('firstName', '')} {attrs.get('lastName', '')}".strip()
        interco_detail.append({
            "name":        name,
            "last_action": attrs.get("lastActionDescription", "Aucune"),
            "category":    _categorize_interco(attrs, config),
        })

    # ── Filter actions for this sales person ─────────────────────────────────
    repartition: Dict[str, int] = {
        "prospection": 0, "suivi_mission": 0,
        "positionnement": 0, "entretien": 0, "signature": 0,
    }
    actions_by_day: Dict[str, list] = {}
    counts_by_day:  Dict[str, int]  = {}

    for action in actions:
        attrs   = action.get("attributes") or {}
        rels    = action.get("relationships") or {}
        type_of = _to_int(attrs.get("typeOf"))
        if type_of is None:
            continue
        if _resolve_main_manager(rels, manager_map) != sales_name:
            continue

        label = _type_label(type_of)
        key   = label.lower().replace(" ", "_").replace("é", "e").replace("è", "e")
        if key in repartition:
            repartition[key] += 1

        action_date = (attrs.get("startDate") or "")[:10]
        if action_date:
            actions_by_day.setdefault(action_date, []).append({
                "type":        label,
                "description": attrs.get("title") or attrs.get("comment", ""),
                "company":     _get_company_name(rels),
            })
            counts_by_day[action_date] = counts_by_day.get(action_date, 0) + 1

    # Entretiens from positionings state {4,5}
    for pos in positionings:
        state = _to_int((pos.get("attributes") or {}).get("state"))
        if state not in POS_STATES_ENTRETIEN:
            continue
        rels = pos.get("relationships") or {}
        if _resolve_created_by(rels, manager_map) != sales_name:
            continue
        repartition["entretien"] += 1
        upd = (pos.get("attributes") or {}).get("updateDate", "")[:10]
        if upd:
            rels_c = pos.get("relationships") or {}
            comp   = (rels_c.get("company") or {}).get("data") or {}
            actions_by_day.setdefault(upd, []).append({
                "type":        "Entretien",
                "description": "Entretien client",
                "company":     comp.get("name", ""),
            })
            counts_by_day[upd] = counts_by_day.get(upd, 0) + 1

    # Signatures from positionings state 2
    for pos in positionings:
        state = _to_int((pos.get("attributes") or {}).get("state"))
        if state != POS_STATE_SIGNE:
            continue
        rels = pos.get("relationships") or {}
        if _resolve_created_by(rels, manager_map) != sales_name:
            continue
        repartition["signature"] += 1

    # ── Build Mon→Fri day list ────────────────────────────────────────────────
    days_out = []
    current  = week_start
    while current <= week_end:
        d_str = current.isoformat()
        label = (
            f"{_DAYS_FR[current.weekday()]} "
            f"{current.day} {_MONTHS_FR[current.month]}"
        )
        days_out.append({
            "date":    d_str,
            "label":   label,
            "count":   counts_by_day.get(d_str, 0),
            "actions": actions_by_day.get(d_str, []),
        })
        current += timedelta(days=1)

    return {
        "name":           sales_name,
        "week_label":     format_week_label(week_start, week_end),
        "repartition":    repartition,
        "actions_by_day": days_out,
        "intercos":       interco_detail,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_manager_map(resources: List[dict]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for r in resources:
        rid  = str(r.get("id", ""))
        a    = r.get("attributes") or {}
        name = f"{a.get('firstName', '')} {a.get('lastName', '')}".strip()
        if rid and name:
            result[rid] = name
    return result


def _is_interco(resource: dict) -> bool:
    """State 2 in BoondManager = Intercontrat."""
    return (resource.get("attributes") or {}).get("state") == 2


def _resolve_main_manager(rels: dict, manager_map: Dict[str, str]) -> str:
    """For ACTIONS: sales person is relationships.mainManager."""
    mgr    = (rels.get("mainManager") or {}).get("data") or {}
    mgr_id = str(mgr.get("id", ""))
    return manager_map.get(mgr_id, "Inconnu") if mgr_id else "Inconnu"


def _resolve_created_by(rels: dict, manager_map: Dict[str, str]) -> str:
    """
    For POSITIONINGS: sales person is relationships.createdBy.
    This is the 'Respo' column visible in Boond UI.
    """
    cb    = (rels.get("createdBy") or {}).get("data") or {}
    cb_id = str(cb.get("id", ""))
    return manager_map.get(cb_id, "Inconnu") if cb_id else "Inconnu"


def _to_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _type_label(type_of: int) -> str:
    """Display label for action history. Does NOT affect KPI counting."""
    if type_of in ENTRETIEN_DISPLAY_TYPES: return "Rendez-vous / Entretien"
    if type_of in POSITIONNEMENT_TYPES:    return "Positionnement"
    if type_of == SUIVI_TYPE:              return "Suivi Mission"
    if type_of in PROSPECTION_TYPES:       return "Prospection"
    return "Autre"


def _get_company_name(rels: dict) -> str:
    cd = (rels.get("company") or {}).get("data") or {}
    return cd.get("name", "") if isinstance(cd, dict) else ""


def _get_or_create(sales_data: Dict[str, dict], name: str) -> dict:
    if name not in sales_data:
        sales_data[name] = {
            "name":            name,
            "prospection":     0,
            "suivi_mission":   0,
            "positionnements": 0,
            "entretiens":      0,   # from positionings state {4,5} only
            "signatures":      0,   # from positionings state 2 only
            "interco_sign":    0,
            "actions_by_day":  {},
        }
    return sales_data[name]


def _compute_interco_by_sales(
    resources: List[dict],
    interco_ids: set,
    positionings: List[dict],
    manager_map: Dict[str, str],
    config: dict,
) -> Dict[str, dict]:
    recent_days    = config.get("recrutement_recent_days", 30)
    prochaine_days = config.get("sortie_prochaine_days", 30)
    today          = date.today()
    result: Dict[str, dict] = {}

    for r in resources:
        rid = str(r.get("id", ""))
        if rid not in interco_ids:
            continue

        attrs      = r.get("attributes") or {}
        rels       = r.get("relationships") or {}
        sales_name = _resolve_main_manager(rels, manager_map)

        if sales_name not in result:
            result[sales_name] = {
                "recrutement_recent": 0, "sortie_prochaine": 0,
                "sortie_mission": 0, "positionnes": 0, "total": 0,
            }
        bucket = result[sales_name]

        hire_date = _parse_date((attrs.get("creationDate") or "")[:10])
        avail_date = _parse_date(
            (attrs.get("realAvailability") or attrs.get("availability") or "")[:10]
        )

        if hire_date and (today - hire_date).days <= recent_days and not avail_date:
            cat = "recrutement_recent"
        elif avail_date and avail_date > today and (avail_date - today).days <= prochaine_days:
            cat = "sortie_prochaine"
        elif avail_date and avail_date <= today:
            cat = "sortie_mission"
        else:
            continue

        bucket[cat]      = bucket.get(cat, 0) + 1
        bucket["total"] += 1

        for pos in positionings:
            dep = ((pos.get("relationships") or {}).get("dependsOn") or {}).get("data") or {}
            if str(dep.get("id", "")) == rid:
                bucket["positionnes"] = bucket.get("positionnes", 0) + 1
                break

    return result


def _compute_alerts(
    sales_list: List[dict],
    resources: List[dict],
    interco_ids: set,
    config: dict,
) -> List[dict]:
    alerts        = []
    today         = date.today()
    two_weeks_ago = today - timedelta(days=14)

    for r in resources:
        rid = str(r.get("id", ""))
        if rid not in interco_ids:
            continue
        attrs = r.get("attributes") or {}
        name  = f"{attrs.get('firstName', '')} {attrs.get('lastName', '')}".strip()
        last  = _parse_date((attrs.get("lastActionDate") or "")[:10])
        if last and last < two_weeks_ago:
            weeks = (today - last).days // 7
            alerts.append({
                "type":    "danger",
                "message": f"{name} — Interco sans action depuis {weeks} semaine(s)",
            })

    for s in sales_list:
        total = s["prospection"] + s["suivi_mission"] + s["positionnements"] + s["entretiens"]
        if total < 5:
            alerts.append({
                "type":    "warning",
                "message": f"{s['name']} — Activité faible cette semaine ({total} actions)",
            })

    for s in sales_list:
        intercos = s.get("intercos", {})
        if intercos.get("sortie_mission", 0) > 0 and intercos.get("positionnes", 0) <= 1:
            alerts.append({
                "type":    "warning",
                "message": (
                    f"{s['name']} — Interco sortie mission, "
                    f"{intercos.get('positionnes', 0)} positionnement(s)"
                ),
            })

    for s in sales_list:
        if s["signatures"] > 0:
            alerts.append({
                "type":    "info",
                "message": f"{s['name']} — {s['signatures']} signature(s) cette semaine 🎉",
            })

    return alerts


def _persist_weekly_kpis(
    week_start: date, week_end: date, sales_list: List[dict]
) -> None:
    try:
        for s in sales_list:
            existing = WeeklyKpi.query.filter_by(
                week_start=week_start, sales_name=s["name"]
            ).first()
            if not existing:
                existing = WeeklyKpi(
                    week_start=week_start,
                    week_end=week_end,
                    sales_name=s["name"],
                )
                db.session.add(existing)

            existing.week_end              = week_end
            existing.week_label            = format_week_label(week_start, week_end)
            existing.nb_prospections       = s["prospection"]
            existing.nb_suivi_mission      = s["suivi_mission"]
            existing.nb_positionnements    = s["positionnements"]
            existing.nb_entretiens         = s["entretiens"]
            existing.nb_signatures         = s["signatures"]
            existing.taux_pos_ent          = s.get("taux_pos_ent")
            existing.taux_ent_sign         = s.get("taux_ent_sign")
            existing.nb_interco_positions  = s["intercos"].get("positionnes", 0)

        db.session.commit()
        logger.info(
            "[HEBDO] Persisted %d WeeklyKpi rows for week %s",
            len(sales_list), week_start,
        )
    except Exception as exc:
        db.session.rollback()
        logger.error("[HEBDO] Failed to persist WeeklyKpi: %s", exc)


def _categorize_interco(attrs: dict, config: dict) -> str:
    today          = date.today()
    recent_days    = config.get("recrutement_recent_days", 30)
    prochaine_days = config.get("sortie_prochaine_days", 30)

    hire_date  = _parse_date((attrs.get("creationDate") or "")[:10])
    avail_date = _parse_date(
        (attrs.get("realAvailability") or attrs.get("availability") or "")[:10]
    )

    if hire_date and (today - hire_date).days <= recent_days and not avail_date:
        return "recrutement_recent"
    if avail_date and avail_date > today and (avail_date - today).days <= prochaine_days:
        return "sortie_prochaine"
    if avail_date and avail_date <= today:
        return "sortie_mission"
    return "autre"


def _parse_date(raw: str) -> Optional[date]:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None