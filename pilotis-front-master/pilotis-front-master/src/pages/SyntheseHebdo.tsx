import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, Target, Handshake, FileSignature, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getHebdoSynthese, HebdoSynthese } from "@/services/hebdoService";

const alertIcon = { danger: AlertCircle, warning: AlertTriangle, info: Info };
const alertColor = { danger: "text-red-500", warning: "text-amber-500", info: "text-blue-500" };
const alertBg = { danger: "bg-red-50 border-red-200", warning: "bg-amber-50 border-amber-200", info: "bg-blue-50 border-blue-200" };

const SyntheseHebdo = () => {
  const [data, setData] = useState<HebdoSynthese | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getHebdoSynthese()
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
      <DashboardLayout title="Synthèse Hebdomadaire">
        <div className="p-8 flex justify-center text-muted-foreground">Chargement des données...</div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="Synthèse Hebdomadaire">
        <div className="p-8 flex justify-center text-red-500">Erreur lors du chargement des données.</div>
      </DashboardLayout>
    );
  }

  const kpiCards = [
    { label: "Prospections", value: data.team_totals.prospections, icon: Phone, color: "text-blue-600" },
    { label: "Positionnements", value: data.team_totals.positionnements, icon: Target, color: "text-amber-600" },
    { label: "Entretiens", value: data.team_totals.entretiens, icon: Handshake, color: "text-purple-600" },
    { label: "Signatures", value: data.team_totals.signatures, icon: FileSignature, color: "text-emerald-600" },
  ];

  return (
    <DashboardLayout title="Synthèse Hebdomadaire">
      <div className="space-y-6">
        {/* Period */}
        <p className="text-sm text-muted-foreground">{data.week_label}</p>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card>
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                    <k.icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                  <p className="text-2xl font-bold">{k.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Performance par Sales</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales</TableHead>
                  <TableHead className="text-center">Prospection</TableHead>
                  <TableHead className="text-center">Suivi Mission</TableHead>
                  <TableHead className="text-center">Positionnements</TableHead>
                  <TableHead className="text-center">Entretiens</TableHead>
                  <TableHead className="text-center">Signatures</TableHead>
                  <TableHead className="text-center">Taux Pos→Ent</TableHead>
                  <TableHead className="text-center">Taux Ent→Sign</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.map((s) => (
                  <TableRow 
                    key={s.name} 
                    className="cursor-pointer hover:bg-muted/50" 
                    onClick={() => navigate('/detail-sales/' + encodeURIComponent(s.name))}
                  >
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center">{s.prospection}</TableCell>
                    <TableCell className="text-center">{s.suivi_mission}</TableCell>
                    <TableCell className="text-center">{s.positionnements}</TableCell>
                    <TableCell className="text-center">{s.entretiens}</TableCell>
                    <TableCell className="text-center">
                      {s.signatures > 0 ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{s.signatures}</Badge> : 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={(s.taux_pos_ent ?? 0) >= 50 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                        {s.taux_pos_ent !== null ? `${s.taux_pos_ent}%` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={(s.taux_ent_sign ?? 0) >= 50 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                        {s.taux_ent_sign !== null ? `${s.taux_ent_sign}%` : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Interco table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Focus Intercontrats</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sales</TableHead>
                  <TableHead className="text-center">Recrutement Récent</TableHead>
                  <TableHead className="text-center">Sortie Prochaine</TableHead>
                  <TableHead className="text-center">Sortie Mission</TableHead>
                  <TableHead className="text-center">Positionnés</TableHead>
                  <TableHead className="text-center">Total Intercos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center">{s.intercos.recrutement_recent || "—"}</TableCell>
                    <TableCell className="text-center">{s.intercos.sortie_prochaine || "—"}</TableCell>
                    <TableCell className="text-center">
                      {s.intercos.sortie_mission > 0 ? <Badge variant="destructive">{s.intercos.sortie_mission}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-center">{s.intercos.positionnes || "—"}</TableCell>
                    <TableCell className="text-center font-medium">{s.intercos.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader><CardTitle className="text-base">Points d'Attention</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun point d'attention particulier cette semaine.</p>
            ) : (
              data.alerts.map((a, i) => {
                const Icon = alertIcon[a.type];
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${alertBg[a.type]}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${alertColor[a.type]}`} />
                    <span className="text-sm">{a.message}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SyntheseHebdo;
