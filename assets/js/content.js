// Contenu du site. Pour ajouter un outil : une entrée dans TOOLS (avec sa catégorie).
// Pour ouvrir une section : passer ready à true et créer la page indiquée par href.
window.SITE = {
  version: "0.3",
  date: "2026-10-29",
  github: "acheruel",
  pages: "https://acheruel.github.io"
};

// href : relatif à la racine du site.
window.SECTIONS = [
  { id: "accueil", href: "accueil/", ready: false, label: { fr: "Accueil", en: "Home" } },
  { id: "cv", href: "cv/", ready: false, label: { fr: "Curriculum Vitae", en: "Curriculum Vitae" } },
  { id: "outils", href: "./", ready: true, label: { fr: "Outils", en: "Tools" } },
  { id: "ressources", href: "ressources/", ready: true, label: { fr: "Ressources", en: "Resources" } }
];

// Catégories de la page Outils, dans l'ordre d'affichage.
window.CATEGORIES = [
  { id: "ingenierie", label: { fr: "Ingénierie", en: "Engineering" } },
  { id: "productivite", label: { fr: "Productivité", en: "Productivity" } }
];

// name : [préfixe en clair, nom en gras], ex. ["Quicker", "Bridge"] ; ["", "Nom"] pour un nom tout en gras.
// logo : le même que l'en-tête de l'outil.
// updated : date de repli si l'API GitHub ne répond pas.
window.TOOLS = [
  {
    repo: "QuickerBridge",
    category: "ingenierie",
    name: ["Quicker", "Bridge"],
    logo: "assets/logos/quickerbridge.svg",
    updated: "2026-10-17",
    tagline: { fr: "Plus rapide et complet que QuickBridge", en: "Faster and more complete than QuickBridge" },
    desc: {
      fr: "Analyse de poutres continues par éléments finis (poutre d'Euler-Bernoulli, via PyCBA) : enveloppes CL-625, CL-750QC, piéton S7-23, lignes d'influence, facteur d'essieu S6-25 et bien plus !",
      en: "Continuous girder analysis with finite elements (Euler-Bernoulli beam, via PyCBA): CL-625, CL-750QC and S7-23 pedestrian envelopes, influence lines, S6-25 axle factor and much more!"
    }
  },
  {
    repo: "QuickerAtlas",
    category: "ingenierie",
    name: ["Quicker", "Atlas"],
    logo: "assets/logos/quickeratlas.svg",
    updated: "2026-10-24",
    tagline: { fr: "Atlas d'ouvrages d'art au Québec (et ailleurs)", en: "Atlas of bridges and structures in Québec (and beyond)" },
    desc: {
      fr: "Visualisation moderne de l'inventaire des structures du MTMD au Québec, avec ma touche personnelle : profil LiDAR, données des cours d'eau, sismiques, etc. ! À partir de données publiques.",
      en: "A modern view of the MTMD's structure inventory in Québec, with my personal touch: LiDAR profile, watercourse and seismic data, and more! Built from public data."
    }
  },
  {
    repo: "BridgeSketch-3D",
    category: "ingenierie",
    name: ["", "BridgeSketch 3D"],
    logo: "assets/logos/bridgesketch-3d.svg",
    updated: "2026-10-26",
    tagline: { fr: "Modèle 3D de pont pour visualisation architecturale", en: "3D bridge model for architectural visualization" },
    desc: {
      fr: "Esquisse interactive de ponts standards en 3D : travées, profil en travers, superstructure, appuis et site.",
      en: "Interactive 3D sketch of standard bridges: spans, cross-section, superstructure, supports and site."
    }
  },
  {
    repo: "QuickerUnits",
    category: "ingenierie",
    name: ["Quicker", "Units"],
    logo: "assets/logos/quickerunits.svg",
    updated: "2026-10-25",
    tagline: { fr: "Convertisseur d'unités", en: "Unit converter" },
    desc: {
      fr: "Convertisseur d'unités fait sur mesure pour les ingénieurs en structure/civil.",
      en: "A unit converter tailor-made for structural and civil engineers."
    }
  },
  {
    repo: "Extracto-Commento",
    category: "productivite",
    name: ["", "Extracto Commento"],
    logo: "assets/logos/extracto-commento.svg",
    updated: "2026-10-03",
    tagline: { fr: "Extraction de commentaires PDF", en: "PDF comment extraction" },
    desc: {
      fr: "Extrait les commentaires de vos PDF vers un fichier Excel, directement dans le navigateur. Les fichiers ne quittent pas votre poste.",
      en: "Extracts the comments from your PDFs into an Excel file, right in the browser. Your files never leave your computer."
    }
  },
  {
    repo: "Arborescento",
    category: "productivite",
    name: ["", "Arborescento"],
    logo: "assets/logos/arborescento.svg",
    updated: "2026-10-28",
    tagline: { fr: "Arborescence de dossiers vers Excel", en: "Folder tree to Excel" },
    desc: {
      fr: "Liste l'arborescence d'un dossier, local ou réseau, avec filtres, carte mentale, statistiques et export Excel. Seuls les noms, tailles et dates sont lus, rien ne quitte votre poste.",
      en: "Lists the tree of a local or network folder, with filters, mind map, statistics and Excel export. Only names, sizes and dates are read; nothing leaves your computer."
    }
  }
];

