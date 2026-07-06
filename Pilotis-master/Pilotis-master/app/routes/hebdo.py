from app.utils.route_cache import cache_route
from flask import Blueprint, jsonify, request
from datetime import date
import logging

logger   = logging.getLogger(__name__)
hebdo_bp = Blueprint("hebdo_bp", __name__, url_prefix="/hebdo")


@hebdo_bp.route("/synthese", methods=["GET"])
@cache_route(timeout_seconds=300)
def synthese():
    """
    GET /hebdo/synthese
    Optional query params:
      week_start=YYYY-MM-DD
      week_end=YYYY-MM-DD
    Defaults to previous Mon–Fri if omitted.
    """
    from ..services.hebdo_service import compute_hebdo_synthese
    try:
        ws = request.args.get("week_start")
        we = request.args.get("week_end")
        week_start = date.fromisoformat(ws) if ws else None
        week_end   = date.fromisoformat(we) if we else None
        data = compute_hebdo_synthese(week_start, week_end)
        return jsonify({"success": True, **data})
    except ValueError as exc:
        return jsonify({"success": False, "error": f"Invalid date format: {exc}"}), 400
    except Exception as exc:
        logger.exception("[HEBDO] synthese error")
        return jsonify({"success": False, "error": str(exc)}), 500


@hebdo_bp.route("/sales/<path:sales_name>", methods=["GET"])
@cache_route(timeout_seconds=300)
def sales_detail(sales_name: str):
    """
    GET /hebdo/sales/<sales_name>
    URL-encode spaces: /hebdo/sales/Sophie%20Martin
    Optional: ?week_start=YYYY-MM-DD&week_end=YYYY-MM-DD
    """
    from ..services.hebdo_service import get_sales_detail
    try:
        ws = request.args.get("week_start")
        we = request.args.get("week_end")
        week_start = date.fromisoformat(ws) if ws else None
        week_end   = date.fromisoformat(we) if we else None
        data = get_sales_detail(sales_name, week_start, week_end)
        return jsonify({"success": True, **data})
    except ValueError as exc:
        return jsonify({"success": False, "error": f"Invalid date format: {exc}"}), 400
    except Exception as exc:
        logger.exception("[HEBDO] sales detail error for '%s'", sales_name)
        return jsonify({"success": False, "error": str(exc)}), 500