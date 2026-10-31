// Respiro : détache l'animation dans une mini-fenêtre.
// Chrome et Edge : Document Picture-in-Picture, fenêtre toujours au premier plan ; la scène y est
// déplacée telle quelle. Ailleurs, sur ordinateur : petite fenêtre ordinaire (page ?mini).
// L'animation est en CSS ; --delay garde la phase quand la scène change de document.
(() => {
  "use strict";

  if (document.documentElement.classList.contains("is-mini")) return;

  const PERIOD = 10000;
  const MINI = { width: 240, height: 240 };
  const t0 = performance.now();
  const stage = document.getElementById("breath");
  const slot = document.getElementById("slot");
  const detached = document.getElementById("detached");
  const pipApi = window.documentPictureInPicture;
  const canPopup = matchMedia("(pointer: fine)").matches;
  let pipWin = null;

  if (!pipApi && !canPopup) return; // téléphone ou tablette : la page suffit
  document.getElementById("actions").hidden = false;
  document.getElementById(pipApi ? "note-pip" : "note-popup").hidden = false;

  const keepPhase = () => stage.style.setProperty("--delay", `${-((performance.now() - t0) % PERIOD)}ms`);

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
  // site.js ne traduit que le document de la page : la scène détachée est traduite ici.
  document.addEventListener("langchange", ({ detail: { lang } }) => {
    if (!pipWin) return;
    pipWin.document.documentElement.lang = lang;
    stage.querySelectorAll("[data-en]").forEach(el => { el.textContent = lang === "en" ? el.dataset.en : el.dataset.fr; });
  });
})();
