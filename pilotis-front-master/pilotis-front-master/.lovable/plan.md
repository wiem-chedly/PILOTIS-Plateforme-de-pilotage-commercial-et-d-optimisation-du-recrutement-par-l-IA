
# Dashboard KPI Commercial — PILOTIS

## Identité Visuelle
- Palette bleu professionnel inspirée du logo PILOTIS (#1e3a5f, #1e40af, #3b82f6, #60a5fa)
- Logo PILOTIS intégré dans le header et la sidebar
- Design épuré, moderne, orienté data visualization
- Mode clair uniquement

## Layout Global
- **Sidebar collapsible** avec navigation (Dashboard, Appels d'Offres, Performance, Clients, Reporting) — seul le Dashboard sera fonctionnel en V1, les autres pages afficheront un placeholder "Bientôt disponible"
- **Header** avec logo PILOTIS, titre de la page, et menu utilisateur (avatar + nom)
- Responsive : sidebar se replie en mode mobile

## Dashboard Principal (Page d'accueil)

### KPI Cards (ligne du haut)
4 cartes avec icône, valeur principale, trend en pourcentage et indicateur hausse/baisse :
- **Total Opportunités** (ex: 147, +12%)
- **Taux de Conversion** (ex: 23.5%, +2.1pts)
- **Appels d'Offres Actifs** (ex: 34)
- **Contrats Signés ce mois** (ex: 8, +33%)

### Graphiques (grille 2x2)
- **Courbe d'évolution mensuelle** : contrats signés vs objectifs sur 12 mois (Recharts AreaChart)
- **Camembert** : Répartition Prospects / Clients / Partenaires (Recharts PieChart)
- **Bar chart** : Performance par commercial — top 5 commerciaux avec CA et nombre d'opportunités (Recharts BarChart)
- **Funnel de conversion** : Leads → Qualifiés → Propositions → Négociation → Signés (barres horizontales décroissantes)

### Tableau d'activités récentes
Tableau en bas de page montrant les 10 dernières activités commerciales :
- Date, Commercial, Type d'activité, Client, Détail, Statut (badge coloré)

## Données
Toutes les données seront mockées avec des valeurs réalistes pour une ESN en croissance, permettant de valider le design et les interactions avant l'intégration backend.
