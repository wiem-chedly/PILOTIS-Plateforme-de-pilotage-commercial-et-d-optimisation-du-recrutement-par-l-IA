"""
Annual KPI service.

Single Responsibility: compute year-to-date commercial KPIs PER SALES by
fetching data directly from BoondManager (actions + positionings).

Verified Boond data structure:
  Actions:      relationships.mainManager → sales person (resource)
  Positionings: relationships.createdBy   → sales person (resource, = "Respo" in UI)
                state codes:
                  0 = CV Envoyé Client
                  1 = Entretien
                  2 = Gagné / Contrat Signé
                  4 = Abandonné
                  5 = Reporté

TACI: estimated from signed positionings (state=2), each ≈ 20 billable days.
"""

import logging
from datetime import date, timedelta
from typing import Dict, List, Optional

from .boond_service import BoondService
from .config_service import get_config

logger = logging.getLogger(__name__)

# Action typeOf constants (verified from Boond API debug)
PROSPECTION_TYPES    = {1, 2, 61, 62}   # Note + Appel + Email
POSITIONNEMENT_TYPES = {10, 0}           # Présentation CV
ENTRETIEN_TYPES      = {12, 40, 43, 60}  # Rendez-vous + Entretiens
SUIVI_TYPE           = 11                # Suivi de Mission

# Positioning state codes (verified from Boond UI + API debug 2026-03-30)
#   0 = CV Envoyé Client
#   1 = CV Envoyé SSII (ESN Partner)
#   2 = Gagné (confirmed by NOUMA Abderrahmen)
#   4 = Entretien Physique (confirmed by B.M Mayssa)
#   5 = Entretien Client TEL (confirmed by TAIR Yassine, BEN GUERGUA Zeineb)
POS_STATES_CV_ENVOYE  = {0, 1}     # Both types of CV envoi
POS_STATES_ENTRETIEN  = {4, 5}     # Entretien Physique + Client TEL
POS_STATE_SIGNE       = 2          # Gagné / Contrat Signé


def get_annual_kpis(year: Optional[int] = None) -> dict:
    """
    Returns year-to-date KPIs per sales person vs objectives,
    with linear end-of-year projections.
    Called by GET /kpi/annuels.
    """
    if year is None:
        year = date.today().year

    config    = get_config()
    objectifs = {
        o.get("sales_name", ""): o
        for o in config.get("objectifs", [])
        if o.get("sales_name")
    }

    jan1     = date(year, 1, 1)
    today    = date.today()
    year_end = today if year == today.year else date(year, 12, 31)

    start_str = jan1.isoformat()
    end_str   = year_end.isoformat()

    boond = BoondService()
    logger.info("[KPI ANNUELS] Fetching from Boond: %s → %s", start_str, end_str)

    resources    = boond.get_resources()
    actions      = boond.get_all_actions(start_date=start_str, end_date=end_str)
    positionings = boond.get_positionings(start_date=start_str, end_date=end_str)

    logger.info(
        "[KPI ANNUELS] resources=%d actions=%d positionings=%d",
        len(resources), len(actions), len(positionings),
    )

    # resource_id → "Prénom Nom"
    manager_map: Dict[str, str] = _build_manager_map(resources)

    ytd: Dict[str, dict] = {}

    # ── ACTIONS → mainManager tells us the sales person ───────────────────────
    for action in actions:
        attrs   = action.get("attributes") or {}
        rels    = action.get("relationships") or {}
        type_of = _to_int(attrs.get("typeOf"))
        if type_of is None:
            continue

        name = _resolve_main_manager(rels, manager_map)
        if not name:
            continue
        entry = _ensure(ytd, name)

        if type_of in PROSPECTION_TYPES:
            entry["prospection"] += 1
        elif type_of in POSITIONNEMENT_TYPES:
            entry["positionnements"] += 1
        elif type_of == SUIVI_TYPE:
            entry["suivi_mission"] += 1

    # ── POSITIONINGS → createdBy = the "Respo" / sales person in Boond UI ─────
    for pos in positionings:
        state = _to_int((pos.get("attributes") or {}).get("state"))
        rels  = pos.get("relationships") or {}

        name = _resolve_created_by(rels, manager_map)
        if not name:
            continue
        entry = _ensure(ytd, name)

        if state in POS_STATES_CV_ENVOYE:
            entry["pos_cv"] += 1
        elif state in POS_STATES_ENTRETIEN:
            entry["pos_ent"] += 1
        elif state == POS_STATE_SIGNE:
            entry["signatures"] += 1

    # ── PROJECTS → CA réalisé proraté per sales ──────────────────────────────
    # Prorates each project's CA to the fraction of days that fall within `year`,
    # matching exactly the numbers shown in Boond Reporting > Synthèse > CA signé.
    projects = boond.get_projects(year=year)
    ca_by_sales: Dict[str, float] = {}
    year_start = date(year, 1, 1)
    year_end_d = date(year, 12, 31)
    for proj in projects:
        attrs    = proj.get("attributes") or {}
        rels     = proj.get("relationships") or {}
        ca_total = attrs.get("turnoverSimulatedExcludingTax") or 0
        if not ca_total:
            continue
        p_start = _parse_date(attrs.get("startDate"))
        p_end   = _parse_date(attrs.get("endDate"))
        ca_year = _prorate_ca(float(ca_total), p_start, p_end, year_start, year_end_d)
        if ca_year <= 0:
            continue
        name = _resolve_main_manager(rels, manager_map)
        if name:
            ca_by_sales[name] = ca_by_sales.get(name, 0.0) + ca_year
    logger.info("[KPI ANNUELS] CA proraté per sales: %s", {k: round(v) for k, v in ca_by_sales.items()})

    # ── TACI estimation ───────────────────────────────────────────────────────
    worked_days = _count_working_days(jan1, today)
    taci_map: Dict[str, int] = {}
    for name, e in ytd.items():
        billed = e["signatures"] * 20
        taci_map[name] = min(round(billed / max(worked_days, 1) * 100), 100)


    # ── Weeks elapsed ─────────────────────────────────────────────────────────
    weeks_elapsed = max((today - jan1).days / 7, 1)
    weeks_total   = 52

    # ── Build output ─────────────────────────────────────────────────────────
    all_names = (set(ytd.keys()) | set(objectifs.keys())) - {"Inconnu", ""}
    sales_out: List[dict] = []

    for name in sorted(all_names):
        e   = ytd.get(name, {})
        obj = objectifs.get(name, {})

        # Use whichever count is higher: actions-based or positionings-based
        pos_realise  = max(e.get("positionnements", 0), e.get("pos_cv",  0))
        ent_realise  = e.get("pos_ent", 0)
        sign_realise = e.get("signatures", 0)

        obj_pos  = obj.get("target_positions",  0) or 0
        obj_ent  = obj.get("target_interviews", 0) or 0
        obj_sign = obj.get("target_signatures", 0) or 0
        obj_ca   = obj.get("target_ca",         0) or 0
        taci     = taci_map.get(name, 0)
        ca_realise = round(ca_by_sales.get(name, 0.0))

        sign_proj = _project(sign_realise, weeks_elapsed, weeks_total)
        ca_proj   = round(sign_proj * obj_ca / max(obj_sign, 1)) if obj_sign else 0
        statut    = "en_bonne_voie" if ca_proj >= obj_ca else "sous_objectif"

        sales_out.append({
            "name":  name,
            "taci":  taci,
            "positionnements": {"realise": pos_realise,  "objectif": obj_pos},
            "entretiens":      {"realise": ent_realise,  "objectif": obj_ent},
            "signatures":      {"realise": sign_realise, "objectif": obj_sign},
            "ca":              {"realise": ca_realise,   "objectif": obj_ca},
            "projection_fin_annee": ca_proj,
            "statut_projection":    statut,
        })

    sales_out.sort(
        key=lambda x: x["positionnements"]["realise"] + x["entretiens"]["realise"],
        reverse=True,
    )

    logger.info("[KPI ANNUELS] year=%d | %d sales entries", year, len(sales_out))
    return {"year": year, "sales": sales_out}


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ensure(store: Dict[str, dict], name: str) -> dict:
    if name not in store:
        store[name] = {
            "prospection":     0,
            "suivi_mission":   0,
            "positionnements": 0,   # from actions typeOf
            "entretiens":      0,   # from actions typeOf
            "pos_cv":          0,   # from positionings state=0
            "pos_ent":         0,   # from positionings state=1
            "signatures":      0,   # from positionings state=2
        }
    return store[name]


