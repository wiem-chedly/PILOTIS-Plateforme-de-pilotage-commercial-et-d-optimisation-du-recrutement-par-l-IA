# app/services/multi_email_scanner.py
import base64
from datetime import datetime
from app.models.contact import Contact
from app.services.gmail_oauth_service import GmailOAuthService
from app.extensions import db


class MultiEmailScanner:
    
    @staticmethod
    def scan_all_connected_contacts():
        """Scanne UNIQUEMENT les nouveaux emails (optimisé pour la vitesse)"""
        print("\n" + "="*60)
        print("📧 SCAN MULTI-COMPTES Gmail OAuth (NOUVEAUX EMAILS)")
        print("="*60)
        
        connected_contacts = Contact.query.filter_by(
            oauth_connected=True, 
            is_active=True
        ).all()
        
        if not connected_contacts:
            print("⚠️ Aucun contact OAuth connecté")
            return 0
        
        print(f"📊 {len(connected_contacts)} contact(s) connecté(s)\n")
        
        total_processed = 0
        
        for idx, contact in enumerate(connected_contacts, 1):
            print(f"[{idx}/{len(connected_contacts)}] 📧 {contact.email}")
            
            try:
                if not contact.oauth_refresh_token:
                    print(f"   ❌ Pas de refresh token\n")
                    continue
                
                # Calculer la date du dernier scan
                last_scan = contact.last_scan_at
                if last_scan:
                    print(f"   📅 Dernier scan: {last_scan.strftime('%d/%m/%Y %H:%M:%S')}")
                    last_scan_timestamp = int(last_scan.timestamp())
                    query = f'has:attachment after:{last_scan_timestamp}'
                else:
                    print(f"   📅 Premier scan - récupération des 10 derniers emails")
                    query = 'has:attachment'
                
                # Récupérer UNIQUEMENT les nouveaux emails (max 10)
                service = GmailOAuthService.get_gmail_service(contact)
                results = service.users().messages().list(
                    userId='me',
                    q=query,
                    maxResults=10  # Limité à 10 pour la vitesse
                ).execute()
                
                messages = results.get('messages', [])
                
                if not messages:
                    print(f"   📭 Aucun nouvel email\n")
                    # Mettre à jour la date même sans nouveaux emails
                    contact.last_scan_at = datetime.now()
                    db.session.commit()
                    continue
                
                print(f"   📧 {len(messages)} nouveau(x) email(s) trouvé(s)")
                
                # Traiter les emails (du plus ancien au plus récent)
                for i, msg in enumerate(reversed(messages), 1):
                    print(f"      → Traitement {i}/{len(messages)}...")
                    
                    message = service.users().messages().get(
                        userId='me',
                        id=msg['id'],
                        format='full'
                    ).execute()
                    
                    headers = message['payload'].get('headers', [])
                    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'Sans sujet')
                    from_email = next((h['value'] for h in headers if h['name'] == 'From'), 'Inconnu')
                    to_email = next((h['value'] for h in headers if h['name'] == 'To'), '')
                    
                    print(f"         📌 {subject[:50]}... - De: {from_email[:30]}")
                    
                    attachments_count = 0
                    
                    body_text = ""
                    def extract_text_from_payload(payload):
                        text = ""
                        if 'parts' in payload:
                            for part in payload['parts']:
                                if part.get('mimeType') == 'text/plain' and 'data' in part.get('body', {}):
                                    try:
                                        text += base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='replace')
                                    except: pass
                                elif 'parts' in part:
                                    text += extract_text_from_payload(part)
                        elif payload.get('mimeType') == 'text/plain' and 'data' in payload.get('body', {}):
                            try:
                                text += base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='replace')
                            except: pass
                        return text
                    
                    body_text = extract_text_from_payload(message['payload'])
                    
                    if 'parts' in message['payload']:
                        for part in message['payload']['parts']:
                            if part.get('filename') and part.get('body', {}).get('attachmentId'):
                                filename = part['filename']
                                attachment_id = part['body']['attachmentId']
                                
                                attachment = service.users().messages().attachments().get(
                                    userId='me',
                                    messageId=msg['id'],
                                    id=attachment_id
                                ).execute()
                                
                                file_data = base64.urlsafe_b64decode(attachment['data'])
                                
                                from app.services.cv_processor import process_cv_from_gmail
                                process_cv_from_gmail(
                                    attachment_data=file_data,
                                    filename=filename,
                                    from_email=from_email,
                                    to_email=to_email,
                                    subject=subject,
                                    scanned_email=contact.email,
                                    body_text=body_text
                                )
                                attachments_count += 1
                    
                    if attachments_count > 0:
                        print(f"         ✅ {attachments_count} CV traité(s)")
                        total_processed += 1
                
                # Mettre à jour la date du dernier scan
                contact.last_scan_at = datetime.now()
                db.session.commit()
                print(f"   ✅ Scan terminé: {len(messages)} email(s) traités\n")
                
            except Exception as e:
                print(f"   ❌ Erreur: {e}\n")
                err_str = str(e)
                if "invalid_grant" in err_str or "Token has been expired" in err_str or "invalid_scope" in err_str:
                    contact.oauth_connected = False
                    db.session.commit()
                    print(f"   ⚠️ Token invalide - reconnexion Gmail nécessaire pour {contact.email}")
        
        print("="*60)
        print(f"✅ SCAN TERMINÉ - {total_processed} nouveau(x) CV traité(s)")
        print("="*60 + "\n")
        
        return total_processed
    
    @staticmethod
    def scan_single_contact(contact_id):
        """Scanne un seul contact spécifique (pour debug)"""
        contact = Contact.query.get(contact_id)
        
        if not contact:
            print(f"❌ Contact ID {contact_id} non trouvé")
            return 0
        
        print(f"\n{'='*60}")
        print(f"🔍 SCAN MANUEL - {contact.email}")
        print(f"{'='*60}")
        
        if not contact.oauth_connected or not contact.is_active:
            print(f"⚠️ Contact inactif ou non connecté")
            return 0
        
        try:
            last_scan = contact.last_scan_at
            if last_scan:
                print(f"📅 Dernier scan: {last_scan.strftime('%d/%m/%Y %H:%M:%S')}")
            else:
                print(f"📅 Premier scan")
            
            service = GmailOAuthService.get_gmail_service(contact)
            
            # Si dernier scan existe, chercher seulement les nouveaux
            if last_scan:
                last_scan_timestamp = int(last_scan.timestamp())
                query = f'has:attachment after:{last_scan_timestamp}'
            else:
                query = 'has:attachment'
            
            results = service.users().messages().list(
                userId='me',
                q=query,
                maxResults=10
            ).execute()
            
            messages = results.get('messages', [])
            print(f"📊 {len(messages)} nouveau(x) email(s) avec pièce jointe trouvé(s)")
            
            # Mettre à jour la date
            contact.last_scan_at = datetime.now()
            db.session.commit()
            
            return len(messages)
            
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return 0


