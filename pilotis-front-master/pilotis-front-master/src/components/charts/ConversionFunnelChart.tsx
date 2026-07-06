import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface FunnelItem {
  stage: string;
  value: number;
  fill: string;
}

const FILLS = [
  "hsl(213 94% 68%)",
  "hsl(213 94% 55%)",
  "hsl(224 80% 40%)",
  "hsl(215 50% 24%)",
  "hsl(215 50% 18%)",
];

// Mapping des noms API → noms affichés dans le funnel
const STAGE_MAP: Record<string, string> = {
  "Total Candidats": "Total Candidats",
  "Candidats Rattachés": "Candidats Rattachés",
  "Quiz Envoyés": "Quiz Envoyés",
  "Quiz Complétés": "Quiz Complétés",
  "Entretiens Confirmés": "Entretiens Confirmés",
};

const ConversionFunnelChart = () => {
  const [funnelData, setFunnelData] = useState<FunnelItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("http://localhost:5000/api/stats/recruitment/", { credentials: "include" })
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.funnel) {
          const items: FunnelItem[] = res.data.funnel.map(
            (f: { name: string; value: number }, i: number) => ({
              stage: STAGE_MAP[f.name] ?? f.name,
              value: f.value,
              fill: FILLS[i] ?? FILLS[FILLS.length - 1],
            })
          );
          setFunnelData(items);
        }
      })
      .catch(() => {/* garde vide */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const maxValue = Math.max(...funnelData.map(d => d.value), 1);

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Funnel de conversion</CardTitle>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          title="Rafraîchir"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {funnelData.map((item, i) => (
              <div key={item.stage} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-24 text-right shrink-0">
                  {item.stage}
                </span>
                <div className="flex-1 relative">
                  <motion.div
                    className="h-8 rounded-md flex items-center px-3"
                    style={{ backgroundColor: item.fill }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / maxValue) * 100}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <span className="text-sm font-semibold text-white">{item.value}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ConversionFunnelChart;