// toolsIntro : un paragraphe par entrée ; {github} devient le lien vers le compte GitHub.
// pageTitle : titre de l'onglet du navigateur, par page (attribut data-page de <body>).
window.I18N = {
  fr: {
    pageTitle: {
      outils: "Anthony Chéruel · Outils",
      ressources: "Anthony Chéruel · Ressources",
      "aide-memoire": "Aide-mémoire de mathématiques · Anthony Chéruel"
    },
    skip: "Aller au contenu",
    navLabel: "Sections",
    soon: "bientôt",
    toolsTitle: "Outils",
    toolsIntro: [
      "Des outils que j'ai programmés de zéro avec l'aide de l'IA pour m'aider au quotidien dans des tâches d'ingénierie ou administratives. Ils s'ouvrent dans le navigateur, sans installation ni compte. Ce sont des outils open source hébergés sur {github}.",
      "J'ai développé ces outils par curiosité, pour mon apprentissage, et parfois pour répondre à un besoin précis que j'ai eu par le passé. J'ai pris soin de valider ces outils dans plusieurs cas, mais des bugs ont pu subsister. Ces outils sont donc à utiliser avec précaution et je conseille de toujours vérifier les résultats.",
      "N'hésitez pas à communiquer avec moi si vous avez des commentaires et suggestions !"
    ],
    toolCount: n => (n > 1 ? `${n} outils` : "1 outil"),
    updated: d => `Mis à jour le ${d}`,
    code: "Code",
    open: "Ouvrir",
    newWindow: "(s'ouvre dans une nouvelle fenêtre)",
    codeOf: n => `Code source de ${n} sur GitHub`,
    locale: "fr-CA"
  },
  en: {
    pageTitle: {
      outils: "Anthony Chéruel · Tools",
      ressources: "Anthony Chéruel · Resources",
      "aide-memoire": "Math reference sheet · Anthony Chéruel"
    },
    skip: "Skip to content",
    navLabel: "Sections",
    soon: "soon",
    toolsTitle: "Tools",
    toolsIntro: [
      "Tools I programmed from scratch with the help of AI to support my day-to-day engineering and administrative work. They open in your browser, with nothing to install and no account. They are open source and hosted on {github}.",
      "I built these tools out of curiosity, to learn, and sometimes to meet a specific need I had in the past. I took care to validate them on several cases, but bugs may remain. Use them with caution, and I recommend always checking the results.",
      "Feel free to reach out if you have comments or suggestions!"
    ],
    toolCount: n => (n > 1 ? `${n} tools` : "1 tool"),
    updated: d => `Updated ${d}`,
    code: "Code",
    open: "Open",
    newWindow: "(opens in a new window)",
    codeOf: n => `${n} source code on GitHub`,
    locale: "en-CA"
  }
};
