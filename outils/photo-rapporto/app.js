// Photo Rapporto : photos, légendes, informations du projet, aperçu et export PDF.
// Tout reste dans le navigateur : les informations (texte prédéfini, modèles, logo) dans localStorage,
// les photos et leurs légendes dans IndexedDB, pour reprendre un rapport après un rechargement.
(() => {
  "use strict";

  const { layout, drawPage, toPDF } = window.PhotoReport;
  const $ = id => document.getElementById(id);
  const LS = { settings: "photo-rapporto:settings", presets: "photo-rapporto:presets", zoom: "photo-rapporto:zoom" };
  const THUMB = 720; // px, grand côté des miniatures (grille et aperçu)

  const DEFAULT_OPTS = { perPage: 2, paper: "letter", orientation: "portrait", quality: "standard", cover: false, showDate: true, numbering: true, showFile: false };
  const QUALITY = { compact: { dpi: 120, q: 0.62 }, standard: { dpi: 200, q: 0.82 }, high: { dpi: 300, q: 0.9 } };
  const INFO_KEYS = ["title", "projectName", "projectNo", "contractNo", "client", "location", "author", "reportDate", "visitDate", "weather", "notes"];

  const TXT = {
    fr: {
      locale: "fr-CA",
      defaultTitle: "Rapport photo",
      photo: "Photo",
      project: "Projet",
      contract: "Contrat",
      notes: "Introduction",
      caption: "Légende :",
      page: (i, n) => `Page ${i} / ${n}`,
      photoCount: n => (n > 1 ? `${n} photos` : n === 1 ? "1 photo" : "Aucune photo"),
      fields: { projectNo: "N° de projet", contractNo: "N° de contrat", client: "Client", location: "Lieu", author: "Préparé par", reportDate: "Date du rapport", visitDate: "Date de la visite", weather: "Météo" },
      pages: n => (n > 1 ? `${n} pages` : "1 page"),
      paper: { letter: "Lettre", a4: "A4" },
      orient: { portrait: "portrait", landscape: "paysage" },
      empty: "Ajoutez des photos pour commencer.",
      noPhotosPreview: "Aucune photo pour l'instant : l'aperçu montre la première page.",
      restored: n => `${n} photo${n > 1 ? "s" : ""} retrouvée${n > 1 ? "s" : ""} de la dernière session.`,
      added: n => `${n} photo${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}.`,
      unsupported: names => `Format non pris en charge (HEIC ?) : ${names}. Exportez-les en JPEG.`,
      preparing: (i, n) => `Préparation des images… ${i} / ${n}`,
      building: "Assemblage du PDF…",
      ready: name => `PDF prêt : ${name}`,
      failed: "L'export a échoué. Essayez la qualité Compacte ou moins de photos.",
      confirmClear: "Retirer toutes les photos et leurs légendes ?",
      presetName: "Nom du modèle :",
      presetSaved: name => `Modèle « ${name} » enregistré.`,
      presetDeleted: name => `Modèle « ${name} » supprimé.`,
      confirmDelete: name => `Supprimer le modèle « ${name} » ?`,
      fieldLabel: "Libellé",
      fieldValue: "Valeur",
      removeField: "Retirer ce champ",
      captionOf: n => `Légende de la photo ${n}`,
      photoN: (n, total) => `Photo ${n} sur ${total}`,
      noDate: "date inconnue",
      fileName: "Rapport-photo"
    },
    en: {
      locale: "en-CA",
      defaultTitle: "Photo report",
      photo: "Photo",
      project: "Project",
      contract: "Contract",
      notes: "Introduction",
      caption: "Caption:",
      page: (i, n) => `Page ${i} of ${n}`,
      photoCount: n => (n > 1 ? `${n} photos` : n === 1 ? "1 photo" : "No photos"),
      fields: { projectNo: "Project no.", contractNo: "Contract no.", client: "Client", location: "Location", author: "Prepared by", reportDate: "Report date", visitDate: "Visit date", weather: "Weather" },
      pages: n => (n > 1 ? `${n} pages` : "1 page"),
      paper: { letter: "Letter", a4: "A4" },
      orient: { portrait: "portrait", landscape: "landscape" },
      empty: "Add photos to get started.",
      noPhotosPreview: "No photos yet: the preview shows the first page.",
      restored: n => `${n} photo${n > 1 ? "s" : ""} restored from your last session.`,
      added: n => `${n} photo${n > 1 ? "s" : ""} added.`,
      unsupported: names => `Unsupported format (HEIC?): ${names}. Export them as JPEG.`,
      preparing: (i, n) => `Preparing images… ${i} / ${n}`,
      building: "Building the PDF…",
      ready: name => `PDF ready: ${name}`,
      failed: "The export failed. Try Compact quality or fewer photos.",
      confirmClear: "Remove all photos and their captions?",
      presetName: "Template name:",
      presetSaved: name => `Template “${name}” saved.`,
      presetDeleted: name => `Template “${name}” deleted.`,
      confirmDelete: name => `Delete the template “${name}”?`,
      fieldLabel: "Label",
      fieldValue: "Value",
      removeField: "Remove this field",
      captionOf: n => `Caption of photo ${n}`,
      photoN: (n, total) => `Photo ${n} of ${total}`,
      noDate: "unknown date",
      fileName: "Photo-report"
    }
  };
  const lang = () => (window.siteLang && window.siteLang() === "en" ? "en" : "fr");
  const t = () => TXT[lang()];

  // ---------- Stockage ----------
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  };

  const db = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open("photo-rapporto", 1);
      req.onupgradeneeded = () => { req.result.createObjectStore("blobs"); req.result.createObjectStore("meta"); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
    const run = (storeName, mode, fn) => open().then(d => new Promise((resolve, reject) => {
      const tx = d.transaction(storeName, mode);
      const r = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    }));
    return {
      putBlob: (id, blob) => run("blobs", "readwrite", s => s.put(blob, id)).catch(() => {}),
      getBlob: id => run("blobs", "readonly", s => s.get(id)).catch(() => null),
      delBlob: id => run("blobs", "readwrite", s => s.delete(id)).catch(() => {}),
      clearBlobs: () => run("blobs", "readwrite", s => s.clear()).catch(() => {}),
      putMeta: list => run("meta", "readwrite", s => s.put(list, "list")).catch(() => {}),
      getMeta: () => run("meta", "readonly", s => s.get("list")).catch(() => null)
    };
  })();

  // ---------- État ----------
  const saved = store.get(LS.settings, {});
  const state = {
    photos: [], // { id, name, taken, caption, rotation, w, h, url, thumbUrl, thumb (Image) }
    info: Object.fromEntries(INFO_KEYS.map(k => [k, (saved.info || {})[k] || ""])),
    extra: Array.isArray(saved.extra) ? saved.extra : [],
    opts: { ...DEFAULT_OPTS, ...(saved.opts || {}) },
    logo: saved.logo || null, // { url (PNG data URL), w, h }
    tab: "photos"
  };
  let logoImg = null;

  const saveSettings = () => store.set(LS.settings, { info: state.info, extra: state.extra, opts: state.opts, logo: state.logo });
  let metaTimer = 0;
  const saveMeta = () => {
    clearTimeout(metaTimer);
    metaTimer = setTimeout(() => db.putMeta(state.photos.map(p => ({ id: p.id, name: p.name, taken: p.taken, caption: p.caption, rotation: p.rotation }))), 300);
  };

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const fmtDate = iso => {
    const [y, mo, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(t().locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, mo - 1, d));
  };
  const fmtDateTime = ms => new Intl.DateTimeFormat(t().locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));

  // ---------- Images ----------
  const loadImage = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });

  // Date de prise de vue (EXIF DateTimeOriginal) d'un JPEG, sinon null.
  async function exifDate(blob) {
    try {
      const v = new DataView(await blob.slice(0, 256 * 1024).arrayBuffer());
      if (v.getUint16(0) !== 0xffd8) return null;
      let off = 2;
      while (off + 10 < v.byteLength) {
        const marker = v.getUint16(off), len = v.getUint16(off + 2);
        if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
          const tt = off + 10, le = v.getUint16(tt) === 0x4949;
          const u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
          const find = (ifd, tag) => {
            const n = u16(tt + ifd);
            for (let i = 0; i < n; i++) { const e = tt + ifd + 2 + i * 12; if (e + 12 > v.byteLength) return null; if (u16(e) === tag) return e; }
            return null;
          };
          const ascii = e => {
            const cnt = u32(e + 4), o = cnt > 4 ? tt + u32(e + 8) : e + 8;
            let s = "";
            for (let i = 0; i < cnt - 1 && o + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(o + i));
            return s;
          };
          const ifd0 = u32(tt + 4);
          let s = null;
          const ptr = find(ifd0, 0x8769);
          if (ptr) { const sub = u32(ptr + 8); const e = find(sub, 0x9003) || find(sub, 0x9004); if (e) s = ascii(e); }
          if (!s) { const e = find(ifd0, 0x0132); if (e) s = ascii(e); }
          const mm = s && s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
          return mm ? new Date(+mm[1], mm[2] - 1, +mm[3], +mm[4], +mm[5], +(mm[6] || 0)).getTime() : null;
        }
        if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
        off += 2 + len;
      }
    } catch { /* EXIF illisible : date du fichier */ }
    return null;
  }

  // Dessine l'image tournée (0, 90, 180, 270°) sur un canevas, grand côté limité à maxSide.
  function rotatedCanvas(img, rotation, maxSide) {
    const sw = img.naturalWidth, sh = img.naturalHeight;
    const s = Math.min(1, maxSide / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
    const turn = rotation % 180 !== 0;
    const c = document.createElement("canvas");
    c.width = turn ? h : w;
    c.height = turn ? w : h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = "high";
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    return c;
  }
  const canvasBlob = (c, type = "image/jpeg", q = 0.85) => new Promise(resolve => c.toBlob(resolve, type, q));

  async function makeThumb(p) {
    const img = await loadImage(p.url);
    p.srcW = img.naturalWidth;
    p.srcH = img.naturalHeight;
    const c = rotatedCanvas(img, p.rotation, THUMB);
    p.w = c.width;
    p.h = c.height;
    const blob = await canvasBlob(c, "image/jpeg", 0.85);
    if (p.thumbUrl) URL.revokeObjectURL(p.thumbUrl);
    p.thumbUrl = URL.createObjectURL(blob);
    p.thumb = await loadImage(p.thumbUrl);
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  async function addFiles(files) {
    const list = [...files].filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(f.name));
    if (!list.length) return;
    const bad = [];
    let added = 0;
    status(t().preparing(0, list.length));
    for (const [k, file] of list.entries()) {
      const p = { id: uid(), name: file.name, caption: "", rotation: 0, url: URL.createObjectURL(file) };
      try {
        await makeThumb(p);
      } catch {
        URL.revokeObjectURL(p.url);
        bad.push(file.name);
        continue;
      }
      p.taken = (await exifDate(file)) ?? (file.lastModified || null);
      state.photos.push(p);
      db.putBlob(p.id, file);
      added++;
      status(t().preparing(k + 1, list.length));
      if (k % 4 === 3) renderPhotos();
    }
    renderPhotos();
    saveMeta();
    refresh();
    status(bad.length ? t().unsupported(bad.join(", ")) : t().added(added), !!bad.length);
  }

  async function restorePhotos() {
    const meta = await db.getMeta();
    if (!Array.isArray(meta) || !meta.length) return 0;
    for (const m of meta) {
      const blob = await db.getBlob(m.id);
      if (!blob) continue;
      const p = { ...m, url: URL.createObjectURL(blob) };
      try { await makeThumb(p); } catch { URL.revokeObjectURL(p.url); continue; }
      state.photos.push(p);
    }
    return state.photos.length;
  }

  function removePhoto(id) {
    const i = state.photos.findIndex(p => p.id === id);
    if (i < 0) return;
    const [p] = state.photos.splice(i, 1);
    URL.revokeObjectURL(p.url);
    URL.revokeObjectURL(p.thumbUrl);
    db.delBlob(p.id);
    renderPhotos();
    saveMeta();
    refresh();
  }

  function movePhoto(id, delta) {
    const i = state.photos.findIndex(p => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= state.photos.length) return;
    const [p] = state.photos.splice(i, 1);
    state.photos.splice(j, 0, p);
    renderPhotos();
    saveMeta();
    refresh();
    cards.get(id)?.querySelector(`[data-act="${delta < 0 ? "left" : "right"}"]`)?.focus();
  }

  async function rotatePhoto(id) {
    const p = state.photos.find(x => x.id === id);
    if (!p) return;
    p.rotation = (p.rotation + 90) % 360;
    await makeThumb(p);
    renderPhotos();
    saveMeta();
    refresh();
  }

  // ---------- Grille des photos ----------
  const list = $("photos");
  const tpl = $("photo-template");
  const cards = new Map();

  // Même convention que site.js : data-en / data-en-label / data-en-placeholder / data-en-title.
  const SWAPS = [["en", null], ["enLabel", "aria-label"], ["enPlaceholder", "placeholder"], ["enTitle", "title"]];
  function localize(root) {
    for (const [key, attr] of SWAPS) {
      const sel = `[data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}]`;
      root.querySelectorAll(sel).forEach(el => {
        const frKey = `fr${key.slice(2)}`;
        if (el.dataset[frKey] === undefined) el.dataset[frKey] = attr ? el.getAttribute(attr) ?? "" : el.textContent;
        const value = lang() === "en" ? el.dataset[key] : el.dataset[frKey];
        if (attr) el.setAttribute(attr, value); else el.textContent = value;
      });
    }
  }

  function card(p) {
    let li = cards.get(p.id);
    if (li) return li;
    li = tpl.content.firstElementChild.cloneNode(true);
    li.dataset.id = p.id;
    const ta = li.querySelector("textarea");
    ta.value = p.caption;
    ta.addEventListener("input", () => { p.caption = ta.value; saveMeta(); refreshSoon(); });
    localize(li);
    cards.set(p.id, li);
    return li;
  }

  function renderPhotos() {
    const n = state.photos.length;
    for (const [id, li] of cards) if (!state.photos.some(p => p.id === id)) { li.remove(); cards.delete(id); }
    state.photos.forEach((p, i) => {
      const li = card(p);
      li.querySelector(".photo-num").textContent = `${t().photo} ${i + 1}`;
      li.querySelector(".photo-date").textContent = p.taken ? fmtDateTime(p.taken) : t().noDate;
      const img = li.querySelector(".thumb img");
      if (img.getAttribute("src") !== p.thumbUrl) img.src = p.thumbUrl;
      img.alt = p.name;
      li.querySelector(".thumb").setAttribute("aria-label", t().photoN(i + 1, n));
      li.querySelector(".caption-of").textContent = t().captionOf(i + 1);
      li.querySelector('[data-act="left"]').disabled = i === 0;
      li.querySelector('[data-act="right"]').disabled = i === n - 1;
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
    });
    $("photo-bar").hidden = n === 0;
    $("drop").classList.toggle("is-compact", n > 0);
    $("count-photos").textContent = n;
  }

  list.addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".photo").dataset.id;
    const act = btn.dataset.act;
    if (act === "delete") removePhoto(id);
    else if (act === "left") movePhoto(id, -1);
    else if (act === "right") movePhoto(id, 1);
    else if (act === "rotate") rotatePhoto(id);
    else if (act === "view") openViewer(id);
  });

  if (window.Sortable) {
    window.Sortable.create(list, {
      handle: ".handle",
      animation: 160,
      ghostClass: "is-ghost",
      chosenClass: "is-chosen",
      dragClass: "is-drag",
      onEnd() {
        const order = [...list.children].map(li => li.dataset.id);
        state.photos.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        renderPhotos();
        saveMeta();
        refresh();
      }
    });
  }

  $("sort").addEventListener("change", e => {
    const how = e.target.value;
    e.target.value = "";
    if (how === "date") state.photos.sort((a, b) => (a.taken ?? Infinity) - (b.taken ?? Infinity));
    else if (how === "name") state.photos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    else if (how === "reverse") state.photos.reverse();
    else return;
    renderPhotos();
    saveMeta();
    refresh();
  });

  $("clear-photos").addEventListener("click", () => {
    if (!confirm(t().confirmClear)) return;
    for (const p of state.photos) { URL.revokeObjectURL(p.url); URL.revokeObjectURL(p.thumbUrl); }
    state.photos = [];
    db.clearBlobs();
    db.putMeta([]);
    renderPhotos();
    refresh();
  });

  // Dépôt et sélection de fichiers
  const drop = $("drop");
  $("pick").addEventListener("click", () => $("file-input").click());
  $("file-input").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
  if (matchMedia("(pointer: coarse)").matches) {
    $("camera").hidden = false;
    $("camera").addEventListener("click", () => $("camera-input").click());
    $("camera-input").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
  }
  ["dragenter", "dragover"].forEach(ev => document.addEventListener(ev, e => {
    if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
    e.preventDefault();
    drop.classList.add("is-over");
  }));
  ["dragleave", "drop"].forEach(ev => document.addEventListener(ev, e => {
    if (ev === "dragleave" && e.relatedTarget) return;
    drop.classList.remove("is-over");
  }));
  document.addEventListener("drop", e => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    showTab("photos");
    addFiles(e.dataTransfer.files);
  });
  // Coller une image (Ctrl+V)
  document.addEventListener("paste", e => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length && !e.target.closest("input, textarea")) { e.preventDefault(); addFiles(files); }
  });

  // ---------- Agrandissement ----------
  const viewer = $("viewer");
  let viewing = null;
  function openViewer(id) {
    viewing = id;
    showViewer();
    if (!viewer.open) viewer.showModal();
  }
  function showViewer() {
    const i = state.photos.findIndex(p => p.id === viewing);
    if (i < 0) { viewer.close(); return; }
    const p = state.photos[i];
    $("viewer-title").textContent = `${t().photoN(i + 1, state.photos.length)}${p.taken ? ` · ${fmtDateTime(p.taken)}` : ""}`;
    const img = $("viewer-img");
    img.src = p.url;
    img.alt = p.name;
    img.dataset.rot = p.rotation;
    $("viewer-caption").value = p.caption;
    $("viewer-prev").disabled = i === 0;
    $("viewer-next").disabled = i === state.photos.length - 1;
  }
  const step = d => {
    const i = state.photos.findIndex(p => p.id === viewing) + d;
    if (i >= 0 && i < state.photos.length) { viewing = state.photos[i].id; showViewer(); }
  };
  $("viewer-prev").addEventListener("click", () => step(-1));
  $("viewer-next").addEventListener("click", () => step(1));
  $("viewer-close").addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", e => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener("keydown", e => {
    if (e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  $("viewer-caption").addEventListener("input", e => {
    const p = state.photos.find(x => x.id === viewing);
    if (!p) return;
    p.caption = e.target.value;
    const ta = cards.get(p.id)?.querySelector("textarea");
    if (ta) ta.value = p.caption;
    saveMeta();
    refreshSoon();
  });
  // Balayage gauche / droite sur l'image (écran tactile)
  let swipeX = null;
  $("viewer-img").addEventListener("pointerdown", e => { swipeX = e.clientX; });
  $("viewer-img").addEventListener("pointerup", e => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  // ---------- Informations et mise en page ----------
  const fieldsBox = $("fields");
  function fillInfo() {
    fieldsBox.querySelectorAll("[data-key]").forEach(el => { el.value = state.info[el.dataset.key] || ""; });
  }
  fieldsBox.addEventListener("input", e => {
    const key = e.target.dataset.key;
    if (!key) return;
    state.info[key] = e.target.value;
    saveSettings();
    refreshSoon();
  });

  const extraBox = $("extra");
  function renderExtra() {
    extraBox.replaceChildren(...state.extra.map((f, i) => {
      const row = document.createElement("div");
      row.className = "extra-row";
      row.innerHTML = `<input class="extra-label" autocomplete="off"><input class="extra-value" autocomplete="off"><button type="button" class="icon-btn danger"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>`;
      const [label, value, del] = row.children;
      label.value = f.label || "";
      value.value = f.value || "";
      label.placeholder = t().fieldLabel;
      value.placeholder = t().fieldValue;
      label.setAttribute("aria-label", t().fieldLabel);
      value.setAttribute("aria-label", t().fieldValue);
      del.setAttribute("aria-label", t().removeField);
      label.addEventListener("input", () => { f.label = label.value; saveSettings(); refreshSoon(); });
      value.addEventListener("input", () => { f.value = value.value; saveSettings(); refreshSoon(); });
      del.addEventListener("click", () => { state.extra.splice(i, 1); renderExtra(); saveSettings(); refresh(); });
      return row;
    }));
  }
  $("add-field").addEventListener("click", () => {
    state.extra.push({ label: "", value: "" });
    renderExtra();
    extraBox.lastElementChild.querySelector("input").focus();
    saveSettings();
  });

  function renderOpts() {
    document.querySelectorAll(".seg[data-opt]").forEach(seg => {
      seg.querySelectorAll("button").forEach(btn => {
        const on = String(state.opts[seg.dataset.opt]) === btn.dataset.value;
        btn.classList.toggle("selected", on);
        btn.setAttribute("aria-checked", String(on));
        btn.tabIndex = on ? 0 : -1;
      });
    });
    document.querySelectorAll("input[type=checkbox][data-opt]").forEach(cb => { cb.checked = !!state.opts[cb.dataset.opt]; });
  }
  // Groupes de boutons radio (options et zoom) : clic et flèches
  function segValue(seg, btn) {
    if (seg.dataset.opt) {
      const v = btn.dataset.value;
      state.opts[seg.dataset.opt] = seg.dataset.opt === "perPage" ? Number(v) : v;
      renderOpts();
      saveSettings();
      refresh();
    } else if (seg.id === "zoom") setZoom(btn.dataset.value);
  }
  document.querySelectorAll(".seg").forEach(seg => {
    seg.addEventListener("click", e => { const btn = e.target.closest("button"); if (btn) segValue(seg, btn); });
    seg.addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const btns = [...seg.querySelectorAll("button")];
      const i = btns.indexOf(document.activeElement);
      const next = btns[(i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + btns.length) % btns.length];
      next.focus();
      segValue(seg, next);
    });
  });
  document.querySelectorAll("input[type=checkbox][data-opt]").forEach(cb => cb.addEventListener("change", () => {
    state.opts[cb.dataset.opt] = cb.checked;
    saveSettings();
    refresh();
  }));

  // Logo : converti en PNG (transparence conservée), 600 px au plus.
  async function setLogoFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 200;
      const s = Math.min(1, 600 / Math.max(w0, h0));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * s));
      c.height = Math.max(1, Math.round(h0 * s));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      state.logo = { url: c.toDataURL("image/png"), w: c.width, h: c.height };
      await renderLogo();
      saveSettings();
      refresh();
    } catch {
      status(t().unsupported(file.name), true);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function renderLogo() {
    const box = $("logo-box");
    box.replaceChildren();
    logoImg = null;
    $("logo-clear").hidden = !state.logo;
    if (!state.logo) {
      const span = document.createElement("span");
      span.textContent = "Logo";
      box.append(span);
      return;
    }
    logoImg = await loadImage(state.logo.url).catch(() => null);
    if (logoImg) box.append(logoImg);
  }
  $("logo-pick").addEventListener("click", () => $("logo-input").click());
  $("logo-input").addEventListener("change", e => { if (e.target.files[0]) setLogoFromFile(e.target.files[0]); e.target.value = ""; });
  $("logo-clear").addEventListener("click", () => { state.logo = null; renderLogo(); saveSettings(); refresh(); });

  // Modèles : informations (sans les dates), champs ajoutés, mise en page et logo.
  const presetSelect = $("preset-select");
  const presets = () => store.get(LS.presets, {});
  function renderPresets(selected = presetSelect.value) {
    const all = presets();
    const first = presetSelect.options[0];
    presetSelect.replaceChildren(first, ...Object.keys(all).sort((a, b) => a.localeCompare(b)).map(name => new Option(name, name)));
    presetSelect.value = all[selected] ? selected : "";
    $("preset-delete").disabled = !presetSelect.value;
  }
  presetSelect.addEventListener("change", () => {
    const p = presets()[presetSelect.value];
    $("preset-delete").disabled = !p;
    if (!p) return;
    const { reportDate, visitDate } = state.info;
    state.info = { ...Object.fromEntries(INFO_KEYS.map(k => [k, ""])), ...p.info, reportDate, visitDate };
    state.extra = (p.extra || []).map(f => ({ ...f }));
    state.opts = { ...DEFAULT_OPTS, ...p.opts };
    state.logo = p.logo || null;
    fillInfo();
    renderExtra();
    renderOpts();
    renderLogo().then(refresh);
    saveSettings();
  });
  $("preset-save").addEventListener("click", () => {
    const name = (prompt(t().presetName, presetSelect.value || state.info.projectName || state.info.client || "") || "").trim();
    if (!name) return;
    const all = presets();
    const { reportDate, visitDate, ...info } = state.info;
    all[name] = { info, extra: state.extra, opts: state.opts, logo: state.logo };
    store.set(LS.presets, all);
    renderPresets(name);
    status(t().presetSaved(name));
  });
  $("preset-delete").addEventListener("click", () => {
    const name = presetSelect.value;
    if (!name || !confirm(t().confirmDelete(name))) return;
    const all = presets();
    delete all[name];
    store.set(LS.presets, all);
    renderPresets("");
    status(t().presetDeleted(name));
  });

  // ---------- Mise en page, aperçu, export ----------
  function buildLayout() {
    return layout({
      photos: state.photos.map((p, index) => ({ index, w: p.w, h: p.h, caption: p.caption, taken: p.taken, name: p.name })),
      info: { ...state.info },
      extra: state.extra,
      opts: state.opts,
      logo: state.logo ? { w: state.logo.w, h: state.logo.h } : null,
      t: t(),
      fmtDate,
      fmtDateTime
    });
  }

  let doc = null;
  function refresh() {
    doc = buildLayout();
    const n = state.photos.length;
    $("export").disabled = n === 0;
    $("preview-summary").textContent = [
      t().photoCount(n), t().pages(doc.pages.length),
      `${t().paper[state.opts.paper]} ${t().orient[state.opts.orientation]}`
    ].join(" · ") + (n ? "" : ` — ${t().noPhotosPreview}`);
    if (!busy) status(n ? `${t().photoCount(n)} · ${t().pages(doc.pages.length)}` : t().empty);
    if (state.tab === "preview") renderPreview();
  }
  let refreshTimer = 0;
  const refreshSoon = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 250); };

  const ZOOM = { s: 190, m: 270, l: 400 };
  let zoom = ["s", "m", "l"].includes(store.get(LS.zoom, "m")) ? store.get(LS.zoom, "m") : "m";
  function setZoom(z) {
    zoom = z;
    store.set(LS.zoom, z);
    $("zoom").querySelectorAll("button").forEach(b => {
      const on = b.dataset.value === z;
      b.classList.toggle("selected", on);
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (state.tab === "preview") renderPreview();
  }

  const pagesBox = $("pages");
  function renderPreview() {
    if (!doc) doc = buildLayout();
    const avail = pagesBox.clientWidth || 800;
    const width = Math.min(ZOOM[zoom], avail - 2);
    const getImage = op => (op.src === "logo" ? logoImg : state.photos[op.i]?.thumb || null);
    const figs = [...pagesBox.children];
    doc.pages.forEach((_, k) => {
      let fig = figs[k];
      if (!fig) {
        fig = document.createElement("figure");
        fig.className = "sheet";
        fig.innerHTML = "<canvas></canvas><figcaption></figcaption>";
        pagesBox.append(fig);
      }
      drawPage(fig.firstChild, doc, k, width, getImage);
      fig.lastChild.textContent = t().page(k + 1, doc.pages.length);
    });
    figs.slice(doc.pages.length).forEach(f => f.remove());
  }

  let busy = false;
  const statusEl = $("status");
  function status(msg, warn = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-warn", warn);
  }

  async function exportPDF() {
    if (!state.photos.length || busy) return;
    busy = true;
    const btn = $("export");
    btn.disabled = true;
    btn.classList.add("is-busy");
    try {
      const d = buildLayout();
      // Compacte : PDF léger (courriel) mais photos nettes à l'écran et à l'impression bureautique.
      const { dpi, q } = QUALITY[state.opts.quality] || QUALITY.standard;
      let logoData = null;
      const getImage = async op => {
        if (op.src === "logo") {
          if (!logoData) logoData = { data: state.logo.url, format: "PNG", alias: "logo" };
          return logoData;
        }
        const p = state.photos[op.i];
        const img = await loadImage(p.url);
        const c = rotatedCanvas(img, p.rotation, Math.ceil(Math.max(op.w, op.h) * dpi / 72));
        const blob = await canvasBlob(c, "image/jpeg", q);
        return { data: new Uint8Array(await blob.arrayBuffer()), format: "JPEG", alias: `photo-${op.i}` };
      };
      const total = state.photos.length;
      status(t().preparing(0, total));
      const pdf = await toPDF(d, getImage, {
        title: state.info.title || t().defaultTitle,
        subject: [state.info.projectName, state.info.projectNo].filter(Boolean).join(" · "),
        author: state.info.author
      }, (i, n) => status(i === n ? t().building : t().preparing(i, n)));
      const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
      const name = [t().fileName, slug(state.info.projectNo || state.info.projectName || ""), state.info.reportDate || today()].filter(Boolean).join("_") + ".pdf";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(pdf);
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      status(t().ready(name));
    } catch (err) {
      console.error(err);
      status(t().failed, true);
    } finally {
      busy = false;
      btn.classList.remove("is-busy");
      btn.disabled = state.photos.length === 0;
    }
  }
  $("export").addEventListener("click", exportPDF);

  // ---------- Étapes ----------
  const TABS = ["photos", "report", "preview"];
  function showTab(name) {
    state.tab = name;
    TABS.forEach(n => {
      const on = n === name;
      $(`tab-${n}`).setAttribute("aria-selected", String(on));
      $(`tab-${n}`).tabIndex = on ? 0 : -1;
      $(`panel-${n}`).hidden = !on;
    });
    if (name === "preview") renderPreview();
  }
  TABS.forEach((n, i) => {
    const tab = $(`tab-${n}`);
    tab.addEventListener("click", () => showTab(n));
    tab.addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const next = TABS[(i + (e.key === "ArrowLeft" ? -1 : 1) + TABS.length) % TABS.length];
      $(`tab-${next}`).focus();
      showTab(next);
    });
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.tab === "preview") renderPreview(); }, 150);
  });

  document.addEventListener("langchange", () => {
    renderPhotos();
    renderExtra();
    localize(list);
    refresh();
    if (viewer.open) showViewer();
  });

  // ---------- Démarrage ----------
  (async () => {
    renderPresets();
    renderOpts();
    renderExtra();
    setZoom(zoom);
    await renderLogo();
    const restored = await restorePhotos();
    // Nouveau rapport : date du jour. Rapport repris : on garde ses dates.
    if (!restored) { state.info.reportDate = today(); state.info.visitDate = ""; saveSettings(); }
    else if (!state.info.reportDate) state.info.reportDate = today();
    fillInfo();
    renderPhotos();
    refresh();
    if (restored) status(t().restored(restored));
  })();
})();
