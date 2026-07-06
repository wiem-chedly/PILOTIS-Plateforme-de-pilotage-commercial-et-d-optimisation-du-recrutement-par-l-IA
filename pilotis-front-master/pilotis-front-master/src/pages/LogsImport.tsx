import { useState, useEffect, useCallback } from "react";
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Calendar,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Download,
    Search,
    Filter,
    RefreshCw,
    FileText,
    Clock,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Log {
    id: number;
    date: string;
    statut: string;
    message: string;
    nombre_importes: number;
}

// Données mockées
const mockLogs: Log[] = [
    {
        id: 1,
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        statut: 'SUCCESS',
        message: 'Import réussi — 156 besoins (ajouts: 12, maj: 144)',
        nombre_importes: 156
    },
    {
        id: 2,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        statut: 'SUCCESS',
        message: 'Import réussi — 203 besoins (ajouts: 23, maj: 180)',
        nombre_importes: 203
    },
    {
        id: 3,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        statut: 'ERROR',
        message: 'Erreur de connexion à l\'API BoondManager - Timeout',
        nombre_importes: 0
    },
    {
        id: 4,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        statut: 'SUCCESS',
        message: 'Import réussi — 178 besoins (ajouts: 15, maj: 163)',
        nombre_importes: 178
    },
    {
        id: 5,
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        statut: 'SUCCESS',
        message: 'Import réussi — 145 besoins (ajouts: 8, maj: 137)',
        nombre_importes: 145
    },
    {
        id: 6,
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        statut: 'SUCCESS',
        message: 'Import réussi — 192 besoins (ajouts: 19, maj: 173)',
        nombre_importes: 192
    },
    {
        id: 7,
        date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        statut: 'ERROR',
        message: 'Erreur d\'authentification - Token invalide',
        nombre_importes: 0
    },
    {
        id: 8,
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        statut: 'SUCCESS',
        message: 'Import réussi — 167 besoins (ajouts: 14, maj: 153)',
        nombre_importes: 167
    }
];

const getStatutConfig = (statut: string) => {
    const upperStatut = statut.toUpperCase();
    switch (upperStatut) {
        case 'SUCCESS':
            return {
                icon: CheckCircle2,
                bg: "bg-emerald-50",
                text: "text-emerald-700",
                border: "border-emerald-200",
                label: "Succès"
            };
        case 'ERROR':
            return {
                icon: XCircle,
                bg: "bg-red-50",
                text: "text-red-700",
                border: "border-red-200",
                label: "Erreur"
            };
        default:
            return {
                icon: AlertCircle,
                bg: "bg-amber-50",
                text: "text-amber-700",
                border: "border-amber-200",
                label: "En cours"
            };
    }
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
        full: date.toLocaleString('fr-FR'),
        date: date.toLocaleDateString('fr-FR'),
        time: date.toLocaleTimeString('fr-FR')
    };
};

