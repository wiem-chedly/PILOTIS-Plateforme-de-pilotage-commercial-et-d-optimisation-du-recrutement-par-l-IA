import atexit
import os
import threading
import calendar
import time
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger


def _sync_boond(app):
    """Synchronisation BoondManager (toutes les 2h)."""
    with app.app_context():
        print(" BoondManager sync starting…")
        try:
            from app.services.boond_service import BoondService
            BoondService().sync_opportunities()
            print(" BoondManager sync complete.")
        except Exception as e:
            print(f" Sync error: {e}")


def _scan_candidate_emails(app):
    """
    Scanne les emails de TOUS les contacts connectés via OAuth Gmail.
    (NOUVELLE VERSION - multi-comptes OAuth)
    """
    with app.app_context():
        print(" Scanning all connected contacts emails via OAuth Gmail...")
        try:
            from app.services.multi_email_scanner import MultiEmailScanner
            MultiEmailScanner.scan_all_connected_contacts()
            print(" Multi-contact OAuth scan complete.")
        except Exception as e:
            print(f" Multi-contact scan error: {e}")


def _sync_companies_ai(app):
    """Silent AI Deduplication Thread (Runs every 3h)."""
    with app.app_context():
        print(" Qwen AI Company Deduplication starting…")
        try:
            from app.services.company_service import CompanyService
            
            today = datetime.now()
            ref = today
            if today.day <= 7:
                ref = today.replace(day=1) - timedelta(days=1)
                
            start_date = ref.replace(day=1).strftime("%Y-%m-%d")
            last_day = calendar.monthrange(ref.year, ref.month)[1]
            end_date = ref.replace(day=last_day).strftime("%Y-%m-%d")
            
            CompanyService.sync_companies(
                start_date=start_date,
                end_date=end_date,
                contact_types=["Prospect", "Client", "Partenaire"]
            )
            print(" Qwen AI Deduplication complete.")
        except Exception as e:
            print(f" Qwen sync error: {e}")


def _auto_match_candidates(app):
    """
    Matching automatique des CV avec les nouvelles offres (toutes les heures)
    Service 100% automatique - aucune intervention manuelle requise
    """
    with app.app_context():
        print(" Auto-matching starting…")
        try:
            from app.services.auto_matcher import AutoMatcher
            AutoMatcher.match_all_new_opportunities()
            print(" Auto-matching complete.")
        except Exception as e:
            print(f" Auto-matching error: {e}")


def start_scheduler(app):
    """Démarre toutes les tâches planifiées en arrière-plan."""
    scheduler = BackgroundScheduler()

    # 1. Synchronisation BoondManager toutes les 2 heures
    scheduler.add_job(
        func=_sync_boond,
        args=[app],
        trigger=IntervalTrigger(hours=2),
        id="boond_sync",
        name="BoondManager sync every 2 hours",
        replace_existing=True,
    )

    # 2. Scan des emails OAuth (TOUS les contacts connectés) toutes les 5 minutes
    scheduler.add_job(
        func=_scan_candidate_emails,
        args=[app],
        trigger=IntervalTrigger(minutes=5),
        id="candidate_email_scan",
        name="Scan all connected contacts emails every 5 minutes",
        replace_existing=True,
    )

    # 3. Déduplication des entreprises AI (toutes les heures)
    scheduler.add_job(
        func=_sync_companies_ai,
        args=[app],
        trigger=IntervalTrigger(hours=1),
        id="company_ai_sync",
        name="Company AI deduplication every 1 hour",
        replace_existing=True,
    )

    # 4. Matching automatique CV/Offres (toutes les heures) - 100% AUTO
    scheduler.add_job(
        func=_auto_match_candidates,
        args=[app],
        trigger=IntervalTrigger(hours=1),
        id="auto_matching",
        name="Auto-match CV with opportunities every 1 hour",
        replace_existing=True,
    )

    # Démarrer le scheduler uniquement dans le processus principal
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        scheduler.start()
        print(" Scheduler started with 4 tasks:")
        print("   - BoondManager sync (every 2h)")
        print("   - OAuth Gmail multi-contact scan (every 5min)  NOUVEAU")
        print("   - Company AI dedup (every 1h)")
        print("   - Auto-matching CV/Offres (every 1h) [100% AUTOMATIQUE]")

        # ==================== TÂCHES INITIALES AU DÉMARRAGE ====================
        
        def run_initial_sync():
            """Synchronisation initiale BoondManager"""
            with app.app_context():
                print(" Running initial sync…")
                try:
                    from app.services.boond_service import BoondService
                    BoondService().sync_opportunities()
                    print(" Initial sync complete.")
                except Exception as e:
                    print(f" Initial sync error: {e}")

        def run_initial_scan():
            """Scan initial des emails OAuth (multi-comptes)"""
            with app.app_context():
                print(" Running initial OAuth multi-contact scan…")
                try:
                    from app.services.multi_email_scanner import MultiEmailScanner
                    MultiEmailScanner.scan_all_connected_contacts()
                    print(" Initial OAuth scan complete.")
                except Exception as e:
                    print(f" Initial OAuth scan error: {e}")

        def run_initial_ai():
            """Initialisation AI dedup"""
            with app.app_context():
                try:
                    _sync_companies_ai(app)
                except Exception as e:
                    print(f" Initial AI dedup error: {e}")

        def run_initial_matching():
            """
            Matching initial au démarrage - 100% automatique
            """
            with app.app_context():
                try:
                    from app.services.auto_matcher import AutoMatcher
                    from sqlalchemy.exc import IntegrityError
                    from app.extensions import db
                    
                    print(" Running initial auto-matching…")
                    
                    # Petite pause pour laisser les autres threads s'initialiser
                    time.sleep(2)
                    
                    # Désactiver l'autoflush temporairement
                    db.session.autoflush = False
                    
                    # Lancer le matching
                    result = AutoMatcher.match_all_new_opportunities()
                    db.session.commit()
                    
                    print(f" Initial auto-matching complete: {result} candidatures traitées")
                    
                except IntegrityError as e:
                    db.session.rollback()
                    if "UniqueViolation" in str(e) or "duplicate" in str(e):
                        print(" Initial auto-matching: quelques doublons ignorés (normal)")
                    else:
                        print(f" Initial auto-matching error: {e}")
                except Exception as e:
                    db.session.rollback()
                    print(f" Initial auto-matching error: {e}")
                finally:
                    db.session.autoflush = True

        # Démarrer les threads d'initialisation
        thread_sync = threading.Thread(target=run_initial_sync, daemon=True)
        thread_scan = threading.Thread(target=run_initial_scan, daemon=True)
        thread_ai   = threading.Thread(target=run_initial_ai, daemon=True)
        thread_matching = threading.Thread(target=run_initial_matching, daemon=True)
        
        thread_sync.start()
        thread_scan.start()
        thread_ai.start()
        thread_matching.start()

        # Arrêter proprement le scheduler à la fermeture
        atexit.register(lambda: scheduler.shutdown())
    else:
        print(" Scheduler skipped (debug reloader process)") 