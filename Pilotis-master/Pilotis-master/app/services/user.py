from app.models.user import User
from app.extensions import db


def create_user(data, password_hash):
    user = User(
        first_name=data["first_name"],
        last_name=data["last_name"],
        email=data["email"],
        password_hash=password_hash,
        role=data["role"],
        phone=data.get("phone"),
        salary=data.get("salary"),
        tJM=data.get("tJM"),
        available=data.get("available", True),
        skills=data.get("skills")
    )

    db.session.add(user)
    db.session.commit()
    return user


def get_all_users():
    return User.query.all()