const LogsImport = () => {
    const { user, hasAccess } = useAuth();
    const { toast } = useToast();
    const [logs, setLogs] = useState<Log[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [dateRange, setDateRange] = useState({ start: "", end: "" });

    // remove loadPermissions

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:5000/api/import-logs', { credentials: 'include' });
            if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
            const data = await res.json();
            if (data && data.length > 0) {
                setLogs(data);
                setFilteredLogs(data);
            } else {
                setLogs(mockLogs);
                setFilteredLogs(mockLogs);
                toast({ title: "Mode démo", description: "Utilisation de données de démonstration" });
            }
        } catch (err) {
            setLogs(mockLogs);
            setFilteredLogs(mockLogs);
            toast({ title: "Mode démo", description: "API indisponible" });
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = useCallback(() => {
        let filtered = [...logs];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(log =>
                log.message.toLowerCase().includes(query) ||
                log.statut.toLowerCase().includes(query)
            );
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter(log => log.statut.toUpperCase() === statusFilter.toUpperCase());
        }

        if (dateRange.start) {
            const startDate = new Date(dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(log => new Date(log.date) >= startDate);
        }

        if (dateRange.end) {
            const endDate = new Date(dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(log => new Date(log.date) <= endDate);
        }

        setFilteredLogs(filtered);
        setCurrentPage(1);
    }, [logs, searchQuery, statusFilter, dateRange]);

    const resetFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setDateRange({ start: "", end: "" });
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

    // Vérifications des permissions
    if (!hasAccess('logs-import')) {
        return (
            <DashboardLayout title="Logs d'importation">
                <div className="flex items-center justify-center min-h-[400px]">
                    <Card className="w-full max-w-md shadow-sm border-slate-200">
                        <CardContent className="pt-8 pb-6 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                                <XCircle className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Accès restreint</h2>
                            <p className="text-slate-600 mb-4 px-4 text-sm leading-relaxed">
                                Vous n'avez pas l'autorisation de consulter la page des Logs d'importation.
                            </p>
                            <Button asChild variant="outline" className="mt-2 text-sm bg-slate-50">
                                <a href="/">Retour au Dashboard</a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        );
    }

    if (loading) {
        return (
            <DashboardLayout title="Logs d'importation">
                <div className="flex justify-center items-center min-h-[400px]">
                    <div className="text-center">
                        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                        <p className="mt-4 text-sm text-muted-foreground">Chargement des logs...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Logs d'importation">
            <div className="space-y-6">
                {/* Barre de filtres */}
                <Card className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                            <div className="flex flex-1 flex-wrap gap-3 items-center">
                                <div className="relative flex-1 min-w-[250px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Rechercher dans le message ou le statut..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-9 text-sm"
                                    />
                                </div>

                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-[140px] h-9 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4" />
                                            <SelectValue placeholder="Statut" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tous les statuts</SelectItem>
                                        <SelectItem value="SUCCESS">✅ Succès</SelectItem>
                                        <SelectItem value="ERROR">❌ Erreur</SelectItem>
                                    </SelectContent>
                                </Select>

                                <div className="flex items-center gap-2">
                                    <Input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                        className="w-[140px] h-9 text-sm"
                                    />
                                    <span className="text-muted-foreground text-sm">-</span>
                                    <Input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                        className="w-[140px] h-9 text-sm"
                                    />
                                </div>

                                <Button variant="outline" size="sm" onClick={fetchLogs} className="h-9 w-9 p-0">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-3">
                                <p className="text-sm text-muted-foreground whitespace-nowrap">
                                    {filteredLogs.length} résultat(s)
                                </p>
                                {(searchQuery || statusFilter !== "all" || dateRange.start || dateRange.end) && (
                                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
                                        Réinitialiser
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tableau des logs */}
                <Card className="overflow-hidden border shadow-sm">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[180px]">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Date
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[100px]">Statut</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead className="w-[100px] text-center">Importés</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <FileText className="h-8 w-8 mb-2 opacity-50" />
                                                <p>Aucun log trouvé</p>
                                                <p className="text-sm">Essayez de modifier les filtres</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    currentItems.map((log) => {
                                        const config = getStatutConfig(log.statut);
                                        const StatutIcon = config.icon;
                                        const formattedDate = formatDate(log.date);

                                        return (
                                            <TableRow
                                                key={log.id}
                                                className="group hover:bg-muted/50 transition-colors cursor-pointer"
                                                onClick={() => setSelectedLog(log)}
                                            >
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{formattedDate.date}</span>
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formattedDate.time}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            config.bg,
                                                            config.text,
                                                            config.border,
                                                            "px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1"
                                                        )}
                                                    >
                                                        <StatutIcon className="h-3 w-3" />
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    <p className="text-sm truncate">{log.message}</p>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="font-mono text-xs">
                                                        {log.nombre_importes}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {filteredLogs.length > 0 && totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/5">
                            <div className="flex items-center gap-2">
                                <Select
                                    value={itemsPerPage.toString()}
                                    onValueChange={(v) => {
                                        setItemsPerPage(Number(v));
                                        setCurrentPage(1);
                                    }}
                                >
                                    <SelectTrigger className="w-[100px] h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10 / page</SelectItem>
                                        <SelectItem value="20">20 / page</SelectItem>
                                        <SelectItem value="50">50 / page</SelectItem>
                                        <SelectItem value="100">100 / page</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredLogs.length)} sur {filteredLogs.length}
                                </p>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronsLeft className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <span className="text-xs font-medium min-w-[70px] text-center">
                                    {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronsRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Modal de détails */}
                {selectedLog && (
                    <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-base">
                                    <FileText className="h-5 w-5 text-primary" />
                                    Détails de l'import
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const config = getStatutConfig(selectedLog.statut);
                                            const StatutIcon = config.icon;
                                            return (
                                                <Badge className={cn(config.bg, config.text, config.border, "px-3 py-1 text-xs")}>
                                                    <StatutIcon className="h-3 w-3 mr-1" />
                                                    {config.label}
                                                </Badge>
                                            );
                                        })()}
                                    </div>
                                    <span className="text-xs text-muted-foreground">ID: #{selectedLog.id}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="border rounded-lg p-3">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span className="text-xs">Date</span>
                                        </div>
                                        <p className="text-sm font-medium">{formatDate(selectedLog.date).full}</p>
                                    </div>
                                    <div className="border rounded-lg p-3">
                                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                            <Download className="h-3.5 w-3.5" />
                                            <span className="text-xs">Importés</span>
                                        </div>
                                        <p className="text-sm font-medium">{selectedLog.nombre_importes} besoins</p>
                                    </div>
                                </div>

                                <div className="border rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                                        <FileText className="h-3.5 w-3.5" />
                                        <span className="text-xs">Message</span>
                                    </div>
                                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedLog.message}</p>
                                </div>

                                <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
                                    <p>Type: Import BoondManager</p>
                                    <p>Source: API BoondManager</p>
                                </div>
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setSelectedLog(null)} className="h-8 text-xs">
                                    Fermer
                                </Button>
                                <Button variant="default" onClick={() => toast({ title: "Export", description: "Fonctionnalité d'export à venir" })} className="h-8 text-xs">
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Exporter
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </DashboardLayout>
    );
};

export default LogsImport;
