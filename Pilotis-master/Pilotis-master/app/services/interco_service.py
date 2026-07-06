"""
Intercontract management service.

Single Responsibility: fetch, categorise and filter intercontract resources
from BoondManager. Never called from other services — only from the route.

An "interco" is a BoondManager resource whose attributes.tags list contains
the string "interco" (case-insensitive).
"""

import logging
from datetime import date, timedelta
from typing import Dict, List, Optional

from .boond_service import BoondService
from .config_service import get_config

logger = logging.getLogger(__name__)

# ── Date window for recent action lookup ──────────────────────────────────────
_ACTION_LOOKBACK_DAYS = 90


def get_intercos(category: str = "all", sales_name: str = "all") -> dict:
    """
    Fetches fresh data from BoondManager and returns filtered interco list.

    Parameters
    ----------
    category   : "all" | "recrutement_recent" | "sortie_prochaine" | "sortie_mission"
    sales_name : "all" | exact name string
    """
    boond  = BoondService()
    config = get_config()

    resources    = boond.get_resources()
    manager_map  = _build_manager_map(resources)

    # Fetch positionings — 90-day window to avoid loading all history
    today    = date.today()
    lookback = (today - timedelta(days=_ACTION_LOOKBACK_DAYS)).isoformat()

    positionings = boond.get_positionings(
        start_date=lookback,
        end_date=today.isoformat(),
    )

    # Fetch recent actions for last-action lookup per resource
    all_actions = boond.get_all_actions(
        start_date=lookback,
        end_date=today.isoformat(),
    )

    # Build last-action map per resource id
    actions_map = _build_actions_map(all_actions)

    # Build last positioning map per resource id
    pos_map = _build_pos_map(positionings)

    # ── Categorise and filter ─────────────────────────────────────────────────
    totals = {
        "recrutement_recent": 0, "sortie_prochaine": 0,
        "sortie_mission": 0, "total": 0,
    }
    intercos_out: List[dict] = []

    for r in resources:
        attrs = r.get("attributes") or {}
        if not _has_interco_tag(r):
            continue

        rid         = str(r.get("id", ""))
        name        = f"{attrs.get('firstName', '')} {attrs.get('lastName', '')}".strip()
        rels        = r.get("relationships") or {}
        mgr         = (rels.get("mainManager") or {}).get("data") or {}
        mgr_id      = str(mgr.get("id", ""))
        sales       = manager_map.get(mgr_id, "Non assigné")
        cat         = _categorize(attrs, config)

        if cat == "autre":
            continue  # skip resources that don't fit any interco category

        totals[cat]      = totals.get(cat, 0) + 1
        totals["total"] += 1

        # Apply filters
        if category != "all" and cat != category:
            continue
        if sales_name != "all" and sales != sales_name:
            continue

        # Resolve last action / positioning info
        pos_info    = pos_map.get(rid)
        action_info = actions_map.get(rid)

        if pos_info:
            derniere_action = pos_info["description"]
            statut          = "positionne"
        elif action_info:
            derniere_action = action_info["description"]
            statut          = "en_cours"
        else:
            derniere_action = "Aucune"
            statut          = "sans_action"

        fin_mission = (attrs.get("endDate") or "")[:10] or None

        intercos_out.append({
            "boond_id":          rid,
            "name":              name,
            "category":          cat,
            "sales_responsable": sales,
            "fin_mission":       fin_mission,
            "derniere_action":   derniere_action,
            "statut":            statut,
        })

    logger.info(
        "[INTERCOS] category=%s sales=%s → %d intercos returned (totals=%s)",
        category, sales_name, len(intercos_out), totals,
    )

    return {"totals": totals, "intercos": intercos_out}


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _has_interco_tag(resource: dict) -> bool:
    # State 2 in BoondManager represents "Intercontrat"
    return (resource.get("attributes") or {}).get("state") == 2


def _build_manager_map(resources: List[dict]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for r in resources:
        rid  = str(r.get("id", ""))
        a    = r.get("attributes") or {}
        name = f"{a.get('firstName', '')} {a.get('lastName', '')}".strip()
        if rid and name:
            result[rid] = name
    return result


def _build_actions_map(actions: List[dict]) -> Dict[str, dict]:
    """Latest action description per resource id (first occurrence wins)."""
    result: Dict[str, dict] = {}
    for action in actions:
        rels = action.get("relationships") or {}
        dep  = (rels.get("dependsOn") or {}).get("data") or {}
        rid  = str(dep.get("id", ""))
        if rid and rid not in result:
            attrs = action.get("attributes") or {}
            result[rid] = {
                "description": attrs.get("title") or attrs.get("comment", ""),
                "date":        (attrs.get("startDate") or "")[:10],
            }
    return result


def _build_pos_map(positionings: List[dict]) -> Dict[str, dict]:
    """Latest positioning description per resource id."""
    result: Dict[str, dict] = {}
    for pos in positionings:
        rels = pos.get("relationships") or {}
        dep  = (rels.get("dependsOn") or {}).get("data") or {}
        rid  = str(dep.get("id", ""))
        if rid and rid not in result:
            comp = (rels.get("company") or {}).get("data") or {}
            result[rid] = {
                "description": f"Positionnement chez {comp.get('name', '')}",
                "state":       (pos.get("attributes") or {}).get("state"),
            }
    return result


def _categorize(attrs: dict, config: dict) -> str:
    today          = date.today()
    recent_days    = config.get("recrutement_recent_days", 30)
    prochaine_days = config.get("sortie_prochaine_days", 30)

    hire_date = _parse_date((attrs.get("creationDate") or "")[:10])
    avail_date = _parse_date((attrs.get("realAvailability") or attrs.get("availability") or "")[:10])

    if hire_date and (today - hire_date).days <= recent_days:
        return "recrutement_recent"
    if avail_date:
        if avail_date > today and (avail_date - today).days <= prochaine_days:
            return "sortie_prochaine"
        if avail_date <= today:
            return "sortie_mission"
    return "autre"


def _parse_date(raw: str) -> Optional[date]:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None
