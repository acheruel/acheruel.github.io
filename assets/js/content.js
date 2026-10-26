// Contenu du site. Pour ajouter un outil : une entrée dans TOOLS.
// Pour ouvrir une section : passer ready à true et créer la page indiquée par href.
window.SITE = {
  version: "0.2",
  date: "2026-10-26",
  github: "acheruel",
  pages: "https://acheruel.github.io"
};

window.SECTIONS = [
  { id: "accueil", href: "accueil/", ready: false, label: { fr: "Accueil", en: "Home" } },
  { id: "cv", href: "cv/", ready: false, label: { fr: "Curriculum Vitae", en: "Curriculum Vitae" } },
  { id: "outils", href: "./", ready: true, label: { fr: "Outils", en: "Tools" } },
  { id: "ressources", href: "ressources/", ready: false, label: { fr: "Ressources", en: "Resources" } }
];

// name : [préfixe en clair, nom en gras], ex. ["Quicker", "Bridge"] ; ["", "Nom"] pour un nom tout en gras.
// logo : le même que l'en-tête de l'outil.
// updated : date de repli si l'API GitHub ne répond pas.
window.TOOLS = [
  {
    repo: "QuickerBridge",
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
    name: ["Quicker", "Atlas"],
    logo: "assets/logos/quickeratlas.svg",
    updated: "2026-10-24",
    tagline: { fr: "Atlas d'ouvrages d'art au Québec (et ailleurs)", en: "Atlas of some of Québec's structures" },
    desc: {
      fr: "Visualisation moderne de l'inventaire des structures du MTMD au Québec, avec ma touche personnelle : profil LiDAR, données des cours d'eau,sismiques, etc ! À partir de données publiques.",
      en: "A modern view of the MTMD's structure inventory in Québec, with my personal touch: LiDAR profile, watercourse and seismic data, and much more! All from public data."
    }
  },
  {
    repo: "BridgeSketch-3D",
    name: ["", "BridgeSketch 3D"],
    logo: "assets/logos/bridgesketch-3d.svg",
    updated: "2026-10-26",
    tagline: { fr: "Modèle 3D de pont pour visualisation architecturale", en: "3D bridge model for architectural visualization " },
    desc: {
      fr: "Esquisse interactive de ponts standards en 3D : travées, profil en travers, superstructure, appuis et site.",
      en: "Interactive 3D bridge sketch: span arrangement, road section, superstructure, supports and site."
    }
  },
  {
    repo: "QuickerUnits",
    name: ["Quicker", "Units"],
    logo: "assets/logos/quickerunits.svg",
    updated: "2026-10-25",
    tagline: { fr: "Convertisseur d'unités", en: "Units converter" },
    desc: {
      fr: "Convertisseur d'unités fait sur mesure pour les ingénieurs en structure/civil.",
      en: "A unit converter tailor-made for structural and civil engineers."
    }
  },
  {
    repo: "Extracto-Commento",
    name: ["", "Extracto Commento"],
    logo: "assets/logos/extracto-commento.svg",
    updated: "2026-10-03",
    tagline: { fr: "Extraction de commentaires PDF", en: "PDF comments extractor" },
    desc: {
      fr: "Extrait les commentaires de vos PDF vers un fichier Excel, directement dans le navigateur. Les fichiers ne quittent pas votre poste.",
      en: "Extracts the comments of your PDFs into an Excel file, right in the browser. Your files never leave your computer."
    }
  }
];

// toolsIntro : un paragraphe par entrée ; {github} devient le lien vers le compte GitHub.
window.I18N = {
  fr: {
    title: "Anthony Chéruel · Outils",
    skip: "Aller au contenu",
    navLabel: "Sections",
    soon: "bientôt",
    toolsTitle: "Outils",
    toolsIntro: [
      "Des outils que j'ai programmé de zéro avec l'aide de l'IA pour m'aider au quotidien dans des tâches d'ingénierie ou administratives. Ils s'ouvrent dans le navigateur, sans installation ni compte. Ce sont des outils open source hébergés sur {github}.",
      "J'ai développé ces outils par curiosité, pour mon apprentissage, et parfois pour répondre à un besoin précis que j'ai eu par le passé. J'ai pris soin de valider ces outils dans plusieurs cas, mais des bugs ont pu subsister. Ces outils sont donc à utiliser avec précaution et je conseille de toujours vérifier les résultats.",
      "N'hésitez pas à communiquer avec moi si vous avez des commentaires et suggestions !"
    ],
    updated: d => `Mis à jour le ${d}`,
    code: "Code",
    open: "Ouvrir",
    newWindow: "(s'ouvre dans une nouvelle fenêtre)",
    codeOf: n => `Code source de ${n} sur GitHub`,
    locale: "fr-CA"
  },
  en: {
    title: "Anthony Chéruel · Tools",
    skip: "Skip to content",
    navLabel: "Sections",
    soon: "soon",
    toolsTitle: "Tools",
    toolsIntro: [
      "Web tools I programmed from scratch (with the help of AI) for engineering or productivity to help in my day to day. They open in your browser, with nothing to install and no account. They are open source and hosted on {github}.",
      "I built these tools out of curiosity, to meet a specific need I had in the past, and also to learn. I took care to validate them on several cases, but bugs may remain. Use them with caution, and I recommend always checking the results.",
      "Feel free to send me your comments and suggestions!"
    ],
    updated: d => `Updated ${d}`,
    code: "Code",
    open: "Open",
    newWindow: "(opens in a new window)",
    codeOf: n => `${n} source code on GitHub`,
    locale: "en-CA"
  }
};
