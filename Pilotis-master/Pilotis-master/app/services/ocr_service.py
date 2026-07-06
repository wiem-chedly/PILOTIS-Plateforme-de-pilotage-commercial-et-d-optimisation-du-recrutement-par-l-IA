"""
Service pour extraire des données depuis des captures d'écran d'appels d'offres.
100% dynamique : aucune liste statique, aucune normalisation.
Champs extraits : titre, client, référence, budget_ht, duree, date_demarrage, description, criteres.
La description est formatée avec les sections RÉSUMÉ, CONTEXTE, DÉTAILS (avec retours à la ligne).
"""

import os
import json
import re
import hashlib
import requests
import pytesseract
from PIL import Image
import PIL.ImageEnhance
from typing import Dict, Any, List, Optional, Callable
from concurrent.futures import ThreadPoolExecutor, as_completed

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_NAME = "qwen2.5:7b"
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Support pack langue dans dossier utilisateur
_tessdata_prefix = os.getenv("TESSDATA_PREFIX", "")
if _tessdata_prefix:
    os.environ["TESSDATA_PREFIX"] = _tessdata_prefix
    print(f"[OCR] TESSDATA_PREFIX = {_tessdata_prefix}")

# Cache pour les résultats OCR
_ocr_cache: Dict[str, Dict[str, Any]] = {}
_progress_callback: Optional[Callable[[int, int, str], None]] = None


def set_progress_callback(callback: Callable[[int, int, str], None]):
    """Définit une fonction de callback pour suivre la progression de l'analyse."""
    global _progress_callback
    _progress_callback = callback


def _update_progress(current: int, total: int, message: str = ""):
    """Met à jour la progression via le callback."""
    if _progress_callback:
        _progress_callback(current, total, message)


def get_image_hash(image_path: str) -> str:
    """Génère un hash unique pour l'image (pour le cache)."""
    with open(image_path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


def extract_text_from_image(image_path: str) -> str:
    """Extrait le texte d'une image avec Tesseract OCR."""
    try:
        image = Image.open(image_path).convert('L')
        enhancer = PIL.ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        text = pytesseract.image_to_string(image, lang='fra')
        print(f"📝 Texte extrait : {len(text)} caractères")
        return text
    except Exception as e:
        print(f"❌ Erreur OCR : {e}")
        return ""


def call_ollama(prompt: str, max_tokens: int = 2000) -> str:
    """Appelle l'API Ollama pour générer une réponse."""
    try:
        response = requests.post(OLLAMA_URL, json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": max_tokens,
                "num_ctx": 2048,
                "num_thread": 8
            }
        }, timeout=900)
        if response.status_code == 200:
            return response.json().get("response", "").strip()
    except Exception as e:
        print(f"❌ Erreur Ollama : {e}")
    return ""


