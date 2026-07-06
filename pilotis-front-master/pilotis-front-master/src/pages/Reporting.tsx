import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  TrendingUp, TrendingDown, Briefcase, RefreshCw, AlertTriangle, BarChart3, Activity
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Metric {
  label: string;
  currentValue: number;
  previousValue: number;
  format: "number" | "currency" | "percent";
  pct: number;
}

interface MonthlyRow {
  month: string;
  currentContrats: number;
  previousContrats: number;
  currentCA: number;
  previousCA: number;
}

interface QuarterRow {
  quarter: string;
  currentContrats: number;
  previousContrats: number;
  currentCA: number;
  previousCA: number;
}

interface TopClient { name: string; value: number; }

interface DashboardData {
  year: number;
  prev_year: number;
  metrics: Metric[];
  monthly_comparison: MonthlyRow[];
  quarterly_comparison: QuarterRow[];
  top_clients: TopClient[];
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
  .rep-root * { font-family: 'IBM Plex Sans', sans-serif; box-sizing: border-box; }
  .rep-root .fd { font-family: 'Plus Jakarta Sans', sans-serif; }
  @keyframes rep-fadein { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .rep-animate { animation: rep-fadein 0.4s ease both; }
  .rep-kpi-card {
    background: #ffffff; border: 1px solid #e8edf3; border-radius: 14px;
    padding: 24px 28px; display: flex; flex-direction: column; gap: 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04); transition: box-shadow 0.2s;
  }
  .rep-kpi-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
  .rep-section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 16px;
    display: flex; align-items: center; gap: 8px;
  }
  .rep-table { width: 100%; border-collapse: collapse; }
  .rep-table th {
    padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px; color: #9CA3AF;
    background: #FAFBFC; border-bottom: 1px solid #EDF0F5;
  }
  .rep-table td {
    padding: 12px 14px; font-size: 13px; color: #374151;
    border-bottom: 1px solid #F3F5F8; vertical-align: middle;
  }
  .rep-table tbody tr:hover { background: #FAFBFF; }
  .rep-table tbody tr:last-child td { border-bottom: none; }
  .rep-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 20px; font-size: 12px; font-weight: 600;
  }
  .rep-badge-up   { background: #ecfdf5; color: #047857; }
  .rep-badge-down { background: #fef2f2; color: #b91c1c; }
  .rep-spinner {
    display: flex; align-items: center; justify-content: center; min-height: 300px;
  }
`;

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

const formatVal = (v: number, fmt: "number" | "currency" | "percent") => {
  if (fmt === "currency") return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  if (fmt === "percent") return `${v}%`;
  return v.toLocaleString("fr-FR");
};

const Spinner = () => (
  <div className="rep-spinner">
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 42, height: 42, border: "3px solid #bfdbfe", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "rep-spin 0.8s linear infinite", margin: "0 auto" }} />
      <p style={{ color: "#94a3b8", marginTop: 13, fontSize: 12 }}>Chargement des données…</p>
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const Reporting = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [prevYear, setPrevYear] = useState(now.getFullYear() - 1);
  const [chartMode, setChartMode] = useState<"ca" | "contrats">("ca");
  const [viewMode, setViewMode] = useState<"mois" | "trimestre">("mois");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `http://localhost:5000/api/reporting/dashboard?year=${year}&prev_year=${prevYear}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Erreur inconnue");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year, prevYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = viewMode === "trimestre"
    ? data?.quarterly_comparison ?? []
    : data?.monthly_comparison ?? [];

  const xKey = viewMode === "trimestre" ? "quarter" : "month";
  const currKey = chartMode === "ca" ? "currentCA" : "currentContrats";
  const prevKey = chartMode === "ca" ? "previousCA" : "previousContrats";

  return (
    <DashboardLayout title="Reporting Financier">
      <style>{css}</style>
      <style>{`@keyframes rep-spin { to { transform: rotate(360deg); } }`}</style>
      <div className="rep-root" style={{ padding: "0 0 40px" }}>

        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 5, height: 38, borderRadius: 4, background: "linear-gradient(180deg,#2563eb,#3b82f6)", flexShrink: 0 }} />
            <div>
              <h1 className="fd" style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>Reporting N vs N-1</h1>
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Analyse financière et contrats signés
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "6px 12px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <label style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Année N :</label>
              <select
                value={year}
                onChange={e => { setYear(Number(e.target.value)); setPrevYear(Number(e.target.value) - 1); }}
                style={{ height: 30, padding: "0 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", outline: "none", fontWeight: 500 }}
              >
                {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              style={{ height: 44, padding: "0 18px", borderRadius: 10, border: "none", background: "#0f172a", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#fff", fontWeight: 600, transition: "background 0.2s" }}
              onMouseOver={e => e.currentTarget.style.background = "#1e293b"}
              onMouseOut={e => e.currentTarget.style.background = "#0f172a"}
            >
              <RefreshCw style={{ width: 15, height: 15, ...(loading ? { animation: "rep-spin 1s linear infinite" } : {}) }} />
              Actualiser
            </button>
          </div>
        </div>

        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "24px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <AlertTriangle style={{ width: 20, height: 20, color: "#dc2626", flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, color: "#dc2626", fontSize: 13 }}>Erreur de chargement</p>
              <p style={{ color: "#7f1d1d", fontSize: 12, marginTop: 3 }}>{error}</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* ── MÉTRIQUES N vs N-1 ────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 36 }}>
              {data.metrics.map((m, i) => {
                const isUp = m.pct >= 0;
                return (
                  <div key={i} className="rep-animate rep-kpi-card" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: i === 0 ? "#eff6ff" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? "#2563eb" : "#059669" }}>
                          <Briefcase style={{ width: 20, height: 20 }} />
                        </div>
                        <p style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>{m.label}</p>
                      </div>
                      <span className={`rep-badge ${isUp ? "rep-badge-up" : "rep-badge-down"}`} style={{ fontSize: 13, padding: "4px 10px" }}>
                        {isUp ? <TrendingUp style={{ width: 14, height: 14 }} /> : <TrendingDown style={{ width: 14, height: 14 }} />}
                        {isUp ? "+" : ""}{m.pct}%
                      </span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <p className="fd" style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", letterSpacing: "-1px" }}>
                        {formatVal(m.currentValue, m.format)}
                      </p>
                      <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 500 }}>
                        Année N-1 ({prevYear}) : <span style={{ color: "#0f172a" }}>{formatVal(m.previousValue, m.format)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── GRAPHIQUES ────────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
              <p className="rep-section-title" style={{ margin: 0 }}>
                <Activity style={{ width: 14, height: 14 }} />
                Analyse Évolutive
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
                  {(["mois", "trimestre"] as const).map(v => (
                    <button key={v} onClick={() => setViewMode(v)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: viewMode === v ? "#fff" : "transparent", color: viewMode === v ? "#0f172a" : "#64748b", boxShadow: viewMode === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s" }}>
                      {v === "mois" ? "Mensuel" : "Trimestriel"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
                  {(["ca", "contrats"] as const).map(v => (
                    <button key={v} onClick={() => setChartMode(v)} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: chartMode === v ? "#fff" : "transparent", color: chartMode === v ? "#0f172a" : "#64748b", boxShadow: chartMode === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.2s" }}>
                      {v === "ca" ? "Chiffre d'Affaires" : "Contrats Signés"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 36 }}>
              {/* Bar chart */}
              <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                <p className="fd" style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>
                  Volume {chartMode === "ca" ? "(€)" : "(Qté)"} — {year} vs {prevYear}
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dx={-10} tickFormatter={(val) => chartMode === "ca" ? `${val / 1000}k` : val} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", fontSize: 13, fontWeight: 500 }} cursor={{ fill: "#f8fafc" }} formatter={(value: number) => chartMode === "ca" ? formatVal(value, "currency") : value} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="circle" />
                    <Bar dataKey={currKey} name={`${chartMode === "ca" ? "CA" : "Contrats"} ${year}`} fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={prevKey} name={`${chartMode === "ca" ? "CA" : "Contrats"} ${prevYear}`} fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart */}
              <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                <p className="fd" style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>
                  Courbe de tendance
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dx={-10} tickFormatter={(val) => chartMode === "ca" ? `${val / 1000}k` : val} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)", fontSize: 13, fontWeight: 500 }} formatter={(value: number) => chartMode === "ca" ? formatVal(value, "currency") : value} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} iconType="plainline" />
                    <Line type="monotone" dataKey={currKey} name={String(year)} stroke="#2563eb" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey={prevKey} name={String(prevYear)} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── TABLEAU & TOP CLIENTS ─────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>

              {/* Tableau Détaillé */}
              <div>
                <p className="rep-section-title">
                  <BarChart3 style={{ width: 14, height: 14 }} />
                  Tableau Analytique Comparatif
                </p>
                <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Période</th>
                        <th>CA {year}</th>
                        <th>CA {prevYear}</th>
                        <th>Évol. CA</th>
                        <th>Contrats {year}</th>
                        <th>Contrats {prevYear}</th>
                        <th>Évol. Cts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewMode === "trimestre" ? data.quarterly_comparison : data.monthly_comparison).map((row: any) => {
                        const caDiff = row.previousCA > 0
                          ? ((row.currentCA - row.previousCA) / row.previousCA * 100).toFixed(1)
                          : row.currentCA > 0 ? "100" : "0";
                        const cDiff = row.previousContrats > 0
                          ? ((row.currentContrats - row.previousContrats) / row.previousContrats * 100).toFixed(1)
                          : row.currentContrats > 0 ? "100" : "0";
                        const caUp = row.currentCA >= row.previousCA;
                        const cUp = row.currentContrats >= row.previousContrats;
                        const period = row.month ?? row.quarter;
                        return (
                          <tr key={period}>
                            <td style={{ fontWeight: 700, color: "#0f172a" }}>{period}</td>
                            <td className="fd" style={{ fontWeight: 600 }}>{formatVal(row.currentCA, "currency")}</td>
                            <td style={{ color: "#64748b" }}>{formatVal(row.previousCA, "currency")}</td>
                            <td>
                              <span className={`rep-badge ${caUp ? "rep-badge-up" : "rep-badge-down"}`} style={{ fontSize: 11 }}>
                                {caUp ? "+" : ""}{caDiff}%
                              </span>
                            </td>
                            <td className="fd" style={{ fontWeight: 600 }}>{row.currentContrats}</td>
                            <td style={{ color: "#64748b" }}>{row.previousContrats}</td>
                            <td>
                              <span className={`rep-badge ${cUp ? "rep-badge-up" : "rep-badge-down"}`} style={{ fontSize: 11 }}>
                                {cUp ? "+" : ""}{cDiff}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Clients */}
              <div>
                <p className="rep-section-title">
                  <Activity style={{ width: 14, height: 14 }} />
                  Top Clients ({year})
                </p>
                <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 14, padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}>
                  <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                    Classement par nombre de contrats signés
                  </p>
                  {data.top_clients.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>Aucun contrat signé en {year}</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {data.top_clients.map((c, i) => {
                        const maxV = data.top_clients[0]?.value || 1;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: i < 3 ? "#eff6ff" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: i < 3 ? "#2563eb" : "#64748b", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {i + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                                <span className="fd" style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{c.value}</span>
                              </div>
                              <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9" }}>
                                <div style={{ height: "100%", borderRadius: 3, background: i < 3 ? "#3b82f6" : "#cbd5e1", width: `${Math.round(c.value / maxV * 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default Reporting;
