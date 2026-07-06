import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation dictionaries
const resources = {
  fr: {
    translation: {
      "dashboard": "Tableau de bord",
      "appels_offres": "Appels d'Offres",
      "candidats": "Candidats",
      "entretiens": "Entretiens",
      "performance": "Performance Commerciale",
      "clients": "Clients & Prospects",
      "reporting": "Reporting & Statistiques",
      "configuration": "Configuration",
      "intercontrats": "Intercontrats (Bench)",
      "synthese_hebdo": "Synthèse Hebdo",
      "kpi_annuels": "KPI Annuels",
      "stats_recrutement": "Statistiques Recrutement",
      "linkedin_interactions": "Interactions LinkedIn",
      "logs_import": "Logs d'Importation",
      "main_menu": "Menu Principal",
      "reports_kpi": "Rapports & KPIs",
      "admin": "Administration",
      "search_placeholder": "Rechercher...",
      "notifications": "Notifications",
      "logout": "Déconnexion",
      "profile": "Profil",
      "dashboard_title": "Dashboard Commercial",
      "total_opportunities": "Total Opportunités",
      "conversion_rate": "Taux de Conversion",
      "active_ao": "Appels d'Offres Actifs",
      "signed_contracts": "Contrats Signés ce mois"
    }
  },
  en: {
    translation: {
      "dashboard": "Dashboard",
      "appels_offres": "Job Requisitions",
      "candidats": "Candidates",
      "entretiens": "Interviews",
      "performance": "Sales Performance",
      "clients": "Clients & Prospects",
      "reporting": "Reporting & Statistics",
      "configuration": "Settings",
      "intercontrats": "Bench Management",
      "synthese_hebdo": "Weekly Summary",
      "kpi_annuels": "Annual KPIs",
      "stats_recrutement": "Recruitment Stats",
      "linkedin_interactions": "LinkedIn Interactions",
      "logs_import": "Import Logs",
      "main_menu": "Main Menu",
      "reports_kpi": "Reports & KPIs",
      "admin": "Administration",
      "search_placeholder": "Search...",
      "notifications": "Notifications",
      "logout": "Logout",
      "profile": "Profile",
      "dashboard_title": "Sales Dashboard",
      "total_opportunities": "Total Opportunities",
      "conversion_rate": "Conversion Rate",
      "active_ao": "Active Requisitions",
      "signed_contracts": "Contracts Signed this month"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
