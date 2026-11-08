// Relais d'un fichier d'un outil à l'autre (PDFo Converto → MarkDownO), sur le même appareil :
// le fichier est déposé dans le stockage local du navigateur (IndexedDB), repris une seule fois
// par la page suivante, puis effacé. Rien n'est envoyé sur le réseau.
const DB = "outils-relais", STORE = "fichiers", KEY = "dernier";
const MAX_AGE = 10 * 60 * 1000;

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function tx(db, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
  });
}

/** Dépose un fichier : { name, bytes (Uint8Array), pages (ex. « 1-10 ») }. */
export async function deposer({ name, bytes, pages = "" }) {
  const db = await open();
  try { await tx(db, "readwrite", s => s.put({ name, bytes, pages, at: Date.now() }, KEY)); }
  finally { db.close(); }
}

/** Reprend le fichier déposé (et l'efface) : { file: File, pages } ou null. */
export async function reprendre() {
  const db = await open();
  try {
    const v = await tx(db, "readonly", s => s.get(KEY));
    await tx(db, "readwrite", s => s.delete(KEY));
    if (!v || Date.now() - v.at > MAX_AGE) return null;
    return { file: new File([v.bytes], v.name, { type: "application/pdf" }), pages: v.pages || "" };
  } finally { db.close(); }
}
