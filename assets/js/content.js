// Contenu du site. Pour ajouter un outil : une entrée dans TOOLS.
// Pour ouvrir une section : passer ready à true et créer la page indiquée par href.
window.SITE = {
  version: "0.1",
  date: "2026-10-24",
  github: "acheruel",
  pages: "https://acheruel.github.io"
};

window.SECTIONS = [
  { id: "outils", href: "./", ready: true, label: { fr: "Outils", en: "Tools" } },
  { id: "cv", href: "cv/", ready: false, label: { fr: "CV", en: "Résumé" } },
  { id: "conseils", href: "conseils/", ready: false, label: { fr: "Conseils", en: "Advice" } },
  { id: "bibliotheque", href: "bibliotheque/", ready: false, label: { fr: "Bibliothèque", en: "Library" } }
];

// name: [début, suite] du nom, affichés comme les marques Quicker (suite en clair).
// updated : date de repli si l'API GitHub ne répond pas.
window.TOOLS = [
  {
    repo: "QuickerBridge",
    name: ["Quicker", "Bridge"],
    logo: "assets/logos/quickerbridge.svg",
    updated: "2026-10-17",
    tagline: { fr: "Poutres continues de pont", en: "Continuous bridge girders" },
    desc: {
      fr: "Analyse préliminaire de poutres continues, calculée dans le navigateur avec PyCBA : enveloppes, lignes d'influence, camions canadiens, goussets, culées intégrales.",
      en: "Preliminary analysis of continuous girders, computed in the browser with PyCBA: envelopes, influence lines, Canadian trucks, haunches, integral abutments."
    },
    topics: { fr: ["Ponts", "Analyse", "S6-25"], en: ["Bridges", "Analysis", "S6-25"] }
  },
  {
    repo: "QuickerAtlas",
    name: ["Quicker", "Atlas"],
    logo: "assets/logos/quickeratlas.svg",
    updated: "2026-10-24",
    tagline: { fr: "Atlas des ouvrages d'art du Québec", en: "Atlas of Québec's structures" },
    desc: {
      fr: "Proposition de visualisation de l'inventaire des structures du ministère des Transports et de la Mobilité durable : ponts, ponceaux, murs, tunnels.",
      en: "A proposed visualization of the Québec Ministry of Transportation's structure inventory: bridges, culverts, walls, tunnels."
    },
    topics: { fr: ["Ponts", "Carte", "Données ouvertes"], en: ["Bridges", "Map", "Open data"] }
  },
  {
    repo: "BridgeSketch-3D",
    name: ["BridgeSketch", " 3D"],
    logo: "assets/logos/bridgesketch-3d.svg",
    updated: "2026-10-16",
    tagline: { fr: "Configurateur 3D de ponts", en: "3D bridge configurator" },
    desc: {
      fr: "Esquisse interactive d'un pont en 3D : travées, profil en travers, superstructure, appuis et site, puis exploration du résultat.",
      en: "Interactive 3D bridge sketch: span arrangement, road section, superstructure, supports and site, then explore the result."
    },
    topics: { fr: ["Ponts", "3D", "Avant-projet"], en: ["Bridges", "3D", "Concept"] }
  },
  {
    repo: "QuickerUnits",
    name: ["Quicker", "Units"],
    logo: "assets/logos/quickerunits.svg",
    updated: "2026-10-10",
    tagline: { fr: "Convertisseur d'unités", en: "Units converter" },
    desc: {
      fr: "Conversion d'unités pensée pour les ingénieurs civils et en structure. Fonctionne entièrement hors ligne.",
      en: "Unit conversion built for civil and structural engineers. Works fully offline."
    },
    topics: { fr: ["Unités", "Hors ligne"], en: ["Units", "Offline"] }
  },
  {
    repo: "Extracto-Commento",
    name: ["Extracto", " Commento"],
    logo: "assets/logos/extracto-commento.svg",
    updated: "2026-10-03",
    tagline: { fr: "Commentaires PDF vers Excel", en: "PDF comments to Excel" },
    desc: {
      fr: "Extrait les commentaires de vos PDF vers un fichier Excel, directement dans le navigateur. Les fichiers ne quittent pas votre poste.",
      en: "Extracts the comments of your PDFs into an Excel file, right in the browser. Your files never leave your computer."
    },
    topics: { fr: ["PDF", "Excel", "Révision"], en: ["PDF", "Excel", "Review"] }
  }
];

window.I18N = {
  fr: {
    title: "Anthony Chéruel · Outils",
    skip: "Aller au contenu",
    brandSub: "Ingénieur en ponts · Québec",
    navLabel: "Sections",
    soon: "bientôt",
    toolsTitle: "Outils",
    toolsLead: "Des outils web pour l'ingénierie des ponts et des structures. Ils s'ouvrent dans le navigateur, sans installation ni compte.",
    toolsCount: n => `${n} outils`,
    lastUpdate: d => `dernière mise à jour le ${d}`,
    updated: d => `Mis à jour le ${d}`,
    code: "Code",
    open: "Ouvrir",
    newWindow: "(s'ouvre dans une nouvelle fenêtre)",
    codeOf: n => `Code source de ${n} sur GitHub`,
    warning: "Valeurs préliminaires seulement : les outils d'analyse ne remplacent pas une conception détaillée.",
    siteVersion: "Site",
    locale: "fr-CA"
  },
  en: {
    title: "Anthony Chéruel · Tools",
    skip: "Skip to content",
    brandSub: "Bridge engineer · Québec",
    navLabel: "Sections",
    soon: "soon",
    toolsTitle: "Tools",
    toolsLead: "Web tools for bridge and structural engineering. They open in your browser, with nothing to install and no account.",
    toolsCount: n => `${n} tools`,
    lastUpdate: d => `last updated ${d}`,
    updated: d => `Updated ${d}`,
    code: "Code",
    open: "Open",
    newWindow: "(opens in a new window)",
    codeOf: n => `${n} source code on GitHub`,
    warning: "Indicative preliminary values only: the analysis tools are not a substitute for detailed design.",
    siteVersion: "Site",
    locale: "en-CA"
  }
};
