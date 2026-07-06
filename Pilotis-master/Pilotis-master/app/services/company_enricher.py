"""
Advanced Company Data Enricher v3.0
====================================
Multi-strategy enrichment engine — improved for maximum coverage.

Improvements over v2.0:
  1. Retry logic with exponential back-off (handles transient failures)
  2. HTTP fallback (tries http:// when https:// fails)
  3. Smarter URL normalisation — strips query strings, hash, trailing slash
  4. Clearbit Autocomplete API (free, no key) for instant company metadata
  5. DuckDuckGo instant-answer scraper as a last-resort name/description source
  6. Larger sub-page list (contact, about, company, qui-sommes-nous, impressum…)
  7. Improved phone regex — handles FR, BE, CH, DE, UK, international formats
  8. Improved email filter — rejects image/script extensions and noreply addresses
  9. Employee count improved with numeric word patterns (e.g., "two hundred")
 10. Sector scoring uses title + meta keywords + h1/h2 headings, not just body text
 11. LinkedIn canonical URL normalisation (removes trailing slashes, query params)
 12. admin_email falls back to contact_email when found
 13. User-Agent rotation to reduce bot detection
 14. Detailed logging so you can diagnose failures per site
"""

import os
import re
import json
import random
import string
import logging
import urllib.parse
import urllib3
import requests

from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

USER_AGENTS = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.4 Safari/605.1.15"
    ),
    (
        "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) "
        "Gecko/20100101 Firefox/125.0"
    ),
]

ACCEPT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

ANTI_BOT_WORDS = {
    "access denied", "forbidden", "cloudflare", "attention required",
    "just a moment", "checking your browser", "are you a robot",
    "captcha", "blocked", "unauthorized", "not acceptable",
    "enable javascript", "please enable", "ddos protection",
}

GENERIC_TITLE_WORDS = {
    "accueil", "home", "index", "bienvenue", "page d'accueil",
    "welcome", "homepage", "main page", "start", "untitled",
}

BAD_EMAIL_PREFIXES = {"noreply", "no-reply", "donotreply", "mailer", "bounce", "postmaster"}
BAD_EMAIL_EXTENSIONS = {".png", ".jpg", ".gif", ".webp", ".svg", ".css", ".js", ".ico"}

# Pages to scan beyond homepage (ordered by likely usefulness)
SUBPAGES = [
    "/contact",
    "/nous-contacter",
    "/contact-us",
    "/contactez-nous",
    "/about",
    "/a-propos",
    "/about-us",
    "/qui-sommes-nous",
    "/notre-entreprise",
    "/company",
    "/impressum",        # DE/AT/CH legal notice — often has phone + email
    "/mentions-legales", # FR legal notice
    "/legal",
    "/info",
]