def force_line_breaks(description: str) -> str:
    """
    Force les retours à la ligne dans la description.
    Transforme "RÉSUMÉ : xxx CONTEXTE : yyy DÉTAILS : zzz" 
    en format avec sauts de ligne.
    """
    if not description or not isinstance(description, str):
        return description or ""
    
    # Remplacer les \n littéraux
    description = description.replace('\\n', '\n')
    
    # Si déjà bien formaté
    if '\n\n' in description and 'RÉSUMÉ' in description:
        return description
    
    # Extraire les trois sections
    resume_match = re.search(r'RÉSUMÉ\s*:?\s*(.*?)(?=CONTEXTE|DÉTAILS|$)', description, re.DOTALL | re.IGNORECASE)
    contexte_match = re.search(r'CONTEXTE\s*:?\s*(.*?)(?=RÉSUMÉ|DÉTAILS|$)', description, re.DOTALL | re.IGNORECASE)
    details_match = re.search(r'DÉTAILS\s*:?\s*(.*?)(?=RÉSUMÉ|CONTEXTE|$)', description, re.DOTALL | re.IGNORECASE)
    
    parts = []
    
    if resume_match:
        content = resume_match.group(1).strip()
        content = re.sub(r'\s*(CONTEXTE|DÉTAILS).*$', '', content, flags=re.DOTALL).strip()
        if content:
            parts.append(f"RÉSUMÉ :\n{content}")
    
    if contexte_match:
        content = contexte_match.group(1).strip()
        content = re.sub(r'\s*(RÉSUMÉ|DÉTAILS).*$', '', content, flags=re.DOTALL).strip()
        if content:
            parts.append(f"CONTEXTE :\n{content}")
    
    if details_match:
        content = details_match.group(1).strip()
        content = re.sub(r'\s*(RÉSUMÉ|CONTEXTE).*$', '', content, flags=re.DOTALL).strip()
        if content:
            parts.append(f"DÉTAILS :\n{content}")
    
    if len(parts) >= 2:
        return "\n\n".join(parts)
    
    # Fallback: extraction par position
    desc_lower = description.lower()
    if 'résumé' in desc_lower and 'contexte' in desc_lower and 'détails' in desc_lower:
        try:
            resume_pos = desc_lower.find('résumé')
            contexte_pos = desc_lower.find('contexte')
            details_pos = desc_lower.find('détails')
            
            resume_text = description[resume_pos + 7:contexte_pos].strip()
            contexte_text = description[contexte_pos + 8:details_pos].strip()
            details_text = description[details_pos + 8:].strip()
            
            resume_text = re.sub(r'^[:\s]+', '', resume_text)
            contexte_text = re.sub(r'^[:\s]+', '', contexte_text)
            details_text = re.sub(r'^[:\s]+', '', details_text)
            
            return f"RÉSUMÉ :\n{resume_text}\n\nCONTEXTE :\n{contexte_text}\n\nDÉTAILS :\n{details_text}"
        except:
            pass
    
    return description


