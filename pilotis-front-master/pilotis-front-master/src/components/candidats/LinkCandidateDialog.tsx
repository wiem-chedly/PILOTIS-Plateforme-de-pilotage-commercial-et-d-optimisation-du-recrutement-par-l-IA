import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Info, CheckCircle } from "lucide-react";
import { ScoreBadge, MatchAnalysisPanel } from "@/pages/Candidats";

interface Opportunity {
  id: number;
  titre: string;
  reference?: string;
  score: number;
  confidence?: string;
  justification?: string;
  explanation?: string;
}

interface LinkCandidateDialogProps {
  showLinkDialog: boolean;
  setShowLinkDialog: (open: boolean) => void;
  loadingMatches: boolean;
  matchingOpportunities: Opportunity[];
  selectedOpportunity: Opportunity | null;
  setSelectedOpportunity: (opp: Opportunity) => void;
  linking: boolean;
  confirmLink: () => void;
}

export const LinkCandidateDialog: React.FC<LinkCandidateDialogProps> = ({
  showLinkDialog,
  setShowLinkDialog,
  loadingMatches,
  matchingOpportunities,
  selectedOpportunity,
  setSelectedOpportunity,
  linking,
  confirmLink
}) => {
  return (
    <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
      <DialogContent className="max-w-3xl rounded-2xl p-0 border-0 shadow-2xl overflow-hidden bg-slate-50 gap-0">
        <div className="bg-white px-6 py-5 border-b flex items-center gap-4 sticky top-0 z-10 shadow-sm">
          <div className="p-2.5 bg-indigo-50/80 text-indigo-600 rounded-xl ring-1 ring-indigo-200/50 shadow-inner">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">
              Associer à une offre compatible
            </DialogTitle>
            <p className="text-xs text-slate-500 font-medium mt-0.5">La meilleure correspondance pour ce candidat</p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 min-h-[300px]">
          {loadingMatches ? (
            <div className="flex flex-col justify-center items-center py-16 gap-4">
              <div className="h-10 w-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin shadow-sm" />
              <span className="text-sm font-semibold tracking-wide text-indigo-700/80 animate-pulse">Analyse sémantique IA en cours...</span>
            </div>
          ) : matchingOpportunities.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-sm mx-auto">
              <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
                <Info className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Aucune offre compatible</h3>
              <p className="text-sm text-slate-500 leading-relaxed">Les compétences de ce candidat ne correspondent fortement à aucune de nos offres ouvertes actuellement.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 pb-2 custom-scrollbar">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Résultats IA <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-full">{matchingOpportunities.length}</span>
                </p>
                <p className="text-[11px] font-medium text-slate-400">Triés par pertinence</p>
              </div>
              {matchingOpportunities.map((opp) => {
                const isSelected = selectedOpportunity?.id === opp.id;
                const scoreColor =
                  opp.score >= 65 ? "border-emerald-200/70 bg-emerald-50/30 hover:border-emerald-300" :
                  opp.score >= 40 ? "border-amber-200/70 bg-amber-50/30 hover:border-amber-300" :
                                    "border-slate-200/70 bg-white hover:border-slate-300";
                return (
                  <div
                    key={opp.id}
                    onClick={() => setSelectedOpportunity(opp)}
                    className={`cursor-pointer rounded-xl border-2 p-5 transition-all duration-300 relative overflow-hidden group outline-none ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/40 shadow-md ring-4 ring-indigo-500/10 scale-[1.01]"
                        : `${scoreColor} shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-[2px]`
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`font-bold text-[15px] truncate transition-colors ${isSelected ? "text-indigo-900" : "text-slate-900 group-hover:text-indigo-700"}`}>{opp.titre}</span>
                          {opp.reference && (
                            <Badge variant="secondary" className="text-[10px] font-mono font-bold tracking-tight bg-slate-100 text-slate-600 flex-shrink-0 border-slate-200">
                              #{opp.reference}
                            </Badge>
                          )}
                        </div>
                        {opp.justification && (() => {
                          // Clean up the raw justification text for display
                          const j = opp.justification
                            .replace(/\((\d+) confirm[eé]s?,\s*(\d+) approche[s]?\)/i, '— $1 compétence(s) prouvée(s), $2 technologie(s) proche(s)')
                            .replace(/\((\d+) skills? confirm[eé]s?,\s*niveau (\w+)\)/i, '— $1 compétence(s) validée(s), niveau $2')
                            .replace(/\((\d+) skills? requis?,\s*(\d+) confirm[eé]s?\)/i, '— $2 / $1 compétences trouvées')
                            .replace(/Forte correspondance/, '✅ Forte correspondance')
                            .replace(/Correspondance partielle/, '⚡ Correspondance partielle')
                            .replace(/Faible correspondance/, '⚠️ Faible correspondance')
                            .replace(/Ecart de niveau/, '🚫 Écart de niveau');
                          return (
                            <p className={`text-sm leading-relaxed ${isSelected ? "text-indigo-900/80 font-medium" : "text-slate-600"}`}>
                              {j}
                            </p>
                          );
                        })()}
                      </div>
                      <div className="flex-shrink-0 pt-0.5">
                        <ScoreBadge score={opp.score} confidence={opp.confidence as any} />
                      </div>
                    </div>

                    {/* Detail explanation (show only for selected) */}
                    {isSelected && opp.explanation && (
                      <MatchAnalysisPanel
                        explanation={opp.explanation}
                        score={opp.score}
                        confidence={opp.confidence as any}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="bg-white border-t p-5 flex items-center justify-end gap-3 rounded-b-2xl">
          <Button variant="ghost" className="rounded-xl font-medium tracking-wide" onClick={() => setShowLinkDialog(false)}>Annuler</Button>
          <Button
            onClick={confirmLink}
            disabled={!selectedOpportunity || linking || loadingMatches}
            className="gap-2 rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all font-semibold tracking-wide"
          >
            {linking
              ? <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              : <CheckCircle className="h-4 w-4 opacity-80" />}
            Confirmer l'association
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
