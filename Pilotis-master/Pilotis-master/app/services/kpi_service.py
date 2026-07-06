"""
kpi_service.py — Commercial KPI computation from BoondManager data.

Fetches:
  - Opportunities (job-requisitions) for the date window
  - All actions (CV, Entretien, Contrat/Signature, Appel) for the window
  - Resources (commercials) to build a per-person leaderboard

Computes:
  1. Conversion KPIs  — nb_signatures, taux_sig/entretien, taux_sig/AO
  2. Performance KPIs — avg timing in days between pipeline milestones
  3. Commerciaux KPIs — per-person leaderboard sorted by conversion rate
"""

import logging
from typing import Optional, Dict
from datetime import datetime, timedelta  
from .boond_service import (
    BoondService,
    ACTION_TYPE_APPEL,
    ACTION_TYPE_SUIVI,
    ACTION_TYPE_CV,
    ACTION_TYPES_CV,
    ACTION_TYPE_CONTRAT,
    ACTION_TYPES_ENTRETIEN,
)

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _attrs(item: dict) -> dict:
    """Shortcut to get the 'attributes' dict of a BoondManager resource."""
    return item.get("attributes") or {}


def _resource_name(resource: dict) -> str:
    a = _attrs(resource)
    first = a.get("firstName") or a.get("firstname") or ""
    last  = a.get("name") or a.get("lastName") or a.get("lastname") or ""
    return f"{first} {last}".strip() or f"id={resource.get('id', '?')}"


def _action_type(action: dict) -> Optional[int]:
    t = _attrs(action).get("typeOf")
    try:
        return int(t)
    except (TypeError, ValueError):
        return None


def _action_date(action: dict) -> Optional[datetime]:
    raw = _attrs(action).get("startDate") or _attrs(action).get("date") or ""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw[:10])
    except ValueError:
        return None


def _opp_created(opp: dict) -> Optional[datetime]:
    raw = _attrs(opp).get("creationDate") or _attrs(opp).get("startDate") or ""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw[:10])
    except ValueError:
        return None


def _delta_days(d1: Optional[datetime], d2: Optional[datetime]) -> Optional[float]:
    """Return (d2 - d1) in days, or None if either date is missing."""
    if d1 and d2 and d2 >= d1:
        return (d2 - d1).days
    return None


def _linked_opp_id(action: dict) -> Optional[str]:
    """Return the opportunity (job-requisition) ID linked to this action, if any."""
    rels = action.get("relationships") or {}
    for key in ("jobRequisition", "job-requisition", "opportunity"):
        val = rels.get(key, {})
        if isinstance(val, dict):
            data = val.get("data")
            if isinstance(data, dict) and data.get("id"):
                return str(data["id"])
    return None


def _linked_resource_id(action: dict) -> Optional[str]:
    """Return the resource ID responsible for this action (or opportunity), if any."""
    rels = action.get("relationships") or {}
    for key in ("mainManager", "createdBy", "user", "manager", "resource", "owner", "mainResource", "assignedTo"):
        val = rels.get(key, {})
        if isinstance(val, dict):
            data = val.get("data")
            if isinstance(data, dict) and data.get("id"):
                return str(data["id"])
    return None

def _linked_company_id(action: dict) -> Optional[str]:
    """Return the company ID from this action, if any."""
    rels = action.get("relationships") or {}
    comp = rels.get("company", {})
    if isinstance(comp, dict):
        data = comp.get("data")
        if isinstance(data, dict) and data.get("id"):
            return str(data["id"])
    return None


def _positioning_profile_type(positioning: dict) -> str:
    """
    Return 'resource' or 'candidate' based on the positioning's dependsOn type.

    In BoondManager:
      dependsOn.type = 'candidate'  → external candidate (headhunting)
      dependsOn.type = 'resource'   → internal consultant (re-placement)
    """
    rels   = positioning.get("relationships") or {}
    dep    = rels.get("dependsOn", {})
    dep_d  = dep.get("data") if isinstance(dep, dict) else None
    if isinstance(dep_d, dict):
        t = dep_d.get("type", "")
        if t == "resource":
            return "resource"
        if t == "candidate":
            return "candidate"
    return "candidate"  # default assumption


