# app/services/doyoubuzz_service.py
"""
Service DoYouBuzz Showcase — authentification par HMAC-MD5 signée.
Endpoint : GET /users  (filtre kind='candidate')
"""
import os
import time
import hashlib
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()


class DoYouBuzzService:

    def __init__(self):
        self.api_key    = os.getenv('DOYOU_BUZZ_API_KEY',    '')
        self.api_secret = os.getenv('DOYOU_BUZZ_API_SECRET', '')
        self.base_url   = os.getenv('DOYOU_BUZZ_BASE_URL', 'https://showcase.doyoubuzz.com/api/v1')

    # ──────────────────────────────────────────────────────────────────────────
    # Auth : apikey + timestamp + MD5 hash (tous les params triés)
    # ──────────────────────────────────────────────────────────────────────────
    def _get_auth_params(self, extra_params: Optional[Dict] = None) -> Dict:
        if extra_params is None:
            extra_params = {}
        ts     = str(int(time.time()))
        params = {'apikey': self.api_key, 'timestamp': ts, **extra_params}

        # Concaténation des valeurs triées par clé + secret → MD5
        sorted_keys  = sorted(params.keys())
        concat_vals  = ''.join(str(params[k]) for k in sorted_keys)
        params['hash'] = hashlib.md5((concat_vals + self.api_secret).encode()).hexdigest()
        return params

    # ──────────────────────────────────────────────────────────────────────────
    # Récupère tous les candidats (paginé)
    # ──────────────────────────────────────────────────────────────────────────
    def get_all_resumes(self, filter_current_month: bool = False) -> List[Dict]:
        """Récupère tous les utilisateurs de type candidat via /users."""
        from datetime import datetime

        url           = f"{self.base_url}/users"
        all_data      = []
        unique_ids    = set()
        
        now = datetime.now()
        current_month = now.strftime('%Y-%m')
        # Calcul du mois précédent (Avril si on est en Mai)
        prev_month_date = now.replace(day=1) - __import__('datetime').timedelta(days=1)
        prev_month = prev_month_date.strftime('%Y-%m')
        
        allowed_months = [current_month, prev_month] if filter_current_month else None
        page          = 1

        while True:
            try:
                auth = self._get_auth_params({'limit': 100, 'page': page})
                r    = requests.get(url, params=auth, headers={'Accept': 'application/json'}, timeout=900)
                r.raise_for_status()
                data  = r.json()
                users = data.get('users', [])

                if not users:
                    break

                for u in users:
                    if u['id'] not in unique_ids:
                        is_candidate = (
                            u.get('kind') == 'candidate' or
                            u.get('displayKind') == 'candidat'
                        )
                        if is_candidate:
                            created = u.get('created', '')
                            if not filter_current_month or any(created.startswith(m) for m in allowed_months):
                                all_data.append(u)
                                unique_ids.add(u['id'])

                if not data.get('next'):
                    break
                page += 1

            except Exception as e:
                print(f"[DoYouBuzz] Error fetching page {page}: {e}")
                break

        print(f"[DoYouBuzz] Total candidats récupérés : {len(all_data)}")
        return all_data

    # ──────────────────────────────────────────────────────────────────────────
    # Détails d'un utilisateur
    # ──────────────────────────────────────────────────────────────────────────
    def get_resume_details(self, resume_id: int) -> Dict:
        """Récupère le détail d'un utilisateur depuis /users/<id>."""
        url = f"{self.base_url}/users/{resume_id}"
        r   = requests.get(url, params=self._get_auth_params(),
                           headers={'Accept': 'application/json'}, timeout=900)
        r.raise_for_status()
        u = r.json()

        return {
            'fullName':    f"{u.get('firstname', '')} {u.get('lastname', '')}".strip(),
            'firstName':   u.get('firstname', ''),
            'lastName':    u.get('lastname', ''),
            'email':       u.get('email', ''),
            'phone':       u.get('phone', ''),
            'skills':      [{'name': u.get('title', '')}] if u.get('title') else [],
            'languages':   [],
            'experiences': [],
            'educations':  [],
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Test de connexion
    # ──────────────────────────────────────────────────────────────────────────
    def test_connection(self) -> Dict:
        try:
            url  = f"{self.base_url}/users"
            auth = self._get_auth_params({'limit': 1, 'page': 1})
            r    = requests.get(url, params=auth, headers={'Accept': 'application/json'}, timeout=900)
            r.raise_for_status()
            data = r.json()
            return {
                'success': True,
                'message': 'Connexion DoYouBuzz OK',
                'total':   data.get('total', '?'),
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
