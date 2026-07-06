from flask import Blueprint, jsonify
from sqlalchemy import text
from app.extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health/db")
def db_health():
    try:
        result = db.session.execute(text("SELECT 1")).scalar()
        return jsonify({
            "database": "connected",
            "result": result
        })
    except Exception as e:
        return jsonify({
            "database": "error",
            "error": str(e)
        }), 500
