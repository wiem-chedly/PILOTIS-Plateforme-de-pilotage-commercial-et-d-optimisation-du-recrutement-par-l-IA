import React, { useState, useEffect, useMemo, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileSpreadsheet, Loader2, AlertCircle, RefreshCw,
  Building2, CalendarCheck, Phone, ChevronDown, ChevronRight,
  Users, Briefcase, Filter, X, TrendingUp, BarChart2,
  Layers, ArrowUpRight, Star, MapPin, Trash2, CheckCircle2,
  LayoutGrid, List
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCompanies } from "@/hooks/useCompanies";
import { exportStats, resetCache, type Company, type SubCompanyDetail } from "@/services/companiesService";
import { FilterPanel, DEFAULT_FILTERS, type FilterParams } from "@/components/FilterPanel";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a rate value from the API.
 * taux_rdv / taux_appel are now percentage strings like "67%" or "N/A".
 * parseFloat("67%") = 67  ← already in 0-100 range, NOT 0-1.
 * All threshold comparisons below use 0-100 scale accordingly.
 */
function getRateNum(s: string): number | null {
  if (!s || s === "N/A" || s === "undefined") return null;
  // Strip trailing % if present — parseFloat handles it but let's be explicit
  const cleaned = s.endsWith("%") ? s.slice(0, -1) : s;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Color class based on percentage (0-100 scale).
 * Thresholds: < 20% → red, 20-50% → amber, ≥ 50% → green.
 */
function getTierColor(rate: number | null) {
  if (rate === null) return "text-slate-300";
  if (rate < 20) return "text-red-500";
  if (rate < 50) return "text-amber-500";
  return "text-emerald-500";
}

/**
 * Bar background color — same thresholds as getTierColor.
 */
function getTierBg(rate: number | null) {
  if (rate === null) return "bg-slate-100";
  if (rate < 20) return "bg-red-500";
  if (rate < 50) return "bg-amber-400";
  return "bg-emerald-400";
}

type RateCategory = "na" | "faible" | "moyen" | "bon";

/**
 * Category for filter chips — 0-100 scale.
 */
function getRateCategory(rate: number | null): RateCategory {
  if (rate === null) return "na";
  if (rate < 20) return "faible";
  if (rate < 50) return "moyen";
  return "bon";
}

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const PALETTES = [
  { bg: "bg-blue-100",   text: "text-blue-700",   ring: "ring-blue-200"   },
  { bg: "bg-teal-100",   text: "text-teal-700",   ring: "ring-teal-200"   },
  { bg: "bg-rose-100",   text: "text-rose-700",   ring: "ring-rose-200"   },
  { bg: "bg-amber-100",  text: "text-amber-700",  ring: "ring-amber-200"  },
  { bg: "bg-cyan-100",   text: "text-cyan-700",   ring: "ring-cyan-200"   },
  { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-200" },
  { bg: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-200" },
  { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-200" },
];

function getAvatar(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTES[h % PALETTES.length];
}

function statusVariant(status: string) {
  if (status === "Client")     return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "Partenaire") return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

// ── Mini Rate Arc ─────────────────────────────────────────────────────────────
function RateArc({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  const rate = getRateNum(value);
  // rate is already 0-100 — use directly as bar % width (cap at 100)
  const barPct = rate !== null ? Math.min(rate, 100) : 0;
  const color  = getTierColor(rate);
  const bar    = getTierBg(rate);

  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-slate-400">{icon}</div>
        <span className={`text-xs font-bold tabular-nums ${color}`}>
          {value === "N/A" || !value ? "—" : value}
        </span>
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${bar} transition-all duration-500`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 h-px bg-slate-100 ml-2" />
    </div>
  );
}

// ── Company Modal ─────────────────────────────────────────────────────────────
function CompanyModal({ co, onClose }: { co: Company; onClose: () => void }) {
  const av        = getAvatar(co.name);
  const rdvRate   = getRateNum(co.taux_rdv);
  const appelRate = getRateNum(co.taux_appel);

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
      {/* Header */}
      <div className="relative p-6 pb-5 border-b bg-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className={`h-14 w-14 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ring-2 ${av.bg} ${av.text} ${av.ring}`}>
            {getInitials(co.name)}
          </div>
          <div className="flex-1 min-w-0">
            <DialogHeader className="p-0">
              <DialogTitle className="text-xl font-bold text-slate-900 leading-tight">{co.name}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {co.sector && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  <Briefcase className="h-3 w-3" /> {co.sector}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Users className="h-3 w-3" /> {co.nb_prospects + co.nb_clients} contacts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b">
        {[
          {
            icon: <CalendarCheck className="h-5 w-5" />,
            label: "Taux de RDV",
            value: co.taux_rdv,
            rate: rdvRate,
            count: co.nb_rdv,
            unit: "contacts avec RDV",
          },
          {
            icon: <Phone className="h-5 w-5" />,
            label: "Taux d'appel",
            value: co.taux_appel,
            rate: appelRate,
            count: co.nb_appel,
            unit: "contacts avec appel",
          },
        ].map((item, i) => (
          <div key={i} className="p-5 flex flex-col items-center gap-2 bg-white hover:bg-slate-50/50 transition-colors">
            <div className="text-slate-400">{item.icon}</div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.label}</span>
            <span className={`text-4xl font-bold tabular-nums ${getTierColor(item.rate)}`}>
              {item.value === "N/A" || !item.value ? "—" : item.value}
            </span>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                // rate is 0-100 — use directly as % width
                animate={{ width: `${Math.min(item.rate ?? 0, 100)}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 * i }}
                className={`h-full rounded-full ${getTierBg(item.rate)}`}
              />
            </div>
            <span className="text-xs text-slate-400">{item.count} {item.unit}</span>
          </div>
        ))}
      </div>

      {/* Sub-entities */}
      {co.sub_company_details && co.sub_company_details.length > 0 && (
        <div className="p-5 bg-slate-50/50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            Entités associées ({co.sub_company_details.length})
          </p>
          <div className="space-y-2">
            {co.sub_company_details.map((sub, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-center justify-between hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${getAvatar(sub.name).bg} ${getAvatar(sub.name).text}`}>
                    {getInitials(sub.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{sub.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-semibold border ${statusVariant(sub.status)}`}>
                        {sub.status}
                      </Badge>
                      {sub.nb_contacts > 0 && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" /> {sub.nb_contacts}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5 ml-4">
                  <div className="text-right">
                    <span className={`text-sm font-bold tabular-nums ${getTierColor(getRateNum(sub.taux_rdv))}`}>
                      {sub.taux_rdv === "N/A" || !sub.taux_rdv ? "—" : sub.taux_rdv}
                    </span>
                    <p className="text-[10px] text-slate-400">RDV</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold tabular-nums ${getTierColor(getRateNum(sub.taux_appel))}`}>
                      {sub.taux_appel === "N/A" || !sub.taux_appel ? "—" : sub.taux_appel}
                    </span>
                    <p className="text-[10px] text-slate-400">Appel</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </DialogContent>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function CompanyRow({
  co, idx, isOpen, onToggle, onSelect,
}: {
  co: Company; idx: number; isOpen: boolean;
  onToggle: () => void; onSelect: () => void;
}) {
  const av      = getAvatar(co.name);
  const subs    = co.sub_company_details ?? [];
  const hasSubs = subs.length >= 1;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.015, 0.3), duration: 0.3 }}
        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group"
      >
        <td className="pl-4 py-3.5 w-10">
          <button
            onClick={onToggle}
            className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
              hasSubs ? "hover:bg-slate-100 text-slate-400" : "invisible"
            }`}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>

        <td className="py-3.5 pr-3">
          <button onClick={onSelect} className="flex items-center gap-3 text-left group/btn w-full">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${av.bg} ${av.text}`}>
              {getInitials(co.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 group-hover/btn:text-slate-900 transition-colors truncate">
                {co.name}
              </p>
            </div>
            {hasSubs && (
                <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded-sm">
                  {subs.length} entités
                </span>
            )}
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover/btn:opacity-100 transition-opacity ml-2 hidden sm:block" />
          </button>
        </td>

        <td className="py-3.5 text-center">
          <span className={`text-sm tabular-nums font-medium ${co.nb_prospects + co.nb_clients > 0 ? "text-slate-700" : "text-slate-300"}`}>
            {co.nb_prospects + co.nb_clients > 0 ? co.nb_prospects + co.nb_clients : "—"}
          </span>
        </td>

        <td className="py-3.5 text-center">
          <span className={`text-sm tabular-nums font-medium ${co.nb_partenaires > 0 ? "text-slate-700" : "text-slate-300"}`}>
            {co.nb_partenaires > 0 ? co.nb_partenaires : "—"}
          </span>
        </td>

        <td className="py-3.5 pr-2">
          <RateArc value={co.taux_rdv} label={`${co.nb_rdv} RDV`} icon={<CalendarCheck className="h-3 w-3" />} />
        </td>

        <td className="py-3.5 pr-5">
          <RateArc value={co.taux_appel} label={`${co.nb_appel} appels`} icon={<Phone className="h-3 w-3" />} />
        </td>
      </motion.tr>

      <AnimatePresence>
        {isOpen && hasSubs && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-slate-50 bg-slate-50/30"
          >
            <td />
            <td colSpan={5} className="py-2 pb-4 pr-5 pl-4">
              <div className="pl-4 border-l-2 border-slate-100 space-y-2 relative">
                {subs.map((sub, si) => (
                  <div key={`${co.name}-sub-${si}`} className="flex items-center justify-between group/sub">
                    <div className="flex items-center gap-3 relative">
                      <div className="absolute -left-[22px] top-1/2 -translate-y-1/2 w-4 h-[2px] bg-slate-100" />
                      <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover/sub:bg-slate-400 transition-colors" />
                      <div>
                        <span className="text-xs font-medium text-slate-600 truncate max-w-[200px] inline-block align-middle">{sub.name}</span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-medium border-0 bg-white shadow-sm ${statusVariant(sub.status).split(" ")[1]}`}>
                        {sub.status}
                      </Badge>
                      {sub.nb_contacts > 0 && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" />{sub.nb_contacts}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right flex items-center gap-1.5 w-14">
                        <span className="text-[10px] text-slate-400">RDV</span>
                        <span className={`text-xs font-bold tabular-nums ${getTierColor(getRateNum(sub.taux_rdv))}`}>
                          {sub.taux_rdv === "N/A" || !sub.taux_rdv ? "—" : sub.taux_rdv}
                        </span>
                      </div>
                      <div className="text-right flex items-center gap-1.5 w-16">
                        <span className="text-[10px] text-slate-400">Appel</span>
                        <span className={`text-xs font-bold tabular-nums ${getTierColor(getRateNum(sub.taux_appel))}`}>
                          {sub.taux_appel === "N/A" || !sub.taux_appel ? "—" : sub.taux_appel}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Kanban View ───────────────────────────────────────────────────────────────
function KanbanCard({ co, isOpen, onToggle, onSelect }: { co: Company, isOpen: boolean, onToggle: () => void, onSelect: () => void }) {
  const av = getAvatar(co.name);
  const subs = co.sub_company_details ?? [];
  return (
    <div className="bg-white border text-left border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-3.5 flex flex-col gap-3 group relative cursor-pointer" onClick={onSelect}>
      <div className="flex items-start gap-3 relative z-10 pointer-events-none">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${av.bg} ${av.text}`}>
          {getInitials(co.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate leading-tight group-hover:text-indigo-600 transition-colors">{co.name}</p>
          <div className="flex gap-2 mt-1">
            <span className="text-[10px] text-slate-500 font-medium">{co.nb_prospects + co.nb_clients} contacts</span>
            <span className="text-[10px] text-slate-500 font-medium">{co.nb_partenaires} part.</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 relative z-10 pointer-events-none mt-1">
        <div className="bg-slate-50/80 rounded-lg p-2 flex flex-col justify-center items-center text-center">
           <span className="text-[10px] text-slate-500 font-medium mb-1">Taux RDV</span>
           <span className={`text-sm font-bold tabular-nums ${getTierColor(getRateNum(co.taux_rdv))}`}>{co.taux_rdv === "N/A" || !co.taux_rdv ? "—" : co.taux_rdv}</span>
        </div>
        <div className="bg-slate-50/80 rounded-lg p-2 flex flex-col justify-center items-center text-center">
           <span className="text-[10px] text-slate-500 font-medium mb-1">Taux Appel</span>
           <span className={`text-sm font-bold tabular-nums ${getTierColor(getRateNum(co.taux_appel))}`}>{co.taux_appel === "N/A" || !co.taux_appel ? "—" : co.taux_appel}</span>
        </div>
      </div>
      {subs.length > 0 && (
        <div className="relative z-10 border-t border-slate-100 pt-2.5 mt-1 pointer-events-auto">
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-slate-700 font-medium">
            <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />{subs.length} entités</span>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <AnimatePresence>
            {isOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="pt-2 space-y-1.5 flex flex-col">
                  {subs.slice(0, 5).map((s, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-700 truncate min-w-0 mr-2">{s.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[9px] font-bold ${getTierColor(getRateNum(s.taux_rdv))}`}>{s.taux_rdv === "N/A" || !s.taux_rdv ? "—" : s.taux_rdv} rdv</span>
                      </div>
                    </div>
                  ))}
                  {subs.length > 5 && <span className="text-[10px] text-slate-400 text-center py-1 font-medium pb-0">+{subs.length - 5} autres entités</span>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function KanbanBoard({ companies, expanded, onToggle, onSelect }: { companies: Company[], expanded: Set<string>, onToggle: (n: string) => void, onSelect: (c: Company) => void }) {
  // Le client souhaite un affichage type "Grille de cartes" sans séparation explicite par statuts, 
  // appelé "Kanban" dans sa demande mais fonctionnant comme un Grid view classique.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2">
      {companies.length === 0 && (
        <div className="col-span-full p-16 border-2 border-dashed border-slate-200/60 rounded-xl text-center">
          <span className="text-sm font-medium text-slate-400">Aucune entreprise à afficher</span>
        </div>
      )}
      {companies.map(co => (
         <KanbanCard key={co.name} co={co} isOpen={expanded.has(co.name)} onToggle={() => onToggle(co.name)} onSelect={() => onSelect(co)} />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClientsProspects() {
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [activeFilters, setActiveFilters] = useState<FilterParams>(DEFAULT_FILTERS);
  const { companies, period, loading, error } = useCompanies(activeFilters);
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [selected, setSelected]   = useState<Company | null>(null);
  const [exporting, setExporting] = useState(false);
  const [rateFilters, setRateFilters]   = useState<RateCategory[]>([]);
  const [allCompanyOptions, setAllCompanyOptions] = useState<string[]>([]);
  const [resetting, setResetting]       = useState(false);
  const [resetResult, setResetResult]   = useState<{ cleared: number } | null>(null);

  useEffect(() => {
    if (activeFilters.companyNames.length === 0 && companies.length > 0)
      setAllCompanyOptions(companies.map(c => c.name));
  }, [companies, activeFilters.companyNames]);

  const toggle = (name: string) =>
    setExpanded(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const filtered = useMemo(() => companies.filter(co => {
    const matchSearch = !search ||
      co.name.toLowerCase().includes(search.toLowerCase());
    const matchRate = rateFilters.length === 0 ||
      rateFilters.includes(getRateCategory(getRateNum(co.taux_rdv))) ||
      rateFilters.includes(getRateCategory(getRateNum(co.taux_appel)));
    return matchSearch && matchRate;
  }), [companies, search, rateFilters]);

  // Summary stats — rates are 0-100, so threshold is 50 (not 0.5)
  const totalContacts = useMemo(() =>
    companies.reduce((s, c) => s + c.nb_prospects + c.nb_clients, 0), [companies]);
  const totalPartners = useMemo(() =>
    companies.reduce((s, c) => s + c.nb_partenaires, 0), [companies]);
  const avgRdvPct = useMemo(() => {
    const valid = companies.map(c => getRateNum(c.taux_rdv)).filter(r => r !== null) as number[];
    return valid.length > 0
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) + "%"
      : null;
  }, [companies]);
  // Good RDV = taux_rdv >= 50% (rate is 0-100 scale)
  const goodRdv = useMemo(() =>
    companies.filter(c => (getRateNum(c.taux_rdv) ?? 0) >= 50).length,
    [companies]
  );

  const companyOptions = allCompanyOptions.length > 0 ? allCompanyOptions : companies.map(c => c.name);

  const handleReset = async () => {
    setResetting(true);
    setResetResult(null);
    try {
      const res = await resetCache();
      setResetResult({ cleared: res.db_group_names_cleared });
      setTimeout(() => setResetResult(null), 4000);
      setActiveFilters(f => ({ ...f }));
    } catch (e) {
      setResetResult({ cleared: -1 });
      setTimeout(() => setResetResult(null), 4000);
    } finally {
      setResetting(false);
    }
  };

  const rateFilterDefs = [
    { id: "na"     as RateCategory, label: "Non renseigné",   dot: "bg-slate-400",   active: "bg-slate-100 border-slate-300 text-slate-700" },
    { id: "faible" as RateCategory, label: "Faible (< 20%)",  dot: "bg-red-500",     active: "bg-red-50 border-red-200 text-red-700" },
    { id: "moyen"  as RateCategory, label: "Moyen (20–50%)",  dot: "bg-amber-500",   active: "bg-amber-50 border-amber-200 text-amber-700" },
    { id: "bon"    as RateCategory, label: "Bon (≥ 50%)",     dot: "bg-emerald-500", active: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  ];

  return (
    <DashboardLayout title="Clients & Prospects">
      <div className="max-w-[1200px] mx-auto pb-16 space-y-8">

        {/* ── Page Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-5 w-5 text-slate-400" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Clients & Prospects</h1>
            </div>
            <div className="flex items-center gap-2 ml-7">
              <span className="text-sm text-slate-400">Portefeuille commercial —</span>
              {period ? (
                <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                  {period.label}
                </span>
              ) : (
                <span className="h-5 w-20 bg-slate-100 rounded animate-pulse inline-block" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              disabled={resetting || loading}
              onClick={handleReset}
              title="Vider le cache IA et relancer la résolution des groupes d'entreprises"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-40 ${
                resetting
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:shadow-sm"
              }`}
            >
              {resetting ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin" />
                  Réinitialisation…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Vider le cache
                </>
              )}
            </button>
            <Button
              disabled={exporting || loading}
              onClick={async () => { setExporting(true); try { await exportStats(activeFilters); } finally { setExporting(false); } }}
              className="gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-sm rounded-lg"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {exporting ? "Génération..." : "Export Excel"}
            </Button>
          </div>
        </motion.div>

        {/* ── Reset toast ── */}
        <AnimatePresence>
          {resetResult && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border text-sm ${
                resetResult.cleared >= 0
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-red-50 border-red-100 text-red-800"
              }`}
            >
              {resetResult.cleared >= 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                {resetResult.cleared >= 0 ? (
                  <>
                    <p className="font-semibold">Cache vidé avec succès</p>
                    <p className="text-xs mt-0.5 opacity-80">
                      {resetResult.cleared} entreprise{resetResult.cleared !== 1 ? "s" : ""} remises en file —
                      Qwen va re-résoudre leurs groupes au prochain appel.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Échec de la réinitialisation</p>
                    <p className="text-xs mt-0.5 opacity-80">Vérifiez la connexion au serveur.</p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Summary KPIs ── */}
        {!loading && !error && (
          <section>
            <SectionHeader
              icon={<BarChart2 className="h-4 w-4" />}
              title="Vue d'ensemble"
              subtitle="Indicateurs agrégés sur l'ensemble du portefeuille"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  value:   companies.length,
                  label:   "Entreprises suivies",
                  sublabel: "Dans le portefeuille",
                  color:   "indigo",
                  icon:    <Building2 className="h-4 w-4" />,
                },
                {
                  value:   totalContacts,
                  label:   "Contacts enregistrés",
                  sublabel: "Prospects et clients actifs",
                  color:   "blue",
                  icon:    <Users className="h-4 w-4" />,
                },
                {
                  value:   totalPartners,
                  label:   "Partenaires identifiés",
                  sublabel: "Entités en relation partenariale",
                  color:   "violet",
                  icon:    <Star className="h-4 w-4" />,
                },
                {
                  value:   goodRdv,
                  label:   "Entreprises à bon taux RDV",
                  sublabel: avgRdvPct ? `Taux moyen : ${avgRdvPct}` : "Taux moyen : —",
                  color:   "emerald",
                  icon:    <TrendingUp className="h-4 w-4" />,
                },
              ].map((item, i) => {
                const colors: Record<string, { dot: string; icon: string }> = {
                  indigo:  { dot: "bg-indigo-500",  icon: "bg-indigo-50 text-indigo-600"   },
                  blue:    { dot: "bg-blue-500",    icon: "bg-blue-50 text-blue-600"       },
                  violet:  { dot: "bg-violet-500",  icon: "bg-violet-50 text-violet-600"   },
                  emerald: { dot: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600" },
                };
                const c = colors[item.color];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.35 }}
                  >
                    <Card className="border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm transition-all h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              {item.label}
                            </span>
                          </div>
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.icon}`}>
                            {item.icon}
                          </div>
                        </div>
                        <p className="text-3xl font-bold text-slate-900 tracking-tight">{item.value}</p>
                        <p className="text-xs text-slate-400 mt-1.5">{item.sublabel}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Filter Panel ── */}
        <FilterPanel companyOptions={companyOptions} onApply={setActiveFilters} loading={loading} />

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Rechercher une société..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-white border-slate-200 focus:border-slate-400 rounded-lg"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {!loading && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg whitespace-nowrap hidden sm:inline-block">
                {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 ml-auto">
              <button 
                onClick={() => setViewMode("table")} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "table" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
              <button 
                onClick={() => setViewMode("kanban")} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === "kanban" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </button>
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="py-32 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100">
            <div className="h-12 w-12 rounded-full border-2 border-slate-200 animate-spin border-t-slate-800 mb-5" />
            <p className="text-sm font-semibold text-slate-700">Chargement des indicateurs</p>
            <p className="text-xs text-slate-400 mt-1">Synchronisation avec BoondManager…</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="p-10 border rounded-2xl bg-red-50/40 text-center flex flex-col items-center">
            <AlertCircle className="h-8 w-8 mb-3 text-red-500" />
            <p className="font-semibold text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4 gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Réessayer
            </Button>
          </div>
        )}

        {/* ── Main View ── */}
        {!loading && !error && (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <SectionHeader
                icon={viewMode === "table" ? <Layers className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                title={viewMode === "table" ? "Portefeuille entreprises" : "Vue en Grille (Kanban)"}
                subtitle={viewMode === "table" ? "Taux = contacts avec ≥1 action / total — cliquer pour le détail" : "Affichage global sous forme de cartes minimalistes"}
              />
            </div>

            {viewMode === "table" ? (
              <Card className="overflow-hidden border border-slate-100 shadow-sm rounded-2xl bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="w-10 pl-4 py-3" />
                      <th className="py-3 pr-3 text-left">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Entreprise</span>
                      </th>
                      <th className="py-3 text-center">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Contacts</span>
                      </th>
                      <th className="py-3 text-center">
                        <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Partenaires</span>
                      </th>
                      <th className="py-3 pr-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Taux RDV</span>
                      </th>
                      <th className="py-3 pr-5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Taux Appel</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                            <Building2 className="h-10 w-10 opacity-20" />
                            <p className="text-sm font-medium">Aucun résultat</p>
                            <p className="text-xs text-slate-300">Essayez d'élargir la période ou de modifier les filtres</p>
                          </div>
                        </td>
                      </tr>
                    )}
                    {filtered.map((co, i) => (
                      <CompanyRow
                        key={co.name}
                        co={co}
                        idx={i}
                        isOpen={expanded.has(co.name)}
                        onToggle={() => toggle(co.name)}
                        onSelect={() => setSelected(co)}
                      />
                    ))}
                  </tbody>
                </table>

                {/* Footer — rate filters */}
                <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <Filter className="h-3 w-3" /> Filtrer par taux
                  </div>
                  <div className="h-3 w-px bg-slate-200 mx-1" />
                  {rateFilterDefs.map(({ id, label, dot, active }) => {
                    const isOn = rateFilters.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => setRateFilters(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all duration-150 ${
                          isOn ? active : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        {label}
                      </button>
                    );
                  })}
                  {rateFilters.length > 0 && (
                    <button
                      onClick={() => setRateFilters([])}
                      className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                    >
                      <X className="h-3 w-3" /> Tout effacer
                    </button>
                  )}
                </div>
              </Card>
            ) : (
              // Kanban View
              <div>
                {/* Mobile hint if needed */}
                <div className="sm:hidden mb-3 text-xs text-slate-500 flex items-center gap-2 px-1">
                   <ArrowUpRight className="h-3 w-3" /> Glissez horizontalement pour voir les colonnes
                </div>
                <KanbanBoard 
                  companies={filtered} 
                  expanded={expanded} 
                  onToggle={toggle} 
                  onSelect={setSelected} 
                />
              </div>
            )}
          </section>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && <CompanyModal co={selected} onClose={() => setSelected(null)} />}
      </Dialog>
    </DashboardLayout>
  );
}