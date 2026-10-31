// Commun à toutes les pages : langue, onglets, pied de page. Page Outils : cartes par catégorie.
// <html data-root> donne le chemin vers la racine du site ("../" pour une sous-page),
// <body data-page> la page courante, <body data-section> l'onglet actif.
// Traduction des pages statiques : data-en (texte), data-en-label (aria-label),
// data-en-placeholder, data-en-title ; le français reste dans le HTML.
// Les autres scripts écoutent l'événement "langchange" sur document.
(() => {
  "use strict";

  const { SITE, SECTIONS, CATEGORIES, TOOLS, I18N } = window;
  const root = document.documentElement.dataset.root || "";
  const page = document.body.dataset.page || "outils";
  const section = document.body.dataset.section || page;

  const store = {
    get(key, area = localStorage) { try { return area.getItem(key); } catch { return null; } },
    set(key, value, area = localStorage) { try { area.setItem(key, value); } catch { /* stockage indisponible */ } }
  };

  let lang = store.get("lang") === "en" ? "en" : "fr";

  const t = key => I18N[lang][key];
  const parseDate = s => new Date(s.length === 10 ? `${s}T12:00:00` : s);
  const fmtDate = s => new Intl.DateTimeFormat(t("locale"), { day: "numeric", month: "short", year: "numeric" }).format(parseDate(s));

  window.siteLang = () => lang;
  window.siteDate = fmtDate;

  function renderTabs() {
    const box = document.getElementById("tabs");
    box.replaceChildren(...SECTIONS.map(s => {
      const label = s.label[lang];
      if (!s.ready) {
        const el = document.createElement("span");
        el.className = "tab is-soon";
        el.setAttribute("aria-disabled", "true");
        el.innerHTML = `<span></span><small></small>`;
        el.firstChild.textContent = label;
        el.lastChild.textContent = t("soon");
        return el;
      }
      const el = document.createElement("a");
      el.className = "tab";
      el.href = root + s.href;
      el.textContent = label;
      if (s.id === section) el.setAttribute("aria-current", "page");
      return el;
    }));
  }

  function toolCard(tpl, tool, i) {
    const card = tpl.content.firstElementChild.cloneNode(true);
    const fullName = tool.name.join("");
    card.style.setProperty("--i", i);

    card.querySelector(".tool-logo").src = root + tool.logo;

    const link = card.querySelector(".tool-link");
    link.href = tool.href ? root + tool.href : `${SITE.pages}/${tool.repo}/`;
    link.innerHTML = `<span class="tool-name-pre"></span><span></span><span class="sr-only"></span>`;
    link.children[0].textContent = tool.name[0];
    link.children[1].textContent = tool.name[1];
    link.children[2].textContent = ` ${t("newWindow")}`;

    card.querySelector(".tool-tagline").textContent = tool.tagline[lang];
    card.querySelector(".tool-desc").textContent = tool.desc[lang];

    const code = card.querySelector(".tool-code");
    code.href = tool.code || `https://github.com/${SITE.github}/${tool.repo}`;
    code.setAttribute("aria-label", `${t("codeOf")(fullName)} ${t("newWindow")}`);
    code.title = code.href.replace("https://", "");
    card.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    return card;
  }

  function renderTools() {
    const box = document.getElementById("tools");
    if (!box) return;
    const tpl = document.getElementById("tool-template");
    let i = 0;
    box.replaceChildren(...CATEGORIES.map(cat => {
      const tools = TOOLS.filter(tool => tool.category === cat.id);
      const group = document.createElement("section");
      group.className = "tool-group";
      group.setAttribute("aria-labelledby", `cat-${cat.id}`);
      group.innerHTML = `<h2 class="group-title" id="cat-${cat.id}"><span></span><small></small></h2><ul class="tools"></ul>`;
      group.querySelector("h2 span").textContent = cat.label[lang];
      group.querySelector("h2 small").textContent = t("toolCount")(tools.length);
      group.querySelector("ul").replaceChildren(...tools.map(tool => toolCard(tpl, tool, i++)));
      return group;
    }));
  }

  function renderIntro() {
    const box = document.getElementById("tools-intro");
    if (!box) return;
    box.replaceChildren(...t("toolsIntro").map(text => {
      const p = document.createElement("p");
      text.split("{github}").forEach((part, i) => {
        if (i > 0) {
          const a = document.createElement("a");
          a.href = `https://github.com/${SITE.github}`;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = "GitHub";
          p.append(a);
        }
        p.append(part);
      });
      return p;
    }));
  }

  // Le français est la valeur d'origine du HTML : on la garde avant la première traduction.
  const SWAPS = [["en", null], ["enLabel", "aria-label"], ["enPlaceholder", "placeholder"], ["enTitle", "title"]];
  function translateStatic() {
    for (const [key, attr] of SWAPS) {
      const sel = `[data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}]`;
      document.querySelectorAll(sel).forEach(el => {
        const frKey = `fr${key.slice(2)}`;
        if (el.dataset[frKey] === undefined) el.dataset[frKey] = attr ? el.getAttribute(attr) ?? "" : el.textContent;
        const value = lang === "en" ? el.dataset[key] : el.dataset[frKey];
        if (attr) el.setAttribute(attr, value); else el.textContent = value;
      });
    }
  }

  function renderStatic() {
    document.documentElement.lang = lang;
    document.title = t("pageTitle")[page] || document.title;
    document.querySelectorAll("body > :not(template) [data-i18n]").forEach(el => {
      const value = t(el.dataset.i18n);
      if (typeof value === "string") el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    translateStatic();
    document.querySelectorAll(".language button").forEach(btn => {
      const on = btn.dataset.lang === lang;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    document.querySelectorAll("time[data-date]").forEach(el => {
      el.dateTime = el.dataset.date;
      el.textContent = fmtDate(el.dataset.date);
    });
    const siteDate = document.getElementById("site-date");
    siteDate.dateTime = SITE.date;
    siteDate.textContent = fmtDate(SITE.date);
    document.getElementById("year").textContent = SITE.date.slice(0, 4);
  }

  function render() {
    renderStatic();
    renderTabs();
    renderIntro();
    renderTools();
  }

  document.querySelectorAll(".language button").forEach(btn => btn.addEventListener("click", () => {
    if (btn.dataset.lang === lang) return;
    lang = btn.dataset.lang;
    store.set("lang", lang);
    document.body.classList.add("no-intro");
    render();
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }));

  render();
})();
