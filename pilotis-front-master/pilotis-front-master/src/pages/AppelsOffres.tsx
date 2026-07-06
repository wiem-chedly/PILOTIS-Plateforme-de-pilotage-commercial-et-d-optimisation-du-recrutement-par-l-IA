// src/pages/AppelsOffres.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileText, X, Search, LogOut, Calendar, Building2, Filter, Linkedin,
  Grid3x3, List, Euro, Bell, RefreshCw, MapPin, Building, User, Briefcase, Loader2,
  Mail, Eye, Edit, Check, AlertCircle, TrendingUp, Trophy, TrendingDown, Users, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { aoStatuts, type AppelOffre, type AOStatut, type UploadedDoc } from "@/data/aoMockData";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Interface AppelOffre étendue
interface AppelOffreDetail extends AppelOffre {
  progression: string;
  lieu?: string;
  typeContrat?: string;
  requisition_id?: number;
  boond_id?: string;
  reference?: string;
  typeOffre?: string;
  contactNom?: string;
  responsableManager?: string;
  agence?: string;
  pole?: string;
  devise?: string;
  budgetEnvisage?: number;
  caPondere?: number;
  duree?: string;
  dateDemarrage?: string;
  posActif?: number;
  dateImport?: string;
  criteres?: string;
}

interface LinkedInAccount {
  id: number;
  name: string;
  email?: string;
  access_token: string;
  notify_by_email?: boolean;
}

const progressionColors: Record<string, { bg: string; text: string; border: string; lightBg: string; dot: string }> = {
  "0/25%": {
    bg: "bg-blue-500",
    text: "text-blue-700",
    border: "border-blue-200",
    lightBg: "bg-blue-50",
    dot: "bg-blue-500"
  },
  "25/50%": {
    bg: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-200",
    lightBg: "bg-amber-50",
    dot: "bg-amber-500"
  },
  "50/75%": {
    bg: "bg-purple-500",
    text: "text-purple-700",
    border: "border-purple-200",
    lightBg: "bg-purple-50",
    dot: "bg-purple-500"
  },
  "75/90%": {
    bg: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-200",
    lightBg: "bg-emerald-50",
    dot: "bg-emerald-500"
  },
};

const statutColors: Record<AOStatut, { bg: string; text: string; border: string }> = {
  Nouveau: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "En cours": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Soumis: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  Gagné: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Perdu: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  Abandonné: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
};

const formatMontant = (v: number) => {
  if (v == null) return "Non renseigné";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
};