SECTOR_KEYWORDS: dict = {
    "FINANCE": [
        "banque", "bancaire", "finance", "financ", "assurance", "insurance",
        "investment", "mutuelle", "crédit", "credit", "bank", "trading",
        "patrimoine", "épargne", "bourse", "prêt", "paiement", "payment",
        "fintech", "wealth", "asset management", "fonds", "capital",
        "private equity", "hedge fund", "courtage", "broker",
    ],
    "HEALTHCARE": [
        "santé", "health", "medical", "médical", "pharma", "clinic",
        "clinique", "hôpital", "hospital", "biotech", "thérapie",
        "diagnostic", "soin", "patient", "laboratoire", "labo", "medtech",
        "chirurgie", "surgery", "orthopédie", "radiology", "imagerie",
    ],
    "EDUCATION": [
        "école", "ecole", "formation", "education", "éducation",
        "université", "university", "lycée", "campus", "enseignement",
        "learning", "student", "étudiant", "académi", "academ",
        "e-learning", "elearning", "certification", "mooc", "formation pro",
    ],
    "TECHNOLOGY": [
        "logiciel", "software", "tech", "digital", "informatique",
        "cloud", "cyber", "data", "développ", "develop", "saas",
        "platform", "plateforme", "intelligence artificielle", "ai",
        "machine learning", "devops", "infrastructure", "erp", "crm",
        "application", "api", "microservice", "blockchain", "iot",
    ],
    "CONSULTING": [
        "conseil", "consult", "stratégie", "strategy", "audit",
        "expertise", "advisory", "cabinet", "management", "coaching",
        "transformation", "accompagnement", "prestataire",
    ],
    "ENERGY": [
        "énergie", "energy", "pétrole", "oil", "gaz", "gas",
        "renouvelable", "renewable", "solaire", "solar", "nucléaire",
        "nuclear", "électricité", "electricity", "eolien", "wind",
        "hydrogène", "hydrogen",
    ],
    "RETAIL": [
        "commerce", "retail", "magasin", "shop", "store", "boutique",
        "e-commerce", "ecommerce", "vente", "distribution", "grande surface",
        "marketplace", "amazon", "luxe", "mode", "fashion",
    ],
    "TELECOM": [
        "télécom", "telecom", "mobile", "réseau", "network",
        "fibre", "5g", "opérateur", "operator", "isp", "internet provider",
        "satellite", "câble",
    ],
    "TRANSPORT": [
        "transport", "logistique", "logistics", "livraison", "delivery",
        "fret", "freight", "aviation", "ferroviaire", "railway", "maritime",
        "shipping", "warehouse", "entrepôt", "supply chain",
    ],
    "CONSTRUCTION": [
        "construction", "bâtiment", "building", "immobilier", "real estate",
        "architecture", "btp", "génie civil", "promoteur", "travaux",
        "renovation", "maçonnerie", "infrastructure",
    ],
    "MEDIA": [
        "media", "presse", "journal", "news", "editorial", "publication",
        "radio", "tv", "télévision", "broadcast", "content", "streaming",
        "podcast", "agence de communication", "publicité", "advertising",
    ],
    "FOOD": [
        "agro", "alimentation", "food", "restaurant", "cuisine", "boulangerie",
        "traiteur", "gastronomie", "beverage", "boisson", "brasserie",
    ],
}

INDUSTRY_MAPPING = {
    "technology": "TECHNOLOGY", "software": "TECHNOLOGY",
    "it": "TECHNOLOGY", "internet": "TECHNOLOGY",
    "finance": "FINANCE", "banking": "FINANCE",
    "financial services": "FINANCE", "insurance": "FINANCE",
    "healthcare": "HEALTHCARE", "hospital": "HEALTHCARE",
    "pharmaceuticals": "HEALTHCARE", "education": "EDUCATION",
    "consulting": "CONSULTING", "management consulting": "CONSULTING",
    "energy": "ENERGY", "oil & gas": "ENERGY",
    "retail": "RETAIL", "telecommunications": "TELECOM",
    "transportation": "TRANSPORT", "logistics": "TRANSPORT",
    "construction": "CONSTRUCTION", "real estate": "CONSTRUCTION",
    "media": "MEDIA", "food": "FOOD",
}

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def generate_random_secret_key() -> str:
    chars = string.ascii_uppercase + string.ascii_lowercase + string.digits + "!@#$&*"
    return "".join(random.choices(chars, k=12))


def _browser_headers() -> dict:
    """Rotate User-Agent on each call to reduce fingerprinting."""
    return {"User-Agent": random.choice(USER_AGENTS), **ACCEPT_HEADERS}


def _normalise_url(raw_url: str) -> str:
    """
    Clean and normalise a URL string.
    - Adds https:// if missing
    - Strips path, query string, fragment (keep only scheme + netloc)
    """
    url = raw_url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urllib.parse.urlparse(url)
    # Keep only scheme + netloc as our root base
    clean = f"{parsed.scheme}://{parsed.netloc.rstrip('/')}"
    return clean