def _positioning_manager_id(positioning: dict) -> Optional[str]:
    """Return the manager/commercial ID who created this positioning."""
    rels = positioning.get("relationships") or {}
    for key in ("createdBy", "mainManager", "manager"):
        val = rels.get(key, {})
        if isinstance(val, dict):
            data = val.get("data")
            if isinstance(data, dict) and data.get("id"):
                return str(data["id"])
    return None


# ── Main service ──────────────────────────────────────────────────────────────

class KpiService:

    @staticmethod
    def get_commercial_kpis(start_date: str, end_date: str) -> Dict:
        """
        Compute all commercial KPI groups for the given date window.

        Returns:
          {
            "period": { "start", "end", "label" },
            "conversion": { nb_ao, nb_cv, nb_entretiens, nb_signatures,
                            taux_cv_par_ao, taux_signature_entretien, taux_signature_ao },
            "performance": { avg_reponse_ao_days, avg_cv_to_entretien_days,
                             avg_entretien_to_signature_days },
            "commerciaux": [ { name, nb_appels, nb_cv, nb_entretiens, nb_signatures,
                               taux_conversion, volume_par_semaine } ]
          }
        """
        boond = BoondService()

        # ── Fetch raw data ─────────────────────────────────────────────────
        logger.warning("[KPI] Fetching opportunities %s → %s", start_date, end_date)
        opportunities = boond.get_opportunities(start_date=start_date, end_date=end_date)

        logger.warning("[KPI] Fetching actions %s → %s", start_date, end_date)
        all_actions = boond.get_all_actions(start_date=start_date, end_date=end_date)

        logger.warning("[KPI] Fetching resources")
        try:
            resources = boond.get_resources()
        except Exception as e:
            logger.warning("[KPI] Could not fetch resources: %s", e)
            resources = []

        # Fetch positionings for the period (used for CV type split + pipeline timings)
        logger.warning("[KPI] Fetching positionings %s -> %s", start_date, end_date)
        try:
            period_positionings = boond.get_positionings(start_date=start_date, end_date=end_date)
        except Exception as e:
            logger.warning("[KPI] Could not fetch positionings: %s", e)
            period_positionings = []

        logger.warning("[KPI] Raw counts — opps=%d, actions=%d, resources=%d, positionings=%d",
                       len(opportunities), len(all_actions), len(resources), len(period_positionings))

        # ── Positioning state constants (verified from live API via debug_states.py) ──
        # Real BoondManager API state values for positionings (March 2026 data):
        #   state 0 = CV Envoyé Client     (32 items confirmed)
        #   state 1 = unknown/edge case     (1 item)
        #   state 4 = Entretien type A      (1 item confirmed)
        #   state 5 = Entretien type B      (2 items confirmed)
        #   state >= 6 = Contrat Signé      (presumed — none seen in March)
        # Entretien range: state >= 4 and state <= 5
        # Signature threshold: state >= 6
        ENTRETIEN_STATES = {4, 5}
        SIGNATURE_MIN_STATE = 6

        def _safe_state(pos: dict) -> int:
            try:
                return int((pos.get("attributes") or {}).get("state", -1))
            except (ValueError, TypeError):
                return -1

        def _pos_date(pos: dict, field: str) -> Optional[datetime]:
            raw = (pos.get("attributes") or {}).get(field, "")
            if not raw:
                return None
            try:
                return datetime.fromisoformat(raw[:10])
            except ValueError:
                return None

        # ── Classify actions ───────────────────────────────────────────────
        # CV = type 10 (Présentation CV sur contact/société) + type 0 (CV ENVOI CLIENT sur candidat)
        cv_actions        = [a for a in all_actions if _action_type(a) in ACTION_TYPES_CV]
        entretien_actions = [a for a in all_actions if _action_type(a) in ACTION_TYPES_ENTRETIEN]
        # Signatures: derived from positionings with state>=6 (Contrat signé)
        # ACTION_TYPE_CONTRAT=-1 so signature_actions will always be empty (placeholder)
        signature_actions = [a for a in all_actions if _action_type(a) == ACTION_TYPE_CONTRAT]
        appel_actions     = [a for a in all_actions if _action_type(a) == ACTION_TYPE_APPEL]
        suivi_actions     = [a for a in all_actions if _action_type(a) == ACTION_TYPE_SUIVI]

        # ── AO state constants (verified from live API via debug_all.py) ──────────
        # AO (opportunity/besoin) state values:
        #   state 0 = other/inactive  (2 AOs)
        #   state 1 = Gagné (Won/Signed) — 1 AO in March 2026
        #   state 2 = Perdu (Lost)    — 1 AO in March 2026
        #   state 4 = En cours (Active search, BoondManager "25/50%") — 11 AOs
        AO_STATE_GAGNE  = "1"
        AO_STATES_OPEN  = {"4"}          # En cours = active search
        AO_STATES_CLOS  = {"1", "2"}     # Gagné + Perdu
        nb_ao         = len(opportunities)
        # nb_cv: positionings at state==0 (CV Envoyé Client) — 32 confirmed from live API
        nb_cv         = len([p for p in period_positionings if _safe_state(p) == 0])
        # nb_entretiens: positionings at state 4 or 5 (Entretien types) — 3 confirmed
        nb_entretiens = len([p for p in period_positionings if _safe_state(p) in ENTRETIEN_STATES])
        # nb_signatures will be derived after pipeline positionings are fetched (extended window)
        nb_signatures = 0  # placeholder — updated after pipeline fetch below
        logger.warning("[KPI] nb_cv=%d (state==0), nb_entretiens=%d (state in {4,5})",
                       nb_cv, nb_entretiens)

        # ── Taux CV → Entretien (positionings-based, no extra API calls) ──────
        # Logic:
        #   - CVs sent (denominator) = positionings at state==0 (32)
        #   - Reached entretien       = state in {4, 5}  (3)
        #   - avg delay = updateDate - creationDate for those promoted to entretien

        pos_total      = len([p for p in period_positionings if _safe_state(p) == 0])
        pos_entretiens = [p for p in period_positionings if _safe_state(p) in ENTRETIEN_STATES]

        real_cv_conversion_rate = (
            round(len(pos_entretiens) / pos_total, 2) if pos_total > 0 else None
        )

        cohort_deltas = []
        for pos in pos_entretiens:
            d_created = _pos_date(pos, "creationDate")
            d_updated = _pos_date(pos, "updateDate")
            if d_created and d_updated and d_updated >= d_created:
                cohort_deltas.append((d_updated - d_created).days)

        matched_count   = len(pos_entretiens)
        unmatched_count = pos_total - matched_count

        logger.warning(
            "[KPI] Taux CV→Entretien (positionings): %s — %d/%d reached entretien",
            real_cv_conversion_rate, matched_count, pos_total,
        )


        # ── KPI 1 — Conversion (assembled after pipeline block — see below) ──
        # nb_signatures is finalized only after the pipeline positionings are fetched.
        # The conversion dict is built after performance{} below.

        # ── KPI 2 — Performance (pipeline timings via Positionnements) ────────
        #
        # Data source: positionings endpoint
        #   Each positioning has:
        #     relationships.opportunity.data.id  → AO ID
        #     attributes.creationDate            → date CV was sent (state 0)
        #     attributes.updateDate              → date of last state change
        #     attributes.state                   → current state (verified from live API)
        #       state 0 = CV Envoyé Client     (32 items in March 2026)
        #       state 4 = Entretien type A       (1 item)
        #       state 5 = Entretien type B       (2 items)
        #       state >= 6 = Contrat Signé       (presumed — none in March 2026)
        #
        # For each AO, we collect ALL its positionings, then derive:
        #   first_cv         = min(creationDate) across all positionings for this AO
        #   first_entretien  = min(updateDate of positionings with state in {4,5})
        #   first_signature  = min(updateDate of positionings with state >= 6)
        #
        # Delays:
        #   AO created → 1er CV        = first_cv - ao.creationDate
        #   1er CV → 1er Entretien     = first_entretien - first_cv
        #   Entretien → Signature      = first_signature - first_entretien

        logger.warning("[KPI] Fetching positionings for pipeline timing …")
        try:
            # Fetch positionings updated in a wide window (-30/+90 days) to
            # capture late-stage transitions outside the strict AO window.
            sd_ext = (datetime.fromisoformat(start_date) - timedelta(days=30)).isoformat()[:10]
            ed_ext = (datetime.fromisoformat(end_date)   + timedelta(days=90)).isoformat()[:10]
        except Exception:
            sd_ext, ed_ext = start_date, end_date

        positionings = boond.get_positionings(start_date=sd_ext, end_date=ed_ext)
        logger.warning("[KPI] %d positionings fetched", len(positionings))

        # Build AO index: ao_id → list of positionings
        ao_positionings: Dict[str, list] = {}
        for pos in positionings:
            rels  = pos.get("relationships") or {}
            opp   = rels.get("opportunity", {})
            opp_d = opp.get("data") if isinstance(opp, dict) else None
            if not opp_d or not opp_d.get("id"):
                continue
            ao_id = str(opp_d["id"])
            ao_positionings.setdefault(ao_id, []).append(pos)

        logger.warning("[KPI] %d unique AOs have at least one positioning", len(ao_positionings))

        # Build per-AO pipeline timelines and compute delays
        deltas_reponse       = []   # AO created → first CV sent
        deltas_cv_entretien  = []   # first CV → first entretien
        deltas_entretien_sig = []   # first entretien → first signature

        ao_with_cv  = 0
        ao_with_ent = 0
        ao_with_sig = 0

        # Build AO created-date lookup
        ao_created: Dict[str, datetime] = {}
        for opp in opportunities:
            ao_id   = str(opp.get("id", ""))
            created = _opp_created(opp)
            if ao_id and created:
                ao_created[ao_id] = created

        def _parse_date(raw: str) -> Optional[datetime]:
            if not raw:
                return None
            try:
                return datetime.fromisoformat(raw[:10])
            except ValueError:
                return None

        for ao_id, pos_list in ao_positionings.items():
            created = ao_created.get(ao_id)
            if not created:
                continue  # AO not in our fetched opportunities → skip

            cv_dates  = []
            ent_dates = []
            sig_dates = []

            for pos in pos_list:
                attrs = pos.get("attributes") or {}
                try:
                    state = int(str(attrs.get("state", -1)))
                except (ValueError, TypeError):
                    state = -1

                # creationDate = when the CV was sent (state=0, positioning created)
                cv_date = _parse_date(attrs.get("creationDate", ""))
                if cv_date:
                    cv_dates.append(cv_date)

                upd_date = _parse_date(attrs.get("updateDate", ""))
                if upd_date:
                    # state>=1 → positioning reached entretien or beyond; use updateDate as
                    # best available proxy for "entered entretien". When a positioning is at
                    # state>=2, its updateDate is the signature date — the same date will also
                    # appear in sig_dates. The d2 guard (d2 > 0) below prevents 0j artefacts.
                    if _safe_state(pos) in ENTRETIEN_STATES:
                        ent_dates.append(upd_date)
                    if state >= SIGNATURE_MIN_STATE:
                        sig_dates.append(upd_date)

            first_cv        = min(cv_dates)  if cv_dates  else None
            first_entretien = min(ent_dates) if ent_dates else None
            first_signature = min(sig_dates) if sig_dates else None

            if first_cv:        ao_with_cv  += 1
            if first_entretien: ao_with_ent += 1
            if first_signature: ao_with_sig += 1

            d0 = _delta_days(created,         first_cv)
            d1 = _delta_days(first_cv,        first_entretien)
            d2 = _delta_days(first_entretien, first_signature)

            if d0 is not None and d0 >= 0: deltas_reponse.append(d0)
            if d1 is not None and d1 >= 0: deltas_cv_entretien.append(d1)
            # d2 must be strictly positive: d2==0 means entretien and signature share the
            # same updateDate on the same positioning (state>=2), which is a data artefact.
            if d2 is not None and d2 > 0:  deltas_entretien_sig.append(d2)


        def _avg(lst: list) -> Optional[float]:
            return round(sum(lst) / len(lst), 1) if lst else None

        total_ao = len(opportunities)

        # ── nb_signatures: AOs with state==1 (Gagné/Won) created in the period ─────────
        # Confirmed from debug_all.py: Contrat signé is tracked at the AO level
        # (BoondManager marks the Besoin as "Gagné" when won), NOT at positioning state.
        # No positioning reaches state >=6 because teams don't update it manually.
        nb_signatures = sum(
            1 for opp in opportunities
            if str((opp.get("attributes") or {}).get("state", "")) == AO_STATE_GAGNE
        )

        logger.warning(
            "[KPI] Pipeline delays — AOs with CV=%d, Entretien=%d, Sig=%d / total=%d",
            ao_with_cv, ao_with_ent, ao_with_sig, total_ao,
        )
        logger.warning(
            "[KPI] nb_signatures=%d (AOs with state==1 Gagné, created in period)",
            nb_signatures,
        )

        performance = {
            # ── Average delays (days) ──────────────────────────────────────
            "avg_reponse_ao_days":             _avg(deltas_reponse),       # AO creé → 1er CV
            "avg_cv_to_entretien_days":        _avg(deltas_cv_entretien),  # 1er CV → entretien
            "avg_entretien_to_signature_days": _avg(deltas_entretien_sig), # entretien → signature
            # ── AO coverage ───────────────────────────────────────────────
            "ao_with_cv":        ao_with_cv,
            "ao_with_entretien": ao_with_ent,
            "ao_with_signature": ao_with_sig,
            "total_ao":          total_ao,
            "linked_action_pct": round(len(ao_positionings) / total_ao * 100) if total_ao else 0,
            "data_quality":      "ok",
            # ── Sample sizes for transparency ─────────────────────────────
            "nb_delays_ao_cv":         len(deltas_reponse),
            "nb_delays_cv_entretien":  len(deltas_cv_entretien),
            "nb_delays_entretien_sig": len(deltas_entretien_sig),
        }

        # ── KPI 1 — Conversion (here nb_signatures is final) ──────────────────
        taux_cv_par_ao           = round(nb_cv / nb_ao, 2)                if nb_ao         > 0 else None
        taux_signature_entretien = round(nb_signatures / nb_entretiens, 2) if nb_entretiens > 0 else None
        taux_signature_ao        = round(nb_signatures / nb_ao, 2)         if nb_ao          > 0 else None

        conversion = {
            "nb_ao":                    nb_ao,
            "nb_cv":                    nb_cv,
            "nb_entretiens":            nb_entretiens,
            "nb_signatures":            nb_signatures,
            "taux_cv_par_ao":           taux_cv_par_ao,
            "taux_signature_entretien": taux_signature_entretien,
            "taux_signature_ao":        taux_signature_ao,
        }

        # ── KPI 3 — Leaderboard by commercial ─────────────────────────────
        # Build resource map: id → name
        resource_map: Dict[str, str] = {}
        for res in resources:
            rid = str(res.get("id", ""))
            if rid:
                resource_map[rid] = _resource_name(res)

        # Count actions per resource
        leaderboard: Dict[str, Dict] = {}

        def _count_for_resource(action_list: list, field: str):
            for action in action_list:
                rid = _linked_resource_id(action)
                if not rid:
                    continue
                name = resource_map.get(rid, f"id={rid}")
                if rid not in leaderboard:
                    leaderboard[rid] = {
                        "name":               name,
                        "nb_appels":          0,
                        "nb_cv":              0,
                        "nb_cv_ressources":   0,  # internal consultant repositioned
                        "nb_cv_candidats":    0,  # external candidate submitted
                        "nb_entretiens":      0,
                        "nb_rdv_suivi":       0,  # client follow-up meetings (RDV suivi)
                        "nb_signatures":      0,
                        "nb_ao_traites":      0,
                        "nb_ao_ouverts":      0,
                        "nb_ao_clos":         0,
                    }
                leaderboard[rid][field] += 1

        _count_for_resource(appel_actions,     "nb_appels")
        _count_for_resource(suivi_actions,     "nb_rdv_suivi")   # Suivi de Mission (type 11)
        # nb_entretiens per commercial: counted from positionings at state {4,5} below
        # (NOT from entretien_actions CRM logs which overcount with unrelated activity)

        # ── CVs per commercial — single source: Positionnements ──────────────────
        # Using positionings (not actions typeOf=3) as the authoritative count
        # because positionings are what's shown in the "Positionnements" page in
        # BoondManager and directly track profile submissions to clients.
        # dependsOn.type = 'resource' → internal consultant (repositionable)
        # dependsOn.type = 'candidate' → external candidate (headhunted)
        for pos in period_positionings:
            mgr_id = _positioning_manager_id(pos)
            if not mgr_id:
                continue
            if mgr_id not in leaderboard:
                name = resource_map.get(mgr_id, f"id={mgr_id}")
                leaderboard[mgr_id] = {
                    "name":               name,
                    "nb_appels":          0,
                    "nb_cv":              0,
                    "nb_cv_ressources":   0,
                    "nb_cv_candidats":    0,
                    "nb_entretiens":      0,
                    "nb_rdv_suivi":       0,
                    "nb_signatures":      0,
                    "nb_ao_traites":      0,
                    "nb_ao_ouverts":      0,
                    "nb_ao_clos":         0,
                }
            s = _safe_state(pos)
            if s == 0:  # CV Envoyé Client
                profile_type = _positioning_profile_type(pos)
                if profile_type == "resource":
                    leaderboard[mgr_id]["nb_cv_ressources"] += 1
                else:
                    leaderboard[mgr_id]["nb_cv_candidats"] += 1
                leaderboard[mgr_id]["nb_cv"] += 1
            elif s in ENTRETIEN_STATES:  # state 4 or 5 — Entretien client
                leaderboard[mgr_id]["nb_entretiens"] += 1

        # Count signatures per commercial: AOs with state==1 (Gagné) attributed to manager
        for opp in opportunities:
            rid = _linked_resource_id(opp)
            if not rid or rid not in leaderboard:
                continue
            if str((opp.get("attributes") or {}).get("state", "")) == AO_STATE_GAGNE:
                leaderboard[rid]["nb_signatures"] += 1

        # nb_rdv_suivi is already counted from suivi_actions above

        for opp in opportunities:
            rid = _linked_resource_id(opp)
            if rid and rid in leaderboard:
                leaderboard[rid]["nb_ao_traites"] += 1
                state = str((opp.get("attributes") or {}).get("state", ""))
                if state in AO_STATES_OPEN:
                    leaderboard[rid]["nb_ao_ouverts"] += 1
                elif state in AO_STATES_CLOS:
                    leaderboard[rid]["nb_ao_clos"] += 1

        # Compute period duration in weeks (for volume/week)
        try:
            d1 = datetime.fromisoformat(start_date)
            d2 = datetime.fromisoformat(end_date)
            nb_weeks = max(((d2 - d1).days / 7), 1)
        except Exception:
            nb_weeks = 4

        commerciaux = []
        for rid, data in leaderboard.items():
            total_actions = data["nb_appels"] + data["nb_cv"] + data["nb_entretiens"] + data["nb_signatures"]
            taux = (round(data["nb_signatures"] / data["nb_entretiens"], 2)
                    if data["nb_entretiens"] > 0 else None)
            commerciaux.append({
                "name":              data["name"],
                "nb_appels":         data["nb_appels"],
                "nb_cv":             data["nb_cv"],
                "nb_cv_ressources":  data["nb_cv_ressources"],  # internal resources
                "nb_cv_candidats":   data["nb_cv_candidats"],   # external candidates
                "nb_entretiens":     data["nb_entretiens"],
                "nb_rdv_suivi":      data["nb_rdv_suivi"],      # client follow-up meetings
                "nb_signatures":     data["nb_signatures"],
                "nb_ao_traites":     data["nb_ao_traites"],
                "nb_ao_ouverts":     data["nb_ao_ouverts"],
                "nb_ao_clos":        data["nb_ao_clos"],
                "taux_conversion":   taux,
                "volume_par_semaine": round(total_actions / nb_weeks, 1),
            })

        def _sourcing_score(entry):
            return entry['nb_appels'] + (entry['nb_cv'] * 2)

        def _closing_score(entry):
            sigs = entry['nb_signatures']
            rate = entry['taux_conversion'] or 0
            return (sigs * 10) + round(rate * 100)
            
        for c in commerciaux:
            c["sourcing_score"] = _sourcing_score(c)
            c["closing_score"] = _closing_score(c)

        sourcing_ranking = sorted(commerciaux, key=lambda x: x["sourcing_score"], reverse=True)
        closing_ranking  = sorted(commerciaux, key=lambda x: x["closing_score"], reverse=True)

        # ── Build period label ──
        MONTHS_FR = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
        try:
            sd = datetime.fromisoformat(start_date)
            label = f"{MONTHS_FR[sd.month]} {sd.year}"
        except Exception:
            label = f"{start_date} → {end_date}"

        # ── Build KPIs blocks ──
        activite = {
            "nb_ao_traites": nb_ao,
            "nb_ao_ouverts": len([o for o in opportunities
                                   if str((o.get("attributes") or {}).get("state", "")) in AO_STATES_OPEN]),
            "nb_ao_clos":   len([o for o in opportunities
                                  if str((o.get("attributes") or {}).get("state", "")) in AO_STATES_CLOS]),
            "nb_ao_par_semaine": round(nb_ao / nb_weeks, 1) if nb_weeks > 0 else 0,
            "moy_cv_par_ao": round(nb_cv / nb_ao, 2) if nb_ao > 0 else None,
        }

        sourcing = {
            "nb_cv_positionnes": nb_cv,
            "taux_cv_positionnes_par_ao": round(nb_cv / nb_ao, 2) if nb_ao > 0 else None,
            "moy_cv_par_signature": round(nb_cv / nb_signatures, 1) if nb_signatures > 0 else None,
            "taux_cv_to_interview_real": real_cv_conversion_rate,
            "avg_days_cv_to_interview": _avg(cohort_deltas),
            "cohort_match_pct": round(matched_count / nb_entretiens * 100) if nb_entretiens > 0 else 0,
        }

        entretiens = {
            "nb_entretiens": nb_entretiens,
            "moy_entretien_par_ao": round(nb_entretiens / nb_ao, 2) if nb_ao > 0 else None,
        }

        return {
            "period": {"start": start_date, "end": end_date, "label": label},
            "activite":    activite,
            "sourcing":    sourcing,
            "entretiens":  entretiens,
            "conversion":  conversion,
            "performance": performance,
            "sourcing_ranking": sourcing_ranking,
            "closing_ranking":  closing_ranking,
            "commerciaux":      sourcing_ranking, 
        }