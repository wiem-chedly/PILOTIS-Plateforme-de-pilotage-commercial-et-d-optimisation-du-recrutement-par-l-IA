import json
from datetime import datetime
from ..extensions import db


class PilotisConfig(db.Model):
    """
    Key-value configuration store for the Pilotis module.
    One row per config key. Values are stored as JSON strings.

    Keys used:
      "recrutement_recent_days"  → int   (default 30)
      "sortie_prochaine_days"    → int   (default 30)
      "taci_cible"               → int   (default 90)
      "debut_semaine"            → str   ("lundi" | "dimanche")
      "objectifs"                → list  [{sales_name, positionnements, entretiens,
                                            signatures, ca_cible}]
    """

    __tablename__ = "pilotis_config"

    id         = db.Column(db.Integer, primary_key=True)
    key        = db.Column(db.String(100), unique=True, nullable=False)
    value_json = db.Column(db.Text, nullable=False, default="{}")
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    # ── Serialization helpers ─────────────────────────────────────────────────

    def get_value(self):
        """Deserialize JSON value."""
        try:
            return json.loads(self.value_json)
        except Exception:
            return None

    def set_value(self, val):
        """Serialize value to JSON string."""
        self.value_json = json.dumps(val, ensure_ascii=False)

    # ── Class-level shortcuts ─────────────────────────────────────────────────

    @classmethod
    def get(cls, key, default=None):
        """Return a config value by key, or *default* if missing."""
        row = cls.query.filter_by(key=key).first()
        if row is None:
            return default
        return row.get_value()

    @classmethod
    def set(cls, key, value):
        """Upsert a config value by key."""
        from ..extensions import db as _db
        row = cls.query.filter_by(key=key).first()
        if row is None:
            row = cls(key=key)
            _db.session.add(row)
        row.set_value(value)
        _db.session.commit()
