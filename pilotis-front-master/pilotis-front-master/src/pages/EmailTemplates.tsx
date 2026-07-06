// src/pages/EmailTemplates.tsx
import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Mail,
  Variable,
  CheckCircle,
  XCircle,
  Sparkles,
  Search,
  FileText,
  User,
  Briefcase,
  Calendar,
  TrendingUp,
  Building,
  Link,
  Smartphone,
  AtSign,
  UserCircle,
  Send,
  Users,
  RefreshCw,
} from "lucide-react";

interface EmailTemplate {
  id_template: number;
  name_template: string;
  subject: string;
  body: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface JobApplication {
  id_many: number;
  requisition_id: number;
  titre: string;
  client: string;
  match_score: number;
  status: string;
}

interface CandidateWithApps {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  cv_drive_link: string | null;  // MODIFIÉ : ajout du champ Drive
  applications: JobApplication[];
}

const EmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [candidates, setCandidates] = useState<CandidateWithApps[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<EmailTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSelections, setSelectedSelections] = useState<{ candidate_id: number; application_id: number }[]>([]);
  const [sending, setSending] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [previewData, setPreviewData] = useState<{ subject: string; body: string; candidate_name: string; candidate_email: string; job_title: string; match_score: string } | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<{ candidate_id: number; application_id: number } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const [editPreviewMode, setEditPreviewMode] = useState(false);
  const [formData, setFormData] = useState({
    name_template: "",
    subject: "",
    body: "",
    description: "",
    is_active: true,
  });
  const { toast } = useToast();

  const variables = [
    { name: "{{ candidate_name }}", description: "Nom complet", category: "Candidat" },
    { name: "{{ candidate_first_name }}", description: "Prénom", category: "Candidat" },
    { name: "{{ candidate_last_name }}", description: "Nom", category: "Candidat" },
    { name: "{{ candidate_email }}", description: "Email", category: "Candidat" },
    { name: "{{ candidate_phone }}", description: "Téléphone", category: "Candidat" },
    { name: "{{ job_title }}", description: "Titre du poste", category: "Offre" },
    { name: "{{ job_client }}", description: "Nom du client", category: "Offre" },
    { name: "{{ job_reference }}", description: "Référence", category: "Offre" },
    { name: "{{ match_score }}", description: "Score (%)", category: "Score" },
    { name: "{{ company }}", description: "OMICRONE", category: "Info" },
    { name: "{{ date }}", description: "Date du jour", category: "Info" },
    { name: "{{ year }}", description: "Année", category: "Info" },
    { name: "{{ dashboard_link }}", description: "Lien dashboard", category: "Info" },
  ];

  const getScoreThreshold = (templateName: string) => {
    const name = templateName.toLowerCase();
    
    if (name === "email match") {
      return { min: 70, max: 100, label: "Match (≥70%)" };
    }
    if (name === "email review") {
      return { min: 40, max: 69, label: "Review (40-69%)" };
    }
    if (name === "email non-match" || name === "email non match") {
      return { min: 0, max: 39, label: "Non-Match (<40%)" };
    }
    
    if (name.includes("match") && !name.includes("non")) {
      return { min: 70, max: 100, label: "Match (≥70%)" };
    }
    if (name.includes("review")) {
      return { min: 40, max: 69, label: "Review (40-69%)" };
    }
    if (name.includes("non") && name.includes("match")) {
      return { min: 0, max: 39, label: "Non-Match (<40%)" };
    }
    
    return null;
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/email-templates", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de charger les templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadCandidatesForTemplate = async (template: EmailTemplate) => {
    try {
      const res = await fetch("http://localhost:5000/api/candidates", { 
        credentials: "include" 
      });
      
      if (!res.ok) {
        console.error("Erreur chargement candidats:", res.status);
        return;
      }
      
      const data = await res.json();
      const threshold = getScoreThreshold(template.name_template);
      
      const enhancedData: CandidateWithApps[] = [];
      for (const c of data) {
        try {
          const appsRes = await fetch(`http://localhost:5000/api/candidates/${c.id}/applications`, { 
            credentials: "include" 
          });
          let applications: JobApplication[] = [];
          if (appsRes.ok) {
            const appsData = await appsRes.json();
            applications = appsData.applications || [];
          }
          
          let filteredApplications = applications;
          if (threshold) {
            filteredApplications = applications.filter(app => 
              app.match_score >= threshold.min && app.match_score <= threshold.max
            );
          }
          
          if (filteredApplications.length > 0) {
            enhancedData.push({ 
              ...c, 
              applications: filteredApplications,
              cv_drive_link: c.cv_drive_link  // Ajout du champ Drive
            });
          }
        } catch (err) {
          console.error(`Erreur pour candidat ${c.id}:`, err);
        }
      }
      
      console.log(`✅ Candidats pour ${template.name_template} (${threshold?.label || "tous"}):`, enhancedData.length);
      setCandidates(enhancedData);
      
      if (enhancedData.length === 0) {
        setPreviewData(null);
        setEditedSubject("");
        setEditedBody("");
        setSelectedPreview(null);
      }
      
    } catch (err) {
      console.error("Erreur:", err);
      setCandidates([]);
      setPreviewData(null);
      setEditedSubject("");
      setEditedBody("");
      setSelectedPreview(null);
    }
  };

