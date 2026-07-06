import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarCheck, Clock, CheckCircle, XCircle, Video, ExternalLink,
  RefreshCw, FlaskConical, UserCheck, AlertTriangle, ChevronRight, Link2, Info, Trash2
} from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const API = "http://localhost:5000/api";

interface Interview {
  id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  job_id: number;
  job_title: string;
  job_client: string;
  status: string;
  quiz_score: number | null;
  quiz_score_pct: number | null;
  quiz_detail: Array<{ num: string; question: string; is_correct: boolean; given: string; correct: string; explanation: string }> | null;
  quiz_sent_at: string | null;
  quiz_completed_at: string | null;
  interview_date: string | null;
  meet_link: string | null;
  confirmation_sent_at: string | null;
  created_by_email: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Algorithme pour obtenir les jours fériés en France (fixes + calcul de Pâques)
const getFrenchHolidays = (year: number) => {
  const holidays = [
    `${year}-01-01`, // Jour de l'an
    `${year}-05-01`, // Fête du travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ];

  // Date de Pâques (Algorithme de Butcher / Oudin)
  const g = year % 19;
  const c = Math.floor(year / 100);
  const h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30;
  const i = h - Math.floor(h / 28) * (1 - Math.floor(h / 28) * Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11));
  const j = (year + Math.floor(year / 4) + i + 2 - c + Math.floor(c / 4)) % 7;
  const l = i - j;
  const month = 3 + Math.floor((l + 40) / 44);
  const day = l + 28 - 31 * Math.floor(month / 4);
  const easter = new Date(year, month - 1, day);

  const addDays = (d: Date, days: number) => {
    const copy = new Date(d);
    copy.setDate(d.getDate() + days);
    return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
  };

  holidays.push(addDays(easter, 1)); // Lundi de Pâques
  holidays.push(addDays(easter, 39)); // Ascension
  holidays.push(addDays(easter, 50)); // Lundi de Pentecôte

  return holidays;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  // Normalize: if the string has a +xx:xx offset already, use it as-is;
  // if it has no TZ indicator at all (naive UTC from DB), treat it as UTC.
  const normalized = /[Z+\-]\d{2}:?\d{2}$/.test(iso) ? iso
    : iso.endsWith("Z") ? iso
    : iso + "Z";   // naive datetime from DB → treat as UTC
  const d = new Date(normalized);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
};

const ScoreBadge = ({ pct }: { pct: number | null }) => {
  if (pct === null) return <span className="text-slate-400 text-xs">—</span>;
  const color = pct >= 60 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : pct >= 40 ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-red-500/20 text-red-300 border-red-500/30";
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${color}`}>{pct}%</span>;
};

const StatusChip = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; className: string }> = {
    quiz_sent:      { label: "Test envoyé",    className: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
    quiz_completed: { label: "Test complété",  className: "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse" },
    confirmed:      { label: "Confirmé",       className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    rejected:       { label: "Rejeté",         className: "bg-red-500/20 text-red-300 border-red-500/30" },
    cancelled:      { label: "Annulé",         className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  };
  const s = map[status] || { label: status, className: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${s.className}`}>{s.label}</span>;
};

