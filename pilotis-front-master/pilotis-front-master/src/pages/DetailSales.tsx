import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { getSalesDetail, SalesDetail } from "@/services/hebdoService";

const COLORS = ["hsl(224 80% 40%)", "hsl(213 94% 68%)", "hsl(262 80% 50%)", "hsl(142 76% 36%)", "hsl(38 92% 50%)"];
const actionLabels: Record<string, string> = {
  prospection: "Prospection", suivi_mission: "Suivi Mission",
  positionnement: "Positionnement", entretien: "Entretien", signature: "Signature",
};
const categoryBadge: Record<string, string> = {
  recrutement_recent: "bg-blue-100 text-blue-700",
  sortie_prochaine: "bg-amber-100 text-amber-700",
  sortie_mission: "bg-red-100 text-red-700",
  autre: "bg-gray-100 text-gray-700",
};
const categoryLabel: Record<string, string> = {
  recrutement_recent: "Recrutement récent",
  sortie_prochaine: "Sortie prochaine",
  sortie_mission: "Sortie de mission",
  autre: "Autre",
};

const DetailSales = () => {
  const { salesName } = useParams<{ salesName: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SalesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!salesName) return;
    
    // In React Router v6, dynamic params are automatically URL-decoded.
    // So salesName is already decoded (e.g. "Sophie Martin").
    getSalesDetail(salesName)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError(true);
        setLoading(false);
      });
  }, [salesName]);

  if (loading) {
    return (
      <DashboardLayout title="Détail Sales">
        <div className="p-8 flex justify-center text-muted-foreground">Chargement des données...</div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="Détail Sales">
         <div className="p-8 flex flex-col items-center">
             <p className="text-red-500 mb-4">Erreur lors du chargement des données ou sales introuvable.</p>
             <Button variant="outline" onClick={() => navigate("/synthese-hebdo")}>Retour synthèse</Button>
         </div>
      </DashboardLayout>
    );
  }

  // Transform for Pie chart
  const pieData = Object.entries(data.repartition)
    .map(([k, v]) => ({ name: actionLabels[k] || k, value: Number(v) }))
    .filter((d) => d.value > 0);

  // Transform for Bar chart (daily counts)
  const barData = data.actions_by_day.map(day => ({
    date: day.label,
    actions: day.count,
  }));

  return (
    <DashboardLayout title={`Détail — ${data.name}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <Button variant="ghost" size="sm" onClick={() => navigate("/synthese-hebdo")} className="gap-2">
             <ArrowLeft className="h-4 w-4" /> Retour synthèse
           </Button>
           <span className="text-sm text-muted-foreground">{data.week_label}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Action distribution */}
          <Card>
            <CardHeader><CardTitle className="text-base">Répartition des actions</CardTitle></CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">Aucune action cette semaine.</div>
              )}
            </CardContent>
          </Card>

          {/* Daily bar */}
          <Card>
            <CardHeader><CardTitle className="text-base">Actions par jour</CardTitle></CardHeader>
            <CardContent>
              {barData.some(d => d.actions > 0) ? (
                 <ResponsiveContainer width="100%" height={250}>
                 <BarChart data={barData}>
                   <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                   <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                   <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                   <Tooltip />
                   <Bar dataKey="actions" fill="hsl(224 80% 40%)" radius={[4, 4, 0, 0]} />
                 </BarChart>
               </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">Aucune action cette semaine.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader><CardTitle className="text-base">Historique de la semaine</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.actions_by_day.filter(d => d.actions.length > 0).map((day) => (
                <div key={day.date}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {day.label}
                  </p>
                  <div className="space-y-1.5 ml-4 border-l-2 border-muted pl-4">
                    {day.actions.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">{actionLabels[a.type] || a.type}</Badge>
                        <span>{a.description}</span>
                        {a.company && <span className="text-muted-foreground">— {a.company}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {data.actions_by_day.filter(d => d.actions.length > 0).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun historique détaillé.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Intercos assignés */}
        <Card>
          <CardHeader><CardTitle className="text-base">Intercontrats assignés ({data.intercos.length})</CardTitle></CardHeader>
          <CardContent>
            {data.intercos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun intercontrat assigné.</p>
            ) : (
              <div className="space-y-2">
                {data.intercos.map((ic, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{ic.name}</p>
                      <p className="text-xs text-muted-foreground">{ic.last_action}</p>
                    </div>
                    <Badge className={`${categoryBadge[ic.category] || categoryBadge.autre} hover:opacity-90`}>
                       {categoryLabel[ic.category] || categoryLabel.autre}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DetailSales;