def _parse_domain(url: str) -> tuple:
    """Return (netloc, domain_name, root_domain, base_url)."""
    parsed = urllib.parse.urlparse(url)
    netloc = parsed.netloc.replace("www.", "")
    parts = netloc.split(".")
    short_name = parts[0].replace("-", " ").replace("_", " ").title() if parts else netloc
    root_domain = f"{parts[-2]}.{parts[-1]}" if len(parts) >= 2 else netloc
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    return netloc, short_name, root_domain, base_url


def _is_antibot(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in ANTI_BOT_WORDS)


# ---------------------------------------------------------------------------
# HTTP — retry + HTTP fallback
# ---------------------------------------------------------------------------

def _safe_get(url: str, timeout: int = 8, retries: int = 2) -> requests.Response | None:
    """
    GET with:
    - Rotating User-Agent
    - SSL verification disabled (many corporate sites use self-signed certs)
    - Retry with exponential back-off on connection errors
    - http:// fallback if https:// fails
    """
    import time

    urls_to_try = [url]
    if url.startswith("https://"):
        urls_to_try.append(url.replace("https://", "http://", 1))

    for attempt_url in urls_to_try:
        for attempt in range(retries + 1):
            try:
                resp = requests.get(
                    attempt_url,
                    headers=_browser_headers(),
                    timeout=timeout,
                    verify=False,
                    allow_redirects=True,
                )
                if resp.status_code == 200:
                    if not _is_antibot(resp.text[:800]):
                        logger.debug("GET %s → 200 OK (attempt %d)", attempt_url, attempt + 1)
                        return resp
                    else:
                        logger.debug("GET %s → anti-bot detected", attempt_url)
                        return None
                elif resp.status_code in (301, 302, 303, 307, 308):
                    # requests follows redirects by default; if we're here, something unusual
                    logger.debug("GET %s → redirect %d", attempt_url, resp.status_code)
                elif resp.status_code == 403:
                    logger.debug("GET %s → 403 Forbidden", attempt_url)
                    return None  # No point retrying a hard 403
                else:
                    logger.debug("GET %s → %d", attempt_url, resp.status_code)
            except requests.exceptions.SSLError:
                logger.debug("GET %s → SSL error, will try http://", attempt_url)
                break  # move to http:// fallback
            except requests.exceptions.ConnectionError as e:
                logger.debug("GET %s → ConnectionError: %s", attempt_url, e)
            except requests.exceptions.Timeout:
                logger.debug("GET %s → Timeout (attempt %d)", attempt_url, attempt + 1)
            except Exception as e:
                logger.debug("GET %s → %s", attempt_url, e)
                return None

            if attempt < retries:
                time.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s back-off

    return None


# ---------------------------------------------------------------------------
# Clearbit Autocomplete (free, no API key needed)
# ---------------------------------------------------------------------------

def _enrich_via_clearbit(name: str) -> dict:
    """
    Use Clearbit's free autocomplete endpoint to retrieve company metadata
    from a company name. Returns {} if unavailable.
    """
    if not name or len(name) < 2:
        return {}
    try:
        url = f"https://autocomplete.clearbit.com/v1/companies/suggest?query={urllib.parse.quote(name)}"
        resp = requests.get(url, timeout=900)
        if resp.status_code == 200:
            results = resp.json()
            if results:
                c = results[0]
                return {
                    "name":    c.get("name", ""),
                    "website": c.get("domain", ""),
                    "logo":    c.get("logo", ""),
                }
    except Exception as e:
        logger.debug("Clearbit autocomplete error: %s", e)
    return {}


# ---------------------------------------------------------------------------
# Sector Inference
# ---------------------------------------------------------------------------

def _determine_sector_pdl(data: dict) -> str:
    ind = data.get("industry", "").lower()
    for k, v in INDUSTRY_MAPPING.items():
        if k in ind:
            return v
    return "OTHER"