// ── Page principale ───────────────────────────────────────────────────────────
export default function Entretiens() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [calEventModal, setCalEventModal] = useState(false);
  const [calEventInfo, setCalEventInfo] = useState<{
    title: string; job: string; email: string; score: number | null; meet: string | null; date: string | null;
  } | null>(null);
  const [confirmDate, setConfirmDate] = useState("");
  const [confirmMeet, setConfirmMeet] = useState("");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resendingQuiz, setResendingQuiz] = useState<number | null>(null);
  const [calendlyLink, setCalendlyLink] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Valeur minimale pour le date-picker (maintenant, heure locale)
  const nowStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);

  const loadInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/interviews`, { credentials: "include" });
      const data = await res.json();
      setInterviews(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les entretiens", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCalendly = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings`, { credentials: "include" });
      const data = await res.json();
      setCalendlyLink(data.calendly_link || "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadInterviews(); loadCalendly(); }, []);

  const handleConfirm = async () => {
    if (!selectedInterview) return;
    setConfirming(true);
    try {
      const res = await fetch(`${API}/interviews/${selectedInterview.id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes: confirmNotes, calendly_managed: true }),
      });
      if (res.ok) {
        toast({ title: "✅ Entretien confirmé", description: "Calendly a envoyé les invitations automatiquement." });
        setConfirmModal(false);
        setSelectedInterview(null);
        loadInterviews();
      } else {
        const d = await res.json();
        toast({ title: "Erreur", description: d.error, variant: "destructive" });
      }
    } finally { setConfirming(false); }
  };

  const handleReject = async (interview: Interview) => {
    setRejecting(true);
    try {
      await fetch(`${API}/interviews/${interview.id}/reject`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      toast({ title: "Candidat rejeté" });
      loadInterviews();
    } finally { setRejecting(false); }
  };

  const handleDelete = async (iv: Interview) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce test ?")) return;
    setDeletingId(iv.id);
    try {
      const res = await fetch(`${API}/interviews/${iv.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Test supprimé" });
        loadInterviews();
      } else {
        toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleResendQuiz = async (interview: Interview) => {
    setResendingQuiz(interview.id);
    try {
      const res = await fetch(`${API}/interviews/${interview.id}/resend-quiz`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "✅ Email renvoyé", description: `Quiz réenvoyé à ${interview.candidate_email}` });
      } else {
        toast({ title: "Erreur", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de renvoyer", variant: "destructive" });
    } finally {
      setResendingQuiz(null);
    }
  };

  const handleCalendlySync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/calendly/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();
      if (res.ok) {
        toast({
          title: `✅ ${d.updated} entretien(s) synchronisé(s)`,
          description: d.details?.map((x: {candidate: string; date: string}) =>
            `${x.candidate} — ${new Date(x.date).toLocaleString('fr-FR')}`
          ).join(' | ') || "Aucune mise à jour nécessaire"
        });
        if (d.updated > 0) loadInterviews();
      } else {
        toast({ title: "Erreur sync Calendly", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de contacter l'API Calendly", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const pending   = interviews.filter(i => i.status === "quiz_completed");
  const sent     = interviews.filter(i => i.status === "quiz_sent");
  const confirmed = interviews.filter(i => i.status === "confirmed");
  const rejected  = interviews.filter(i => ["rejected", "cancelled"].includes(i.status));

  return (
    <DashboardLayout title="Entretiens">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarCheck className="h-6 w-6 text-indigo-400" />
              Entretiens
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Gestion des tests de présélection et des entretiens Google Meet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCalendlySync} disabled={syncing} className="gap-2">
              {syncing
                ? <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                : <RefreshCw className="h-4 w-4 text-indigo-400" />}
              {syncing ? "Sync..." : "Sync Calendly"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadInterviews} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Actualiser
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Tests en attente", value: pending.length, color: "text-amber-400", icon: <AlertTriangle className="h-5 w-5" /> },
            { label: "Tests envoyés",    value: sent.length,    color: "text-indigo-400", icon: <FlaskConical className="h-5 w-5" /> },
            { label: "Confirmés",        value: confirmed.length, color: "text-emerald-400", icon: <CheckCircle className="h-5 w-5" /> },
            { label: "Rejetés",          value: rejected.length,  color: "text-red-400",   icon: <XCircle className="h-5 w-5" /> },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`${s.color} opacity-80`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left column — tables */}
          <div className="xl:col-span-3 space-y-6">

            {/* Tests complétés — à valider */}
            <Section title="Tests complétés — à valider" badge={pending.length} badgeColor="amber">
              {loading ? <Spinner /> : pending.length === 0
                ? <Empty icon={<FlaskConical />} text="Aucun test en attente de validation" />
                : pending.map(iv => (
                  <InterviewCard key={iv.id} iv={iv}
                    onDetail={() => { setSelectedInterview(iv); setDetailModal(true); }}
                    onConfirm={() => { setSelectedInterview(iv); setConfirmDate(""); setConfirmMeet(""); setConfirmNotes(""); setConfirmModal(true); }}
                    onReject={() => handleReject(iv)}
                    rejecting={rejecting}
                  />
                ))
              }
            </Section>

            {/* Tests envoyés — en attente de réponse */}
            {sent.length > 0 && (
              <Section title="Tests envoyés — en attente de réponse" badge={sent.length} badgeColor="indigo">
                {sent.map(iv => (
                  <div key={iv.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/30 transition">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{iv.candidate_name || iv.candidate_email}</p>
                      <p className="text-xs text-muted-foreground">{iv.job_title} • Envoyé {formatDate(iv.quiz_sent_at)}</p>
                      <p className="text-xs text-muted-foreground">{iv.candidate_email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status={iv.status} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendQuiz(iv)}
                        disabled={resendingQuiz === iv.id}
                        className="h-7 text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        title="Renvoyer l'email du quiz"
                      >
                        {resendingQuiz === iv.id
                          ? <div className="h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          : <RefreshCw className="h-3 w-3" />}
                        Renvoyer
                      </Button>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {/* Entretiens confirmés */}
            <Section title="Entretiens confirmés" badge={confirmed.length} badgeColor="emerald">
              {confirmed.length === 0
                ? <Empty icon={<CalendarCheck />} text="Aucun entretien confirmé pour l'instant" />
                : confirmed.map(iv => (
                  <div key={iv.id} className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-foreground">{iv.candidate_name || iv.candidate_email}</p>
                          <ScoreBadge pct={iv.quiz_score_pct} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{iv.job_title}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(iv.interview_date)}</span>
                          {iv.meet_link && (
                            <a href={iv.meet_link} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                              <Video className="h-3 w-3" /> Google Meet <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDelete(iv)} disabled={deletingId === iv.id}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 transition-colors">
                          {deletingId === iv.id ? "..." : "Supprimer"}
                        </button>
                        <StatusChip status={iv.status} />
                      </div>
                    </div>
                  </div>
                ))
              }
            </Section>
          </div>

          {/* Right column — FullCalendar */}
          <div className="xl:col-span-2">
            <div className="sticky top-6 space-y-3">

              {/* Calendrier interactif */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-emerald-400" />
                    Calendrier des entretiens
                  </h3>
                  <span className="text-xs text-muted-foreground">{confirmed.length} confirmé(s)</span>
                </div>

                <div className="p-2 fc-pilotis">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale="fr"
                    height={420}
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek"
                    }}
                    buttonText={{
                      today: "Aujourd'hui",
                      month: "Mois",
                      week: "Semaine",
                    }}
                    events={confirmed
                      .filter(iv => iv.interview_date)
                      .map(iv => ({
                        id: String(iv.id),
                        title: iv.candidate_name || iv.candidate_email,
                        start: iv.interview_date!.endsWith("Z") ? iv.interview_date! : iv.interview_date! + "Z",
                        backgroundColor: "#10b981",
                        borderColor: "#059669",
                        textColor: "#fff",
                        extendedProps: {
                          job: iv.job_title,
                          meet: iv.meet_link,
                          score: iv.quiz_score_pct,
                          email: iv.candidate_email,
                        }
                      }))
                    }
                    eventClick={({ event }) => {
                      const p = event.extendedProps;
                      setCalEventInfo({
                        title: event.title,
                        job: p.job,
                        email: p.email,
                        score: p.score,
                        meet: p.meet,
                        date: event.startStr,
                      });
                      setCalEventModal(true);
                    }}
                    eventContent={(arg) => {
                      const { event } = arg;
                      const initial = event.title.charAt(0).toUpperCase();
                      const score = event.extendedProps.score;
                      
                      return (
                        <div className="flex items-center gap-1.5 w-full overflow-hidden px-1 py-0.5">
                          <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-white/25 flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                            {initial}
                          </div>
                          <div className="flex-1 truncate text-xs font-medium tracking-tight">
                            {event.title}
                          </div>
                          {score !== null && (
                            <div className="flex-shrink-0 text-[9px] px-1 rounded font-semibold text-white/90 bg-black/10">
                              {score}%
                            </div>
                          )}
                        </div>
                      );
                    }}
                    dayCellClassNames={(arg) => {
                      const d = arg.date;
                      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const holidays = getFrenchHolidays(d.getFullYear());
                      
                      const classes = [];
                      if (d.getDay() === 0 || d.getDay() === 6) classes.push("pilotis-weekend");
                      if (holidays.includes(dateStr)) classes.push("pilotis-holiday");
                      return classes;
                    }}
                    dayMaxEvents={2}
                    moreLinkText="+"
                    eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                  />
                </div>
              </div>

              {/* Légende + liens rapides */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">Entretien Confirmé</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-100 flex-shrink-0 border border-slate-200" />
                    <span className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">Week-end</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-red-50 flex-shrink-0 border border-red-100" />
                    <span className="text-[11px] text-muted-foreground uppercase font-medium tracking-wider">Férié (FR)</span>
                  </div>

                  <span className="ml-auto w-full sm:w-auto">
                    {confirmed.filter(iv => iv.interview_date).length === 0 && (
                      <span className="text-xs text-amber-400">⚠ Synchronisez Calendly pour afficher les dates</span>
                    )}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCalendlySync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
                  >
                    {syncing
                      ? <div className="h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    Sync Calendly
                  </button>
                  <a
                    href="https://calendar.google.com"
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                  >
                    <ExternalLink className="h-3 w-3" /> Google Calendar
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Popup détail entretien (calendrier) ────────────────────────────── */}
      <Dialog open={calEventModal} onOpenChange={setCalEventModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-emerald-400" />
              Détail de l'entretien
            </DialogTitle>
          </DialogHeader>
          {calEventInfo && (
            <div className="space-y-4">
              {/* Header candidat */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{calEventInfo.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{calEventInfo.email}</p>
                </div>
                {calEventInfo.score !== null && <ScoreBadge pct={calEventInfo.score} />}
              </div>

              {/* Infos */}
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground text-xs w-16 flex-shrink-0 mt-0.5">Poste</span>
                  <span className="font-medium">{calEventInfo.job}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground text-xs w-16 flex-shrink-0 mt-0.5">Date</span>
                  <span className="font-medium">{formatDate(calEventInfo.date)}</span>
                </div>
                {calEventInfo.meet && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground text-xs w-16 flex-shrink-0 mt-0.5">Meet</span>
                    <a
                      href={calEventInfo.meet}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs break-all"
                    >
                      <Video className="h-3.5 w-3.5 flex-shrink-0" />
                      Rejoindre Google Meet
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalEventModal(false)}>Fermer</Button>
            {calEventInfo?.meet && (
              <Button
                onClick={() => window.open(calEventInfo.meet!, "_blank")}
                className="bg-indigo-600 hover:bg-indigo-500 gap-2"
              >
                <Video className="h-4 w-4" /> Rejoindre
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmation d'entretien */}
      {/* Modal de planification via Calendly */}
      <Dialog open={confirmModal} onOpenChange={setConfirmModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-indigo-400" />
              Planifier l'entretien
            </DialogTitle>
          </DialogHeader>
          {selectedInterview && (
            <div className="space-y-4">
              {/* Candidat info */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">{selectedInterview.candidate_name || selectedInterview.candidate_email}</p>
                <p className="text-muted-foreground">{selectedInterview.job_title}</p>
                {selectedInterview.quiz_score_pct !== null && (
                  <p className="mt-1">Score test : <ScoreBadge pct={selectedInterview.quiz_score_pct} /></p>
                )}
              </div>

              {/* Bouton Calendly principal */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center space-y-3">
                <CalendarCheck className="h-8 w-8 mx-auto text-indigo-500" />
                <p className="text-sm font-medium text-indigo-800">
                  Planifiez l'entretien directement sur votre agenda Calendly.
                  Calendly créera automatiquement le lien Google Meet et enverra les invitations aux deux parties.
                </p>
                <button
                  type="button"
                  onClick={() => window.open(calendlyLink || "https://calendly.com", "_blank")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Ouvrir Calendly pour planifier
                  <ExternalLink className="h-4 w-4" />
                </button>
                {!calendlyLink && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Lien Calendly non configuré —
                    <button onClick={() => { setConfirmModal(false); }} className="underline ml-1">Configurer</button>
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="inotes">Notes (optionnel)</Label>
                <Textarea
                  id="inotes" rows={2}
                  value={confirmNotes}
                  onChange={e => setConfirmNotes(e.target.value)}
                  placeholder="Instructions pour le candidat…"
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Après avoir planifié sur Calendly, cliquez sur "Confirmé" pour mettre à jour le statut dans Pilotis.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmModal(false)}>Annuler</Button>
            <Button
              disabled={confirming}
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-500 gap-2"
            >
              {confirming
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Traitement…</>
                : <><CheckCircle className="h-4 w-4" /> Marquer comme confirmé</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal détail du test */}
      <Dialog open={detailModal} onOpenChange={setDetailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détail du test — {selectedInterview?.candidate_name}</DialogTitle>
          </DialogHeader>
          {selectedInterview?.quiz_detail && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <ScoreBadge pct={selectedInterview.quiz_score_pct} />
                <span className="text-sm text-muted-foreground">
                  {selectedInterview.quiz_detail.filter(q => q.is_correct).length}/{selectedInterview.quiz_detail.length} bonnes réponses
                </span>
              </div>
              {selectedInterview.quiz_detail.map((q) => (
                <div key={q.num} className={`rounded-lg border p-3 ${q.is_correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                  <div className="flex items-start gap-2 mb-2">
                    {q.is_correct
                      ? <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    }
                    <p className="text-sm font-medium text-foreground">{q.question}</p>
                  </div>
                  <div className="ml-6 text-xs text-muted-foreground space-y-1">
                    <p>Réponse donnée : <span className={q.is_correct ? "text-emerald-400" : "text-red-400"}>{q.given}</span></p>
                    {!q.is_correct && <p>Bonne réponse : <span className="text-emerald-400">{q.correct}</span></p>}
                    <p className="italic mt-1">{q.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModal(false)}>Fermer</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2" onClick={() => { setDetailModal(false); setConfirmDate(""); setConfirmMeet(""); setConfirmNotes(""); setConfirmModal(true); }}>
              <CheckCircle className="h-4 w-4" /> Confirmer l'entretien
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, badge, badgeColor, children }: {
  title: string; badge?: number; badgeColor?: string; children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    amber: "bg-amber-500/20 text-amber-300",
    indigo: "bg-indigo-500/20 text-indigo-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
  };
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        {badge !== undefined && badge > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[badgeColor || "indigo"]}`}>{badge}</span>
        )}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function InterviewCard({ iv, onDetail, onConfirm, onReject, rejecting }: {
  iv: Interview; onDetail: () => void; onConfirm: () => void; onReject: () => void; rejecting: boolean;
}) {
  return (
    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{iv.candidate_name || iv.candidate_email}</p>
            <ScoreBadge pct={iv.quiz_score_pct} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{iv.job_title} • {iv.candidate_email}</p>
          <p className="text-xs text-muted-foreground">Soumis {formatDate(iv.quiz_completed_at)}</p>
        </div>
        <StatusChip status={iv.status} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDetail} className="h-7 text-xs gap-1">
          Voir le détail
        </Button>
        <Button size="sm" onClick={onConfirm} className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500">
          <CheckCircle className="h-3.5 w-3.5" /> Confirmer
        </Button>
        <Button size="sm" variant="ghost" onClick={onReject} disabled={rejecting}
          className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto">
          <XCircle className="h-3.5 w-3.5" /> Rejeter
        </Button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
      <div className="opacity-40">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
