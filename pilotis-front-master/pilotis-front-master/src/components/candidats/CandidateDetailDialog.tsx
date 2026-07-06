import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { User, Phone, Clock, Briefcase, FileText, CheckCircle, AlertTriangle, Star, XCircle } from "lucide-react";
import {
  Candidate,
  LevelBadge,
  ScoreBadge,
  MatchAnalysisPanel,
  sourceIcons,
  sourceLabels
} from "@/pages/Candidats";

interface CandidateDetailDialogProps {
  selectedCandidate: Candidate | null;
  onClose: () => void;
  parsedProfile: (c: Candidate) => any;
  previewCV: (id: number) => void;
}

export const CandidateDetailDialog: React.FC<CandidateDetailDialogProps> = ({
  selectedCandidate,
  onClose,
  parsedProfile,
  previewCV
}) => {
  return (
    <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-0 border-0 shadow-2xl bg-slate-50 gap-0">
        <div className="bg-white px-8 py-6 border-b flex items-start gap-5 sticky top-0 z-10 shadow-sm">
          <div className="h-16 w-16 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner ring-1 ring-black/5 flex-shrink-0">
            <User className="h-8 w-8" />
          </div>
          <div className="pt-1">
            <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              {selectedCandidate?.last_name} {selectedCandidate?.first_name}
            </DialogTitle>
            <div className="mt-2 flex items-center gap-2">
              {selectedCandidate && parsedProfile(selectedCandidate)?.level && (
                <LevelBadge level={parsedProfile(selectedCandidate).level} />
              )}
              {selectedCandidate?.email && <Badge variant="secondary" className="font-mono bg-slate-100 text-slate-600 text-[10px]">{selectedCandidate.email}</Badge>}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {selectedCandidate && (() => {
            const profile = parsedProfile(selectedCandidate);
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Basic info */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-200/60 flex flex-col gap-4">
                    <div><Label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 block">Contact & Source</Label>
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                          <span className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center border"><Phone className="h-3 w-3 text-slate-400"/></span>
                          {selectedCandidate.phone || "Non renseigné"}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                          <span className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center border">{sourceIcons[selectedCandidate.source]}</span>
                          {sourceLabels[selectedCandidate.source] || selectedCandidate.source}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                          <span className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center border"><Clock className="h-3 w-3 text-slate-400"/></span>
                          Reçu le {new Date(selectedCandidate.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Offre */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-200/60">
                    <Label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-3">Offre Associée</Label>
                    {selectedCandidate.job_title ? (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl max-w-fit px-3 py-2 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-bold text-indigo-900">{selectedCandidate.job_title}</span>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-100 border-dashed rounded-xl p-3 text-sm text-slate-500 text-center font-medium">
                        Aucune offre liée
                      </div>
                    )}
                  </div>

                  {/* ── Statut du Dossier ── */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-200/60">
                    <Label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-3">Statut du Dossier</Label>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" /> CV reçu
                        </span>
                        {selectedCandidate.cv_path ? (
                          <button onClick={() => previewCV(selectedCandidate.id)} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                            <CheckCircle className="h-3 w-3" /> Oui — Voir
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                            <AlertTriangle className="h-3 w-3" /> Non reçu
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 font-medium flex items-center gap-2">
                          <Star className="h-4 w-4 text-slate-400" /> Profil IA extrait
                        </span>
                        {selectedCandidate.cv_profile ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                            <CheckCircle className="h-3 w-3" /> Analysé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                            <Clock className="h-3 w-3" /> En attente
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 font-medium flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-slate-400" /> Lié à une offre
                        </span>
                        {selectedCandidate.job_title ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <CheckCircle className="h-3 w-3" /> Oui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                            <XCircle className="h-3 w-3" /> Non
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* IA Extracted Profile */}
                  {profile && (
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-0.5 shadow-md">
                      <div className="bg-white/95 rounded-[15px] p-5 backdrop-blur">
                        <h4 className="text-[11px] font-bold tracking-widest uppercase text-indigo-600 flex items-center gap-2 mb-4">
                          <Star className="h-3.5 w-3.5" /> Analyse IA du CV
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4 mb-5">
                          <div className="bg-slate-50/80 rounded-xl p-3 ring-1 ring-slate-100">
                            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Domaine</p>
                            <p className="text-sm font-bold text-slate-800">{(profile.domain || []).join(", ") || "Non identifié"}</p>
                          </div>
                          <div className="bg-slate-50/80 rounded-xl p-3 ring-1 ring-slate-100">
                            <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Expérience</p>
                            <p className="text-sm font-bold text-slate-800">{profile.total_experience_months || 0} mois</p>
                          </div>
                        </div>

                        {profile.skills_confirmed && Object.keys(profile.skills_confirmed).length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-600 mb-2">Compétences confirmées par les projets :</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(profile.skills_confirmed).slice(0, 8).map(([skill, proofs]: [string, any]) => (
                                <Badge key={skill} variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs px-2 py-0.5 cursor-help" title={(proofs as string[]).join("\n")}>
                                  <CheckCircle className="h-3 w-3 mr-1 opacity-70" />{skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Match Result (Spanning both columns) */}
                {selectedCandidate.matching_score != null && (
                  <div className="col-span-1 md:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 p-5 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-5">
                        <ScoreBadge score={selectedCandidate.matching_score} confidence={selectedCandidate.match_confidence} />
                    </div>
                    <Label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-3">Score de compatibilité</Label>
                    
                    {selectedCandidate.match_justification && (() => {
                      const j = selectedCandidate.match_justification!
                        .replace(/\((\d+) confirm[eé]s?,\s*(\d+) approche[s]?\)/i, '— $1 compétence(s) prouvée(s), $2 technologie(s) proche(s)')
                        .replace(/\((\d+) skills? confirm[eé]s?,\s*niveau (\w+)\)/i, '— $1 compétence(s) validée(s), niveau $2')
                        .replace(/\((\d+) skills? requis?,\s*(\d+) confirm[eé]s?\)/i, '— $2 / $1 compétences trouvées')
                        .replace(/Forte correspondance/, '✅ Forte correspondance')
                        .replace(/Correspondance partielle/, '⚡ Correspondance partielle')
                        .replace(/Faible correspondance/, '⚠️ Faible correspondance')
                        .replace(/Ecart de niveau/, '🚫 Écart de niveau');
                      return <p className="text-sm font-semibold text-slate-800 pr-20">{j}</p>;
                    })()}

                    {selectedCandidate.match_explanation && (
                      <MatchAnalysisPanel
                        explanation={selectedCandidate.match_explanation}
                        score={selectedCandidate.matching_score!}
                        confidence={selectedCandidate.match_confidence}
                      />
                    )}
                  </div>
                )}

                {/* Skills raw spanning both columns */}
                {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                  <div className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 shadow-sm ring-1 ring-slate-200/60 mt-2">
                    <Label className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-3">Toutes les compétences identifiées</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.skills.slice(0, 25).map((skill: string) => (
                        <Badge key={skill} variant="outline" className="text-xs text-slate-600 border-slate-200 bg-slate-50">{skill}</Badge>
                      ))}
                      {selectedCandidate.skills.length > 25 && (
                        <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-500">+{selectedCandidate.skills.length - 25} autres</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
