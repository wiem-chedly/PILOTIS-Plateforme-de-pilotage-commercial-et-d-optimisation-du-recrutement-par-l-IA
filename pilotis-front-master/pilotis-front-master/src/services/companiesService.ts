import apiClient from '../api/apiClient';

// ── Filters ───────────────────────────────────────────────────────────────────

export interface FilterParams {
    startDate?: string;    // "YYYY-MM-DD"
    endDate?: string;    // "YYYY-MM-DD"
    contactTypes?: string[];  // subset of ["Contacts","Partenaire"]; default = all
    companyNames?: string[];  // [] = all companies
    keyword?: string;    // space-separated AND keywords
}

// ── Conversion Dashboard ──────────────────────────────────────────────────────

export interface SubCompanyDetail {
    name: string;
    status: string;
    nb_contacts: number;
    nb_rdv: number;
    nb_appel: number;
    taux_rdv: string;
    taux_appel: string;
}

export interface Company {
    name: string;
    address: string;
    sector: string;
    sub_companies: string[];
    sub_company_details: SubCompanyDetail[];
    nb_prospects: number;
    nb_clients: number;
    nb_partenaires: number;
    nb_contacts: number;
    nb_rdv: number;
    nb_appel: number;
    taux_rdv: string;
    taux_appel: string;
}

export interface Period {
    start: string;
    end: string;
    label: string; // e.g. "Mar 2026"
}

/**
 * GET /companies/conversion
 * Fetches per-company RDV + Appel conversion stats from Boond.
 * Accepts optional filter params; any omitted param defaults to "include all".
 * NOTE: First call (or after cache miss) can take 30-60s.
 */
export const getConversionRate = async (
    filters?: FilterParams
): Promise<{ companies: Company[]; period: Period }> => {
    const params = new URLSearchParams();

    if (filters?.startDate) params.set("start_date", filters.startDate);
    if (filters?.endDate) params.set("end_date", filters.endDate);

    const types = filters?.contactTypes ?? ["Contacts", "Partenaire"];
    types.forEach(t => {
        if (t === "Contacts") {
            params.append("contact_types[]", "Prospect");
            params.append("contact_types[]", "Client");
        } else {
            params.append("contact_types[]", t);
        }
    });

    (filters?.companyNames ?? []).forEach(n => params.append("company_names[]", n));

    if (filters?.keyword?.trim()) params.set("keyword", filters.keyword.trim());

    const qs = params.toString();
    const { data } = await apiClient.get<{
        success: boolean;
        companies: Company[];
        period: Period;
    }>(`/companies/conversion${qs ? `?${qs}` : ""}`);

    return { companies: data.companies, period: data.period };
};

/**
 * GET /companies/export
 * Downloads the styled Excel (.xlsx) report.
 * Passes the same filter params as /conversion so exported data matches the view.
 */
export const exportStats = async (filters?: FilterParams): Promise<void> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set("start_date", filters.startDate);
    if (filters?.endDate) params.set("end_date", filters.endDate);

    const types = filters?.contactTypes ?? ["Contacts", "Partenaire"];
    types.forEach(t => {
        if (t === "Contacts") {
            params.append("contact_types[]", "Prospect");
            params.append("contact_types[]", "Client");
        } else {
            params.append("contact_types[]", t);
        }
    });

    (filters?.companyNames ?? []).forEach(n => params.append("company_names[]", n));
    if (filters?.keyword?.trim()) params.set("keyword", filters.keyword.trim());

    const qs = params.toString();
    const response = await apiClient.get(
        `/companies/export${qs ? `?${qs}` : ""}`,
        { responseType: 'blob' }
    );

    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    // Try to get filename from Content-Disposition, otherwise fall back gracefully
    const cd = response.headers['content-disposition'] ?? '';
    const match = cd.match(/filename="?([^"]+)"?/);
    link.download = match?.[1] ?? `Pilotis_Stats_${new Date().getFullYear()}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
};

// ── Monthly Stats (Qwen AI deduplication) ────────────────────────────────────

export interface CompanyStat {
    display_name: string;
    prospects: number;
    clients: number;
    partners: number;
    total: number;
    other_names: string[];
}

export interface StatsResponse {
    month: string;
    stats: CompanyStat[];
}

/**
 * GET /companies/stats
 * Returns monthly contact stats grouped by canonical company name.
 */
export const getMonthlyStats = async (): Promise<StatsResponse> => {
    const { data } = await apiClient.get<StatsResponse>('/companies/stats');
    return data;
};

/**
 * GET /companies/reset-cache
 * Clears the Qwen AI cache + in-memory sync cache.
 */
export const resetCache = async (): Promise<{ reset: string; db_group_names_cleared: number; message: string }> => {
    const { data } = await apiClient.get('/companies/reset-cache');
    return data;
};

// ── Commercial KPIs ──────────────────────────────────────────────────────────

export interface ConversionKpis {
    nb_ao: number;
    nb_cv: number;
    nb_entretiens: number;
    nb_signatures: number;
    taux_cv_par_ao: number | null;
    taux_signature_entretien: number | null;
    taux_signature_ao: number | null;
}

export interface PerformanceKpis {
    avg_reponse_ao_days: number | null;
    avg_cv_to_entretien_days: number | null;
    avg_entretien_to_signature_days: number | null;
    linked_action_pct: number;
    data_quality: "ok" | "insufficient";
}

export interface ActiviteKpis {
    nb_ao_traites: number;
    nb_ao_ouverts: number;
    nb_ao_clos: number;
    nb_ao_par_semaine: number;
    moy_cv_par_ao: number | null;
}

export interface SourcingKpis {
    nb_cv_positionnes: number;
    taux_cv_positionnes_par_ao: number | null;
    moy_cv_par_signature: number | null;
    taux_cv_to_interview_real: number | null;
    avg_days_cv_to_interview: number | null;
    cohort_match_pct: number;
}

export interface EntretiensKpis {
    nb_entretiens: number;
    moy_entretien_par_ao: number | null;
}

export interface CommercialEntry {
    name: string;
    nb_appels: number;
    nb_cv: number;
    nb_cv_ressources: number;   // internal consultant repositioned
    nb_cv_candidats: number;    // external candidate submitted
    nb_entretiens: number;
    nb_rdv_suivi: number;       // client follow-up meetings (=nb_entretiens)
    nb_signatures: number;
    nb_ao_traites: number;
    nb_ao_ouverts: number;
    nb_ao_clos: number;
    taux_conversion: number | null;
    volume_par_semaine: number;
    sourcing_score?: number;
    closing_score?: number;
}

export interface CommercialKpisResponse {
    period: Period;
    activite: ActiviteKpis;
    sourcing: SourcingKpis;
    entretiens: EntretiensKpis;
    conversion: ConversionKpis;
    performance: PerformanceKpis;
    sourcing_ranking: CommercialEntry[];
    closing_ranking: CommercialEntry[];
    commerciaux?: CommercialEntry[];
}

/**
 * GET /kpis/commercial
 * Returns all commercial KPIs (conversion, performance, leaderboard).
 */
export const getCommercialKpis = async (
    startDate: string,
    endDate: string
): Promise<CommercialKpisResponse> => {
    const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
    });
    const { data } = await apiClient.get<CommercialKpisResponse & { success: boolean }>(
        `/kpis/commercial?${params.toString()}`
    );
    return data;
};

