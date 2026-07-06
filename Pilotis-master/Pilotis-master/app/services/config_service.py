"""
Config service — single source of truth for Pilotis module configuration.

Reads from PilotisConfig table and merges over hard-coded defaults.
All other services import get_config() from here; they never query
PilotisConfig directly (Dependency Inversion Principle).
"""
from ..models.pilotis_config import PilotisConfig

# ── Hard-coded defaults ───────────────────────────────────────────────────────
DEFAULTS: dict = {
    "recrutement_recent_days": 30,
    "sortie_prochaine_days":   30,
    "taci_cible":              90,
    "debut_semaine":           "lundi",
    "objectifs":               [],
}


def get_config() -> dict:
    """Return full config dict, merging DB values over defaults."""
    result = dict(DEFAULTS)
    for key in DEFAULTS:
        val = PilotisConfig.get(key)
        if val is not None:
            result[key] = val
    return result


def save_config(data: dict) -> None:
    """
    Persist a subset of config keys from *data*.
    Unknown keys are silently ignored (Open/Closed Principle — no existing
    behaviour changes when new keys are added later).
    """
    allowed = set(DEFAULTS.keys())
    for key, value in data.items():
        if key in allowed:
            PilotisConfig.set(key, value)
