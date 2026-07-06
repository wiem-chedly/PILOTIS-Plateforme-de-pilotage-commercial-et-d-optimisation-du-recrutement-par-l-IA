from app.utils.route_cache import cache_route
from flask import Blueprint, jsonify, request
import logging

logger      = logging.getLogger(__name__)
intercos_bp = Blueprint("intercos_bp", __name__, url_prefix="/intercos")


@intercos_bp.route("", methods=["GET"])
@cache_route(timeout_seconds=300)
def get_intercos():
    """
    GET /intercos
    Optional query params:
      category=all|recrutement_recent|sortie_prochaine|sortie_mission
      sales_name=all|<exact name>
    """
    from ..services.interco_service import get_intercos
    try:
        category   = request.args.get("category",   "all")
        sales_name = request.args.get("sales_name", "all")
        data = get_intercos(category=category, sales_name=sales_name)
        return jsonify({"success": True, **data})
    except Exception as exc:
        logger.exception("[INTERCOS] error")
        return jsonify({"success": False, "error": str(exc)}), 500