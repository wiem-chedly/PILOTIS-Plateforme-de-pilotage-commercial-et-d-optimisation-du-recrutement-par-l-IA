"""
routes/reporting.py — Endpoint de reporting financier et commercial.

GET /api/reporting/dashboard?year=2026&prev_year=2025
    Retourne les données épurées pour la comparaison annuelle :
    - CA (ca_pondere) N vs N-1
    - Contrats signés (statut='Gagné') N vs N-1
    - Évolution mensuelle et trimestrielle (CA et Contrats)
    - Top Clients (par nombre de contrats)
"""

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from datetime import datetime
from app.extensions import db
from app.models.job_requisition import JobRequisition

reporting_bp = Blueprint("reporting_bp", __name__, url_prefix="/api/reporting")

MONTHS_FR = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
             "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

QUARTER_LABELS = ["T1", "T2", "T3", "T4"]


def _safe_pct(current, previous):
    """Calcule le pourcentage d'évolution en toute sécurité."""
    if previous and previous != 0:
        return round((current - previous) / previous * 100, 1)
    if current and current > 0:
        return 100.0
    return 0.0


def _convert_date_safe(date_str):
    try:
        if not date_str:
            return None
        jour, mois, an = date_str.split("/")
        an_full = 2000 + int(an) if int(an) < 50 else 1900 + int(an)
        return datetime(an_full, int(mois), int(jour))
    except Exception:
        return None


from app.utils.route_cache import cache_route

@reporting_bp.route("/dashboard", methods=["GET"])
@cache_route(timeout_seconds=300)
def get_reporting_dashboard():
    try:
        now = datetime.utcnow()
        year = int(request.args.get("year", now.year))
        prev_year = int(request.args.get("prev_year", year - 1))

        # ── 1. Fetching base data (Only Contrats Gagnés) ───────────────────────
        all_won_aos = JobRequisition.query.filter(JobRequisition.statut == 'Gagné').all()

        contrats_curr = []
        contrats_prev = []

        for ao in all_won_aos:
            dt = _convert_date_safe(ao.date)
            if not dt:
                continue
            if dt.year == year:
                contrats_curr.append(ao)
            elif dt.year == prev_year:
                contrats_prev.append(ao)

        # ── 2. KPIs Globaux CA et Contrats ─────────────────────────────────────
        nb_contrats_curr = len(contrats_curr)
        nb_contrats_prev = len(contrats_prev)

        ca_curr = sum((ao.ca_pondere or 0) for ao in contrats_curr)
        ca_prev = sum((ao.ca_pondere or 0) for ao in contrats_prev)

        metrics = [
            {
                "label": "Chiffre d'Affaires",
                "currentValue": ca_curr,
                "previousValue": ca_prev,
                "format": "currency",
                "pct": _safe_pct(ca_curr, ca_prev)
            },
            {
                "label": "Contrats Signés",
                "currentValue": nb_contrats_curr,
                "previousValue": nb_contrats_prev,
                "format": "number",
                "pct": _safe_pct(nb_contrats_curr, nb_contrats_prev)
            }
        ]

        # ── 3. Évolution Mensuelle ─────────────────────────────────────────────
        monthly_comparison = []
        for m in range(1, 13):
            # Curr
            m_curr = [ao for ao in contrats_curr if _convert_date_safe(ao.date).month == m]
            c_curr = len(m_curr)
            ca_m_curr = sum((ao.ca_pondere or 0) for ao in m_curr)

            # Prev
            m_prev = [ao for ao in contrats_prev if _convert_date_safe(ao.date).month == m]
            c_prev = len(m_prev)
            ca_m_prev = sum((ao.ca_pondere or 0) for ao in m_prev)

            monthly_comparison.append({
                "month": MONTHS_FR[m],
                "currentContrats": c_curr,
                "previousContrats": c_prev,
                "currentCA": round(ca_m_curr, 2),
                "previousCA": round(ca_m_prev, 2),
            })

        # ── 4. Comparaison Trimestrielle ───────────────────────────────────────
        quarterly_comparison = []
        for q in range(1, 5):
            months_in_q = [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3]
            
            # Curr
            q_curr = [ao for ao in contrats_curr if _convert_date_safe(ao.date).month in months_in_q]
            cq_curr = len(q_curr)
            ca_q_curr = sum((ao.ca_pondere or 0) for ao in q_curr)

            # Prev
            q_prev = [ao for ao in contrats_prev if _convert_date_safe(ao.date).month in months_in_q]
            cq_prev = len(q_prev)
            ca_q_prev = sum((ao.ca_pondere or 0) for ao in q_prev)

            quarterly_comparison.append({
                "quarter": QUARTER_LABELS[q - 1],
                "currentContrats": cq_curr,
                "previousContrats": cq_prev,
                "currentCA": round(ca_q_curr, 2),
                "previousCA": round(ca_q_prev, 2),
            })

        # ── 5. Top Clients (par nombre de contrats générés l'année N) ──────────
        client_counts = {}
        for ao in contrats_curr:
            cname = ao.client_nom or "Inconnu"
            client_counts[cname] = client_counts.get(cname, 0) + 1
        
        # Sort and take top 8
        sorted_clients = sorted(client_counts.items(), key=lambda x: x[1], reverse=True)[:8]
        top_clients = [{"name": c[0], "value": c[1]} for c in sorted_clients]


        return jsonify({
            "success": True,
            "year": year,
            "prev_year": prev_year,
            "metrics": metrics,
            "monthly_comparison": monthly_comparison,
            "quarterly_comparison": quarterly_comparison,
            "top_clients": top_clients,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
