import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Linkedin } from "lucide-react";

const formatMontant = (v: number | undefined | null) => {
  if (v == null) return "Non renseigné";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
};

const formatDate = (date: string | undefined | null) => {
  if (!date) return "Non renseigné";
  try {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return date;
  }
};

interface AoDetailDialogProps {
  show: boolean;
  onShowChange: (open: boolean) => void;
  loading: boolean;
  ao: any; // Utilise AppelOffreDetail
  onShare: (ao: any) => void;
}

export const AoDetailDialog: React.FC<AoDetailDialogProps> = ({
  show,
  onShowChange,
  loading,
  ao,
  onShare
}) => {
  return (
    <Dialog open={show} onOpenChange={onShowChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Détails de l'opportunité
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : ao ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Titre</Label>
                <p className="text-sm font-medium">{ao.titre || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Client</Label>
                <p className="text-sm font-medium">{ao.client || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Référence</Label>
                <p className="text-sm">{ao.reference || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Type d'offre</Label>
                <p className="text-sm">{ao.typeOffre || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Lieu</Label>
                <p className="text-sm">{ao.lieu || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Type de contrat</Label>
                <p className="text-sm">{ao.typeContrat || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date de création</Label>
                <p className="text-sm">{formatDate(ao.dateCreation)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date limite</Label>
                <p className="text-sm">{formatDate(ao.dateLimite)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date d'import</Label>
                <p className="text-sm">{ao.dateImport ? new Date(ao.dateImport).toLocaleDateString('fr-FR') : "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Budget estimé</Label>
                <p className="text-sm">{formatMontant(ao.montantEstime)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">CA pondéré</Label>
                <p className="text-sm">{formatMontant(ao.caPondere || 0)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Devise</Label>
                <p className="text-sm">{ao.devise || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Progression</Label>
                <p className="text-sm">{ao.progression || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Statut</Label>
                <p className="text-sm">{ao.statut || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Manager</Label>
                <p className="text-sm">{ao.responsableManager || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Agence</Label>
                <p className="text-sm">{ao.agence || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contact</Label>
                <p className="text-sm">{ao.contactNom || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Durée</Label>
                <p className="text-sm">{ao.duree || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date de démarrage</Label>
                <p className="text-sm">{ao.dateDemarrage || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Positionnements actifs</Label>
                <p className="text-sm">{ao.posActif ?? "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">ID Boond</Label>
                <p className="text-sm">{ao.boond_id || "Non renseigné"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Pôle</Label>
                <p className="text-sm">{ao.pole || "Non renseigné"}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {ao.description || "Non renseigné"}
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Critères</Label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {ao.criteres || "Non renseigné"}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onShowChange(false)}
            className="h-8 px-4 text-xs bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
          >
            Annuler
          </Button>
          <Button
            onClick={() => {
              if (!ao) return;
              onShare(ao);
            }}
            className="h-8 px-4 text-xs bg-blue-600 text-white hover:bg-blue-700"
          >
            <Linkedin className="h-3 w-3 mr-1" />
            Partager sur LinkedIn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
