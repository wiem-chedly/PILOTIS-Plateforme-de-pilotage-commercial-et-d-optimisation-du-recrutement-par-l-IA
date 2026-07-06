export type ClientStatut = "Prospect" | "Client" | "Partenaire";
export type Secteur = "Banque & Assurance" | "Aéronautique & Défense" | "Énergie" | "Télécoms" | "Transport" | "Industrie" | "Services publics";
export type Taille = "PME" | "ETI" | "Grand Groupe";

export interface Interaction {
  id: string;
  date: string;
  type: "Appel" | "Email" | "Rendez-vous" | "Proposition" | "Signature";
  commercial: string;
  detail: string;
}

export interface ClientRecord {
  id: string;
  nom: string;
  statut: ClientStatut;
  secteur: Secteur;
  taille: Taille;
  localisation: string;
  contactPrincipal: string;
  email: string;
  telephone: string;
  caTotal: number;
  derniereInteraction: string;
  interactions: Interaction[];
}

export const secteurs: Secteur[] = ["Banque & Assurance", "Aéronautique & Défense", "Énergie", "Télécoms", "Transport", "Industrie", "Services publics"];
export const tailles: Taille[] = ["PME", "ETI", "Grand Groupe"];
export const clientStatuts: ClientStatut[] = ["Prospect", "Client", "Partenaire"];

