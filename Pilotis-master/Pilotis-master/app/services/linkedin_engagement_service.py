"""
Service de récupération des interactions LinkedIn (likes et commentaires)
en utilisant l'API interne de LinkedIn avec le cookie li_at.
Pas besoin d'Apify ni de permissions OAuth spéciales.
"""
import requests
import re
from typing import List, Dict

HEADERS_BASE = {
    "accept": "application/vnd.linkedin.normalized+json+2.1",
    "accept-language": "fr-FR,fr;q=0.9",
    "csrf-token": "ajax:0000000000000000000",
    "x-restli-protocol-version": "2.0.0",
    "x-li-track": '{"clientVersion":"1.13.14695","mpVersion":"1.13.14695","osName":"web","timezoneOffset":1,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}


def _get_li_at() -> str:
    """Récupère le cookie li_at depuis la base de données."""
    try:
        from app.models.settings import AppSetting
        s = AppSetting.query.filter_by(key="linkedin_li_at_cookie").first()
        if s and s.value:
            return s.value.strip()
    except Exception:
        pass
    return ""


def _make_session(li_at: str) -> requests.Session:
    """Crée une session avec le cookie li_at et le CSRF token."""
    session = requests.Session()
    session.cookies.set("li_at", li_at, domain=".linkedin.com")
    # Le CSRF token doit matcher le header
    session.cookies.set("JSESSIONID", '"ajax:0000000000000000000"', domain=".www.linkedin.com")
    session.headers.update(HEADERS_BASE)
    return session


def _extract_urn_from_url(post_url: str) -> str:
    """Extrait le URN depuis une URL LinkedIn."""
    # URL format: https://www.linkedin.com/feed/update/urn:li:share:XXXXXXXX/
    match = re.search(r"(urn:li:[^/]+:\d+)", post_url)
    if match:
        return match.group(1)
    # Fallback: extrait l'ID numérique
    match2 = re.search(r"/(\d+)/?$", post_url.rstrip("/"))
    if match2:
        return f"urn:li:share:{match2.group(1)}"
    return ""


def get_post_likers(post_url: str, count: int = 50) -> List[Dict]:
    """
    Récupère la liste des personnes qui ont liké un post LinkedIn.
    Utilise l'API interne Voyager de LinkedIn avec le cookie li_at.
    """
    li_at = _get_li_at()
    if not li_at:
        print("[LinkedIn API] ⚠️ Cookie li_at non configuré")
        return []

    urn = _extract_urn_from_url(post_url)
    if not urn:
        print(f"[LinkedIn API] ⚠️ Impossible d'extraire l'URN de : {post_url}")
        return []

    session = _make_session(li_at)
    from urllib.parse import quote
    urn_enc = quote(urn, safe="")

    url = (
        f"https://www.linkedin.com/voyager/api/feed/reactions"
        f"?count={count}&q=social&social={urn_enc}&start=0"
    )

    try:
        resp = session.get(url, timeout=900)
        print(f"[LinkedIn API] Likers status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            elements = data.get("elements", [])
            likers = []
            for el in elements:
                actor = el.get("actor", {})
                name = (
                    actor.get("name", {}).get("text", "")
                    or actor.get("urn", "")
                )
                headline = actor.get("subtext", {}).get("text", "")
                profile_url = ""
                nav_url = actor.get("navigationUrl", "")
                if nav_url:
                    profile_url = nav_url if nav_url.startswith("http") else f"https://www.linkedin.com{nav_url}"
                likers.append({
                    "name": name,
                    "headline": headline,
                    "profile_url": profile_url,
                })
            print(f"[LinkedIn API] ✅ {len(likers)} likers récupérés")
            return likers
        else:
            print(f"[LinkedIn API] ❌ Erreur {resp.status_code}: {resp.text[:200]}")
            return []
    except Exception as e:
        print(f"[LinkedIn API] ❌ Exception: {e}")
        return []


def get_post_comments(post_url: str, count: int = 50) -> List[Dict]:
    """
    Récupère la liste des commentaires d'un post LinkedIn.
    Utilise l'API interne Voyager de LinkedIn avec le cookie li_at.
    """
    li_at = _get_li_at()
    if not li_at:
        return []

    urn = _extract_urn_from_url(post_url)
    if not urn:
        return []

    session = _make_session(li_at)
    from urllib.parse import quote
    urn_enc = quote(urn, safe="")

    url = (
        f"https://www.linkedin.com/voyager/api/feed/comments"
        f"?count={count}&q=comments&social={urn_enc}&start=0&sort=RELEVANCE"
    )

    try:
        resp = session.get(url, timeout=900)
        print(f"[LinkedIn API] Comments status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            elements = data.get("elements", [])
            comments = []
            for el in elements:
                actor = el.get("actor", {})
                name = actor.get("name", {}).get("text", "") or actor.get("urn", "")
                headline = actor.get("subtext", {}).get("text", "")
                comment_text = el.get("commentary", {}).get("text", {}).get("text", "")
                nav_url = actor.get("navigationUrl", "")
                profile_url = nav_url if nav_url.startswith("http") else f"https://www.linkedin.com{nav_url}" if nav_url else ""
                comments.append({
                    "name": name,
                    "headline": headline,
                    "profile_url": profile_url,
                    "comment": comment_text,
                })
            print(f"[LinkedIn API] ✅ {len(comments)} commentaires récupérés")
            return comments
        else:
            print(f"[LinkedIn API] ❌ Erreur {resp.status_code}: {resp.text[:200]}")
            return []
    except Exception as e:
        print(f"[LinkedIn API] ❌ Exception: {e}")
        return []
