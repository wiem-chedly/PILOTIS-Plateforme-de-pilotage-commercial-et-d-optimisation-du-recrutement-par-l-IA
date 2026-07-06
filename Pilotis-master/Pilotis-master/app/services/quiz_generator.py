"""
quiz_generator.py — Génération automatique de quiz QCM par Qwen

Utilise le modèle qwen2.5:7b via Ollama pour générer des questions techniques
basées sur les données de l'AO (titre, description, critères).

Pas d'entraînement : on utilise le prompt engineering pour guider Qwen.
Les données de l'AO sont injectées directement dans le contexte du prompt.
"""

import json
import logging
import re
import os

logger = logging.getLogger(__name__)

# Seuil de passage (configurable via DB - AppSetting 'quiz_pass_threshold')
DEFAULT_PASS_THRESHOLD = 0.60  # 60%

# Questions fallback par domaine si Qwen est indisponible
FALLBACK_QUESTIONS = {
    "default": [
        {
            "num": 1,
            "text": "Quelle est la meilleure pratique pour réviser son code avant livraison ?",
            "choices": {"A": "Tester directement en production", "B": "Effectuer une revue de code (code review)", "C": "Ignorer les tests unitaires", "D": "Déployer sans validation"},
            "correct": "B",
            "explanation": "La revue de code permet de détecter les erreurs avant la mise en production."
        },
        {
            "num": 2,
            "text": "Qu'est-ce qu'une méthodologie Agile ?",
            "choices": {"A": "Une méthode de gestion de projet itérative", "B": "Un langage de programmation", "C": "Un framework CSS", "D": "Un outil de versioning"},
            "correct": "A",
            "explanation": "Agile est une approche itérative de gestion de projet favorisant la collaboration."
        },
        {
            "num": 3,
            "text": "Que signifie l'acronyme SOLID en développement logiciel ?",
            "choices": {"A": "Un framework JavaScript", "B": "5 principes de conception orientée objet", "C": "Un outil de déploiement", "D": "Un protocole réseau"},
            "correct": "B",
            "explanation": "SOLID représente 5 principes : Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion."
        },
        {
            "num": 4,
            "text": "Quelle est la différence entre un bug et une régression ?",
            "choices": {"A": "Aucune, c'est la même chose", "B": "Une régression est une fonctionnalité qui fonctionnait et ne fonctionne plus", "C": "Un bug est intentionnel", "D": "Une régression est un bug de sécurité"},
            "correct": "B",
            "explanation": "Une régression est un bug qui réapparaît ou une fonctionnalité qui cesse de fonctionner après une modification."
        },
        {
            "num": 5,
            "text": "Qu'est-ce que Git ?",
            "choices": {"A": "Un langage de programmation", "B": "Un système de gestion de versions distribué", "C": "Un serveur web", "D": "Un éditeur de code"},
            "correct": "B",
            "explanation": "Git est un système de contrôle de versions qui permet de suivre les modifications du code source."
        },
        {
            "num": 6,
            "text": "Qu'est-ce qu'une API REST ?",
            "choices": {"A": "Un langage de base de données", "B": "Un style d'architecture pour services web utilisant HTTP", "C": "Un framework frontend", "D": "Un protocole de chiffrement"},
            "correct": "B",
            "explanation": "REST (Representational State Transfer) est un style architectural utilisant les méthodes HTTP (GET, POST, PUT, DELETE)."
        }
    ]
}


