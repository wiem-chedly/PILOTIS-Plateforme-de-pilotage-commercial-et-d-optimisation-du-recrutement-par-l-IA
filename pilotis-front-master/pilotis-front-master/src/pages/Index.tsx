import { useEffect, useState } from "react";
import { Target, TrendingUp, FileText, PenTool } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import KPICard from "@/components/KPICard";
import MonthlyEvolutionChart from "@/components/charts/MonthlyEvolutionChart";
import ClientDistributionChart from "@/components/charts/ClientDistributionChart";


import RecentActivities from "@/components/RecentActivities";

const Index = () => {
  // KPI values — updated dynamically from the API
  const [kpis, setKpis] = useState({
    totalOpportunities: 0,
    activeAO: 0,
    conversionRate: 0,
    signedContracts: 0,
  });

  // Trend percentages — 100% dynamic from /kpis/commercial trends
  const [trends, setTrends] = useState({
    totalOpportunities: { value: 0, up: true },
    conversionRate: { value: 0, up: true },
    signedContracts: { value: 0, up: true },
    activeAO: { value: 0, up: true },
  });

  useEffect(() => {
    // 1. Fetch Commercial KPIs — values + trends vs previous month
    fetch("http://localhost:5000/kpis/commercial", { credentials: "include" })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const conv = res.conversion || {};
          const trd = res.trends || {};

          setKpis(prev => ({
            ...prev,
            totalOpportunities: conv.nb_ao ?? prev.totalOpportunities,
            conversionRate: conv.taux_signature_ao != null
              ? Math.round(conv.taux_signature_ao * 100)
              : prev.conversionRate,
            signedContracts: conv.nb_signatures ?? prev.signedContracts,
          }));

          // Wire the dynamic trend percentages returned by the API
          setTrends(prev => ({
            ...prev,
            totalOpportunities: {
              value: trd.nb_ao ?? 0,
              up: (trd.nb_ao ?? 0) >= 0,
            },
            conversionRate: {
              value: Math.abs(trd.taux_signature_ao ?? 0),
              up: (trd.taux_signature_ao ?? 0) >= 0,
            },
            signedContracts: {
              value: trd.nb_signatures ?? 0,
              up: (trd.nb_signatures ?? 0) >= 0,
            },
          }));
        }
      })
      .catch(() => {/* keep default zeros on network error */ });

    // 2. Fetch Appels d'Offres Actifs
    fetch("http://localhost:5000/api/opportunities/cibles", { credentials: "include" })
      .then(r => r.json())
      .then(res => {
        if (res.opportunites) {
          setKpis(prev => ({
            ...prev,
            activeAO: res.opportunites.length
          }));
        }
      })
      .catch(() => { });
  }, []);

  const currentDate = new Date();
  const formattedMonth = currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const displayMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);

  return (
    <DashboardLayout title="Dashboard Commercial">
      {/* Période analysée */}
      <div className="mb-4">
        <p className="text-[13px] font-medium text-slate-500 tracking-wide">
          Période analysée : <span className="font-semibold text-slate-700">{displayMonth}</span>
        </p>
      </div>

      {/* KPI Cards — trends now 100% dynamic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Nombre total d'AO"
          value={kpis.totalOpportunities.toString()}
          trend={Math.abs(trends.totalOpportunities.value)}
          up={trends.totalOpportunities.up}
          icon={Target}
          index={0}
        />
        <KPICard
          title="Taux de Conversion"
          value={`${kpis.conversionRate}%`}
          trend={trends.conversionRate.value}
          trendLabel={`${trends.conversionRate.up ? "+" : "-"}${trends.conversionRate.value} pts`}
          up={trends.conversionRate.up}
          icon={TrendingUp}
          index={1}
        />
        <KPICard
          title="Appels d'Offres Actifs"
          value={kpis.activeAO.toString()}
          trend={Math.abs(trends.activeAO.value)}
          up={trends.activeAO.up}
          icon={FileText}
          index={2}
        />
        <KPICard
          title="Contrats Signés ce mois"
          value={kpis.signedContracts.toString()}
          trend={Math.abs(trends.signedContracts.value)}
          up={trends.signedContracts.up}
          icon={PenTool}
          index={3}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <MonthlyEvolutionChart />
        <ClientDistributionChart />


      </div>

      {/* Recent Activities */}
      <RecentActivities />
    </DashboardLayout>
  );
};

export default Index;
