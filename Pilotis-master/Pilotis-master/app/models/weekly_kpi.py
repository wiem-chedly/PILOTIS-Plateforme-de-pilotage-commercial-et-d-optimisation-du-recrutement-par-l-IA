from datetime import datetime
from ..extensions import db


class WeeklyKpi(db.Model):
    """
    Persisted weekly KPI snapshot per sales person.
    Written (upserted) every time /hebdo/synthese is called.
    Used to build historical trends and annual projections for /kpi/annuels.
    """

    __tablename__ = "weekly_kpis"

    id = db.Column(db.Integer, primary_key=True)

    # Week identifier — ISO start date of the week (Monday)
    week_start = db.Column(db.Date, nullable=False)
    week_end   = db.Column(db.Date, nullable=False)
    week_label = db.Column(db.String(100))  # "Semaine du 16 au 20 mars 2026"

    # Sales person — resolved name from BoondManager mainManager
    sales_name     = db.Column(db.String(200), nullable=False)
    sales_boond_id = db.Column(db.String(50), nullable=True)

    # Weekly action counts
    nb_prospections    = db.Column(db.Integer, default=0)
    nb_suivi_mission   = db.Column(db.Integer, default=0)
    nb_positionnements = db.Column(db.Integer, default=0)
    nb_entretiens      = db.Column(db.Integer, default=0)
    nb_signatures      = db.Column(db.Integer, default=0)

    # Interco-specific counts
    nb_interco_positions  = db.Column(db.Integer, default=0)
    nb_interco_entretiens = db.Column(db.Integer, default=0)
    nb_interco_signatures = db.Column(db.Integer, default=0)

    # Conversion rates stored as floats 0.0–1.0
    taux_pos_ent  = db.Column(db.Float, nullable=True)
    taux_ent_sign = db.Column(db.Float, nullable=True)
    taux_pos_sign = db.Column(db.Float, nullable=True)

    computed_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint(
            "week_start", "sales_name",
            name="uq_weekly_kpi_week_sales"
        ),
    )
