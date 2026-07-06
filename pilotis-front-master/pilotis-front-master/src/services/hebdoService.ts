import apiClient from "../api/apiClient";

export interface IntercoItem {
  boond_id: string;
  name: string;
  category: "recrutement_recent" | "sortie_prochaine" | "sortie_mission" | "autre";
  sales_responsable: string;
  fin_mission: string | null;
  derniere_action: string;
  statut: "sans_action" | "en_cours" | "positionne";
}

export interface IntercoResponse {
  totals: {
    recrutement_recent: number;
    sortie_prochaine: number;
    sortie_mission: number;
    total: number;
  };
  intercos: IntercoItem[];
}

export interface SalesSummary {
  name: string;
  prospection: number;
  suivi_mission: number;
  positionnements: number;
  entretiens: number;
  signatures: number;
  taux_pos_ent: number | null;
  taux_ent_sign: number | null;
  intercos: {
    recrutement_recent: number;
    sortie_prochaine: number;
    sortie_mission: number;
    positionnes: number;
    total: number;
  };
}

export interface Alert {
  type: "danger" | "warning" | "info";
  message: string;
}

export interface HebdoSynthese {
  week_label: string;
  week_start: string;
  week_end: string;
  team_totals: {
    prospections: number;
    positionnements: number;
    entretiens: number;
    signatures: number;
  };
  sales: SalesSummary[];
  alerts: Alert[];
}

export interface SalesDetail {
    name: string;
    week_label: string;
    repartition: {
        prospection: number;
        suivi_mission: number;
        positionnement: number;
        entretien: number;
        signature: number;
    };
    actions_by_day: {
        date: string;
        label: string;
        count: number;
        actions: { type: string; description: string; company: string }[];
    }[];
    intercos: {
        name: string;
        last_action: string;
        category: string;
    }[];
}

export interface AnnualKpiSales {
  name: string;
  taci: number;
  positionnements: { realise: number; objectif: number };
  entretiens: { realise: number; objectif: number };
  signatures: { realise: number; objectif: number };
  ca: { realise: number; objectif: number };
  projection_fin_annee: number;
  statut_projection: "en_bonne_voie" | "sous_objectif";
}

export interface AnnualKpiResponse {
    year: number;
    sales: AnnualKpiSales[];
}

export interface PilotisConfig {
  recrutement_recent_days: number;
  sortie_prochaine_days: number;
  taci_cible: number;
  debut_semaine: string;
  objectifs: any[]; 
}

export const getHebdoSynthese = async (weekStart?: string, weekEnd?: string): Promise<HebdoSynthese> => {
  const params = new URLSearchParams();
  if (weekStart) params.append('week_start', weekStart);
  if (weekEnd) params.append('week_end', weekEnd);
  
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/hebdo/synthese${queryStr}`);
  return response.data;
};

export const getSalesDetail = async (salesName: string, weekStart?: string, weekEnd?: string): Promise<SalesDetail> => {
  const params = new URLSearchParams();
  if (weekStart) params.append('week_start', weekStart);
  if (weekEnd) params.append('week_end', weekEnd);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  // Name is already URL-encoded by encodeURIComponent in the component, but apiClient (axios) might double-encode it if we pass it as a param. 
  // We'll pass it safely in the path. React Router typically passes decoded params.
  const response = await apiClient.get(`/hebdo/sales/${encodeURIComponent(salesName)}${queryStr}`);
  return response.data;
};

export const getIntercos = async (category = "all", salesName = "all"): Promise<IntercoResponse> => {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.append('category', category);
  if (salesName && salesName !== 'all') params.append('sales_name', salesName);
  
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get(`/intercos${queryStr}`);
  return response.data;
};

export const getKpiAnnuels = async (year?: number): Promise<AnnualKpiResponse> => {
  const queryStr = year ? `?year=${year}` : '';
  const response = await apiClient.get(`/kpi/annuels${queryStr}`);
  return response.data;
};

export const getConfig = async (): Promise<PilotisConfig> => {
  const response = await apiClient.get("/config");
  return response.data.config;
};

export const saveConfig = async (data: Partial<PilotisConfig>): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post("/config", data);
  return response.data;
};
