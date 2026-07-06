// src/pages/Configuration.tsx
import { useState, useEffect } from "react";
import Swal from 'sweetalert2';
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Save, Trash2, Linkedin, Bot, Key, Eye, EyeOff, X, Edit, Check, User, RefreshCw,
  Mail, Square, Shield, Building2, ExternalLink, HardDrive, FolderOpen, LogOut,
  Mail as MailIcon, Users, Search, Sparkles, Briefcase, MapPin, Globe, Calendar,
  Plus, FileText, Send, Variable, Eye as EyeIcon, MessageSquare, TrendingUp,
  CheckCircle, XCircle, AlertCircle, Clock, Loader2
} from "lucide-react";

interface LinkedInAccount {
  id: number;
  name: string;
  email?: string;
  access_token: string;
  notify_by_email?: boolean;
  created_at: string;
}

interface Contact {
  id_contact: number;
  name: string;
  email: string;
  is_active: boolean;
  organization_id?: number | null;
  organization_name?: string | null;
  created_at: string;
}

interface ContactOAuthStatus {
  connected: boolean;
  provider: string | null;
  email: string | null;
}

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
  details: any[];
}

const DEFAULT_PROMPT = "";

const TEMPLATE_VARIABLES = [
  { name: "{{ candidate_name }}", description: "Nom complet du candidat", category: "Candidat" },
  { name: "{{ candidate_first_name }}", description: "Prénom du candidat", category: "Candidat" },
  { name: "{{ candidate_last_name }}", description: "Nom du candidat", category: "Candidat" },
  { name: "{{ candidate_email }}", description: "Email du candidat", category: "Candidat" },
  { name: "{{ candidate_phone }}", description: "Téléphone du candidat", category: "Candidat" },
  { name: "{{ job_title }}", description: "Titre du poste", category: "Offre" },
  { name: "{{ job_client }}", description: "Nom du client", category: "Offre" },
  { name: "{{ job_reference }}", description: "Référence de l'offre", category: "Offre" },
  { name: "{{ match_score }}", description: "Score de matching (%)", category: "Score" },
  { name: "{{ company }}", description: "Nom de l'entreprise", category: "Info" },
  { name: "{{ date }}", description: "Date du jour", category: "Info" },
  { name: "{{ year }}", description: "Année en cours", category: "Info" },
];