const formatDate = (date: string) => {
  if (!date) return "Non renseigné";
  try {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch {
    return date;
  }
};

function convertDateFrToIso(dateFr: string): string {
  if (!dateFr) return "";
  const parts = dateFr.split('/');
  if (parts.length === 3) {
    let [jour, mois, an] = parts;
    if (an.length === 2) an = "20" + an;
    return `${an}-${mois}-${jour}`;
  }
  return dateFr;
}

interface KanbanColumn {
  id: string;
  title: string;
  progression: string;
  items: AppelOffreDetail[];
}

// Fonction pour nettoyer et convertir la date
const cleanAndFormatDate = (dateValue: string): string => {
  if (!dateValue) return "";
  const placeholders = ['jj/mm/aaaa', 'dd/mm/yyyy', 'JJ/MM/AAAA', 'DD/MM/YYYY', 'jj/mm/aa', 'dd/mm/yy'];
  if (placeholders.includes(dateValue.toLowerCase())) return "";
  if (dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dateValue;
  return "";
};

const AppelsOffres = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [aos, setAos] = useState<AppelOffreDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
  const [dragOver, setDragOver] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [savingOCR, setSavingOCR] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisCurrentFile, setAnalysisCurrentFile] = useState<string>("");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDoc, setPreviewDoc] = useState<UploadedDoc | null>(null);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [permissions, setPermissions] = useState<any>(null);
  const [linkedinAccounts, setLinkedinAccounts] = useState<LinkedInAccount[]>([]);
  const [commercialAccounts, setCommercialAccounts] = useState<LinkedInAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [processingTasks, setProcessingTasks] = useState<{ [key: string]: boolean }>({});
  const [pollingIntervals, setPollingIntervals] = useState<{ [key: string]: NodeJS.Timeout }>({});
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [currentAo, setCurrentAo] = useState<AppelOffreDetail | null>(null);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [selectedAoDetail, setSelectedAoDetail] = useState<AppelOffreDetail | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [kanbanColumn, setKanbanColumn] = useState<KanbanColumn>({
    id: "0-25",
    title: "En cours 0/25%",
    progression: "0/25%",
    items: []
  });

  // ==================== ÉTATS POUR GMAIL OAUTH ====================
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email: string | null }>({
    connected: false,
    email: null
  });
  const [connectingGmail, setConnectingGmail] = useState(false);

  // Fonction pour forcer les retours à la ligne dans la description
  const formatDescriptionWithLineBreaks = (description: string) => {
    if (!description) return description;

    if (description.includes('\n\n') && description.includes('RÉSUMÉ')) {
      return description;
    }

    const resumeMatch = description.match(/RÉSUMÉ\s*:?\s*(.*?)(?=CONTEXTE|DÉTAILS|$)/i);
    const contexteMatch = description.match(/CONTEXTE\s*:?\s*(.*?)(?=RÉSUMÉ|DÉTAILS|$)/i);
    const detailsMatch = description.match(/DÉTAILS\s*:?\s*(.*?)(?=RÉSUMÉ|CONTEXTE|$)/i);

    const parts = [];
    if (resumeMatch) {
      let content = resumeMatch[1].trim();
      content = content.replace(/\s*(CONTEXTE|DÉTAILS).*$/i, '').trim();
      if (content) {
        parts.push(`RÉSUMÉ :\n${content}`);
      }
    }
    if (contexteMatch) {
      let content = contexteMatch[1].trim();
      content = content.replace(/\s*(RÉSUMÉ|DÉTAILS).*$/i, '').trim();
      if (content) {
        parts.push(`CONTEXTE :\n${content}`);
      }
    }
    if (detailsMatch) {
      let content = detailsMatch[1].trim();
      content = content.replace(/\s*(RÉSUMÉ|CONTEXTE).*$/i, '').trim();
      if (content) {
        parts.push(`DÉTAILS :\n${content}`);
      }
    }

    if (parts.length >= 2) {
      return parts.join('\n\n');
    }

    return description;
  };

  const loadPermissions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/permissions', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPermissions(data);
      }
    } catch (err) {
      console.error("Erreur chargement permissions:", err);
    }
  };

  const fetchLinkedInAccounts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/linkedin/accounts');
      const data = await res.json();
      setLinkedinAccounts(data);
      setCommercialAccounts(data);
    } catch (err) {
      console.error("Erreur chargement comptes LinkedIn:", err);
    }
  };

  // ✅ Fonction fetchOpportunities CORRIGÉE
  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      console.log("📡 Chargement des opportunités cibles (0/25% dernière semaine)...");
      const res = await fetch('http://localhost:5000/api/opportunities/cibles', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`Erreur HTTP ${res.status}`);
      }

      const data = await res.json();
      console.log("✅ Données reçues:", data);

      if (data && data.opportunites && data.opportunites.length > 0) {
        // ✅ CORRECTION : Utiliser la vraie progression de l'API
        const transformed: AppelOffreDetail[] = data.opportunites.map((item: any, index: number) => ({
          id: `api-${index}-${Date.now()}`,
          requisition_id: item.id,
          titre: item.titre || "Sans titre",
          client: item.client || "",
          dateLimite: convertDateFrToIso(item.date),
          montantEstime: item.budget_ht || 0,
          statut: item.etat?.split(' ')[0] || "En cours",  // Extrait "En cours" de "En cours 0/25%"
          progression: item.progression || "0/25%",  // ✅ Utilise la vraie progression
          dateCreation: new Date().toISOString().split('T')[0],
          description: item.description || "",
          documents: [],
          lieu: item.lieu || "",
          typeContrat: item.type_contrat || "",
          reference: item.reference,
          typeOffre: item.type_offre,
          contactNom: item.contact_nom,
          responsableManager: item.manager_nom,
          agence: item.agence_nom,
          devise: item.devise,
          budgetEnvisage: item.budget_ht,
          caPondere: item.ca_pondere,
          duree: item.duree,
          dateDemarrage: item.date_demarrage,
          posActif: item.pos_actif,
          dateImport: item.date_import,
          criteres: item.criteres,
        }));

        console.log(`📊 ${transformed.length} opportunités transformées (0/25% dernière semaine)`);
        setAos(transformed);
        setError(null);
      } else {
        // ✅ Pas de données mockées
        setAos([]);
        toast({
          title: "Information",
          description: "Aucune opportunité cible trouvée",
        });
      }
    } catch (err) {
      console.error('❌ Erreur chargement opportunités:', err);
      // ✅ Pas de données mockées
      setAos([]);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FONCTIONS GMAIL ====================
  const checkGmailStatus = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/gmail-auth/status/current', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setGmailStatus({ connected: data.connected, email: data.email });
      }
    } catch (err) {
      console.error("Erreur vérification Gmail:", err);
    }
  };

  const connectGmail = async () => {
    setConnectingGmail(true);
    try {
      const res = await fetch('http://localhost:5000/api/gmail-auth/connect/current', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.auth_url;
      } else {
        const error = await res.json();
        toast({ title: "Erreur", description: error.error || "Impossible de démarrer la connexion", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setConnectingGmail(false);
    }
  };

  const disconnectGmail = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/gmail-auth/disconnect/current', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        toast({ title: "✅ Déconnecté", description: "Compte Gmail déconnecté" });
        setGmailStatus({ connected: false, email: null });
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de déconnecter", variant: "destructive" });
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newDocs: UploadedDoc[] = fileArray.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      type: f.type,
      size: f.size,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
    }));
    setUploadedDocs((prev) => [...prev, ...newDocs]);

    if (fileArray.length > 0) {
      setAnalysisProgress({ current: 0, total: fileArray.length });
      setAnalysisStatus("Analyse parallèle en cours...");
      setAnalysisCurrentFile("");

      toast({
        title: "📸 Analyse en cours",
        description: `L'IA analyse ${fileArray.length} capture(s) en parallèle...`
      });

      try {
        const startTime = Date.now();

        const promises = fileArray.map(async (file, index) => {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('http://localhost:5000/api/extract-ao-from-image', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });

          const result = await response.json();

          setAnalysisProgress(prev => ({ ...prev, current: prev.current + 1 }));
          setAnalysisCurrentFile(file.name);
          setAnalysisStatus(`${index + 1}/${fileArray.length} - ${file.name} analysé`);

          if (result.success && result.data) {
            return result.data;
          }
          return null;
        });

        const allResults = await Promise.all(promises);
        const validResults = allResults.filter(r => r !== null);

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        setAnalysisStatus("");
        setAnalysisCurrentFile("");

        if (validResults.length > 0) {
          let combinedResult = validResults[0];
          if (validResults.length > 1) {
            combinedResult = { ...validResults[0] };
            for (let i = 1; i < validResults.length; i++) {
              const r = validResults[i];
              Object.keys(r).forEach(k => {
                if (r[k] && !combinedResult[k]) {
                  combinedResult[k] = r[k];
                }
              });
            }
          }

          if (combinedResult.description) {
            combinedResult.description = formatDescriptionWithLineBreaks(combinedResult.description);
          }

          if (combinedResult.date_demarrage) {
            combinedResult.date_demarrage = cleanAndFormatDate(combinedResult.date_demarrage);
          }

          combinedResult.date = new Date().toLocaleDateString('fr-FR');
          setOcrResult(combinedResult);
          setShowOcrDialog(true);

          toast({
            title: "✅ Analyse terminée",
            description: `${validResults.length}/${fileArray.length} captures analysées en ${elapsedTime}s`
          });
        } else {
          toast({
            title: "❌ Erreur",
            description: "Aucune capture n'a pu être analysée",
            variant: "destructive"
          });
        }
      } catch (err) {
        console.error("Erreur extraction:", err);
        setAnalysisStatus("");
        setAnalysisCurrentFile("");
        toast({
          title: "❌ Erreur",
          description: "Erreur de connexion au serveur",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    fetchLinkedInAccounts();
  }, []);

  useEffect(() => {
    fetch('http://localhost:5000/api/linkedin/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setLinkedinConnected(data.connected))
      .catch(() => setLinkedinConnected(false));
  }, []);

  useEffect(() => {
    checkGmailStatus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin') === 'connected') {
      setLinkedinConnected(true);
      toast({ title: "Connexion LinkedIn réussie !" });
      fetch('http://localhost:5000/api/linkedin/status', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setLinkedinConnected(data.connected));
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('oauth') === 'success') {
      toast({ title: "✅ Connexion Gmail réussie !", description: "Vos CV seront automatiquement scannés." });
      checkGmailStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('oauth') === 'error') {
      toast({ title: "❌ Erreur", description: "La connexion Gmail a échoué", variant: "destructive" });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  useEffect(() => {
    if (showPreviewDialog && currentAo && !generatedContent && !processingTasks[currentAo.id]) {
      generatePost();
    }
  }, [showPreviewDialog, currentAo, generatedContent, processingTasks]);

  useEffect(() => {
    return () => {
      Object.values(pollingIntervals).forEach(clearInterval);
    };
  }, [pollingIntervals]);

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const opportunityId = params.get('opportunity');

    if (opportunityId && aos.length > 0) {
      const ao = aos.find(a => a.requisition_id === parseInt(opportunityId));
      if (ao) {
        handleOpenDetails(ao);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [aos]);

  useEffect(() => {
    if (aos.length > 0) {
      const items = aos.filter(ao => ao.progression === "0/25%");
      setKanbanColumn({ id: "0-25", title: "En cours 0/25%", progression: "0/25%", items });
    }
  }, [aos]);

  const handleLogout = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/linkedin/logout', {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setLinkedinConnected(false);
        toast({ title: "Déconnexion réussie", description: "Vous êtes déconnecté de LinkedIn." });
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de se déconnecter", variant: "destructive" });
    }
  };

  const handleShare = (e: React.MouseEvent, ao: AppelOffreDetail) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentAo(ao);
    setGeneratedContent("");
    setSelectedAccounts([]);
    setShowPreviewDialog(true);
  };

  const generatePost = async () => {
    if (!currentAo) return;

    setProcessingTasks(prev => ({ ...prev, [currentAo.id]: true }));

    try {
      let titre = currentAo.titre;
      let description = "";
      let criteres = "";
      let reference = currentAo.reference || "";

      if (currentAo.requisition_id) {
        const fetchRes = await fetch(`http://localhost:5000/api/opportunities/${currentAo.requisition_id}`, {
          credentials: 'include'
        });
        if (fetchRes.ok) {
          const freshData = await fetchRes.json();
          titre = freshData.titre || titre;
          description = freshData.description || "";
          criteres = freshData.criteres || "";
          reference = freshData.reference || reference;
          console.log("📦 Données fraîches de l'API:", { titre, description, criteres, reference });
        } else {
          console.warn("⚠️ Impossible de récupérer les données fraîches, status:", fetchRes.status);
        }
      }

      if (!description) {
        description = currentAo.description || "";
        criteres = currentAo.criteres || "";
        console.log("📦 Fallback sur currentAo:", { description, criteres });
      }

      console.log("📤 Envoi au backend:", { titre, description, criteres, reference });

      const response = await fetch('http://localhost:5000/api/generate_linkedin_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: titre,
          description: description,
          criteres: criteres,
          reference: reference
        }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const taskId = data.task_id;
      const intervalId = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:5000/api/task_status/${taskId}`);
          const statusData = await statusRes.json();
          if (statusData.status === "finished") {
            clearInterval(intervalId);
            setProcessingTasks(prev => ({ ...prev, [currentAo.id]: false }));
            setGeneratedContent(statusData.result.post);
            console.log("✅ Post généré:", statusData.result.post);
          } else if (statusData.status === "failed") {
            clearInterval(intervalId);
            setProcessingTasks(prev => ({ ...prev, [currentAo.id]: false }));
            toast({ title: "Erreur", description: statusData.error || "Échec de la génération", variant: "destructive" });
            setShowPreviewDialog(false);
          }
        } catch (pollError) {
          console.error("Erreur de polling:", pollError);
          clearInterval(intervalId);
          setProcessingTasks(prev => ({ ...prev, [currentAo.id]: false }));
        }
      }, 2000);

      setPollingIntervals(prev => ({ ...prev, [taskId]: intervalId }));

    } catch (err) {
      setProcessingTasks(prev => ({ ...prev, [currentAo.id]: false }));
      toast({ title: "Erreur", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const handleNotifyCommercials = async () => {
    if (!currentAo) return;

    const opportunityId = currentAo.requisition_id;
    if (!opportunityId) {
      toast({
        title: "Erreur",
        description: "Impossible d'identifier l'opportunité",
        variant: "destructive"
      });
      return;
    }

    if (selectedAccounts.length === 0) {
      toast({
        title: "Sélection requise",
        description: "Veuillez sélectionner au moins un commercial",
        variant: "destructive"
      });
      return;
    }

    setIsNotifying(true);
    let successCount = 0;

    try {
      for (const accountId of selectedAccounts) {
        const response = await fetch('http://localhost:5000/api/share-and-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titre: currentAo.titre,
            post_content: generatedContent,
            opportunity_id: opportunityId,
            account_id: accountId
          }),
          credentials: 'include'
        });

        if (response.ok) {
          successCount++;
        }
      }

      if (successCount === selectedAccounts.length) {
        toast({
          title: "✅ Notifications envoyées",
          description: `${successCount} commercial(aux) ont été notifié(s)`
        });
        setShowPreviewDialog(false);
        setSelectedAccounts([]);
      } else {
        toast({
          title: "⚠️ Envoi partiel",
          description: `${successCount}/${selectedAccounts.length} notifications envoyées`,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "❌ Erreur",
        description: err instanceof Error ? err.message : "Échec de l'envoi",
        variant: "destructive"
      });
    } finally {
      setIsNotifying(false);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
  };

  const removeDoc = (id: string) => {
    setUploadedDocs((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (doc?.previewUrl) URL.revokeObjectURL(doc.previewUrl);
      return prev.filter((d) => d.id !== id);
    });
  };

  const getCurrentFormattedDate = () => {
    const today = new Date();
    return `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  };

  const handleSaveAOFromOCR = async () => {
    if (!ocrResult?.titre || !ocrResult?.client) {
      toast({ title: "Champs manquants", description: "Le titre et le client sont obligatoires", variant: "destructive" });
      return;
    }
    setSavingOCR(true);
    try {
      const formattedDate = getCurrentFormattedDate();
      const saveResponse = await fetch('http://localhost:5000/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: ocrResult.titre,
          client_nom: ocrResult.client,
          reference: ocrResult.reference,
          date: formattedDate,
          description: ocrResult.description,
          criteres: ocrResult.criteres,
          budget_ht: ocrResult.budget_ht || 0,
          duree: ocrResult.duree || "",
          date_demarrage: ocrResult.date_demarrage || "",
          agence_nom: "OMICRONE",
          devise: "EUR Euro",
          statut: "En cours",
          progression: "0/25%",
          etat_complet: "En cours 0/25%"
        }),
        credentials: 'include'
      });
      const saveResult = await saveResponse.json();

      if (saveResponse.status === 409) {
        toast({ title: "⚠️ Référence existante", description: `"${saveResult.existing_titre}" existe déjà.`, variant: "destructive" });
        return;
      }
      if (!saveResponse.ok) {
        toast({ title: "⚠️ Erreur", description: saveResult.error || "Erreur enregistrement", variant: "destructive" });
        return;
      }

      const requisitionId = saveResult.requisition_id;
      const newAO: AppelOffreDetail = {
        id: `ao-${Date.now()}`,
        requisition_id: requisitionId,
        titre: ocrResult.titre,
        client: ocrResult.client,
        dateLimite: formattedDate,
        montantEstime: ocrResult.budget_ht || 0,
        statut: "En cours" as AOStatut,
        progression: "0/25%",
        dateCreation: new Date().toISOString().split('T')[0],
        description: ocrResult.description || "",
        documents: [...uploadedDocs],
        reference: ocrResult.reference,
        criteres: ocrResult.criteres,
        duree: ocrResult.duree,
        dateDemarrage: ocrResult.date_demarrage,
        agence: "OMICRONE",
        devise: "EUR Euro",
        budgetEnvisage: ocrResult.budget_ht,
      };
      setAos((prev) => [newAO, ...prev]);

      try {
        const boondResponse = await fetch('http://localhost:5000/api/boond/create-opportunity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titre: ocrResult.titre,
            client_nom: ocrResult.client,
            reference: ocrResult.reference || `AO-${Date.now()}`,
            date_demarrage: ocrResult.date_demarrage || formattedDate,
            duree: ocrResult.duree || "12 mois",
            budget_ht: parseFloat(ocrResult.budget_ht) || 0,
          }),
          credentials: 'include'
        });
        const boondResult = await boondResponse.json();
        if (boondResult.success && boondResult.boond_id) {
          await fetch(`http://localhost:5000/api/opportunities/${requisitionId}/boond-id`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boond_id: boondResult.boond_id }),
            credentials: 'include'
          });
          toast({ title: "✅ Opportunité créée", description: `"${ocrResult.titre}" enregistré dans Pilotis et BoondManager.` });
        } else {
          toast({ title: "✅ Créé dans Pilotis", description: `"${ocrResult.titre}" enregistré (BoondManager indisponible).` });
        }
      } catch {
        toast({ title: "✅ Créé dans Pilotis", description: `"${ocrResult.titre}" enregistré (BoondManager non atteint).` });
      }

      setUploadedDocs([]);
      setShowOcrDialog(false);
      setOcrResult(null);
    } catch (err) {
      toast({ title: "❌ Erreur", description: "Impossible d'enregistrer l'opportunité", variant: "destructive" });
    } finally {
      setSavingOCR(false);
    }
  };

  const handleOpenDetails = async (ao: AppelOffreDetail) => {
    const requisitionId = ao.requisition_id;
    if (!requisitionId) {
      setSelectedAoDetail(ao);
      setShowDetailDialog(true);
      return;
    }
    setLoadingDetail(true);
    setShowDetailDialog(true);
    try {
      const res = await fetch(`http://localhost:5000/api/opportunities/${requisitionId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur chargement détails');
      const data = await res.json();
      const detail: AppelOffreDetail = {
        ...ao,
        requisition_id: data.requisition_id,
        boond_id: data.boond_id,
        titre: data.titre,
        client: data.client_nom,
        dateLimite: convertDateFrToIso(data.date),
        montantEstime: data.budget_ht || 0,
        statut: data.statut as AOStatut,
        progression: data.progression,
        description: data.description || "",
        reference: data.reference,
        typeOffre: data.type_offre,
        contactNom: data.contact_nom,
        responsableManager: data.manager_nom,
        agence: data.agence_nom,
        devise: data.devise,
        budgetEnvisage: data.budget_ht,
        caPondere: data.ca_pondere,
        duree: data.duree,
        dateDemarrage: data.date_demarrage,
        posActif: data.pos_actif,
        dateImport: data.date_import,
        criteres: data.criteres,
      };
      setSelectedAoDetail(detail);
    } catch (err) {
      console.error(err);
      toast({ title: "Erreur", description: "Impossible de charger les détails complets", variant: "destructive" });
      setSelectedAoDetail(ao);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredAOs = useMemo(() => {
    return aos.filter((ao) => {
      if (filterStatut !== "all" && ao.statut !== filterStatut) return false;
      if (filterClient !== "all" && !ao.client.toLowerCase().includes(filterClient.toLowerCase())) return false;
      if (searchQuery && !ao.titre.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [aos, filterStatut, filterClient, searchQuery]);

  const uniqueClients = useMemo(() => {
    return [...new Set(aos.map((ao) => ao.client))]
      .filter(c => c && c.trim() !== "")
      .sort();
  }, [aos]);

  const KanbanCard = ({ ao }: { ao: AppelOffreDetail }) => {
    const colors = progressionColors[ao.progression || "0/25%"] || progressionColors["0/25%"];
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -1, boxShadow: "0 4px 8px -4px rgba(0,0,0,0.1)" }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-md border border-gray-200 overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
        onClick={() => handleOpenDetails(ao)}
      >
        <div className={cn("px-2 py-1.5 flex items-center justify-between border-b", colors.lightBg)}>
          <div className="flex items-center gap-1">
            <div className={cn("h-1.5 w-1.5 rounded-full", colors.dot)}></div>
            <span className="text-xs font-medium text-gray-600">{ao.progression}</span>
          </div>
        </div>
        <div className="px-2 py-2.5">
          <h4 className="font-medium text-xs line-clamp-2 mb-1.5 text-gray-800">{ao.titre}</h4>
          <div className="flex items-center gap-1 mb-1.5">
            <Building2 className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-600 truncate">{ao.client}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 mt-1">
            <div className="flex items-center gap-0.5">
              <Euro className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-semibold text-xs text-gray-700">{formatMontant(ao.montantEstime)}</span>
            </div>
            <div className="flex items-center gap-0.5 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(ao.dateLimite)}</span>
            </div>
          </div>
        </div>
        <div className="px-2 py-1.5 bg-white border-t flex items-center justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleShare(e, ao); }}
            disabled={processingTasks[ao.id] || !linkedinConnected}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#0A66C2] border border-[#0A66C2] rounded hover:bg-[#0A66C2] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingTasks[ao.id] ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Génération...</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.204 0 22.225 0z" />
                </svg>
                <span>Partager</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    );
  };

  const KanbanColumn = ({ column }: { column: KanbanColumn }) => {
    return (
      <div className="w-full">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500"></div>
            <h2 className="text-sm font-semibold text-gray-700">{column.title}</h2>
          </div>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-gray-100">
            {column.items?.length ?? 0}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <AnimatePresence>
            {!column.items || column.items.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-400 text-sm border border-dashed rounded-lg bg-gray-50">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Aucune opportunité</p>
              </div>
            ) : (
              column.items.map((ao) => <KanbanCard key={ao.id} ao={ao} />)
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(filteredAOs.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredAOs.slice(indexOfFirstItem, indexOfLastItem);

  if (!permissions) {
    return (
      <DashboardLayout title="Appels d'Offres">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Chargement des permissions...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (user?.role === 'commercial' && permissions?.commercial?.['appels-offres'] === false) {
    return (
      <DashboardLayout title="Appels d'Offres">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⛔</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès restreint</h2>
              <p className="text-gray-600 mb-4">Vous n'avez pas accès à la page Appels d'Offres.</p>
              <p className="text-sm text-gray-500">Contactez votre administrateur.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (user?.role === 'super_admin' && permissions?.super_admin?.['appels-offres'] === false) {
    return (
      <DashboardLayout title="Appels d'Offres">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⛔</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès restreint</h2>
              <p className="text-gray-600 mb-4">La page Appels d'Offres a été désactivée.</p>
              <p className="text-sm text-gray-500">Contactez votre administrateur.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Appels d'Offres">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Chargement des opportunités cibles...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Appels d'Offres">
      <div className="space-y-6">
        {/* En-tête LinkedIn et Gmail */}
        <div className="flex justify-end items-center gap-3 flex-wrap">
          {/* Bloc Gmail OAuth */}
          {gmailStatus.connected ? (
            <div className="flex items-center gap-3 bg-gradient-to-r from-red-50 to-transparent rounded-lg px-4 py-2">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-white"></div>
              </div>
              <span className="text-sm font-medium">Gmail connecté</span>
              <span className="text-xs text-gray-500">{gmailStatus.email}</span>
              <Button variant="ghost" size="sm" onClick={disconnectGmail} className="h-7 px-2 text-gray-500 hover:text-red-500 text-xs">
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Déconnecter
              </Button>
            </div>
          ) : (
            <Button
              onClick={connectGmail}
              disabled={connectingGmail}
              size="default"
              className="h-9 px-4 gap-2 bg-red-500 hover:bg-red-600 text-sm"
            >
              {connectingGmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Connecter Gmail (CV automatique)
            </Button>
          )}

          {/* Bloc LinkedIn */}
          {linkedinConnected ? (
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#0A66C2]/5 to-transparent rounded-lg px-4 py-2">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-[#0A66C2] flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.204 0 22.225 0z" />
                  </svg>
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-white"></div>
              </div>
              <span className="text-sm font-medium">LinkedIn connecté</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-7 px-2 text-gray-500 hover:text-red-500 text-xs">
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Déconnecter
              </Button>
            </div>
          ) : (
            <Button onClick={() => window.location.href = 'http://localhost:5000/api/linkedin/login'} size="default" className="h-9 px-4 gap-2 bg-[#0A66C2] hover:bg-[#004182] text-sm">
              <Linkedin className="h-4 w-4" />
              Connecter LinkedIn
            </Button>
          )}
        </div>

        {/* Drop zone */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 font-semibold">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              Capture rapide d'appel d'offres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer",
                dragOver
                  ? "border-primary bg-primary/5 scale-[0.99]"
                  : "border-gray-300 hover:border-primary/50 hover:bg-gray-50/50"
              )}
              onClick={() => document.getElementById("ao-file-input")?.click()}
            >
              <input id="ao-file-input" type="file" className="hidden" multiple accept="image/*,.pdf" onChange={onFileSelect} />

              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "p-3 rounded-full transition-all duration-200",
                  dragOver ? "bg-primary/20 scale-110" : "bg-gray-100"
                )}>
                  <Upload className={cn(
                    "h-6 w-6 transition-all duration-200",
                    dragOver ? "text-primary" : "text-gray-400"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {dragOver ? "Déposez vos fichiers ici" : "Glissez-déposez vos captures"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Images (PNG, JPG) ou PDF
                  </p>
                </div>
              </div>
            </div>

            {analysisStatus && (
              <div className="mt-3 overflow-hidden">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  <span className="text-xs font-medium text-primary">
                    {analysisStatus.length > 40 ? analysisStatus.substring(0, 40) + "..." : analysisStatus}
                  </span>
                </div>

                {analysisCurrentFile && (
                  <p className="text-[11px] text-gray-400 mb-1.5 truncate">
                    📄 {analysisCurrentFile}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-primary tabular-nums whitespace-nowrap">
                    {Math.round((analysisProgress.current / analysisProgress.total) * 100)}%
                  </span>
                </div>

                <div className="flex justify-between items-center mt-1">
                  <p className="text-[10px] text-gray-400">
                    {analysisProgress.current} / {analysisProgress.total} fichiers
                  </p>
                  {analysisProgress.current === analysisProgress.total && analysisProgress.total > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] text-green-600">Analyse terminée</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <AnimatePresence>
              {uploadedDocs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 pt-3 border-t border-gray-100"
                >
                  <div className="flex flex-wrap gap-2">
                    {uploadedDocs.slice(0, 5).map((doc) => (
                      <motion.div
                        key={doc.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="group relative flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        {doc.previewUrl ? (
                          <div className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0">
                            <img src={doc.previewUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-gray-500" />
                        )}
                        <span className="text-xs text-gray-600 max-w-[120px] truncate">
                          {doc.name}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeDoc(doc.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                        >
                          <X className="h-3 w-3 text-gray-400 hover:text-red-500" />
                        </button>
                      </motion.div>
                    ))}
                    {uploadedDocs.length > 5 && (
                      <div className="px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-500">
                        +{uploadedDocs.length - 5}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-6 w-1 bg-primary rounded-full"></div>
            <h3 className="text-base font-semibold text-gray-800">Filtres</h3>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-1 flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Rechercher une opportunité..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 text-sm border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-[180px] h-10 text-sm border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary">
                  <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><SelectValue placeholder="Tous les statuts" /></div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm py-2">Tous les statuts</SelectItem>
                  {aoStatuts.filter(s => s && s.trim() !== "").map((s) => (<SelectItem key={s} value={s} className="text-sm py-2">{s}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[200px] h-10 text-sm border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary">
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-gray-400" /><SelectValue placeholder="Tous les clients" /></div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-sm py-2">Tous les clients</SelectItem>
                  {uniqueClients.map((c) => (<SelectItem key={c} value={c} className="text-sm py-2">{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {(searchQuery || filterStatut !== "all" || filterClient !== "all") && (
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setFilterStatut("all"); setFilterClient("all"); }} className="h-9 px-4 text-sm border-gray-300 hover:bg-gray-50">
                <X className="h-3.5 w-3.5 mr-2" />Réinitialiser
              </Button>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500"><span className="font-medium text-gray-700">{filteredAOs.length}</span> opportunité(s) cible(s) trouvée(s)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b pb-2">
          <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="gap-1 h-8 px-3 text-xs"><List className="h-3 w-3" />Liste</Button>
          <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("kanban")} className="gap-1 h-8 px-3 text-xs"><Grid3x3 className="h-3 w-3" />Kanban</Button>
        </div>

        {viewMode === "table" ? (
          <Card className="overflow-hidden border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 text-xs">
                    <TableHead className="font-medium">Titre</TableHead>
                    <TableHead className="font-medium">Client</TableHead>
                    <TableHead className="font-medium">Date</TableHead>
                    <TableHead className="font-medium text-center">Progression</TableHead>
                    <TableHead className="font-medium text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-12 text-sm">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        Aucune opportunité cible trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentItems.map((ao) => {
                      const colors = progressionColors[ao.progression || "0/25%"] || progressionColors["0/25%"];
                      return (
                        <TableRow key={ao.id} className="group hover:bg-gray-50 cursor-pointer text-sm" onClick={() => handleOpenDetails(ao)}>
                          <TableCell className="font-medium">{ao.titre}</TableCell>
                          <TableCell>{ao.client || "Non renseigné"}</TableCell>
                          <TableCell>{ao.dateLimite ? formatDate(ao.dateLimite) : "Non renseigné"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn(colors.lightBg, colors.text, colors.border, "text-xs px-2 py-0")}>
                              {ao.progression || "0/25%"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleShare(e, ao); }} disabled={processingTasks[ao.id] || !linkedinConnected} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-[#0A66C2] border border-[#0A66C2] rounded hover:bg-[#0A66C2] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                              {processingTasks[ao.id] ? (<><Loader2 className="h-3 w-3 animate-spin" /><span>Génération...</span></>) : (<><svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.979 0 1.778-.773 1.778-1.729V1.73C24 .774 23.204 0 22.225 0z" /></svg><span>Partager</span></>)}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && viewMode === "table" && (
              <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
                <span>Page {currentPage} / {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="h-7 px-2 text-xs">Précédent</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="h-7 px-2 text-xs">Suivant</Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <div className="py-2"><KanbanColumn column={kanbanColumn} /></div>
        )}
      </div>

      {/* DIALOGUE DE PRÉVISUALISATION LINKEDIN */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
        setShowPreviewDialog(open);
        if (!open) setSelectedAccounts([]);
      }}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <div className="bg-gradient-to-r from-[#0A66C2] to-[#004182] px-5 py-4">
            <DialogTitle className="text-white font-semibold flex items-center gap-2">
              <Linkedin className="h-4 w-4" />
              Envoyer aux commerciaux
            </DialogTitle>
          </div>

          <div className="p-5">
            <div className="border rounded-lg overflow-hidden bg-white">
              {generatedContent ? (
                <Textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  className="min-h-[200px] border-0 focus-visible:ring-0 p-4 bg-transparent resize-none text-sm"
                  placeholder="Votre message..."
                />
              ) : (
                <div className="min-h-[200px] flex justify-center items-center bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 text-[#0A66C2] animate-spin" />
                    <span className="text-sm text-gray-500">Génération en cours...</span>
                  </div>
                </div>
              )}
              <div className="bg-gray-50 px-4 py-2 border-t flex justify-end">
                <span className="text-xs text-gray-500">{(generatedContent || '').length} caractères</span>
              </div>
            </div>

            {commercialAccounts.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <label className="text-sm font-medium mb-2 block">
                  Sélectionner les commerciaux à notifier :
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {commercialAccounts.map((account) => (
                    <div key={account.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`account-${account.id}`}
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAccounts([...selectedAccounts, account.id]);
                          } else {
                            setSelectedAccounts(selectedAccounts.filter(id => id !== account.id));
                          }
                        }}
                      />
                      <label htmlFor={`account-${account.id}`} className="text-sm cursor-pointer">
                        {account.name} {account.email && `<${account.email}>`}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2">
            <Button onClick={() => setShowPreviewDialog(false)} className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1">Annuler</Button>
            <Button onClick={handleNotifyCommercials} disabled={isNotifying || !generatedContent || selectedAccounts.length === 0} className="h-8 px-4 text-xs bg-[#0A66C2] hover:bg-[#004182] text-white gap-1">
              {isNotifying ? (<><Loader2 className="h-3 w-3 animate-spin" /><span>Envoi...</span></>) : (<><Bell className="h-3 w-3" /><span>Notifier les commerciaux ({selectedAccounts.length})</span></>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOGUE DES DÉTAILS DE L'OPPORTUNITÉ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Détails de l'opportunité cible
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
          ) : selectedAoDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-muted-foreground">Titre</Label><p className="text-sm font-medium">{selectedAoDetail.titre || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Client</Label><p className="text-sm font-medium">{selectedAoDetail.client || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Référence</Label><p className="text-sm">{selectedAoDetail.reference || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Type d'offre</Label><p className="text-sm">{selectedAoDetail.typeOffre || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Lieu</Label><p className="text-sm">{selectedAoDetail.lieu || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Type de contrat</Label><p className="text-sm">{selectedAoDetail.typeContrat || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Date de création</Label><p className="text-sm">{formatDate(selectedAoDetail.dateCreation)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Date limite</Label><p className="text-sm">{formatDate(selectedAoDetail.dateLimite)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Date d'import</Label><p className="text-sm">{selectedAoDetail.dateImport ? new Date(selectedAoDetail.dateImport).toLocaleDateString('fr-FR') : "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Budget estimé</Label><p className="text-sm">{formatMontant(selectedAoDetail.montantEstime)}</p></div>
                <div><Label className="text-xs text-muted-foreground">CA pondéré</Label><p className="text-sm">{formatMontant(selectedAoDetail.caPondere || 0)}</p></div>
                <div><Label className="text-xs text-muted-foreground">Devise</Label><p className="text-sm">{selectedAoDetail.devise || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Progression</Label><p className="text-sm">{selectedAoDetail.progression || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Statut</Label><p className="text-sm">{selectedAoDetail.statut || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Date de démarrage</Label><p className="text-sm">{selectedAoDetail.dateDemarrage || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Durée</Label><p className="text-sm">{selectedAoDetail.duree || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Contact</Label><p className="text-sm">{selectedAoDetail.contactNom || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Manager responsable</Label><p className="text-sm">{selectedAoDetail.responsableManager || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Agence</Label><p className="text-sm">{selectedAoDetail.agence || "Non renseigné"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Pôle</Label><p className="text-sm">{selectedAoDetail.pole || "Non renseigné"}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Description</Label><p className="text-sm whitespace-pre-wrap">{selectedAoDetail.description || "Non renseigné"}</p></div>
                <div className="col-span-2"><Label className="text-xs text-muted-foreground">Critères</Label><p className="text-sm">{selectedAoDetail.criteres || "Non renseigné"}</p></div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Aucune donnée disponible</div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDetailDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOGUE OCR */}
      <Dialog open={showOcrDialog} onOpenChange={setShowOcrDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Résultat de l'analyse
            </DialogTitle>
          </DialogHeader>
          {ocrResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Titre *</Label>
                  <Input
                    value={ocrResult.titre || ""}
                    onChange={(e) => setOcrResult({ ...ocrResult, titre: e.target.value })}
                    className="text-sm mt-1"
                    placeholder="Titre de l'opportunité"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Client *</Label>
                  <Input
                    value={ocrResult.client || ""}
                    onChange={(e) => setOcrResult({ ...ocrResult, client: e.target.value })}
                    className="text-sm mt-1"
                    placeholder="Nom du client"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Référence</Label>
                  <Input
                    value={ocrResult.reference || ""}
                    onChange={(e) => setOcrResult({ ...ocrResult, reference: e.target.value })}
                    className="text-sm mt-1"
                    placeholder="Référence de l'opportunité"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Budget HT (€)</Label>
                  <Input
                    type="number"
                    value={ocrResult.budget_ht || 0}
                    onChange={(e) => setOcrResult({ ...ocrResult, budget_ht: parseFloat(e.target.value) || 0 })}
                    className="text-sm mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Durée</Label>
                  <Input
                    value={ocrResult.duree || ""}
                    onChange={(e) => setOcrResult({ ...ocrResult, duree: e.target.value })}
                    className="text-sm mt-1"
                    placeholder="Ex: 12 mois"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date de démarrage</Label>
                  <Input
                    type="date"
                    value={
                      ocrResult.date_demarrage &&
                        ocrResult.date_demarrage !== 'jj/mm/aaaa' &&
                        ocrResult.date_demarrage !== 'dd/mm/yyyy' &&
                        ocrResult.date_demarrage.match(/^\d{2}\/\d{2}\/\d{4}$/)
                        ? ocrResult.date_demarrage.split('/').reverse().join('-')
                        : ""
                    }
                    onChange={(e) => {
                      const dateValue = e.target.value;
                      if (dateValue) {
                        const [year, month, day] = dateValue.split('-');
                        const formattedDate = `${day}/${month}/${year}`;
                        setOcrResult({ ...ocrResult, date_demarrage: formattedDate });
                      } else {
                        setOcrResult({ ...ocrResult, date_demarrage: "" });
                      }
                    }}
                    className="text-sm mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Textarea
                    value={ocrResult.description || ""}
                    onChange={(e) => setOcrResult({ ...ocrResult, description: e.target.value })}
                    className="text-sm mt-1 min-h-[120px]"
                    rows={5}
                    placeholder="Description détaillée de la mission"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Critères / Compétences</Label>
                  <Input
                    value={ocrResult.criteres || ""}
                    onChange={(e) => setOcrResult({ ...ocrResult, criteres: e.target.value })}
                    className="text-sm mt-1"
                    placeholder="Java, SQL, React"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOcrDialog(false)}>Annuler</Button>
            <Button onClick={handleSaveAOFromOCR} disabled={savingOCR}>
              {savingOCR ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer l'opportunité"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AppelsOffres;