# Documentation Architecturale et Fonctionnelle de Pilotis

Cette documentation détaille l'architecture complète de l'application, en listant pour chaque page ses fonctionnalités, les fichiers sources associés, les tables de base de données (modèles) utilisées, ainsi que les rôles et formulaires qui y sont rattachés.

---

## 1. Tableau de Bord (Dashboard)
**Page :** Accueil / Statistiques Globales

- **Description :** Cette page offre une vue d'ensemble des performances (KPIs) de l'entreprise, avec des métriques clés (nombre d'entretiens, conversion, offres en cours).
- **Fichiers Frontend :** `src/pages/Index.tsx`
- **Fichiers Backend :** Routes d'agrégation dans `app/routes/kpi_routes.py` (si applicable).
- **Tables (BDD) impliquées :** Agrégation de données depuis `Interview`, `JobRequisition`, `Candidate`, `Mission`.
- **Formules clés :** 
  - *Taux de conversion* = `(Nombre de recrutements validés / Nombre total d'entretiens) * 100`
  - *Délai moyen de recrutement* = Moyenne de `(Date de recrutement - Date de création du besoin)`

---

## 2. Gestion des Candidats
**Page :** Candidats

- **Description :** Permet de visualiser, importer (via Google Form, LinkedIn, ou Email) et gérer le vivier de candidats. C'est ici que l'IA extrait les données des CVs et calcule le "Matching".
- **Fichiers Frontend :** `src/pages/Candidats.tsx`
- **Fichiers Backend :** `app/models/candidate.py`, `app/models/candidate_many.py`, `app/services/linkedin_form_collector.py`, `app/services/cv_processor.py`.
- **Tables (BDD) impliquées :** 
  - `candidate` : Stocke les informations du profil (nom, email, tel, texte du CV, localisation, compétences).
  - `candidate_many` : Table de jointure pour lier un candidat à un Appel d'Offre (AO).
- **Détails des Formulaires :**
  - **Formulaire Google Forms (Externe) :** Collecte `Email`, `Nom complet`, et `Lien CV Google Drive`. Soumis à une validation stricte (l'email doit être valide, le nom ne doit contenir que des lettres).
  - **Boutons d'Action :** Bouton "Scanner les emails" et "Collecter LinkedIn". *Le bouton "+ Ajouter" manuel a été supprimé.*

---

## 3. Appels d'Offres (Besoins clients)
**Page :** Appels d'Offres / Jobs

- **Description :** Permet de gérer les besoins de recrutement de vos clients ou en interne (opportunités).
- **Fichiers Frontend :** `src/pages/AppelsOffres.tsx`
- **Fichiers Backend :** `app/models/job_requisition.py`, `app/models/ao_request.py`
- **Tables (BDD) impliquées :** 
  - `job_requisition` : Stocke le titre du poste, la description, les critères requis, et le statut.
- **Formules / Logique :** 
  - L'**AutoMatcher** compare les `skills_confirmed` du CV avec les `criteres` de la `job_requisition` pour générer un **Match Score (0 à 100%)**.

---

## 4. Entretiens (Interviews)
**Page :** Entretiens

- **Description :** Planification et suivi des entretiens avec les candidats. Génère des feedbacks.
- **Fichiers Frontend :** `src/pages/Entretiens.tsx`
- **Fichiers Backend :** `app/models/interview.py`
- **Tables (BDD) impliquées :** 
  - `interview` : Date de l'entretien, candidat associé, collaborateur (interviewer), type d'entretien, statut (planifié, réalisé, annulé) et feedbacks.
- **Détails des Formulaires :**
  - **Nouveau Feedback :** Formulaire court pour évaluer le candidat (note technique, savoir-être, points forts/faibles).

---

## 5. Clients et Prospects (CRM)
**Page :** Clients & Prospects

- **Description :** Annuaire CRM permettant de suivre les entreprises cibles et leurs contacts.
- **Fichiers Frontend :** `src/pages/ClientsProspects.tsx`
- **Fichiers Backend :** `app/models/company.py`, `app/models/contact.py`
- **Tables (BDD) impliquées :** 
  - `company` : Nom de l'entreprise, domaine, URL du site, statut CRM.
  - `contact` : Contacts rattachés à une `company` (Nom, poste, email, LinkedIn).
- **Formulaires :**
  - **Ajout rapide de contact :** Formulaire permettant de lier rapidement un interlocuteur RH/Tech à une entreprise pour le démarchage.

---

## 6. Profils Recherchés (Sourcing)
**Page :** Profils Sourcés (Searched Profiles)

- **Description :** Listes de profils repérés (notamment sur LinkedIn) avant qu'ils ne postulent officiellement.
- **Fichiers Frontend :** `src/pages/SearchedProfiles.tsx`
- **Fichiers Backend :** `app/models/searched_profile.py`
- **Tables (BDD) impliquées :** 
  - `searched_profile` : URL LinkedIn, nom, statut de prospection (contacté, à relancer).

---

## 7. Intercontrats
**Page :** Intercontrats

- **Description :** Suivi des consultants actuellement sans mission (Bench). Permet d'anticiper les futurs placements.
- **Fichiers Frontend :** `src/pages/Intercontrats.tsx`
- **Fichiers Backend :** `app/models/interco.py`
- **Tables (BDD) impliquées :** 
  - `interco` : Nom du collaborateur, date de début d'intercontrat, compétences, statut de placement.

---

## 8. Configuration & Modèles d'Emails
**Page :** Paramètres / Configuration

- **Description :** Espace administrateur pour la gestion des utilisateurs, des intégrations API, et des modèles de communication.
- **Fichiers Frontend :** `src/pages/Configuration.tsx`, `src/pages/ConfigModule.tsx`, `src/pages/EmailTemplates.tsx`
- **Fichiers Backend :** `app/models/settings.py`, `app/models/user.py`, `app/models/role.py`, `app/models/permissions.py`, `app/models/email_template.py`
- **Tables (BDD) impliquées :** 
  - `users` : Comptes de l'application avec leurs mots de passe (hashés).
  - `role` / `role_permission` : Gestion des droits d'accès (Admin, Manager, Commercial).
  - `app_settings` : Clés d'API (OpenAI, Google Drive, BoondManager).
  - `email_template` : Templates pour les mails de refus, de relance, etc.

---

## Gestion des Rôles et Droits

L'application repose sur un système de droits configurables via la base de données (`role_permission`) :

1. **Administrateur :** A accès à toutes les pages (Configuration, facturation, suppressions de masse).
2. **Manager :** Gère les offres, valide les recrutements, peut voir les performances des commerciaux, mais n'a pas accès à la configuration technique.
3. **Commercial / Recruteur :** Se concentre sur le Matching, les Candidats, et les Clients/Prospects. N'a accès ni à la configuration, ni à l'administration des utilisateurs.

*(Récemment, le droit d'accès au module "CV Extraction" a été effacé pour affiner les vues du menu selon les rôles).*

---

## Logique d'Intelligence Artificielle & "Formules" Cachées (AutoMatching)

Les formulaires de collecte (Email / Google Forms) n'insèrent jamais directement en base. Le processus suit cette "formule" :

1. **Extraction :** Le fichier (PDF/Word) est téléchargé depuis Drive ou l'Email.
2. **Validation (Filtre anti-bruit) :** Le script vérifie la taille, l'extension, puis lance un algorithme (`is_valid_cv_content`) pour vérifier la présence d'une structure de CV (Expériences, Formations). Si faux $\rightarrow$ Rejet + Suppression Drive.
3. **Parsing IA :** Le texte extrait est envoyé à un modèle IA (LLM) pour extraire structurément : `{ "skills": [], "experience_months": X, "location": "Y" }`.
4. **AutoMatching (La Formule de Matching) :** 
   - **Règle :** Même si le candidat n'a pas renseigné de référence d'Appel d'Offre (ou s'il a mis une référence fausse), l'algorithme calcule un **Score Hybrid** en comparant les compétences de son CV avec la description de chaque Appel d'Offre de la base.
   - Le candidat est ensuite automatiquement "Lié" (Linked) à l'Appel d'Offre lui donnant le **score le plus élevé**.
