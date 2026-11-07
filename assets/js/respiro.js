// Respiro : durée réglable (1 à 5 s par phase) et mini-fenêtre.
// Chrome et Edge : Document Picture-in-Picture, fenêtre toujours au premier plan ; la scène y est
// déplacée telle quelle. Ailleurs, sur ordinateur : petite fenêtre ordinaire (page ?mini).
// L'animation est en CSS ; --period règle sa durée et --delay garde la phase quand la scène
// change de document ou de durée (l'animation redémarre alors au même point du cycle).
(() => {
  "use strict";

  const KEY = "respiro-seconds";
  const MINI = { width: 240, height: 240 };
  const stage = document.getElementById("breath");
  const clampSec = v => Math.min(5, Math.max(1, Math.round(Number(v)) || 5));
  const readSec = () => { try { return clampSec(localStorage.getItem(KEY) ?? 5); } catch { return 5; } };
  const saveSec = v => { try { localStorage.setItem(KEY, String(v)); } catch { /* stockage indisponible */ } };

  let seconds = readSec();
  let anchor = performance.now(); // instant où le cycle courant a commencé (fleur fermée)
  const period = () => seconds * 2000;

  function keepPhase() {
    stage.style.setProperty("--delay", `${-((performance.now() - anchor) % period())}ms`);
  }

  // Applique la durée en gardant la position dans le cycle (pas de saut de la fleur).
  function setPeriod(sec) {
    const now = performance.now();
    const frac = ((now - anchor) % period()) / period();
    seconds = sec;
    anchor = now - frac * period();
    stage.style.setProperty("--period", `${period()}ms`);
    keepPhase();
    // Réinsérer la scène redémarre les animations CSS avec le nouveau --delay.
    const parent = stage.parentNode, next = stage.nextSibling;
    if (parent) { parent.removeChild(stage); parent.insertBefore(stage, next); }
  }

  stage.style.setProperty("--period", `${period()}ms`);

  // Petite fenêtre ?mini : elle suit le réglage de la page qui l'a ouverte.
  if (document.documentElement.classList.contains("is-mini")) {
    window.addEventListener("storage", e => { if (e.key === KEY) setPeriod(readSec()); });
    return;
  }

  const lang = () => (window.siteLang ? window.siteLang() : document.documentElement.lang);
  const TEXT = {
    fr: n => {
      const s = n > 1 ? `${n} secondes` : "1 seconde";
      return {
        lead: `${s} d'inspiration, ${s} d'expiration. Suivez la rosace : elle s'ouvre quand vous inspirez et se referme quand vous expirez.`,
        sr: `Animation de respiration : ${s} d'inspiration, ${s} d'expiration, en boucle.`
      };
    },
    en: n => {
      const s = n > 1 ? `${n} seconds` : "1 second";
      return {
        lead: `${s} in, ${s} out. Follow the rosette: it opens as you breathe in and closes as you breathe out.`,
        sr: `Breathing animation: ${s} in, ${s} out, looping.`
      };
    }
  };

  const tempo = document.getElementById("tempo");
  function renderText() {
    const txt = TEXT[lang() === "en" ? "en" : "fr"](seconds);
    document.getElementById("respiro-lead").textContent = txt.lead;
    document.getElementById("respiro-sr").textContent = txt.sr;
    tempo.querySelectorAll("button").forEach(btn => {
      const on = Number(btn.dataset.sec) === seconds;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  tempo.addEventListener("click", e => {
    const btn = e.target.closest("button[data-sec]");
    if (!btn) return;
    const sec = clampSec(btn.dataset.sec);
    if (sec === seconds) return;
    setPeriod(sec);
    saveSec(sec);
    renderText();
  });
  renderText();

  const slot = document.getElementById("slot");
  const detached = document.getElementById("detached");
  const pipApi = window.documentPictureInPicture;
  const canPopup = matchMedia("(pointer: fine)").matches;
  let pipWin = null;

  // site.js ne traduit que le document de la page : la scène détachée est traduite ici.
  document.addEventListener("langchange", ({ detail }) => {
    renderText();
    if (!pipWin) return;
    pipWin.document.documentElement.lang = detail.lang;
    stage.querySelectorAll("[data-en]").forEach(el => { el.textContent = detail.lang === "en" ? el.dataset.en : el.dataset.fr; });
  });

  if (!pipApi && !canPopup) return; // téléphone ou tablette : la page suffit
  document.getElementById("actions").hidden = false;
  document.getElementById(pipApi ? "note-pip" : "note-popup").hidden = false;

  // Recopie les feuilles de style de la page (même origine) dans la mini-fenêtre.
  function copyStyles(doc) {
    for (const sheet of document.styleSheets) {
      try {
        const style = doc.createElement("style");
        style.textContent = [...sheet.cssRules].map(rule => rule.cssText).join("\n");
        doc.head.append(style);
      } catch {
        if (!sheet.href) continue;
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.append(link);
      }
    }
  }

  function dock() {
    keepPhase();
    slot.prepend(stage);
    detached.hidden = true;
    pipWin = null;
  }

  function openPopup() {
    const left = screen.availWidth - MINI.width - 40;
    window.open("./?mini", "respiro-mini", `popup,width=${MINI.width},height=${MINI.height},left=${left},top=80`);
  }

  async function popOut() {
    if (pipWin) { pipWin.focus(); return; }
    if (!pipApi) { openPopup(); return; }
    try {
      pipWin = await pipApi.requestWindow(MINI);
    } catch {
      openPopup(); // API présente mais refusée (navigateur intégré, politique) : petite fenêtre
      return;
    }
    const doc = pipWin.document;
    doc.title = "Respiro";
    doc.documentElement.lang = document.documentElement.lang;
    copyStyles(doc);
    doc.body.className = "pip";
    keepPhase();
    doc.body.append(stage);
    detached.hidden = false;
    pipWin.addEventListener("pagehide", dock, { once: true });
  }

  document.getElementById("pop").addEventListener("click", popOut);
  document.getElementById("dock").addEventListener("click", () => { if (pipWin) pipWin.close(); });
})();
