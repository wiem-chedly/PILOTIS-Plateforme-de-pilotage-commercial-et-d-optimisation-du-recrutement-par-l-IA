export const kpiData = {
  totalOpportunities: { value: 147, trend: 12, up: true },
  conversionRate: { value: 23.5, trend: 2.1, up: true },
  activeAO: { value: 34, trend: -5, up: false },
  signedContracts: { value: 8, trend: 33, up: true },
};

export const monthlyEvolutionData = [
  { month: "Mar", contrats: 3, objectifs: 5 },
  { month: "Avr", contrats: 5, objectifs: 5 },
  { month: "Mai", contrats: 4, objectifs: 6 },
  { month: "Jun", contrats: 7, objectifs: 6 },
  { month: "Jul", contrats: 6, objectifs: 6 },
  { month: "Aoû", contrats: 5, objectifs: 7 },
  { month: "Sep", contrats: 8, objectifs: 7 },
  { month: "Oct", contrats: 7, objectifs: 7 },
  { month: "Nov", contrats: 9, objectifs: 8 },
  { month: "Déc", contrats: 6, objectifs: 8 },
  { month: "Jan", contrats: 10, objectifs: 8 },
  { month: "Fév", contrats: 8, objectifs: 9 },
];

export const clientRatiosData = [
  { nom: "BNP Paribas", ratioAppels: 78, ratioRdv: 62, ratioNrp: 12 },
  { nom: "Airbus Defence", ratioAppels: 85, ratioRdv: 70, ratioNrp: 8 },
  { nom: "SNCF Réseau", ratioAppels: 65, ratioRdv: 45, ratioNrp: 22 },
  { nom: "Crédit Agricole", ratioAppels: 58, ratioRdv: 38, ratioNrp: 28 },
  { nom: "Thales", ratioAppels: 72, ratioRdv: 55, ratioNrp: 15 },
  { nom: "Orange Business", ratioAppels: 80, ratioRdv: 60, ratioNrp: 10 },
  { nom: "Société Générale", ratioAppels: 88, ratioRdv: 72, ratioNrp: 6 },
  { nom: "Safran", ratioAppels: 70, ratioRdv: 50, ratioNrp: 18 },
];

export const commercialPerformanceData = [
  { name: "S. Martin", ca: 320, opportunites: 28 },
  { name: "L. Dupont", ca: 285, opportunites: 24 },
  { name: "M. Bernard", ca: 240, opportunites: 20 },
  { name: "A. Moreau", ca: 195, opportunites: 18 },
  { name: "C. Leroy", ca: 160, opportunites: 14 },
];

export const funnelData = [
  { stage: "Leads", value: 342, fill: "hsl(213 94% 68%)" },
  { stage: "Qualifiés", value: 215, fill: "hsl(213 94% 55%)" },
  { stage: "Propositions", value: 128, fill: "hsl(224 80% 40%)" },
  { stage: "Négociation", value: 64, fill: "hsl(215 50% 24%)" },
  { stage: "Signés", value: 34, fill: "hsl(215 50% 18%)" },
];

export type Activity = {
  date: string;
  commercial: string;
  type: string;
  client: string;
  detail: string;
  statut: "Gagné" | "En cours" | "Perdu" | "Nouveau" | "Relance";
};

export const recentActivities: Activity[] = [
  { date: "17/02/2026", commercial: "S. Martin", type: "Appel", client: "BNP Paribas", detail: "Présentation solution cloud", statut: "En cours" },
  { date: "16/02/2026", commercial: "L. Dupont", type: "Signature", client: "Airbus Defence", detail: "Contrat TMA 24 mois", statut: "Gagné" },
  { date: "16/02/2026", commercial: "M. Bernard", type: "Proposition", client: "SNCF Réseau", detail: "AO migration SI", statut: "En cours" },
  { date: "15/02/2026", commercial: "A. Moreau", type: "Relance", client: "Crédit Agricole", detail: "Suivi proposition DevOps", statut: "Relance" },
  { date: "15/02/2026", commercial: "S. Martin", type: "Rendez-vous", client: "Thales", detail: "Qualification besoin cybersécurité", statut: "Nouveau" },
  { date: "14/02/2026", commercial: "C. Leroy", type: "Appel", client: "EDF Renouvelables", detail: "Premier contact data engineering", statut: "Nouveau" },
  { date: "14/02/2026", commercial: "L. Dupont", type: "Proposition", client: "Orange Business", detail: "Offre consulting agile", statut: "En cours" },
  { date: "13/02/2026", commercial: "M. Bernard", type: "Signature", client: "Société Générale", detail: "Extension mission BI", statut: "Gagné" },
  { date: "13/02/2026", commercial: "A. Moreau", type: "Appel", client: "Safran", detail: "Suivi AO intégration SAP", statut: "Perdu" },
  { date: "12/02/2026", commercial: "S. Martin", type: "Rendez-vous", client: "Bouygues Telecom", detail: "Démonstration plateforme", statut: "En cours" },
];
