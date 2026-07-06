import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Search, X, SlidersHorizontal, RotateCcw,
  CalendarDays, History, ChevronDown, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterParams {
  startDate: string;
  endDate: string;
  contactTypes: string[];
  companyNames: string[];
  keyword: string;
}

// ── Default period (same first-week rule) ─────────────────────────────────────

const today = new Date();
const ref = new Date(today);
if (today.getDate() <= 7) ref.setMonth(today.getMonth() - 1);
const refYear  = ref.getFullYear();
const refMonth = ref.getMonth() + 1;
const lastDay  = new Date(refYear, refMonth, 0).getDate();
const mm       = String(refMonth).padStart(2, "0");

export const DEFAULT_FILTERS: FilterParams = {
  startDate:    `${refYear}-${mm}-01`,
  endDate:      `${refYear}-${mm}-${lastDay}`,
  contactTypes: ["Contacts", "Partenaire"],
  companyNames: [],
  keyword:      "",
};

interface Props {
  companyOptions: string[];
  onApply: (f: FilterParams) => void;
  loading: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(s: string) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

// ── Section label ─────────────────────────────────────────────────────────────
function FieldLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{children}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FilterPanel({ companyOptions, onApply, loading }: Props) {
  const [filters, setFilters]         = useState<FilterParams>(DEFAULT_FILTERS);
  const [dateError, setDateError]     = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [showDropdown, setShowDropdown]   = useState(false);
  const [isExpanded, setIsExpanded]       = useState(true);

  const patch = (partial: Partial<FilterParams>) =>
    setFilters(f => ({ ...f, ...partial }));

  const toggleType = (t: string) =>
    patch({
      contactTypes: filters.contactTypes.includes(t)
        ? filters.contactTypes.filter(x => x !== t)
        : [...filters.contactTypes, t],
    });

  const toggleCompany = (name: string) =>
    patch({
      companyNames: filters.companyNames.includes(name)
        ? filters.companyNames.filter(x => x !== name)
        : [...filters.companyNames, name],
    });

  const filteredOptions = companyOptions.filter(
    c => c.toLowerCase().includes(companySearch.toLowerCase()) &&
         !filters.companyNames.includes(c)
  );

  const validate = (): boolean => {
    const { startDate, endDate } = filters;
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setDateError("Veuillez saisir la date de début ET de fin.");
      return false;
    }
    if (startDate && endDate && startDate > endDate) {
      setDateError("La date de début doit être antérieure à la date de fin.");
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleApply = () => { if (validate()) onApply(filters); };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setDateError(null);
    setCompanySearch("");
    onApply(DEFAULT_FILTERS);
  };

  // Count active non-default filters for the badge
  const activeCount = [
    filters.startDate !== DEFAULT_FILTERS.startDate || filters.endDate !== DEFAULT_FILTERS.endDate,
    filters.contactTypes.length !== DEFAULT_FILTERS.contactTypes.length,
    filters.companyNames.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="w-full bg-white border border-slate-100 shadow-sm rounded-2xl overflow-visible">

      {/* ── Header ── */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">Filtres de recherche</span>
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Active filter pills summary (collapsed state) */}
          {!isExpanded && activeCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              {filters.startDate && (
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {formatDate(filters.startDate)} → {formatDate(filters.endDate)}
                </span>
              )}
              {filters.companyNames.length > 0 && (
                <span className="text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                  {filters.companyNames.length} entreprise{filters.companyNames.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </button>

      {/* ── Body ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-visible"
          >
            <div className="border-t border-slate-100 px-5 py-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ── Left: Period ── */}
                <div className="lg:col-span-4 space-y-5">
                  <div>
                    <FieldLabel icon={<CalendarDays className="h-3.5 w-3.5" />}>
                      Période d'analyse
                    </FieldLabel>

                    <div className="space-y-2.5">
                      {(["startDate", "endDate"] as const).map(field => (
                        <div key={field} className="relative">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-slate-500 font-medium">
                              {field === "startDate" ? "Date de début" : "Date de fin"}
                            </span>
                            <button
                              onClick={() => patch({ [field]: todayStr() })}
                              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              <History className="h-2.5 w-2.5" />
                              Aujourd'hui
                            </button>
                          </div>
                          <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300 pointer-events-none" />
                            <Input
                              type="date"
                              value={filters[field]}
                              onChange={e => patch({ [field]: e.target.value })}
                              className="pl-9 h-9 text-sm bg-white border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 rounded-lg transition-colors"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <AnimatePresence>
                      {dateError && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-red-500 flex items-center gap-1.5 mt-2"
                        >
                          <X className="h-3 w-3 flex-shrink-0" />
                          {dateError}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ── Contact type ── */}
                  <div>
                    <FieldLabel icon={<SlidersHorizontal className="h-3.5 w-3.5" />}>
                      Type de contact
                    </FieldLabel>
                    <div className="flex gap-2">
                      {(["Contacts", "Partenaire"] as const).map(t => {
                        const on = filters.contactTypes.includes(t);
                        const styles: Record<string, string> = {
                          Contacts:   on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                          Partenaire: on ? "bg-violet-600 border-violet-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
                        };
                        return (
                          <button
                            key={t}
                            onClick={() => toggleType(t)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${styles[t]}`}
                          >
                            {on && <Check className="h-3 w-3" />}
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="hidden lg:flex lg:col-span-1 items-stretch justify-center py-1">
                  <div className="w-px bg-slate-100" />
                </div>
                <div className="lg:hidden h-px bg-slate-100 w-full" />

                {/* ── Right: Companies ── */}
                <div className="lg:col-span-7 relative z-20">
                  <FieldLabel icon={<Search className="h-3.5 w-3.5" />}>
                    Entreprises associées
                    {filters.companyNames.length > 0 && (
                      <span className="ml-2 normal-case text-indigo-600 font-bold">
                        · {filters.companyNames.length} sélectionnée{filters.companyNames.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </FieldLabel>

                  {/* Search input */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <Input
                      placeholder="Rechercher une entreprise..."
                      value={companySearch}
                      onChange={e => { setCompanySearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      className="pl-9 h-9 text-sm bg-white border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 rounded-lg transition-colors"
                      autoComplete="off"
                    />
                    {companySearch && (
                      <button
                        onClick={() => { setCompanySearch(""); setShowDropdown(false); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown */}
                  <AnimatePresence>
                    {showDropdown && companySearch && filteredOptions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-[calc(100%-8px)] max-h-52 overflow-y-auto border border-slate-200 rounded-xl shadow-lg bg-white z-50"
                      >
                        <div className="p-1.5 space-y-0.5">
                          {filteredOptions.slice(0, 20).map(name => (
                            <button
                              key={name}
                              onMouseDown={e => {
                                e.preventDefault();
                                toggleCompany(name);
                                setCompanySearch("");
                                setShowDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors font-medium flex items-center justify-between group"
                            >
                              {name}
                              <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                Ajouter
                              </span>
                            </button>
                          ))}
                        </div>
                        {filteredOptions.length > 20 && (
                          <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                            {filteredOptions.length - 20} autres résultats — affinez la recherche
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Selected chips */}
                  {filters.companyNames.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <AnimatePresence>
                        {filters.companyNames.map(name => (
                          <motion.div
                            key={name}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.15 }}
                          >
                            <button
                              onClick={() => toggleCompany(name)}
                              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 hover:border-indigo-200 transition-all group"
                            >
                              <span className="truncate max-w-[160px]">{name}</span>
                              <span className="h-4 w-4 rounded-md bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center flex-shrink-0 transition-colors">
                                <X className="h-2.5 w-2.5" />
                              </span>
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {filters.companyNames.length > 1 && (
                        <button
                          onClick={() => patch({ companyNames: [] })}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                        >
                          <X className="h-3 w-3" />
                          Tout retirer
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      Toutes les entreprises sont incluses — recherchez pour filtrer
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all disabled:opacity-40 w-full sm:w-auto justify-center"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Réinitialiser
              </button>
              <button
                onClick={handleApply}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all disabled:opacity-40 w-full sm:w-auto justify-center"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Chargement…
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Appliquer les filtres
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}