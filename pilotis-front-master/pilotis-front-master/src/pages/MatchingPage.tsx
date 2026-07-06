import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Building2, Calendar, FileText, Trophy, TrendingUp, TrendingDown,
  Eye, Users, Sparkles, User, Briefcase, ChevronRight,
  Bell, ArrowUpRight
} from "lucide-react";

// ==================== INTERFACES ====================
interface Opportunity {
  id: number;
  titre: string;
  client: string;
  date: string;
  budget_ht: number;
  best_match_score?: number;
}

interface CandidateMatch {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  cv_drive_link: string | null;
  match_score: number;
  justification: string;
}

interface CandidateDetail {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  created_at: string;
  cv_drive_link: string | null;
  skills: string[];
  country?: string;
  city?: string;
}

interface OfferDetail {
  requisition_id: number;
  titre: string;
  client_nom: string;
  reference: string;
  description: string;
  criteres: string;
  date_demarrage: string;
  duree: string;
  budget_ht: number;
  etat_complet: string;
  progression: string;
}

interface ApplicationDetail {
  candidate: CandidateDetail;
  offer: OfferDetail;
  match_score: number;
  justification: string;
}

interface NotificationResult {
  success: boolean;
  opportunity_id: number;
  opportunity_title: string;
  notifications_sent: Array<{
    candidate_id: number;
    candidate_email: string;
    candidate_name: string;
    match_score: number;
    rank?: number;
    formation?: string;
    sent: boolean;
  }>;
}