def _build_manager_map(resources: List[dict]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for r in resources:
        rid  = str(r.get("id", ""))
        a    = r.get("attributes") or {}
        name = f"{a.get('firstName', '')} {a.get('lastName', '')}".strip()
        if rid and name:
            result[rid] = name
    return result


def _resolve_main_manager(rels: dict, manager_map: Dict[str, str]) -> str:
    """For ACTIONS: sales person is in relationships.mainManager."""
    mgr    = (rels.get("mainManager") or {}).get("data") or {}
    mgr_id = str(mgr.get("id", ""))
    return manager_map.get(mgr_id, "") if mgr_id else ""


def _resolve_created_by(rels: dict, manager_map: Dict[str, str]) -> str:
    """
    For POSITIONINGS: the 'Respo' (sales) shown in Boond UI = createdBy resource.
    This is verified from the API relationships: ['createdBy', 'opportunity', 'dependsOn'].
    """
    cb    = (rels.get("createdBy") or {}).get("data") or {}
    cb_id = str(cb.get("id", ""))
    return manager_map.get(cb_id, "") if cb_id else ""


def _to_int(value) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _project(realise: int, weeks_elapsed: float, weeks_total: int) -> int:
    return round(realise / weeks_elapsed * weeks_total)


def _count_working_days(start: date, end: date) -> int:
    return sum(
        1 for i in range((end - start).days + 1)
        if (start + timedelta(days=i)).weekday() < 5
    )


def _parse_date(s: Optional[str]) -> Optional[date]:
    """Parse ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS) to date."""
    if not s:
        return None
    try:
        return date.fromisoformat(str(s)[:10])
    except (ValueError, TypeError):
        return None


def _prorate_ca(ca_total: float, proj_start: Optional[date], proj_end: Optional[date],
                year_start: date, year_end: date) -> float:
    """
    Returns the fraction of ca_total that falls within [year_start, year_end].
    Matches Boond Reporting > Synthèse > CA signé computation exactly.
    """
    if not ca_total or not proj_start or not proj_end:
        return 0.0
    overlap_start = max(proj_start, year_start)
    overlap_end   = min(proj_end,   year_end)
    if overlap_start > overlap_end:
        return 0.0
    overlap_days = (overlap_end - overlap_start).days + 1
    total_days   = (proj_end - proj_start).days + 1
    if total_days <= 0:
        return 0.0
    return ca_total * overlap_days / total_days
