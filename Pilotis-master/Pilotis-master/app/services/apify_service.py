import os
from apify_client import ApifyClient

APIFY_TOKEN         = os.getenv("APIFY_API_TOKEN", "")
# Actor WITH cookies (fiable, nécessite li_at)
ACTOR_WITH_COOKIE   = "scraping_solutions/linkedin-posts-engagers-likers-and-commenters-no-cookies"
# Fallback ID codé
APIFY_ACTOR_ID_CODE = "d5ib8ypLiKOuB8y8Q"


def _get_setting(key: str) -> str:
    """Lit un paramètre Apify depuis la base ou l'env."""
    try:
        from app.models.settings import AppSetting
        setting = AppSetting.query.filter_by(key=key).first()
        if setting and setting.value:
            return setting.value.strip()
    except Exception:
        pass
    return ""


def _get_token() -> str:
    return _get_setting('apify_api_token') or APIFY_TOKEN.strip()


def _get_actor_id() -> str:
    return _get_setting('apify_actor_id') or APIFY_ACTOR_ID_CODE


def _get_li_at_cookie() -> str:
    """Lit le cookie li_at LinkedIn depuis la base de données."""
    return _get_setting('linkedin_li_at_cookie')


def _get_client() -> ApifyClient:
    return ApifyClient(_get_token())


def trigger_scrape(post_url: str, webhook_url: str = "", engagement_type: str = "likers") -> dict:
    """
    Lance un run Apify pour récupérer les likers ou commenters d'un post LinkedIn.
    Si un cookie li_at est configuré, il est transmis pour contourner le blocage LinkedIn.
    """
    client   = _get_client()
    actor_id = _get_actor_id()
    li_at    = _get_li_at_cookie()

    run_input = {
        "urls": [post_url],
        "li_at": li_at, 
        "type":       engagement_type,
    }

    # Ajouter le cookie si disponible — contourne le blocage 500 de LinkedIn
    if webhook_url:
        run_input["webhook"] = webhook_url
        print(f"[Apify] 🍪 Cookie li_at présent — mode authentifié")
    else:
        print(f"[Apify] ⚠️  Pas de cookie li_at — mode anonyme (peut échouer)")

    print(f"[Apify] Actor: {actor_id} | type: {engagement_type}")
    run = client.actor(actor_id).start(run_input=run_input)
    return run


def trigger_scrape_all(post_url: str, webhook_url: str = "") -> tuple:
    """Lance 2 runs Apify : likers + commenters."""
    run_likers     = trigger_scrape(post_url, webhook_url, engagement_type="likers")
    run_commenters = trigger_scrape(post_url, webhook_url, engagement_type="commenters")
    return run_likers, run_commenters


def get_run_status(run_id: str) -> dict:
    """Récupère le statut d'un run Apify."""
    client = _get_client()
    return client.run(run_id).get() or {}


def fetch_run_results(run_id: str) -> list:
    """Récupère les items du dataset d'un run terminé."""
    client     = _get_client()
    run_info   = client.run(run_id).get() or {}
    dataset_id = run_info.get("defaultDatasetId")
    if not dataset_id:
        return []
    return list(client.dataset(dataset_id).iterate_items())
