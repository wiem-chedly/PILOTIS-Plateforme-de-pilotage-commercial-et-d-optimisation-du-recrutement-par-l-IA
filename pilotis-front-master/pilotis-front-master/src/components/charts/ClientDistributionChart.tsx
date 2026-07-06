import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertCircle } from "lucide-react";

interface CompanyStat {
  display_name: string;
  prospects: number;
  clients: number;
  partners: number;
  total: number;
  other_names?: string[];
}

interface ConversionCompany {
  name: string;
  nb_rdv: number;
  nb_appel: number;
  nb_contacts: number;
  taux_rdv: string;
  taux_appel: string;
}

interface MergedCompany extends CompanyStat {
  nb_rdv?: number;
  nb_appel?: number;
  taux_rdv?: string;
  taux_appel?: string;
}

const ClientDistributionChart = () => {
  const [merged, setMerged] = useState<MergedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, convRes] = await Promise.all([
        fetch("http://localhost:5000/companies/stats", { credentials: "include" }),
        fetch("http://localhost:5000/companies/conversion", { credentials: "include" }),
      ]);

      if (!statsRes.ok) throw new Error(`Stats HTTP ${statsRes.status}`);
      const statsData = await statsRes.json();

      const convLookup: Record<string, ConversionCompany> = {};
      if (convRes.ok) {
        const convData = await convRes.json();
        const companies: ConversionCompany[] = convData?.companies ?? [];
        for (const c of companies) {
          convLookup[c.name?.toUpperCase().trim()] = c;
        }
      }

      const statsArray: CompanyStat[] = statsData?.stats ?? (Array.isArray(statsData) ? statsData : []);
      setMonth(statsData?.month ?? "");

      const result: MergedCompany[] = statsArray.map((s) => {
        const key = s.display_name?.toUpperCase().trim();
        const conv = convLookup[key];
        return {
          ...s,
          nb_rdv: conv?.nb_rdv,
          nb_appel: conv?.nb_appel,
          taux_rdv: conv?.taux_rdv,
          taux_appel: conv?.taux_appel,
        };
      });

      setMerged(result);
    } catch (err: any) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRateColor = (val?: string) => {
    if (!val || val === "N/A") return "text-slate-300 font-medium";
    const n = parseFloat(val);
    if (isNaN(n)) return "text-slate-300 font-medium";
    // Taux est un pourcentage 0-100 car retourné tel quel (ex: "61%")
    if (n >= 50) return "text-emerald-500 font-medium";
    if (n >= 20) return "text-amber-500 font-medium";
    return "text-red-500 font-medium";
  };

  const formatMonthInFrench = (monthStr: string) => {
    if (!monthStr) return "";
    const parts = monthStr.split(" ");
    if (parts.length === 2) {
      const [m, y] = parts;
      const frenchMonths: Record<string, string> = {
        "January": "Janvier", "February": "Février", "March": "Mars", "April": "Avril",
        "May": "Mai", "June": "Juin", "July": "Juillet", "August": "Août",
        "September": "Septembre", "October": "Octobre", "November": "Novembre", "December": "Décembre"
      };
      return `${frenchMonths[m] || m} ${y}`;
    }
    return monthStr;
  };

  return (
    <Card className="border-none shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] col-span-1 flex flex-col overflow-hidden bg-white rounded-2xl h-[362px]">
      <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 space-y-0 border-b border-slate-50 flex-shrink-0">
        <div>
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">
            Statistiques BoondManager
          </CardTitle>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            {formatMonthInFrench(month) || "Chargement..."} • {merged.length} {merged.length > 1 ? 'sociétés' : 'société'}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 text-slate-400 hover:text-slate-700 ${loading ? "animate-spin" : ""}`} />
        </button>
      </CardHeader>

      <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
            <p className="text-xs text-slate-400 font-medium">Synchronisation des statistiques...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <p className="text-xs text-red-600 px-6 font-medium">{error}</p>
            <button onClick={fetchAll} className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold underline mt-1">Réessayer</button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 w-full">
            <Table>
              <TableHeader className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                <TableRow className="border-b border-slate-100 hover:bg-transparent">
                  <TableHead className="pl-6 py-3 font-semibold text-slate-500 text-xs text-left">Client</TableHead>
                  <TableHead className="py-3 font-semibold text-slate-500 text-xs text-center">Contacts</TableHead>
                  <TableHead className="py-3 font-semibold text-slate-500 text-xs text-center">RDV %</TableHead>
                  <TableHead className="py-3 font-semibold text-slate-500 text-xs text-center pr-6">Appel %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merged.map((co, i) => (
                  <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0 group">
                    <TableCell className="pl-6 py-3">
                      <span className="font-semibold text-sm text-slate-700">{co.display_name}</span>
                    </TableCell>
                    <TableCell className="py-3 text-center">
                      <span className="text-[13px] font-medium text-slate-600 tabular-nums">{co.prospects + co.clients}</span>
                    </TableCell>
                    <TableCell className={`py-3 text-center text-[13px] tabular-nums ${getRateColor(co.taux_rdv)}`}>
                      {co.taux_rdv || "—"}
                    </TableCell>
                    <TableCell className={`py-3 pr-6 text-center text-[13px] tabular-nums ${getRateColor(co.taux_appel)}`}>
                      {co.taux_appel || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientDistributionChart;