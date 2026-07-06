import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

interface MonthPoint {
  month: string;
  contrats: number;
  objectifs: number;
}

const MonthlyEvolutionChart = () => {
  const [data, setData] = useState<MonthPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("http://localhost:5000/kpis/monthly-evolution", { credentials: "include" })
      .then(r => r.json())
      .then((res: { success: boolean; data: MonthPoint[] }) => {
        if (res.success && Array.isArray(res.data)) {
          setData(res.data);  // Always use API data, even if all values are 0
        }
      })
      .catch(() => {/* keep empty on error */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const formatTooltipLabel = (label: string) => {
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const mIndex = monthNames.indexOf(label);
    if (mIndex === -1) return `${label} ${new Date().getFullYear()}`;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Si l'index du mois est supérieur au mois actuel, on suppose que c'est l'année précédente
    const year = mIndex > currentMonth ? currentYear - 1 : currentYear;
    return `${label} ${year}`;
  };

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Évolution mensuelle</CardTitle>
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
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorContrats" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(224 80% 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(224 80% 40%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorObjectifs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(213 94% 55%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(213 94% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(215 16% 47%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(215 16% 47%)" />
              <Tooltip labelFormatter={formatTooltipLabel} />
              <Legend />
              <Area
                type="monotone"
                dataKey="contrats"
                name="AOs importés"
                stroke="hsl(224 80% 40%)"
                fill="url(#colorContrats)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="objectifs"
                name="Objectifs"
                stroke="hsl(213 94% 55%)"
                fill="url(#colorObjectifs)"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyEvolutionChart;
