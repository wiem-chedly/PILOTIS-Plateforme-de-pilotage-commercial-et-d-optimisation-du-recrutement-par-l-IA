"""
qwen_service.py — Smart 5-step company normalization & deduplication pipeline

Step 0: Strip legal suffixes     (SA, SAS, SARL, GIE, Ltd …)       → instant
Step 1: GROUP_RULES keywords     (BNP, Société Générale, SNCF …)    → instant
Step 2: Exact match normalized   (CARREFOUR == carrefour)           → instant
Step 3: Fuzzy match (difflib)    (CARREFOUR BELGIUM → Carrefour)    → instant
Step 4: Independent pre-filter   (HELPLINE CONSULTING → own group)  → instant
Step 5: Qwen AI                  (only ~30 truly ambiguous cases)   → AI
"""

import unicodedata
import logging
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# ── In-memory caches ──────────────────────────────────────────────────────────
ia_cache        = {}   # { company_name -> canonical_group }
groupe_par_nom  = {}   # alias kept for backward compat
company_mapping = {}   # legacy compat

# ── Circuit breaker ───────────────────────────────────────────────────────────
_ollama_disabled = False

# ── Step 0: Legal suffixes to strip ──────────────────────────────────────────
_LEGAL_SUFFIXES = [
    # French
    r'\bsa\b', r'\bsas\b', r'\bsarl\b', r'\bsci\b', r'\bgie\b',
    r'\bsca\b', r'\bsnc\b', r'\bse\b', r'\bscop\b', r'\bsem\b',
    r'\bep\b', r'\bscp\b', r'\beurl\b',
    # International
    r'\bltd\b', r'\bllc\b', r'\binc\b', r'\bcorp\b', r'\bplc\b',
    r'\bbv\b', r'\bnv\b', r'\bag\b', r'\bgmbh\b', r'\bsrl\b',
    r'\bspa\b', r'\bab\b', r'\basa\b', r'\bpte\b',
    # Written out
    r'\bgroupe\b', r'\bgroup\b', r'\bholding\b', r'\bfrance\b',
    r'\bbelgique\b', r'\bbelgium\b', r'\bespagne\b', r'\bspain\b',
    r'\bsuisse\b', r'\bswitzerland\b', r'\bgermany\b', r'\beurope\b',
    r'\bparis\b', r'\blyon\b', r'\bnord\b', r'\bsud\b', r'\best\b',
    r'\bouest\b',
]

