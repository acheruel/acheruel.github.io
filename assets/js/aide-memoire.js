// Aide-mémoire de mathématiques : rendu KaTeX, copie LaTeX, recherche, sommaire actif,
// tableau des valeurs remarquables lié au cercle trigonométrique, impression.
(() => {
  "use strict";

  const TXT = {
    fr: {
      copyOf: name => (name ? `Copier le LaTeX : ${name}` : "Copier le LaTeX"),
      copied: "LaTeX copié",
      copyFail: "Copie impossible : sélectionnez la formule à la main.",
      results: n => (n > 1 ? `${n} formules trouvées` : `${n} formule trouvée`),
      undef: "non définie",
      undefTex: "\\text{non définie}"
    },
    en: {
      copyOf: name => (name ? `Copy LaTeX: ${name}` : "Copy LaTeX"),
      copied: "LaTeX copied",
      copyFail: "Copy failed: select the formula by hand.",
      results: n => (n > 1 ? `${n} formulas found` : `${n} formula found`),
      undef: "undefined",
      undefTex: "\\text{undefined}"
    }
  };
  const lang = () => (window.siteLang ? window.siteLang() : "fr");
  const tx = key => TXT[lang()][key];
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  function tex(el, src, display = true) {
    if (!window.katex) {
      el.textContent = src;
      el.classList.add("tex-raw");
      return;
    }
    window.katex.render((display ? "\\displaystyle " : "") + src, el, { throwOnError: false, strict: false });
  }

  /* Formules : la source LaTeX est le texte d'origine de chaque .tex */
  const texEls = [...document.querySelectorAll(".sheet .tex")];
  texEls.forEach(el => { el.dataset.tex = el.textContent.trim(); });
  const srcOf = el => (lang() === "en" && el.dataset.texEn) || el.dataset.tex;
  const renderFormulas = () => texEls.forEach(el => tex(el, srcOf(el), !("inline" in el.dataset)));

  /* Copie en LaTeX */
  const COPY_SVG = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
  const CHECK_SVG = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const formulas = [...document.querySelectorAll(".sheet .f")];

  const nameOf = f => {
    const label = f.querySelector(".f-label");
    if (label) return (label.querySelector("span") || label).textContent.trim();
    const shape = f.closest(".shape");
    return shape ? shape.querySelector("b").textContent.trim() : "";
  };
  const labelCopyButtons = () => formulas.forEach(f => {
    f.querySelector(".copy").setAttribute("aria-label", tx("copyOf")(nameOf(f)));
  });

  const toastEl = document.getElementById("toast");
  let toastTimer;
  function toast(message, code) {
    toastEl.innerHTML = `${CHECK_SVG}<span></span>${code ? "<code></code>" : ""}`;
    toastEl.querySelector("span").textContent = message;
    if (code) toastEl.querySelector("code").textContent = code;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0";
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* refusé */ }
    area.remove();
    return ok;
  }

  async function copy(f) {
    const src = srcOf(f.querySelector(".tex"));
    let ok = true;
    try { await navigator.clipboard.writeText(src); } catch { ok = fallbackCopy(src); }
    f.classList.add("copied");
    setTimeout(() => f.classList.remove("copied"), 650);
    toast(ok ? tx("copied") : tx("copyFail"), ok ? src : "");
  }

  formulas.forEach(f => {
    const inner = document.createElement("span");
    inner.className = "f-in";
    inner.append(...f.childNodes);
    f.append(inner);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy";
    btn.innerHTML = COPY_SVG;
    f.append(btn);
    btn.addEventListener("click", e => { e.stopPropagation(); copy(f); });
    f.addEventListener("click", () => { if (!String(getSelection())) copy(f); });
  });

  /* Recherche : par libellé (FR et EN), mots-clés et source LaTeX */
  const input = document.getElementById("q");
  const status = document.getElementById("search-status");
  const empty = document.getElementById("empty");
  const sections = [...document.querySelectorAll(".sec")];
  const tocLinks = new Map(sections.map(s => [s, document.querySelector(`.toc-nav a[href="#${s.id}"]`)]));
  const both = el => [el.textContent, el.dataset.en || "", el.dataset.fr || ""].join(" ");
  const index = new Map();
  const secText = new Map();

  function buildIndex() {
    document.querySelectorAll(".sheet .item").forEach(item => {
      const parts = [item.dataset.k || "", item.textContent];
      item.querySelectorAll("[data-en]").forEach(el => parts.push(both(el)));
      item.querySelectorAll(".tex").forEach(el => parts.push(el.dataset.tex, el.dataset.texEn || ""));
      index.set(item, norm(parts.join(" ")));
    });
    sections.forEach(sec => {
      const h = sec.querySelector("h2");
      secText.set(sec, norm([h.textContent, ...[...h.querySelectorAll("[data-en]"), h].map(both)].join(" ")));
    });
  }

  const visible = el => el.matches(".item:not([hidden])") || !!el.querySelector(".item:not([hidden])");

  function applySearch() {
    const terms = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    let total = 0;
    sections.forEach(sec => {
      const secHit = terms.length > 0 && terms.every(t => secText.get(sec).includes(t));
      let n = 0;
      sec.querySelectorAll(".item").forEach(item => {
        const hit = !terms.length || secHit || terms.every(t => index.get(item).includes(t));
        item.hidden = !hit;
        if (hit) n++;
      });
      // Conteneurs, du plus intérieur au plus extérieur, puis les intertitres.
      for (const sel of [".rows, .shapes, .cases", ".with-fig, .split", ".grp"]) {
        sec.querySelectorAll(sel).forEach(box => { box.hidden = false; box.hidden = !visible(box); });
      }
      sec.querySelectorAll("h3").forEach(h => {
        let el = h.nextElementSibling;
        let shown = false;
        while (el && el.tagName !== "H3") {
          if (!el.hidden && visible(el)) { shown = true; break; }
          el = el.nextElementSibling;
        }
        h.hidden = !shown;
      });
      sec.hidden = n === 0;
      const link = tocLinks.get(sec);
      link.querySelector(".toc-n").textContent = n;
      link.classList.toggle("is-empty", n === 0);
      total += n;
    });
    status.textContent = terms.length ? tx("results")(total) : "";
    empty.hidden = !(terms.length && total === 0);
    document.getElementById("empty-q").textContent = input.value.trim();
    spy();
  }

  input.addEventListener("input", applySearch);
  input.addEventListener("keydown", e => {
    if (e.key === "Escape" && input.value) { e.preventDefault(); input.value = ""; applySearch(); }
  });
  document.getElementById("clear-search").addEventListener("click", () => {
    input.value = "";
    applySearch();
    input.focus();
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest("input, textarea, select, [contenteditable]")) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  /* Sommaire : section en cours de lecture */
  let spyFrame = 0;
  function spy() {
    cancelAnimationFrame(spyFrame);
    spyFrame = requestAnimationFrame(() => {
      const shown = sections.filter(s => !s.hidden);
      let current = shown[0];
      for (const s of shown) if (s.getBoundingClientRect().top <= 140) current = s;
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) current = shown.at(-1);
      tocLinks.forEach((link, sec) => {
        const on = sec === current;
        link.classList.toggle("on", on);
        if (on) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
      });
    });
  }
  addEventListener("scroll", spy, { passive: true });
  addEventListener("resize", spy);

  /* Valeurs remarquables et cercle trigonométrique */
  const H = "\\frac{1}{2}", S2 = "\\frac{\\sqrt{2}}{2}", S3 = "\\frac{\\sqrt{3}}{2}", T3 = "\\frac{\\sqrt{3}}{3}", R3 = "\\sqrt{3}";
  const neg = s => (s === "0" ? s : `-${s}`);
  const ANG = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
  const RAD = ["0", "\\frac{\\pi}{6}", "\\frac{\\pi}{4}", "\\frac{\\pi}{3}", "\\frac{\\pi}{2}", "\\frac{2\\pi}{3}", "\\frac{3\\pi}{4}", "\\frac{5\\pi}{6}", "\\pi",
    "\\frac{7\\pi}{6}", "\\frac{5\\pi}{4}", "\\frac{4\\pi}{3}", "\\frac{3\\pi}{2}", "\\frac{5\\pi}{3}", "\\frac{7\\pi}{4}", "\\frac{11\\pi}{6}", "2\\pi"];
  const SIN = ["0", H, S2, S3, "1", S3, S2, H, "0", neg(H), neg(S2), neg(S3), "-1", neg(S3), neg(S2), neg(H), "0"];
  const COS = ["1", S3, S2, H, "0", neg(H), neg(S2), neg(S3), "-1", neg(S3), neg(S2), neg(H), "0", H, S2, S3, "1"];
  const TAN = ["0", T3, "1", R3, null, neg(R3), "-1", neg(T3), "0", T3, "1", R3, null, neg(R3), "-1", neg(T3), "0"];

  const tbody = document.getElementById("trig-body");
  const rows = ANG.map((deg, i) => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    if (deg === 90 || deg === 180 || deg === 270) tr.className = "q-start";
    const first = document.createElement("td");
    first.textContent = `${deg}°`;
    tr.append(first);
    [RAD[i], SIN[i], COS[i], TAN[i]].forEach(src => {
      const td = document.createElement("td");
      if (src === null) td.innerHTML = `<span class="undef" aria-hidden="true">—</span><span class="sr-only undef-sr"></span>`;
      else td.dataset.src = src;
      tr.append(td);
    });
    tr.addEventListener("mouseenter", () => select(i));
    tr.addEventListener("focus", () => select(i));
    tr.addEventListener("click", () => select(i));
    tr.addEventListener("keydown", e => {
      const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : -1;
      if (next >= 0 && next < ANG.length) { e.preventDefault(); rows[next].focus(); }
    });
    tbody.append(tr);
    return tr;
  });
  const renderTable = () => {
    tbody.querySelectorAll("td[data-src]").forEach(td => tex(td, td.dataset.src, true));
    tbody.querySelectorAll(".undef-sr").forEach(el => { el.textContent = tx("undef"); });
  };

  const NS = "http://www.w3.org/2000/svg";
  const C = 130, R = 92, ARC = 22;
  const svg = document.getElementById("unit-circle");
  const make = (tag, attrs, parent = svg) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent.append(el);
    return el;
  };
  const at = (deg, r = R) => [C + r * Math.cos(deg * Math.PI / 180), C - r * Math.sin(deg * Math.PI / 180)];

  make("line", { class: "uc-axis", x1: C - 124, y1: C, x2: C + 124, y2: C });
  make("line", { class: "uc-axis", x1: C, y1: C - 124, x2: C, y2: C + 124 });
  make("circle", { class: "uc-circle", cx: C, cy: C, r: R });
  [["1", C + R - 7, C + 11], ["−1", C - R + 9, C + 11], ["1", C + 8, C - R + 9], ["−1", C + 10, C + R - 7]]
    .forEach(([label, x, y]) => { make("text", { class: "uc-tick", x, y, "text-anchor": "middle" }).textContent = label; });
  const wedge = make("path", { class: "uc-wedge" });
  const arc = make("path", { class: "uc-arc" });
  const guide = make("line", { class: "uc-guide" });
  const cosSeg = make("line", { class: "uc-cos" });
  const sinSeg = make("line", { class: "uc-sin" });
  const ray = make("line", { class: "uc-ray" });
  const labels = [];
  const points = ANG.slice(0, -1).map((deg, i) => {
    const [x, y] = at(deg);
    const [lx, ly] = at(deg, R + 19);
    const lbl = make("text", { class: "uc-lbl", x: lx.toFixed(1), y: ly.toFixed(1) });
    lbl.textContent = `${deg}°`;
    labels.push(lbl);
    const pt = make("circle", { class: "uc-pt", cx: x.toFixed(1), cy: y.toFixed(1), r: 4.5 });
    const hit = make("circle", { class: "uc-hit", cx: x.toFixed(1), cy: y.toFixed(1), r: 11 });
    hit.addEventListener("click", () => select(i));
    return pt;
  });
  const head = make("circle", { class: "uc-head", r: 6.5 });

  function draw(deg) {
    const [x, y] = at(deg);
    const r = deg * Math.PI / 180;
    const set = (el, a) => { for (const [k, v] of Object.entries(a)) el.setAttribute(k, typeof v === "number" ? v.toFixed(2) : v); };
    set(ray, { x1: C, y1: C, x2: x, y2: y });
    set(cosSeg, { x1: C, y1: C, x2: x, y2: C });
    set(sinSeg, { x1: x, y1: C, x2: x, y2: y });
    set(guide, { x1: x, y1: y, x2: C, y2: y });
    set(head, { cx: x, cy: y });
    let d = "";
    if (deg >= 359.5) d = `M${C + ARC} ${C}A${ARC} ${ARC} 0 1 0 ${C - ARC} ${C}A${ARC} ${ARC} 0 1 0 ${C + ARC} ${C}`;
    else if (deg > 0.5) {
      const ex = C + ARC * Math.cos(r), ey = C - ARC * Math.sin(r);
      d = `M${C + ARC} ${C}A${ARC} ${ARC} 0 ${deg > 180 ? 1 : 0} 0 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
    }
    arc.setAttribute("d", d);
    wedge.setAttribute("d", d ? `M${C} ${C}L${d.slice(1)}${deg >= 359.5 ? "" : "Z"}` : "");
  }

  const readout = document.getElementById("circle-readout");
  let selected = 1;
  let current = ANG[selected];
  let frame = 0;

  function renderReadout() {
    const i = selected;
    const lines = [
      `\\theta=${ANG[i]}^\\circ=${RAD[i]}`,
      `\\textcolor{#3567ad}{\\cos\\theta}=${COS[i]}\\qquad\\textcolor{#81601f}{\\sin\\theta}=${SIN[i]}`,
      `\\tan\\theta=${TAN[i] ?? tx("undefTex")}`
    ];
    readout.replaceChildren(...lines.map(src => {
      const div = document.createElement("div");
      tex(div, src, true);
      return div;
    }));
  }

  function select(i) {
    if (i === selected && rows[i].classList.contains("on")) return;
    rows[selected].classList.remove("on");
    selected = i;
    rows[i].classList.add("on");
    const p = i % (ANG.length - 1);
    points.forEach((pt, k) => pt.classList.toggle("on", k === p));
    labels.forEach((l, k) => l.classList.toggle("on", k === p));
    renderReadout();
    animateTo(ANG[i]);
  }

  // Le rayon tourne jusqu'au nouvel angle (sortie exponentielle) ; instantané si mouvement réduit.
  function animateTo(target) {
    cancelAnimationFrame(frame);
    if (reduceMotion.matches) { current = target; draw(current); return; }
    const from = current, t0 = performance.now(), duration = 560;
    const step = now => {
      const k = Math.min(1, (now - t0) / duration);
      current = from + (target - from) * (k === 1 ? 1 : 1 - Math.pow(2, -10 * k));
      draw(current);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  /* Impression */
  document.getElementById("print").addEventListener("click", () => print());

  /* Démarrage et changement de langue */
  function renderAll() {
    renderFormulas();
    renderTable();
    renderReadout();
    labelCopyButtons();
  }

  renderAll();
  buildIndex();
  draw(current);
  rows[selected].classList.add("on");
  points[selected].classList.add("on");
  labels[selected].classList.add("on");
  applySearch();

  document.addEventListener("langchange", () => {
    renderAll();
    applySearch();
  });
})();
