import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getIntercos, IntercoResponse } from "@/services/hebdoService";

const categoryLabel: Record<string, string> = {
  recrutement_recent: "Recrutement récent",
  sortie_prochaine: "Sortie prochaine",
  sortie_mission: "Sortie de mission",
  autre: "Autre",
};
const categoryBadge: Record<string, string> = {
  recrutement_recent: "bg-blue-100 text-blue-700",
  sortie_prochaine: "bg-amber-100 text-amber-700",
  sortie_mission: "bg-red-100 text-red-700",
  autre: "bg-gray-100 text-gray-700",
};
const statusLabel: Record<string, string> = {
  sans_action: "Sans action",
  en_cours: "En cours",
  positionne: "Positionné",
  place: "Placé",
};
const statusBadge: Record<string, string> = {
  sans_action: "bg-gray-100 text-gray-700",
  en_cours: "bg-blue-100 text-blue-700",
  positionne: "bg-amber-100 text-amber-700",
  place: "bg-emerald-100 text-emerald-700",
};

const Intercontrats = () => {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSales, setFilterSales] = useState<string>("all");
  const [data, setData] = useState<IntercoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    getIntercos(filterCategory, filterSales)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setError(true);
        setLoading(false);
      });
  }, [filterCategory, filterSales]);

  // Extract unique sales names from intercos to populate the dropdown, safely grouping them
  // Or normally we'd get them from the backend endpoint, but since the endpoint returns interco objects,
  // we can just extract unique names. BUT we only have filtered data! So we will only get sales of the current filter.
  // In a real app we'd fetch the complete list. Since this is just a quick UI, we can fetch all intercos once to populate filters,
  // but to keep it simple, we will fetch `salesName="all"` every time and just do the filtering locally here?
  // Wait, the backend logic actually takes `category` and `sales_name`. If we rely on the backend, we should use the API. 
  // Let's create a derived list of sales from the data IF it's all, but if we filter we might lose some.
  // We can just rely on the data returned for the list of sales. Or hardcode the `salesUsers` ? Let's use `salesUsers` ? NO, I can't use mock data.
  // We'll extract `sales_responsable` from `data.intercos`.

  return (
    <DashboardLayout title="Gestion Intercontrats">
      <div className="space-y-6">
        {/* Stats summary */}
        {data && (
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
             {(["recrutement_recent", "sortie_prochaine", "sortie_mission"] as const).map((cat) => (
               <Card key={cat}>
                 <CardContent className="pt-4 pb-3 px-4">
                   <p className="text-xs text-muted-foreground mb-1">{categoryLabel[cat]}</p>
                   <p className="text-2xl font-bold">{data.totals[cat]}</p>
                 </CardContent>
               </Card>
             ))}
             <Card>
               <CardContent className="pt-4 pb-3 px-4">
                 <p className="text-xs text-muted-foreground mb-1">Total Intercos</p>
                 <p className="text-2xl font-bold">{data.totals.total}</p>
               </CardContent>
             </Card>
           </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {Object.entries(categoryLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSales} onValueChange={setFilterSales}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sales" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les Sales</SelectItem>
              {data?.intercos
                .map(ic => ic.sales_responsable)
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort()
                .map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
                <div className="flex justify-center p-8">Chargement des intercontrats...</div>
            ) : error || !data ? (
                <div className="flex justify-center p-8 text-red-500">Erreur lors du chargement des intercontrats.</div>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Ressource</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Sales Responsable</TableHead>
                    <TableHead>Fin de Mission</TableHead>
                    <TableHead>Dernière Action</TableHead>
                    <TableHead>Statut</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.intercos.map((ic) => (
                        <TableRow key={ic.boond_id}>
                        <TableCell className="font-medium">{ic.name}</TableCell>
                        <TableCell>
                            <Badge className={`${categoryBadge[ic.category] || categoryBadge.autre} hover:opacity-90`}>{categoryLabel[ic.category] || categoryLabel.autre}</Badge>
                        </TableCell>
                        <TableCell>{ic.sales_responsable}</TableCell>
                        <TableCell className="text-sm">
                            {ic.fin_mission ? new Date(ic.fin_mission).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ic.derniere_action || "Aucune"}</TableCell>
                        <TableCell>
                            <Badge className={`${statusBadge[ic.statut] || statusBadge.sans_action} hover:opacity-90`}>{statusLabel[ic.statut] || statusLabel.sans_action}</Badge>
                        </TableCell>
                        </TableRow>
                    ))}
                    {data.intercos.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground p-4">Aucun intercontrat trouvé pour les filtres sélectionnés.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Intercontrats;
