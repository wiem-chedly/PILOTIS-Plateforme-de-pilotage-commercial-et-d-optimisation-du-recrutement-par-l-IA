import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Linkedin, Check, X, Edit, ExternalLink, Clock, FlaskConical, ChevronRight } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
    id: number;
    uuid: string;
    post_content: string;
    status: string;
    opportunity: {
        id: number;
        titre: string;
        client: string;
    };
    created_at: string;
}

interface Opportunity {
    id: number;
    titre: string;
    client: string;
    date_import: string;
}

interface QuizNotif {
    id: number;
    candidate_name: string;
    candidate_email: string;
    job_title: string;
    quiz_score_pct: number | null;
    quiz_completed_at: string | null;
}

export const NotificationBell = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [quizNotifs, setQuizNotifs] = useState<QuizNotif[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastSeen, setLastSeen] = useState<string | null>(
        localStorage.getItem('lastSeenOpportunity')
    );
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [tick, setTick] = useState(0);
    const [ignorePostId, setIgnorePostId] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const getTimeAgo = useCallback((createdAt: string) => {
        let dateStr = createdAt;
        if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
            dateStr = dateStr + 'Z';
        }
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes < 1) return "À l'instant";
        if (diffMinutes < 60) return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
        if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
        }
        const days = Math.floor(diffMinutes / 1440);
        return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
    }, []);

    const loadOpportunities = async () => {
        if (!user || user.role !== 'super_admin') return;
        try {
            const res = await fetch('http://localhost:5000/api/opportunities/cibles', {
                credentials: 'include'
            });
            const data = await res.json();
            const opportunites = data.opportunites || [];
            const sorted = [...opportunites].sort((a, b) =>
                new Date(b.date_import).getTime() - new Date(a.date_import).getTime()
            );
            setOpportunities(sorted.slice(0, 10));
        } catch (err) {
            console.error("Erreur chargement opportunités:", err);
        }
    };

    const loadNotifications = async () => {
        if (!user || user.role !== 'commercial' || !user.email) return;
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/api/validations/pending?email=${user.email}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (err) {
            console.error("Erreur chargement notifications:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadQuizNotifs = useCallback(async () => {
        if (!user || user.role !== 'commercial' || !user.email) return;
        try {
            const res = await fetch(
                `http://localhost:5000/api/interviews/completed?email=${encodeURIComponent(user.email)}`,
                { credentials: 'include' }
            );
            if (res.ok) {
                const data = await res.json();
                setQuizNotifs(Array.isArray(data) ? data : []);
            }
        } catch { /* ignore */ }
    }, [user]);

    useEffect(() => {
        if (user?.role === 'super_admin') {
            loadOpportunities();
            const interval = setInterval(loadOpportunities, 60000);
            return () => clearInterval(interval);
        } else if (user?.role === 'commercial') {
            loadNotifications();
            loadQuizNotifs();
            const interval1 = setInterval(loadNotifications, 30000);
            const interval2 = setInterval(loadQuizNotifs, 30000);
            return () => { clearInterval(interval1); clearInterval(interval2); };
        }
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleConnectLinkedIn = () => {
        window.location.href = 'http://localhost:5000/api/linkedin/login';
    };

    const handleOpportunityClick = (oppId: number) => {
        setShowDropdown(false);
        navigate(`/appels-offres?opportunity=${oppId}`);
    };

    const handlePublish = async (uuid: string, postContent: string) => {
        if (!user?.has_token) {
            toast({
                title: "Connexion LinkedIn requise",
                description: "Veuillez d'abord connecter votre compte LinkedIn",
            });
            setShowDropdown(false);
            handleConnectLinkedIn();
            return;
        }
        try {
            const res = await fetch(`http://localhost:5000/api/validations/${uuid}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ final_post: postContent }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast({
                    title: "✅ Publié avec succès !",
                    description: "Le post a été partagé sur votre LinkedIn"
                });
                setNotifications(prev => prev.filter(n => n.uuid !== uuid));
            } else {
                throw new Error(data.error || "Erreur de publication");
            }
        } catch (err) {
            toast({
                title: "❌ Erreur",
                description: err instanceof Error ? err.message : "Impossible de publier",
                variant: "destructive"
            });
        }
    };

    const handleVerify = (uuid: string) => {
        if (!user?.has_token) {
            toast({
                title: "Connexion LinkedIn requise",
                description: "Veuillez d'abord connecter votre compte LinkedIn",
            });
            setShowDropdown(false);
            handleConnectLinkedIn();
            return;
        }
        setShowDropdown(false);
        navigate(`/validate/${uuid}`);
    };

    const handleIgnore = (uuid: string) => {
        setIgnorePostId(uuid);
    };

    const confirmIgnore = async () => {
        if (!ignorePostId) return;
        const uuid = ignorePostId;
        setIgnorePostId(null);
        try {
            const res = await fetch(`http://localhost:5000/api/validations/${uuid}/reject`, {
                method: 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                setNotifications(prev => prev.filter(n => n.uuid !== uuid));
                toast({ title: "Publication ignorée" });
            } else {
                throw new Error("Erreur lors du rejet");
            }
        } catch (err) {
            toast({
                title: "❌ Erreur",
                description: "Impossible d'ignorer",
                variant: "destructive"
            });
        }
    };

    if (!user) return null;

    // Super Admin - Design amélioré
    if (user.role === 'super_admin') {
        const newCount = opportunities.filter(o =>
            !lastSeen || new Date(o.date_import) > new Date(lastSeen)
        ).length;

        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return "Aujourd'hui";
            if (diffDays === 1) return "Hier";
            if (diffDays < 7) return `Il y a ${diffDays} jours`;
            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        };

        return (
            <div className="relative" ref={dropdownRef}>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="relative h-9 w-9 rounded-full hover:bg-primary/10 transition-colors"
                >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {newCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
                        >
                            {newCount}
                        </Badge>
                    )}
                </Button>

                <AnimatePresence>
                    {showDropdown && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 mt-2 w-96 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden"
                        >
                            <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                                    <h3 className="font-semibold text-sm">Nouvelles opportunités</h3>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                    {opportunities.length} total
                                </Badge>
                            </div>

                            <ScrollArea className="max-h-[360px]">
                                {opportunities.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                        <Bell className="h-8 w-8 mb-2 opacity-50" />
                                        <p className="text-sm">Aucune opportunité</p>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-1">
                                        {opportunities.map((opp) => {
                                            const isNew = !lastSeen || new Date(opp.date_import) > new Date(lastSeen);
                                            return (
                                                <div
                                                    key={opp.id}
                                                    onClick={() => handleOpportunityClick(opp.id)}
                                                    className={`
                                                        group p-3 rounded-md cursor-pointer transition-all duration-200
                                                        ${isNew 
                                                            ? 'bg-primary/5 border-l-2 border-primary shadow-sm' 
                                                            : 'hover:bg-muted/50'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                                                    {opp.titre}
                                                                </p>
                                                                {isNew && (
                                                                    <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                                                                        Nouveau
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground truncate">{opp.client}</p>
                                                            <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                <span>{formatDate(opp.date_import)}</span>
                                                            </div>
                                                        </div>
                                                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>

                            <Separator />

                            <div className="p-2 bg-muted/30">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowDropdown(false);
                                        navigate('/appels-offres');
                                    }}
                                    className="w-full justify-between text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    <span>Voir toutes les opportunités</span>
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Commercial - Design amélioré
    if (user.role === 'commercial') {
        if (!user.has_token) {
            return (
                <div className="relative" ref={dropdownRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="relative h-9 w-9 rounded-full hover:bg-primary/10"
                    >
                        <Bell className="h-5 w-5 text-muted-foreground" />
                    </Button>

                    <AnimatePresence>
                        {showDropdown && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden"
                            >
                                <div className="p-6 text-center">
                                    <div className="h-12 w-12 rounded-full bg-[#0A66C2]/10 flex items-center justify-center mx-auto mb-4">
                                        <Linkedin className="h-6 w-6 text-[#0A66C2]" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Connectez votre LinkedIn</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Pour recevoir et publier des posts, connectez votre compte LinkedIn.
                                    </p>
                                    <Button
                                        onClick={handleConnectLinkedIn}
                                        className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white gap-2"
                                    >
                                        <Linkedin className="h-4 w-4" />
                                        Connecter mon compte
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        }

        const unreadCount = notifications.length + quizNotifs.length;

        return (
            <div className="relative" ref={dropdownRef}>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="relative h-9 w-9 rounded-full hover:bg-primary/10"
                >
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
                        >
                            {unreadCount}
                        </Badge>
                    )}
                </Button>

                <AnimatePresence>
                    {showDropdown && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute right-0 mt-2 w-96 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden"
                        >
                            <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
                                <h3 className="font-semibold text-sm">Notifications</h3>
                                {unreadCount > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                        {unreadCount} en attente
                                    </Badge>
                                )}
                            </div>

                            <ScrollArea className="max-h-[420px]">
                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                                    </div>
                                ) : (notifications.length === 0 && quizNotifs.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                        <Check className="h-8 w-8 mb-2 opacity-50" />
                                        <p className="text-sm">Tout est à jour !</p>
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-3">
                                        {/* ── Quiz complétés ── */}
                                        {quizNotifs.length > 0 && (
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">Tests complétés</p>
                                                {quizNotifs.map(qn => (
                                                    <div key={qn.id} className="mb-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <FlaskConical className="h-4 w-4 text-amber-400 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-semibold text-foreground">{qn.candidate_name || qn.candidate_email}</p>
                                                                    <p className="text-[11px] text-muted-foreground">{qn.job_title}</p>
                                                                    {qn.quiz_score_pct !== null && (
                                                                        <p className="text-[11px] text-amber-400 font-medium">Score : {qn.quiz_score_pct}%</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <Button size="sm" variant="ghost"
                                                                className="h-7 text-xs gap-1 text-indigo-400 hover:text-indigo-300 shrink-0"
                                                                onClick={() => { setShowDropdown(false); navigate('/entretiens'); }}
                                                            >
                                                                Voir <ChevronRight className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* ── Posts LinkedIn ── */}
                                        {notifications.length > 0 && (
                                            <div>
                                                {quizNotifs.length > 0 && <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">Posts à valider</p>}
                                            </div>
                                        )}
                                        {notifications.map(notif => {
                                            const timeAgo = getTimeAgo(notif.created_at);
                                            return (
                                                <Card key={notif.uuid} className="overflow-hidden border-l-2 border-l-accent shadow-sm hover:shadow transition-shadow">
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-sm line-clamp-1">{notif.opportunity.titre}</h4>
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px] font-normal ml-2 shrink-0">
                                                                <Clock className="h-3 w-3 mr-1" />
                                                                {timeAgo}
                                                            </Badge>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                className="flex-1 h-8 text-xs gap-1"
                                                                onClick={() => handlePublish(notif.uuid, notif.post_content)}
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                                Accepter
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="flex-1 h-8 text-xs gap-1"
                                                                onClick={() => handleVerify(notif.uuid)}
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                                Vérifier
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 px-3 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleIgnore(notif.uuid)}
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                                Ignorer
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AlertDialog open={!!ignorePostId} onOpenChange={(open) => !open && setIgnorePostId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Ignorer cette publication ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action est irréversible. La publication sera retirée de votre liste et ne sera pas publiée.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmIgnore} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                Ignorer définitivement
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    }

    return null;
};