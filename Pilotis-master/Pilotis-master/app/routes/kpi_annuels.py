from app.utils.route_cache import cache_route
from flask import Blueprint, jsonify, request
import logging

logger        = logging.getLogger(__name__)
kpi_annuel_bp = Blueprint("kpi_annuel_bp", __name__, url_prefix="/kpi")


@kpi_annuel_bp.route("/annuels", methods=["GET"])
@cache_route(timeout_seconds=300)
def get_annual_kpis():
    """
    GET /kpi/annuels
    Optional query param: year=2026  (defaults to current year)
    """
    from ..services.kpi_annuel_service import get_annual_kpis
    try:
        year = request.args.get("year", type=int)
        data = get_annual_kpis(year=year)
        return jsonify({"success": True, **data})
    except Exception as exc:
        logger.exception("[KPI ANNUEL] error")
        return jsonify({"success": False, "error": str(exc)}), 500