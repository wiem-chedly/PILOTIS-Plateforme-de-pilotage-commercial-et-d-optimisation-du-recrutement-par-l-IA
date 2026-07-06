import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ReactCountryFlag from "react-country-flag";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search, FileText, Linkedin, Mail, Globe, UserPlus, MessageSquare, ThumbsUp,
  Eye, ArrowUpDown, Trash2, Phone, Briefcase, User, RefreshCw,
  CheckCircle, AlertTriangle, XCircle, Info, Star, TrendingUp, Clock, Layers, FlaskConical, Building2
} from "lucide-react";

import { CandidateDetailDialog } from "@/components/candidats/CandidateDetailDialog";
import { DecisionDialog } from "@/components/candidats/DecisionDialog";
import { SendEmailDialog } from "@/components/candidats/SendEmailDialog";


// ── Types ────────────────────────────────────────────────────────────────────
export interface Candidate {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  source: string;
  cv_path?: string;
  created_at: string;
  job_title?: string;
  job_requisition_id?: number;
  company?: string;
  contact_name?: string;
  matching_score?: number;
  match_justification?: string;
  match_explanation?: string;
  match_confidence?: "high" | "medium" | "low";
  skills?: string[];
  cv_profile?: string;
  // Liaison suggérée par référence email
  link_status?: "confirmed" | "suggested" | "rejected";
  suggested_job_id?: number;
  suggested_job_title?: string;
  // Localisation détectée automatiquement
  location?: string;
  linkedin_profile_url?: string;
  app_status?: "accepted" | "rejected" | "pending";
  application_id?: number;
}

interface Opportunity {
  id: number;
  titre: string;
  reference?: string;
  score: number;
  justification?: string;
  explanation?: string;
  confidence?: string;
}

// ── Source icons / labels ─────────────────────────────────────────────────────

