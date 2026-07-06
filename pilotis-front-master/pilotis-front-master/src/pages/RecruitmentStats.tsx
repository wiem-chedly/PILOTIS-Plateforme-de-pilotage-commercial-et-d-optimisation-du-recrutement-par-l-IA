import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
  AreaChart, Area
} from "recharts";
import {
  Users, Target, CheckCircle2, CalendarCheck, Activity,
  TrendingUp, Linkedin, Briefcase, Award, ArrowUpRight,
  BarChart2, Zap, Filter, ArrowDownRight, MapPin, Mail,
  Search, FileText, FileCheck, XCircle
} from "lucide-react";

// ── Palette charts ────────────────────────────────────────────────────────────
const C = {
  violet: "#7c3aed", blue: "#1d4ed8", cyan: "#0891b2",
  green:  "#059669",  amber: "#d97706", rose: "#e11d48",
  sky:    "#0284c7",  indigo: "#4338ca", slate: "#64748b"
};
const CHART_COLORS = [C.violet, C.blue, C.cyan, C.green, C.amber, C.rose, C.sky, C.slate];

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white p-3 shadow-xl text-sm">
      {label && <p className="font-semibold mb-1 text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full inline-block" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KPICard = ({
  icon: Icon, label, value, sub, color, trend
}: {
  icon: any; label: string; value: string | number;
  sub?: React.ReactNode; color: string; trend?: number;
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }} />
    <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity" style={{ background: color }} />

    <div className="flex items-start justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      {trend !== undefined && (
        <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-lg ${
          trend >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        }`}>
          {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>

    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  </div>
);

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, sub, color }: any) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

// ── Card wrapper ──────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-border bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
    {children}
  </div>
);

// ── Funnel bar ────────────────────────────────────────────────────────────────
const FunnelBar = ({ name, value, max, color, pct }: any) => {
  const width = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-40 text-xs text-muted-foreground text-right shrink-0 group-hover:text-foreground transition-colors font-medium">
        {name}
      </div>
      <div className="flex-1 h-9 rounded-xl bg-muted/50 overflow-hidden">
        <div
          className="h-full rounded-xl flex items-center px-3 transition-all duration-700 ease-out"
          style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}bb, ${color})` }}
        >
          <span className="text-white text-xs font-bold">{value}</span>
        </div>
      </div>
      <div className="w-10 text-xs text-muted-foreground text-right shrink-0 font-mono">
        {pct}%
      </div>
    </div>
  );
};

// ── Metric pill ───────────────────────────────────────────────────────────────
const MetricPill = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-4 text-center hover:border-current/30 transition-colors">
    <span className="text-2xl font-bold" style={{ color }}>{value}</span>
    <span className="text-xs text-muted-foreground mt-1 leading-tight">{label}</span>
  </div>
);

