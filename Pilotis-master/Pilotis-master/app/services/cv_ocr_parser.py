# app/services/cv_ocr_parser.py
import pdfplumber
import PyPDF2
import re
import os
 
 
def parse_cv_with_ocr(file_path: str) -> str:
    """
    Parse un CV PDF avec pdfplumber (prioritaire) puis PyPDF2 (fallback).
    Retourne le texte brut extrait, sans transformation agressive.
    """
    text = ""
 
    print(f"   📄 Extraction du texte du PDF: {os.path.basename(file_path)}")
 
    # ── Tentative 1 : pdfplumber ──────────────────────────────────────────────
    try:
        with pdfplumber.open(file_path) as pdf:
            pages_extracted = 0
            for page_num, page in enumerate(pdf.pages):
                # Essai standard
                page_text = page.extract_text()
 
                # Essai avec layout si le premier échoue
                if not page_text or len(page_text.strip()) < 20:
                    page_text = page.extract_text(layout=True)
 
                if page_text and len(page_text.strip()) > 10:
                    text += page_text + "\n"
                    pages_extracted += 1
                    print(f"   📄 Page {page_num + 1}: {len(page_text)} caractères")
                else:
                    print(f"   ⚠️  Page {page_num + 1}: texte non extractible (PDF scanné ?)")
 
        if text.strip():
            print(f"   ✅ pdfplumber: {len(text)} caractères extraits sur {pages_extracted} page(s)")
    except Exception as e:
        print(f"   ❌ Erreur pdfplumber: {e}")
 
    # ── Tentative 2 : PyPDF2 (fallback si pdfplumber a échoué) ───────────────
    if len(text.strip()) < 100:
        print(f"   🔄 Fallback sur PyPDF2...")
        try:
            fallback_text = ""
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page_num, page in enumerate(reader.pages):
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        fallback_text += page_text + "\n"
                        print(f"   📄 Page {page_num + 1}: {len(page_text)} caractères (PyPDF2)")
 
            if len(fallback_text.strip()) > len(text.strip()):
                text = fallback_text
                print(f"   ✅ PyPDF2: {len(text)} caractères extraits")
        except Exception as e2:
            print(f"   ❌ PyPDF2 fallback échoué: {e2}")
 
    # ── Avertissement si peu de texte ─────────────────────────────────────────
    final_len = len(text.strip())
    if final_len < 200:
        print(f"   ⚠️  Peu de texte extrait ({final_len} caractères).")
        print(f"   💡 Le CV est peut-être scanné. Envisagez Tesseract OCR.")
 
    return text.strip()
 
 
def preprocess_for_ai(text: str) -> str:
    """
    Prétraite le texte extrait du PDF pour l'envoyer à l'IA.
 
    Principes :
    - NE PAS supprimer de caractères utiles (parenthèses, crochets, tirets, chiffres…)
    - Corriger uniquement les artefacts d'extraction PDF connus
    - Conserver les numéros de téléphone dans leur forme originale
    - Normaliser les espaces et retours à la ligne excessifs
    """
    if not text:
        return text
 
    original_len = len(text)
 
    # ── 1. Remplacer les ligatures typographiques et quotes ───────────────────
    ligatures = {
        'ﬁ': 'fi',
        'ﬂ': 'fl',
        'ﬀ': 'ff',
        'ﬃ': 'ffi',
        'ﬄ': 'ffl',
        '\u2019': "'",   # '  apostrophe droite
        '\u2018': "'",   # '  apostrophe gauche
        '\u201C': '"',   # "  guillemet gauche
        '\u201D': '"',   # "  guillemet droit
        '\u2026': '...',
        '\u2013': '-',   # tiret demi-cadratin
        '\u2014': '-',   # tiret cadratin
        '\u2022': '-',   # puce •
        '\u00B7': '-',   # point médian ·
        '\ufffd': '',    # caractère de remplacement
        '\x00': '',      # null byte
    }
    for old, new in ligatures.items():
        text = text.replace(old, new)
 
    # ── 2. Supprimer UNIQUEMENT les caractères non imprimables (hors ASCII étendu utile)
    #    On garde : lettres, chiffres, ponctuation standard, accents, +, @, ., -, /, :, ;, (, ), [, ], #, _
    #    On supprime : caractères de contrôle invisibles (sauf \n et \t)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
 
    # ── 3. Corriger les emails coupés par un saut de ligne PDF ────────────────
    # ex: "jean.dupont@gmail\n.com"  →  "jean.dupont@gmail.com"
    text = re.sub(r'([\w.\-]+@[\w.\-]+)\s*\n\s*([\w.\-]+)', r'\1\2', text)
    # ex: "jean.dupont\n@gmail.com"  →  "jean.dupont@gmail.com"
    text = re.sub(r'([\w.\-]+)\s*\n\s*(@[\w.\-]+\.\w+)', r'\1\2', text)
 
    # ── 4. Corriger le format (+XXX)XXXXXXXX → +XXXXXXXXXX ───────────────────
    #    (artefact pdfplumber courant pour les numéros internationaux)
    text = re.sub(r'\(\+(\d{1,4})\)\s*', r'+\1', text)
 
    # ── 5. Réunir un numéro de téléphone coupé sur deux lignes ───────────────
    # ex: "+216\n54229246"  →  "+21654229246"
    text = re.sub(r'(\+\d{1,4})\s*\n\s*(\d{6,12})', r'\1\2', text)
 
    # ── 6. Supprimer les retours à la ligne excessifs (≥3 → 2) ───────────────
    text = re.sub(r'\n{3,}', '\n\n', text)
 
    # ── 7. Supprimer les espaces multiples (sauf en début de ligne pour indentation) ──
    text = re.sub(r'[ \t]{2,}', ' ', text)
 
    # ── 8. Nettoyer les espaces en début/fin de chaque ligne ─────────────────
    text = '\n'.join(line.strip() for line in text.split('\n'))
 
    # ── 9. Supprimer les lignes vides dupliquées après le nettoyage ──────────
    text = re.sub(r'\n{3,}', '\n\n', text)
 
    print(f"   🔧 Prétraitement: {original_len} → {len(text)} caractères")
    return text.strip()
 
 
def extract_text_simple(file_path: str) -> str:
    """Extraction brute sans aucun prétraitement (pour debug)."""
    try:
        with pdfplumber.open(file_path) as pdf:
            return "\n".join(
                (page.extract_text() or "") for page in pdf.pages
            ).strip()
    except Exception as e:
        print(f"   ❌ Erreur extract_text_simple: {e}")
        return ""