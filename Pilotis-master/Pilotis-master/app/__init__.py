# app/__init__.py
import os
import time
import logging
import threading
import sys

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from flask import Flask, redirect, session
from flask_cors import CORS
from flask_mail import Mail
from dotenv import load_dotenv

from app.config import Config
from app.extensions import db, migrate, cors

# Import models so SQLAlchemy metadata is populated for both projects
from app.models import *

load_dotenv()

mail   = Mail()
logger = logging.getLogger(__name__)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ── Core extensions ───────────────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)

    # ── CORS — union of both projects' origins ────────────────────────────────
    cors.init_app(
        app,
        supports_credentials=True,
        origins=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:8080",
            "http://localhost:8081",
        ],
    )

    # ── LinkedIn OAuth (colleague's project) ──────────────────────────────────
    try:
        from flask_dance.contrib.linkedin import make_linkedin_blueprint
        from flask_dance.consumer import oauth_authorized

        linkedin_oauth_bp = make_linkedin_blueprint(
            client_id=os.getenv("LINKEDIN_OAUTH_CLIENT_ID"),
            client_secret=os.getenv("LINKEDIN_OAUTH_CLIENT_SECRET"),
            scope="email,openid,profile,w_member_social",
            redirect_to="linkedin_login_success",
        )
        app.register_blueprint(linkedin_oauth_bp, url_prefix="/login")

        @app.route("/login/success")
        def linkedin_login_success():
            return redirect("http://localhost:8080/appels-offres?linkedin=connected")

        @oauth_authorized.connect_via(linkedin_oauth_bp)
        def linkedin_logged_in(blueprint, token):
            from app.models.settings import LinkedInAccount
            from app.models.users import User

            user_id = session.get("user_id")
            if not user_id:
                logger.warning("[OAUTH] No user in session")
                return
            user = User.query.get(user_id)
            if not user:
                logger.warning("[OAUTH] User %s not found", user_id)
                return

            account = LinkedInAccount.query.filter_by(email=user.email).first()
            if not account:
                account = LinkedInAccount(
                    name=user.email.split("@")[0],
                    email=user.email,
                    notify_enabled=True,
                    notify_by_email=True,
                )
                db.session.add(account)
                db.session.flush()
                user.linkedin_account_id = account.id
                logger.info("[OAUTH] New LinkedIn account created for %s", user.email)
            else:
                if not user.linkedin_account_id:
                    user.linkedin_account_id = account.id
                logger.info("[OAUTH] Existing LinkedIn account for %s", user.email)

            account.set_token(token["access_token"])
            db.session.commit()
            logger.info("[OAUTH] Token saved for %s", account.name)

    except ImportError:
        logger.info("[INIT] flask-dance not installed — LinkedIn OAuth skipped")

    # ── Blueprints — your project ─────────────────────────────────────────────
    from app.routes.users     import users_bp
    from app.routes.companies import companies_bp
    from app.routes.kpis      import kpis_bp
    from app.routes.recruitment_stats import recruitment_stats_bp

    app.register_blueprint(users_bp,     url_prefix="/users")
    app.register_blueprint(companies_bp, url_prefix="/companies")
    app.register_blueprint(kpis_bp,      url_prefix="/kpis")
    app.register_blueprint(recruitment_stats_bp)

    from app.routes.reporting import reporting_bp
    app.register_blueprint(reporting_bp)

    # ── Blueprints — Pilotis activity module (new) ────────────────────────────
    from app.routes.config_pilotis import config_bp
    from app.routes.hebdo          import hebdo_bp
    from app.routes.intercos       import intercos_bp
    from app.routes.kpi_annuels    import kpi_annuel_bp

    app.register_blueprint(config_bp)
    app.register_blueprint(hebdo_bp)
    app.register_blueprint(intercos_bp)
    app.register_blueprint(kpi_annuel_bp)

    # ── Blueprints — colleague's project ──────────────────────────────────────
    from app.routes.authentification import auth_bp
    from app.routes.organization_auth import org_auth_bp
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(org_auth_bp)

    from app.routes.jobs       import jobs_bp
    from app.routes.candidates import candidates_bp
    from app.routes.linkedin   import linkedin_bp
    from app.routes.quiz       import quiz_bp

    app.register_blueprint(jobs_bp,       url_prefix="/api")
    app.register_blueprint(candidates_bp, url_prefix="/api")
    app.register_blueprint(linkedin_bp,   url_prefix="/api")
    app.register_blueprint(quiz_bp,       url_prefix="/api")

    # ── Blueprints Wiem — Email templates, Profils recherchés, Gmail OAuth ─────
    try:
        from app.routes.email_templates   import email_templates_bp
        from app.routes.searched_profiles import searched_profiles_bp
        from app.routes.gmail_auth_routes import bp as gmail_auth_bp

        app.register_blueprint(email_templates_bp,   url_prefix="/api")
        app.register_blueprint(searched_profiles_bp, url_prefix="/api")
        app.register_blueprint(gmail_auth_bp)
        logger.info("[INIT] Blueprints Wiem enregistrés (email_templates, searched_profiles, gmail_auth)")
    except Exception as exc:
        logger.warning("[INIT] Blueprints Wiem non chargés: %s", exc)

    # ── Blueprint DoYouBuzz CV import ─────────────────────────────────────────
    try:
        from app.routes.cv_import import cv_bp
        # On enregistre le blueprint sans url_prefix='/api' supplémentaire
        # car Vite va réécrire /api/cv/import -> /cv/import
        app.register_blueprint(cv_bp)
        logger.info("[INIT] Blueprint DoYouBuzz cv_import enregistré (/cv/*)")
    except Exception as exc:
        logger.warning("[INIT] Blueprint cv_import non chargé: %s", exc)


    # ── Background scheduler (colleague's project — Boond sync every 2h) ──────
    try:
        from app.utils.scheduler import start_scheduler
        start_scheduler(app)
    except ImportError:
        logger.info("[INIT] scheduler not found — skipped")

    # ── Create tables ─────────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()

    # ── LinkedIn Form collector (Google Sheets → Candidats) ───────────────────
    try:
        from app.services.linkedin_form_collector import start_linkedin_form_collector
        start_linkedin_form_collector(app, interval_seconds=600)  # toutes les 10 min
    except Exception as exc:
        logger.warning("[INIT] LinkedIn Form collector non démarré: %s", exc)

    # ── Global error handler — ensures CORS headers even on 500 ───────────────
    from flask import jsonify as _jsonify

    @app.errorhandler(Exception)
    def handle_exception(e):
        """Return JSON for all unhandled exceptions (keeps CORS headers intact)."""
        import traceback
        logger.error("[500] Unhandled exception: %s\n%s", e, traceback.format_exc())
        response = _jsonify({"error": str(e), "success": False})
        response.status_code = 500
        return response

    # ── Startup cache reset (your project) ────────────────────────────────────
    def _startup_reset():
        with app.app_context():
            try:
                from app.services.qwen_service    import ia_cache, groupe_par_nom, GROUP_RULES, normalize_name
                from app.services.company_service import _BASE_CACHE
                from app.routes.companies         import _sync_cache
                from app.models.company           import Company

                ia_cache.clear()
                groupe_par_nom.clear()
                _sync_cache.clear()
                _BASE_CACHE.clear()

                cleared = 0
                for company in Company.query.all():
                    name_lower = normalize_name(company.name or "")
                    if not any(kw in name_lower for kw in GROUP_RULES):
                        company.group_name = None
                        cleared += 1
                db.session.commit()

                logger.warning("[STARTUP] Cache reset done — cleared %d DB group names", cleared)
            except Exception as exc:
                logger.error("[STARTUP] Cache reset failed: %s", exc)

    threading.Thread(target=_startup_reset, daemon=True).start()

    # ── Periodic 8-hour cache reset (your project) ────────────────────────────
    def _periodic_reset():
        while True:
            time.sleep(28800)  # 8 hours
            try:
                logger.warning("[DAEMON] Running 8-hour cache reset …")
                import requests as _req
                _req.get("http://127.0.0.1:5000/companies/reset-cache", timeout=900)
            except Exception as exc:
                logger.error("[DAEMON] Periodic reset failed: %s", exc)

    threading.Thread(target=_periodic_reset, daemon=True).start()

    return app