// src/pages/CVExtraction.tsx
import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Wifi, WifiOff, RefreshCw, Users, CheckCircle2,
  AlertCircle, Clock, Eye, ChevronDown, ChevronUp, Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImportedProfile {
  full_name:   string;
  first_name:  string;
  last_name:   string;
  email:       string;
  phone:       string;
  title:       string;
  summary:     string;
  skills:      string[];
  languages:   string[];
  location:    string;
  linkedin_url:string;
  cv_url:      string;
}

interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors:  number;
  total:   number;
}

interface ImportHistory {
  id:          number;
  full_name:   string;
  email:       string;
  skills:      string;
  created_at:  string;
}

const CVExtraction = () => {
  const { toast } = useToast();

  const [loading,    setLoading]    = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [connected,  setConnected]  = useState<boolean | null>(null);

  const [profiles,   setProfiles]   = useState<ImportedProfile[]>([]);
  const [stats,      setStats]      = useState<ImportStats | null>(null);
  const [history,    setHistory]    = useState<ImportHistory[]>([]);
  const [expanded,   setExpanded]   = useState<number | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  // ── Test connection ────────────────────────────────────────────────────────
  const testConnection = async () => {
    setTesting(true);
    try {
      const res  = await fetch('/api/cv/import/test-connection');
      const data = await res.json();
      setConnected(data.success);
      toast({
        title: data.success ? '✅ Connexion réussie' : '❌ Connexion échouée',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive',
      });
    } catch {
      setConnected(false);
      toast({ title: '❌ Erreur réseau', description: 'Impossible de joindre le serveur', variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  // ── Preview (sans sauvegarde) ──────────────────────────────────────────────
  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      const res  = await fetch('/api/cv/import/preview');
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data);
        toast({ title: `👁 Aperçu — ${data.count} profil(s) trouvé(s)`, description: 'Données non sauvegardées' });
      } else {
        setError(data.error);
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setPreviewing(false);
    }
  };

  // ── Import complet ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/cv/import', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data);
        setStats(data.stats);
        toast({
          title: '✅ Import terminé',
          description: `${data.stats.created} créé(s) · ${data.stats.updated} mis à jour · ${data.stats.errors} erreur(s)`,
        });
        loadHistory();
      } else {
        setError(data.error);
        toast({ title: '❌ Erreur', description: data.error, variant: 'destructive' });
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // ── History ────────────────────────────────────────────────────────────────
  const loadHistory = async () => {
    try {
      const res  = await fetch('/api/cv/import/history');
      const data = await res.json();
      setHistory(data);
    } catch { /* silent */ }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <DashboardLayout title="Extraction CV — DoYouBuzz">
      <div className="space-y-6">

        {/* ── Header / Controls ──────────────────────────────────────── */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">
                  Importer des CVs depuis DoYouBuzz / Showcase
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Connecté à <span className="font-medium text-indigo-600">showcase.doyoubuzz.com</span>
                </p>
              </div>
              {connected === true  && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Connecté</Badge>}
              {connected === false && <Badge className="bg-red-100 text-red-700 border-red-200"><AlertCircle className="h-3 w-3 mr-1" />Non connecté</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={testConnection} disabled={testing} className="border-slate-300">
                {testing
                  ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  : (connected === false ? <WifiOff className="h-4 w-4 mr-2 text-red-500" /> : <Wifi className="h-4 w-4 mr-2" />)
                }
                Tester la connexion
              </Button>

              <Button variant="outline" onClick={handlePreview} disabled={previewing || loading} className="border-indigo-300 text-indigo-700">
                {previewing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Aperçu (10 profils)
              </Button>

              <Button onClick={handleImport} disabled={loading || previewing}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                {loading
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Import en cours...</>
                  : <><Download className="h-4 w-4 mr-2" />Lancer l'import complet</>
                }
              </Button>

              <Button variant="ghost" onClick={loadHistory} className="text-slate-500">
                <Clock className="h-4 w-4 mr-2" />Historique
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
          </CardContent>
        </Card>



        {/* ── Profiles table ──────────────────────────────────────────── */}
        {profiles.length > 0 && (
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-indigo-500" />
                Candidats importés ({profiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Compétences</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((c, idx) => (
                    <>
                      <TableRow
                        key={idx}
                        className="cursor-pointer hover:bg-indigo-50/50 transition-colors"
                        onClick={() => setExpanded(expanded === idx ? null : idx)}
                      >
                        <TableCell className="font-semibold text-slate-800">{c.full_name || '—'}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{c.email || '—'}</TableCell>
                        <TableCell className="text-slate-600 text-sm">{c.phone || '—'}</TableCell>
                        <TableCell>
                          {c.title
                            ? <span className="flex items-center gap-1 text-sm"><Briefcase className="h-3 w-3 text-slate-400" />{c.title}</span>
                            : <span className="text-slate-400">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{c.location || '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {c.skills.slice(0, 3).map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs py-0">{s}</Badge>
                            ))}
                            {c.skills.length > 3 && (
                              <Badge variant="outline" className="text-xs py-0">+{c.skills.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {expanded === idx
                            ? <ChevronUp className="h-4 w-4 text-slate-400" />
                            : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </TableCell>
                      </TableRow>

                      {/* Expanded detail row */}
                      {expanded === idx && (
                        <TableRow key={`exp-${idx}`} className="bg-indigo-50/30">
                          <TableCell colSpan={7} className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                              {c.summary && (
                                <div className="sm:col-span-3">
                                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Résumé</p>
                                  <p className="text-slate-700 leading-relaxed">{c.summary}</p>
                                </div>
                              )}
                              {c.skills.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Compétences ({c.skills.length})</p>
                                  <div className="flex flex-wrap gap-1">
                                    {c.skills.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
                                  </div>
                                </div>
                              )}
                              {c.languages.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Langues</p>
                                  <div className="flex flex-wrap gap-1">
                                    {c.languages.map((l, i) => <Badge key={i} variant="outline" className="text-xs">{l}</Badge>)}
                                  </div>
                                </div>
                              )}
                              {c.linkedin_url && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">LinkedIn</p>
                                  <a href={c.linkedin_url} target="_blank" rel="noreferrer"
                                     className="text-indigo-600 hover:underline text-xs break-all">{c.linkedin_url}</a>
                                </div>
                              )}
                              {c.cv_url && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">CV Original</p>
                                  <a href={c.cv_url} target="_blank" rel="noreferrer"
                                     className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md text-xs font-medium border border-emerald-100 transition-colors">
                                    <Download className="h-3 w-3" />
                                    Télécharger le CV
                                  </a>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── Import history ──────────────────────────────────────────── */}
        {history.length > 0 && (
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-slate-500" />Historique des imports
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Date d'import</TableHead>
                    <TableHead>Candidat</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Compétences</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm text-slate-600">{fmtDate(h.created_at)}</TableCell>
                      <TableCell className="font-medium text-slate-800">{h.full_name || '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{h.email || '—'}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded truncate max-w-[200px] inline-block">
                          {h.skills || 'Aucune'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
};

export default CVExtraction;