// ==================== STYLES CSS WIEM ====================
const wiemStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  .candidates-pro * { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; box-sizing: border-box; }

  .cpro-table-card { background: #FFFFFF; border: 1px solid #E8EDF3; border-radius: 14px; overflow-x: auto; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .cpro-table { width: 100%; border-collapse: collapse; min-width: 950px; }
  .cpro-table thead tr { background: #FAFBFC; border-bottom: 1px solid #EDF0F5; }
  .cpro-table th { padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #9CA3AF; white-space: nowrap; }
  .cpro-table td { padding: 10px 8px; font-size: 13px; font-weight: 400; color: #374151; border-bottom: 1px solid #F3F5F8; vertical-align: middle; white-space: nowrap; }
  .cpro-table tbody tr { transition: background 0.12s; cursor: pointer; }
  .cpro-table tbody tr:hover { background: #FAFBFF; }
  .cpro-table tbody tr:last-child td { border-bottom: none; }

  .cpro-src { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 5px; font-size: 11px; font-weight: 500; border: 1px solid; }
  .cpro-src-linkedin { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }
  .cpro-src-email    { background: #FFF8F0; color: #B45309; border-color: #FDE68A; }
  .cpro-src-manual   { background: #F8FAFC; color: #64748B; border-color: #E2E8F0; }

  .cpro-status { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 18px; font-size: 11px; font-weight: 500; }
  .cpro-status-pending  { background: #FFF8EC; color: #B45309; }
  .cpro-status-accepted { background: #ECFDF5; color: #047857; }
  .cpro-status-rejected { background: #FEF2F2; color: #B91C1C; }

  .cpro-actions { display: flex; align-items: center; gap: 3px; }
  .cpro-btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid transparent; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; background: transparent; }
  .cpro-btn-phone   { color: #059669; background: #F0FDF4; border-color: #D1FAE5; }
  .cpro-btn-phone:hover { background: #D1FAE5; }
  .cpro-btn-email   { color: #2563EB; background: #EFF6FF; border-color: #BFDBFE; }
  .cpro-btn-email:hover { background: #DBEAFE; }
  .cpro-btn-linkedin{ color: #1D4ED8; background: #EFF6FF; border-color: #BFDBFE; }
  .cpro-btn-linkedin:hover { background: #DBEAFE; }
  .cpro-btn-cv      { color: #7C3AED; background: #F5F3FF; border-color: #DDD6FE; }
  .cpro-btn-cv:hover{ background: #EDE9FE; }
  .cpro-btn-delete  { color: #DC2626; background: #FEF2F2; border-color: #FECACA; }
  .cpro-btn-delete:hover { background: #FEE2E2; }
  .cpro-btn-link    { color: #D97706; background: #FFFBEB; border-color: #FDE68A; }
  .cpro-btn-link:hover { background: #FEF3C7; }
  .cpro-btn-quiz    { color: #4F46E5; background: #EEF2FF; border-color: #C7D2FE; }
  .cpro-btn-quiz:hover { background: #E0E7FF; }
  .cpro-btn-view    { color: #4B5563; background: #F3F4F6; border-color: #E5E7EB; }
  .cpro-btn-view:hover { background: #E5E7EB; }
  .cpro-btn-reanalyze { color: #10B981; background: #ECFDF5; border-color: #A7F3D0; }
  .cpro-btn-reanalyze:hover { background: #D1FAE5; }

  .cpro-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50px 20px; }
  .cpro-empty-icon { width: 46px; height: 46px; background: #F3F4F6; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .cpro-muted { color: #D1D5DB; }
  .sort-active { color: #6366F1 !important; }
`;

const getCountryCode = (country: string) => {
  if (!country) return '';
  const codes: Record<string, string> = {
    'France': 'FR', 'Belgique': 'BE', 'Suisse': 'CH', 'Tunisie': 'TN', 'Maroc': 'MA',
    'Algérie': 'DZ', 'Canada': 'CA', 'Sénégal': 'SN',
  };
  for (const [key, code] of Object.entries(codes))
    if (key.toLowerCase() === country.toLowerCase()) return code;
  return '';
};

// =========================================================

export const sourceIcons: Record<string, React.ReactNode> = {
  linkedin_message: <Linkedin className="h-4 w-4 text-[#0A66C2]" />,
  LinkedIn: <Linkedin className="h-4 w-4 text-white" />,
  email: <Mail className="h-4 w-4 text-amber-500" />,
  linkedin_like: <ThumbsUp className="h-4 w-4 text-[#0A66C2]" />,
  linkedin_comment: <MessageSquare className="h-4 w-4 text-[#0A66C2]" />,
  sourcing: <UserPlus className="h-4 w-4 text-green-600" />,
  manual: <UserPlus className="h-4 w-4 text-gray-400" />,
  web: <Globe className="h-4 w-4 text-gray-400" />,
};
export const sourceLabels: Record<string, string> = {
  linkedin_message: "LinkedIn",
  LinkedIn: "LinkedIn",
  email: "Email",
  linkedin_like: "LinkedIn Like",
  linkedin_comment: "LinkedIn Comment",
  sourcing: "Sourcing",
  manual: "Manuel",
  web: "Web",
};
const pageTitles: Record<string, string> = {
  email: "Candidatures par Email",
  linkedin_message: "Candidatures LinkedIn",
  sourcing: "Candidatures Sourcing",
  manual: "Candidatures Manuel",
};

// ── Score badge ───────────────────────────────────────────────────────────────
export const ScoreBadge = ({ score, confidence }: { score?: number; confidence?: string }) => {
  if (score == null) return <span className="text-xs text-slate-400">—</span>;

  let color = "text-red-700 bg-red-50 border-red-200/60 ring-red-500/20";
  let icon = <XCircle className="h-3.5 w-3.5" />;
  if (score >= 65) {
    color = "text-emerald-700 bg-emerald-50 border-emerald-200/60 ring-emerald-500/20";
    icon = <CheckCircle className="h-3.5 w-3.5" />;
  } else if (score >= 40) {
    color = "text-amber-700 bg-amber-50 border-amber-200/60 ring-amber-500/20";
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
  }

  const confIcon =
    confidence === "high" ? <span title="Données fiables" className="ml-1 text-emerald-500">●</span> :
      confidence === "medium" ? <span title="Données partielles" className="ml-1 text-amber-500">●</span> :
        confidence === "low" ? <span title="Peu de données" className="ml-1 text-red-500">●</span> : null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ring-1 ring-inset shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-xs font-semibold tracking-tight transition-all duration-300 ${color}`}>
      {icon}{score}%{confIcon}
    </span>
  );
};

// ── Level badge ───────────────────────────────────────────────────────────────
export const LevelBadge = ({ level }: { level?: string }) => {
  if (!level) return null;
  const styles: Record<string, string> = {
    étudiant: "bg-sky-50 text-sky-700 border-sky-200/60 ring-sky-500/20",
    junior: "bg-blue-50 text-blue-700 border-blue-200/60 ring-blue-500/20",
    confirmé: "bg-violet-50 text-violet-700 border-violet-200/60 ring-violet-500/20",
    senior: "bg-orange-50 text-orange-700 border-orange-200/60 ring-orange-500/20",
    expert: "bg-rose-50 text-rose-700 border-rose-200/60 ring-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 mt-0.5 rounded-full border ring-1 ring-inset ${styles[level] || "bg-slate-50 text-slate-600 border-slate-200/60 ring-slate-500/20"}`}>
      {level}
    </span>
  );
};

// ── MatchAnalysisPanel ───────────────────────────────────────────────────────
// Parses the raw explanation from smart_match() and renders it in a clean UI.
export const MatchAnalysisPanel = ({ explanation, score, confidence }: {
  explanation: string;
  score: number;
  confidence?: string;
}) => {
  const lines = explanation.split('\n').filter(Boolean);

  // Parse each line into a typed entry
  type Entry = { type: 'confirmed' | 'partial' | 'missing' | 'level_ok' | 'level_warn' | 'domain_ok' | 'domain_warn' | 'raw_skill' | 'other'; label: string };

  const entries: Entry[] = lines
    .filter(l => !l.toLowerCase().startsWith('score :') && !l.toLowerCase().startsWith('score:') && !l.toLowerCase().startsWith('domaine infere'))
    .map((l): Entry => {
      const ll = l.toLowerCase().trim();
      // Confirmed skills by projects
      if (ll.startsWith('confirm')) {
        const cleaned = l.replace(/^confirm[eé]\s*:\s*/i, '').replace(/\s*\(\+[\d.]+ pts\)/, '').trim();
        const parts = cleaned.split(' — ');
        const skill = parts[0]?.trim() || cleaned;
        const proof = parts[1]?.replace(/Detecte dans les projets\/experiences/i, 'vu dans les projets').replace(/Detecte dans le cv/i, 'mentionné dans le CV').trim();
        return { type: 'confirmed', label: proof ? `${skill} — ${proof}` : skill };
      }
      // Partial / same family
      if (ll.startsWith('partiel')) {
        const cleaned = l.replace(/^partiel\s*:\s*/i, '').replace(/\s*\(meme famille\)/i, '').replace(/\s*\(\+[\d.]+ pts\)/, '').trim();
        const parts = cleaned.split('—');
        const left = parts[0]?.trim().replace(/\s*~\s*/g, ' ≈ ');
        return { type: 'partial', label: left };
      }
      // Missing
      if (ll.startsWith('manquant') || ll.startsWith('liste sans projet')) {
        const cleaned = l
          .replace(/^manquant\s*:\s*/i, '')
          .replace(/^liste sans projet\s*:\s*/i, '')
          .replace(/ non confirm[eé] dans les projets/i, '')
          .replace(/\s*\(\+[\d.]+ pts\)/, '').trim()
          .replace(/\s*~\s*/g, ' ≈ ');
        const type = ll.startsWith('liste sans projet') ? 'raw_skill' : 'missing';
        return { type, label: cleaned };
      }
      // Hard disqualifier
      if (ll.startsWith('disqualif')) {
        const cleaned = l.replace(/^disqualifiant\s*:\s*/i, '').replace(/\s*\(\d+ pts\)/, '').trim();
        return { type: 'level_warn', label: cleaned };
      }
      // Level lines
      if (ll.startsWith('niveau')) {
        const cleaned = l.replace(/\s*\(\+[\d.]+ pts\)/, '').trim();
        const isOk = ll.includes('ok') || ll.includes('non preci');
        return { type: isOk ? 'level_ok' : 'level_warn', label: cleaned };
      }
      // Domain lines
      if (ll.startsWith('domaine')) {
        let cleaned = l.replace(/\s*\(\+[\d.]+ pts\)/, '').trim()
          .replace(/\[\s*'/g, '')
          .replace(/'\s*\]/g, '')
          .replace(/',\s*'/g, ', ')
          .replace(/"/g, '')
          .replace(/domaine different\s*:\s*/i, 'Incompatibilité : ')
          .replace(/vs candidat/i, 'vs');
        const isMatch = ll.includes('match') || ll.includes('candidat:') || ll.includes('generique');
        return { type: isMatch ? 'domain_ok' : 'domain_warn', label: cleaned };
      }
      return { type: 'other', label: l };
    }).filter(e => e.label);

  const confirmed = entries.filter(e => e.type === 'confirmed');
  const partial = entries.filter(e => e.type === 'partial');
  const rawSkills = entries.filter(e => e.type === 'raw_skill');
  const missing = entries.filter(e => e.type === 'missing');
  const levelOk = entries.filter(e => e.type === 'level_ok');
  const levelWarn = entries.filter(e => e.type === 'level_warn');
  const domainOk = entries.filter(e => e.type === 'domain_ok');
  const domainWarn = entries.filter(e => e.type === 'domain_warn');

  const strengths = [...confirmed, ...partial, ...levelOk, ...domainOk];
  const weaknesses = [...missing, ...levelWarn, ...domainWarn];

  // Contextual advice
  let advice = '';
  if (levelWarn.length > 0 && levelWarn[0].label.toLowerCase().includes('disqual')) {
    advice = '🚫 Écart de niveau rédhibitoire. Ce candidat ne remplit pas les prérequis minimaux pour ce poste.';
  } else if (score >= 65 && confirmed.length >= 2) {
    advice = '✅ Profil solide. Les compétences clés sont prouvées par des projets concrets. Ce candidat mérite un entretien.';
  } else if (score >= 40) {
    const nbMissing = missing.length;
    if (rawSkills.length > 0) {
      advice = `💡 Correspondance partielle. ${rawSkills.length} compétence(s) listée(s) mais non prouvée(s) par des projets — un test technique permettrait de confirmer.`;
    } else if (nbMissing > 0) {
      advice = `⚠️ Correspondance partielle. Il manque ${nbMissing} élément(s) par rapport aux exigences. Un entretien permettra d'évaluer si ces lacunes sont compensables.`;
    } else {
      advice = '💡 Correspondance partielle. Vérifiez les compétences approchantes lors d\'un entretien.';
    }
  } else {
    advice = `❌ Peu de correspondances. Seulement ${confirmed.length} compétence(s) confirmée(s) sur les exigences clés du poste.`;
  }

  const confLabel = confidence === 'high' ? 'Analyse fiable' : confidence === 'medium' ? 'Analyse partielle' : 'Données limitées';
  const confColor = confidence === 'high' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : confidence === 'medium' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-50 border-slate-200';

  return (
    <div className="mt-4 pt-4 border-t border-indigo-200/60 animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-indigo-800/80 flex items-center gap-1.5 uppercase tracking-wider">
          <Layers className="h-3.5 w-3.5" /> Analyse de correspondance
        </p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confColor}`}>{confLabel}</span>
      </div>

      {/* Advice banner */}
      <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed font-medium ${score >= 65 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
        score >= 40 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
        {advice}
      </div>

      {/* Two-column breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {/* Strengths */}
        <div className="bg-white/80 rounded-xl p-3 border border-emerald-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Points forts ({strengths.length})
          </p>
          {strengths.length === 0
            ? <p className="text-xs text-slate-400 italic">Aucun point fort identifié</p>
            : <ul className="space-y-1.5">
              {confirmed.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-slate-700">{e.label}</span>
                </li>
              ))}
              {partial.map((e, i) => (
                <li key={`p${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">≈</span>
                  <span className="text-slate-600">{e.label}</span>
                </li>
              ))}
              {levelOk.map((e, i) => (
                <li key={`lv${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-slate-700">{e.label}</span>
                </li>
              ))}
              {domainOk.map((e, i) => (
                <li key={`do${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-slate-700">{e.label}</span>
                </li>
              ))}
            </ul>
          }
        </div>

        {/* Weaknesses */}
        <div className="bg-white/80 rounded-xl p-3 border border-red-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> À améliorer ({weaknesses.length + rawSkills.length})
          </p>
          {weaknesses.length === 0 && rawSkills.length === 0
            ? <p className="text-xs text-slate-400 italic">Aucun point bloquant</p>
            : <ul className="space-y-1.5">
              {levelWarn.map((e, i) => (
                <li key={`lw${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">🚫</span>
                  <span className="text-red-700 font-semibold">{e.label}</span>
                </li>
              ))}
              {missing.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                  <span className="text-slate-600">{e.label}</span>
                </li>
              ))}
              {rawSkills.map((e, i) => (
                <li key={`rs${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">~</span>
                  <span className="text-slate-500 italic">{e.label}</span>
                </li>
              ))}
              {domainWarn.map((e, i) => (
                <li key={`dw${i}`} className="flex items-start gap-1.5 text-xs">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠</span>
                  <span className="text-slate-600">{e.label}</span>
                </li>
              ))}
            </ul>
          }
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="text-emerald-500">✓</span> Prouvé par projet</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="text-amber-400">≈</span> Technologie proche</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="text-amber-400">~</span> Listé sans preuve</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="text-red-400">✗</span> Non trouvé</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Candidats = () => {
  const { source } = useParams<{ source: string }>();
  const [searchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [collectingLinkedIn, setCollectingLinkedIn] = useState(false);
  const [filterSource, setFilterSource] = useState("");
  const [reanalyzing, setReanalyzing] = useState<number | null>(null);
  const [sendingQuiz, setSendingQuiz] = useState<number | null>(null);
  const { toast } = useToast();



  // Decision dialog (accept / reject suggested link from email reference)
  const [decisionCandidate, setDecisionCandidate] = useState<Candidate | null>(null);
  const [autoLinking, setAutoLinking] = useState(false);
  const [decidingLink, setDecidingLink] = useState(false);

  // Send Email Dialog
  const [emailCandidate, setEmailCandidate] = useState<Candidate | null>(null);

  const pageTitle = source ? (pageTitles[source] || "Candidatures") : "Candidatures";

  // ── Load candidates ─────────────────────────────────────────────────────────
  const loadCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/candidates", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        // If a specific candidate ID is provided in the URL, filter to that candidate only
        const candidateIdParam = searchParams.get('candidate');
        if (candidateIdParam) {
          const candidateId = Number(candidateIdParam);
          const filtered = data.filter((c: Candidate) => c.id === candidateId);
          setCandidates(filtered);
        } else {
          setCandidates(data);
        }

        // Auto-link: lancer la liaison en arrière-plan sans bloquer l'UI
        const hasUnlinked = data.some((c: Candidate) => !c.job_title && !c.job_requisition_id && c.link_status !== 'rejected');
        if (hasUnlinked && !window.sessionStorage.getItem('autoLinkedTriggered')) {
          window.sessionStorage.setItem('autoLinkedTriggered', 'true');
          fetch("http://localhost:5000/api/candidates/auto-link-unlinked", {
            method: "POST",
            credentials: "include",
          }).then(() => {
            setTimeout(async () => {
              const res2 = await fetch("http://localhost:5000/api/candidates", { credentials: "include" });
              if (res2.ok) {
                const data2 = await res2.json();
                const candId = searchParams.get('candidate');
                if (candId) {
                  setCandidates(data2.filter((c: Candidate) => c.id === Number(candId)));
                } else {
                  setCandidates(data2);
                }
              }
            }, 8000);
          }).catch(console.error);
        }
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const triggerEmailScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("http://localhost:5000/api/scan-emails", { method: "POST", credentials: "include" });
      if (res.ok) {
        toast({ title: "📧 Scan lancé", description: "Scan POP3 en cours..." });
        setTimeout(loadCandidates, 5000);
      }
    } catch { /* ignore */ } finally { setScanning(false); }
  };

  const triggerLinkedInCollect = async () => {
    setCollectingLinkedIn(true);
    try {
      const res = await fetch("http://localhost:5000/api/collect-linkedin-forms", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "🔵 Collecte LinkedIn lancée", description: "Lecture des réponses Google Form en cours..." });
        setTimeout(loadCandidates, 8000);
      } else {
        toast({ title: "Erreur", description: "Impossible de lancer la collecte", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setCollectingLinkedIn(false);
    }
  };

  // ── Delete with SweetAlert2 ─────────────────────────────────────────────────
  const deleteCandidate = async (id: number, name: string) => {
    const result = await Swal.fire({
      title: "Supprimer ce candidat ?",
      html: `La candidature de <strong>${name}</strong> sera définitivement supprimée.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Oui, supprimer",
      cancelButtonText: "Annuler",
      focusCancel: true,
      customClass: { popup: "rounded-xl shadow-xl" },
    });
    if (!result.isConfirmed) return;

    setDeleting(id);
    try {
      const res = await fetch(`http://localhost:5000/api/candidates/${id}`, {
        method: "DELETE", credentials: "include"
      });
      if (res.ok) {
        await Swal.fire({
          title: "Supprimé !",
          text: `La candidature de ${name} a été supprimée.`,
          icon: "success",
          timer: 1800,
          showConfirmButton: false,
          customClass: { popup: "rounded-xl" },
        });
        loadCandidates();
      } else {
        const err = await res.json();
        Swal.fire("Erreur", err.error || "Impossible de supprimer", "error");
      }
    } catch {
      Swal.fire("Erreur", "Erreur de connexion", "error");
    } finally {
      setDeleting(null);
    }
  };

  const previewCV = (candidate: Candidate) => {
    if (candidate.cv_path && candidate.cv_path.startsWith('http')) {
      // Lien Google Drive stocké directement → ouvrir dans Drive
      window.open(candidate.cv_path, "_blank");
    } else if (candidate.cv_path) {
      // Fichier local stocké sur le serveur → route backend
      window.open(`http://localhost:5000/api/candidates/${candidate.id}/cv?inline=true`, "_blank");
    } else {
      toast({ title: "Aucun CV", description: "Ce candidat n'a pas de CV associé.", variant: "destructive" });
    }
  };

  // ── Re-analyser le profil d'un candidat existant ───────────────────────────
  const reanalyzeCandidate = async (id: number, name: string) => {
    setReanalyzing(id);
    try {
      const res = await fetch(`http://localhost:5000/api/candidates/${id}/reanalyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: "🔄 Profil mis à jour",
          description: `${name} — ${data.profile?.skills_confirmed?.length ?? 0} compétences confirmées · Score : ${data.new_score ?? "—"}%`,
        });
        loadCandidates();
      } else {
        const err = await res.json();
        toast({ title: "Erreur", description: err.error || "Impossible de re-analyser", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setReanalyzing(null);
    }
  };

  // ── Envoyer le quiz de présélection à un candidat ─────────────────────────
  const sendQuizToCandidate = async (candidate: Candidate) => {
    if (!candidate.job_title) {
      toast({ title: "Impossible", description: "Le candidat doit être lié à un AO avant d'envoyer le test.", variant: "destructive" });
      return;
    }
    setSendingQuiz(candidate.id);
    try {
      const res = await fetch(`http://localhost:5000/api/candidates/${candidate.id}/send-quiz`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "📧 Test envoyé !",
          description: `Quiz de ${data.questions_count} questions envoyé à ${candidate.email}`,
        });
      } else if (res.status === 409) {
        toast({ title: "Déjà envoyé", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Erreur", description: data.error || "Impossible d'envoyer le test", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setSendingQuiz(null);
    }
  };

  // ── Accept / Reject suggested link ─────────────────────────────────────────
  const decideLinkAction = async (candidateId: number, action: "accept" | "reject") => {
    setDecidingLink(true);
    try {
      const res = await fetch(`http://localhost:5000/api/candidates/${candidateId}/link-decision`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast({
          title: action === "accept" ? "✅ Liaison confirmée" : "✗ Liaison rejetée",
          description: action === "accept"
            ? "Le candidat est maintenant lié à l'offre suggérée."
            : "La liaison suggérée a été rejetée.",
        });
        setDecisionCandidate(null);
        loadCandidates();
      } else {
        const err = await res.json();
        toast({ title: "Erreur", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setDecidingLink(false);
    }
  };

  // ── Manual change application status ────────────────────────────────────────
  const changeAppStatus = async (candidateId: number, appId: number, decision: "accepted" | "rejected") => {
    try {
      const res = await fetch(`http://localhost:5000/api/candidates/${candidateId}/applications/${appId}/decision`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        toast({ title: "Succès", description: "Le statut a été mis à jour." });
        loadCandidates();
      } else {
        toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    }
  };



  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = wiemStyles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => { loadCandidates(); }, []);

  // ── Filter & sort ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...candidates];
    if (source) data = data.filter((c) => c.source === source);
    if (filterSource) data = data.filter((c) => c.source === filterSource);
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((c) =>
        c.last_name?.toLowerCase().includes(s) ||
        c.first_name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.phone?.includes(s) ||
        (c.job_title || "").toLowerCase().includes(s)
      );
    }
    data.sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "last_name") { va = a.last_name || ""; vb = b.last_name || ""; }
      else if (sortBy === "score") { va = a.matching_score ?? -1; vb = b.matching_score ?? -1; }
      else if (sortBy === "job") { va = a.job_title || ""; vb = b.job_title || ""; }
      else { va = a.created_at; vb = b.created_at; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [candidates, source, search, sortBy, sortDir]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  };

  const kpis = useMemo(() => {
    const scores = filtered.filter(c => c.matching_score != null).map(c => c.matching_score!);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return {
      total: filtered.length,
      nouveaux: filtered.filter((c) => !c.job_title && c.link_status !== 'rejected').length,
      compatibles: filtered.filter((c) => (c.matching_score && c.matching_score >= 70)).length,
      score_moyen: avgScore,
    };
  }, [filtered]);

  // Parse cv_profile safely
  const parsedProfile = (c: Candidate) => {
    try { return c.cv_profile ? JSON.parse(c.cv_profile) : null; }
    catch { return null; }
  };

  // L'écran de chargement bloquant a été retiré pour éviter de bloquer l'UI en cas de candidats non liés sans opportunité.

  return (
    <DashboardLayout title={pageTitle}>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="border border-slate-200/60 shadow-sm rounded-xl bg-white">
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-[13px] text-slate-500 mb-1 font-medium">Total candidats</p>
            <p className="text-3xl font-bold text-slate-900">{kpis.total}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 shadow-sm rounded-xl bg-white">
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-[13px] text-slate-500 mb-1 font-medium">Nouveaux</p>
            <p className="text-3xl font-bold text-slate-900">{kpis.nouveaux}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 shadow-sm rounded-xl bg-white">
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-[13px] text-slate-500 mb-1 font-medium">Compatibles</p>
            <p className="text-3xl font-bold text-emerald-600">{kpis.compatibles}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200/60 shadow-sm rounded-xl bg-white">
          <CardContent className="p-5 flex flex-col justify-center">
            <p className="text-[13px] text-slate-500 mb-1 font-medium">Score moyen IA</p>
            <p className="text-3xl font-bold text-[#1e3a8a]">{kpis.score_moyen != null ? `${kpis.score_moyen}%` : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Header actions & Search ──────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <Input
            placeholder="Rechercher un candidat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 w-full rounded-lg border-slate-200 shadow-sm focus-visible:ring-1 focus-visible:ring-indigo-500/50 bg-white text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select className="h-10 px-3 flex items-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 shadow-sm outline-none w-40">
            <option value="">Tous les statuts</option>
          </select>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="h-10 px-3 flex items-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 shadow-sm outline-none w-44"
          >
            <option value="">Toutes les sources</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="email">Email</option>
            <option value="linkedin_message">LinkedIn Message</option>
          </select>

          <Button size="sm" onClick={loadCandidates} className="h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2" title="Rafraîchir">
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button size="sm" onClick={triggerEmailScan} disabled={scanning}
            className="h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2"
            title="Scanner les emails">
            {scanning ? <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Mail className="h-4 w-4" />}
          </Button>

          <Button size="sm" onClick={triggerLinkedInCollect} disabled={collectingLinkedIn}
            className="h-10 border border-[#0A66C2] bg-[#0A66C2] hover:bg-[#004182] text-white px-3 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2"
            title="Collecter les candidatures LinkedIn (Google Form)">
            {collectingLinkedIn
              ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Linkedin className="h-4 w-4" />}
            <span className="hidden sm:inline">Collecter LinkedIn</span>
          </Button>


        </div>
      </div>


      {/* ── Table Wiem Fusionnée ────────────────────────────────────────────────────────── */}
      <div className="candidates-pro pt-0 pb-10">
        <div className="cpro-table-card">
          <table className="cpro-table">
            <thead>
              <tr>
                <th style={{ width: '150px' }}><div className="flex items-center gap-1 cursor-pointer" onClick={() => toggleSort("last_name")}>Candidat <ArrowUpDown className={`h-3 w-3 ${sortBy === "last_name" ? "sort-active" : "text-gray-300"}`} /></div></th>
                <th style={{ width: '100px' }}>Source</th>
                <th style={{ width: '130px' }}>Entreprise</th>
                <th style={{ width: '180px' }}>Poste</th>
                <th style={{ width: '110px' }}>Statut</th>
                <th style={{ width: '85px' }}><div className="flex items-center gap-1 cursor-pointer" onClick={() => toggleSort("score")}>Score IA <ArrowUpDown className={`h-3 w-3 ${sortBy === "score" ? "sort-active" : "text-gray-300"}`} /></div></th>
                <th style={{ width: '100px' }}>Localisation</th>
                <th style={{ width: '50px' }}>CV</th>
                <th style={{ width: '80px' }}><div className="flex items-center gap-1 cursor-pointer" onClick={() => toggleSort("created_at")}>Date <ArrowUpDown className={`h-3 w-3 ${sortBy === "created_at" ? "sort-active" : "text-gray-300"}`} /></div></th>
                <th style={{ width: '110px' }}>Coordonnées</th>
                <th style={{ width: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                let statutText = "Nouveau";
                let statutClasses = "cpro-status-pending";

                const isRejected = c.app_status === 'rejected' || c.link_status === 'rejected' || (c.matching_score != null && c.matching_score < 40);
                const isAccepted = c.app_status === 'accepted' || (c.matching_score != null && c.matching_score >= 70);
                const isPending = c.app_status === 'pending';

                if (c.link_status === 'suggested' && c.matching_score == null) {
                  statutText = "En analyse";
                  statutClasses = "cpro-status-pending opacity-70";
                } else if (isRejected) {
                  statutText = "Rejeté";
                  statutClasses = "cpro-status-rejected";
                } else if (isAccepted) {
                  statutText = "Accepté";
                  statutClasses = "cpro-status-accepted";
                } else if (isPending) {
                  statutText = "En attente";
                  statutClasses = "cpro-status-pending";
                } else if (c.matching_score != null) {
                  statutText = "Vivier";
                  statutClasses = "bg-slate-100 text-slate-600 border border-slate-200";
                } else if (c.job_title) {
                  statutText = "Lié";
                  statutClasses = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                }

                let scoreText = <span className="text-slate-400">—</span>;
                if (c.matching_score != null) {
                  if (c.matching_score >= 70) scoreText = <span className="text-emerald-500 font-bold">{c.matching_score}%</span>;
                  else if (c.matching_score < 40) scoreText = <span className="text-red-500 font-bold">{c.matching_score}%</span>;
                  else scoreText = <span className="text-slate-800 font-bold">{c.matching_score}%</span>;
                }

                let sourceClass = "cpro-src-manual";
                if (c.source === 'LinkedIn' || c.source === 'linkedin_message' || c.source === 'linkedin_like' || c.source === 'linkedin_comment') sourceClass = "cpro-src-linkedin";
                else if (c.source === 'email' || c.source === 'gmail_oauth') sourceClass = "cpro-src-email";

                const fullName = `${c.last_name || ''} ${c.first_name || ''}`.trim() || '—';

                return (
                  <tr key={c.id} onClick={() => setSelectedCandidate(c)}>
                    <td style={{ fontWeight: 500, maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', color: '#111827' }}>
                      <div className="flex flex-col">
                        <span>{fullName}</span>
                        <span className="text-[10px] text-gray-400 font-normal mt-0.5 truncate" title={c.email}>{c.email}</span>
                      </div>
                    </td>
                    <td style={{ width: '100px' }}>
                      <span className={`cpro-src ${sourceClass}`}>
                        {sourceIcons[c.source] || <Mail className="h-3 w-3" />} {sourceLabels[c.source] || c.source}
                      </span>
                    </td>
                    <td style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.company ? <div className="flex items-center gap-1.5" title={c.company}><Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /><span className="truncate">{c.company}</span></div> : <span className="cpro-muted">—</span>}
                    </td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.job_title ? <div className="flex items-center gap-1.5" title={c.job_title}><Briefcase className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /><span className="truncate">{c.job_title}</span></div> : <span className="cpro-muted">—</span>}
                    </td>
                    <td style={{ width: '110px' }} onClick={e => e.stopPropagation()}>
                      {c.link_status === 'suggested' && c.suggested_job_title ? (
                        <button onClick={() => setDecisionCandidate(c)} className="cpro-status cpro-status-pending" style={{ cursor: 'pointer' }} title="Valider/Rejeter la liaison suggérée">
                          <AlertTriangle className="h-3 w-3" /> En attente
                        </button>
                      ) : isPending && c.application_id ? (
                        <div className="flex items-center gap-1 bg-amber-50 rounded-full px-1 border border-amber-200" title="Changer le statut manuellement">
                          <button onClick={() => changeAppStatus(c.id, c.application_id!, 'accepted')} className="p-1 hover:bg-emerald-200 rounded-full text-emerald-600" title="Accepter"><CheckCircle className="h-3.5 w-3.5" /></button>
                          <span className="text-xs font-semibold text-amber-700">Attente</span>
                          <button onClick={() => changeAppStatus(c.id, c.application_id!, 'rejected')} className="p-1 hover:bg-red-200 rounded-full text-red-600" title="Rejeter"><XCircle className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <span className={`cpro-status ${statutClasses}`}>
                          {statutText}
                        </span>
                      )}
                    </td>
                    <td style={{ width: '85px' }}>
                      {c.link_status === "suggested" && c.matching_score == null ? (
                        <div className="h-3 w-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : scoreText}
                    </td>
                    <td style={{ width: '100px' }}>
                      {c.location ? (
                        <div className="flex items-center gap-1.5">
                          <ReactCountryFlag countryCode={getCountryCode(c.location)} svg style={{ width: '1.2em', height: '1.2em' }} />
                          <span className="truncate" title={c.location}>{c.location}</span>
                        </div>
                      ) : <span className="cpro-muted">—</span>}
                    </td>
                    <td style={{ width: '50px' }} onClick={e => e.stopPropagation()}>
                      {c.cv_path ? (
                        <button className="cpro-btn cpro-btn-cv" onClick={() => previewCV(c)} title="Voir le CV">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      ) : <span className="cpro-muted">—</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: '#6B7280', width: '80px' }}>
                      {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ width: '110px' }} onClick={e => e.stopPropagation()}>
                      <div className="cpro-actions">
                        {c.phone && (
                          <button className="cpro-btn cpro-btn-phone" onClick={() => window.open(`https://wa.me/${c.phone.replace(/[^\d+]/g, '')}`, '_blank')} title={c.phone}>
                            <Phone className="h-3 w-3" />
                          </button>
                        )}
                        {c.email && (
                          <button className="cpro-btn cpro-btn-email" onClick={(e) => { e.stopPropagation(); setEmailCandidate(c); }} title={`Envoyer un email à ${c.email}`}>
                            <Mail className="h-3 w-3" />
                          </button>
                        )}
                        {c.linkedin_profile_url && (
                          <button className="cpro-btn cpro-btn-linkedin" onClick={() => window.open(c.linkedin_profile_url, '_blank')} title="LinkedIn">
                            <Linkedin className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ width: '140px' }} onClick={e => e.stopPropagation()}>
                      <div className="cpro-actions">

                        {/* Quiz */}
                        <button
                          className={`cpro-btn ${(c.job_title && isAccepted) ? 'cpro-btn-quiz' : 'opacity-40 cursor-not-allowed'}`}
                          onClick={() => c.job_title && isAccepted && sendQuizToCandidate(c)}
                          disabled={sendingQuiz === c.id || !c.job_title || !isAccepted}
                          title={!isAccepted ? "Vous devez d'abord accepter ce candidat pour générer un test" : "Générer Quiz IA"}
                        >
                          {sendingQuiz === c.id ? <div className="h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                        </button>

                        {/* Supprimer */}
                        <button className="cpro-btn cpro-btn-delete" onClick={() => deleteCandidate(c.id, fullName)} disabled={deleting === c.id} title="Supprimer">
                          {deleting === c.id ? <div className="h-3 w-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <div className="cpro-empty">
                      <div className="cpro-empty-icon"><Search className="h-5 w-5 text-gray-300" /></div>
                      <p style={{ fontWeight: 500, color: '#6B7280' }}>Aucun candidat trouvé</p>
                      <p className="text-sm">Essayez d'ajuster vos filtres</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>



      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <CandidateDetailDialog
        selectedCandidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        parsedProfile={parsedProfile}
        previewCV={(id: number) => { const c = candidates.find(x => x.id === id); if (c) previewCV(c); }}
      />

      {/* ── Decision Dialog : Accept / Reject suggested link ─────────────── */}
      <DecisionDialog
        decisionCandidate={decisionCandidate}
        setDecisionCandidate={setDecisionCandidate}
        decidingLink={decidingLink}
        decideLinkAction={decideLinkAction}
      />

      {/* ── Send Email Dialog ────────────────────────────────────────────── */}
      <SendEmailDialog
        candidate={emailCandidate}
        isOpen={emailCandidate !== null}
        onClose={() => setEmailCandidate(null)}
      />

    </DashboardLayout>
  );
};

export default Candidats;