export default function RecruitmentStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/stats/recruitment/", { credentials: "omit" })
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <DashboardLayout title="Statistiques de Recrutement">
      <div className="flex h-[55vh] items-center justify-center flex-col gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Chargement des statistiques globales...</p>
      </div>
    </DashboardLayout>
  );

  if (!data) return (
    <DashboardLayout title="Statistiques de Recrutement">
      <div className="flex h-[40vh] items-center justify-center flex-col gap-3">
        <BarChart2 className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Impossible de charger les statistiques.</p>
      </div>
    </DashboardLayout>
  );

  const { global_kpis, sourcing, matching, interviews, aos, funnel, scatter } = data;
  const maxFunnel = funnel?.[0]?.value || 1;

  const formatCurrency = (val: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);

  return (
    <DashboardLayout title="Tableau de Bord Recrutement">
      <div className="space-y-8 pb-10">
        
        {/* HEADER */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-4 w-1 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Vue à 360°</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Analytics Global du Recrutement</h1>
          <p className="text-muted-foreground text-sm mt-1">Supervisez toute votre activité, de la source du candidat jusqu'au closing de l'Appel d'Offre.</p>
        </div>

        {/* ── ROW 1: KPIs Principaux ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Users} label="Candidats Total" value={global_kpis.total_candidates} color={C.violet} sub={
            <span className="flex items-center gap-2 mt-1">
              <Linkedin className="h-3 w-3 text-blue-600" /> {global_kpis.linkedin_candidates} 
              <Mail className="h-3 w-3 text-red-500 ml-2" /> {global_kpis.email_candidates}
            </span>
          } />
          <KPICard icon={Briefcase} label="AOs Actifs" value={global_kpis.total_aos} color={C.amber} sub={
            <span className="flex flex-col">
              <span>Valeur Pipe: {formatCurrency(global_kpis.pipeline_value)}</span>
              <span className="text-xs opacity-75 mt-0.5">Dernière semaine statut 0-25%</span>
            </span>
          } />
          <KPICard icon={Search} label="Profils Recherchés" value={global_kpis.active_profiles} color={C.sky} sub={`Sur ${global_kpis.total_profiles} profils créés`} />
          <KPICard icon={CalendarCheck} label="Entretiens Confirmés" value={global_kpis.interviews_confirmed} color={C.green} sub={`Taux de complétion: ${global_kpis.quiz_completion_rate}%`} />
        </div>

        {/* ── ROW 2: KPIs IA & Sourcing ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Target} label="Score IA Moyen" value={`${global_kpis.avg_match_score}%`} color={C.blue} sub={`Précision IA: ${global_kpis.ai_accuracy_pct}%`} />
          <KPICard icon={FileCheck} label="Candidatures (AOs)" value={global_kpis.total_applications} color={C.cyan} sub="Candidatures liées à un AO" />
          <KPICard icon={Zap} label="Score Moyen Matching AOs" value={`${matching.avg_top_match}%`} color={C.violet} sub="Moyenne des meilleurs matchs par offre" />
          <KPICard icon={Linkedin} label="Interactions LinkedIn" value={global_kpis.total_linkedin_engagements} color="#0077b5" sub={`Taux de conversion: ${global_kpis.linkedin_conversion_rate}%`} />
        </div>

        {/* ── Entonnoir de Conversion Principal ── */}
        <Card className="border border-indigo-100 bg-indigo-50/20">
          <SectionHeader icon={Filter} title="Entonnoir de Conversion Global" sub="De l'acquisition du candidat à l'entretien validé" color={C.indigo} />
          <div className="space-y-3 px-2 py-4">
            {funnel?.map((step: any, i: number) => (
              <FunnelBar
                key={step.name}
                name={step.name}
                value={step.value}
                max={maxFunnel}
                color={CHART_COLORS[i % CHART_COLORS.length]}
                pct={maxFunnel > 0 ? Math.round((step.value / maxFunnel) * 100) : 0}
              />
            ))}
          </div>
        </Card>

        {/* ── GRAPHIQUES : ÉVOLUTION ET SOURCING ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <SectionHeader icon={TrendingUp} title="Évolution de l'Acquisition" sub="Candidats ajoutés (6 derniers mois)" color={C.blue} />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sourcing.monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.blue} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{fill: "#6b7280", fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill: "#6b7280", fontSize: 12}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" name="Candidats" stroke={C.blue} strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={MapPin} title="Répartition par Localisation" sub="Top 7 des localisations" color={C.rose} />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourcing.by_location} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{fill: "#374151", fontSize: 12, fontWeight: 500}} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: "#f3f4f6"}} />
                  <Bar dataKey="value" name="Candidats" radius={[0, 4, 4, 0]} barSize={24}>
                    {sourcing.by_location.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── GRAPHIQUES : RÉPARTITIONS EN CAMEMBERTS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <SectionHeader icon={Briefcase} title="Appels d'Offres (Statut)" sub="Répartition du pipeline" color={C.amber} />
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={aos.by_status} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {aos.by_status.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={FileText} title="Candidatures (AOs)" sub="Statut des candidatures rattachées" color={C.cyan} />
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={matching.applications_status_chart} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {matching.applications_status_chart.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={Activity} title="Entretiens IA (Quiz)" sub="Avancement du processus" color={C.violet} />
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={interviews.status_chart} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {interviews.status_chart.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── GRAPHIQUES : ANALYSE DÉTAILLÉE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <SectionHeader icon={Award} title="Score IA Moyen par Source" sub="D'où viennent les meilleurs candidats ?" color={C.green} />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourcing.quality} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{fill: "#6b7280", fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{fill: "#6b7280", fontSize: 12}} axisLine={false} tickLine={false} unit="%" />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: "#f3f4f6"}} />
                  <Bar dataKey="avgScore" name="Score IA Moyen" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {sourcing.quality.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <SectionHeader icon={Target} title="Matrice : IA vs Évaluation Humaine" sub="Corrélation entre Match IA et Résultat du Quiz" color={C.indigo} />
            <div className="h-64">
              {scatter?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" dataKey="aiScore" name="Score IA" unit="%" domain={[0, 100]} tick={{fill: "#6b7280", fontSize: 12}} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="quizScore" name="Score Quiz" unit="%" domain={[0, 100]} tick={{fill: "#6b7280", fontSize: 12}} axisLine={false} tickLine={false} />
                    <ZAxis range={[60, 60]} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{strokeDasharray: "3 3"}} />
                    <Scatter name="Candidat" data={scatter} fill={C.indigo} opacity={0.6} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center flex-col gap-2">
                  <Target className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-muted-foreground text-sm">Pas encore assez de données d'entretiens</p>
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
