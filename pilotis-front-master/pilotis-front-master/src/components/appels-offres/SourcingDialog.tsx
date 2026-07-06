import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Users2, CheckCircle, AlertTriangle, XCircle, MapPin, Briefcase, ChevronUp, ChevronDown, FileText } from "lucide-react";

export interface SourcingCandidate {
  id: number;
  last_name: string;
  first_name: string;
  email: string;
  phone?: string;
  source?: string;
  score: number;
  justification: string;
  explanation?: string;
  confidence?: "high" | "medium" | "low";
  cv_path?: boolean;
  skills?: string[];
  location?: string;
  linking?: boolean;
  linked?: boolean;
}

interface SourcingDialogProps {
  show: boolean;
  onShowChange: (show: boolean) => void;
  sourcingJob: any;
  sourcingLoading: boolean;
  sourcingCandidates: SourcingCandidate[];
  sourcingScanned: number;
  expandedExplanation: number | null;
  setExpandedExplanation: (id: number | null) => void;
  linkCandidateToJob: (candidate: SourcingCandidate) => void;
}

export const SourcingDialog: React.FC<SourcingDialogProps> = ({
  show,
  onShowChange,
  sourcingJob,
  sourcingLoading,
  sourcingCandidates,
  sourcingScanned,
  expandedExplanation,
  setExpandedExplanation,
  linkCandidateToJob,
}) => {
  return (
    <Dialog open={show} onOpenChange={onShowChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-0 shadow-2xl rounded-2xl gap-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 flex items-start gap-4 flex-shrink-0">
          <div className="h-11 w-11 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 backdrop-blur">
            <Users2 className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white font-bold text-lg tracking-tight truncate">
              Sourcing Proactif — {sourcingJob?.titre}
            </DialogTitle>
            <p className="text-violet-200 text-sm mt-0.5">
              {sourcingLoading
                ? "Analyse en cours..."
                : `${sourcingCandidates.length} profil(s) compatible(s) trouvé(s) sur ${sourcingScanned} candidats analysés`
              }
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          {sourcingLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Users2 className="h-6 w-6 text-violet-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-violet-700">Analyse IA du vivier en cours...</p>
                <p className="text-xs text-slate-500 mt-1">Recherche des profils correspondants</p>
              </div>
            </div>
          ) : sourcingCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center">
                <Users2 className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-base font-semibold text-slate-700">Aucun profil compatible trouvé</p>
              <p className="text-sm text-slate-500 max-w-xs">
                {sourcingScanned === 0
                  ? "Aucun candidat avec un profil IA analysé dans la base."
                  : `Sur ${sourcingScanned} candidats disponibles, aucun n'atteint le seuil de compatibilité minimum.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sourcingCandidates.map((candidate) => {
                const scoreColor =
                  candidate.score >= 65 ? "text-emerald-700 bg-emerald-50 border-emerald-200 ring-emerald-500/20" :
                  candidate.score >= 40 ? "text-amber-700 bg-amber-50 border-amber-200 ring-amber-500/20" :
                  "text-slate-700 bg-slate-50 border-slate-200 ring-slate-500/20";
                const scoreIcon =
                  candidate.score >= 65 ? <CheckCircle className="h-3.5 w-3.5" /> :
                  candidate.score >= 40 ? <AlertTriangle className="h-3.5 w-3.5" /> :
                  <XCircle className="h-3.5 w-3.5" />;
                const isExpanded = expandedExplanation === candidate.id;

                return (
                  <div
                    key={candidate.id}
                    className={`bg-white rounded-xl border shadow-sm transition-all duration-200 overflow-hidden ${
                      candidate.linked ? "border-emerald-300 ring-1 ring-emerald-400/30" : "border-slate-200"
                    }`}
                  >
                    <div className="p-4 flex items-start gap-4">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center flex-shrink-0 text-violet-700 font-bold text-sm">
                        {(candidate.last_name?.[0] || candidate.email?.[0] || "?").toUpperCase()}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">
                            {candidate.last_name} {candidate.first_name || "—"}
                          </p>
                          {/* Badge CV */}
                          {candidate.cv_path ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <FileText className="h-3 w-3" /> CV reçu
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                              <AlertTriangle className="h-3 w-3" /> Sans CV
                            </span>
                          )}
                          {candidate.linked && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle className="h-3 w-3" /> Associé
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{candidate.email}</p>
                        {candidate.location && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{candidate.location}
                          </p>
                        )}
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{candidate.justification}</p>
                        {/* Skills */}
                        {candidate.skills && candidate.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {candidate.skills.slice(0, 5).map(s => (
                              <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">{s}</span>
                            ))}
                            {candidate.skills.length > 5 && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">+{candidate.skills.length - 5}</span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Score + Action */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ring-1 ring-inset text-xs font-semibold ${scoreColor}`}>
                          {scoreIcon}{candidate.score}%
                        </span>
                        {!candidate.linked ? (
                          <button
                            onClick={() => linkCandidateToJob(candidate)}
                            disabled={candidate.linking}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-60"
                          >
                            {candidate.linking ? (
                              <><div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Association...</>
                            ) : (
                              <><Briefcase className="h-3 w-3" />Associer</>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-600 font-medium">✓ Lié</span>
                        )}
                      </div>
                    </div>
                    {/* Explication détaillée rétractable */}
                    {candidate.explanation && (
                      <div className="border-t border-slate-100">
                        <button
                          onClick={() => setExpandedExplanation(isExpanded ? null : candidate.id)}
                          className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          <span className="font-medium">Analyse IA détaillée</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3">
                            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100 max-h-40 overflow-y-auto">
                              {candidate.explanation}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-white px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
          <p className="text-xs text-slate-500">
            {!sourcingLoading && sourcingScanned > 0 && (
              <span>{sourcingCandidates.filter(c => c.linked).length} profil(s) associé(s) sur cette session</span>
            )}
          </p>
          <button
            onClick={() => onShowChange(false)}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