  const loadPreview = useCallback(async (templateId: number, candidateId: number, applicationId: number) => {
    if (!templateId || !candidateId) return;
    
    setIsLoadingPreview(true);
    try {
      const url = `http://localhost:5000/api/email-templates/${templateId}/preview?candidate_id=${candidateId}&application_id=${applicationId}`;
      const res = await fetch(url, { 
        credentials: "include",
        cache: "no-cache"
      });
      
      if (res.ok) {
        const data = await res.json();
        setPreviewData({
          subject: data.subject,
          body: data.body,
          candidate_name: data.candidate_name || "",
          candidate_email: data.candidate_email || "",
          job_title: data.job_title || "",
          match_score: data.match_score || ""
        });
        setEditedSubject(data.subject);
        setEditedBody(data.body);
      }
    } catch (err) {
      console.error("Erreur:", err);
      toast({ title: "Erreur", description: "Impossible de charger l'aperçu", variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
    }
  }, [toast]);

  const saveTemplate = async () => {
    if (!formData.name_template || !formData.subject || !formData.body) {
      toast({ title: "Erreur", description: "Nom, sujet et corps sont requis", variant: "destructive" });
      return;
    }

    try {
      const url = currentTemplate
        ? `http://localhost:5000/api/email-templates/${currentTemplate.id_template}`
        : "http://localhost:5000/api/email-templates";
      const method = currentTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (res.ok) {
        toast({ title: "✅ Succès", description: currentTemplate ? "Template modifié" : "Template créé" });
        loadTemplates();
        setShowDialog(false);
        resetForm();
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    }
  };

  const deleteTemplate = async (id: number, name: string) => {
    if (!confirm(`Supprimer le template "${name}" ?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/email-templates/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "✅ Supprimé", description: `Template "${name}" supprimé` });
        loadTemplates();
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    }
  };

  const sendEmails = async () => {
    if (selectedSelections.length === 0) {
      toast({ title: "Erreur", description: "Sélectionnez au moins un candidat avec une offre", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const payload = {
        selections: selectedSelections,
        custom_subject: editedSubject,
        custom_body: editedBody
      };
      
      const res = await fetch(`http://localhost:5000/api/email-templates/${currentTemplate?.id_template}/send-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        toast({ 
          title: "✅ Envoi terminé", 
          description: `${data.success_count} envoyé(s), ${data.failed_count} échec(s)` 
        });
        setShowSendDialog(false);
        setSelectedSelections([]);
        setPreviewData(null);
      } else {
        const error = await res.json();
        toast({ title: "❌ Erreur", description: error.error || "Erreur lors de l'envoi", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "❌ Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const toggleSelection = (candidateId: number, applicationId: number) => {
    const exists = selectedSelections.find(s => s.candidate_id === candidateId && s.application_id === applicationId);
    if (exists) {
      setSelectedSelections(prev => prev.filter(s => !(s.candidate_id === candidateId && s.application_id === applicationId)));
    } else {
      setSelectedSelections(prev => [...prev, { candidate_id: candidateId, application_id: applicationId }]);
    }
  };

  const resetForm = () => {
    setFormData({ name_template: "", subject: "", body: "", description: "", is_active: true });
    setCurrentTemplate(null);
    setActiveField("body");
  };

  const openEditDialog = (template?: EmailTemplate) => {
    setEditPreviewMode(false);
    if (template) {
      setCurrentTemplate(template);
      setFormData({
        name_template: template.name_template,
        subject: template.subject,
        body: template.body,
        description: template.description || "",
        is_active: template.is_active,
      });
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const openSendDialog = async (template: EmailTemplate) => {
    setCurrentTemplate(template);
    setSelectedSelections([]);
    setPreviewData(null);
    setEditedSubject("");
    setEditedBody("");
    setSelectedPreview(null);
    setActiveTab("edit");
    await loadCandidatesForTemplate(template);
    setShowSendDialog(true);
  };

  const handlePreview = async (candidateId: number, applicationId: number) => {
    setSelectedPreview({ candidate_id: candidateId, application_id: applicationId });
    if (currentTemplate) {
      await loadPreview(currentTemplate.id_template, candidateId, applicationId);
    }
    setActiveTab("preview");
  };

  const insertVariable = (variable: string) => {
    if (activeField === "subject") {
      setFormData((prev) => ({ ...prev, subject: prev.subject + variable }));
      toast({ title: "✅ Variable ajoutée", description: "Ajoutée dans le sujet" });
    } else {
      setFormData((prev) => ({ ...prev, body: prev.body + variable }));
      toast({ title: "✅ Variable ajoutée", description: "Ajoutée dans le corps" });
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name_template.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadTemplates();
  }, []);

  return (
    <DashboardLayout title="Templates Email">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
              <Mail className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Templates Email</h1>
              <p className="text-sm text-gray-500 mt-0.5">Créez, modifiez et envoyez des emails personnalisés</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-gray-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Total templates</p><p className="text-2xl font-bold text-gray-800">{templates.length}</p></div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center"><Mail className="h-5 w-5 text-gray-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Templates actifs</p><p className="text-2xl font-bold text-gray-800">{templates.filter(t => t.is_active).length}</p></div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Variables disponibles</p><p className="text-2xl font-bold text-gray-800">{variables.length}</p></div>
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center"><Variable className="h-5 w-5 text-blue-500" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barre de recherche */}
        <div className="flex justify-between items-center">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Rechercher un template..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11 text-sm border-gray-200 rounded-xl bg-white" />
          </div>
          <Button onClick={() => openEditDialog()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4" /> Nouveau template
          </Button>
        </div>

        {/* Tableau des templates */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="w-[180px] font-semibold text-gray-600">Nom</TableHead>
                  <TableHead className="w-[280px] font-semibold text-gray-600">Sujet</TableHead>
                  <TableHead className="w-[320px] font-semibold text-gray-600">Description</TableHead>
                  <TableHead className="w-[100px] font-semibold text-gray-600">Statut</TableHead>
                  <TableHead className="w-[120px] text-right font-semibold text-gray-600">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex justify-center items-center gap-2">
                        <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-gray-500">Chargement...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-400">
                      <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      Aucun template. Créez votre premier template !
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((t) => (
                    <TableRow key={t.id_template} className="hover:bg-gray-50 group border-b">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[140px]" title={t.name_template}>
                            {t.name_template}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        <div className="truncate max-w-[260px]" title={t.subject}>
                          {t.subject}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">
                        <div className="truncate max-w-[300px]" title={t.description || "—"}>
                          {t.description || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {t.is_active ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" /> Actif
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 border-gray-200">
                            <XCircle className="h-3 w-3 mr-1" /> Inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 rounded-full" onClick={() => openSendDialog(t)}>
                                  <Send className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Envoyer</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 rounded-full" onClick={() => openEditDialog(t)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Modifier</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 rounded-full" onClick={() => deleteTemplate(t.id_template, t.name_template)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialogue d'envoi */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl p-0">
          <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-2xl z-10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
                <Send className="h-5 w-5 text-green-500" />
                Envoyer un email - {currentTemplate?.name_template}
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {currentTemplate && getScoreThreshold(currentTemplate.name_template) && (
                  <span className="text-blue-600">
                    📊 Filtre: {getScoreThreshold(currentTemplate.name_template)?.label}
                  </span>
                )}
              </p>
            </DialogHeader>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Colonne gauche : Destinataires avec sélection d'offre */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <Label className="text-gray-700 font-medium mb-3 block">Destinataires et offres</Label>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {candidates.map((c) => (
                      <div key={c.id} className="bg-white rounded-lg p-3 border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-800">{c.first_name} {c.last_name}</span>
                          <span className="text-xs text-gray-500">{c.email}</span>
                        </div>
                        
                        <div className="space-y-2 pl-2">
                          <Label className="text-xs text-gray-500">Offres postulées :</Label>
                          {c.applications.map((app) => {
                            const isSelected = selectedSelections.some(s => s.candidate_id === c.id && s.application_id === app.id_many);
                            const isPreviewing = selectedPreview?.candidate_id === c.id && selectedPreview?.application_id === app.id_many;
                            return (
                              <div key={app.id_many} className="flex items-center gap-2 pl-2 py-1 hover:bg-gray-50 rounded">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelection(c.id, app.id_many)}
                                  className="rounded border-gray-300"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Briefcase className="h-3 w-3 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">{app.titre}</span>
                                    <Badge className={`text-xs ${app.match_score >= 70 ? 'bg-green-100 text-green-700' : app.match_score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                      Score: {app.match_score}%
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-400">Client: {app.client}</p>
                                </div>
                                <Button 
                                  variant={isPreviewing ? "default" : "ghost"} 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedPreview({ candidate_id: c.id, application_id: app.id_many });
                                    handlePreview(c.id, app.id_many);
                                  }} 
                                  className={isPreviewing ? "bg-indigo-600 text-white text-xs" : "text-xs"}
                                >
                                  <Eye className="h-3 w-3 mr-1" /> 
                                  {isPreviewing ? "En cours" : "Aperçu"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {candidates.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        Aucun candidat avec offre correspondante
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-gray-600">
                      <strong>{selectedSelections.length}</strong> candidature(s) sélectionnée(s)
                    </p>
                  </div>
                </div>
              </div>

              {/* Colonne droite : ONGLETS Édition / Aperçu */}
              <div className="space-y-4">
                <div className="flex gap-1 border-b">
                  <button
                    onClick={() => setActiveTab("edit")}
                    className={`px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === "edit"
                        ? "text-indigo-600 border-b-2 border-indigo-600 -mb-px"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Edit className="h-4 w-4 inline mr-2" />
                    Édition
                  </button>
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === "preview"
                        ? "text-indigo-600 border-b-2 border-indigo-600 -mb-px"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Eye className="h-4 w-4 inline mr-2" />
                    Aperçu
                  </button>
                </div>

                {activeTab === "edit" && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-gray-700">Sujet</Label>
                      <Input 
                        value={editedSubject} 
                        onChange={(e) => setEditedSubject(e.target.value)} 
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700">Corps de l'email</Label>
                      <Textarea 
                        rows={16} 
                        value={editedBody} 
                        onChange={(e) => setEditedBody(e.target.value)} 
                        className="mt-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                )}

                {activeTab === "preview" && (
                  <div className="space-y-3">
                    {isLoadingPreview && (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-8">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Chargement de l'aperçu...
                      </div>
                    )}

                    {previewData && !isLoadingPreview && (() => {
                      const score = parseInt(previewData.match_score || '0');
                      const scoreBadgeClass = score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                      const scoreBgColor   = score >= 70 ? '#DCFCE7' : score >= 40 ? '#FEF3C7' : '#FEE2E2';
                      const scoreColor     = score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626';

                      const bodyHtml = previewData.body
                        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#4F46E5;text-decoration:underline;">$1</a>')
                        .replace(/\n/g, '<br/>');

                      const html = `
                        <div style="font-family:'Segoe UI',Arial,sans-serif;background:#F3F4F6;padding:16px;">
                          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px 10px 0 0;padding:10px 16px;display:flex;align-items:center;gap:8px;">
                            <div style="display:flex;gap:5px;">
                              <div style="width:9px;height:9px;border-radius:50%;background:#FF5F57;"></div>
                              <div style="width:9px;height:9px;border-radius:50%;background:#FEBC2E;"></div>
                              <div style="width:9px;height:9px;border-radius:50%;background:#28C840;"></div>
                            </div>
                            <div style="font-size:11px;color:#9CA3AF;flex:1;text-align:center;">${previewData.subject}</div>
                            <span style="font-size:10px;background:${scoreBgColor};color:${scoreColor};padding:2px 8px;border-radius:999px;font-weight:600;">Score: ${previewData.match_score}%</span>
                          </div>
                          <div style="background:#FAFAFA;border:1px solid #E5E7EB;border-top:none;padding:8px 16px;font-size:11px;color:#6B7280;">
                            <div><strong>De :</strong> Pilotis Recrutement &lt;noreply@pilotis.fr&gt;</div>
                            <div><strong>\u00c0 :</strong> ${previewData.candidate_name} &lt;${previewData.candidate_email}&gt;</div>
                            <div><strong>Objet :</strong> ${previewData.subject}</div>
                          </div>
                          <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">
                            <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:20px 28px;text-align:center;">
                              <div style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:8px;padding:4px 14px;margin-bottom:8px;">
                                <span style="color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Pilotis Recrutement</span>
                              </div>
                              <div style="color:#fff;font-size:16px;font-weight:700;">${previewData.subject}</div>
                            </div>
                            <div style="padding:24px 28px;color:#374151;font-size:14px;line-height:1.85;">${bodyHtml}</div>
                            <div style="border-top:1px solid #F3F4F6;background:#F9FAFB;padding:14px 28px;text-align:center;">
                              <div style="color:#9CA3AF;font-size:11px;">Envoy\u00e9 automatiquement par <strong style="color:#4F46E5;">Pilotis</strong> &middot; &copy; 2025</div>
                            </div>
                          </div>
                        </div>`;

                      return (
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">
                              Aper\u00e7u pour <strong className="text-gray-800">{previewData.candidate_name}</strong> &middot; {previewData.job_title}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreBadgeClass}`}>{previewData.match_score}%</span>
                          </div>
                          <div className="max-h-[500px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: html }} />
                        </div>
                      );
                    })()}

                    {!previewData && !isLoadingPreview && (
                      <div className="text-center py-12 text-gray-400 border rounded-xl">
                        <Eye className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>Sélectionnez une offre et cliquez sur "Aperçu"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 rounded-b-2xl">
            <div className="flex-1">
              <p className="text-sm text-gray-500">💡 Cochez les offres à envoyer</p>
            </div>
            <Button variant="outline" onClick={() => setShowSendDialog(false)} className="border-blue-500 text-blue-600 hover:bg-blue-50">
              Annuler
            </Button>
            <Button onClick={sendEmails} disabled={sending || selectedSelections.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              {sending ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Envoi...</> : <><Send className="h-4 w-4 mr-2" /> Envoyer ({selectedSelections.length})</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de création/modification */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
              <div className="bg-indigo-100 p-2 rounded-xl">{currentTemplate ? <Edit className="h-5 w-5 text-indigo-600" /> : <Plus className="h-5 w-5 text-indigo-600" />}</div>
              {currentTemplate ? "Modifier le template" : "Créer un template"}
            </DialogTitle>
          </DialogHeader>

          {/* Tabs Édition / Aperçu */}
          <div className="flex gap-1 border-b mb-4">
            <button
              onClick={() => setEditPreviewMode(false)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                !editPreviewMode
                  ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Edit className="h-3.5 w-3.5 inline mr-1.5" />Édition
            </button>
            <button
              onClick={() => setEditPreviewMode(true)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                editPreviewMode
                  ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="h-3.5 w-3.5 inline mr-1.5" />Aperçu HTML
            </button>
          </div>

          {/* PANNEAU ÉDITION */}
          {!editPreviewMode && (
          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700">Nom du template *</Label>
                <Input 
                  value={formData.name_template} 
                  onChange={(e) => setFormData({ ...formData, name_template: e.target.value })} 
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-700">Statut</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                  <span className={formData.is_active ? "text-green-600" : "text-gray-400"}>{formData.is_active ? "Actif" : "Inactif"}</span>
                </div>
              </div>
            </div>

            {/* Sujet avec bouton pour insérer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-gray-700">Sujet *</Label>
                <Button
                  type="button"
                  variant={activeField === "subject" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveField("subject")}
                  className={activeField === "subject" ? "bg-indigo-600 h-7 text-xs" : "h-7 text-xs"}
                >
                  📧 Insérer ici
                </Button>
              </div>
              <Input 
                value={formData.subject} 
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })} 
                className="mt-1"
                placeholder="Sujet de l'email"
              />
            </div>

            {/* Corps avec bouton pour insérer */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-gray-700">Corps *</Label>
                <Button
                  type="button"
                  variant={activeField === "body" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveField("body")}
                  className={activeField === "body" ? "bg-indigo-600 h-7 text-xs" : "h-7 text-xs"}
                >
                  📝 Insérer ici
                </Button>
              </div>
              <Textarea 
                rows={10} 
                value={formData.body} 
                onChange={(e) => setFormData({ ...formData, body: e.target.value })} 
                className="mt-1 font-mono text-sm"
                placeholder="Contenu de l'email..."
              />
            </div>

            <div>
              <Label className="text-gray-700">Description</Label>
              <Input 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                className="mt-1"
                placeholder="À quoi sert ce template ?"
              />
            </div>

            {/* Variables disponibles */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <Label className="text-gray-700 font-medium">
                  Variables disponibles - Insertion dans :{" "}
                  <span className="text-indigo-600 font-bold">
                    {activeField === "subject" ? "📧 SUJET" : "📝 CORPS"}
                  </span>
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {variables.map((v) => (
                  <Badge 
                    key={v.name} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-indigo-50 transition-colors" 
                    onClick={() => insertVariable(v.name)}
                  >
                    {v.name}
                    <span className="ml-1 text-gray-400 text-xs">({v.description})</span>
                  </Badge>
                ))}
              </div>
            </div>
            </div>
          )}

          {/* PANNEAU APERCU HTML */}
          {editPreviewMode && (() => {
            const bodyHtml = (formData.body || '')
              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#4F46E5;text-decoration:underline;">$1</a>')
              .replace(/\n/g, '<br/>');

            const html = `
              <div style="font-family:'Segoe UI',Arial,sans-serif;background:#F3F4F6;padding:16px;">
                <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px 10px 0 0;padding:10px 16px;display:flex;align-items:center;gap:8px;">
                  <div style="display:flex;gap:5px;">
                    <div style="width:9px;height:9px;border-radius:50%;background:#FF5F57;"></div>
                    <div style="width:9px;height:9px;border-radius:50%;background:#FEBC2E;"></div>
                    <div style="width:9px;height:9px;border-radius:50%;background:#28C840;"></div>
                  </div>
                  <div style="font-size:11px;color:#9CA3AF;flex:1;text-align:center;">${formData.subject || 'Sujet de l\'email'}</div>
                </div>
                <div style="background:#FAFAFA;border:1px solid #E5E7EB;border-top:none;padding:8px 16px;font-size:11px;color:#6B7280;">
                  <div><strong>De :</strong> Pilotis Recrutement &lt;noreply@pilotis.fr&gt;</div>
                  <div><strong>\u00c0 :</strong> {{ candidate_name }} &lt;{{ candidate_email }}&gt;</div>
                  <div><strong>Objet :</strong> ${formData.subject || '(non d\u00e9fini)'}</div>
                </div>
                <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 10px 10px;overflow:hidden;">
                  <div style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:20px 28px;text-align:center;">
                    <div style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:8px;padding:4px 14px;margin-bottom:8px;">
                      <span style="color:#fff;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Pilotis Recrutement</span>
                    </div>
                    <div style="color:#fff;font-size:16px;font-weight:700;">${formData.subject || 'Sujet'}</div>
                  </div>
                  <div style="padding:24px 28px;color:#374151;font-size:14px;line-height:1.85;">${bodyHtml || '<em style="color:#9CA3AF">Corps vide...</em>'}</div>
                  <div style="border-top:1px solid #F3F4F6;background:#F9FAFB;padding:14px 28px;text-align:center;">
                    <div style="color:#9CA3AF;font-size:11px;">Envoy\u00e9 automatiquement par <strong style="color:#4F46E5;">Pilotis</strong> &middot; &copy; 2025</div>
                  </div>
                </div>
              </div>`;

            return (
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-indigo-50 px-4 py-2 border-b flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-xs font-medium text-indigo-600">Aper\u00e7u en temps r\u00e9el — les variables s'afficheront remplac\u00e9es lors de l'envoi</span>
                </div>
                <div className="max-h-[460px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            );
          })()}

          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={saveTemplate} className="bg-indigo-600 hover:bg-indigo-700">
              {currentTemplate ? 'Mettre \u00e0 jour' : 'Cr\u00e9er'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default EmailTemplates;