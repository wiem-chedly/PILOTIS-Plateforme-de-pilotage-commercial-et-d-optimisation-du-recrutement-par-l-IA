import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, Briefcase, XCircle, CheckCircle, Info } from "lucide-react";
import { Candidate, ScoreBadge } from "@/pages/Candidats";

interface DecisionDialogProps {
  decisionCandidate: Candidate | null;
  setDecisionCandidate: (candidate: Candidate | null) => void;
  decidingLink: boolean;
  decideLinkAction: (id: number, action: "accept" | "reject") => void;
}

export const DecisionDialog: React.FC<DecisionDialogProps> = ({
  decisionCandidate,
  setDecisionCandidate,
  decidingLink,
  decideLinkAction
}) => {
  return (
    <Dialog open={!!decisionCandidate} onOpenChange={(open) => !open && setDecisionCandidate(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-0 shadow-2xl bg-slate-50 gap-0">
        {/* Header */}
        <div className="bg-white px-7 py-5 border-b flex items-start gap-4 sticky top-0 z-10 shadow-sm rounded-t-3xl">
          <div className="h-12 w-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-lg font-bold text-slate-900">Liaison détectée automatiquement</DialogTitle>
            <p className="text-sm text-slate-500 mt-0.5">
              Référence trouvée dans l'email — analysez le rapport avant de décider.
            </p>
          </div>
          {decisionCandidate?.matching_score != null && (
            <div className="flex-shrink-0 pt-1">
              <ScoreBadge score={decisionCandidate.matching_score} confidence={decisionCandidate.match_confidence} />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          {/* Candidat + Offre en ligne */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4 ring-1 ring-slate-200/60 shadow-sm">
              <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Candidat</p>
                <p className="text-sm font-bold text-slate-900 truncate">{decisionCandidate?.last_name} {decisionCandidate?.first_name}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{decisionCandidate?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Offre proposée</p>
                <p className="text-sm font-bold text-amber-900 truncate">{decisionCandidate?.suggested_job_title}</p>
                {decisionCandidate?.match_justification && (
                  <p className="text-xs text-amber-700 truncate">{decisionCandidate.match_justification}</p>
                )}
              </div>
            </div>
          </div>

          {/* Rapport de conseil IA */}
          {decisionCandidate?.match_explanation && (() => {
            const rawExplanation = decisionCandidate.match_explanation!;
            const lines = rawExplanation.split('\n').filter(Boolean);

            // Détecte si l'explication est structurée (contient des préfixes reconnus)
            const isStructured = lines.some(l => {
              const ll = l.toLowerCase().trim();
              return ll.startsWith('confirm') || ll.startsWith('partiel') ||
                     ll.startsWith('manquant') || ll.startsWith('disqualif') ||
                     ll.startsWith('disqualifiant') || ll.startsWith('niveau') ||
                     ll.startsWith('domaine') || ll.startsWith('score');
            });

            const confirmed  = lines.filter(l => l.toLowerCase().trim().startsWith('confirm'));
            const partial    = lines.filter(l => l.toLowerCase().trim().startsWith('partiel'));
            const missing    = lines.filter(l => l.toLowerCase().trim().startsWith('manquant'));
            const disqualif  = lines.filter(l => {
              const ll = l.toLowerCase().trim();
              return ll.startsWith('disqualif') || ll.startsWith('disqualifiant');
            });
            const levelLines = lines.filter(l => l.toLowerCase().trim().startsWith('niveau'));
            const domainLines = lines.filter(l => l.toLowerCase().trim().startsWith('domaine'));

            const score = decisionCandidate.matching_score ?? 0;

            // Génère la recommandation automatique
            let recoBg = '', recoIcon: React.ReactNode, recoTitle = '', recoText = '';
            
            if (disqualif.length > 0) {
              recoBg = 'bg-red-50 border-red-200';
              recoIcon = <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
              recoTitle = '❌ Rejet recommandé';
              recoText = `Écart de niveau rédhibitoire détecté. ${disqualif[0].replace(/\(.*\)/, '').trim()}. Ce profil ne correspond pas aux exigences minimales du poste.`;
            } else if (score >= 65 && confirmed.length >= 2) {
              recoBg = 'bg-emerald-50 border-emerald-200';
              recoIcon = <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />;
              recoTitle = '✅ Acceptation recommandée';
              recoText = `Forte correspondance : ${confirmed.length} compétence(s) confirmée(s) par des projets, niveau compatible. La liaison est pertinente.`;
            } else if (score >= 40) {
              recoBg = 'bg-amber-50 border-amber-200';
              recoIcon = <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />;
              recoTitle = '⚠️ À évaluer avec attention';
              recoText = `Correspondance partielle (${score}%). Le candidat présente ${confirmed.length} point(s) fort(s) mais ${missing.length} élément(s) manquant(s) par rapport à l'offre. Un entretien technique permettrait de confirmer.`;
            } else {
              recoBg = 'bg-red-50 border-red-200';
              recoIcon = <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
              recoTitle = '❌ Rejet recommandé';
              recoText = `Score faible (${score}%). Trop peu de compétences requises sont confirmées. ${missing.length > 0 ? `Il manque : ${missing.slice(0, 3).map(l => l.split(':')[1]?.split('non')[0]?.trim() || '').filter(Boolean).join(', ')}.` : ''}`;
            }

            return (
              <>
                {/* Recommendation banner */}
                <div className={`rounded-2xl border p-4 flex items-start gap-3 ${recoBg}`}>
                  {recoIcon}
                  <div>
                    <p className="text-sm font-bold text-slate-900 mb-1">{recoTitle}</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{recoText}</p>
                  </div>
                </div>

                {/* Explication brute si non structurée (ex: offre sans skills techniques détectés) */}
                {!isStructured ? (
                  <div className="bg-white rounded-2xl p-4 ring-1 ring-slate-200/60 shadow-sm col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Info className="h-3 w-3" /> Analyse IA
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">{rawExplanation}</p>
                    <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      L'offre ne contient pas suffisamment de compétences techniques identifiables pour un rapport détaillé.
                    </p>
                  </div>
                ) : (
                  /* Points forts / faibles structurés */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Points forts */}
                    <div className="bg-white rounded-2xl p-4 ring-1 ring-slate-200/60 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-3 flex items-center gap-1.5">
                        <CheckCircle className="h-3 w-3" /> Points forts
                      </p>
                      {confirmed.length === 0 && partial.length === 0 && levelLines.filter(l => l.includes('OK')).length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Aucun point fort identifié</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {confirmed.map((l, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                              <span>{l.replace(/^confirm[eé]\s*:\s*/i, '').replace(/\(.*\)/, '').trim()}</span>
                            </li>
                          ))}
                          {partial.map((l, i) => (
                            <li key={`p${i}`} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-amber-400 mt-0.5 flex-shrink-0">~</span>
                              <span>{l.replace(/^partiel\s*:\s*/i, '').replace(/\(.*\)/, '').trim()}</span>
                            </li>
                          ))}
                          {levelLines.filter(l => l.includes('OK')).map((l, i) => (
                            <li key={`lv${i}`} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                              <span>{l.replace(/\(.*\)/, '').trim()}</span>
                            </li>
                          ))}
                          {domainLines.filter(l => l.includes('match')).map((l, i) => (
                            <li key={`dm${i}`} className="flex items-start gap-2 text-xs text-slate-700">
                              <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                              <span>{l.replace(/\(.*\)/, '').trim()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Points faibles / manquants */}
                    <div className="bg-white rounded-2xl p-4 ring-1 ring-slate-200/60 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-3 flex items-center gap-1.5">
                        <XCircle className="h-3 w-3" /> Ce qui manque
                      </p>
                      {missing.length === 0 && disqualif.length === 0 && levelLines.filter(l => !l.includes('OK')).length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Aucun point bloquant identifié</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {disqualif.map((l, i) => (
                            <li key={`dq${i}`} className="flex items-start gap-2 text-xs text-red-700 font-semibold">
                              <span className="mt-0.5 flex-shrink-0">🚫</span>
                              <span>{l.replace(/\(.*\)/, '').trim()}</span>
                            </li>
                          ))}
                          {missing.map((l, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                              <span>{l.replace(/^manquant\s*:\s*/i, '').trim()}</span>
                            </li>
                          ))}
                          {levelLines.filter(l => !l.includes('OK')).map((l, i) => (
                            <li key={`lv${i}`} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠</span>
                              <span>{l.replace(/\(.*\)/, '').trim()}</span>
                            </li>
                          ))}
                          {domainLines.filter(l => !l.includes('match')).map((l, i) => (
                            <li key={`dm${i}`} className="flex items-start gap-2 text-xs text-slate-600">
                              <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠</span>
                              <span>{l.replace(/\(.*\)/, '').trim()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <DialogFooter className="px-7 pb-6 flex gap-3 flex-row border-t bg-white rounded-b-3xl pt-4">
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={decidingLink}
            onClick={() => decideLinkAction(decisionCandidate!.id, "reject")}
          >
            <XCircle className="h-4 w-4 mr-2" /> Rejeter
          </Button>
          <Button
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            disabled={decidingLink}
            onClick={() => decideLinkAction(decisionCandidate!.id, "accept")}
          >
            {decidingLink
              ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              : <CheckCircle className="h-4 w-4 mr-2" />}
            Accepter la liaison
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