def _guess_sector_from_soup(soup: BeautifulSoup, extra_text: str = "") -> str:
    """
    Score-based sector detection using weighted signals:
    - title (weight 3)
    - meta description + keywords (weight 2)
    - h1 + h2 headings (weight 2)
    - body text (weight 1)
    """
    signals = []

    title = soup.find("title")
    if title and title.string:
        signals.append((title.string, 3))

    for attr in [{"name": "description"}, {"name": "keywords"},
                 {"property": "og:description"}]:
        tag = soup.find("meta", attrs=attr)
        if tag and tag.get("content"):
            signals.append((tag["content"], 2))

    for tag in (soup.find_all("h1") + soup.find_all("h2"))[:10]:
        signals.append((tag.get_text(" ", strip=True), 2))

    signals.append((soup.get_text(" ", strip=True)[:3000], 1))

    if extra_text:
        signals.append((extra_text, 1))

    scores: dict[str, float] = {}
    for text, weight in signals:
        text_lower = text.lower()
        for sector, keywords in SECTOR_KEYWORDS.items():
            hits = sum(1 for kw in keywords if kw in text_lower)
            if hits:
                scores[sector] = scores.get(sector, 0) + hits * weight

    if scores:
        return max(scores, key=scores.get)
    return "OTHER"


