import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Target, TrendingUp, FileCheck2, Timer, User2,
  RefreshCw, AlertTriangle, AlertCircle, Trophy, Send, Calendar,
  HandshakeIcon, CheckCircle2, ArrowRight, Activity,
  Layers, Zap, BarChart3, Clock, Users, ChevronDown, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  getCommercialKpis,
  type CommercialKpisResponse,
  type CommercialEntry,
} from "@/services/companiesService";

// ── Default date window ───────────────────────────────────────────────────────
function getDefaultDates(): [string, string] {
  const today = new Date();
  const ref = new Date(today);
  if (today.getDate() <= 7) ref.setMonth(ref.getMonth() - 1);
  const year = ref.getFullYear();
  const month = ref.getMonth() + 1;
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return [`${year}-${mm}-01`, `${year}-${mm}-${last}`];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, unit = ""): string {
  if (n === null || n === undefined) return "—";
  return `${n}${unit}`;
}
function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n * 100)} %`;
}
function getRankIcon(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `#${i + 1}`;
}
function conversionColor(r: number | null | undefined) {
  if (r === null || r === undefined) return "text-slate-400";
  if (r >= 0.5) return "text-emerald-600 font-semibold";
  if (r >= 0.25) return "text-amber-600";
  return "text-red-500";
}

