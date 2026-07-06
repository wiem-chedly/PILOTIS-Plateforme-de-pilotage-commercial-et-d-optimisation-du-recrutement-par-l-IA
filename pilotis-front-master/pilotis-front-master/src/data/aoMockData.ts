export type AOStatut = "Nouveau" | "En cours" | "Soumis" | "Gagné" | "Perdu" | "Abandonné";

export interface AppelOffre {
  id: string;
  titre: string;
  client: string;
  dateLimite: string;
  montantEstime: number;
  statut: AOStatut;
  dateCreation: string;
  description: string;
  documents: UploadedDoc[];
}

export interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
}

export const aoStatuts: AOStatut[] = ["Nouveau", "En cours", "Soumis", "Gagné", "Perdu", "Abandonné"];

export const mockAOs: AppelOffre[] = [
  {
    id: "ao-001",
    titre: "Migration SI vers le Cloud AWS",
    client: "BNP Paribas",
    dateLimite: "2026-03-15",
    montantEstime: 450000,
    statut: "En cours",
    dateCreation: "2026-02-10",
    description: "Migration complète de l'infrastructure on-premise vers AWS avec refonte des pipelines CI/CD.",
    documents: [],
  },
  {
    id: "ao-002",
    titre: "Développement plateforme data analytics",
    client: "SNCF Réseau",
    dateLimite: "2026-04-01",
    montantEstime: 320000,
    statut: "Nouveau",
    dateCreation: "2026-02-14",
    description: "Conception et développement d'une plateforme de data analytics temps réel pour le suivi du réseau ferroviaire.",
    documents: [],
  },
  {
    id: "ao-003",
    titre: "TMA Application Métier SAP",
    client: "Airbus Defence",
    dateLimite: "2026-02-28",
    montantEstime: 180000,
    statut: "Soumis",
    dateCreation: "2026-01-20",
    description: "Tierce Maintenance Applicative sur les modules SAP MM/SD/FI pour une durée de 24 mois.",
    documents: [],
  },
  {
    id: "ao-004",
    titre: "Audit cybersécurité infrastructure",
    client: "Thales",
    dateLimite: "2026-03-10",
    montantEstime: 95000,
    statut: "En cours",
    dateCreation: "2026-02-05",
    description: "Audit complet de la sécurité des systèmes d'information avec tests d'intrusion et recommandations.",
    documents: [],
  },
  {
    id: "ao-005",
    titre: "Refonte portail client digital",
    client: "Crédit Agricole",
    dateLimite: "2026-05-15",
    montantEstime: 580000,
    statut: "Nouveau",
    dateCreation: "2026-02-16",
    description: "Refonte complète du portail client avec UX moderne, accessibilité RGAA et intégration API Open Banking.",
    documents: [],
  },
  {
    id: "ao-006",
    titre: "Mise en place DevOps & CI/CD",
    client: "Orange Business",
    dateLimite: "2026-02-20",
    montantEstime: 150000,
    statut: "Gagné",
    dateCreation: "2026-01-10",
    description: "Industrialisation des processus de développement avec mise en place d'une chaîne CI/CD complète.",
    documents: [],
  },
  {
    id: "ao-007",
    titre: "Intégration ERP Odoo",
    client: "Bouygues Telecom",
    dateLimite: "2026-01-30",
    montantEstime: 210000,
    statut: "Perdu",
    dateCreation: "2025-12-15",
    description: "Intégration et personnalisation d'Odoo pour la gestion commerciale et la facturation.",
    documents: [],
  },
];

// Simulated OCR extraction results
export function simulateOCR(fileName: string): Partial<AppelOffre> {
  const clients = ["Société Générale", "EDF Renouvelables", "Safran", "Dassault Systèmes", "Engie"];
  const titres = [
    "Modernisation infrastructure IT",
    "Développement application mobile",
    "Conseil transformation digitale",
    "Intégration solution BI",
    "Migration données cloud",
  ];
  const randomClient = clients[Math.floor(Math.random() * clients.length)];
  const randomTitre = titres[Math.floor(Math.random() * titres.length)];
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + Math.floor(Math.random() * 4) + 1);

  return {
    titre: randomTitre,
    client: randomClient,
    dateLimite: futureDate.toISOString().split("T")[0],
    montantEstime: Math.floor(Math.random() * 400000 + 100000),
    statut: "Nouveau",
    description: `Données extraites automatiquement du document "${fileName}". Veuillez vérifier et compléter les informations.`,
  };
}
