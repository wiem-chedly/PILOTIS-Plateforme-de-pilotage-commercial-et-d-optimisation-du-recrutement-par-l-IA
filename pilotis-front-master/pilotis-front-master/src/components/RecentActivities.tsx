import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Activity {
  date:       string;
  commercial: string;
  type:       string;
  client:     string;
  detail:     string;
}

// Couleur de badge selon le type d'activité
function getTypeBadgeClass(type: string): string {
  if (type.includes("Entretien"))    return "bg-purple-100 text-purple-700 border-purple-200";
  if (type.includes("Rendez-vous"))  return "bg-blue-100 text-blue-700 border-blue-200";
  if (type.includes("Appel"))        return "bg-amber-100 text-amber-700 border-amber-200";
  if (type.includes("CV"))           return "bg-teal-100 text-teal-700 border-teal-200";
  if (type.includes("Email"))        return "bg-sky-100 text-sky-700 border-sky-200";
  if (type.includes("Suivi"))        return "bg-indigo-100 text-indigo-700 border-indigo-200";
  if (type.includes("Note"))         return "bg-gray-100 text-gray-600 border-gray-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

const RecentActivities = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const fetchData = () => {
    setLoading(true);
    setError("");
    fetch("http://localhost:5000/kpis/recent-activities?limit=15&days=30", {
      credentials: "include",
    })
      .then(r => r.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setActivities(res.data);
        } else {
          setError("Aucune activité récente trouvée.");
        }
      })
      .catch(() => setError("Impossible de charger les activités depuis BoondManager."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Card className="border-none shadow-md">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Activités récentes</CardTitle>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          title="Rafraîchir depuis BoondManager"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="h-24 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Chargement depuis BoondManager…
          </div>
        ) : error ? (
          <div className="h-16 flex items-center justify-center text-sm text-muted-foreground px-6">
            {error}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Commercial</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {a.date}
                  </TableCell>
                  <TableCell className="font-medium">{a.commercial}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTypeBadgeClass(a.type)}>
                      {a.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{a.client}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-[220px] truncate">
                    {a.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivities;