# ── Step 1: Keyword rules ─────────────────────────────────────────────────────
GROUP_RULES = {
    'bnp':                'BNP Paribas',
    'paribas':            'BNP Paribas',
    'transactis':         'BNP Paribas',
    'cardif':             'BNP Paribas',
    'arval':              'BNP Paribas',
    'exane':              'BNP Paribas',
    'credit agricole':    'Crédit Agricole',
    'cacib':              'Crédit Agricole',
    'amundi':             'Crédit Agricole',
    'lcl':                'Crédit Agricole',
    'ca-gip':             'Crédit Agricole',
    'cagip':              'Crédit Agricole',
    'cacf':               'Crédit Agricole',
    'caceis':             'Crédit Agricole',
    'societe generale':   'Société Générale',
    'société générale':   'Société Générale',
    'sgcib':              'Société Générale',
    'ald automotive':     'Société Générale',
    'boursorama':         'Société Générale',
    'lyxor':              'Société Générale',
    'sogeprom':           'Société Générale',
    'franfinance':        'Société Générale',
    'bpce':               'Groupe BPCE',
    'natixis':            'Groupe BPCE',
    'ostrum':             'Groupe BPCE',
    'banque populaire':   'Groupe BPCE',
    "caisse d'epargne":   'Groupe BPCE',
    'it-ce':              'Groupe BPCE',
    'casden':             'Groupe BPCE',
    'credit foncier':     'Groupe BPCE',
    'sncf':               'SNCF',
    'edf':                'EDF',
    'enedis':             'EDF',
    'engie':              'ENGIE',
    'gdf':                'ENGIE',
    'dalkia':             'EDF',
    'bollore':            'Groupe Bolloré',
    'saint gobain':       'Saint-Gobain',
    'st gobain':          'Saint-Gobain',
    'ag2r':               'AG2R La Mondiale',
    'covea':              'Covéa',
    'maaf':               'Covéa',
    'mma':                'Covéa',
    'malakoff':           'Malakoff Humanis',
    'caisse des depots':  'Caisse des Dépôts',
    'docaposte':          'Caisse des Dépôts',
    'cdc':                'Caisse des Dépôts',
    'la poste':           'La Poste',
    'banque postale':     'La Poste',
    'axa':                'AXA',
    'credit mutuel':      'Crédit Mutuel',
    'arkea':              'Crédit Mutuel Arkéa',
    'grdf':               'GRDF',
    'sacem':              'Sacem',
    'atos':               'Atos',
    'sopra':              'Sopra Steria',
    'steria':             'Sopra Steria',
    'orange':             'Orange',
    'bouygues':           'Bouygues',
    'vinci':              'Vinci',
    'thales':             'Thales',
    'airbus':             'Airbus',
    'safran':             'Safran',
    'renault':            'Renault',
    'psa':                'Stellantis',
    'total':              'TotalEnergies',
    'carrefour':          'Carrefour',
    'decathlon':          'Decathlon',
    'davidson':           'Davidson Consulting',
    'alten':              'Alten',
    'capgemini':          'Capgemini',
    'ibm':                'IBM',
    'microsoft':          'Microsoft',
    'hsbc':               'HSBC',
    'ing':                'ING',
    'tcs':                'TCS (Tata)',
    'kpmg':               'KPMG',
    'deloitte':           'Deloitte',
    'accenture':          'Accenture',
    'tf1':                'TF1 Groupe',
    'mediametrie':        'Médiamétrie',
    'médiamétrie':        'Médiamétrie',
    'eiffage':            'Eiffage',
    'ratp':               'RATP',
    'hpe':                'HPE',
    'cisco':              'Cisco',
    'nokia':              'Nokia',
    'dxc':                'DXC Technologies',
    'aubay':              'Aubay',
    'ausy':               'Ausy',
    'allianz':            'Allianz',
    'aig':                'AIG',
}

# ── Step 4: Signals that a company is independent (skip AI) ──────────────────
_INDEPENDENT_SIGNALS = {
    'consulting', 'conseil', 'solutions', 'systemes', 'systèmes',
    'technologies', 'technology', 'informatique', 'services', 'digital',
    'data', 'it ', ' it', 'ingenierie', 'ingénierie', 'management',
    'partners', 'partenaires', 'associates', 'associes', 'associés',
    'agency', 'agence', 'studio', 'lab', 'labs', 'group', 'groupe',
    'recrut', 'chasseur', 'hunter', 'talent', 'rh ', ' rh',
    'freelance', 'independ', 'indépend', 'portage',
}

_FUZZY_THRESHOLD = 0.85   # 85% similarity → same group
_AI_CANDIDATES   = 12     # max groups shown to Qwen per company


# ═══════════════════════════════════════════════════════════════════════════════
# Core helpers
# ═══════════════════════════════════════════════════════════════════════════════

def normalize_name(name: str) -> str:
    """Accent-strip + lowercase, used for keyword matching."""
    if not name:
        return ""
    name = unicodedata.normalize('NFKD', name)
    name = name.encode('ASCII', 'ignore').decode('utf-8')
    return name.lower().strip()


def _strip_legal_suffix(name: str) -> str:
    """
    Remove legal suffixes and country/region qualifiers so
    'BNP Paribas SA' and 'BNP Paribas' compare as equal.
    """
    import re
    n = normalize_name(name)
    # Remove punctuation except spaces
    n = re.sub(r"[.,\-/()\[\]]", " ", n)
    # Strip known suffixes (word-boundary aware)
    for pattern in _LEGAL_SUFFIXES:
        n = re.sub(pattern, ' ', n, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', n).strip()


def _similarity(a: str, b: str) -> float:
    """SequenceMatcher ratio between two already-normalized strings."""
    return SequenceMatcher(None, a, b).ratio()


def _get_top_candidates(name_norm: str, existing_groups: list) -> list:
    """Return the _AI_CANDIDATES most similar group names to show Qwen."""
    scored = [
        (g, _similarity(name_norm, _strip_legal_suffix(g)))
        for g in existing_groups
    ]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [g for g, _ in scored[:_AI_CANDIDATES]]


def _is_likely_independent(name: str) -> bool:
    """
    Returns True if the company name strongly suggests it is an independent
    small firm (ESN, consulting, freelance…) → skip AI, treat as own group.
    """
    n = normalize_name(name)
    return any(sig in n for sig in _INDEPENDENT_SIGNALS)


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════

def get_canonical_name(company_name: str, existing_groups: list) -> str:
    """Resolve ONE company name. Used by stats endpoint."""
    result = get_canonical_names_batch([company_name], existing_groups)
    return result[company_name]


def get_canonical_names_batch(names: list, existing_groups: list) -> dict:
    """
    Resolve a list of company names to their canonical groups.
    Applies the full 5-step pipeline; Qwen fires only for truly ambiguous cases.
    """
    global _ollama_disabled

    resolved   = {}   # name -> canonical
    needs_ai   = []   # names that passed all fast filters

    # Pre-compute normalized forms of existing groups for fast comparison
    norm_groups = {_strip_legal_suffix(g): g for g in existing_groups}

    for name in names:
        # ── Step 1: keyword rules ──────────────────────────────────────────
        name_lower = normalize_name(name)
        matched = False
        for keyword, canonical in GROUP_RULES.items():
            if keyword in name_lower:
                resolved[name] = canonical
                matched = True
                break
        if matched:
            continue

        # ── In-memory cache ────────────────────────────────────────────────
        if name in groupe_par_nom:
            resolved[name] = groupe_par_nom[name]
            continue
        if name in ia_cache:
            resolved[name] = ia_cache[name]
            continue

        # ── Step 2: exact match after suffix-strip ─────────────────────────
        name_stripped = _strip_legal_suffix(name)
        if name_stripped in norm_groups:
            resolved[name] = norm_groups[name_stripped]
            logger.debug("[NORM] exact '%s' → '%s'", name[:30], resolved[name][:30])
            continue

        # ── Step 3: fuzzy match ────────────────────────────────────────────
        best_score  = 0.0
        best_group  = None
        for norm_g, orig_g in norm_groups.items():
            score = _similarity(name_stripped, norm_g)
            if score > best_score:
                best_score = score
                best_group = orig_g
        if best_score >= _FUZZY_THRESHOLD:
            resolved[name] = best_group
            logger.info("[FUZZY] '%.30s' → '%.30s' (%.0f%%)",
                        name, best_group, best_score * 100)
            continue

        # ── Step 4: independent pre-filter ────────────────────────────────
        if _is_likely_independent(name):
            resolved[name] = name   # its own group, no AI needed
            logger.debug("[INDEP] '%.30s' → own group", name)
            continue

        # ── Step 5: needs Qwen AI ──────────────────────────────────────────
        needs_ai.append(name)

    # ── Batch AI calls (15 per prompt) ────────────────────────────────────
    if needs_ai and not _ollama_disabled:
        BATCH = 15
        total_batches = (len(needs_ai) + BATCH - 1) // BATCH
        logger.warning("[QWEN] %d companies → %d AI batch calls", len(needs_ai), total_batches)

        for i in range(0, len(needs_ai), BATCH):
            batch   = needs_ai[i:i + BATCH]
            current_groups = list(resolved.values()) + existing_groups
            candidates_map = {n: _get_top_candidates(_strip_legal_suffix(n), current_groups)
                              for n in batch}
            batch_result = _qwen_batch_smart(batch, candidates_map)

            for name, canonical in batch_result.items():
                resolved[name]          = canonical
                groupe_par_nom[name]    = canonical
                ia_cache[name]          = canonical
                if canonical not in existing_groups:
                    existing_groups.append(canonical)
                if canonical != name:
                    logger.warning("[QWEN] ✅ '%.35s' → '%.35s'", name, canonical)

    # ── Fallback: anything still missing ──────────────────────────────────
    for name in names:
        if name not in resolved:
            resolved[name] = name
            groupe_par_nom[name] = name

    # ── Cache all results ─────────────────────────────────────────────────
    for name, canonical in resolved.items():
        groupe_par_nom[name] = canonical
        ia_cache[name]       = canonical

    return resolved


# ═══════════════════════════════════════════════════════════════════════════════
# Qwen AI internals
# ═══════════════════════════════════════════════════════════════════════════════

def _qwen_batch_smart(names: list, candidates_map: dict) -> dict:
    """
    Send one Qwen prompt per batch of 15 companies.
    Each company gets its own top-12 candidate list to reduce noise.
    """
    global _ollama_disabled
    if _ollama_disabled:
        return {n: n for n in names}

    # Build a combined candidate list (deduplicated)
    all_candidates = []
    for cands in candidates_map.values():
        for c in cands:
            if c not in all_candidates:
                all_candidates.append(c)

    groups_str = "\n".join(f"- {g}" for g in all_candidates[:40])
    numbered   = "\n".join(f"{i+1}. {n}" for i, n in enumerate(names))

    prompt = f"""Tu es un expert en entity resolution pour des entreprises françaises et belges.

GROUPES CANDIDATS (uniquement ces groupes ou NEW) :
{groups_str}

TÂCHE : Pour chaque société numérotée, détermine si elle est une filiale, division,
marque ou variation orthographique d'un groupe candidat. Sinon réponds NEW.

RÈGLES :
- Réponds UNIQUEMENT avec le numéro suivi du nom EXACT du groupe (ou NEW)
- Ignore les suffixes juridiques : SA, SAS, SARL, GIE, Ltd, NV, BV, GmbH
- Ignore les qualificatifs géographiques : France, Belgique, Paris, Lyon...
- "TCS Belgique" → TCS (Tata) si TCS (Tata) est dans la liste
- "Orange Business Services" → Orange si Orange est dans la liste
- Si aucun groupe ne correspond → NEW

SOCIÉTÉS :
{numbered}

RÉPONSES (une par ligne, format strict "N. Groupe" ou "N. NEW") :"""

    try:
        import ollama as _ollama
        import os
        _host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        _client = _ollama.Client(host=_host, timeout=1800)  # 30 min
        r = _client.generate(
            model="qwen2.5:7b",
            prompt=prompt,
            options={"temperature": 0, "num_predict": 200}
        )
        return _parse_response(r["response"].strip(), names,
                               [c for cands in candidates_map.values() for c in cands])

    except (ConnectionRefusedError, OSError):
        _ollama_disabled = True
        logger.warning("[Qwen] 🔌 Ollama unreachable — AI disabled for this session.")
        return {n: n for n in names}
    except Exception as e:
        logger.debug("[Qwen] Batch error: %s", e)
        return {n: n for n in names}


def _parse_response(raw: str, names: list, valid_groups: list) -> dict:
    """Parse Qwen numbered response into {name: canonical} dict."""
    import re
    result = {}
    valid_set = set(valid_groups)

    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        # Match lines like "1. BNP Paribas" or "1. NEW"
        m = re.match(r'^(\d+)\.\s*(.+)$', line)
        if not m:
            continue
        try:
            idx    = int(m.group(1)) - 1
            answer = m.group(2).strip().strip('"').strip("'")
        except ValueError:
            continue

        if 0 <= idx < len(names):
            name = names[idx]
            if answer.upper() == "NEW" or answer not in valid_set:
                result[name] = name          # independent group
            else:
                result[name] = answer        # matched canonical group

    # Fill missing
    for name in names:
        if name not in result:
            result[name] = name

    return result