# ==================== FONCTIONS POUR LE SCHEDULER ====================

def scan_all_contacts():
    return MultiEmailScanner.scan_all_connected_contacts()


def scan_contact_emails(contact_id):
    return MultiEmailScanner.scan_single_contact(contact_id)


def reset_last_scan(contact_id=None):
    """Réinitialise la date du dernier scan (pour forcer un scan complet)"""
    from app import create_app
    app = create_app()
    with app.app_context():
        if contact_id:
            contact = Contact.query.get(contact_id)
            if contact:
                contact.last_scan_at = None
                db.session.commit()
                print(f"✅ Dernier scan réinitialisé pour {contact.email}")
            else:
                print(f"❌ Contact ID {contact_id} non trouvé")
        else:
            # Réinitialiser tous les contacts
            for contact in Contact.query.all():
                contact.last_scan_at = None
            db.session.commit()
            print(f"✅ Dernier scan réinitialisé pour TOUS les contacts")


def diagnostic_contacts():
    """Affiche l'état des contacts avec leur dernier scan"""
    from app import create_app
    app = create_app()
    with app.app_context():
        print("\n" + "="*60)
        print("🔍 DIAGNOSTIC DES CONTACTS")
        print("="*60)
        
        for c in Contact.query.all():
            print(f"\n📧 {c.email}")
            print(f"   oauth_connected: {c.oauth_connected}")
            print(f"   is_active: {c.is_active}")
            print(f"   refresh_token: {'✅' if c.oauth_refresh_token else '❌'}")
            print(f"   Dernier scan: {c.last_scan_at.strftime('%d/%m/%Y %H:%M:%S') if c.last_scan_at else 'Jamais'}")
            print("-"*40)