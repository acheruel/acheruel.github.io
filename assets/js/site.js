(() => {
  "use strict";

  const { SITE, SECTIONS, TOOLS, I18N } = window;
  const CACHE_KEY = "acheruel:repos";
  const CACHE_MS = 60 * 60 * 1000;

  const store = {
    get(key, area = localStorage) { try { return area.getItem(key); } catch { return null; } },
    set(key, value, area = localStorage) { try { area.setItem(key, value); } catch { /* stockage indisponible */ } }
  };

  let lang = store.get("lang") === "en" ? "en" : "fr";
  let pushed = {}; // repo -> date ISO de la dernière mise à jour (API GitHub)

  const t = key => I18N[lang][key];
  const parseDate = s => new Date(s.length === 10 ? `${s}T12:00:00` : s);
  const fmtDate = s => new Intl.DateTimeFormat(t("locale"), { day: "numeric", month: "short", year: "numeric" }).format(parseDate(s));
  const lastUpdate = tool => pushed[tool.repo] || tool.updated;

  function renderTabs() {
    const box = document.getElementById("tabs");
    box.replaceChildren(...SECTIONS.map(section => {
      const label = section.label[lang];
      if (!section.ready) {
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
      el.href = section.href;
      el.textContent = label;
      if (section.id === "outils") el.setAttribute("aria-current", "page");
      return el;
    }));
  }

  function renderTools() {
    const tpl = document.getElementById("tool-template");
    const list = document.getElementById("tools");
    list.replaceChildren(...TOOLS.map((tool, i) => {
      const card = tpl.content.firstElementChild.cloneNode(true);
      const fullName = tool.name.join("");
      card.style.setProperty("--i", i);

      card.querySelector(".tool-logo").src = tool.logo;

      const link = card.querySelector(".tool-link");
      link.href = `${SITE.pages}/${tool.repo}/`;
      link.innerHTML = `<span class="tool-name-pre"></span><span></span><span class="sr-only"></span>`;
      link.children[0].textContent = tool.name[0];
      link.children[1].textContent = tool.name[1];
      link.children[2].textContent = ` ${t("newWindow")}`;

      card.querySelector(".tool-tagline").textContent = tool.tagline[lang];
      card.querySelector(".tool-desc").textContent = tool.desc[lang];

      const date = card.querySelector(".tool-date");
      const iso = lastUpdate(tool);
      date.innerHTML = `<time></time>`;
      date.firstChild.dateTime = iso.slice(0, 10);
      date.firstChild.textContent = t("updated")(fmtDate(iso));

      const code = card.querySelector(".tool-code");
      code.href = `https://github.com/${SITE.github}/${tool.repo}`;
      code.setAttribute("aria-label", `${t("codeOf")(fullName)} ${t("newWindow")}`);
      code.title = `github.com/${SITE.github}/${tool.repo}`;
      card.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
      return card;
    }));
  }

  function renderIntro() {
    document.getElementById("tools-intro").replaceChildren(...t("toolsIntro").map(text => {
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

  function renderStatic() {
    document.documentElement.lang = lang;
    document.title = t("title");
    document.querySelectorAll("body > :not(template) [data-i18n]").forEach(el => {
      const value = t(el.dataset.i18n);
      if (typeof value === "string") el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    document.querySelectorAll(".language button").forEach(btn => {
      const on = btn.dataset.lang === lang;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-pressed", String(on));
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

  async function loadDates() {
    const cached = store.get(CACHE_KEY, sessionStorage);
    if (cached) {
      try {
        const { at, data } = JSON.parse(cached);
        if (Date.now() - at < CACHE_MS) { pushed = data; return; }
      } catch { /* cache illisible */ }
    }
    try {
      const res = await fetch(`https://api.github.com/users/${SITE.github}/repos?per_page=100`, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!res.ok) return;
      const repos = await res.json();
      pushed = Object.fromEntries(repos.map(r => [r.name, r.pushed_at]));
      store.set(CACHE_KEY, JSON.stringify({ at: Date.now(), data: pushed }), sessionStorage);
    } catch { /* hors ligne ou limite atteinte : dates de repli */ }
  }

  document.querySelectorAll(".language button").forEach(btn => btn.addEventListener("click", () => {
    if (btn.dataset.lang === lang) return;
    lang = btn.dataset.lang;
    store.set("lang", lang);
    document.body.classList.add("no-intro");
    render();
  }));

  // Met à jour les dates en place pour ne pas relancer l'animation d'entrée des cartes.
  function updateDates() {
    document.querySelectorAll("#tools .tool").forEach((card, i) => {
      const iso = lastUpdate(TOOLS[i]);
      const time = card.querySelector(".tool-date time");
      time.dateTime = iso.slice(0, 10);
      time.textContent = t("updated")(fmtDate(iso));
    });
  }

  render();
  loadDates().then(updateDates);
})();
