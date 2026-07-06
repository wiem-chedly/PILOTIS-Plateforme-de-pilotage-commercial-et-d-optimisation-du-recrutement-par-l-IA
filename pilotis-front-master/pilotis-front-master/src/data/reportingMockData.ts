export type Periode = "jour" | "semaine" | "mois" | "trimestre" | "annee";

export interface ReportMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  format: "number" | "currency" | "percent";
}

export const reportMetrics: ReportMetric[] = [
  { label: "Chiffre d'affaires", currentValue: 1200000, previousValue: 980000, unit: "€", format: "currency" },
  { label: "Contrats signés", currentValue: 34, previousValue: 28, unit: "", format: "number" },
  { label: "Taux de conversion", currentValue: 29.6, previousValue: 24.1, unit: "%", format: "percent" },
  { label: "Opportunités créées", currentValue: 104, previousValue: 87, unit: "", format: "number" },
  { label: "Appels passés", currentValue: 539, previousValue: 412, unit: "", format: "number" },
  { label: "Propositions envoyées", currentValue: 62, previousValue: 48, unit: "", format: "number" },
];

// Monthly comparison data N vs N-1
export const monthlyComparison = [
  { month: "Jan", currentCA: 105, previousCA: 78, currentContrats: 10, previousContrats: 7 },
  { month: "Fév", currentCA: 98, previousCA: 82, currentContrats: 8, previousContrats: 6 },
  { month: "Mar", currentCA: 88, previousCA: 70, currentContrats: 7, previousContrats: 5 },
  { month: "Avr", currentCA: 95, previousCA: 75, currentContrats: 9, previousContrats: 6 },
  { month: "Mai", currentCA: 102, previousCA: 80, currentContrats: 8, previousContrats: 7 },
  { month: "Jun", currentCA: 110, previousCA: 85, currentContrats: 11, previousContrats: 7 },
  { month: "Jul", currentCA: 92, previousCA: 72, currentContrats: 7, previousContrats: 5 },
  { month: "Aoû", currentCA: 78, previousCA: 60, currentContrats: 5, previousContrats: 4 },
  { month: "Sep", currentCA: 115, previousCA: 88, currentContrats: 12, previousContrats: 8 },
  { month: "Oct", currentCA: 108, previousCA: 92, currentContrats: 9, previousContrats: 7 },
  { month: "Nov", currentCA: 120, previousCA: 95, currentContrats: 11, previousContrats: 9 },
  { month: "Déc", currentCA: 89, previousCA: 83, currentContrats: 7, previousContrats: 7 },
];

// Quarterly data
export const quarterlyComparison = [
  { quarter: "T1", currentCA: 291, previousCA: 230, currentContrats: 25, previousContrats: 18 },
  { quarter: "T2", currentCA: 307, previousCA: 240, currentContrats: 28, previousContrats: 20 },
  { quarter: "T3", currentCA: 285, previousCA: 220, currentContrats: 24, previousContrats: 17 },
  { quarter: "T4", currentCA: 317, previousCA: 270, currentContrats: 27, previousContrats: 23 },
];

// Report types for generation
export interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const reportTypes: ReportType[] = [
  { id: "commercial", name: "Rapport Commercial", description: "Synthèse des performances commerciales par période", icon: "bar-chart" },
  { id: "pipeline", name: "Rapport Pipeline", description: "État du pipeline et prévisions de CA", icon: "funnel" },
  { id: "activite", name: "Rapport d'Activité", description: "Détail des appels, RDV et propositions", icon: "activity" },
  { id: "clients", name: "Rapport Clients", description: "Analyse du portefeuille clients et prospects", icon: "users" },
];