def extract_ao_data_with_ia(text: str) -> Dict[str, Any]:
    """Extrait les données de l'appel d'offres avec l'IA."""
    print("🤖 Extraction IA...")
    
    prompt = f"""
Extrais les informations suivantes de cet appel d'offres.

RÈGLES STRICTES (À RESPECTER ABSOLUMENT) :
1. N'invente AUCUNE information.
2. Utilise UNIQUEMENT ce qui est écrit dans le texte.
3. Si une information n'est pas présente, mets "" (chaîne vide).
4. Pour le budget, donne le nombre sans devise ni séparateurs (ex: 109200).
5. Pour la date de démarrage, garde UNIQUEMENT le format JJ/MM/AAAA.
   - Exemple valide: "30/04/2026"
   - Ne JAMAIS écrire "jj/mm/aaaa" ou "dd/mm/yyyy" ou "JJ/MM/AAAA"
   - Si tu ne trouves pas de date, mets "" (chaîne vide)
6. Pour la durée, garde le format "du JJ/MM/AAAA au JJ/MM/AAAA"
7. Pour la description, structure-la en trois sections AVEC DES RETOURS À LA LIGNE :
   - RÉSUMÉ : une phrase courte sur la mission.
   - CONTEXTE : le contexte général.
   - DÉTAILS : les informations précises.
   
   FORMAT OBLIGATOIRE (chaque section sur une nouvelle ligne, avec une ligne vide entre chaque) :
   RÉSUMÉ :
   [contenu du résumé]
   
   CONTEXTE :
   [contenu du contexte]
   
   DÉTAILS :
   [contenu des détails]

Champs à extraire (JSON) :
- "titre" : l'intitulé exact du poste
- "client" : le nom du client (tel qu'écrit)
- "reference" : le code référence
- "budget_ht" : le montant HT (nombre)
- "duree" : la durée (ex: "du 30/04/2026 au 31/03/2027")
- "date_demarrage" : la date de début au format JJ/MM/AAAA (ex: "30/04/2026")
- "description" : la description structurée avec retours à la ligne
- "criteres" : les compétences techniques (séparées par des virgules)

EXEMPLES DE DATES VALIDES :
- "30/04/2026"
- "15/01/2025"
- "01/12/2024"

EXEMPLES DE DATES INVALIDES (À NE PAS UTILISER) :
- "jj/mm/aaaa"
- "dd/mm/yyyy"
- "JJ/MM/AAAA"

Exemple de réponse attendue pour le champ "description" :
"RÉSUMÉ :\\nMission de développement interne Java/SQL.\\n\\nCONTEXTE :\\nLe pôle COO GFD centralise les fonctions transverses.\\n\\nDÉTAILS :\\nDéveloppement et maintenance applicative, refonte ergonomique."

Exemple complet :
{{
  "titre": "Développeur JAVA/SQL",
  "client": "CACIB",
  "reference": "BPM045072",
  "budget_ht": 109200,
  "duree": "du 30/04/2026 au 31/03/2027",
  "date_demarrage": "30/04/2026",
  "description": "RÉSUMÉ :\\nMission de développement interne Java/SQL.\\n\\nCONTEXTE :\\nLe pôle COO GFD centralise les fonctions transverses.\\n\\nDÉTAILS :\\nDéveloppement et maintenance applicative, refonte ergonomique.",
  "criteres": "Java, SQL"
}}

IMPORTANT : 
- Le champ "date_demarrage" ne doit JAMAIS contenir "jj/mm/aaaa" ou "dd/mm/yyyy"
- Si aucune date n'est trouvée, mets "" (chaîne vide)

Texte de l'appel d'offres :
{text[:4000]}

Réponds UNIQUEMENT avec le JSON, rien d'autre.
"""
    response = call_ollama(prompt, 3000)
    if not response:
        print("❌ Qwen : pas de réponse")
        return {}
    
    cleaned = response.strip()
    for prefix in ["```json", "```"]:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    
    # Gérer le cas où la réponse est une liste
    if cleaned.startswith('['):
        try:
            list_data = json.loads(cleaned)
            if isinstance(list_data, list) and len(list_data) > 0:
                data = list_data[0]
            else:
                return {}
        except:
            return {}
    else:
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if not match:
            return {}
        try:
            data = json.loads(match.group())
        except:
            return {}
    
    if not isinstance(data, dict):
        return {}
    
    allowed = ['titre', 'client', 'reference', 'budget_ht', 'duree', 'date_demarrage', 'description', 'criteres']
    filtered = {k: data.get(k, "") for k in allowed}
    
    # Nettoyer la date de démarrage si elle contient un placeholder
    if filtered.get('date_demarrage'):
        date_value = str(filtered['date_demarrage'])
        # Rejeter les placeholders
        if date_value.lower() in ['jj/mm/aaaa', 'dd/mm/yyyy', 'jj/mm/aa', 'dd/mm/yy']:
            filtered['date_demarrage'] = ""
        # Vérifier le format JJ/MM/AAAA
        elif re.match(r'^\d{2}/\d{2}/\d{4}$', date_value):
            filtered['date_demarrage'] = date_value
        else:
            # Essayer d'extraire une date valide
            date_match = re.search(r'(\d{2}/\d{2}/\d{4})', date_value)
            if date_match:
                filtered['date_demarrage'] = date_match.group(1)
            else:
                filtered['date_demarrage'] = ""
    
    if filtered.get('budget_ht'):
        try:
            filtered['budget_ht'] = float(filtered['budget_ht'])
        except:
            filtered['budget_ht'] = 0
    
    # Forcer les retours à la ligne dans la description
    if filtered.get('description') and isinstance(filtered['description'], str):
        filtered['description'] = force_line_breaks(filtered['description'])
    
    print(f"✅ IA : {len([v for v in filtered.values() if v])} champs extraits")
    return filtered


