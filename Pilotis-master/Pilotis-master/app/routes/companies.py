from flask import Blueprint, jsonify, send_file, request
from datetime import datetime, timedelta
import calendar
import io
import logging
import threading

logger = logging.getLogger(__name__)

companies_bp = Blueprint("companies_bp", __name__, url_prefix="/companies")

# ── In-memory result cache ────────────────────────────────────────────────────
_CACHE_TTL_SECONDS   = 3600
_CACHE_VERSION       = 5          
_CACHE_MAX_ENTRIES   = 30         # LRU cap: evict oldest when exceeded
_sync_cache: dict    = {}
_sync_lock           = threading.Lock()  # prevents concurrent double-sync


def _make_cache_key(start: str, end: str, contact_types: list, company_names: list, keyword: str) -> str:
    ct  = ",".join(sorted(contact_types))
    cn  = ",".join(sorted(company_names))
    kw  = keyword.strip().lower()
    return f"{start}|{end}|ct={ct}|cn={cn}|kw={kw}|v{_CACHE_VERSION}"


def _cache_get(start: str, end: str, contact_types: list, company_names: list, keyword: str):
    key   = _make_cache_key(start, end, contact_types, company_names, keyword)
    entry = _sync_cache.get(key)
    if entry and (datetime.now() - entry["ts"]).total_seconds() < _CACHE_TTL_SECONDS:
        age = int((datetime.now() - entry["ts"]).total_seconds())
        logger.warning("[CACHE] HIT %s → %s v%d (age %ds)", start, end, _CACHE_VERSION, age)
        return entry["data"], entry["period"]
    return None, None


def _cache_set(start: str, end: str, contact_types: list, company_names: list, keyword: str,
               data: list, period: dict):
    # LRU eviction: remove oldest entry when at capacity
    if len(_sync_cache) >= _CACHE_MAX_ENTRIES:
        oldest = min(_sync_cache, key=lambda k: _sync_cache[k]["ts"])
        del _sync_cache[oldest]
        logger.warning("[CACHE] EVICT oldest result entry (cap=%d)", _CACHE_MAX_ENTRIES)
    key = _make_cache_key(start, end, contact_types, company_names, keyword)
    _sync_cache[key] = {"data": data, "period": period, "ts": datetime.now()}
    logger.warning("[CACHE] SET %s → %s v%d (%d companies, %d entries total)",
                   start, end, _CACHE_VERSION, len(data), len(_sync_cache))


def _last_month_range(ref: datetime):
    first_of_this_month = ref.replace(day=1)
    last_month_end      = first_of_this_month - timedelta(days=1)
    last_month_start    = last_month_end.replace(day=1)
    return (
        last_month_start.strftime("%Y-%m-%d"),
        last_month_end.strftime("%Y-%m-%d"),
    )


def _resolve_window(now: datetime):
    """Return (start, end) for the CURRENT calendar month (or PREVIOUS if day <= 7)."""
    year, month = now.year, now.month
    if now.day <= 7:
        if month == 1:
            month = 12
            year -= 1
        else:
            month -= 1

    last_day = calendar.monthrange(year, month)[1]
    start = f"{year}-{month:02d}-01"
    end   = f"{year}-{month:02d}-{last_day:02d}"
    return start, end


def _parse_filters():
    """
    Extract and normalise filter params from the current request.
    Returns (start_date, end_date, contact_types, company_names, keyword).
    """
    now = datetime.now()

    start_date = request.args.get("start_date", "").strip()
    end_date   = request.args.get("end_date",   "").strip()
    if not start_date or not end_date:
        start_date, end_date = _resolve_window(now)

    contact_types = request.args.getlist("contact_types[]")
    if not contact_types:
        contact_types = ["Prospect", "Client", "Partenaire"]

    company_names = request.args.getlist("company_names[]")
    keyword       = request.args.get("keyword", "").strip()

    return start_date, end_date, contact_types, company_names, keyword


def _sync_with_fallback(
    start_date:    str,
    end_date:      str,
    contact_types: list,
    company_names: list,
    keyword:       str,
):
    """
    Run sync_companies with the given filters.
    Results are cached per unique (date-range + filters) combination.
    A threading.Lock prevents concurrent double-syncs for the same key.
    """
    from ..services.company_service import CompanyService
    from datetime import date as _date

    MONTHS_FR = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
                 "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

    # Fast path: cache hit → instant return
    cached_data, cached_period = _cache_get(start_date, end_date, contact_types, company_names, keyword)
    if cached_data is not None:
        return cached_data, start_date, end_date, cached_period

    # Slow path: run sync (only ONE concurrent sync at a time per process)
    with _sync_lock:
        # Re-check after acquiring lock
        cached_data, cached_period = _cache_get(start_date, end_date, contact_types, company_names, keyword)
        if cached_data is not None:
            return cached_data, start_date, end_date, cached_period

        result = CompanyService.sync_companies(
            start_date=start_date,
            end_date=end_date,
            contact_types=contact_types,
            company_names=company_names,
            keyword=keyword,
        )

        start_dt = _date.fromisoformat(start_date)
        period   = {
            "start": start_date,
            "end":   end_date,
            "label": f"{MONTHS_FR[start_dt.month]} {start_dt.year}",
        }
        _cache_set(start_date, end_date, contact_types, company_names, keyword, result, period)
        return result, start_date, end_date, period


