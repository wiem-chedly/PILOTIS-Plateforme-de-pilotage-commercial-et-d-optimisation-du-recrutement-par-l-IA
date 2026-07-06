# app/services/google_sheets_service.py
"""
Service de lecture des réponses Google Form via l'API Google Sheets v4.

Prérequis :
    pip install google-auth google-auth-httplib2 google-api-python-client

Variables d'environnement requises :
    GOOGLE_SERVICE_ACCOUNT_JSON  → contenu JSON complet du Service Account
                                   (téléchargé depuis Google Cloud Console)

Configuration Google :
    1. Créer un projet Google Cloud
    2. Activer l'API Google Sheets
    3. Créer un Service Account → télécharger le JSON
    4. Partager le Google Sheet des réponses avec l'email du Service Account (rôle Lecteur)
"""

import os
import json
import logging

logger = logging.getLogger(__name__)

# Colonnes attendues dans le Google Sheet (dans l'ordre du formulaire)
COL_TIMESTAMP = "Horodatage"
COL_NOM       = "Nom"
COL_EMAIL     = "Email"
COL_REF       = "Référence AO"   # OPTIONNEL — champ libre, ex: "BPM045072"
COL_CV_LINK   = "Lien CV"        # OPTIONNEL — Google Drive, LinkedIn, WeTransfer...


class GoogleSheetsService:
    # drive (lecture + écriture) pour pouvoir copier les CVs vers le dossier linkedin_pilotis
    SCOPES = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive",
    ]

    def __init__(self):
        creds_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
        if not creds_json:
            raise RuntimeError(
                "La variable d'environnement GOOGLE_SERVICE_ACCOUNT_JSON est manquante. "
                "Veuillez configurer le Service Account Google."
            )
        try:
            from google.oauth2.service_account import Credentials
            info = json.loads(creds_json)
            self.creds = Credentials.from_service_account_info(info, scopes=self.SCOPES)
        except ImportError:
            raise RuntimeError(
                "Le package google-auth n'est pas installé. "
                "Lancez : pip install google-auth google-auth-httplib2 google-api-python-client"
            )
        except Exception as exc:
            raise RuntimeError(f"Service account info was not in the expected format: {exc}")

    def download_drive_file(self, file_url: str) -> bytes:
        import re
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseDownload
        import io

        # Extraction de l'ID du fichier depuis l'URL de Google Drive
        # Les formats possibles : id=XXXX, d/XXXX/view
        m = re.search(r'id=([a-zA-Z0-9_-]+)', file_url)
        if not m:
            m = re.search(r'd/([a-zA-Z0-9_-]+)', file_url)
        
        if not m:
            logger.error("[GoogleSheets] Impossible d'extraire l'ID depuis l'URL Drive: %s", file_url)
            return None
            
        file_id = m.group(1)
        logger.info("[GoogleSheets] Téléchargement du fichier Google Drive ID: %s", file_id)
        
        try:
            drive_service = build('drive', 'v3', credentials=self.creds)
            request = drive_service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            return fh.getvalue()
        except Exception as exc:
            logger.error("[GoogleSheets] Erreur lors du téléchargement Google Drive: %s", exc)
            return None

    def get_responses(
        self,
        spreadsheet_id: str,
        sheet_name: str = "Réponses au formulaire 1",
    ) -> list[dict]:
        """
        Retourne toutes les réponses Google Form en tant que liste de dicts.

        Colonnes attendues (dans l'ordre du Form) :
            Horodatage | Nom | Email | Référence AO (opt.) | Lien CV (opt.)

        Returns:
            [{"Horodatage": ..., "Nom": ..., "Email": ..., "Référence AO": ..., "Lien CV": ...}, ...]
        """
        try:
            from googleapiclient.discovery import build

            service = build("sheets", "v4", credentials=self.creds)

            # 1. On récupère dynamiquement le nom du premier onglet (pour éviter l'erreur si c'est "Form Responses 1" ou autre)
            sheet_metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
            sheets = sheet_metadata.get('sheets', '')
            if not sheets:
                logger.info("[GoogleSheets] Le document est vide.")
                return []
            actual_sheet_name = sheets[0].get("properties", {}).get("title", sheet_name)

            # 2. On utilise ce nom réel pour la requête (les simples quotes sont utiles s'il y a des espaces)
            result = (
                service.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=f"'{actual_sheet_name}'!A:F")
                .execute()
            )
            rows = result.get("values", [])
            if len(rows) < 2:
                logger.info("[GoogleSheets] Aucune réponse dans le sheet '%s'", sheet_name)
                return []

            headers = rows[0]
            responses = []
            for row in rows[1:]:
                # Pad row to header length (Google Sheets omits trailing empty cells)
                padded = row + [""] * (len(headers) - len(row))
                responses.append(dict(zip(headers, padded)))

            logger.info(
                "[GoogleSheets] %d réponse(s) lue(s) depuis '%s'", len(responses), sheet_name
            )
            return responses

        except Exception as exc:
            logger.error("[GoogleSheets] Erreur lecture sheet: %s", exc)
            return []