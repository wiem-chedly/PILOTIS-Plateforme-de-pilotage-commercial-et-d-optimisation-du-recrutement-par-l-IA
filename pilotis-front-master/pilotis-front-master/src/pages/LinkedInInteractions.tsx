import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  Linkedin, RefreshCw, ExternalLink, MessageSquare, ThumbsUp,
  ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, Loader2,
  Users, Building2, Calendar, Trash2
} from "lucide-react";

interface PersonEngagement {
  id: number;
  name: string;
  headline: string;
  profile_url: string;
  comment?: string;
  date?: string;
}

interface PostWithEngagement {
  post_validation_id: number;
  post_url: string | null;
  post_content: string;
  opportunity_id: number;
  opportunity_titre: string;
  opportunity_client: string;
  posted_at: string | null;
  scrape_status: "idle" | "pending" | "done" | "error";
  last_scraped: string | null;
  total_comments: number;
  total_likes: number;
  comments: PersonEngagement[];
  likes: PersonEngagement[];
}

const API = "http://localhost:5000/api";

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    idle:    { label: "Non collecté",  className: "bg-gray-100 text-gray-600 border-gray-200",     icon: <Clock className="h-3 w-3" /> },
    pending: { label: "En cours...",   className: "bg-amber-100 text-amber-700 border-amber-200",   icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    done:    { label: "Collecté",      className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle className="h-3 w-3" /> },
    error:   { label: "Erreur",        className: "bg-red-100 text-red-700 border-red-200",         icon: <AlertCircle className="h-3 w-3" /> },
  };
  const cfg = map[status] || map.idle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const formatRelative = (iso: string | null) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "à l'instant";
  if (mins < 60)  return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${days}j`;
};

export default function LinkedInInteractions() {
  const { toast } = useToast();
  const [posts, setPosts]             = useState<PostWithEngagement[]>([]);
  const [loading, setLoading]         = useState(true);
  const [scraping, setScraping]       = useState<Record<number, boolean>>({});
  const [expanded, setExpanded]       = useState<Record<number, boolean>>({});
  const [showLikes, setShowLikes]     = useState<Record<number, boolean>>({});
  const [filter, setFilter]           = useState<"all" | "comments" | "likes">("all");
  const [pollTimers, setPollTimers]   = useState<Record<number, ReturnType<typeof setInterval>>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/linkedin/engagement/all`, { credentials: "include" });
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les interactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Clean up intervals on unmount
  useEffect(() => () => { Object.values(pollTimers).forEach(clearInterval); }, [pollTimers]);

  const startPolling = (pvId: number) => {
    const timer = setInterval(async () => {
      try {
        // Appelle /poll → vérifie Apify + sauvegarde les résultats côté serveur
        const pollRes  = await fetch(`${API}/linkedin/posts/${pvId}/poll`, { method: "POST", credentials: "include" });
        const pollData = await pollRes.json();

        if (pollData.status === "done" || pollData.status === "error") {
          clearInterval(timer);
          setPollTimers(prev => { const n = { ...prev }; delete n[pvId]; return n; });
          setScraping(prev => ({ ...prev, [pvId]: false }));

          if (pollData.status === "done") {
            // Récupère les données à jour
            const engRes  = await fetch(`${API}/linkedin/posts/${pvId}/engagement`, { credentials: "include" });
            const engData = await engRes.json();
            setPosts(prev => prev.map(p =>
              p.post_validation_id === pvId ? { ...p, ...engData, scrape_status: "done" } : p
            ));
            toast({ title: "✅ Interactions collectées !", description: `${engData.total_comments} commentaires · ${engData.total_likes} likes` });
          } else {
            setPosts(prev => prev.map(p =>
              p.post_validation_id === pvId ? { ...p, scrape_status: "error" } : p
            ));
            toast({ title: "❌ Erreur Apify", description: "Le scraping a échoué", variant: "destructive" });
          }
        }
      } catch { /* continue polling */ }
    }, 15000); // poll toutes les 15 secondes
    setPollTimers(prev => ({ ...prev, [pvId]: timer }));
  };

  const handleScrape = async (pvId: number) => {
    setScraping(prev => ({ ...prev, [pvId]: true }));
    setPosts(prev => prev.map(p => p.post_validation_id === pvId ? { ...p, scrape_status: "pending" } : p));
    try {
      const res  = await fetch(`${API}/linkedin/posts/${pvId}/scrape`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setScraping(prev => ({ ...prev, [pvId]: false }));
        toast({ title: "Erreur", description: data.error || "Impossible de lancer le scraping", variant: "destructive" });
        return;
      }
      toast({ title: "⏳ Scraping lancé", description: "Résultats dans 2 à 5 minutes..." });
      startPolling(pvId);
    } catch {
      setScraping(prev => ({ ...prev, [pvId]: false }));
      toast({ title: "Erreur réseau", variant: "destructive" });
    }
  };

  const handleDelete = async (pvId: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette publication de la liste des interactions ? Cette action est irréversible.")) {
      return;
    }
    try {
      const res = await fetch(`${API}/linkedin/posts/${pvId}`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Erreur",
          description: data.error || "Impossible de supprimer la publication",
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "Succès",
        description: "La publication a été supprimée avec succès"
      });
      setPosts(prev => prev.filter(p => p.post_validation_id !== pvId));
    } catch {
      toast({
        title: "Erreur réseau",
        description: "Impossible de contacter le serveur",
        variant: "destructive"
      });
    }
  };

  const filteredPosts = posts.filter(p => {
    if (filter === "comments") return p.total_comments > 0;
    if (filter === "likes")    return p.total_likes > 0;
    return true;
  });

  const totalComments = posts.reduce((s, p) => s + p.total_comments, 0);
  const totalLikes    = posts.reduce((s, p) => s + p.total_likes, 0);

  return (
    <DashboardLayout title="Interactions LinkedIn">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
            <Linkedin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Interactions LinkedIn</h1>
            <p className="text-sm text-gray-500">Likes et commentaires de vos posts AO</p>
          </div>
        </div>
      </div>

      {/* ── Stats globales ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Posts publiés", value: posts.length,     icon: <Linkedin className="h-5 w-5 text-blue-500" />,    bg: "bg-blue-50" },
          { label: "Commentaires",  value: totalComments,    icon: <MessageSquare className="h-5 w-5 text-purple-500" />, bg: "bg-purple-50" },
          { label: "Likes",         value: totalLikes,       icon: <ThumbsUp className="h-5 w-5 text-emerald-500" />, bg: "bg-emerald-50" },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filtres + Refresh ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(["all", "comments", "likes"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
              }`}
            >
              {f === "all" ? "Tous" : f === "comments" ? "Avec commentaires" : "Avec likes"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </Button>
      </div>

      {/* ── Liste des posts ── */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Linkedin className="h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">Aucun post LinkedIn publié</p>
            <p className="text-sm">Publiez un AO sur LinkedIn depuis la page Appels d'Offres pour voir les interactions ici.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {filteredPosts.map(post => {
              const isExpanded  = expanded[post.post_validation_id];
              const showingLikes = showLikes[post.post_validation_id];
              const isScraping  = scraping[post.post_validation_id];

              return (
                <motion.div
                  key={post.post_validation_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    {/* Card header */}
                    <CardHeader className="pb-3 pt-4 px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <StatusBadge status={post.scrape_status} />
                            {post.last_scraped && (
                              <span className="text-xs text-gray-400">
                                Collecté {formatRelative(post.last_scraped)}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900 truncate text-base">
                            {post.opportunity_titre}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> {post.opportunity_client || "—"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {formatDate(post.posted_at)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {post.post_url && (
                            <a
                              href={post.post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Voir le post LinkedIn"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant={post.scrape_status === "done" ? "outline" : "default"}
                            className={`gap-1.5 text-xs ${post.scrape_status !== "done" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                            disabled={isScraping || post.scrape_status === "pending"}
                            onClick={() => handleScrape(post.post_validation_id)}
                          >
                            {isScraping || post.scrape_status === "pending" ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> En cours...</>
                            ) : post.scrape_status === "done" ? (
                              <><RefreshCw className="h-3 w-3" /> Actualiser</>
                            ) : (
                              <><Users className="h-3 w-3" /> Récupérer</>
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(post.post_validation_id)}
                            title="Supprimer la publication"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Stats badges */}
                      {(post.total_comments > 0 || post.total_likes > 0) && (
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => setExpanded(prev => ({ ...prev, [post.post_validation_id]: !isExpanded }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-purple-700 text-sm font-medium"
                          >
                            <MessageSquare className="h-4 w-4" />
                            {post.total_comments} commentaire{post.total_comments !== 1 ? "s" : ""}
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                          </button>
                          <button
                            onClick={() => setShowLikes(prev => ({ ...prev, [post.post_validation_id]: !showingLikes }))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-700 text-sm font-medium"
                          >
                            <ThumbsUp className="h-4 w-4" />
                            {post.total_likes} like{post.total_likes !== 1 ? "s" : ""}
                            {showingLikes ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                          </button>
                        </div>
                      )}
                    </CardHeader>

                    {/* Comments panel */}
                    <AnimatePresence>
                      {isExpanded && post.comments.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-gray-100 bg-purple-50/40 px-5 py-3">
                            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5" /> Commentaires
                            </p>
                            <div className="flex flex-col gap-3">
                              {post.comments.map(c => (
                                <div key={c.id} className="flex gap-3 bg-white rounded-xl p-3 border border-purple-100 shadow-sm">
                                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                    {c.name?.charAt(0)?.toUpperCase() || "?"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div>
                                        <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                                        {c.headline && <p className="text-xs text-gray-500 truncate">{c.headline}</p>}
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {c.date && <span className="text-xs text-gray-400">{c.date}</span>}
                                        {c.profile_url && (
                                          <a
                                            href={c.profile_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                          >
                                            <Linkedin className="h-3 w-3" /> Profil
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    {c.comment && (
                                      <p className="mt-1.5 text-sm text-gray-700 bg-purple-50 rounded-lg px-3 py-2 italic border-l-2 border-purple-300">
                                        "{c.comment}"
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Likes panel */}
                    <AnimatePresence>
                      {showingLikes && post.likes.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-gray-100 bg-emerald-50/40 px-5 py-3">
                            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                              <ThumbsUp className="h-3.5 w-3.5" /> Likes ({post.total_likes})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {post.likes.map(l => (
                                <div key={l.id} className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-emerald-100 shadow-sm">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {l.name?.charAt(0)?.toUpperCase() || "?"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-gray-900 truncate">{l.name}</p>
                                    {l.headline && <p className="text-xs text-gray-500 truncate">{l.headline}</p>}
                                  </div>
                                  {l.profile_url && (
                                    <a
                                      href={l.profile_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0 text-blue-500 hover:text-blue-700"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </DashboardLayout>
  );
}
