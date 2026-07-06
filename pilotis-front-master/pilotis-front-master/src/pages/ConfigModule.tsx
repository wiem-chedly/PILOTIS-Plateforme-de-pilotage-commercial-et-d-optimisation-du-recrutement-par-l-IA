import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getConfig, saveConfig } from "@/services/hebdoService";

const ConfigModule = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  const [thresholds, setThresholds] = useState({
    recrutement_recent_days: "30",
    sortie_prochaine_days: "30",
    debut_semaine: "Lundi",
    taci_cible: "90",
  });

  const [objectives, setObjectives] = useState<any[]>([]);

  useEffect(() => {
    getConfig()
      .then((cfg) => {
        setThresholds({
          recrutement_recent_days: String(cfg.recrutement_recent_days || 30),
          sortie_prochaine_days: String(cfg.sortie_prochaine_days || 30),
          debut_semaine: cfg.debut_semaine || "Lundi",
          taci_cible: String(cfg.taci_cible || 85),
        });
        setObjectives(cfg.objectifs || []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        toast({ title: "Erreur", description: "Impossible de charger la configuration.", variant: "destructive" });
        setLoading(false);
      });
  }, [toast]);

  const handleSaveThresholds = async () => {
    try {
      await saveConfig({
        recrutement_recent_days: parseInt(thresholds.recrutement_recent_days),
        sortie_prochaine_days: parseInt(thresholds.sortie_prochaine_days),
        debut_semaine: thresholds.debut_semaine,
        taci_cible: parseInt(thresholds.taci_cible),
      });
      toast({ title: "Configuration sauvegardée", description: "Les seuils ont été mis à jour." });
    } catch(e) {
      toast({ title: "Erreur", description: "Échec de sauvegarde.", variant: "destructive" });
    }
  };

  const handleSaveObjectives = async () => {
    try {
      await saveConfig({ objectifs: objectives });
      toast({ title: "Objectifs sauvegardés", description: "Les objectifs annuels ont été mis à jour." });
    } catch(e) {
      toast({ title: "Erreur", description: "Échec de sauvegarde.", variant: "destructive" });
    }
  };

  const handleAddObjectiveRow = () => {
    setObjectives([...objectives, { sales_name: "", target_positions: 0, target_interviews: 0, target_signatures: 0, target_ca: 0 }]);
  };

  const handleDeleteObjectiveRow = (idx: number) => {
    const updated = [...objectives];
    updated.splice(idx, 1);
    setObjectives(updated);
  };

  if (loading) {
    return (
      <DashboardLayout title="Configuration du Module">
        <div className="p-8 flex justify-center text-muted-foreground">Chargement...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configuration du Module">
      <div className="space-y-6 max-w-5xl">
        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seuils de Catégorisation Interco</CardTitle>
            <CardDescription>Définissez les critères automatiques de classification des intercontrats.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recrutement récent (jours depuis embauche)</Label>
                <Input
                  type="number"
                  value={thresholds.recrutement_recent_days}
                  onChange={(e) => setThresholds({ ...thresholds, recrutement_recent_days: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sortie prochaine (jours avant fin mission)</Label>
                <Input
                  type="number"
                  value={thresholds.sortie_prochaine_days}
                  onChange={(e) => setThresholds({ ...thresholds, sortie_prochaine_days: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>TACI cible (%)</Label>
                <Input
                  type="number"
                  value={thresholds.taci_cible}
                  onChange={(e) => setThresholds({ ...thresholds, taci_cible: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Début de semaine</Label>
                <Input
                  value={thresholds.debut_semaine}
                  onChange={(e) => setThresholds({ ...thresholds, debut_semaine: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleSaveThresholds} className="gap-2">
              <Save className="h-4 w-4" /> Sauvegarder les seuils
            </Button>
          </CardContent>
        </Card>

        {/* Annual Objectives */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base">Objectifs Annuels par Sales</CardTitle>
                <CardDescription>Définissez les objectifs individuels pour l'année en cours.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddObjectiveRow} className="gap-1">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom du Sales (exact Boond)</TableHead>
                  <TableHead className="text-center">Positionnements</TableHead>
                  <TableHead className="text-center">Entretiens</TableHead>
                  <TableHead className="text-center">Signatures</TableHead>
                  <TableHead className="text-center">CA Cible (€)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objectives.map((obj, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        className="w-full"
                        value={obj.sales_name || ""}
                        placeholder="Ex: Sophie Martin"
                        onChange={(e) => {
                          const updated = [...objectives];
                          updated[idx] = { ...updated[idx], sales_name: e.target.value };
                          setObjectives(updated);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20 mx-auto text-center"
                        value={obj.target_positions || 0}
                        onChange={(e) => {
                          const updated = [...objectives];
                          updated[idx] = { ...updated[idx], target_positions: parseInt(e.target.value) || 0 };
                          setObjectives(updated);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20 mx-auto text-center"
                        value={obj.target_interviews || 0}
                        onChange={(e) => {
                          const updated = [...objectives];
                          updated[idx] = { ...updated[idx], target_interviews: parseInt(e.target.value) || 0 };
                          setObjectives(updated);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-20 mx-auto text-center"
                        value={obj.target_signatures || 0}
                        onChange={(e) => {
                          const updated = [...objectives];
                          updated[idx] = { ...updated[idx], target_signatures: parseInt(e.target.value) || 0 };
                          setObjectives(updated);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="w-28 mx-auto text-center"
                        value={obj.target_ca || 0}
                        onChange={(e) => {
                          const updated = [...objectives];
                          updated[idx] = { ...updated[idx], target_ca: parseInt(e.target.value) || 0 };
                          setObjectives(updated);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={() => handleDeleteObjectiveRow(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {objectives.length === 0 && (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center text-muted-foreground py-4">Aucun objectif défini.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Button onClick={handleSaveObjectives} className="gap-2 mt-4 inline-flex">
              <Save className="h-4 w-4" /> Sauvegarder les objectifs
            </Button>
          </CardContent>
        </Card>

        {/* TACI Calculation Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Règles de Calcul TACI</CardTitle>
            <CardDescription>Le Taux d'Activité Commerciale Individuel est calculé selon la formule :</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 text-sm font-mono">
              TACI = (Jours facturés / Jours ouvrés) × 100
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Les jours ouvrés excluent les weekends, jours fériés, congés et formations. Configurable via l'intégration BoondManager.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ConfigModule;