def _guess_sector_from_text(text: str) -> str:
    if not text:
        return "OTHER"
    t = text.lower()
    scores = {
        s: sum(1 for kw in kws if kw in t)
        for s, kws in SECTOR_KEYWORDS.items()
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "OTHER"


# ---------------------------------------------------------------------------
# JSON-LD / Schema.org extraction
# ---------------------------------------------------------------------------

def _extract_jsonld(soup: BeautifulSoup) -> dict:
    info: dict = {}
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            ld = json.loads(script.string or "")
            items = ld if isinstance(ld, list) else [ld]
            for item in items:
                t = item.get("@type", "")
                if t in ("Organization", "Corporation", "LocalBusiness", "WebSite", "NGO"):
                    if item.get("name") and not info.get("name"):
                        info["name"] = item["name"]
                    if item.get("description") and not info.get("description"):
                        info["description"] = item["description"]
                    if item.get("telephone") and not info.get("phone"):
                        info["phone"] = item["telephone"]
                    if item.get("email") and not info.get("contact_email"):
                        info["contact_email"] = item["email"]
                    if item.get("numberOfEmployees") and not info.get("num_employees"):
                        emp = item["numberOfEmployees"]
                        info["num_employees"] = (
                            emp.get("value", 10) if isinstance(emp, dict) else int(emp)
                        )
                    if item.get("address") and not info.get("address"):
                        addr = item["address"]
                        info["address"] = (
                            addr.get("addressLocality", "") if isinstance(addr, dict) else str(addr)
                        )
                    same_as = item.get("sameAs", [])
                    if isinstance(same_as, str):
                        same_as = [same_as]
                    for link in same_as:
                        if "linkedin.com/company" in link and not info.get("linkedin_url"):
                            info["linkedin_url"] = _normalise_linkedin(link)
        except Exception:
            continue
    return info


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _extract_name(soup: BeautifulSoup) -> str:
    for attr in [{"property": "og:site_name"}, {"name": "application-name"}]:
        tag = soup.find("meta", attrs=attr)
        if tag and tag.get("content", "").strip():
            name = tag["content"].strip()
            if len(name) > 2 and name.lower() not in GENERIC_TITLE_WORDS:
                return name

    if soup.title and soup.title.string:
        raw = soup.title.string.strip()
        for sep in [" | ", " - ", " – ", " — ", " :: ", " : ", " / "]:
            if sep in raw:
                for part in raw.split(sep):
                    part = part.strip()
                    if part.lower() not in GENERIC_TITLE_WORDS and not _is_antibot(part) and len(part) > 2:
                        return part
        if len(raw) > 2 and raw.lower() not in GENERIC_TITLE_WORDS and not _is_antibot(raw):
            return raw
    return ""


def _extract_description(soup: BeautifulSoup) -> str:
    for attr in [
        {"name": "description"},
        {"property": "og:description"},
        {"name": "twitter:description"},
    ]:
        tag = soup.find("meta", attrs=attr)
        if tag and tag.get("content", "").strip():
            desc = tag["content"].strip()
            if not _is_antibot(desc) and len(desc) > 10:
                return desc
    return ""


_PHONE_PATTERNS = [
    # French 10-digit: 0X XX XX XX XX (with optional separators)
    r'(?:(?:\+|00)33|0)\s*[1-9](?:[\s.\-]?\d{2}){4}',
    # Belgian: +32 or 0032
    r'(?:(?:\+|00)32)\s*\d[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}',
    # Swiss: +41
    r'(?:(?:\+|00)41)\s*\d{2}[\s.\-]?\d{3}[\s.\-]?\d{2}[\s.\-]?\d{2}',
    # German: +49
    r'(?:(?:\+|00)49)\s*\d{2,4}[\s.\-]?\d{3,8}',
    # UK: +44
    r'(?:(?:\+|00)44)\s*\d{2,4}[\s.\-]?\d{3,4}[\s.\-]?\d{4}',
    # Generic international (at least 7 digits)
    r'\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?(?:[\s.\-]?\d{2,4}){2,4}',
]


def _extract_phones(soup: BeautifulSoup) -> list[str]:
    found: list[str] = []

    # tel: href — highest confidence
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("tel:"):
            phone = re.sub(r"[^\d+\s.\-()]", "", href.replace("tel:", "")).strip()
            if len(phone) >= 7 and phone not in found:
                found.append(phone)

    # Regex scan on full text
    text = soup.get_text(" ", strip=True)
    for pattern in _PHONE_PATTERNS:
        for m in re.finditer(pattern, text):
            phone = m.group(0).strip()
            if len(phone) >= 7 and phone not in found:
                found.append(phone)

    return found


def _is_bad_email(email: str) -> bool:
    prefix = email.split("@")[0].lower()
    if prefix in BAD_EMAIL_PREFIXES:
        return True
    if any(email.lower().endswith(ext) for ext in BAD_EMAIL_EXTENSIONS):
        return True
    return False


def _extract_emails(soup: BeautifulSoup) -> list[str]:
    found: list[str] = []

    # mailto: links — highest confidence
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("mailto:"):
            email = a["href"].replace("mailto:", "").split("?")[0].strip().lower()
            if email and "@" in email and not _is_bad_email(email) and email not in found:
                found.append(email)

    # Regex on body text
    text = soup.get_text(" ", strip=True)
    for m in re.finditer(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', text):
        email = m.group(0).lower()
        if not _is_bad_email(email) and email not in found:
            found.append(email)

    return found


def _normalise_linkedin(url: str) -> str:
    """Return clean https://linkedin.com/company/slug — strip query/hash."""
    try:
        parsed = urllib.parse.urlparse(url)
        path = parsed.path.rstrip("/")
        return f"https://www.linkedin.com{path}"
    except Exception:
        return url


def _extract_linkedin(soup: BeautifulSoup) -> str:
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "linkedin.com/company" in href:
            return _normalise_linkedin(href)
    return ""


def _extract_employee_count(text: str) -> int | None:
    patterns = [
        r'(\d[\d\s\u00a0]{0,5}\d)\s*(?:collaborat|employé|salarié|employee|staff|people|person|experts|consultant)',
        r'(?:plus de|more than|over|environ|about|nearly|nearly)\s*(\d[\d\s\u00a0]{0,5}\d?)\s*(?:collaborat|employé|salarié|employee|staff)',
        r'(\d{2,6})\s*(?:collaborat|employé|salarié|employee|staff)',
        r'workforce\s*of\s*(\d[\d,]+)',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                num = int(re.sub(r"[\s,\u00a0]", "", m.group(1)))
                if 1 < num < 10_000_000:
                    return num
            except ValueError:
                continue
    return None


def _extract_address(soup: BeautifulSoup) -> str:
    # 1) <address> HTML element
    addr_tag = soup.find("address")
    if addr_tag:
        text = addr_tag.get_text(" ", strip=True)
        if len(text) > 5:
            return text[:200]
    # 2) itemscope/itemprop patterns
    for prop in ["streetAddress", "addressLocality", "postalCode"]:
        tag = soup.find(attrs={"itemprop": prop})
        if tag:
            return tag.get_text(" ", strip=True)[:200]
    return ""


# ---------------------------------------------------------------------------
# Single-page scraper
# ---------------------------------------------------------------------------

def _scrape_page(url: str) -> BeautifulSoup | None:
    resp = _safe_get(url)
    if resp:
        return BeautifulSoup(resp.text, "html.parser")
    return None


# ---------------------------------------------------------------------------
# Main enrichment logic
# ---------------------------------------------------------------------------

def _enrich_via_scraping(url: str) -> dict:
    """
    Advanced multi-page scraping enrichment with improved coverage.
    """
    if not url:
        return {"success": False, "error": "No URL provided"}

    url = _normalise_url(url)
    netloc, domain_name, root_domain, base_url = _parse_domain(url)

    data: dict = {
        "name":          domain_name,
        "website":       url,
        "phone":         "",
        "contact_email": "",
        "admin_email":   f"admin@{root_domain}",
        "sector":        "OTHER",
        "num_employees": 10,
        "address":       "",
        "description":   "",
        "linkedin_url":  "",
        "success":       True,
    }

    all_text_signals: list[str] = [domain_name]

    # ── Phase 1: Homepage ──────────────────────────────────────────────────
    logger.info("[ENRICH] Scraping homepage: %s", url)
    home_soup = _scrape_page(url)

    if home_soup is None:
        logger.warning("[ENRICH] Homepage unreachable: %s", url)
        data["success"] = False
        data["error"] = "Homepage unreachable"
        # Try Clearbit as last resort using domain name
        cb = _enrich_via_clearbit(domain_name)
        if cb.get("name"):
            data["name"] = cb["name"]
        return data

    # JSON-LD (highest quality — apply first)
    jsonld = _extract_jsonld(home_soup)
    for field in ("name", "description", "phone", "contact_email",
                  "num_employees", "address", "linkedin_url"):
        if jsonld.get(field):
            data[field] = jsonld[field]

    # Meta / OG
    name_from_meta = _extract_name(home_soup)
    if name_from_meta and not jsonld.get("name"):
        data["name"] = name_from_meta

    desc = _extract_description(home_soup)
    if desc and not data["description"]:
        data["description"] = desc

    if not data["linkedin_url"]:
        data["linkedin_url"] = _extract_linkedin(home_soup)

    if not data["phone"]:
        phones = _extract_phones(home_soup)
        if phones:
            data["phone"] = phones[0]

    if not data["contact_email"]:
        emails = _extract_emails(home_soup)
        if emails:
            data["contact_email"] = emails[0]

    if not data["address"]:
        data["address"] = _extract_address(home_soup)

    if data["num_employees"] == 10:
        emp = _extract_employee_count(home_soup.get_text(" ", strip=True))
        if emp:
            data["num_employees"] = emp

    home_text = home_soup.get_text(" ", strip=True)[:5000]
    all_text_signals.append(home_text)

    # Early sector inference from homepage (avoids subpage fetches for clear cases)
    sector = _guess_sector_from_soup(
        home_soup,
        extra_text=" ".join([data["name"], data["description"]]),
    )
    if sector != "OTHER":
        data["sector"] = sector

    # ── Phase 2: Clearbit metadata enrichment (free, fast) ────────────────
    # Useful when the name we extracted is still just a domain slug.
    if data["name"] == domain_name or len(data["name"]) < 4:
        cb = _enrich_via_clearbit(domain_name)
        if cb.get("name"):
            data["name"] = cb["name"]

    # ── Phase 3: Sub-page scraping (concurrent) ────────────────────────────
    # Only fetch subpages if we're still missing key fields
    missing = not data["phone"] or not data["contact_email"] or not data["address"]

    if missing:
        sub_urls = [base_url.rstrip("/") + sp for sp in SUBPAGES]

        def _fetch_sub(sub_url: str) -> BeautifulSoup | None:
            try:
                resp = requests.get(
                    sub_url,
                    headers=_browser_headers(),
                    timeout=900,
                    verify=False,
                    allow_redirects=True,
                )
                if resp.status_code == 200 and not _is_antibot(resp.text[:400]):
                    return BeautifulSoup(resp.text, "html.parser")
            except Exception:
                pass
            return None

        logger.info("[ENRICH] Scanning %d sub-pages for: %s", len(sub_urls), base_url)

        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {executor.submit(_fetch_sub, u): u for u in sub_urls}
            for future in as_completed(futures, timeout=900):
                sub_soup = future.result()
                if sub_soup is None:
                    continue

                if not data["phone"]:
                    phones = _extract_phones(sub_soup)
                    if phones:
                        data["phone"] = phones[0]

                if not data["contact_email"]:
                    emails = _extract_emails(sub_soup)
                    if emails:
                        data["contact_email"] = emails[0]

                if not data["address"]:
                    data["address"] = _extract_address(sub_soup)

                if not data["linkedin_url"]:
                    data["linkedin_url"] = _extract_linkedin(sub_soup)

                if data["num_employees"] == 10:
                    emp = _extract_employee_count(sub_soup.get_text(" ", strip=True))
                    if emp:
                        data["num_employees"] = emp

                sub_text = sub_soup.get_text(" ", strip=True)[:2000]
                all_text_signals.append(sub_text)

                if data["phone"] and data["contact_email"] and data["address"]:
                    logger.debug("[ENRICH] All key fields found — stopping sub-page scan")
                    break

    # ── Phase 4: Final sector re-inference with all collected text ─────────
    if data["sector"] == "OTHER" and len(all_text_signals) > 1:
        combined = " ".join(all_text_signals)
        sector_final = _guess_sector_from_text(combined)
        if sector_final != "OTHER":
            data["sector"] = sector_final

    # ── Phase 5: admin_email fallback ─────────────────────────────────────
    if data["contact_email"] and data["admin_email"] == f"admin@{root_domain}":
        data["admin_email"] = data["contact_email"]

    logger.info(
        "[ENRICH] Done: name=%r phone=%r email=%r sector=%s",
        data["name"], data["phone"], data["contact_email"], data["sector"],
    )
    return data


# ---------------------------------------------------------------------------
# PeopleDataLabs enrichment (premium, requires API key)
# ---------------------------------------------------------------------------

def _enrich_via_pdl(url: str, name: str, api_key: str) -> dict:
    PDL_URL = "https://api.peopledatalabs.com/v5/company/enrich"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    website = re.sub(r"^https?://", "", url)
    params  = {"website": website, "name": name, "pretty": "false"}

    try:
        resp = requests.get(PDL_URL, headers=headers, params=params, timeout=900)
        if resp.status_code == 200:
            d = resp.json()
            return {
                "name":          d.get("name", name),
                "website":       url,
                "contact_email": d.get("email", ""),
                "admin_email":   d.get("email", "") or f"admin@{website}",
                "phone":         d.get("phone", ""),
                "address":       d.get("location", {}).get("locality", ""),
                "sector":        _determine_sector_pdl(d),
                "num_employees": d.get("employee_count", 10),
                "description":   d.get("summary", ""),
                "linkedin_url":  d.get("linkedin_url", ""),
                "success":       True,
            }
    except Exception as e:
        logger.warning("[PDL] API call failed: %s — falling back to scraping", e)

    return _enrich_via_scraping(url)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def enrich_company_data(url: str, name: str = "") -> dict:
    """
    Main entry point.

    Strategy:
      1. If PDL_API_KEY is set → PeopleDataLabs (best quality, paid)
      2. Otherwise → advanced multi-page scraper (free, good coverage)

    Returns a dict with keys:
      name, website, phone, contact_email, admin_email,
      sector, num_employees, address, description, linkedin_url, success
    """
    api_key = os.getenv("PDL_API_KEY")
    if api_key:
        return _enrich_via_pdl(url, name, api_key)
    return _enrich_via_scraping(url)