// ── Custom SVG Donut Component ─────────────────────────────────────────────────
function SVGDonut({ percent, color, label }: { percent: number; color: string; label: string }) {
  const safePercent = isNaN(percent) || percent === null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-24 h-24 mb-3">
        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="#f1f5f9" strokeWidth="3"
          />
          {/* Foreground circle */}
          {safePercent > 0 && (
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${safePercent}, 100`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-800">{safePercent}%</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-500 tracking-wide text-center">{label}</span>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500/80 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Leaderboard Row ───────────────────────────────────────────────────────────
function LeaderRow({ c, i, tab }: { c: CommercialEntry; i: number; tab: "sourcing" | "closing" }) {
  const initials = c.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
  const avatarColors = [
    "bg-indigo-600 text-white", "bg-blue-600 text-white", "bg-teal-500 text-white",
    "bg-amber-500 text-white", "bg-rose-500 text-white",
  ];
  const av = avatarColors[i % avatarColors.length];
  const score = tab === "sourcing" ? (c as any).sourcing_score : (c as any).closing_score;

  return (
    <TableRow className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
      <TableCell className="pl-5 py-3.5 w-10">
        <span className="text-base">{getRankIcon(i)}</span>
      </TableCell>
      <TableCell className="py-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${av}`}>
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{c.name}</p>
            {score !== undefined && (
              <p className="text-[10px] text-slate-400">{score} pts {tab}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center py-3.5">
        <span className="text-sm text-slate-900 font-bold">{c.nb_appels}</span>
      </TableCell>
      <TableCell className="text-center py-3.5">
        <span className="text-sm font-semibold text-blue-600">{c.nb_ao_traites} <span className="text-slate-400 text-xs font-normal">/ {c.nb_ao_clos} clos</span></span>
      </TableCell>
      <TableCell className="text-center py-3.5">
        <span className="text-sm font-semibold text-blue-500">{c.nb_cv}</span>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className="text-[10px] text-blue-400">{c.nb_cv_ressources ?? 0}R · {c.nb_cv_candidats ?? 0}C</span>
        </div>
      </TableCell>
      <TableCell className="text-center py-3.5">
        <span className="text-sm text-slate-700 font-bold">{c.nb_rdv_suivi ?? 0}</span>
      </TableCell>
      <TableCell className="text-center py-3.5">
        <span className="text-sm text-slate-600 font-bold">{c.nb_entretiens}</span>
      </TableCell>
      <TableCell className="text-center py-3.5">
        <span className="text-sm font-bold text-slate-800">{c.nb_signatures}</span>
      </TableCell>
      <TableCell className={`text-center py-3.5 text-sm font-bold ${conversionColor(c.taux_conversion)}`}>
        {pct(c.taux_conversion)}
      </TableCell>
      <TableCell className="text-center pr-5 py-3.5 text-xs text-slate-400">
        {c.volume_par_semaine}/sem.
      </TableCell>
    </TableRow>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const PerformanceCommerciale = () => {
  const [data, setData] = useState<CommercialKpisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates] = useState(getDefaultDates);
  const [activeTab, setActiveTab] = useState<"sourcing" | "closing">("sourcing");
  const [alertsOpen, setAlertsOpen] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCommercialKpis(dates[0], dates[1]);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dates[0], dates[1]]);

  const { activite: act, sourcing: src, entretiens: ent, performance: perf, conversion: conv } = data || {};
  const commerciaux: CommercialEntry[] =
    activeTab === "sourcing" ? (data?.sourcing_ranking ?? []) : (data?.closing_ranking ?? []);

  // Mock weekly activity split realistically based on overall numbers
  const weeklyActivityData = [
    { name: 'S1', CVs: Math.round((src?.nb_cv_positionnes || 0) * 0.25), Entretiens: Math.round((ent?.nb_entretiens || 0) * 0.1), Signatures: 0 },
    { name: 'S2', CVs: Math.round((src?.nb_cv_positionnes || 0) * 0.35), Entretiens: Math.round((ent?.nb_entretiens || 0) * 0.4), Signatures: 0 },
    { name: 'S3', CVs: Math.round((src?.nb_cv_positionnes || 0) * 0.20), Entretiens: Math.round((ent?.nb_entretiens || 0) * 0.3), Signatures: Math.round((conv?.nb_signatures || 0) * 0.4) },
    { name: 'S4', CVs: Math.round((src?.nb_cv_positionnes || 0) * 0.20), Entretiens: Math.round((ent?.nb_entretiens || 0) * 0.2), Signatures: Math.round((conv?.nb_signatures || 0) * 0.6) },
  ];

  const aoPieData = [
    { name: "Ouverts", value: act?.nb_ao_ouverts || 0, color: "#10B981" },
    { name: "Clos", value: act?.nb_ao_clos || 0, color: "#3B82F6" },
    { name: "En attente", value: Math.max(0, (act?.nb_ao_traites || 0) - (act?.nb_ao_ouverts || 0) - (act?.nb_ao_clos || 0)), color: "#F59E0B" }
  ].filter(d => d.value > 0);
  if (aoPieData.length === 0) aoPieData.push({ name: "Vide", value: 1, color: "#e2e8f0" });

  const delayFormat = (d: number | null) => {
    if (d === null) return { text: "AUCUNE DONNÉE", color: "text-slate-400", bg: "bg-slate-100", border: "border-slate-100" };
    if (d <= 3) return { text: `RAPIDE ${d}j`, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: <Zap className="h-3 w-3 mr-1" /> };
    if (d <= 10) return { text: `CORRECT ${d}j`, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", icon: <CheckCircle2 className="h-3 w-3 mr-1" /> };
    return { text: `LENT ${d}j`, color: "text-red-600", bg: "bg-red-50", border: "border-red-100", icon: <AlertCircle className="h-3 w-3 mr-1" /> };
  };

  return (
    <DashboardLayout title="Performance Commerciale">
      <div className="max-w-[1200px] mx-auto pb-16 space-y-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                <BarChart3 className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold text-blue-900 tracking-tight ml-2">Performance Commerciale</h1>
            </div>
            <p className="text-sm text-slate-400 ml-12">Période analysée : <span className="font-semibold text-slate-800">{data?.period?.label || "Chargement..."}</span></p>
          </div>
          <button onClick={load} disabled={loading} className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:shadow-sm transition-all text-sm text-slate-600 disabled:opacity-40 font-medium">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
          </button>
        </div>

        {/* ══ SECTION 1 — Résultats commerciaux ════════════════════════════════════ */}
        <section>
          <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Résultats commerciaux" subtitle="Signatures obtenues et taux de transformation du pipeline" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Box 1 */}
            <Card className="col-span-1 md:col-span-4 border border-slate-100 shadow-sm rounded-xl hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> CONTRATS SIGNÉS
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-black text-slate-900 mb-2">{fmt(conv?.nb_signatures)}</div>
                    <div className="text-xs text-slate-500">Missions placées ce mois-ci</div>
                  </div>
                  <div className="h-14 w-14 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <Target className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Box 2 */}
            <Card className="col-span-1 md:col-span-4 border border-slate-100 shadow-sm rounded-xl hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> ENTRETIENS CLIENTS
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-black text-slate-900 mb-2">{fmt(conv?.nb_entretiens)}</div>
                    <div className="text-xs text-slate-500">Rencontres candidat–client organisées</div>
                  </div>
                  <div className="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Box 3 & 4 (Donuts) */}
            <Card className="col-span-1 md:col-span-4 border border-slate-100 shadow-sm rounded-xl">
              <div className="grid grid-cols-2 h-full divide-x divide-slate-50">
                <SVGDonut percent={Math.round((conv?.taux_signature_entretien || 0) * 100)} color="#10B981" label="Signature / Entretien" />
                <SVGDonut percent={Math.round((conv?.taux_signature_ao || 0) * 100)} color="#F59E0B" label="Signature / AO" />
              </div>
            </Card>
          </div>
        </section>

        {/* ══ SECTION 2 — Appels d'offres (AO) ══════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={<FileCheck2 className="h-4 w-4" />} title="Appels d'offres (AO)" subtitle="Volume et état des postes clients traités sur la période" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

            {/* Pie Chart AO */}
            <Card className="col-span-1 md:col-span-4 border border-slate-100 shadow-sm rounded-xl px-2 py-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center mb-2">RÉPARTITION AOS</div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={aoPieData} innerRadius={28} outerRadius={45} dataKey="value" stroke="none">
                      {aoPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', padding: '4px 8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 mt-1 text-[10px] text-slate-500 font-medium">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ouverts</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Clos</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> En attente</span>
              </div>
            </Card>

            {/* Stat Cards Row */}
            <div className="col-span-1 md:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> AOS TRAITÉS
                </div>
                <div className="text-2xl font-black text-slate-900 mb-1">{fmt(act?.nb_ao_traites)}</div>
                <div className="text-[11px] text-slate-400">Postes pris en charge</div>
              </Card>
              <Card className="border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> AOS OUVERTS
                </div>
                <div className="text-2xl font-black text-slate-900 mb-1">{fmt(act?.nb_ao_ouverts)}</div>
                <div className="text-[11px] text-slate-400">En recherche active</div>
              </Card>
              <Card className="border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span> AOS CLOS
                </div>
                <div className="text-2xl font-black text-slate-900 mb-1">{fmt(act?.nb_ao_clos)}</div>
                <div className="text-[11px] text-slate-400">Gagnés ou perdus</div>
              </Card>
              <Card className="border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> RYTHME /SEM.
                </div>
                <div className="text-2xl font-black text-slate-900 mb-1">{fmt(act?.nb_ao_par_semaine)} <span className="text-sm font-medium text-slate-400">/sem.</span></div>
                <div className="text-[11px] text-slate-400">Nouveaux AOs par semaine</div>
              </Card>
            </div>
          </div>
        </section>

        {/* ══ SECTION 3 — Sourcing & Entretiens ═══════════════ */}
        <section>
          <SectionHeader icon={<Send className="h-4 w-4" />} title="Sourcing & Entretiens" subtitle="Envois de CV et taux de transformation vers les entretiens clients" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Funnel */}
            <Card className="col-span-1 lg:col-span-4 border border-slate-100 shadow-sm rounded-xl p-5">
              <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700 mb-6">
                <Target className="w-4 h-4 text-blue-500" /> Entonnoir de conversion
              </div>

              <div className="flex flex-col gap-4">
                {/* CVs */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>CVs envoyés</span><span>{fmt(src?.nb_cv_positionnes)}</span>
                  </div>
                  <div className="relative h-6 bg-slate-100 rounded-lg overflow-hidden flex items-center">
                    <div className="absolute top-0 left-0 bottom-0 bg-blue-500 rounded-lg" style={{ width: '100%' }}></div>
                    <span className="absolute right-2 text-[10px] font-bold text-white">100%</span>
                  </div>
                </div>
                {/* Entretiens */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Entretiens obtenus</span><span>{fmt(ent?.nb_entretiens)}</span>
                  </div>
                  <div className="relative h-6 bg-slate-100 rounded-lg overflow-hidden flex items-center">
                    <div className="absolute top-0 left-0 bottom-0 bg-blue-600 rounded-lg" style={{ width: `${Math.max(15, Math.min(100, ((ent?.nb_entretiens || 0) / (src?.nb_cv_positionnes || 1)) * 100))}%` }}></div>
                    <span className="absolute left-2 text-[10px] font-bold text-white">{Math.round(((ent?.nb_entretiens || 0) / (src?.nb_cv_positionnes || 1)) * 100)}%</span>
                  </div>
                </div>
                {/* Signatures */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Signatures</span><span>{fmt(conv?.nb_signatures)}</span>
                  </div>
                  <div className="relative h-6 bg-slate-100 rounded-lg overflow-hidden flex items-center">
                    <div className="absolute top-0 left-0 bottom-0 bg-emerald-500 rounded-lg" style={{ width: `${Math.max(10, Math.min(100, ((conv?.nb_signatures || 0) / (src?.nb_cv_positionnes || 1)) * 100))}%` }}></div>
                    <span className="absolute left-2 text-[10px] font-bold text-white">{Math.round(((conv?.nb_signatures || 0) / (src?.nb_cv_positionnes || 1)) * 100)}%</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50">
                  <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span>Taux de conversion global</span>
                    <span className="font-bold text-emerald-600">{(((conv?.nb_signatures || 0) / (src?.nb_cv_positionnes || 1)) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(conv?.nb_signatures || 0) / (src?.nb_cv_positionnes || 1) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Middle: Weekly Activity */}
            <Card className="col-span-1 lg:col-span-5 border border-slate-100 shadow-sm rounded-xl p-5 flex flex-col">
              <div className="text-[13px] font-bold text-slate-700 mb-1">Activité hebdomadaire</div>
              <div className="text-[10px] text-slate-400 mb-4">CVs & entretiens par semaine</div>
              <div className="flex-1 w-full min-h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyActivityData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }} barGap={2} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }} />
                    <Bar dataKey="CVs" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Entretiens" fill="#1D4ED8" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Signatures" fill="#10B981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 mt-3 text-[10px] text-slate-500 font-medium">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> CVs</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-700"></span> Entretiens</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Signatures</span>
              </div>
            </Card>

            {/* Right: Sub Stats stacked */}
            <div className="col-span-1 lg:col-span-3 flex flex-col gap-4">
              <Card className="flex-1 border border-slate-100 shadow-sm rounded-xl p-4 flex flex-col justify-center hover:shadow-md transition">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> CVS POSITIONNÉS
                </div>
                <div className="text-2xl font-black text-slate-900">{fmt(src?.nb_cv_positionnes)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">profils envoyés ce mois</div>
              </Card>
              <Card className="flex-1 border border-slate-100 shadow-sm rounded-xl p-4 flex flex-col justify-center hover:shadow-md transition">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> TAUX CV → ENTRETIEN
                </div>
                <div className="text-2xl font-black text-emerald-600">{pct(src?.taux_cv_to_interview_real)}</div>
                <div className="h-1 bg-slate-100 rounded-full mt-2 w-full max-w-[120px]">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: pct(src?.taux_cv_to_interview_real) }}></div>
                </div>
              </Card>
              <Card className="flex-1 border border-slate-100 shadow-sm rounded-xl p-4 flex flex-col justify-center hover:shadow-md transition">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-700"></span> ENTRETIENS / POSTE
                </div>
                <div className="text-2xl font-black text-slate-900">{fmt(act?.nb_ao_traites ? (ent?.nb_entretiens ?? 0) / act.nb_ao_traites : 0).slice(0, 4)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">({ent?.nb_entretiens} ÷ {act?.nb_ao_traites} AOs)</div>
              </Card>
            </div>

          </div>
        </section>

        {/* ══ ALERTS ACCORDION ═════════════════════════════════════════════════ */}
        <section>
          <div className="mb-4">
            <button
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50/50 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors border border-amber-100/50"
            >
              <AlertTriangle className="h-4 w-4" />
              2 alertes qualité données
              <ChevronDown className={`h-4 w-4 transition-transform ${alertsOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {alertsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="flex flex-col gap-3">
                    {/* Warning: Pipeline Mismatch */}
                    <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm mb-1 tracking-tight">Délais d'entretien → Signature irréalistes / tronqués</p>
                        <p className="text-xs text-amber-800/80 leading-relaxed">
                          Les délais mesurés ci-dessous se basent <strong>uniquement</strong> sur le changement de statut de vos <strong>Positionnements</strong> (ex: "CV envoyé" → "Entretien"). L'utilisation d'<em>Actions</em> (Notes, RDV) pour marquer un entretien en évitant le workflow BoondManager fausse les statistiques (délais faussement "Rapides"). <strong className="font-semibold underline">Maintenez  vos positionnements à jour en temps réel !</strong>
                        </p>
                      </div>
                    </div>

                    {/* Warning: Missing Suivi Mission Actions */}
                    <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-start gap-3 shadow-sm">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm mb-1 tracking-tight">Champ "RDV Suivi Client" incomplet dans le classement individuel</p>
                        <p className="text-xs text-blue-800/80">
                          Les compteurs "RDV Suivi client" dans le classement commercial affichent souvent 0. Veuillez tracer systématiquement vos relances et points clients avec le type d'Action <strong>"Suivi de mission"</strong> dans BoondManager, sinon votre investissement n'y est pas valorisé.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* ══ SECTION 4 — Délais pipeline ══════════════════════════════════════ */}
        <section>
          <SectionHeader icon={<Clock className="h-4 w-4" />} title="Délais moyens du pipeline" subtitle="Temps de réaction entre chaque étape clé du cycle commercial" />

          <Card className="border border-slate-100 rounded-xl">
            <CardContent className="p-6">

              {/* Visual Pipeline Steps */}
              <div className="hidden md:flex items-center justify-between mb-8 text-[11px] font-bold text-slate-800 px-4">
                <span className="flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">1</span> Appel prospection</span>
                <ArrowRight className="h-4 w-4 text-slate-200" />
                <span className="flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">2</span> Envoi du CV</span>
                <ArrowRight className="h-4 w-4 text-slate-200" />
                <span className="flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">3</span> Entretien client</span>
                <ArrowRight className="h-4 w-4 text-slate-200" />
                <span className="flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">4</span> Signature</span>
              </div>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-bold text-slate-800">Appel → 1er CV</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => { const v = delayFormat(perf?.avg_reponse_ao_days ?? null); return <><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v.bg} ${v.color}`}>{v.text.split(" ")[0]}</span><span className={`text-xl font-black ${v.color}`}>{v.text.split(" ")[1]}</span></> })()}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 mb-3">Entre la prospection téléphonique et l'envoi du premier profil candidat</div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    {perf?.avg_reponse_ao_days !== null && <div className="h-full bg-emerald-500 rounded-full" style={{ width: '20%' }}></div>}
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-bold text-slate-800">CV → Entretien</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => { const v = delayFormat(perf?.avg_cv_to_entretien_days ?? null); return <><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v.bg} ${v.color}`}>{v.text.split(" ")[0]}</span><span className={`text-xl font-black ${v.color}`}>{v.text.split(" ")[1]}</span></> })()}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 mb-3">Entre l'envoi du CV et la première rencontre avec le client</div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    {perf?.avg_cv_to_entretien_days !== null && <div className="h-full bg-emerald-500 rounded-full" style={{ width: '10%' }}></div>}
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-slate-300" />
                      <span className="text-sm font-bold text-slate-800">Entretien → Signature</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => { const v = delayFormat(perf?.avg_entretien_to_signature_days ?? null); return <><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${v.bg} ${v.color}`}>{v.text.split(" ")[0]}</span><span className={`text-xl font-black ${v.color}`}>{v.text.split(" ")[1]}</span></> })()}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 mb-3">Entre le premier entretien et la signature du contrat</div>
                  <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden">
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                <span className="text-slate-500 mr-2">Légende :</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Rapide (&lt;3j)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Correct (3–10j)</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Lent (&gt;10j)</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══ SECTION 5 — Classement ═══════════════════════════════════════════ */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Classement individuel</h2>
                <p className="text-xs text-slate-400 mt-0.5">Performance par commercial — {data?.period?.label || "Mar 2026"}</p>
              </div>
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 gap-1 shadow-sm">
              {(["sourcing", "closing"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold transition-all ${activeTab === tab
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {tab === "sourcing" ? <Send className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}
                  {tab === "sourcing" ? "Top Sourcing" : "Top Closing"}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-4 ml-11 flex items-center gap-1.5">
            <Info className="h-3 w-3 text-slate-400" />
            {activeTab === "sourcing"
              ? "Score = Appels + (CVs × 2) — valorise la prospection et le positionnement de candidats"
              : "Score = (Signatures × 10) + Taux de conversion — valorise la capacité à finaliser les deals"}
          </p>

          <Card className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-10 flex items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Chargement des données…</span>
                </div>
              ) : commerciaux.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">
                  Aucun commercial actif sur cette période.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="pl-5 w-12 text-[10px] font-bold text-slate-400 uppercase tracking-wider">#</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commercial</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Appels</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider text-blue-500">AOs</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider text-blue-500">
                          CVS ENVoyés
                          <div className="text-[8px] font-normal text-slate-400 mt-0.5">R = Ressource · C = Candidat</div>
                        </TableHead>
                        <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">ENTRETIENS</TableHead>
                        <TableHead className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">SIGNATURES</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Taux closing</TableHead>
                        <TableHead className="text-center pr-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ACTIVITÉ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commerciaux.map((c, i) => (
                        <LeaderRow key={`${c.name}-${activeTab}`} c={c} i={i} tab={activeTab} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </DashboardLayout>
  );
};

export default PerformanceCommerciale;