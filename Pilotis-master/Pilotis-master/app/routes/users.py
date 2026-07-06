from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash

from app.services.user import create_user, get_all_users

users_bp = Blueprint("users", __name__)


@users_bp.route("/users", methods=["POST"])
def create():
    data = request.get_json()

    required_fields = ["first_name", "last_name", "email", "password", "role"]

    if not data or not all(f in data for f in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    password_hash = generate_password_hash(data["password"])

    user = create_user(data, password_hash)

    return jsonify({
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "phone": user.phone,
        "salary": str(user.salary) if user.salary else None,
        "tJM": str(user.tJM) if user.tJM else None,
        "available": user.available,
        "skills": user.skills,
        "created_at": user.created_at
    }), 201


@users_bp.route("/users", methods=["GET"])
def get_all():
    users = get_all_users()

    return jsonify([
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "role": u.role,
            "phone": u.phone,
            "salary": str(u.salary) if u.salary else None,
            "tJM": str(u.tJM) if u.tJM else None,
            "available": u.available,
            "skills": u.skills,
            "created_at": u.created_at
        }
        for u in users
    ])