def generate_quiz(job) -> list:
    """
    Génère 6 questions QCM techniques basées sur les données de l'AO.

    Stratégie de prompt :
    1. On injecte titre + description + critères de l'AO dans le contexte
    2. Qwen génère les questions en JSON structuré
    3. On parse et valide le JSON
    4. En cas d'échec, on utilise des questions de fallback

    Args:
        job: instance JobRequisition avec titre, description, criteres

    Returns:
        list de 6 dicts {num, text, choices, correct, explanation}
    """
    titre = job.titre or "Poste technique"
    description = (job.description or "")[:800]
    criteres = (job.criteres or "")[:400]

    prompt = f"""Tu es un expert RH technique francophone. 
Génère exactement 6 questions à choix multiples (QCM) pour évaluer un candidat au poste suivant.

=== POSTE ===
Titre       : {titre}
Description : {description}
Compétences : {criteres}
=============

RÈGLES OBLIGATOIRES :
- Questions TECHNIQUES et directement liées aux compétences du poste
- Exactement 4 options par question (A, B, C, D)
- Une seule bonne réponse par question
- Niveau intermédiaire (ni trivial, ni expert)
- Questions en français
- Mélange : concepts théoriques + cas pratiques + bonnes pratiques

Retourne UNIQUEMENT un JSON valide, sans texte avant ou après :
{{
  "questions": [
    {{
      "num": 1,
      "text": "Question ici ?",
      "choices": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "correct": "B",
      "explanation": "Explication courte de la bonne réponse"
    }}
  ]
}}"""

    try:
        import ollama as _ollama
        import os
        _host = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        _client = _ollama.Client(host=_host, timeout=60)  # 60s timeout pour éviter de bloquer le frontend
        logger.info("[QuizGen] Génération quiz pour AO: %s", titre)
        r = _client.generate(
            model="qwen2.5:7b",
            prompt=prompt,
            format="json",
            options={"temperature": 0.3, "num_predict": 1500}
        )
        raw = r.get("response", "").strip()
        return _parse_quiz_response(raw, titre)

    except (ConnectionRefusedError, OSError) as e:
        logger.warning("[QuizGen] Ollama indisponible: %s — utilisation fallback", e)
        return FALLBACK_QUESTIONS["default"]
    except Exception as e:
        logger.error("[QuizGen] Erreur génération quiz: %s", e)
        return FALLBACK_QUESTIONS["default"]


def _parse_quiz_response(raw: str, job_titre: str) -> list:
    """Parse la réponse JSON de Qwen et valide la structure."""
    # Extraire le JSON depuis la réponse (peut contenir du texte parasite)
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        logger.warning("[QuizGen] Pas de JSON trouvé dans la réponse Qwen")
        return FALLBACK_QUESTIONS["default"]

    try:
        data = json.loads(json_match.group())
        questions = data.get("questions", [])

        # Validation de chaque question
        validated = []
        for q in questions:
            if not all(k in q for k in ["num", "text", "choices", "correct", "explanation"]):
                continue
            if not isinstance(q["choices"], dict) or len(q["choices"]) != 4:
                continue
            if q["correct"] not in q["choices"]:
                continue
            validated.append({
                "num": int(q["num"]),
                "text": str(q["text"]),
                "choices": {k: str(v) for k, v in q["choices"].items()},
                "correct": str(q["correct"]),
                "explanation": str(q["explanation"])
            })

        if len(validated) < 3:
            logger.warning("[QuizGen] Seulement %d questions valides — fallback", len(validated))
            return FALLBACK_QUESTIONS["default"]

        logger.info("[QuizGen] ✅ %d questions générées pour '%s'", len(validated), job_titre)
        return validated[:6]  # max 6 questions

    except json.JSONDecodeError as e:
        logger.error("[QuizGen] JSON invalide: %s", e)
        return FALLBACK_QUESTIONS["default"]


def evaluate_answers(questions: list, candidate_answers: dict) -> dict:
    """
    Évalue les réponses du candidat de façon déterministe.
    Pas besoin de Qwen ici — simple comparaison avec les bonnes réponses.

    Args:
        questions: liste des questions avec 'correct'
        candidate_answers: dict {str(num): str(lettre_choisie)}

    Returns:
        dict avec score (0.0-1.0), correct_count, total, detail
    """
    correct_count = 0
    detail = []

    for q in questions:
        num = str(q["num"])
        given = candidate_answers.get(num, "").upper()
        expected = q["correct"].upper()
        is_correct = (given == expected)

        if is_correct:
            correct_count += 1

        detail.append({
            "num": num,
            "question": q["text"],
            "is_correct": is_correct,
            "given": given or "—",
            "correct": expected,
            "explanation": q["explanation"]
        })

    total = len(questions)
    score = correct_count / total if total > 0 else 0.0

    logger.info("[QuizGen] Score: %d/%d = %.0f%%", correct_count, total, score * 100)

    return {
        "score": score,
        "correct_count": correct_count,
        "total": total,
        "detail": detail
    }


def get_pass_threshold() -> float:
    """Récupère le seuil de passage depuis la config DB ou utilise la valeur par défaut."""
    try:
        from app.models.pilotis_config import PilotisConfig
        threshold = PilotisConfig.get("quiz_pass_threshold", DEFAULT_PASS_THRESHOLD)
        return float(threshold)
    except Exception:
        return DEFAULT_PASS_THRESHOLD