def fallback_regex(text: str) -> Dict[str, Any]:
    """Extraction de données par regex en fallback."""
    print("🔄 Fallback regex...")
    data = {}
    lines = [l.strip() for l in text.split('\n') if l.strip() and not l.startswith('Temps restant')]

    for line in lines:
        if re.search(r'[A-Z]', line) and len(line) > 10 and not re.match(r'^[\d\s/:-]+$', line):
            data['titre'] = line
            break
    if not data.get('titre') and lines:
        data['titre'] = lines[0]

    ref_match = re.search(r'\b[A-Z0-9]{5,}\b', text)
    if not ref_match:
        ref_match = re.search(r'\b[A-Z]{2,}[-_]?\d{4,}\b', text)
    if ref_match:
        data['reference'] = ref_match.group(0)

    client_match = re.search(r'(?:Client|Société|Entreprise)[:\s]*([A-Za-zÀ-ÿ\s]{3,})', text, re.I)
    if client_match:
        data['client'] = client_match.group(1).strip()

    # Extraction des dates - FILTRER LES PLACEHOLDERS
    dates = re.findall(r'\b(\d{2}/\d{2}/\d{4})\b', text)
    valid_dates = [d for d in dates if d not in ['jj/mm/aaaa', 'dd/mm/yyyy', 'JJ/MM/AAAA', 'DD/MM/YYYY']]
    
    if valid_dates:
        data['date_demarrage'] = valid_dates[0]
        if len(valid_dates) >= 2:
            data['duree'] = f"du {valid_dates[0]} au {valid_dates[1]}"
        else:
            data['duree'] = ""
    else:
        data['date_demarrage'] = ""
        data['duree'] = ""

    budget_match = re.search(r'\b(\d{1,3}(?:\s?\d{3})*(?:[,\\.]\d{2})?)\s*€', text)
    if not budget_match:
        budget_match = re.search(r'\b(\d{5,})\b', text)
    if budget_match:
        try:
            num = budget_match.group(1).replace(' ', '').replace(',', '.')
            data['budget_ht'] = float(num)
        except:
            pass

    # Description avec retours à la ligne forcés
    resume = re.search(r'Résumé[:\s]*([^\n]+)', text, re.I)
    contexte = re.search(r'Contexte[:\s]*([^\n]+)', text, re.I)
    details = re.search(r'Détails[:\s]*([^\n]+)', text, re.I)
    
    if resume and contexte and details:
        data['description'] = f"RÉSUMÉ :\n{resume.group(1).strip()}\n\nCONTEXTE :\n{contexte.group(1).strip()}\n\nDÉTAILS :\n{details.group(1).strip()}"
    elif resume and contexte:
        data['description'] = f"RÉSUMÉ :\n{resume.group(1).strip()}\n\nCONTEXTE :\n{contexte.group(1).strip()}"
    elif resume:
        data['description'] = f"RÉSUMÉ :\n{resume.group(1).strip()}"
    else:
        data['description'] = ' '.join(lines[:3])
    
    # Forcer les retours à la ligne
    if data.get('description'):
        data['description'] = force_line_breaks(data['description'])

    skills_match = re.search(r'(?:Compétences|Technologies|Outils)[:\s]*([^\n]+(?:\n[^\n]+){0,3})', text, re.I)
    if skills_match:
        data['criteres'] = skills_match.group(1).strip()
    else:
        tech_candidates = re.findall(r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b', text)
        techs = [t for t in tech_candidates if len(t) >= 3]
        if techs:
            data['criteres'] = ', '.join(techs[:6])

    return data


def deduplicate_description(desc: str) -> str:
    """Reformate la description avec retours à la ligne."""
    if not desc or not isinstance(desc, str):
        return desc or ""
    
    desc = desc.replace('\\n', '\n')
    
    pattern = r'(RÉSUMÉ|CONTEXTE|DÉTAILS)\s*:\s*(.*?)(?=(?:RÉSUMÉ|CONTEXTE|DÉTAILS)\s*:|\Z)'
    matches = re.findall(pattern, desc, re.DOTALL | re.IGNORECASE)
    
    sections = {}
    for title, content in matches:
        title = title.upper()
        content = content.strip()
        content = re.sub(r'\s*(RÉSUMÉ|CONTEXTE|DÉTAILS)\s*:.*$', '', content, flags=re.DOTALL).strip()
        if title not in sections or len(content) > len(sections[title]):
            sections[title] = content
    
    result_parts = []
    for t in ['RÉSUMÉ', 'CONTEXTE', 'DÉTAILS']:
        if t in sections:
            result_parts.append(f"{t} :\n{sections[t]}")
    
    result = '\n\n'.join(result_parts)
    result = re.sub(r'[ \t]+', ' ', result)
    result = re.sub(r'\n\s*\n', '\n\n', result)
    
    return result.strip()


def minimal_clean(data: Dict[str, Any]) -> Dict[str, Any]:
    """Nettoie et formate les données extraites."""
    if data.get('description') and isinstance(data['description'], str):
        data['description'] = re.sub(r'Temps restant[^\n]*', '', data['description'])
        data['description'] = deduplicate_description(data['description'])
        data['description'] = force_line_breaks(data['description'])
        data['description'] = re.sub(r'\s+', ' ', data['description']).strip()
        data['description'] = re.sub(r'\n{3,}', '\n\n', data['description'])
    
    if data.get('duree') and not data['duree'].startswith('du'):
        data['duree'] = 'du ' + data['duree']
    
    # Nettoyer la date de démarrage
    if data.get('date_demarrage'):
        date_value = str(data['date_demarrage'])
        if date_value.lower() in ['jj/mm/aaaa', 'dd/mm/yyyy', 'jj/mm/aa', 'dd/mm/yy']:
            data['date_demarrage'] = ""
        elif re.match(r'^\d{2}/\d{2}/\d{4}$', date_value):
            data['date_demarrage'] = date_value
        else:
            date_match = re.search(r'(\d{2}/\d{2}/\d{4})', date_value)
            if date_match:
                data['date_demarrage'] = date_match.group(1)
            else:
                data['date_demarrage'] = ""
    
    return data


def extract_ao_data_from_image(image_path: str, apply_clean: bool = True) -> Dict[str, Any]:
    """Extrait les données d'une seule image avec cache."""
    img_hash = get_image_hash(image_path)
    
    if img_hash in _ocr_cache:
        print(f"⚡ Cache hit pour {image_path}")
        return _ocr_cache[img_hash]
    
    print(f"📸 Analyse de l'image : {image_path}")
    
    text = extract_text_from_image(image_path)
    if not text or len(text.strip()) < 50:
        print("❌ Texte insuffisant")
        return {}

    data = extract_ao_data_with_ia(text)
    
    if not data or not data.get('titre'):
        print("⚠️ IA incomplète, utilisation du fallback")
        fallback_data = fallback_regex(text)
        for k, v in fallback_data.items():
            if v and (k not in data or not data.get(k)):
                data[k] = v

    if apply_clean and data:
        data = minimal_clean(data)
    
    # Stocker dans le cache
    _ocr_cache[img_hash] = data
    
    return data


def extract_ao_data_from_images_parallel(image_paths: List[str], apply_clean: bool = True) -> List[Dict[str, Any]]:
    """
    Extrait les données de plusieurs images en PARALLÈLE.
    Beaucoup plus rapide que l'analyse séquentielle.
    """
    print(f"\n🚀 Lancement de l'analyse parallèle de {len(image_paths)} images...")
    
    results = [None] * len(image_paths)
    
    with ThreadPoolExecutor(max_workers=1) as executor:
        future_to_index = {
            executor.submit(extract_ao_data_from_image, path, apply_clean): i 
            for i, path in enumerate(image_paths)
        }
        
        for future in as_completed(future_to_index):
            index = future_to_index[future]
            try:
                results[index] = future.result()
                print(f"✅ Image {index + 1}/{len(image_paths)} analysée")
            except Exception as e:
                print(f"❌ Erreur image {index + 1}: {e}")
                results[index] = {}
    
    return [r for r in results if r and r.get('titre')]


def combine_ocr_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Combine les résultats de plusieurs analyses OCR."""
    if not results:
        return {}
    if len(results) == 1:
        return results[0]

    combined = {}
    
    for field in ['titre', 'client', 'reference', 'date_demarrage']:
        for r in results:
            if r.get(field):
                combined[field] = r[field]
                break
        if field not in combined:
            combined[field] = ""

    for r in results:
        if r.get('budget_ht', 0) > 0:
            combined['budget_ht'] = r['budget_ht']
            break
    if 'budget_ht' not in combined:
        combined['budget_ht'] = 0

    for r in results:
        d = r.get('duree', '')
        if re.search(r'\d{2}/\d{2}/\d{4}.*\d{2}/\d{2}/\d{4}', d):
            combined['duree'] = d
            break
    if 'duree' not in combined:
        combined['duree'] = ""

    descs = [r.get('description', '') for r in results if r.get('description') and isinstance(r['description'], str)]
    if descs:
        combined['description'] = max(descs, key=len)
    else:
        combined['description'] = ""

    all_skills = set()
    for r in results:
        skills = r.get('criteres', '')
        if skills and isinstance(skills, str):
            for s in skills.split(','):
                s = s.strip()
                if s:
                    all_skills.add(s)
    if all_skills:
        combined['criteres'] = ', '.join(sorted(all_skills))
    else:
        combined['criteres'] = ""

    if combined.get('description') and isinstance(combined['description'], str):
        combined['description'] = deduplicate_description(combined['description'])
        combined['description'] = force_line_breaks(combined['description'])

    return combined


def default_result() -> Dict[str, Any]:
    """Retourne un résultat par défaut avec tous les champs vides."""
    return {
        "titre": "",
        "client": "",
        "reference": "",
        "budget_ht": 0,
        "duree": "",
        "date_demarrage": "",
        "description": "",
        "criteres": ""
    }


if __name__ == "__main__":
    import sys
    import time
    
    # Test de la fonction force_line_breaks
    test_desc = "RÉSUMÉ : Mission de développement interne Java/SQL. CONTEXTE : Le pôle COO GFD centralise les fonctions transverses. DÉTAILS : Développement et maintenance applicative, refonte ergonomique."
    print("="*60)
    print("🧪 TEST DE FORMATAGE")
    print("="*60)
    print("AVANT:")
    print(test_desc)
    print("\nAPRÈS force_line_breaks():")
    print(force_line_breaks(test_desc))
    print("="*60)
    
    if len(sys.argv) > 1:
        paths = sys.argv[1:]
        start_time = time.time()
        results = extract_ao_data_from_images_parallel(paths)
        combined = combine_ocr_results(results)
        elapsed = time.time() - start_time
        print(f"\n⏱️ Temps total: {elapsed:.2f}s pour {len(paths)} images")
    else:
        inp = input("Entrez les chemins des images (séparés par des espaces) : ").strip()
        if inp:
            paths = inp.split()
            start_time = time.time()
            results = extract_ao_data_from_images_parallel(paths)
            combined = combine_ocr_results(results)
            elapsed = time.time() - start_time
            print(f"\n⏱️ Temps total: {elapsed:.2f}s pour {len(paths)} images")
        else:
            combined = {}
    
    full = default_result()
    full.update(combined)
    print("\n" + "="*60)
    print("📊 RÉSULTAT FINAL :")
    print("="*60)
    print(json.dumps(full, indent=2, ensure_ascii=False))