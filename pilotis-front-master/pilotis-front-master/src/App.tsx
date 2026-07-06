import { AuthProvider } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import RegisterOrganizationPage from "./pages/RegisterOrganizationPage";
import ValidationPage from "./pages/ValidationPage";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AppelsOffres from "./pages/AppelsOffres";
import PerformanceCommerciale from "./pages/PerformanceCommerciale";
import ClientsProspects from "./pages/ClientsProspects";
import Reporting from "./pages/Reporting";
import LogsImport from "./pages/LogsImport";
import Configuration from "./pages/Configuration";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import SyntheseHebdo from "./pages/SyntheseHebdo";
import DetailSales from "./pages/DetailSales";
import Intercontrats from "./pages/Intercontrats";
import KpiAnnuels from "./pages/KpiAnnuels";
import ConfigModule from "./pages/ConfigModule";
import Candidats from "./pages/Candidats";
import LinkedInInteractions from "./pages/LinkedInInteractions";
import QuizPage from "./pages/QuizPage";
import Entretiens from "./pages/Entretiens";
import RecruitmentStats from "./pages/RecruitmentStats";
// ── Pages Wiem ──────────────────────────────────────────────────────────────
import MatchingPage from "./pages/MatchingPage";
import EmailTemplates from "./pages/EmailTemplates";
import SearchedProfiles from "./pages/SearchedProfiles";
import CVExtraction from "./pages/CVExtraction";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* ── Routes publiques ── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register-company" element={<RegisterOrganizationPage />} />
            {/* Quiz public — lien unique envoyé par email au candidat (sans connexion) */}
            <Route path="/quiz/:token" element={<QuizPage />} />

            {/* ── Routes protégées ── */}
            <Route path="/" element={<ProtectedRoute pageKey="dashboard"><Index /></ProtectedRoute>} />
            <Route path="/appels-offres" element={<ProtectedRoute pageKey="appels-offres"><AppelsOffres /></ProtectedRoute>} />
            <Route path="/candidats" element={<ProtectedRoute pageKey="candidatures"><Candidats /></ProtectedRoute>} />
            <Route path="/candidats/:source" element={<ProtectedRoute pageKey="candidatures"><Candidats /></ProtectedRoute>} />
            <Route path="/entretiens" element={<ProtectedRoute pageKey="candidatures"><Entretiens /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute pageKey="performance"><PerformanceCommerciale /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute pageKey="clients"><ClientsProspects /></ProtectedRoute>} />
            <Route path="/reporting" element={<ProtectedRoute pageKey="reporting"><Reporting /></ProtectedRoute>} />
            <Route path="/logs" element={<ProtectedRoute pageKey="logs-import"><LogsImport /></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute pageKey="configuration"><Configuration /></ProtectedRoute>} />
            <Route path="/validate/:id" element={<ProtectedRoute><ValidationPage /></ProtectedRoute>} />
            <Route path="/synthese-hebdo" element={<ProtectedRoute pageKey="synthese-hebdo"><SyntheseHebdo /></ProtectedRoute>} />
            <Route path="/detail-sales/:salesName" element={<ProtectedRoute pageKey="detail-sales"><DetailSales /></ProtectedRoute>} />
            <Route path="/intercontrats" element={<ProtectedRoute pageKey="intercontrats"><Intercontrats /></ProtectedRoute>} />
            <Route path="/kpi-annuels" element={<ProtectedRoute pageKey="kpi-annuels"><KpiAnnuels /></ProtectedRoute>} />
            <Route path="/config-module" element={<ProtectedRoute pageKey="config-module"><ConfigModule /></ProtectedRoute>} />
            <Route path="/linkedin-interactions" element={<ProtectedRoute pageKey="linkedin-interactions"><LinkedInInteractions /></ProtectedRoute>} />
            <Route path="/stats-recrutement" element={<ProtectedRoute pageKey="stats-recrutement"><RecruitmentStats /></ProtectedRoute>} />
            {/* ── Routes Wiem ── */}
            <Route path="/matching" element={<ProtectedRoute pageKey="candidatures"><MatchingPage /></ProtectedRoute>} />
            <Route path="/email-templates" element={<ProtectedRoute pageKey="configuration"><EmailTemplates /></ProtectedRoute>} />
            <Route path="/searched-profiles" element={<ProtectedRoute pageKey="configuration"><SearchedProfiles /></ProtectedRoute>} />
            

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
