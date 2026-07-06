import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface CommercialRow {
  name: string;
  nb_cv: number;
  nb_entretiens: number;
  nb_appels: number;
}

const CommercialPerformanceChart = () => {
  const [data, setData] = useState<CommercialRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("http://localhost:5000/kpis/commercial", { credentials: "include" })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.commerciaux?.length) {
          const rows = (res.commerciaux as CommercialRow[])
            .sort((a, b) => b.nb_cv - a.nb_cv)
            .slice(0, 6)
            .map(c => ({
              name: c.name.split(" ")[0], // prénom seulement pour la lisibilité
              ca: c.nb_cv,               // nb_cv mappé sur "ca" pour réutiliser le même dataKey
              opportunites: c.nb_appels, // nb_appels mappé sur "opportunites"
            }));
          setData(rows as any);
        }
      })
      .catch(() => {/* garde l'état vide */})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Performance par commercial</CardTitle>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          title="Rafraîchir"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(215 16% 47%)" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(215 16% 47%)" width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ca" name="CVs positionnés" fill="hsl(224 80% 40%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="opportunites" name="Appels" fill="hsl(213 94% 68%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CommercialPerformanceChart;