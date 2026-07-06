"""
Location detection service.

Priority:
  1. Phone number country prefix (fastest, most reliable)
  2. CV text location keywords (address, city, country mentions)

Returns a short string like "Tunisie", "France", "Maroc", "International", etc.
Used to route international profiles.
"""

import re

# ── Phone prefix → country mapping ──────────────────────────────────────────
PHONE_PREFIX_MAP = {
    "+216": "Tunisie",
    "+33":  "France",
    "+212": "Maroc",
    "+213": "Algérie",
    "+32":  "Belgique",
    "+41":  "Suisse",
    "+352": "Luxembourg",
    "+1":   "États-Unis / Canada",
    "+44":  "Royaume-Uni",
    "+49":  "Allemagne",
    "+34":  "Espagne",
    "+39":  "Italie",
    "+31":  "Pays-Bas",
    "+351": "Portugal",
    "+48":  "Pologne",
    "+380": "Ukraine",
    "+7":   "Russie",
    "+20":  "Égypte",
    "+221": "Sénégal",
    "+225": "Côte d'Ivoire",
    "+237": "Cameroun",
    "+234": "Nigeria",
    "+27":  "Afrique du Sud",
}

# ── CV text keywords → country ───────────────────────────────────────────────
CV_LOCATION_PATTERNS = [
    # City names → map to country
    (r"\b(tunis|sfax|sousse|monastir|bizerte|nabeul|manouba|ariana|ben arous)\b", "Tunisie"),
    (r"\b(paris|lyon|marseille|bordeaux|toulouse|lille|nantes|strasbourg|nice|montpellier|rennes)\b", "France"),
    (r"\b(casablanca|rabat|marrakech|fes|agadir|tanger|oujda|meknes)\b", "Maroc"),
    (r"\b(alger|oran|constantine|annaba|blida|batna|setif|tlemcen)\b", "Algérie"),
    (r"\b(bruxelles|brussels|liège|gand|anvers|charleroi)\b", "Belgique"),
    (r"\b(genève|zurich|berne|lausanne|basel)\b", "Suisse"),
    (r"\b(luxembourg)\b", "Luxembourg"),
    (r"\b(new york|los angeles|chicago|houston|toronto|montreal|vancouver)\b", "États-Unis / Canada"),
    (r"\b(london|manchester|birmingham|glasgow|edinburgh)\b", "Royaume-Uni"),
    (r"\b(berlin|munich|hambourg|francfort|cologne)\b", "Allemagne"),
    # Country names directly
    (r"\b(tunisie|tunisia)\b", "Tunisie"),
    (r"\b(france|français|française)\b", "France"),
    (r"\b(maroc|morocco|marocain)\b", "Maroc"),
    (r"\b(algérie|algerie|algeria|algérien)\b", "Algérie"),
    (r"\b(belgique|belgium|belge)\b", "Belgique"),
    (r"\b(suisse|switzerland|swiss)\b", "Suisse"),
    (r"\b(canada|québec|quebec)\b", "Canada"),
]

# Countries / prefixes considered "local" (non-international for routing)
LOCAL_COUNTRIES = {"Tunisie"}


def detect_location_from_phone(phone: str) -> str | None:
    """
    Infer the country from a phone number's country prefix.
    Returns country name or None if unrecognised.
    """
    if not phone:
        return None

    # Normalise: remove spaces/dashes, keep leading +
    phone_clean = re.sub(r"[\s\-().]+", "", phone)

    # Sort prefixes longest-first to avoid +1 shadowing +1xxx
    for prefix in sorted(PHONE_PREFIX_MAP.keys(), key=len, reverse=True):
        if phone_clean.startswith(prefix):
            return PHONE_PREFIX_MAP[prefix]

    # French local format starting with 0 (no country code) → assume France
    if phone_clean.startswith("0") and len(phone_clean) >= 10:
        return "France"

    # Tunisian local format (no +216)
    if re.match(r"^[2-9]\d{7}$", phone_clean):
        return "Tunisie"

    return None


def detect_location_from_cv(cv_text: str) -> str | None:
    """
    Scan the first 3000 chars of CV text for location-related keywords.
    Returns the most likely country name or None.
    """
    if not cv_text:
        return None

    text = cv_text[:3000].lower()

    for pattern, country in CV_LOCATION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return country

    return None


def detect_location(phone: str | None, cv_text: str | None) -> str | None:
    """
    Main entry point.
    1. Try phone prefix first.
    2. Fall back to CV text scan.
    Returns country string or None.
    """
    location = detect_location_from_phone(phone or "")
    if location:
        return location

    location = detect_location_from_cv(cv_text or "")
    return location


def is_international(location: str | None) -> bool:
    """Returns True if the candidate is NOT in a local country."""
    if not location:
        return False
    return location not in LOCAL_COUNTRIES