const Configuration = () => {
  const { user, hasAccess, reloadPermissions } = useAuth();
  const navigate = useNavigate();

  // AI Prompt
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [promptLoading, setPromptLoading] = useState(false);
  const [calendlyLink, setCalendlyLink] = useState("");
  const [calendlyToken, setCalendlyToken] = useState("");
  const [calendlyTokenSaved, setCalendlyTokenSaved] = useState(false);
  const [showCalendlyToken, setShowCalendlyToken] = useState(false);
  const [showGoogleSheetId, setShowGoogleSheetId] = useState(false);

  // LinkedIn Accounts
  const [linkedinAccounts, setLinkedinAccounts] = useState<LinkedInAccount[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountNotifyEmail, setNewAccountNotifyEmail] = useState(true);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [editingAccount, setEditingAccount] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editToken, setEditToken] = useState("");
  const [editNotifyEmail, setEditNotifyEmail] = useState(false);
  const [showEditToken, setShowEditToken] = useState(false);

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactActive, setNewContactActive] = useState(true);
  const [editingContact, setEditingContact] = useState<number | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactActive, setEditContactActive] = useState(false);

  // OAuth Gmail pour les contacts
  const [contactOAuthStatus, setContactOAuthStatus] = useState<{ [key: number]: ContactOAuthStatus }>({});

  // ==================== ÉTATS POUR GMAIL SETTINGS ====================
  const [gmailSettings, setGmailSettings] = useState({
    client_id: "",
    client_secret: "",
    redirect_uri: "http://localhost:5000/api/gmail-auth/callback"
  });
  const [gmailSettingsExists, setGmailSettingsExists] = useState(false);
  const [gmailSettingsLoading, setGmailSettingsLoading] = useState(false);
  const [showGmailSecret, setShowGmailSecret] = useState(false);
  const [isEditingGmail, setIsEditingGmail] = useState(false);

  // Permissions
  const [permissions, setPermissions] = useState({
    manager: {
      dashboard: true, 'appels-offres': true, performance: true, clients: true,
      reporting: true, configuration: true, 'logs-import': true, 'candidatures': true,
      'config-module': false, 'detail-sales': true, 'intercontrats': true,
      'kpi-annuels': true, 'synthese-hebdo': true, 'validation': true
    },
    commercial: {
      dashboard: true, 'appels-offres': true, performance: true, clients: true,
      reporting: true, configuration: false, 'logs-import': false, 'candidatures': true,
      'config-module': false, 'detail-sales': true, 'intercontrats': true,
      'kpi-annuels': true, 'synthese-hebdo': true, 'validation': true
    }
  });
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserRole, setEditUserRole] = useState<string>('commercial');
  const [editUserFirstName, setEditUserFirstName] = useState('');
  const [editUserLastName, setEditUserLastName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserOrgId, setEditUserOrgId] = useState<number | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('commercial');
  const [newUserOrgId, setNewUserOrgId] = useState<number | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [addingUser, setAddingUser] = useState(false);

  // Edit Organization
  const [showEditOrgDialog, setShowEditOrgDialog] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any | null>(null);
  const [editOrgForm, setEditOrgForm] = useState({ name: '', email: '', sector: '', website: '', phone: '', address: '' });
  const [editOrgLoading, setEditOrgLoading] = useState(false);

  // LinkedIn App Settings
  const [linkedinSettings, setLinkedinSettings] = useState({ client_id: '', client_secret: '' });
  const [linkedinSettingsLoading, setLinkedinSettingsLoading] = useState(false);
  const [showLinkedinSecret, setShowLinkedinSecret] = useState(false);

  // Email Settings
  const [emailSettings, setEmailSettings] = useState({
    server: '', port: 587, use_tls: true, username: '', password: '', default_sender: ''
  });
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Apify Settings
  const [apifySettings, setApifySettings] = useState({
    apify_api_token: '',
    apify_actor_id: 'scraping_solutions/linkedin-posts-engagers-likers-and-commenters-no-cookies',
    apify_webhook_url: '',
    linkedin_li_at_cookie: ''
  });
  const [apifyLoading, setApifyLoading] = useState(false);
  const [showApifyToken, setShowApifyToken] = useState(false);
  const [showLiAt, setShowLiAt] = useState(false);

  // Google Form Settings (LinkedIn candidature)
  const [googleFormSettings, setGoogleFormSettings] = useState({
    google_form_url: '',   // URL du form à partager dans les posts LinkedIn
    google_form_sheet_id: '',  // Spreadsheet ID Google Sheet des réponses
  });
  const [googleFormLoading, setGoogleFormLoading] = useState(false);

  // Drive Settings
  const [driveCredentials, setDriveCredentials] = useState({ client_id: "", client_secret: "" });
  const [driveStatus, setDriveStatus] = useState({ connected: false, email: "", message: "" });
  const [driveCredentialsLoading, setDriveCredentialsLoading] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [showDriveSecret, setShowDriveSecret] = useState(false);
  const [driveCredentialsExist, setDriveCredentialsExist] = useState(false);
  const [showDriveCredentialsForm, setShowDriveCredentialsForm] = useState(false);

  // Boond
  const [boondCredentials, setBoondCredentials] = useState([
    { id: "boond_client_key", name: "Client Key", value: "", isSecret: true },
    { id: "boond_client_token", name: "Client Token", value: "", isSecret: true },
    { id: "boond_user_token", name: "User Token", value: "", isSecret: true },
    { id: "boond_api_url", name: "API URL", value: "https://ui.boondmanager.com/api", isSecret: false }
  ]);
  const [showBoondValues, setShowBoondValues] = useState<{ [key: string]: boolean }>({});
  const [editingBoond, setEditingBoond] = useState(false);
  const [boondSaving, setBoondSaving] = useState(false);
  const [boondTesting, setBoondTesting] = useState(false);
  const [tempBoondClientKey, setTempBoondClientKey] = useState("");
  const [tempBoondClientToken, setTempBoondClientToken] = useState("");
  const [tempBoondUserToken, setTempBoondUserToken] = useState("");
  const [tempBoondApiUrl, setTempBoondApiUrl] = useState("");

  // Templates Email
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name_template: "", subject: "", body: "", description: "", is_active: true,
  });
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Profils Recherchés
  const [profiles, setProfiles] = useState<SearchedProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<SearchedProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "", description: "", skills: "", min_experience: 0, max_experience: "",
    countries: "", is_foreign_allowed: true, contract_types: "", languages: "",
  });
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchingProfile, setMatchingProfile] = useState<SearchedProfile | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // ==================== FONCTIONS CONTACTS OAUTH ====================
  const loadContactOAuthStatus = async (contactId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/gmail-auth/status/${contactId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setContactOAuthStatus(prev => ({ ...prev, [contactId]: data }));
      }
    } catch (err) {
      console.error("Erreur chargement statut OAuth:", err);
    }
  };

  const loadAllContactsOAuthStatus = async (contactsList: Contact[]) => {
    for (const contact of contactsList) {
      await loadContactOAuthStatus(contact.id_contact);
    }
  };

  // ==================== FONCTIONS GMAIL SETTINGS ====================
  const loadGmailSettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/gmail-auth/settings', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setGmailSettingsExists(data.exists || false);
        setGmailSettings({
          client_id: data.client_id || "",
          client_secret: "",
          redirect_uri: data.redirect_uri || "http://localhost:5000/api/gmail-auth/callback"
        });
        setIsEditingGmail(false);
      }
    } catch (err) {
      console.error("Erreur chargement settings Gmail:", err);
    }
  };

  const saveGmailSettings = async () => {
    if (!gmailSettings.client_id) {
      toast({ title: "Erreur", description: "Client ID est requis", variant: "destructive" });
      return;
    }

    if (!gmailSettingsExists && !gmailSettings.client_secret) {
      toast({ title: "Erreur", description: "Client Secret est requis pour la création", variant: "destructive" });
      return;
    }

    setGmailSettingsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/gmail-auth/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: gmailSettings.client_id,
          client_secret: gmailSettings.client_secret || null,
          redirect_uri: gmailSettings.redirect_uri
        }),
        credentials: 'include'
      });
      if (res.ok) {
        toast({ title: "✅ Paramètres Gmail sauvegardés" });
        await loadGmailSettings();
      } else {
        const error = await res.json();
        toast({ title: "❌ Erreur", description: error.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "❌ Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setGmailSettingsLoading(false);
    }
  };

  const deleteGmailSettings = async () => {
    setGmailSettingsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/gmail-auth/settings', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast({ title: "✅ Paramètres supprimés" });
        setGmailSettingsExists(false);
        setIsEditingGmail(false);
        setGmailSettings({
          client_id: "",
          client_secret: "",
          redirect_uri: "http://localhost:5000/api/gmail-auth/callback"
        });
      }
    } catch (err) {
      toast({ title: "❌ Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setGmailSettingsLoading(false);
    }
  };

  const startEditGmail = () => {
    setIsEditingGmail(true);
    setShowGmailSecret(false);
    setGmailSettings(prev => ({ ...prev, client_secret: "" }));
  };

  const cancelEditGmail = () => {
    setIsEditingGmail(false);
    loadGmailSettings();
  };

  // ==================== LOAD FUNCTIONS ====================
  useEffect(() => {
    loadSettings();
    loadLinkedInAccounts();
    loadContacts();
    loadPermissions();
    loadUsers();
    loadLinkedinSettings();
    loadEmailSettings();
    loadApifySettings();
    loadGoogleFormSettings();
    loadDriveCredentials();
    loadDriveStatus();
    loadTemplates();
    loadProfiles();
    loadGmailSettings();
    if (user?.role === 'super_admin') loadOrganizations();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin') === 'connected') {
      loadLinkedInAccounts();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('drive') === 'connected') {
      loadDriveStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ==================== DRIVE FUNCTIONS ====================
  const loadDriveCredentials = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/drive/credentials', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setDriveCredentialsExist(true);
          setDriveCredentials({ client_id: data.client_id || "", client_secret: "" });
        } else setDriveCredentialsExist(false);
      }
    } catch (err) { console.error(err); }
  };

  const loadDriveStatus = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/drive/status', { credentials: 'include' });
      if (res.ok) setDriveStatus(await res.json());
    } catch (err) { console.error(err); }
  };

  const saveDriveCredentials = async () => {
    if (!driveCredentials.client_id || !driveCredentials.client_secret) {
      toast({ title: "Champs requis", variant: "destructive" });
      return;
    }
    setDriveCredentialsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/drive/credentials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driveCredentials), credentials: 'include'
      });
      if (res.ok) {
        toast({ title: "✅ Credentials sauvegardés" });
        setDriveCredentialsExist(true);
        setShowDriveCredentialsForm(false);
        loadDriveStatus();
      }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setDriveCredentialsLoading(false); }
  };

  const connectDrive = async () => {
    setDriveConnecting(true);
    try {
      const res = await fetch('http://localhost:5000/api/drive/auth-url', { credentials: 'include' });
      if (res.ok) window.location.href = (await res.json()).auth_url;
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setDriveConnecting(false); }
  };

  const disconnectDrive = async () => {
    setDriveConnecting(true);
    try {
      const res = await fetch('http://localhost:5000/api/drive/disconnect', { method: 'POST', credentials: 'include' });
      if (res.ok) { toast({ title: "✅ Déconnecté" }); loadDriveStatus(); }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setDriveConnecting(false); }
  };

  // ==================== SETTINGS FUNCTIONS ====================
  const loadSettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/settings');
      const data = await res.json();
      setPrompt(data.ai_prompt || DEFAULT_PROMPT);
      setCalendlyLink(data.calendly_link || "");
      if (data.calendly_token) setCalendlyToken(data.calendly_token);
      setBoondCredentials(prev => prev.map(cred => {
        if (cred.id === "boond_client_key") return { ...cred, value: data.boond_client_key || "" };
        if (cred.id === "boond_client_token") return { ...cred, value: data.boond_client_token || "" };
        if (cred.id === "boond_user_token") return { ...cred, value: data.boond_user_token || "" };
        if (cred.id === "boond_api_url") return { ...cred, value: data.boond_api_url || "https://ui.boondmanager.com/api" };
        return cred;
      }));
      setTempBoondClientKey(data.boond_client_key || "");
      setTempBoondClientToken(data.boond_client_token || "");
      setTempBoondUserToken(data.boond_user_token || "");
      setTempBoondApiUrl(data.boond_api_url || "https://ui.boondmanager.com/api");
    } catch (err) { console.error(err); }
  };

  const handleSavePrompt = async () => {
    setPromptLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_prompt: prompt })
      });
      if (res.ok) toast({ title: "✅ Prompt sauvegardé" });
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setPromptLoading(false); }
  };

  const handleCancelPrompt = () => { loadSettings(); toast({ title: "Modifications annulées" }); };

  const saveCalendlySettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendly_link: calendlyLink })
      });
      if (res.ok) toast({ title: "✅ Lien Calendly sauvegardé" });
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
  };

  // ==================== BOOND FUNCTIONS ====================
  const handleEditBoond = () => {
    setTempBoondClientKey(boondCredentials.find(c => c.id === "boond_client_key")?.value || "");
    setTempBoondClientToken(boondCredentials.find(c => c.id === "boond_client_token")?.value || "");
    setTempBoondUserToken(boondCredentials.find(c => c.id === "boond_user_token")?.value || "");
    setTempBoondApiUrl(boondCredentials.find(c => c.id === "boond_api_url")?.value || "");
    setEditingBoond(true);
  };

  const handleSaveEditBoond = async () => {
    setBoondSaving(true);
    try {
      const res = await fetch('http://localhost:5000/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boond_client_key: tempBoondClientKey,
          boond_client_token: tempBoondClientToken,
          boond_user_token: tempBoondUserToken,
          boond_api_url: tempBoondApiUrl
        }), credentials: 'include'
      });
      if (res.ok) {
        toast({ title: "✅ Identifiants sauvegardés" });
        setEditingBoond(false);
        await loadSettings();
      }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setBoondSaving(false); }
  };

  const testBoondConnection = async () => {
    setBoondTesting(true);
    try {
      const res = await fetch('http://localhost:5000/api/test-boond-connection', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) toast({ title: "✅ Connexion réussie" });
      else toast({ title: "❌ Échec", variant: "destructive" });
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setBoondTesting(false); }
  };

  const handleCancelEditBoond = () => setEditingBoond(false);
  const toggleShowBoondValue = (id: string) => setShowBoondValues(prev => ({ ...prev, [id]: !prev[id] }));

  // ==================== LINKEDIN ACCOUNTS ====================
  const loadLinkedInAccounts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/linkedin/accounts');
      setLinkedinAccounts(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleAddLinkedIn = async () => {
    if (!newAccountName.trim() && !newAccountEmail.trim()) {
      toast({
        title: "Erreur de validation",
        description: "Le Nom\\Prenom et l'adresse email sont requis.",
        variant: "destructive"
      });
      return;
    }
    if (!newAccountName.trim()) {
      toast({
        title: "Erreur de validation",
        description: "Le Nom\\Prenom est requis.",
        variant: "destructive"
      });
      return;
    }
    if (!newAccountEmail.trim()) {
      toast({
        title: "Erreur de validation",
        description: "L'adresse email est requise.",
        variant: "destructive"
      });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAccountEmail)) {
      toast({
        title: "Format invalide",
        description: "Format requis : nom@domaine.com (ex: exemple@domaine.com). L'email doit contenir '@', un domaine valide et aucun espace.",
        variant: "destructive"
      });
      return;
    }

    setLinkedinLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/linkedin/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAccountName, email: newAccountEmail || null, access_token: null, notify_by_email: newAccountNotifyEmail })
      });
      if (res.ok) {
        toast({ title: "✅ Compte ajouté" });
        setNewAccountName(""); setNewAccountEmail(""); setNewAccountNotifyEmail(true);
        loadLinkedInAccounts();
      }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setLinkedinLoading(false); }
  };

  const handleCancelAddLinkedIn = () => {
    setNewAccountName("");
    setNewAccountEmail("");
    setNewAccountNotifyEmail(true);
  };
  const handleEditLinkedIn = (account: LinkedInAccount) => {
    setEditingAccount(account.id); setEditName(account.name); setEditEmail(account.email || "");
    setEditToken(account.access_token); setEditNotifyEmail(account.notify_by_email || false); setShowEditToken(false);
  };
  const handleCancelEditLinkedIn = () => {
    setEditingAccount(null);
  };
  const handleSaveEditLinkedIn = async (id: number) => {
    if (!editName.trim() && !editEmail.trim()) {
      toast({
        title: "Erreur de validation",
        description: "Le Nom\\Prenom et l'adresse email sont requis.",
        variant: "destructive"
      });
      return;
    }
    if (!editName.trim()) {
      toast({
        title: "Erreur de validation",
        description: "Le Nom\\Prenom est requis.",
        variant: "destructive"
      });
      return;
    }
    if (!editEmail.trim()) {
      toast({
        title: "Erreur de validation",
        description: "L'adresse email est requise.",
        variant: "destructive"
      });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail)) {
      toast({
        title: "Format invalide",
        description: "Format requis : nom@domaine.com (ex: exemple@domaine.com). L'email doit contenir '@', un domaine valide et aucun espace.",
        variant: "destructive"
      });
      return;
    }

    setLinkedinLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/linkedin/accounts/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail || null, access_token: editToken === "None" ? null : editToken, notify_by_email: editNotifyEmail })
      });
      if (res.ok) {
        toast({ title: "✅ Compte modifié" });
        setEditingAccount(null);
        loadLinkedInAccounts();
      }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setLinkedinLoading(false); }
  };
  const handleDeleteLinkedIn = async (id: number, name: string) => {
    const result = await Swal.fire({ title: "Supprimer ?", text: `Supprimer "${name}" ?`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Oui" });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`http://localhost:5000/api/linkedin/accounts/${id}`, { method: 'DELETE' });
        if (res.ok) { toast({ title: "✅ Supprimé" }); loadLinkedInAccounts(); }
      } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    }
  };

  // ==================== CONTACTS ====================
  const loadContacts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/contacts', { credentials: 'include' });
      const data = await res.json();
      setContacts(data);
      await loadAllContactsOAuthStatus(data);
    } catch (err) { console.error(err); }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactEmail.trim()) {
      toast({ title: "Champs requis", description: "Le Nom\\Prenom et l'adresse email sont requis.", variant: "destructive" });
      return;
    }

    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/;
    if (!nameRegex.test(newContactName.trim())) {
      toast({
        title: "Format invalide",
        description: "Le Nom\\Prenom ne doit contenir que des lettres, des espaces ou des tirets.",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newContactEmail.trim())) {
      toast({
        title: "Format invalide",
        description: "Veuillez entrer une adresse email valide (ex: exemple@domaine.com).",
        variant: "destructive"
      });
      return;
    }

    setContactsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: newContactName, email: newContactEmail, is_active: newContactActive })
      });
      if (res.ok) {
        toast({ title: "✅ Contact ajouté" });
        setNewContactName(""); setNewContactEmail(""); setNewContactActive(true);
        loadContacts();
      } else {
        const data = await res.json();
        toast({ title: "❌ Erreur", description: data.error || "Impossible d'ajouter le contact.", variant: "destructive" });
      }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setContactsLoading(false); }
  };
  const handleCancelAddContact = () => { setNewContactName(""); setNewContactEmail(""); setNewContactActive(true); };
  const handleEditContact = (contact: Contact) => { setEditingContact(contact.id_contact); setEditContactName(contact.name); setEditContactEmail(contact.email); setEditContactActive(contact.is_active); };
  const handleCancelEditContact = () => { setEditingContact(null); };
  const handleSaveEditContact = async (id_contact: number) => {
    if (!editContactName.trim() || !editContactEmail.trim()) {
      toast({ title: "Champs requis", description: "Le Nom\\Prenom et l'adresse email sont requis.", variant: "destructive" });
      return;
    }

    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/;
    if (!nameRegex.test(editContactName.trim())) {
      toast({
        title: "Format invalide",
        description: "Le Nom\\Prenom ne doit contenir que des lettres, des espaces ou des tirets.",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editContactEmail.trim())) {
      toast({
        title: "Format invalide",
        description: "Veuillez entrer une adresse email valide (ex: exemple@domaine.com).",
        variant: "destructive"
      });
      return;
    }

    setContactsLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/contacts/${id_contact}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: editContactName, email: editContactEmail, is_active: editContactActive })
      });
      if (res.ok) {
        toast({ title: "✅ Contact modifié" });
        setEditingContact(null);
        loadContacts();
      } else {
        const data = await res.json();
        toast({ title: "❌ Erreur", description: data.error || "Impossible de modifier le contact.", variant: "destructive" });
      }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setContactsLoading(false); }
  };
  const handleDeleteContact = async (id_contact: number, name: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/contacts/${id_contact}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast({ title: "✅ Contact supprimé" }); loadContacts(); }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
  };

  // ==================== PERMISSIONS ====================
  const loadPermissions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/permissions', { credentials: 'include' });
      if (res.ok) setPermissions(await res.json());
    } catch (err) { console.error(err); }
  };
  const savePermissions = async () => {
    setPermissionsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissions), credentials: 'include'
      });
      if (res.ok) {
        toast({ title: "✅ Droits sauvegardés" });
        await reloadPermissions();
      }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setPermissionsLoading(false); }
  };

  // ==================== USERS ====================
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/admin/users', { credentials: 'include' });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
    finally { setUsersLoading(false); }
  };
  const loadOrganizations = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/admin/organizations', { credentials: 'include' });
      if (res.ok) setOrganizations(await res.json());
    } catch (err) { console.error(err); }
  };
  const deleteOrganization = async (orgId: number, name: string) => {
    const result = await Swal.fire({ title: "Supprimer ?", text: `Supprimer ${name} ?`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Oui" });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`http://localhost:5000/api/auth/admin/organizations/${orgId}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { toast({ title: "✅ Supprimée" }); loadOrganizations(); }
      } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    }
  };
  const openEditOrgDialog = (org: any) => {
    setEditingOrg(org);
    setEditOrgForm({
      name: org.name || '',
      email: org.email || '',
      sector: org.sector || '',
      website: org.website || '',
      phone: org.phone || '',
      address: org.address || '',
    });
    setShowEditOrgDialog(true);
  };
  const updateOrganization = async () => {
    if (!editingOrg) return;
    setEditOrgLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/auth/admin/organizations/${editingOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editOrgForm),
        credentials: 'include'
      });
      if (res.ok) {
        toast({ title: '✅ Entreprise modifiée' });
        loadOrganizations();
        setShowEditOrgDialog(false);
      } else {
        const data = await res.json();
        toast({ title: '❌ Erreur', description: data.error || 'Erreur inconnue', variant: 'destructive' });
      }
    } catch {
      toast({ title: '❌ Erreur', variant: 'destructive' });
    } finally {
      setEditOrgLoading(false);
    }
  };
  const createUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast({ title: "Champs requis", description: "L'adresse email et le mot de passe sont requis.", variant: "destructive" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      toast({
        title: "Format invalide",
        description: "L'adresse email doit respecter le format requis (ex: exemple@domaine.com).",
        variant: "destructive"
      });
      return;
    }

    if (newUserPassword.length < 6) {
      toast({
        title: "Mot de passe court",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive"
      });
      return;
    }

    if (user?.role === 'super_admin' && !newUserOrgId && (newUserRole === 'manager' || newUserRole === 'commercial')) {
      toast({
        title: "Champ requis",
        description: newUserRole === 'manager' ? "L'entreprise est obligatoire pour un manager." : "L'entreprise est obligatoire pour un commercial.",
        variant: "destructive"
      });
      return;
    }

    setAddingUser(true);
    try {
      const body: any = { email: newUserEmail, password: newUserPassword, first_name: newUserFirstName, last_name: newUserLastName, role: newUserRole };
      if (user?.role === 'super_admin' && newUserOrgId) { body.organization_id = newUserOrgId; }
      const res = await fetch('http://localhost:5000/api/auth/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include'
      });
      if (res.ok) {
        toast({ title: "✅ Compte créé avec succès" });
        setShowAddUser(false);
        setNewUserFirstName('');
        setNewUserLastName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserOrgId(null);
        loadUsers();
      } else {
        const data = await res.json();
        toast({
          title: "❌ Erreur de création",
          description: data.error || "Impossible de créer le compte.",
          variant: "destructive"
        });
      }
    } catch {
      toast({ title: "❌ Erreur", description: "Erreur de connexion au serveur.", variant: "destructive" });
    }
    finally { setAddingUser(false); }
  };
  const updateUser = async (userId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/auth/admin/users/${userId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editUserRole, first_name: editUserFirstName, last_name: editUserLastName, email: editUserEmail, organization_id: editUserOrgId }), credentials: 'include'
      });
      if (res.ok) { toast({ title: "✅ Utilisateur modifié" }); loadUsers(); }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setEditingUserId(null); }
  };
  const startEditingUser = (u: any) => { setEditingUserId(u.id); setEditUserRole(u.role); setEditUserFirstName(u.first_name || ''); setEditUserLastName(u.last_name || ''); setEditUserEmail(u.email || ''); setEditUserOrgId(u.organization_id || null); };
  const deleteUser = async (userId: number, userEmail: string) => {
    const result = await Swal.fire({ title: "Supprimer ?", text: `Supprimer ${userEmail} ?`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Oui" });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`http://localhost:5000/api/auth/admin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { toast({ title: "✅ Utilisateur supprimé" }); loadUsers(); }
      } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    }
  };

  // ==================== LINKEDIN APP SETTINGS ====================
  const loadLinkedinSettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/linkedin-settings', { credentials: 'include' });
      if (res.ok) setLinkedinSettings(await res.json());
    } catch (err) { console.error(err); }
  };
  const saveLinkedinSettings = async () => {
    setLinkedinSettingsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/linkedin-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(linkedinSettings), credentials: 'include'
      });
      if (res.ok) toast({ title: "✅ Paramètres LinkedIn sauvegardés" });
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setLinkedinSettingsLoading(false); }
  };

  // ==================== EMAIL SETTINGS ====================
  const loadEmailSettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/email-settings', { credentials: 'include' });
      if (res.ok) setEmailSettings(await res.json());
    } catch (err) { console.error(err); }
  };
  const saveEmailSettings = async () => {
    setEmailSettingsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/email-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailSettings), credentials: 'include'
      });
      if (res.ok) toast({ title: "✅ Paramètres email sauvegardés" });
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setEmailSettingsLoading(false); }
  };

  // ==================== APIFY SETTINGS ====================
  const loadApifySettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/apify-settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setApifySettings({
          apify_api_token: data.apify_api_token || '',
          apify_actor_id: data.apify_actor_id || 'scraping_solutions/linkedin-posts-engagers-likers-and-commenters-no-cookies',
          apify_webhook_url: data.apify_webhook_url || '',
          linkedin_li_at_cookie: data.linkedin_li_at_cookie || ''
        });
      }
    } catch (err) { console.error(err); }
  };
  const saveApifySettings = async () => {
    setApifyLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/apify-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apifySettings), credentials: 'include'
      });
      if (res.ok) { toast({ title: "✅ Configuration Apify sauvegardée" }); loadApifySettings(); }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setApifyLoading(false); }
  };

  // ==================== GOOGLE FORM SETTINGS ====================
  const loadGoogleFormSettings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/google-form-settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGoogleFormSettings({
          google_form_url: data.google_form_url || '',
          google_form_sheet_id: data.google_form_sheet_id || '',
        });
      }
    } catch (err) { console.error(err); }
  };
  const saveGoogleFormSettings = async () => {
    setGoogleFormLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/google-form-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(googleFormSettings), credentials: 'include'
      });
      if (res.ok) toast({ title: "✅ Configuration Google Form sauvegardée" });
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setGoogleFormLoading(false); }
  };


  // ==================== TEMPLATES EMAIL ====================
  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/email-templates', { credentials: 'include' });
      if (res.ok) setTemplates(await res.json());
    } catch (err) { console.error(err); }
    finally { setTemplatesLoading(false); }
  };
  const saveTemplate = async () => {
    if (!templateForm.name_template || !templateForm.subject || !templateForm.body) {
      toast({ title: "Erreur", description: "Nom, sujet et corps requis", variant: "destructive" });
      return;
    }
    setTemplatesLoading(true);
    try {
      const url = currentTemplate ? `http://localhost:5000/api/email-templates/${currentTemplate.id_template}` : "http://localhost:5000/api/email-templates";
      const method = currentTemplate ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templateForm), credentials: 'include' });
      if (res.ok) { toast({ title: "✅ Succès" }); loadTemplates(); setShowTemplateDialog(false); resetTemplateForm(); }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setTemplatesLoading(false); }
  };
  const deleteTemplate = async (id: number, name: string) => {
    const result = await Swal.fire({ title: "Supprimer ?", text: `Supprimer "${name}" ?`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Oui" });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`http://localhost:5000/api/email-templates/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { toast({ title: "✅ Supprimé" }); loadTemplates(); }
      } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    }
  };
  const previewTemplate = async () => {
    if (!templateForm.subject || !templateForm.body) { toast({ title: "Erreur", description: "Sujet et corps requis", variant: "destructive" }); return; }
    setTemplatesLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/email-templates/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: templateForm.subject, body: templateForm.body }), credentials: 'include'
      });
      if (res.ok) { setPreviewData(await res.json()); setShowPreview(true); }
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setTemplatesLoading(false); }
  };
  const resetTemplateForm = () => { setTemplateForm({ name_template: "", subject: "", body: "", description: "", is_active: true }); setCurrentTemplate(null); setActiveField("body"); setPreviewData(null); };
  const openTemplateDialog = (template?: EmailTemplate) => {
    if (template) { setCurrentTemplate(template); setTemplateForm({ name_template: template.name_template, subject: template.subject, body: template.body, description: template.description || "", is_active: template.is_active }); }
    else resetTemplateForm();
    setShowTemplateDialog(true);
  };
  const insertVariable = (variable: string) => {
    if (activeField === "subject") setTemplateForm(prev => ({ ...prev, subject: prev.subject + variable }));
    else setTemplateForm(prev => ({ ...prev, body: prev.body + variable }));
    toast({ title: "✅ Variable ajoutée" });
  };

  // ==================== PROFILS RECHERCHÉS ====================
  const loadProfiles = async () => {
    setProfilesLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/searched-profiles', { credentials: 'include' });
      if (res.ok) setProfiles(await res.json());
    } catch (err) { console.error(err); }
    finally { setProfilesLoading(false); }
  };
  const saveProfile = async () => {
    if (!profileForm.name) { toast({ title: "Erreur", description: "Nom requis", variant: "destructive" }); return; }
    setProfilesLoading(true);
    try {
      const payload = {
        name: profileForm.name, description: profileForm.description,
        skills: profileForm.skills.split(",").map(s => s.trim()).filter(s => s),
        min_experience: parseInt(profileForm.min_experience.toString()),
        max_experience: profileForm.max_experience ? parseInt(profileForm.max_experience.toString()) : null,
        countries: profileForm.countries.split(",").map(c => c.trim()).filter(c => c),
        is_foreign_allowed: profileForm.is_foreign_allowed,
        contract_types: profileForm.contract_types.split(",").map(c => c.trim()).filter(c => c),
        languages: [],
      };
      const url = currentProfile ? `http://localhost:5000/api/searched-profiles/${currentProfile.id}` : "http://localhost:5000/api/searched-profiles";
      const method = currentProfile ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
      if (res.ok) { toast({ title: "✅ Succès" }); loadProfiles(); setShowProfileDialog(false); resetProfileForm(); }
    } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    finally { setProfilesLoading(false); }
  };
  const deleteProfile = async (id: number, name: string) => {
    const result = await Swal.fire({ title: "Supprimer ?", text: `Supprimer "${name}" ?`, icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Oui" });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`http://localhost:5000/api/searched-profiles/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { toast({ title: "✅ Supprimé" }); loadProfiles(); }
      } catch { toast({ title: "❌ Erreur", variant: "destructive" }); }
    }
  };
  const matchProfile = async (profile: SearchedProfile) => {
    setMatchingProfile(profile); setMatchingLoading(true); setShowMatchDialog(true);
    try {
      const res = await fetch(`http://localhost:5000/api/searched-profiles/${profile.id}/match`, { credentials: 'include' });
      if (res.ok) setMatchResults((await res.json()).matches || []);
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
    finally { setMatchingLoading(false); }
  };
  const resetProfileForm = () => {
    setProfileForm({ name: "", description: "", skills: "", min_experience: 0, max_experience: "", countries: "", is_foreign_allowed: true, contract_types: "", languages: "" });
    setCurrentProfile(null);
  };
  const openProfileDialog = (profile?: SearchedProfile) => {
    if (profile) {
      setCurrentProfile(profile);
      setProfileForm({
        name: profile.name, description: profile.description || "", skills: profile.skills.join(", "),
        min_experience: profile.min_experience, max_experience: profile.max_experience?.toString() || "",
        countries: profile.countries.join(", "), is_foreign_allowed: profile.is_foreign_allowed,
        contract_types: profile.contract_types.join(", "), languages: "",
      });
    } else resetProfileForm();
    setShowProfileDialog(true);
  };
  const viewCV = (driveLink: string) => { if (driveLink) window.open(driveLink, '_blank'); };
  const getScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> {score}% Match</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-100 text-yellow-700"><AlertCircle className="h-3 w-3 mr-1" /> {score}% À examiner</Badge>;
    return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" /> {score}% Non match</Badge>;
  };

  // ==================== RENDER PERMISSIONS SECTION ====================
  const renderPermissionsSection = () => {
    if (user?.role === 'super_admin') {
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3 bg-blue-100 inline-block px-3 py-1 rounded-full text-blue-700">Rôle: Manager</h3>
            <div className="grid grid-cols-2 gap-4 mt-3 max-w-4xl">
              {Object.entries(permissions.manager || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm capitalize">{key.replace('-', ' ')}</span>
                  <Switch checked={value} onCheckedChange={(checked) => setPermissions({ ...permissions, manager: { ...permissions.manager, [key]: checked } })} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-3 bg-gray-100 inline-block px-3 py-1 rounded-full text-gray-700">Rôle: Commercial</h3>
            <div className="grid grid-cols-2 gap-4 mt-3 max-w-4xl">
              {Object.entries(permissions.commercial || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm capitalize">{key.replace('-', ' ')}</span>
                  <Switch checked={value} onCheckedChange={(checked) => setPermissions({ ...permissions, commercial: { ...permissions.commercial, [key]: checked } })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3 bg-gray-100 inline-block px-3 py-1 rounded-full text-gray-700">Rôle: Commercial</h3>
          <div className="grid grid-cols-2 gap-4 mt-3 max-w-4xl">
            {Object.entries(permissions.commercial || {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm capitalize">{key.replace('-', ' ')}</span>
                <Switch checked={value} onCheckedChange={(checked) => setPermissions({ ...permissions, commercial: { ...permissions.commercial, [key]: checked } })} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ==================== RENDERING ====================
  if (!hasAccess('configuration')) {
    return (
      <DashboardLayout title="Configuration">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Accès restreint</h2>
              <p className="text-gray-600 mb-4">Vous n'avez pas les droits pour accéder à cette page.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Configuration">
      <div className="space-y-6 max-w-6xl mx-auto pb-8">
        <Tabs defaultValue="prompt" className="w-full">
          {/* MENU PRINCIPAL */}
          <TabsList className="w-full flex flex-wrap justify-start gap-2 bg-slate-100/80 p-2 rounded-lg border border-slate-200 shadow-sm mb-6 h-auto">
            <TabsTrigger value="prompt" className="text-sm md:text-base px-4 py-2 rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all whitespace-nowrap font-medium">
              🤖 IA
            </TabsTrigger>
            <TabsTrigger value="integrations" className="text-sm md:text-base px-4 py-2 rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all whitespace-nowrap font-medium">
              🔌 Intégrations
            </TabsTrigger>
            <TabsTrigger value="communication" className="text-sm md:text-base px-4 py-2 rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all whitespace-nowrap font-medium">
              📧 Communication
            </TabsTrigger>
            <TabsTrigger value="team" className="text-sm md:text-base px-4 py-2 rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all whitespace-nowrap font-medium">
              👥 Équipe
            </TabsTrigger>
            <TabsTrigger value="recruitment" className="text-sm md:text-base px-4 py-2 rounded-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary transition-all whitespace-nowrap font-medium">
              🎯 Recrutement
            </TabsTrigger>
          </TabsList>

          {/* ==================== CATÉGORIE 1: IA ==================== */}
          <TabsContent value="prompt" className="mt-0">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/80 px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-md text-slate-800">Prompt AI</CardTitle>
                    <CardDescription className="text-xs mt-0 text-slate-500">
                      Configurez le prompt système pour la génération de contenu LinkedIn.
                    </CardDescription>
                  </div>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="space-y-4 max-w-4xl">
                  <div className="space-y-2">
                    <Label htmlFor="ai-prompt" className="text-sm font-semibold text-slate-700">Prompt système</Label>
                    <Textarea
                      id="ai-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Entrez votre prompt..."
                      className="min-h-[200px] font-mono text-sm leading-relaxed p-3 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleSavePrompt} disabled={promptLoading} className="bg-primary hover:bg-primary/90 text-sm px-5 h-9 rounded-md shadow-sm">
                      <Save className="h-4 w-4 mr-2" />
                      {promptLoading ? "Sauvegarde..." : "Sauvegarder"}
                    </Button>
                    <Button variant="outline" onClick={handleCancelPrompt} disabled={promptLoading} className="text-sm px-5 h-9 rounded-md border-slate-200 text-slate-600 hover:bg-slate-50">
                      <X className="h-4 w-4 mr-2" />
                      Annuler
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CATÉGORIE 2: INTÉGRATIONS ==================== */}
          <TabsContent value="integrations" className="mt-0">
            <Tabs defaultValue="linkedin" className="w-full">
              <TabsList className="w-full flex flex-wrap gap-2 bg-slate-100/80 p-2 rounded-lg mb-4">
                <TabsTrigger value="linkedin" className="text-sm px-4 py-1.5 rounded-md">Comptes LinkedIn</TabsTrigger>
                <TabsTrigger value="drive" className="text-sm px-4 py-1.5 rounded-md">Google Drive</TabsTrigger>
                <TabsTrigger value="boond" className="text-sm px-4 py-1.5 rounded-md">Coordonnées Boond</TabsTrigger>
                <TabsTrigger value="linkedin-app" className="text-sm px-4 py-1.5 rounded-md">App LinkedIn</TabsTrigger>
                <TabsTrigger value="email" className="text-sm px-4 py-1.5 rounded-md">Email</TabsTrigger>
                <TabsTrigger value="gmail" className="text-sm px-4 py-1.5 rounded-md">Gmail OAuth</TabsTrigger>
                <TabsTrigger value="apify" className="text-sm px-4 py-1.5 rounded-md">Apify</TabsTrigger>
                <TabsTrigger value="google-form" className="text-sm px-4 py-1.5 rounded-md">Google Form</TabsTrigger>
                <TabsTrigger value="calendly" className="text-sm px-4 py-1.5 rounded-md">Calendly</TabsTrigger>
              </TabsList>

              {/* Comptes LinkedIn */}
              <TabsContent value="linkedin" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Linkedin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Comptes LinkedIn</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Gérez les comptes LinkedIn utilisés pour la diffusion.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    {linkedinAccounts.length > 0 ? (
                      <div className="border rounded-lg overflow-x-auto">
                        <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 gap-2 font-medium text-sm min-w-[700px]">
                          <div className="col-span-3">Nom\Prenom</div>
                          <div className="col-span-4">Email</div>
                          <div className="col-span-2 text-center">Statut</div>
                          <div className="col-span-1 text-center">Notifs</div>
                          <div className="col-span-2 text-center">Actions</div>
                        </div>
                        {linkedinAccounts.map((account) => (
                          <div key={account.id} className="px-4 py-2 border-b last:border-b-0 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 min-w-[700px]">
                            {editingAccount === account.id ? (
                              <>
                                <div className="col-span-3">
                                  <Input placeholder="Nom\Prenom" value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="col-span-4">
                                  <Input placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="col-span-2 text-center"><span className="text-sm text-gray-400">—</span></div>
                                <div className="col-span-1 text-center flex justify-center"><Checkbox checked={editNotifyEmail} onCheckedChange={(checked) => setEditNotifyEmail(checked === true)} /></div>
                                <div className="col-span-2 text-center flex justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleSaveEditLinkedIn(account.id)}><Check className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={handleCancelEditLinkedIn}><X className="h-4 w-4" /></Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="col-span-3 text-sm font-medium truncate">{account.name}</div>
                                <div className="col-span-4 text-sm truncate">{account.email || "—"}</div>
                                <div className="col-span-2 text-center">{account.access_token ? <span className="text-green-600 text-xs">✅ Connecté</span> : <span className="text-red-600 text-xs">❌ Non connecté</span>}</div>
                                <div className="col-span-1 text-center flex justify-center">{account.notify_by_email ? <Mail className="h-4 w-4 text-green-500" /> : <Mail className="h-4 w-4 text-gray-400" />}</div>
                                <div className="col-span-2 text-center flex justify-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditLinkedIn(account)}><Edit className="h-4 w-4 text-blue-600" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteLinkedIn(account.id, account.name)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-gray-50">Aucun compte LinkedIn configuré.</p>
                    )}
                    <div className="border rounded-lg p-4 bg-muted/30 space-y-4 max-w-3xl">
                      <h4 className="text-sm font-semibold">Ajouter un compte</h4>
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-4">
                          <Input placeholder="Nom\Prenom" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="col-span-4">
                          <Input placeholder="Email" value={newAccountEmail} onChange={(e) => setNewAccountEmail(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div className="col-span-2 flex items-center gap-2 pt-2"><Checkbox checked={newAccountNotifyEmail} onCheckedChange={(checked) => setNewAccountNotifyEmail(checked === true)} /> <span>Email</span></div>
                      </div>
                      <div className="flex gap-3"><Button onClick={handleAddLinkedIn} disabled={linkedinLoading} className="bg-primary">Ajouter</Button><Button variant="outline" onClick={handleCancelAddLinkedIn}>Annuler</Button></div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Google Drive */}
              <TabsContent value="drive" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <HardDrive className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Google Drive</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Gérez les identifiants et la connexion à Google Drive.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className="border rounded-lg p-4 max-w-md">
                      <h4 className="text-sm font-semibold mb-3">Identifiants de l'application</h4>
                      {driveCredentialsExist && !showDriveCredentialsForm ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm"><span className="text-gray-500">Client ID:</span><span className="font-mono text-sm">{driveCredentials.client_id.substring(0, 35)}...</span></div>
                          <Button variant="outline" onClick={() => setShowDriveCredentialsForm(true)}><Edit className="h-4 w-4 mr-2" /> Modifier</Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Input placeholder="Client ID" value={driveCredentials.client_id} onChange={(e) => setDriveCredentials({ ...driveCredentials, client_id: e.target.value })} />
                          <div className="relative"><Input type={showDriveSecret ? "text" : "password"} placeholder="Client Secret" value={driveCredentials.client_secret} onChange={(e) => setDriveCredentials({ ...driveCredentials, client_secret: e.target.value })} /><button onClick={() => setShowDriveSecret(!showDriveSecret)} className="absolute right-2 top-2">{showDriveSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                          <div className="flex gap-3"><Button onClick={saveDriveCredentials} disabled={driveCredentialsLoading} className="bg-blue-600">Sauvegarder</Button>{showDriveCredentialsForm && driveCredentialsExist && <Button variant="outline" onClick={() => setShowDriveCredentialsForm(false)}>Annuler</Button>}</div>
                        </div>
                      )}
                    </div>
                    <div className="border rounded-lg p-4 max-w-md">
                      <h4 className="text-sm font-semibold mb-3">Connexion à Google Drive</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Statut :</span>{driveStatus.connected ? <span className="text-green-600 text-sm font-medium">✅ Connecté</span> : <span className="text-red-600 text-sm font-medium">❌ Non connecté</span>}</div>
                        {driveStatus.connected && driveStatus.email && <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Compte utilisé :</span><span className="text-sm text-gray-500 truncate max-w-[200px]">{driveStatus.email}</span></div>}
                        {driveCredentialsExist && !driveStatus.connected && <Button onClick={connectDrive} disabled={driveConnecting} className="w-full bg-blue-600">Se connecter</Button>}
                        {driveStatus.connected && <Button variant="outline" onClick={disconnectDrive} className="w-full text-red-600">Déconnecter</Button>}
                        {!driveCredentialsExist && <p className="text-xs text-amber-600 text-center">⚠️ Veuillez d'abord configurer les identifiants ci-dessus.</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Coordonnées Boond */}
              <TabsContent value="boond" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Key className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Coordonnées Boond</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Identifiants de connexion à l'API Boond Manager.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className="border rounded-lg overflow-x-auto max-w-4xl">
                      {boondCredentials.map((cred) => (
                        <div key={cred.id} className="px-4 py-2 border-b flex justify-between items-center">
                          <span className="text-sm font-medium">{cred.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono">{cred.isSecret ? (showBoondValues[cred.id] ? cred.value : "••••••••") : cred.value}</span>
                            {cred.isSecret && <button onClick={() => toggleShowBoondValue(cred.id)}>{showBoondValues[cred.id] ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleEditBoond} className="bg-primary">Modifier les identifiants</Button>
                    {editingBoond && (
                      <div className="border rounded-lg p-4 bg-muted/30 mt-3 max-w-2xl">
                        <h4 className="text-sm font-semibold mb-3">Modifier les identifiants Boond</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="Client Key" value={tempBoondClientKey} onChange={(e) => setTempBoondClientKey(e.target.value)} />
                          <Input placeholder="Client Token" value={tempBoondClientToken} onChange={(e) => setTempBoondClientToken(e.target.value)} />
                          <Input placeholder="User Token" value={tempBoondUserToken} onChange={(e) => setTempBoondUserToken(e.target.value)} />
                          <Input placeholder="API URL" value={tempBoondApiUrl} onChange={(e) => setTempBoondApiUrl(e.target.value)} />
                        </div>
                        <div className="flex gap-3 mt-4"><Button onClick={handleSaveEditBoond} disabled={boondSaving} className="bg-primary">Sauvegarder</Button><Button onClick={testBoondConnection} disabled={boondTesting} variant="outline">Tester</Button><Button onClick={handleCancelEditBoond} variant="outline">Annuler</Button></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* App LinkedIn */}
              <TabsContent value="linkedin-app" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Linkedin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Application LinkedIn</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Identifiants de l'application LinkedIn (Client ID / Secret).
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-2 max-w-md"><Input placeholder="Client ID" value={linkedinSettings.client_id} onChange={(e) => setLinkedinSettings({ ...linkedinSettings, client_id: e.target.value })} /></div>
                    <div className="space-y-2 max-w-md"><div className="relative"><Input type={showLinkedinSecret ? "text" : "password"} placeholder="Client Secret" value={linkedinSettings.client_secret} onChange={(e) => setLinkedinSettings({ ...linkedinSettings, client_secret: e.target.value })} /><button onClick={() => setShowLinkedinSecret(!showLinkedinSecret)} className="absolute right-2 top-2">{showLinkedinSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
                    <Button onClick={saveLinkedinSettings} disabled={linkedinSettingsLoading} className="bg-primary">Sauvegarder</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Email Settings */}
              <TabsContent value="email" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Configuration Email</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Paramètres SMTP pour l'envoi de notifications.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-2 max-w-md"><Input placeholder="Serveur SMTP" value={emailSettings.server} onChange={(e) => setEmailSettings({ ...emailSettings, server: e.target.value })} /></div>
                    <div className="space-y-2 max-w-md"><Input type="number" placeholder="Port" value={emailSettings.port} onChange={(e) => setEmailSettings({ ...emailSettings, port: parseInt(e.target.value) || 587 })} /></div>
                    <div className="flex items-center gap-2"><Switch checked={emailSettings.use_tls} onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, use_tls: checked })} /> <span>Utiliser TLS</span></div>
                    <div className="space-y-2 max-w-md"><Input placeholder="Nom d'utilisateur" value={emailSettings.username} onChange={(e) => setEmailSettings({ ...emailSettings, username: e.target.value })} /></div>
                    <div className="space-y-2 max-w-md"><div className="relative"><Input type={showEmailPassword ? "text" : "password"} placeholder="Mot de passe" value={emailSettings.password} onChange={(e) => setEmailSettings({ ...emailSettings, password: e.target.value })} /><button onClick={() => setShowEmailPassword(!showEmailPassword)} className="absolute right-2 top-2">{showEmailPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
                    <div className="space-y-2 max-w-md"><Input placeholder="Expéditeur par défaut" value={emailSettings.default_sender} onChange={(e) => setEmailSettings({ ...emailSettings, default_sender: e.target.value })} /></div>
                    <Button onClick={saveEmailSettings} disabled={emailSettingsLoading} className="bg-primary">Sauvegarder</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ==================== GMAIL OAUTH SETTINGS - NOUVEAU DESIGN ==================== */}
              <TabsContent value="gmail" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Application Gmail</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Identifiants de l'application Gmail OAuth .
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    {gmailSettingsExists && !isEditingGmail ? (
                      // Mode AFFICHAGE - Design IDENTIQUE à Google Drive
                      <div className="border rounded-lg p-4 max-w-md">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold">Identifiants de l'application</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={startEditGmail}
                            className="text-blue-600 h-7 px-2 text-xs"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Modifier
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Client ID:</span>
                            <span className="text-sm font-mono">{gmailSettings.client_id.substring(0, 35)}...</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">Redirect URI:</span>
                            <span className="text-sm text-gray-600">{gmailSettings.redirect_uri}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Mode ÉDITION - Design IDENTIQUE à LinkedIn App
                      <div className="border rounded-lg p-4 max-w-md">
                        <h4 className="text-sm font-semibold mb-3">Identifiants de l'application</h4>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-gray-500">Client ID</Label>
                            <Input
                              value={gmailSettings.client_id}
                              onChange={(e) => setGmailSettings({ ...gmailSettings, client_id: e.target.value })}
                              placeholder="Votre Google Client ID"
                              className="mt-1 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">
                              Client Secret
                              {gmailSettingsExists && <span className="text-gray-400 text-xs ml-2">(laissez vide pour conserver l'actuel)</span>}
                            </Label>
                            <div className="relative">
                              <Input
                                type={showGmailSecret ? "text" : "password"}
                                value={gmailSettings.client_secret}
                                onChange={(e) => setGmailSettings({ ...gmailSettings, client_secret: e.target.value })}
                                placeholder={gmailSettingsExists ? "••••••••••••••••••••••••••••••••••" : "Votre Google Client Secret"}
                                className="mt-1 pr-10 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => setShowGmailSecret(!showGmailSecret)}
                                className="absolute right-2 top-1/2 -translate-y-1/2"
                              >
                                {showGmailSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Redirect URI</Label>
                            <Input
                              value={gmailSettings.redirect_uri}
                              onChange={(e) => setGmailSettings({ ...gmailSettings, redirect_uri: e.target.value })}
                              placeholder="http://localhost:5000/api/gmail-auth/callback"
                              className="mt-1 text-sm"
                            />
                          </div>
                          <div className="flex gap-3 pt-2">
                            <Button onClick={saveGmailSettings} disabled={gmailSettingsLoading} className="bg-primary text-sm h-8">
                              <Save className="h-3.5 w-3.5 mr-1" /> Sauvegarder
                            </Button>
                            {gmailSettingsExists && (
                              <Button variant="outline" onClick={cancelEditGmail} className="text-sm h-8">
                                Annuler
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Apify Settings */}
              <TabsContent value="apify" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Key className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Configuration Apify</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Apify est utilisé pour récupérer les likes et commentaires de vos posts LinkedIn.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-2 max-w-md">
                      <Label className="text-xs text-gray-500">API Token</Label>
                      <div className="relative">
                        <Input
                          type={showApifyToken ? "text" : "password"}
                          placeholder="apify_api_xxxxxxxxxxxxxxxxxxxx"
                          value={apifySettings.apify_api_token}
                          onChange={e => setApifySettings(prev => ({ ...prev, apify_api_token: e.target.value }))}
                          className="pr-10 font-mono text-sm"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowApifyToken(v => !v)}>
                          {showApifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-w-md">
                      <Label className="text-xs text-gray-500">Actor ID</Label>
                      <Input
                        type="text"
                        value={apifySettings.apify_actor_id}
                        onChange={e => setApifySettings(prev => ({ ...prev, apify_actor_id: e.target.value }))}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2 max-w-md">
                      <Label className="text-xs text-gray-500 flex items-center gap-1.5">
                        🍪 Cookie LinkedIn <code className="bg-slate-100 px-1 rounded text-[11px]">li_at</code>
                        <span className="text-amber-500 text-[10px] font-medium ml-1">Requis pour récupérer les likes</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type={showLiAt ? "text" : "password"}
                          placeholder="AQEDATxxxxxx..."
                          value={apifySettings.linkedin_li_at_cookie}
                          onChange={e => setApifySettings(prev => ({ ...prev, linkedin_li_at_cookie: e.target.value }))}
                          className="pr-10 font-mono text-sm"
                        />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShowLiAt(v => !v)}>
                          {showLiAt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">F12 → Application → Cookies → linkedin.com → copier la valeur de <code>li_at</code></p>
                    </div>
                    <Button onClick={saveApifySettings} disabled={apifyLoading} className="bg-primary text-sm h-8">
                      {apifyLoading ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Sauvegarder
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Google Form Settings */}
              <TabsContent value="google-form" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Google Form (Candidature Spontanée)</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Configurez le lien du formulaire partagé sur LinkedIn.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-2 max-w-md">
                      <Label className="text-xs text-gray-500">URL du Google Form</Label>
                      <Input
                        type="url"
                        value={googleFormSettings.google_form_url}
                        onChange={e => setGoogleFormSettings(prev => ({ ...prev, google_form_url: e.target.value }))}
                        placeholder="https://docs.google.com/forms/d/e/.../viewform"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2 max-w-md">
                      <Label className="text-xs text-gray-500">Spreadsheet ID des réponses</Label>
                      <div className="relative">
                        <Input
                          type={showGoogleSheetId ? "text" : "password"}
                          value={googleFormSettings.google_form_sheet_id}
                          onChange={e => setGoogleFormSettings(prev => ({ ...prev, google_form_sheet_id: e.target.value }))}
                          placeholder="1BxiMVs0XRX5nZY..."
                          className="font-mono text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGoogleSheetId(!showGoogleSheetId)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showGoogleSheetId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button onClick={saveGoogleFormSettings} disabled={googleFormLoading} className="bg-primary text-sm h-8">
                      {googleFormLoading ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Sauvegarder
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Calendly Settings */}
              <TabsContent value="calendly" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Calendly</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Configurez votre lien d'agenda Calendly et votre token API.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-6 p-5">
                    <div className="space-y-2">
                      <Label htmlFor="calendly_link" className="text-xs text-slate-500">
                        URL de votre agenda Calendly
                      </Label>
                      <Input
                        id="calendly_link"
                        value={calendlyLink}
                        onChange={(e) => setCalendlyLink(e.target.value)}
                        placeholder="https://calendly.com/votre-lien"
                        className="h-9 text-sm border-slate-200 max-w-md"
                      />
                      <Button onClick={saveCalendlySettings} className="bg-primary text-sm h-8 mt-2">
                        <Save className="h-3.5 w-3.5 mr-1" /> Sauvegarder l'URL
                      </Button>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <Label htmlFor="calendly_token" className="text-xs text-slate-500 flex items-center gap-1">
                        Token API Calendly
                        <span className="text-amber-500 font-medium">(requis pour Sync auto)</span>
                      </Label>
                      <div className="flex gap-2 max-w-md">
                        <div className="relative flex-1">
                          <Input
                            id="calendly_token"
                            type={showCalendlyToken ? "text" : "password"}
                            value={calendlyToken}
                            onChange={(e) => { setCalendlyToken(e.target.value); setCalendlyTokenSaved(false); }}
                            placeholder="eyJ... (Personal Access Token Calendly)"
                            className="h-9 text-sm border-slate-200 w-full pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCalendlyToken(!showCalendlyToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showCalendlyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={!calendlyToken || calendlyTokenSaved}
                          onClick={async () => {
                            const res = await fetch('http://localhost:5000/api/calendly/token', {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ token: calendlyToken })
                            });
                            if (res.ok) setCalendlyTokenSaved(true);
                          }}
                          className="px-3 h-9 text-xs rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition whitespace-nowrap"
                        >
                          {calendlyTokenSaved ? '✅ Sauvegardé' : 'Sauvegarder le Token'}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">
                        Générez un token sur <a href="https://calendly.com/integrations/api_webhooks" target="_blank" className="text-indigo-500 underline">calendly.com/integrations/api_webhooks</a>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ==================== CATÉGORIE 3: COMMUNICATION ==================== */}
          <TabsContent value="communication" className="mt-0">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/80 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <MailIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-md text-slate-800">Templates Email</CardTitle>
                    <CardDescription className="text-xs mt-0 text-slate-500">
                      Créez, modifiez et gérez les templates d'emails.
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => openTemplateDialog()} className="bg-primary hover:bg-primary/90 text-sm px-3 h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau template
                </Button>
              </div>
              <CardContent className="p-5">
                {templatesLoading ? (
                  <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border rounded-lg">
                    <MailIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Aucun template. Créez votre premier template !</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 gap-2 font-medium text-sm min-w-[800px]">
                      <div className="col-span-3">Nom</div><div className="col-span-4">Sujet</div><div className="col-span-2">Description</div><div className="col-span-1 text-center">Statut</div><div className="col-span-2 text-center">Actions</div>
                    </div>
                    {templates.map((t) => (
                      <div key={t.id_template} className="px-4 py-2 border-b last:border-b-0 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 min-w-[800px]">
                        <div className="col-span-3 text-sm font-medium truncate">{t.name_template}</div>
                        <div className="col-span-4 text-sm text-gray-600 truncate">{t.subject}</div>
                        <div className="col-span-2 text-sm text-gray-400 truncate">{t.description || "—"}</div>
                        <div className="col-span-1 text-center">{t.is_active ? <Badge className="bg-green-100 text-green-700">Actif</Badge> : <Badge className="bg-gray-100 text-gray-500">Inactif</Badge>}</div>
                        <div className="col-span-2 text-center flex justify-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={() => openTemplateDialog(t)}><Edit className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteTemplate(t.id_template, t.name_template)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CATÉGORIE 4: ÉQUIPE ==================== */}
          <TabsContent value="team" className="mt-0">
            <Tabs defaultValue="contacts" className="w-full">
              <TabsList className="w-full flex flex-wrap gap-2 bg-slate-100/80 p-2 rounded-lg mb-4">
                <TabsTrigger value="contacts" className="text-sm px-4 py-1.5 rounded-md">Contacts</TabsTrigger>
                {(user?.role === 'super_admin' || user?.role === 'manager') && (
                  <TabsTrigger value="permissions" className="text-sm px-4 py-1.5 rounded-md">Gestion des droits</TabsTrigger>
                )}
                {user?.role === 'super_admin' && (
                  <TabsTrigger value="managers" className="text-sm px-4 py-1.5 rounded-md">Managers</TabsTrigger>
                )}
                <TabsTrigger value="commercials" className="text-sm px-4 py-1.5 rounded-md">Commerciaux</TabsTrigger>
                {user?.role === 'super_admin' && <TabsTrigger value="entreprises" className="text-sm px-4 py-1.5 rounded-md">Entreprises</TabsTrigger>}
              </TabsList>

              {/* Contacts */}
              <TabsContent value="contacts" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Contacts commerciaux</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Gérez les contacts et visualisez leurs connexions Gmail.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    {contacts.length > 0 ? (
                      <div className="border rounded-lg overflow-x-auto">
                        <div className="bg-gray-50 px-4 py-3 border-b grid grid-cols-12 gap-3 font-medium text-sm min-w-[900px]">
                          <div className="col-span-2">Nom\Prenom</div>
                          <div className="col-span-3">Email</div>
                          <div className="col-span-2">Entreprise</div>
                          <div className="col-span-1 text-center">Actif</div>
                          <div className="col-span-2 text-center">Gmail</div>
                          <div className="col-span-1 text-center">{(user?.role === 'super_admin' || user?.role === 'manager') && 'Modifier'}</div>
                          <div className="col-span-1 text-center">{(user?.role === 'super_admin' || user?.role === 'manager') && 'Supprimer'}</div>
                        </div>
                        {contacts.map((contact) => (
                          <div key={contact.id_contact} className="px-4 py-3 border-b last:border-b-0 grid grid-cols-12 gap-3 items-center hover:bg-gray-50 min-w-[900px]">
                            {editingContact === contact.id_contact ? (
                              <>
                                <div className="col-span-2"><Input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} className="h-8 text-sm" /></div>
                                <div className="col-span-3"><Input value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} className="h-8 text-sm" /></div>
                                <div className="col-span-2 text-sm text-gray-500 flex items-center">{contact.organization_name || "—"}</div>
                                <div className="col-span-1 text-center"><Checkbox checked={editContactActive} onCheckedChange={(checked) => setEditContactActive(checked === true)} /></div>
                                <div className="col-span-2 text-center">—</div>
                                <div className="col-span-1 text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleSaveEditContact(contact.id_contact)}><Check className="h-4 w-4" /></Button></div>
                                <div className="col-span-1 text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-gray-600" onClick={handleCancelEditContact}><X className="h-4 w-4" /></Button></div>
                              </>
                            ) : (
                              <>
                                <div className="col-span-2 text-sm font-medium truncate">{contact.name}</div>
                                <div className="col-span-3 text-sm truncate">{contact.email}</div>
                                <div className="col-span-2 text-sm text-gray-600 truncate">{contact.organization_name || "—"}</div>
                                <div className="col-span-1 text-center">
                                  {contact.is_active ? (
                                    <div className="flex justify-center"><div className="h-2.5 w-2.5 rounded-full bg-green-500"></div></div>
                                  ) : (
                                    <div className="flex justify-center"><div className="h-2.5 w-2.5 rounded-full bg-gray-300"></div></div>
                                  )}
                                </div>
                                <div className="col-span-2 text-center">
                                  {contactOAuthStatus[contact.id_contact]?.connected ? (
                                    <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0.5">
                                      <CheckCircle className="h-3 w-3 mr-0.5 inline" /> Connecté
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5">
                                      <XCircle className="h-3 w-3 mr-0.5 inline" /> Non connecté
                                    </Badge>
                                  )}
                                </div>
                                {(user?.role === 'super_admin' || user?.role === 'manager') ? (
                                  <>
                                    <div className="col-span-1 text-center">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 rounded-full" onClick={() => handleEditContact(contact)}>
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="col-span-1 text-center">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 rounded-full" onClick={() => handleDeleteContact(contact.id_contact, contact.name)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="col-span-1 text-center"></div>
                                    <div className="col-span-1 text-center"></div>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-gray-50">Aucun contact configuré.</p>
                    )}

                    {(user?.role === 'super_admin' || user?.role === 'manager') && (
                      <div className="border rounded-lg p-4 bg-muted/30 space-y-4 max-w-3xl">
                        <h4 className="text-sm font-semibold">Ajouter un contact</h4>
                        <div className="grid grid-cols-12 gap-3 items-start">
                          <div className="col-span-4"><Input placeholder="Nom\Prenom" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} className="h-9" /></div>
                          <div className="col-span-5"><Input placeholder="Email" value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} className="h-9" /></div>
                          <div className="col-span-2 flex items-center gap-2 pt-2"><Checkbox checked={newContactActive} onCheckedChange={(checked) => setNewContactActive(checked === true)} /> <span className="text-sm">Actif</span></div>
                        </div>
                        <div className="flex gap-3">
                          <Button onClick={handleAddContact} disabled={contactsLoading} className="bg-primary">Ajouter</Button>
                          <Button variant="outline" onClick={handleCancelAddContact}>Annuler</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Gestion des droits */}
              <TabsContent value="permissions" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Gestion des droits</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          {user?.role === 'super_admin' ? 'Configurez les pages accessibles par les rôles Manager et Commercial.' : 'Configurez les pages accessibles par le rôle Commercial.'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    {renderPermissionsSection()}
                    <div className="flex justify-end pt-4"><Button onClick={savePermissions} disabled={permissionsLoading} className="bg-primary">Sauvegarder les droits</Button></div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Managers */}
              <TabsContent value="managers" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Comptes Managers</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Liste des comptes managers. Vous pouvez en créer de nouveaux.
                          <span className="block text-amber-600 text-xs mt-1">⚠️ Vous ne pouvez pas modifier votre propre compte.</span>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    {user?.role === 'super_admin' && (
                      <div className="flex justify-end mb-4"><Button onClick={() => { setShowAddUser(!showAddUser); setNewUserRole('manager'); }} className="bg-primary">+ Ajouter un Manager</Button></div>
                    )}
                    {showAddUser && newUserRole === 'manager' && (
                      <div className="border rounded-lg p-4 bg-muted/30 space-y-3 mb-4 max-w-2xl">
                        <h4 className="text-sm font-semibold">Nouveau Manager</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="Prénom" value={newUserFirstName} onChange={e => setNewUserFirstName(e.target.value)} />
                          <Input placeholder="Nom" value={newUserLastName} onChange={e => setNewUserLastName(e.target.value)} />
                          <Input placeholder="Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                          <Input type="password" placeholder="Mot de passe" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                          {user?.role === 'super_admin' && (
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Entreprise <span className="text-red-500">*</span></Label>
                              <Select onValueChange={val => setNewUserOrgId(parseInt(val))}>
                                <SelectTrigger><SelectValue placeholder="Sélectionner une organisation" /></SelectTrigger>
                                <SelectContent>{organizations.map(org => <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-3"><Button onClick={createUser} disabled={addingUser} className="bg-primary">Créer le compte</Button><Button variant="outline" onClick={() => setShowAddUser(false)}>Annuler</Button></div>
                      </div>
                    )}
                    {usersLoading ? <p>Chargement...</p> : users.filter(u => u.role === 'manager').length === 0 ? <p className="text-center text-gray-400 py-8">Aucun manager créé.</p> : (
                      <div className="border rounded-lg overflow-x-auto">
                        <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 gap-2 font-medium text-sm min-w-[600px]">
                          <div className="col-span-4">Email</div><div className="col-span-2">Prénom</div><div className="col-span-2">Nom</div><div className="col-span-2">Organisation</div><div className="col-span-1">Rôle</div><div className="col-span-1 text-center">Actions</div>
                        </div>
                        {users.filter(u => u.role === 'manager').map((u) => (
                          <div key={u.id} className="px-4 py-2 border-b grid grid-cols-12 gap-2 items-center text-sm hover:bg-gray-50">
                            <div className="col-span-4 truncate font-medium">{editingUserId === u.id ? <Input value={editUserEmail} onChange={e => setEditUserEmail(e.target.value)} className="h-7 text-sm px-2" /> : u.email}</div>
                            <div className="col-span-2 truncate">{editingUserId === u.id ? <Input value={editUserFirstName} onChange={e => setEditUserFirstName(e.target.value)} className="h-7 text-sm px-2" /> : u.first_name || '—'}</div>
                            <div className="col-span-2 truncate">{editingUserId === u.id ? <Input value={editUserLastName} onChange={e => setEditUserLastName(e.target.value)} className="h-7 text-sm px-2" /> : u.last_name || '—'}</div>
                            <div className="col-span-2 truncate text-blue-600 text-sm">{editingUserId === u.id && user?.role === 'super_admin' ? <Select value={editUserOrgId ? String(editUserOrgId) : "none"} onValueChange={v => setEditUserOrgId(v === "none" ? null : parseInt(v))}><SelectTrigger className="h-7"><SelectValue placeholder="Organisation" /></SelectTrigger><SelectContent><SelectItem value="none">Aucune</SelectItem>{organizations.map(org => <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>)}</SelectContent></Select> : u.organization_name || '—'}</div>
                            <div className="col-span-1">{editingUserId === u.id ? <Select value={editUserRole} onValueChange={setEditUserRole}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manager">Manager</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem></SelectContent></Select> : <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'manager' || u.role === 'super_admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{u.role === 'manager' ? 'Manager' : u.role === 'super_admin' ? 'Super Admin' : 'Commercial'}</span>}</div>
                            <div className="col-span-1 text-center flex justify-center gap-1">
                              {editingUserId === u.id ? (<><Button variant="ghost" size="icon" onClick={() => updateUser(u.id)}><Check className="h-4 w-4 text-green-600" /></Button><Button variant="ghost" size="icon" onClick={() => setEditingUserId(null)}><X className="h-4 w-4" /></Button></>) : (u.id !== user?.id && (<><Button variant="ghost" size="icon" onClick={() => startEditingUser(u)}><Edit className="h-4 w-4 text-blue-600" /></Button><Button variant="ghost" size="icon" onClick={() => deleteUser(u.id, u.email)}><Trash2 className="h-4 w-4 text-red-600" /></Button></>))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Commercials */}
              <TabsContent value="commercials" className="mt-0">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-50/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-md text-slate-800">Comptes Commerciaux</CardTitle>
                        <CardDescription className="text-xs mt-0 text-slate-500">
                          Liste de votre équipe commerciale. Vous pouvez créer de nouveaux accès.
                          <span className="block text-amber-600 text-xs mt-1">⚠️ Vous ne pouvez pas modifier votre propre compte.</span>
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-5">
                    {(user?.role === 'super_admin' || user?.role === 'manager') && (
                      <div className="flex justify-end mb-4"><Button onClick={() => { setShowAddUser(!showAddUser); setNewUserRole('commercial'); }} className="bg-primary">+ Ajouter un Commercial</Button></div>
                    )}
                    {showAddUser && newUserRole === 'commercial' && (
                      <div className="border rounded-lg p-4 bg-muted/30 space-y-3 mb-4 max-w-2xl">
                        <h4 className="text-sm font-semibold">Nouveau Commercial</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input placeholder="Prénom" value={newUserFirstName} onChange={e => setNewUserFirstName(e.target.value)} />
                          <Input placeholder="Nom" value={newUserLastName} onChange={e => setNewUserLastName(e.target.value)} />
                          <Input placeholder="Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                          <Input type="password" placeholder="Mot de passe" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                          {user?.role === 'super_admin' && (
                            <div className="col-span-2 space-y-1">
                              <Label className="text-xs font-semibold text-gray-700">Entreprise <span className="text-red-500">*</span></Label>
                              <Select onValueChange={val => setNewUserOrgId(parseInt(val))}>
                                <SelectTrigger><SelectValue placeholder="Sélectionner une organisation" /></SelectTrigger>
                                <SelectContent>{organizations.map(org => <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-3"><Button onClick={createUser} disabled={addingUser} className="bg-primary">Créer le compte</Button><Button variant="outline" onClick={() => setShowAddUser(false)}>Annuler</Button></div>
                      </div>
                    )}
                    {usersLoading ? <p>Chargement...</p> : users.filter(u => u.role !== 'manager' && u.role !== 'super_admin').length === 0 ? <p className="text-center text-gray-400 py-8">Aucun commercial créé.</p> : (
                      <div className="border rounded-lg overflow-x-auto">
                        <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 gap-2 font-medium text-sm min-w-[600px]">
                          <div className="col-span-4">Email</div><div className="col-span-2">Prénom</div><div className="col-span-2">Nom</div><div className="col-span-2">Organisation</div><div className="col-span-1">Rôle</div><div className="col-span-1 text-center">{(user?.role === 'super_admin' || user?.role === 'manager') && 'Actions'}</div>
                        </div>
                        {users.filter(u => u.role !== 'manager' && u.role !== 'super_admin').map((u) => (
                          <div key={u.id} className="px-4 py-2 border-b grid grid-cols-12 gap-2 items-center text-sm hover:bg-gray-50">
                            <div className="col-span-4 truncate font-medium">{editingUserId === u.id ? <Input value={editUserEmail} onChange={e => setEditUserEmail(e.target.value)} className="h-7 text-sm px-2" /> : u.email}</div>
                            <div className="col-span-2 truncate">{editingUserId === u.id ? <Input value={editUserFirstName} onChange={e => setEditUserFirstName(e.target.value)} className="h-7 text-sm px-2" /> : u.first_name || '—'}</div>
                            <div className="col-span-2 truncate">{editingUserId === u.id ? <Input value={editUserLastName} onChange={e => setEditUserLastName(e.target.value)} className="h-7 text-sm px-2" /> : u.last_name || '—'}</div>
                            <div className="col-span-2 truncate text-blue-600 text-sm">{editingUserId === u.id && user?.role === 'super_admin' ? <Select value={editUserOrgId ? String(editUserOrgId) : "none"} onValueChange={v => setEditUserOrgId(v === "none" ? null : parseInt(v))}><SelectTrigger className="h-7"><SelectValue placeholder="Organisation" /></SelectTrigger><SelectContent><SelectItem value="none">Aucune</SelectItem>{organizations.map(org => <SelectItem key={org.id} value={String(org.id)}>{org.name}</SelectItem>)}</SelectContent></Select> : u.organization_name || '—'}</div>
                            <div className="col-span-1">{editingUserId === u.id ? <Select value={editUserRole} onValueChange={setEditUserRole}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manager">Manager</SelectItem><SelectItem value="commercial">Commercial</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem></SelectContent></Select> : <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === 'manager' || u.role === 'super_admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{u.role === 'manager' ? 'Manager' : u.role === 'super_admin' ? 'Super Admin' : 'Commercial'}</span>}</div>
                            <div className="col-span-1 text-center flex justify-center gap-1">
                              {(user?.role === 'super_admin' || user?.role === 'manager') && (
                                editingUserId === u.id ? (<><Button variant="ghost" size="icon" onClick={() => updateUser(u.id)}><Check className="h-4 w-4 text-green-600" /></Button><Button variant="ghost" size="icon" onClick={() => setEditingUserId(null)}><X className="h-4 w-4" /></Button></>) : (u.id !== user?.id && (<><Button variant="ghost" size="icon" onClick={() => startEditingUser(u)}><Edit className="h-4 w-4 text-blue-600" /></Button><Button variant="ghost" size="icon" onClick={() => deleteUser(u.id, u.email)}><Trash2 className="h-4 w-4 text-red-600" /></Button></>))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Entreprises */}
              {user?.role === 'super_admin' && (
                <TabsContent value="entreprises" className="mt-0">
                  <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50/80 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-md text-slate-800">Entreprises clientes</CardTitle>
                          <CardDescription className="text-xs mt-0 text-slate-500">
                            Liste de toutes les entreprises enregistrées sur la plateforme.
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex justify-end mb-4"><Button onClick={() => navigate('/register-company')} className="bg-primary"><ExternalLink className="h-4 w-4 mr-2" /> Ajouter une entreprise</Button></div>
                      {organizations.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg bg-gray-50"><Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Aucune entreprise enregistrée.</p><Button onClick={() => navigate('/register-company')} className="mt-3">Créer la première entreprise</Button></div>
                      ) : (
                        <div className="border rounded-lg overflow-x-auto">
                          <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-14 gap-2 font-medium text-sm min-w-[900px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                            <div className="col-span-3">Nom</div><div className="col-span-3">Email</div><div className="col-span-2">Secteur</div><div className="col-span-2">Site web</div><div className="col-span-1 text-center">Date création</div><div className="col-span-1 text-center">Modifier</div><div className="col-span-1 text-center">Supprimer</div>
                          </div>
                          {organizations.map((org) => (
                            <div key={org.id} className="px-4 py-2 border-b grid grid-cols-14 gap-2 items-center text-sm hover:bg-gray-50 min-w-[900px]" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                              <div className="col-span-3 font-medium truncate">{org.name}</div>
                              <div className="col-span-3 truncate text-muted-foreground">{org.email || '—'}</div>
                              <div className="col-span-2 truncate">{org.sector ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{org.sector}</span> : '—'}</div>
                              <div className="col-span-2 truncate">{org.website ? <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs truncate block">{org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a> : '—'}</div>
                              <div className="col-span-1 text-center text-muted-foreground text-xs">{org.created_at ? new Date(org.created_at).toLocaleDateString('fr-FR') : '—'}</div>
                              <div className="col-span-1 text-center"><Button variant="ghost" size="icon" onClick={() => openEditOrgDialog(org)}><Edit className="h-4 w-4 text-blue-500" /></Button></div>
                              <div className="col-span-1 text-center"><Button variant="ghost" size="icon" onClick={() => deleteOrganization(org.id, org.name)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </TabsContent>

          {/* ==================== CATÉGORIE 5: RECRUTEMENT ==================== */}
          <TabsContent value="recruitment" className="mt-0">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50/80 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-md text-slate-800">Profils recherchés</CardTitle>
                    <CardDescription className="text-xs mt-0 text-slate-500">
                      Définissez des profils types pour retrouver rapidement des candidats.
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => openProfileDialog()} className="bg-primary hover:bg-primary/90 text-sm px-3 h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau profil
                </Button>
              </div>
              <CardContent className="p-5">
                {profilesLoading ? (
                  <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
                ) : profiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border rounded-lg">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>Aucun profil. Créez votre premier profil recherché !</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <div className="bg-gray-50 px-4 py-2 border-b grid grid-cols-12 gap-2 font-medium text-sm min-w-[900px]">
                      <div className="col-span-3">Nom</div><div className="col-span-3">Compétences</div><div className="col-span-1 text-center">Expérience</div><div className="col-span-2">Localisation</div><div className="col-span-1 text-center">Statut</div><div className="col-span-2 text-center">Actions</div>
                    </div>
                    {profiles.map((p) => (
                      <div key={p.id} className="px-4 py-2 border-b last:border-b-0 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 min-w-[900px]">
                        <div className="col-span-3 text-sm font-medium truncate">{p.name}</div>
                        <div className="col-span-3"><div className="flex flex-wrap gap-1">{p.skills.slice(0, 2).map((skill) => (<Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>))}{p.skills.length > 2 && <Badge variant="outline" className="text-xs">+{p.skills.length - 2}</Badge>}</div></div>
                        <div className="col-span-1 text-center text-sm">{p.min_experience}-{p.max_experience || "+"} ans</div>
                        <div className="col-span-2"><div className="flex flex-wrap gap-1">{p.countries.slice(0, 2).map((country) => (<Badge key={country} variant="outline" className="text-xs">{country}</Badge>))}</div></div>
                        <div className="col-span-1 text-center">{p.is_active ? <Badge className="bg-green-100 text-green-700">Actif</Badge> : <Badge className="bg-gray-100 text-gray-500">Inactif</Badge>}</div>
                        <div className="col-span-2 text-center flex justify-center gap-1"><Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" onClick={() => matchProfile(p)}><Search className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={() => openProfileDialog(p)}><Edit className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteProfile(p.id, p.name)}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogues */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentTemplate ? "Modifier le template" : "Créer un template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom du template *</Label>
                <Input value={templateForm.name_template} onChange={(e) => setTemplateForm({ ...templateForm, name_template: e.target.value })} />
              </div>
              <div>
                <Label>Statut</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Switch checked={templateForm.is_active} onCheckedChange={(checked) => setTemplateForm({ ...templateForm, is_active: checked })} />
                  <span>{templateForm.is_active ? "Actif" : "Inactif"}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Sujet *</Label>
                <Button type="button" variant={activeField === "subject" ? "default" : "outline"} size="sm" onClick={() => setActiveField("subject")}>
                  📧 Insérer ici
                </Button>
              </div>
              <Input value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Corps *</Label>
                <Button type="button" variant={activeField === "body" ? "default" : "outline"} size="sm" onClick={() => setActiveField("body")}>
                  📝 Insérer ici
                </Button>
              </div>
              <Textarea rows={10} value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} className="font-mono" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
            </div>
            <div className="border-t pt-4">
              <Label className="font-medium">Variables disponibles</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Badge key={v.name} variant="outline" className="cursor-pointer" onClick={() => insertVariable(v.name)}>
                    {v.name}
                    <span className="ml-1 text-gray-400 text-xs">({v.description})</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Annuler</Button>
            <Button variant="outline" onClick={previewTemplate}>Aperçu</Button>
            <Button onClick={saveTemplate} className="bg-primary">{currentTemplate ? "Mettre à jour" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-gray-800">
              <span className="bg-indigo-100 p-1.5 rounded-lg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              </span>
              Aperçu du template
            </DialogTitle>
          </DialogHeader>
          {previewData && (() => {
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
                </div>
                <div style="background:#FAFAFA;border:1px solid #E5E7EB;border-top:none;padding:8px 16px;font-size:11px;color:#6B7280;">
                  <div><strong>De :</strong> Pilotis Recrutement &lt;noreply@pilotis.fr&gt;</div>
                  <div><strong>\u00c0 :</strong> {{ candidate_name }} &lt;{{ candidate_email }}&gt;</div>
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
              <div className="max-h-[520px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: html }} />
            );
          })()}
          <DialogFooter className="px-6 py-4 border-t bg-gray-50">
            <Button onClick={() => setShowPreview(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{currentProfile ? "Modifier le profil" : "Créer un profil recherché"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom du profil *</Label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={profileForm.description} onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Compétences (séparées par des virgules)</Label>
              <Input value={profileForm.skills} onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expérience min (ans)</Label>
                <Input type="number" value={profileForm.min_experience} onChange={(e) => setProfileForm({ ...profileForm, min_experience: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Expérience max (ans)</Label>
                <Input type="number" value={profileForm.max_experience} onChange={(e) => setProfileForm({ ...profileForm, max_experience: e.target.value })} placeholder="Illimité" />
              </div>
            </div>
            <div>
              <Label>Pays (séparés par des virgules)</Label>
              <Input value={profileForm.countries} onChange={(e) => setProfileForm({ ...profileForm, countries: e.target.value })} />
            </div>
            <div>
              <Label>Types de contrat (séparés par des virgules)</Label>
              <Input value={profileForm.contract_types} onChange={(e) => setProfileForm({ ...profileForm, contract_types: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Autoriser les candidats étrangers</Label>
              <Switch checked={profileForm.is_foreign_allowed} onCheckedChange={(checked) => setProfileForm({ ...profileForm, is_foreign_allowed: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>Annuler</Button>
            <Button onClick={saveProfile} className="bg-primary">{currentProfile ? "Mettre à jour" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Résultats pour "{matchingProfile?.name}"</DialogTitle>
          </DialogHeader>
          {matchingLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : matchResults.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              Aucun candidat ne correspond à ce profil
            </div>
          ) : (
            <div className="space-y-3">
              {matchResults.map((match) => (
                <div key={match.candidate_id} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{match.candidate_name}</h3>
                      <p className="text-sm text-gray-500">{match.email}</p>
                    </div>
                    {getScoreBadge(match.score)}
                  </div>
                  {match.cv_drive_link && (
                    <button onClick={() => viewCV(match.cv_drive_link!)} className="text-primary text-sm flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> Voir le CV
                    </button>
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
      {/* Dialog Modifier Entreprise */}
      <Dialog open={showEditOrgDialog} onOpenChange={setShowEditOrgDialog}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-500" /> Modifier l'entreprise
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom *</Label>
              <Input value={editOrgForm.name} onChange={(e) => setEditOrgForm({ ...editOrgForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input value={editOrgForm.email} onChange={(e) => setEditOrgForm({ ...editOrgForm, email: e.target.value })} />
              </div>
              <div>
                <Label>Secteur</Label>
                <Input value={editOrgForm.sector} onChange={(e) => setEditOrgForm({ ...editOrgForm, sector: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Site web</Label>
              <Input value={editOrgForm.website} onChange={(e) => setEditOrgForm({ ...editOrgForm, website: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Téléphone</Label>
                <Input value={editOrgForm.phone} onChange={(e) => setEditOrgForm({ ...editOrgForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>Adresse</Label>
                <Input value={editOrgForm.address} onChange={(e) => setEditOrgForm({ ...editOrgForm, address: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEditOrgDialog(false)}>Annuler</Button>
            <Button onClick={updateOrganization} disabled={editOrgLoading || !editOrgForm.name}>
              {editOrgLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
};
export default Configuration;