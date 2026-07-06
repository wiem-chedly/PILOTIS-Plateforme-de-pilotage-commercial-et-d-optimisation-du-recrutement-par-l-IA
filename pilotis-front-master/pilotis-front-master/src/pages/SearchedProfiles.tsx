// src/pages/SearchedProfiles.tsx
import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Users,
  Briefcase,
  MapPin,
  Globe,
  Calendar,
  CheckCircle,
  XCircle,
  Sparkles,
  TrendingUp,
  FileText,
  Send,
  Mail,
} from "lucide-react";

interface SearchedProfile {
  id: number;
  name: string;
  description: string;
  skills: string[];
  min_experience: number;
  max_experience: number | null;
  countries: string[];
  is_foreign_allowed: boolean;
  contract_types: string[];
  languages: { name: string; level: string }[];
  is_active: boolean;
  created_at: string;
}

interface MatchResult {
  candidate_id: number;
  candidate_name: string;
  email: string;
  score: number;
  cv_drive_link: string | null;
  is_engaged: boolean;
  details: any[];
}

const SearchedProfiles = () => {
  const [profiles, setProfiles] = useState<SearchedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<SearchedProfile | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    skills: "",
    min_experience: 0,
    max_experience: "",
    countries: "",
    is_foreign_allowed: true,
    contract_types: "",
    languages: "",
  });
  const { toast } = useToast();

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/searched-profiles", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de charger les profils", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        skills: formData.skills.split(",").map(s => s.trim()),
        min_experience: parseInt(formData.min_experience.toString()),
        max_experience: formData.max_experience ? parseInt(formData.max_experience.toString()) : null,
        countries: formData.countries.split(",").map(c => c.trim()),
        is_foreign_allowed: formData.is_foreign_allowed,
        contract_types: formData.contract_types.split(",").map(c => c.trim()),
        languages: [],
      };

      const url = currentProfile
        ? `http://localhost:5000/api/searched-profiles/${currentProfile.id}`
        : "http://localhost:5000/api/searched-profiles";
      const method = currentProfile ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.ok) {
        toast({ title: "✅ Succès", description: currentProfile ? "Profil modifié" : "Profil créé" });
        loadProfiles();
        setShowDialog(false);
        resetForm();
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    }
  };

  const deleteProfile = async (id: number, name: string) => {
    if (!confirm(`Supprimer le profil "${name}" ?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/searched-profiles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "✅ Supprimé", description: `Profil "${name}" supprimé` });
        loadProfiles();
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    }
  };

  const matchProfile = async (profile: SearchedProfile) => {
    try {
      const res = await fetch(`http://localhost:5000/api/searched-profiles/${profile.id}/match`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMatchResults(data.matches || []);
        setCurrentProfile(profile);
        setSelectedCandidates([]);
        setShowMatchDialog(true);
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de lancer la recherche", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      skills: "",
      min_experience: 0,
      max_experience: "",
      countries: "",
      is_foreign_allowed: true,
      contract_types: "",
      languages: "",
    });
    setCurrentProfile(null);
  };

  const openEditDialog = (profile?: SearchedProfile) => {
    if (profile) {
      setCurrentProfile(profile);
      setFormData({
        name: profile.name,
        description: profile.description || "",
        skills: profile.skills.join(", "),
        min_experience: profile.min_experience,
        max_experience: profile.max_experience?.toString() || "",
        countries: profile.countries.join(", "),
        is_foreign_allowed: profile.is_foreign_allowed,
        contract_types: profile.contract_types.join(", "),
        languages: "",
      });
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const viewCV = (driveLink: string) => {
    if (driveLink) {
      window.open(driveLink, '_blank');
    }
  };

  const toggleCandidateSelection = (id: number) => {
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  const selectAllCandidates = () => {
    if (selectedCandidates.length === matchResults.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(matchResults.map((m) => m.candidate_id));
    }
  };

  const handleSendOutreach = async () => {
    if (selectedCandidates.length === 0 || !currentProfile) return;
    setSendingOutreach(true);

    try {
      const response = await fetch(`http://localhost:5000/api/searched-profiles/${currentProfile.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_ids: selectedCandidates }),
        credentials: "include",
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: "✅ Succès", description: `${data.results.length} emails d'approche envoyés avec succès !` });
        setSelectedCandidates([]);
      } else {
        toast({ title: "Erreur", description: data.error || "Erreur lors de l'envoi", variant: "destructive" });
      }
    } catch (error) {
      console.error("Erreur de connexion", error);
      toast({ title: "Erreur", description: "Erreur de connexion au serveur", variant: "destructive" });
    } finally {
      setSendingOutreach(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  return (
    <DashboardLayout title="Profils recherchés">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center shadow-sm">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Profils recherchés</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Définissez des profils types pour retrouver rapidement des candidats
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-gray-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Profils créés</p>
                  <p className="text-2xl font-bold text-gray-800">{profiles.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-gray-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Profils actifs</p>
                  <p className="text-2xl font-bold text-gray-800">{profiles.filter(p => p.is_active).length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barre de recherche et bouton */}
        <div className="flex justify-between items-center">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Rechercher un profil..." className="pl-10 h-11 text-sm border-gray-200 rounded-xl bg-white" />
          </div>
          <Button onClick={() => openEditDialog()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4" /> Nouveau profil
          </Button>
        </div>

        {/* Tableau des profils */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="w-[200px]">Nom</TableHead>
                  <TableHead>Compétences</TableHead>
                  <TableHead className="w-[100px]">Expérience</TableHead>
                  <TableHead className="w-[150px]">Localisation</TableHead>
                  <TableHead className="w-[100px]">Statut</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : profiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      Aucun profil. Créez votre premier profil recherché !
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((p) => (
                    <TableRow key={p.id} className="hover:bg-gray-50 group border-b">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {p.skills.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{p.skills.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.min_experience}-{p.max_experience || "+"} ans
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.countries.slice(0, 2).map((country) => (
                            <Badge key={country} variant="outline" className="text-xs">
                              {country}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.is_active ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" /> Actif
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500">
                            <XCircle className="h-3 w-3 mr-1" /> Inactif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 rounded-full" onClick={() => matchProfile(p)}>
                            <Search className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 rounded-full" onClick={() => openEditDialog(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 rounded-full" onClick={() => deleteProfile(p.id, p.name)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Dialogue de création/modification */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <div className="bg-indigo-100 p-2 rounded-xl">
                {currentProfile ? <Edit className="h-5 w-5 text-indigo-600" /> : <Plus className="h-5 w-5 text-indigo-600" />}
              </div>
              {currentProfile ? "Modifier le profil" : "Créer un profil recherché"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-gray-700">Nom du profil *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-gray-700">Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="mt-1" />
            </div>
            <div>
              <Label className="text-gray-700">Compétences (séparées par des virgules)</Label>
              <Input value={formData.skills} onChange={(e) => setFormData({ ...formData, skills: e.target.value })} placeholder="Java, Python, SQL, React..." className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700">Expérience min (ans)</Label>
                <Input type="number" value={formData.min_experience} onChange={(e) => setFormData({ ...formData, min_experience: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div>
                <Label className="text-gray-700">Expérience max (ans)</Label>
                <Input type="number" value={formData.max_experience} onChange={(e) => setFormData({ ...formData, max_experience: e.target.value })} placeholder="Illimité" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-gray-700">Pays (séparés par des virgules)</Label>
              <Input value={formData.countries} onChange={(e) => setFormData({ ...formData, countries: e.target.value })} placeholder="France, Tunisie..." className="mt-1" />
            </div>
            <div>
              <Label className="text-gray-700">Types de contrat (séparés par des virgules)</Label>
              <Input value={formData.contract_types} onChange={(e) => setFormData({ ...formData, contract_types: e.target.value })} placeholder="CDI, CDD, Freelance" className="mt-1" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-gray-700">Autoriser les candidats étrangers</Label>
              <Switch checked={formData.is_foreign_allowed} onCheckedChange={(checked) => setFormData({ ...formData, is_foreign_allowed: checked })} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={saveProfile} className="bg-indigo-600 hover:bg-indigo-700">
              {currentProfile ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue des résultats de matching - MODIFIÉ pour inclure les CV */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-2 text-xl font-bold">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Résultats pour "{currentProfile?.name}"
              </div>
              
              {matchResults.length > 0 && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm font-normal text-gray-600">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 rounded border-gray-300"
                      checked={selectedCandidates.length === matchResults.length && matchResults.length > 0}
                      onChange={selectAllCandidates}
                    />
                    <label>Tout sélectionner</label>
                  </div>
                  
                  <Button 
                    onClick={handleSendOutreach} 
                    disabled={selectedCandidates.length === 0 || sendingOutreach}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
                  >
                    {sendingOutreach ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Contacter ({selectedCandidates.length})
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {matchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              Aucun candidat ne correspond à ce profil
            </div>
          ) : (
            <div className="space-y-3">
              {matchResults.map((match) => (
                <div key={match.candidate_id} className={`border rounded-xl p-4 transition-all duration-200 ${selectedCandidates.includes(match.candidate_id) ? 'border-indigo-400 bg-indigo-50/30' : 'hover:shadow-md'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedCandidates.includes(match.candidate_id)}
                          onChange={() => toggleCandidateSelection(match.candidate_id)}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          {match.candidate_name}
                          {match.is_engaged && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0 h-5">
                              En processus
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {match.email}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-lg px-3 py-1 ${match.score >= 70 ? 'bg-green-100 text-green-700' : match.score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {match.score}%
                    </Badge>
                  </div>
                  
                  {/* CV Link - NOUVEAU */}
                  {match.cv_drive_link && (
                    <div className="mt-2 mb-2">
                      <button
                        onClick={() => viewCV(match.cv_drive_link!)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Voir le CV
                      </button>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {match.details.map((detail, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {detail.category}: {detail.score}%
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SearchedProfiles;