export const clientRecords: ClientRecord[] = [
  {
    id: "cl-001", nom: "BNP Paribas", statut: "Client", secteur: "Banque & Assurance", taille: "Grand Groupe",
    localisation: "Paris", contactPrincipal: "Marc Lefèvre", email: "m.lefevre@bnp.fr", telephone: "01 42 98 12 34",
    caTotal: 450000, derniereInteraction: "2026-02-17",
    interactions: [
      { id: "i1", date: "2026-02-17", type: "Appel", commercial: "S. Martin", detail: "Présentation solution cloud" },
      { id: "i2", date: "2026-02-10", type: "Rendez-vous", commercial: "S. Martin", detail: "Revue de projet trimestrielle" },
      { id: "i3", date: "2026-01-22", type: "Email", commercial: "L. Dupont", detail: "Envoi proposition renouvellement TMA" },
    ],
  },
  {
    id: "cl-002", nom: "Airbus Defence", statut: "Client", secteur: "Aéronautique & Défense", taille: "Grand Groupe",
    localisation: "Toulouse", contactPrincipal: "Claire Duval", email: "c.duval@airbus.com", telephone: "05 61 93 45 67",
    caTotal: 320000, derniereInteraction: "2026-02-16",
    interactions: [
      { id: "i4", date: "2026-02-16", type: "Signature", commercial: "L. Dupont", detail: "Contrat TMA 24 mois signé" },
      { id: "i5", date: "2026-02-05", type: "Proposition", commercial: "L. Dupont", detail: "Offre finale TMA SAP" },
    ],
  },
  {
    id: "cl-003", nom: "SNCF Réseau", statut: "Prospect", secteur: "Transport", taille: "Grand Groupe",
    localisation: "Saint-Denis", contactPrincipal: "Philippe Garnier", email: "p.garnier@sncf.fr", telephone: "01 53 25 78 90",
    caTotal: 0, derniereInteraction: "2026-02-16",
    interactions: [
      { id: "i6", date: "2026-02-16", type: "Proposition", commercial: "M. Bernard", detail: "AO migration SI envoyé" },
      { id: "i7", date: "2026-02-02", type: "Rendez-vous", commercial: "M. Bernard", detail: "Qualification du besoin data" },
    ],
  },
  {
    id: "cl-004", nom: "Crédit Agricole", statut: "Prospect", secteur: "Banque & Assurance", taille: "Grand Groupe",
    localisation: "Montrouge", contactPrincipal: "Isabelle Renaud", email: "i.renaud@ca.fr", telephone: "01 43 23 56 78",
    caTotal: 0, derniereInteraction: "2026-02-15",
    interactions: [
      { id: "i8", date: "2026-02-15", type: "Appel", commercial: "A. Moreau", detail: "Suivi proposition DevOps" },
    ],
  },
  {
    id: "cl-005", nom: "Thales", statut: "Prospect", secteur: "Aéronautique & Défense", taille: "Grand Groupe",
    localisation: "La Défense", contactPrincipal: "Jean-Pierre Moulin", email: "jp.moulin@thales.com", telephone: "01 73 32 12 45",
    caTotal: 0, derniereInteraction: "2026-02-15",
    interactions: [
      { id: "i9", date: "2026-02-15", type: "Rendez-vous", commercial: "S. Martin", detail: "Qualification besoin cybersécurité" },
    ],
  },
  {
    id: "cl-006", nom: "EDF Renouvelables", statut: "Prospect", secteur: "Énergie", taille: "ETI",
    localisation: "La Défense", contactPrincipal: "Nathalie Blanc", email: "n.blanc@edf-re.fr", telephone: "01 40 42 33 21",
    caTotal: 0, derniereInteraction: "2026-02-14",
    interactions: [
      { id: "i10", date: "2026-02-14", type: "Appel", commercial: "C. Leroy", detail: "Premier contact data engineering" },
    ],
  },
  {
    id: "cl-007", nom: "Orange Business", statut: "Client", secteur: "Télécoms", taille: "Grand Groupe",
    localisation: "Arcueil", contactPrincipal: "François Petit", email: "f.petit@orange.com", telephone: "01 44 44 22 11",
    caTotal: 180000, derniereInteraction: "2026-02-14",
    interactions: [
      { id: "i11", date: "2026-02-14", type: "Proposition", commercial: "L. Dupont", detail: "Offre consulting agile" },
      { id: "i12", date: "2026-01-20", type: "Rendez-vous", commercial: "L. Dupont", detail: "Cadrage mission DevOps" },
    ],
  },
  {
    id: "cl-008", nom: "Société Générale", statut: "Client", secteur: "Banque & Assurance", taille: "Grand Groupe",
    localisation: "La Défense", contactPrincipal: "Alain Vidal", email: "a.vidal@socgen.com", telephone: "01 42 14 56 00",
    caTotal: 275000, derniereInteraction: "2026-02-13",
    interactions: [
      { id: "i13", date: "2026-02-13", type: "Signature", commercial: "M. Bernard", detail: "Extension mission BI signée" },
      { id: "i14", date: "2026-01-28", type: "Proposition", commercial: "M. Bernard", detail: "Avenant extension BI" },
    ],
  },
  {
    id: "cl-009", nom: "Safran", statut: "Partenaire", secteur: "Aéronautique & Défense", taille: "Grand Groupe",
    localisation: "Paris", contactPrincipal: "Éric Lambert", email: "e.lambert@safran.fr", telephone: "01 40 60 80 00",
    caTotal: 120000, derniereInteraction: "2026-02-13",
    interactions: [
      { id: "i15", date: "2026-02-13", type: "Appel", commercial: "A. Moreau", detail: "Suivi AO intégration SAP" },
      { id: "i16", date: "2026-01-15", type: "Email", commercial: "A. Moreau", detail: "Partage référence projet conjoint" },
    ],
  },
  {
    id: "cl-010", nom: "Bouygues Telecom", statut: "Prospect", secteur: "Télécoms", taille: "Grand Groupe",
    localisation: "Meudon", contactPrincipal: "Stéphanie Roux", email: "s.roux@bouyguestelecom.fr", telephone: "01 39 26 50 00",
    caTotal: 0, derniereInteraction: "2026-02-12",
    interactions: [
      { id: "i17", date: "2026-02-12", type: "Rendez-vous", commercial: "S. Martin", detail: "Démonstration plateforme" },
    ],
  },
  {
    id: "cl-011", nom: "Engie Solutions", statut: "Partenaire", secteur: "Énergie", taille: "Grand Groupe",
    localisation: "La Défense", contactPrincipal: "Pierre Morel", email: "p.morel@engie.com", telephone: "01 44 22 00 00",
    caTotal: 95000, derniereInteraction: "2026-02-08",
    interactions: [
      { id: "i18", date: "2026-02-08", type: "Email", commercial: "C. Leroy", detail: "Proposition co-traitance AO public" },
    ],
  },
  {
    id: "cl-012", nom: "Dassault Systèmes", statut: "Prospect", secteur: "Industrie", taille: "Grand Groupe",
    localisation: "Vélizy", contactPrincipal: "Marie-Anne Chevalier", email: "ma.chevalier@3ds.com", telephone: "01 61 62 61 62",
    caTotal: 0, derniereInteraction: "2026-02-06",
    interactions: [
      { id: "i19", date: "2026-02-06", type: "Appel", commercial: "S. Martin", detail: "Prise de contact PLM consulting" },
    ],
  },
];
