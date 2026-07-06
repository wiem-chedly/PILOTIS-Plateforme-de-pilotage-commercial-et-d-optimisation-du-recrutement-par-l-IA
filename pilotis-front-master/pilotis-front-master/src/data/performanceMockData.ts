export interface CommercialDetail {
  id: string;
  nom: string;
  prenom: string;
  poste: string;
  appels: number;
  opportunites: number;
  propositions: number;
  contratsSigne: number;
  tauxTransformation: number;
  caGenere: number;
  objectifCA: number;
}

export const commercialDetails: CommercialDetail[] = [
  { id: "c1", nom: "Martin", prenom: "Sophie", poste: "Directrice Commerciale", appels: 142, opportunites: 28, propositions: 18, contratsSigne: 10, tauxTransformation: 35.7, caGenere: 320000, objectifCA: 350000 },
  { id: "c2", nom: "Dupont", prenom: "Laurent", poste: "Responsable Grands Comptes", appels: 118, opportunites: 24, propositions: 15, contratsSigne: 8, tauxTransformation: 33.3, caGenere: 285000, objectifCA: 300000 },
  { id: "c3", nom: "Bernard", prenom: "Marie", poste: "Commerciale Senior", appels: 105, opportunites: 20, propositions: 12, contratsSigne: 6, tauxTransformation: 30.0, caGenere: 240000, objectifCA: 280000 },
  { id: "c4", nom: "Moreau", prenom: "Antoine", poste: "Commercial", appels: 96, opportunites: 18, propositions: 10, contratsSigne: 5, tauxTransformation: 27.8, caGenere: 195000, objectifCA: 250000 },
  { id: "c5", nom: "Leroy", prenom: "Camille", poste: "Commercial Junior", appels: 78, opportunites: 14, propositions: 7, contratsSigne: 3, tauxTransformation: 21.4, caGenere: 160000, objectifCA: 200000 },
];

// Heatmap data: activity count per day (0=Lun..4=Ven) and hour (8..18)
export const heatmapHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
export const heatmapDays = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

// Generate realistic heatmap: more activity mid-morning and mid-afternoon
export const heatmapData: number[][] = [
  // Lun
  [2, 5, 8, 10, 3, 1, 6, 9, 7, 4, 1],
  // Mar
  [3, 6, 9, 11, 4, 2, 7, 10, 8, 5, 2],
  // Mer
  [2, 4, 7, 9, 3, 1, 5, 8, 6, 3, 1],
  // Jeu
  [3, 7, 10, 12, 4, 2, 8, 11, 9, 6, 2],
  // Ven
  [1, 4, 6, 8, 2, 1, 4, 7, 5, 3, 1],
];

// Team comparison metrics
export interface TeamMetric {
  label: string;
  value: number;
  unit: string;
  objectif: number;
  icon: string;
}

export const teamMetrics: TeamMetric[] = [
  { label: "Appels passés (équipe)", value: 539, unit: "", objectif: 600, icon: "phone" },
  { label: "Opportunités créées", value: 104, unit: "", objectif: 120, icon: "target" },
  { label: "Taux de transformation moyen", value: 29.6, unit: "%", objectif: 35, icon: "trending-up" },
  { label: "CA total généré", value: 1200000, unit: "€", objectif: 1380000, icon: "euro" },
];
