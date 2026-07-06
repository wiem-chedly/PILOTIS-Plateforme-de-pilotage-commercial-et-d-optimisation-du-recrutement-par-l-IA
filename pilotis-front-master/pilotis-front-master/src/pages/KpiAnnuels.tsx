import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getKpiAnnuels, AnnualKpiResponse } from "@/services/hebdoService";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const formatCA = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const KpiAnnuels = () => {
  const [data, setData] = useState<AnnualKpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getKpiAnnuels()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="KPI Annuels">
        <div className="p-8 flex justify-center text-muted-foreground">Chargement des KPIs...</div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="KPI Annuels">
        <div className="p-8 flex justify-center text-red-500">Erreur lors du chargement des KPIs.</div>
      </DashboardLayout>
    );
  }

  const comparisonData = data.sales.map((k) => ({
    name: k.name.split(" ")[0], // Show first name in chart for space
    "Réalisé (k€)": Math.round(k.ca.realise / 1000),
    "Objectif (k€)": Math.round(k.ca.objectif / 1000),
  }));

  return (
    <DashboardLayout title={`KPI Annuels ${data.year}`}>
      <div className="space-y-6">
        {/* Per sales progress */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.sales.map((k) => {
            const pctPos = k.positionnements.objectif > 0 ? Math.round((k.positionnements.realise / k.positionnements.objectif) * 100) : 0;
            const pctEnt = k.entretiens.objectif > 0 ? Math.round((k.entretiens.realise / k.entretiens.objectif) * 100) : 0;
            const pctSign = k.signatures.objectif > 0 ? Math.round((k.signatures.realise / k.signatures.objectif) * 100) : 0;
            const pctCA = k.ca.objectif > 0 ? Math.round((k.ca.realise / k.ca.objectif) * 100) : 0;

            return (
              <Card key={k.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{k.name}</CardTitle>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      TACI: {k.taci}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MetricRow label="Positionnements" realized={k.positionnements.realise} target={k.positionnements.objectif} pct={pctPos} />
                  <MetricRow label="Entretiens" realized={k.entretiens.realise} target={k.entretiens.objectif} pct={pctEnt} />
                  <MetricRow label="Signatures" realized={k.signatures.realise} target={k.signatures.objectif} pct={pctSign} />
                  <MetricRow label="CA" realized={formatCA(k.ca.realise)} target={formatCA(k.ca.objectif)} pct={pctCA} />
                  
                  <div className="pt-2 border-t mt-3">
                    <p className="text-xs text-muted-foreground flex items-center mb-1">
                      <span className="w-32 inline-block">Projection fin an :</span>
                      <span className="font-medium text-foreground">{formatCA(k.projection_fin_annee)}</span>
                    </p>
                    <p className="text-xs font-medium">
                      {k.statut_projection === 'en_bonne_voie'
                        ? <span className="text-emerald-600 flex items-center gap-1">✓ En bonne voie</span>
                        : <span className="text-amber-600 flex items-center gap-1">⚠ Sous l'objectif</span>}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparison chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Comparatif CA — Réalisé vs Objectif</CardTitle></CardHeader>
          <CardContent>
            {comparisonData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => `${v} k€`} />
                    <Legend />
                    <Bar dataKey="Réalisé (k€)" fill="hsl(224 80% 40%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Objectif (k€)" fill="hsl(213 94% 68%)" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex justify-center p-8 text-muted-foreground">Aucune donnée disponible.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

const MetricRow = ({ label, realized, target, pct }: { label: string; realized: string | number; target: string | number; pct: number }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-muted-foreground">{label}</span>
      <span><span className="font-medium">{realized}</span> / {target} <span className="text-muted-foreground">({pct}%)</span></span>
    </div>
    <Progress value={Math.min(pct, 100)} className="h-2" />
  </div>
);

export default KpiAnnuels;