// ==================== STYLES ====================
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

  .m-root * { box-sizing: border-box; }
  .m-root { font-family: 'IBM Plex Sans', sans-serif; background: #f4f7fb; min-height: 100vh; }
  .m-root .fd { font-family: 'Plus Jakarta Sans', sans-serif; }

  @keyframes m-spin { to { transform: rotate(360deg); } }
  @keyframes m-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .m-page { padding: 34px 38px; }

  .m-opp {
    background: #ffffff;
    border: 1px solid #e4eaf3;
    border-radius: 13px;
    padding: 13px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
    animation: m-fadein 0.35s ease both;
  }
  .m-opp:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 14px rgba(37,99,235,0.08), 0 1px 3px rgba(0,0,0,0.03);
    border-color: #93c5fd;
  }
  .m-opp-bar {
    position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    transform: scaleX(0); transform-origin: left;
    transition: transform 0.2s ease;
  }
  .m-opp:hover .m-opp-bar { transform: scaleX(1); }

  .m-cand {
    background: #ffffff;
    border: 1.5px solid #e4eaf3;
    border-radius: 13px;
    padding: 16px 18px;
    cursor: pointer;
    transition: all 0.18s ease;
    animation: m-fadein 0.35s ease both;
  }
  .m-cand:hover { border-color: #93c5fd; box-shadow: 0 3px 14px rgba(59,130,246,0.08); }

  .m-sec {
    border-radius: 13px;
    padding: 17px 20px;
    border: 1.5px solid #e4eaf3;
    background: #f8fafd;
    transition: border-color 0.18s;
  }
  .m-sec:hover { border-color: #bfdbfe; }
  .m-sec-blue  { background: #eff6ff; border-color: #dbeafe; }
  .m-sec-green { background: #f0fdf4; border-color: #bbf7d0; }
  .m-sec-amber { background: #fffbeb; border-color: #fde68a; }

  .m-dlg {
    background: #f8fafd !important;
    border: 1.5px solid #dde4f0 !important;
    border-radius: 21px !important;
    box-shadow: 0 30px 66px rgba(15,23,42,0.12), 0 4px 14px rgba(0,0,0,0.05) !important;
    color: #1e293b !important;
  }

  .m-ring {
    width: 51px; height: 51px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 800; font-size: 11.5px; flex-shrink: 0;
  }

  .m-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3.5px 11px; border-radius: 999px;
    font-size: 10.5px; font-weight: 600;
    background: #eff6ff; color: #2563eb;
    border: 1px solid #bfdbfe;
  }

  .m-tag {
    display: inline-flex; align-items: center;
    padding: 3.5px 11px; border-radius: 7px;
    font-size: 10.5px; font-weight: 500;
    background: #f1f5f9; color: #475569;
    border: 1px solid #e2e8f0;
  }
  .m-tag-blue { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
  .m-skill-toggle { margin-top: 10px; font-size: 11px; color: #3b82f6; cursor: pointer; background: none; border: none; font-family: inherit; padding: 0; }
  .m-skill-toggle:hover { text-decoration: underline; }

  .m-ico {
    width: 28px; height: 28px; border-radius: 8.5px;
    background: #eff6ff; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
  }

  .m-nbtn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 9.5px;
    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
    color: #fff; font-size: 12.5px; font-weight: 600;
    border: none; cursor: pointer;
    font-family: 'IBM Plex Sans', sans-serif;
    transition: all 0.18s;
  }
  .m-nbtn:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
  .m-nbtn:disabled { opacity: 0.5; cursor: not-allowed; }

  .m-cbtn {
    padding: 9px 24px; border-radius: 9.5px;
    background: #fff; border: 1.5px solid #dde4f0;
    color: #64748b; font-size: 12.5px; font-weight: 600;
    cursor: pointer;
    font-family: 'IBM Plex Sans', sans-serif;
    transition: all 0.15s;
  }
  .m-cbtn:hover { background: #f1f5f9; border-color: #cbd5e1; color: #334155; }

  .m-lbl { font-size: 9.5px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.55px; margin-bottom: 2.5px; }
  .m-val { font-size: 12.5px; color: #334155; font-weight: 500; }

  .m-hr { border: none; border-top: 1.5px solid #e8eef6; margin: 13px 0; }
  
  .m-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 300px;
    background: #ffffff; border: 2px dashed #dde4f0; border-radius: 19px;
    padding: 44px; gap: 13px;
    animation: m-fadein 0.4s ease;
  }
`;

const Spinner = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "46px 0", gap: 12 }}>
    <div style={{ width: 37, height: 37, border: "3px solid #bfdbfe", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "m-spin 0.8s linear infinite" }} />
    <p style={{ color: "#94a3b8", fontSize: 12.5 }}>Chargement…</p>
  </div>
);

const MatchingPage = () => {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [candidates, setCandidates] = useState<CandidateMatch[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationDetail | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notificationResult, setNotificationResult] = useState<NotificationResult | null>(null);
  const { toast } = useToast();

  // ✅ Nouveau state pour gérer l'affichage des compétences du candidat
  const [showAllCandidateSkills, setShowAllCandidateSkills] = useState(false);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/opportunities/cibles", { credentials: "include" });
      const data = await res.json();
      setOpportunities(data.opportunites || []);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les opportunités", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async (opp: Opportunity) => {
    setDialogLoading(true);
    setSelectedOpportunity(opp);
    setShowDialog(true);
    setNotificationResult(null);
    try {
      const res = await fetch(`http://localhost:5000/api/candidates/match-for-opportunity/${opp.id}`, { credentials: "include" });
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les candidats", variant: "destructive" });
      setCandidates([]);
    } finally {
      setDialogLoading(false);
    }
  };

  const loadDetails = async (candidateId: number, opportunityId: number, matchScore: number, justification: string) => {
    setDetailLoading(true);
    setShowAllCandidateSkills(false); // Réinitialiser l'affichage des compétences
    try {
      const [cr, or] = await Promise.all([
        fetch(`http://localhost:5000/api/candidates/${candidateId}`, { credentials: "include" }),
        fetch(`http://localhost:5000/api/opportunities/${opportunityId}`, { credentials: "include" }),
      ]);
      const [cd, od] = await Promise.all([cr.json(), or.json()]);
      setSelectedApplication({ candidate: cd, offer: od, match_score: matchScore, justification });
      setShowDetailDialog(true);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les détails", variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  const notifyTopCandidates = async (id: number) => {
    setNotifying(true);
    setNotificationResult(null);
    try {
      const res = await fetch(`http://localhost:5000/api/notify-top-candidates/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        setNotificationResult(data);
        const sent = data.notifications_sent?.filter((n: any) => n.sent).length || 0;
        toast({ title: "✅ Notifications envoyées", description: `${sent} candidat(s) notifié(s)` });
      } else {
        toast({ title: "Erreur", description: data.error || "Erreur inconnue", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible d'envoyer les notifications", variant: "destructive" });
    } finally {
      setNotifying(false);
    }
  };

  const viewCV = (link: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(link, "_blank");
  };

  const scoreStyle = (s: number) => {
    if (s >= 70) {
      return { bg: "#dcfce7", border: "#86efac", text: "#15803d", shadow: "rgba(22,163,74,0.13)" };
    }
    if (s >= 40) {
      return { bg: "#fef9c3", border: "#fde047", text: "#b45309", shadow: "rgba(234,179,8,0.13)" };
    }
    return { bg: "#fee2e2", border: "#fca5a5", text: "#b91c1c", shadow: "rgba(239,68,68,0.13)" };
  };

  const ScoreRing = ({ score }: { score: number }) => {
    const s = scoreStyle(score);
    return (
      <div className="m-ring" style={{ background: s.bg, border: `2px solid ${s.border}`, color: s.text, boxShadow: `0 0 0 3.5px ${s.shadow}` }}>
        {score}%
      </div>
    );
  };

  useEffect(() => {
    loadOpportunities();
    const interval = setInterval(loadOpportunities, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Matching CV / Offres">
        <style>{css}</style>
        <div className="m-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 46, height: 46, border: "3px solid #bfdbfe", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "m-spin 0.8s linear infinite", margin: "0 auto" }} />
            <p style={{ color: "#94a3b8", marginTop: 17, fontSize: 12 }}>Chargement des opportunités…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Matching CV / Offres">
      <style>{css}</style>
      <div className="m-root">
        <div className="m-page">

          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 4.5, height: 34, borderRadius: 3, background: "linear-gradient(180deg,#3b82f6,#60a5fa)", flexShrink: 0 }} />
              <div>
                <h1 className="fd" style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.35px", marginBottom: 3.5 }}>Matching CV / Offres</h1>
                <p style={{ fontSize: 12.5, color: "#94a3b8" }}>Sélectionnez une opportunité pour révéler les meilleurs profils</p>
              </div>
            </div>
            <span className="m-chip" style={{ fontSize: 11.5, padding: "4.5px 13px" }}>
              <Sparkles style={{ width: 10.5, height: 10.5 }} />
              {opportunities.length} opportunité{opportunities.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* GRID / EMPTY */}
          {opportunities.length === 0 ? (
            <div className="m-empty">
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 style={{ width: 26, height: 26, color: "#3b82f6" }} />
              </div>
              <p className="fd" style={{ fontWeight: 700, color: "#334155", fontSize: 14.5 }}>Aucune opportunité cette semaine</p>
              <p style={{ color: "#94a3b8", fontSize: 12.5 }}>Les nouvelles opportunités apparaîtront automatiquement</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
              {opportunities.map((opp, idx) => (
                <div key={opp.id} className="m-opp" onClick={() => loadCandidates(opp)}>
                  <div className="m-opp-bar" />
                  <div className="fd" style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 700, color: "#bfdbfe", letterSpacing: 0.8 }}>#{String(idx + 1).padStart(2, "0")}</div>

                  <h3 className="fd" style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.35, marginBottom: 10, paddingRight: 26 }}>{opp.titre}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div className="m-ico" style={{ width: 24, height: 24 }}><Building2 style={{ width: 11, height: 11, color: "#3b82f6" }} /></div>
                      <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.client}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div className="m-ico" style={{ width: 24, height: 24 }}><Calendar style={{ width: 11, height: 11, color: "#3b82f6" }} /></div>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{opp.date || "Date non spécifiée"}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3 }}>
                      <Users style={{ width: 9, height: 9 }} /> Voir candidats
                    </span>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ChevronRight style={{ width: 11, height: 11, color: "#3b82f6" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODALE CANDIDATS */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) {
          setCandidates([]);
          setNotificationResult(null);
        }
      }}>
        <DialogContent className="m-dlg" style={{ maxWidth: 700, maxHeight: "86vh", overflowY: "auto" }}>
          <style>{css}</style>
          <div className="m-root" style={{ padding: "3px 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 3 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "#fef9c3", border: "1.5px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Sparkles style={{ width: 18, height: 18, color: "#b45309" }} />
              </div>
              <div>
                <h2 className="fd" style={{ fontSize: 17.5, fontWeight: 800, color: "#0f172a" }}>Top 3 candidats</h2>
                <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 1.5 }}>{selectedOpportunity?.titre}</p>
              </div>
            </div>
            <hr className="m-hr" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span className="m-chip"><Building2 style={{ width: 9.5, height: 9.5 }} />{selectedOpportunity?.client}</span>
                {selectedOpportunity?.date && (
                  <span className="m-chip"><Calendar style={{ width: 9.5, height: 9.5 }} />{selectedOpportunity.date}</span>
                )}
              </div>
              <button className="m-nbtn" onClick={() => notifyTopCandidates(selectedOpportunity!.id)} disabled={notifying || candidates.length === 0}>
                {notifying ? (
                  <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "m-spin 0.8s linear infinite" }} />
                ) : (
                  <Bell style={{ width: 13, height: 13 }} />
                )}
                Notifier {candidates.length} candidat{candidates.length !== 1 ? "s" : ""}
              </button>
            </div>

            {notificationResult && (
              <div style={{ marginBottom: 18, padding: "11px 15px", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 11 }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: "#15803d", marginBottom: 7 }}>✅ Notifications envoyées — Top 3 pour « {notificationResult.opportunity_title} »</p>
                {notificationResult.notifications_sent?.slice(0, 3).map((n, i) => {
                  const rankLabel = n.rank === 1 ? "🥇 1er" : n.rank === 2 ? "🥈 2e" : "🥉 3e";
                  return (
                    <div key={i} style={{ fontSize: 11.5, color: "#166534", display: "flex", flexDirection: "column", marginTop: 6, paddingTop: 6, borderTop: i > 0 ? "1px solid #bbf7d0" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5.5 }}>
                        <span style={{ color: n.sent ? "#16a34a" : "#dc2626" }}>{n.sent ? "✓" : "✗"}</span>
                        <span style={{ fontWeight: 600 }}>{rankLabel} — {n.candidate_name}</span>
                        <span style={{ marginLeft: "auto", background: "#dcfce7", color: "#166534", fontSize: 10.5, padding: "1px 6px", borderRadius: 6 }}>{n.match_score}%</span>
                      </div>
                      {n.formation && (
                        <span style={{ fontSize: 10.5, color: "#4b7c55", marginTop: 2, marginLeft: 16 }}>🎓 {n.formation}</span>
                      )}
                      <span style={{ fontSize: 10.5, color: "#6b7280", marginTop: 1, marginLeft: 16 }}>{n.candidate_email}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {dialogLoading ? (
              <Spinner />
            ) : candidates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 13px" }}>
                  <Users style={{ width: 24, height: 24, color: "#cbd5e1" }} />
                </div>
                <p className="fd" style={{ fontWeight: 700, color: "#475569", fontSize: 13.5 }}>Aucun candidat trouvé</p>
                <p style={{ color: "#94a3b8", fontSize: 11.5, marginTop: 4.5 }}>Le matching analyse les CV toutes les heures</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {candidates.map((c, idx) => (
                  <div key={c.id} className="m-cand" onClick={() => loadDetails(c.id, selectedOpportunity!.id, c.match_score, c.justification)}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4.5 }}>
                        <span className="fd" style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8" }}>#{idx + 1}</span>
                        <ScoreRing score={c.match_score} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                          <div>
                            <h3 className="fd" style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a" }}>{c.first_name} {c.last_name}</h3>
                            <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 1.5 }}>{c.email}</p>
                          </div>
                          <div style={{ display: "flex", gap: 5 }}>
                            {c.cv_drive_link && (
                              <button onClick={(e) => viewCV(c.cv_drive_link!, e)} style={{ width: 29, height: 29, borderRadius: 7.5, background: "#eff6ff", border: "1.5px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                <FileText style={{ width: 12.5, height: 12.5, color: "#3b82f6" }} />
                              </button>
                            )}
                            <div style={{ width: 29, height: 29, borderRadius: 7.5, background: "#f8fafc", border: "1.5px solid #e4eaf3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <ChevronRight style={{ width: 12.5, height: 12.5, color: "#94a3b8" }} />
                            </div>
                          </div>
                        </div>
                        {c.justification && (
                          <div style={{ padding: "9px 13px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 8.5, marginTop: 7 }}>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#92400e", marginBottom: 2.5, display: "flex", alignItems: "center", gap: 4.5 }}>
                              <Sparkles style={{ width: 9.5, height: 9.5 }} /> Analyse IA
                            </p>
                            <p style={{ fontSize: 11.5, color: "#78350f", lineHeight: 1.5 }}>{c.justification.substring(0, 105)}…</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODALE DÉTAIL CANDIDATURE AVEC SYSTÈME "VOIR PLUS" POUR LES COMPÉTENCES */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => {
        setShowDetailDialog(open);
        if (!open) {
          setShowAllCandidateSkills(false);
        }
      }}>
        <DialogContent className="m-dlg" style={{ maxWidth: 660, maxHeight: "90vh", overflowY: "auto" }}>
          <style>{css}</style>
          <div className="m-root" style={{ padding: "3px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "#eff6ff", border: "1.5px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileText style={{ width: 17, height: 17, color: "#3b82f6" }} />
              </div>
              <h2 className="fd" style={{ fontSize: 17.5, fontWeight: 800, color: "#0f172a" }}>Détail de la candidature</h2>
            </div>

            {detailLoading ? (
              <Spinner />
            ) : selectedApplication ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {/* Candidat */}
                <div className="m-sec m-sec-blue" style={{ cursor: "pointer" }}
                  onClick={() => {
                    setShowDetailDialog(false);
                    navigate(`/candidats?candidate=${selectedApplication.candidate.id}`);
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8.5, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <User style={{ width: 14, height: 14, color: "#2563eb" }} />
                      </div>
                      <span className="fd" style={{ fontWeight: 700, fontSize: 13.5, color: "#1e40af" }}>Profil candidat</span>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 4.5, fontSize: 11.5, color: "#3b82f6", fontWeight: 600 }}>
                      Voir le profil <ArrowUpRight style={{ width: 11.5, height: 11.5 }} />
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                    <div><p className="m-lbl">Nom complet</p><p className="m-val">{selectedApplication.candidate.first_name} {selectedApplication.candidate.last_name}</p></div>
                    <div><p className="m-lbl">Email</p><p className="m-val" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{selectedApplication.candidate.email}</p></div>
                    <div><p className="m-lbl">Téléphone</p><p className="m-val">{selectedApplication.candidate.phone || "—"}</p></div>
                    <div><p className="m-lbl">Source</p><p className="m-val">{selectedApplication.candidate.source || "—"}</p></div>
                    <div><p className="m-lbl">Score matching</p><p className="m-val" style={{ color: "#2563eb", fontWeight: 700 }}>{selectedApplication.match_score}%</p></div>
                    <div><p className="m-lbl">Date candidature</p><p className="m-val">{selectedApplication.candidate.created_at ? new Date(selectedApplication.candidate.created_at).toLocaleDateString("fr-FR") : "—"}</p></div>
                    {selectedApplication.candidate.country && (
                      <div style={{ gridColumn: "span 2" }}>
                        <p className="m-lbl">Localisation</p>
                        <p className="m-val">{selectedApplication.candidate.country}{selectedApplication.candidate.city && ` · ${selectedApplication.candidate.city}`}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Offre */}
                <div className="m-sec m-sec-green" style={{ cursor: "pointer" }}
                  onClick={() => { setShowDetailDialog(false); navigate(`/appels-offres?opportunity=${selectedApplication.offer.requisition_id}`); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8.5, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Briefcase style={{ width: 14, height: 14, color: "#16a34a" }} />
                    </div>
                    <span className="fd" style={{ fontWeight: 700, fontSize: 13.5, color: "#166534" }}>Détails de l'offre</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4.5, fontSize: 11.5, color: "#16a34a", fontWeight: 600, marginLeft: "auto" }}>
                      Voir l'offre <ArrowUpRight style={{ width: 11.5, height: 11.5 }} />
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                    <div style={{ gridColumn: "span 2" }}><p className="m-lbl">Titre du poste</p><p className="fd" style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>{selectedApplication.offer.titre}</p></div>
                    <div><p className="m-lbl">Client</p><p className="m-val">{selectedApplication.offer.client_nom}</p></div>
                    <div><p className="m-lbl">Référence</p><p className="m-val">{selectedApplication.offer.reference || "—"}</p></div>
                    <div><p className="m-lbl">Démarrage</p><p className="m-val">{selectedApplication.offer.date_demarrage || "—"}</p></div>
                    <div><p className="m-lbl">Durée</p><p className="m-val">{selectedApplication.offer.duree || "—"}</p></div>
                    <div><p className="m-lbl">Budget HT</p><p className="m-val">{selectedApplication.offer.budget_ht ? `${selectedApplication.offer.budget_ht.toLocaleString()} €` : "—"}</p></div>
                    <div><p className="m-lbl">Progression</p><p className="m-val">{selectedApplication.offer.progression || "0/25%"}</p></div>
                    <div><p className="m-lbl">Statut</p><p className="m-val">{selectedApplication.offer.etat_complet || "En cours"}</p></div>
                  </div>
                </div>

                {/* Description */}
                {selectedApplication.offer.description && (
                  <div className="m-sec">
                    <p className="fd" style={{ fontWeight: 700, fontSize: 12.5, color: "#475569", marginBottom: 9, display: "flex", alignItems: "center", gap: 6.5 }}>
                      <FileText style={{ width: 12.5, height: 12.5 }} /> Description du poste
                    </p>
                    <p style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.68, whiteSpace: "pre-wrap" }}>{selectedApplication.offer.description}</p>
                  </div>
                )}

                {/* Compétences requises */}
                {selectedApplication.offer.criteres && (
                  <div className="m-sec">
                    <p className="fd" style={{ fontWeight: 700, fontSize: 12.5, color: "#475569", marginBottom: 11, display: "flex", alignItems: "center", gap: 6.5 }}>
                      <TrendingUp style={{ width: 12.5, height: 12.5 }} /> Compétences requises
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5.5 }}>
                      {selectedApplication.offer.criteres.split(",").slice(0, 8).map((sk, i) => (
                        <span key={i} className="m-tag m-tag-blue">{sk.trim()}</span>
                      ))}
                      {selectedApplication.offer.criteres.split(",").length > 8 && (
                        <span className="m-tag">+{selectedApplication.offer.criteres.split(",").length - 8}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Justification IA */}
                <div className="m-sec m-sec-amber">
                  <p className="fd" style={{ fontWeight: 700, fontSize: 12.5, color: "#92400e", marginBottom: 9, display: "flex", alignItems: "center", gap: 6.5 }}>
                    <Sparkles style={{ width: 12.5, height: 12.5 }} /> Analyse IA — Justification du score
                  </p>
                  <p style={{ fontSize: 12.5, color: "#78350f", lineHeight: 1.68 }}>{selectedApplication.justification || "Analyse non disponible"}</p>
                </div>

                {/* CV */}
                {selectedApplication.candidate.cv_drive_link && (
                  <div className="m-sec" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 11, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9.5, background: "#eff6ff", border: "1.5px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileText style={{ width: 16, height: 16, color: "#3b82f6" }} />
                      </div>
                      <div>
                        <p className="m-lbl">Curriculum Vitæ</p>
                        <p className="fd" style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>Document disponible</p>
                      </div>
                    </div>
                    <a href={selectedApplication.candidate.cv_drive_link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5.5, padding: "8px 16px", borderRadius: 8.5, background: "#eff6ff", border: "1.5px solid #bfdbfe", color: "#2563eb", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                      <Eye style={{ width: 13, height: 13 }} /> Ouvrir le CV
                    </a>
                  </div>
                )}

                {/* Compétences candidat AVEC SYSTÈME "VOIR PLUS" */}
                {selectedApplication.candidate.skills && selectedApplication.candidate.skills.length > 0 && (
                  <div className="m-sec">
                    <p className="fd" style={{ fontWeight: 700, fontSize: 12.5, color: "#475569", marginBottom: 11, display: "flex", alignItems: "center", gap: 6.5 }}>
                      <Users style={{ width: 12.5, height: 12.5 }} /> Compétences du candidat
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5.5 }}>
                      {(showAllCandidateSkills ? selectedApplication.candidate.skills : selectedApplication.candidate.skills.slice(0, 10)).map((sk, i) => (
                        <span key={i} className="m-tag">{sk}</span>
                      ))}
                    </div>
                    {selectedApplication.candidate.skills.length > 10 && (
                      <button
                        onClick={() => setShowAllCandidateSkills(!showAllCandidateSkills)}
                        className="m-skill-toggle"
                      >
                        {showAllCandidateSkills ? 'Voir moins' : `+${selectedApplication.candidate.skills.length - 10} autres compétences`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
              <button className="m-cbtn" onClick={() => setShowDetailDialog(false)}>Fermer</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MatchingPage;