import React, { useEffect, useState } from 'react';
import { getMonthlyStats, type CompanyStat } from '../services/companiesService';
import ExportButtons from './ExportButtons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Users, Target, CheckCircle2, Handshake, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BoondStats = () => {
  const [stats, setStats] = useState<CompanyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getMonthlyStats();
      console.log('Données reçues:', data);
      setStats(data.stats || []);
      setMonth(data.month || '');
      setLoading(false);
    } catch (err) {
      setError("Erreur de chargement des données");
      setLoading(false);
    }
  };

  const totalProspects = stats.reduce((sum, c) => sum + (c.prospects || 0), 0);
  const totalClients = stats.reduce((sum, c) => sum + (c.clients || 0), 0);
  const totalPartners = stats.reduce((sum, c) => sum + (c.partners || 0), 0);
  const totalContacts = stats.reduce((sum, c) => sum + (c.total || 0), 0);

  if (loading) {
    return (
      <Card className="border-none shadow-premium bg-white/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground animate-pulse">Analyse des données BoondManager...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <RefreshCw className="h-6 w-6 text-destructive cursor-pointer hover:rotate-180 transition-transform duration-500" onClick={loadData} />
          </div>
          <p className="text-destructive font-semibold">{error}</p>
          <button onClick={loadData} className="mt-4 text-sm underline text-destructive/80 hover:text-destructive">Réessayer</button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Section - Dynamic and colorful */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard title="Contacts" value={totalProspects + totalClients} icon={<Target />} color="bg-[hsla(224,80%,40%,1)]" />
        <KPICard title="Partenaires" value={totalPartners} icon={<Handshake />} color="bg-indigo-600" />
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Répartition par Société
            </CardTitle>
            <CardDescription>
              {month ? `Statistiques pour ${month}` : 'Données mensuelles consolidées'} • {stats.length} entités actives
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
              title="Rafraîchir"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <ExportButtons data={stats} month={month} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[300px] pl-6 font-semibold uppercase text-[10px] tracking-wider text-slate-500">Société</TableHead>
                  <TableHead className="text-center font-semibold uppercase text-[10px] tracking-wider text-slate-500">Contacts</TableHead>
                  <TableHead className="text-center pr-6 font-semibold uppercase text-[10px] tracking-wider text-slate-500">Partenaires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {stats.map((company, index) => (
                    <motion.tr
                      key={company.display_name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="group hover:bg-slate-50/80 transition-colors border-b last:border-0"
                    >
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors">
                            {company.display_name}
                          </span>
                          {company.other_names && company.other_names.length > 0 && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[250px]">
                              {company.other_names.join(' · ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`border-blue-100 bg-blue-50/30 text-blue-700 hover:bg-blue-50 transition-colors ${(company.prospects + company.clients) === 0 && 'opacity-30'}`}>
                          {company.prospects + company.clients}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center pr-6">
                        <Badge variant="outline" className={`border-indigo-100 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-50 transition-colors ${company.partners === 0 && 'opacity-30'}`}>
                          {company.partners}
                        </Badge>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const KPICard = ({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) => (
  <Card className="border-none shadow-lg overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
    <CardContent className="p-0">
      <div className="flex h-24">
        <div className={`w-2 h-full ${color}`} />
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
            <div className={`p-1.5 rounded-lg opacity-80 ${color} shadow-sm group-hover:scale-110 transition-transform`}>
              {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4 text-white" })}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">{value}</span>
            <span className="text-[10px] text-slate-400 font-medium">CONTACTS</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default BoondStats;