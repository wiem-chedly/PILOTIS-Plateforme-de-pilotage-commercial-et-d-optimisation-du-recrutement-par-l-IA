import { useState } from 'react';
import { useCompanies } from '@/hooks/useCompanies';
import { Card, CardContent } from '@/components/ui/card';
import {
    Loader2, AlertCircle, Building2, RefreshCw,
    CalendarCheck, Phone, ChevronDown, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── helpers ──────────────────────────────────────────────────────────────────

function getRateValue(s: string): number | null {
    if (!s || s === 'N/A' || s === 'undefined') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

/** 3 tiers — Grey for N/A only, Red for 0 and below 0.20, Orange 0.20–0.50, Green ≥ 0.50 */
function getTier(rate: number | null) {
    if (rate === null)
        return { pill: 'bg-gray-100 text-gray-400 border-gray-200', bar: 'bg-gray-200', label: 'N/A' };
    if (rate < 0.20)
        return { pill: 'bg-red-50 text-red-600 border-red-200', bar: 'bg-red-400', label: 'Faible' };
    if (rate < 0.50)
        return { pill: 'bg-orange-50 text-orange-600 border-orange-200', bar: 'bg-orange-400', label: 'Moyen' };
    return { pill: 'bg-emerald-50 text-emerald-600 border-emerald-200', bar: 'bg-emerald-500', label: 'Bon' };
}

function getInitials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

const AVATAR_PALETTES = [
    'bg-blue-100 text-blue-700',
    'bg-teal-100 text-teal-700',
    'bg-rose-100 text-rose-700',
    'bg-orange-100 text-orange-700',
    'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700',
];
function avatarBg(name: string): string {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}

// ── Rate cell ─────────────────────────────────────────────────────────────────

function RateCell({ value, count, icon: Icon, label }: {
    value: string; count: number; icon: typeof CalendarCheck; label: string;
}) {
    const rate = getRateValue(value);
    const tier = getTier(rate);
    const pct = Math.min((rate ?? 0) * 100, 100);

    return (
        <div className="flex flex-col items-end gap-1.5 min-w-[90px]">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border tabular-nums ${tier.pill}`}>
                <Icon className="h-3 w-3 opacity-80" />
                {value === 'N/A' ? <span className="text-gray-400">N/A</span> : value}
            </span>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${tier.bar}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                {count} {label}
            </span>
        </div>
    );
}

// ── Sub-company row ───────────────────────────────────────────────────────────

interface SubDetail {
    name: string; status: string;
    nb_contacts: number; nb_rdv: number; nb_appel: number;
    taux_rdv: string; taux_appel: string;
}

function SubRow({ sub }: { sub: SubDetail }) {
    const statusPill =
        sub.status === 'Client' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            sub.status === 'Partenaire' ? 'bg-violet-50  text-violet-700  border-violet-200' :
                'bg-blue-50    text-blue-700    border-blue-200';

    const rdv = getTier(getRateValue(sub.taux_rdv));
    const appel = getTier(getRateValue(sub.taux_appel));

    return (
        <div className="grid grid-cols-[2fr_260px_110px_110px] gap-3 items-center
                        px-6 py-2.5 bg-slate-50/70 border-t border-dashed border-border/30
                        hover:bg-slate-100/60 transition-colors">
            {/* Name + status badge */}
            <div className="flex items-center gap-2.5 pl-10 min-w-0">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/25 flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate font-medium">{sub.name}</p>
                <span className={`text-[10px] px-1.5 py-px rounded border font-medium flex-shrink-0 ${statusPill}`}>
                    {sub.status}
                </span>
            </div>



            {/* Merged contacts cell */}
            <div className="flex items-center justify-center">
                {sub.nb_contacts > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 border border-border/40 px-2 py-0.5 rounded-md tabular-nums">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        {sub.nb_contacts} contact{sub.nb_contacts > 1 ? 's' : ''}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/30">Aucun contact</span>
                )}
            </div>

            {/* Taux RDV */}
            <div className="flex justify-end">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${rdv.pill}`}>
                    <CalendarCheck className="h-3 w-3" />{sub.taux_rdv}
                </span>
            </div>

            {/* Taux Appel */}
            <div className="flex justify-end">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${appel.pill}`}>
                    <Phone className="h-3 w-3" />{sub.taux_appel}
                </span>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompanyTable() {
    const { companies, period, loading, error } = useCompanies();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const toggle = (name: string) =>
        setExpanded((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

    if (loading) return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-24">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <div className="text-center">
                    <p className="font-semibold text-sm text-foreground">Chargement des données Boond…</p>
                    <p className="text-xs text-muted-foreground mt-1">Cela peut prendre 30 à 60 secondes.</p>
                </div>
            </CardContent>
        </Card>
    );

    if (error) return (
        <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-4 py-8 px-6">
                <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                    <p className="font-semibold text-destructive text-sm">Impossible de charger les données</p>
                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Vérifiez que le backend Flask tourne sur le port 5001.
                    </p>
                </div>
            </CardContent>
        </Card>
    );

    if (companies.length === 0) return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Building2 className="h-8 w-8 opacity-30" />
                <p className="text-sm">Aucune entreprise trouvée pour la période.</p>
            </CardContent>
        </Card>
    );

    return (
        <Card className="overflow-hidden border border-border/60 shadow-sm">
            {/* ── Column headers ── */}
            <div className="grid grid-cols-[2fr_80px_80px_88px_110px_110px] gap-3
                            px-6 py-2.5 border-b border-border/50 bg-muted/30">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Entreprise</span>
                <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider text-center">Prospects</span>
                <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider text-center">Clients</span>
                <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider text-center">Partenaires</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Taux RDV</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Taux Appel</span>
            </div>

            {/* ── Rows ── */}
            <div className="divide-y divide-border/40">
                {companies.map((co, i) => {
                    const isOpen = expanded.has(co.name);
                    const subDetails = co.sub_company_details ?? [];
                    const hasSubs = subDetails.length >= 1;

                    return (
                        <div key={co.name}>
                            <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.025, duration: 0.2 }}
                                onClick={() => hasSubs && toggle(co.name)}
                                className={`grid grid-cols-[2fr_80px_80px_88px_110px_110px] gap-3 items-center
                                            px-6 py-3 transition-colors duration-100
                                            ${hasSubs ? 'cursor-pointer hover:bg-muted/25' : 'hover:bg-muted/15'}`}
                            >
                                {/* Company identity */}
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-4 flex-shrink-0 flex items-center justify-center">
                                        {hasSubs
                                            ? isOpen
                                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                                            : <div className="h-3.5 w-3.5" />
                                        }
                                    </div>
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center
                                                    text-xs font-bold flex-shrink-0 ${avatarBg(co.name)}`}>
                                        {getInitials(co.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate leading-tight">
                                            {co.name}
                                        </p>
                                        {hasSubs && (
                                            <p className="text-[10px] text-muted-foreground/50 mt-px">
                                                {subDetails.length} entit{subDetails.length > 1 ? 'és' : 'é'}
                                            </p>
                                        )}
                                    </div>
                                </div>



                                {/* Prospects */}
                                <div className="flex justify-center">
                                    <span className={`text-sm font-bold tabular-nums ${co.nb_prospects > 0 ? 'text-blue-600' : 'text-muted-foreground/30'}`}>
                                        {co.nb_prospects}
                                    </span>
                                </div>

                                {/* Clients */}
                                <div className="flex justify-center">
                                    <span className={`text-sm font-bold tabular-nums ${co.nb_clients > 0 ? 'text-emerald-600' : 'text-muted-foreground/30'}`}>
                                        {co.nb_clients}
                                    </span>
                                </div>

                                {/* Partenaires */}
                                <div className="flex justify-center">
                                    <span className={`text-sm font-bold tabular-nums ${co.nb_partenaires > 0 ? 'text-indigo-600' : 'text-muted-foreground/30'}`}>
                                        {co.nb_partenaires}
                                    </span>
                                </div>

                                <RateCell value={co.taux_rdv} count={co.nb_rdv} icon={CalendarCheck} label="RDV" />
                                <RateCell value={co.taux_appel} count={co.nb_appel} icon={Phone} label="Appels" />
                            </motion.div>

                            {/* Expanded sub-companies */}
                            <AnimatePresence>
                                {isOpen && hasSubs && (
                                    <motion.div
                                        key="subs"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.18, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        {subDetails.map((sub) => (
                                            <SubRow key={sub.name} sub={sub} />
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* ── Footer legend ── */}
            <div className="flex items-center gap-5 px-6 py-2.5 border-t border-border/40 bg-muted/20">
                <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide mr-1">Taux :</span>
                {[
                    { label: 'N/A', dot: 'bg-gray-300' },
                    { label: 'Faible (< 0.20)', dot: 'bg-red-400' },
                    { label: 'Moyen (0.20–0.50)', dot: 'bg-orange-400' },
                    { label: 'Bon (≥ 0.50)', dot: 'bg-emerald-500' },
                ].map(({ label, dot }) => (
                    <span key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                        <span className={`h-2 w-2 rounded-full ${dot}`} />
                        {label}
                    </span>
                ))}
                <span className="ml-auto text-[10px] text-muted-foreground/40">
                    {companies.length} entreprises · {period?.label ?? '…'}
                </span>
            </div>
        </Card>
    );
}