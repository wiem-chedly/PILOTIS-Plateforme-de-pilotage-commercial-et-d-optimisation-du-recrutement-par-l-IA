from flask import Blueprint, jsonify, request
import logging

logger    = logging.getLogger(__name__)
config_bp = Blueprint("config_bp", __name__, url_prefix="/config")


@config_bp.route("", methods=["GET"])
def get_config_route():
    """GET /config — return current Pilotis module configuration."""
    from ..services.config_service import get_config
    try:
        return jsonify({"success": True, "config": get_config()})
    except Exception as exc:
        logger.exception("[CONFIG] get error")
        return jsonify({"success": False, "error": str(exc)}), 500


@config_bp.route("", methods=["POST"])
def save_config_route():
    """
    POST /config — persist one or more config keys.
    Body: JSON object with any subset of allowed keys.
    Unknown keys are silently ignored.
    """
    from ..services.config_service import save_config
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"success": False, "error": "No JSON body received"}), 400
        save_config(data)
        return jsonify({"success": True, "message": "Configuration sauvegardée"})
    except Exception as exc:
        logger.exception("[CONFIG] save error")
        return jsonify({"success": False, "error": str(exc)}), 500