# ── Routes ────────────────────────────────────────────────────────────────────

@companies_bp.route("/conversion", methods=["GET"])
def sync_companies_route():
    """
    GET /companies/conversion

    Optional query params:
      start_date      – YYYY-MM-DD (defaults to first day of current month)
      end_date        – YYYY-MM-DD (defaults to last day of current month)
      contact_types[] – one or more of: Prospect, Client, Partenaire  (default = all three)
      company_names[] – one or more canonical group names              (default = all)
      keyword         – free text; space-separated terms treated as AND (default = none)
    """
    start_date, end_date, contact_types, company_names, keyword = _parse_filters()
    try:
        result, start_date, end_date, period = _sync_with_fallback(
            start_date, end_date, contact_types, company_names, keyword
        )
        return jsonify({"success": True, "companies": result, "period": period})
    except Exception as e:
        logger.exception("[SYNC] Unexpected error")
        return jsonify({"success": False, "error": str(e)}), 500


@companies_bp.route("/export", methods=["GET"])
def export_stats():
    """
    GET /companies/export
    Downloads a styled .xlsx report.
    Accepts the same filter params as /conversion so the exported data matches the view.
    """
    start_date, end_date, contact_types, company_names, keyword = _parse_filters()
    try:
        result, start_date, end_date, period = _sync_with_fallback(
            start_date, end_date, contact_types, company_names, keyword
        )

        MONTHS_FR_SAFE = ["", "Jan", "Fev", "Mar", "Avr", "Mai", "Jun",
                          "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"]
        from datetime import date as _date
        start_dt = _date.fromisoformat(start_date)
        filename = f"Pilotis_Stats_{MONTHS_FR_SAFE[start_dt.month]}_{start_dt.year}.xlsx"

        from ..services.company_service import CompanyService
        xlsx_bytes = CompanyService.build_xlsx_from_db(rows=result, report_rows=result)
        return send_file(
            io.BytesIO(xlsx_bytes),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logger.exception("[EXPORT] Failed to build xlsx")
        return jsonify({"success": False, "error": str(e)}), 500


# ── Colleague's routes (stats + qwen cache) ───────────────────────────────────

@companies_bp.route("/stats", methods=["GET"])
def get_stats():
    """
    Returns monthly contact stats grouped by canonical company name.
    Uses the qwen AI service for deduplication (colleague's work).
    """
    try:
        from ..services.company_service import CompanyService
        data = CompanyService.get_contacts_stats()
        return jsonify(data)
    except Exception as e:
        logger.exception("[STATS] Error computing stats")
        return jsonify({"error": str(e)}), 500


@companies_bp.route("/reset-cache", methods=["GET"])
def reset_cache():
    """Reset Qwen AI caches + in-memory sync cache + DB group_name for non-keyword companies."""
    from ..services.qwen_service import ia_cache, groupe_par_nom, GROUP_RULES, normalize_name
    from ..services.company_service import _BASE_CACHE
    from ..models.company import Company
    from ..extensions import db

    ia_cache.clear()
    groupe_par_nom.clear()
    _sync_cache.clear()
    _BASE_CACHE.clear()

    cleared = 0
    for company in Company.query.all():
        name_lower = normalize_name(company.name or "")
        matched_by_rule = any(kw in name_lower for kw in GROUP_RULES)
        if not matched_by_rule:
            company.group_name = None
            cleared += 1
    db.session.commit()

    logger.warning("[RESET] Cleared %d DB group names → Qwen will re-resolve on next sync", cleared)
    return jsonify({
        "reset": "ok",
        "ai_cache_cleared": True,
        "db_group_names_cleared": cleared,
        "message": f"Qwen will re-resolve {cleared} companies on next /conversion call"
    })


@companies_bp.route("/audit", methods=["GET"])
def audit_company():
    """
    GET /companies/audit?company=GROUPE+BPCE&start_date=2026-03-01&end_date=2026-03-31

    Returns a detailed breakdown for ONE company so you can verify numbers
    against BoondManager manually.

    Response includes:
      - contacts_this_month: list of {id, name, status, created_at}
      - rdv_contacts:        list of unique contacts who had ≥1 RDV action
      - appel_contacts:      list of unique contacts who had ≥1 Appel action
      - rdv_actions:         list of matched RDV actions with contact info
      - appel_actions:       list of matched Appel actions with contact info
      - summary:             nb_contacts / nb_rdv / nb_appel / taux_rdv / taux_appel
    """
    from ..services.company_service import (
        _base_cache_get, ACTION_TYPES_RDV, ACTION_TYPE_APPEL, _pct
    )
    import calendar as _cal

    now        = datetime.now()
    start_date = request.args.get("start_date", "").strip()
    end_date   = request.args.get("end_date",   "").strip()
    company_q  = request.args.get("company",    "").strip().upper()

    if not start_date or not end_date:
        year, month = now.year, now.month
        if now.day <= 7:
            month = month - 1 if month > 1 else 12
            year  = year if month > 1 else year - 1
        last_day   = _cal.monthrange(year, month)[1]
        start_date = f"{year}-{month:02d}-01"
        end_date   = f"{year}-{month:02d}-{last_day:02d}"

    if not company_q:
        return jsonify({"error": "Pass ?company=COMPANY+NAME in the URL"}), 400

    base = _base_cache_get(start_date, end_date)
    if base is None:
        return jsonify({
            "error": "No cached data for this date range. Call /conversion first to populate the cache.",
            "hint": f"GET /companies/conversion?start_date={start_date}&end_date={end_date}"
        }), 404

    company_meta       = base["company_meta"]
    all_contacts       = base["all_contacts"]
    contact_to_company = base["contact_to_company"]
    all_actions        = base["all_actions"]

    # Find all boond company IDs whose canonical name matches the query
    matched_cids = {
        cid for cid, meta in company_meta.items()
        if meta["canonical"].upper() == company_q
    }
    if not matched_cids:
        available = sorted({m["canonical"] for m in company_meta.values()})
        return jsonify({
            "error": f"Company '{company_q}' not found in cache.",
            "available_companies": available[:30]
        }), 404

    # --- Contacts created this month for this company group ---
    contacts_this_month = []
    for contact in all_contacts:
        created_at = contact.get("attributes", {}).get("creationDate", "")
        if not (start_date <= created_at <= end_date):
            continue
        rel = contact.get("relationships", {}).get("company", {}).get("data")
        if not (rel and rel.get("id")):
            continue
        if str(rel["id"]) not in matched_cids:
            continue
        attrs = contact.get("attributes", {})
        contacts_this_month.append({
            "id":         str(contact.get("id")),
            "first_name": attrs.get("firstName", ""),
            "last_name":  attrs.get("lastName",  ""),
            "created_at": created_at,
            "company_id": str(rel["id"]),
        })

    contact_ids_this_month = {c["id"] for c in contacts_this_month}

    # --- Actions in the period for this company group ---
    def _get_contact_ids_from_action(action):
        rels = action.get("relationships") or {}
        found = {}
        for key in ("contact", "contacts", "mainContact", "dependsOn"):
            val = rels.get(key, {})
            if not isinstance(val, dict):
                continue
            d     = val.get("data")
            clist = d if isinstance(d, list) else ([d] if d else [])
            for cd in clist:
                if cd and cd.get("id"):
                    if key == "dependsOn" and cd.get("type") and cd.get("type") != "contact":
                        continue
                    cid_c = str(cd["id"])
                    comp  = contact_to_company.get(cid_c)
                    if comp in matched_cids:
                        found[cid_c] = comp
            if found:
                break
        return found

    rdv_actions_detail   = []
    appel_actions_detail = []
    rdv_contact_ids      = set()
    appel_contact_ids    = set()

    for action in all_actions:
        type_of = action.get("attributes", {}).get("typeOf")
        contacts_found = _get_contact_ids_from_action(action)
        if not contacts_found:
            continue

        action_row = {
            "action_id":   str(action.get("id")),
            "type":        type_of,
            "date":        action.get("attributes", {}).get("startDate", ""),
            "contacts":    list(contacts_found.keys()),
            "contacts_in_period": [c for c in contacts_found if c in contact_ids_this_month],
        }

        if type_of in ACTION_TYPES_RDV:
            rdv_actions_detail.append(action_row)
            rdv_contact_ids.update(contacts_found.keys())
        elif type_of == ACTION_TYPE_APPEL:
            appel_actions_detail.append(action_row)
            appel_contact_ids.update(contacts_found.keys())

    nb_contacts = len(contacts_this_month)
    nb_rdv      = min(len(rdv_contact_ids),   nb_contacts)
    nb_appel    = min(len(appel_contact_ids), nb_contacts)

    return jsonify({
        "company":     company_q,
        "period":      {"start": start_date, "end": end_date},
        "summary": {
            "nb_contacts": nb_contacts,
            "nb_rdv":      nb_rdv,
            "nb_appel":    nb_appel,
            "taux_rdv":    _pct(nb_rdv,   nb_contacts),
            "taux_appel":  _pct(nb_appel, nb_contacts),
        },
        "contacts_this_month":      contacts_this_month,
        "rdv_unique_contact_ids":   sorted(rdv_contact_ids),
        "appel_unique_contact_ids": sorted(appel_contact_ids),
        "rdv_actions":              sorted(rdv_actions_detail,   key=lambda x: x["date"]),
        "appel_actions":            sorted(appel_actions_detail, key=lambda x: x["date"]),
        "note": (
            "rdv_unique_contact_ids / appel_unique_contact_ids may include contacts from "
            "previous months (not in contacts_this_month). The nb_rdv/nb_appel are capped "
            "at nb_contacts for the rate calculation."
        ),
    })