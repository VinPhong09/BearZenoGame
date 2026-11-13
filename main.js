(async function () {
  let data = {};
  try {
    data = await fetch("games.json", { cache: "no-cache" }).then((r) => r.json());
  } catch (e) {
    console.error("Could not load games.json", e);
  }
  const studio = data.studio || {};
  const games = data.games || [];

  const playUrl = (id) =>
    "https://play.google.com/store/apps/details?id=" + encodeURIComponent(id);

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);

  // Deterministic color from a string, for placeholder icons.
  function hue(str) {
    let h = 0;
    for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  function iconHtml(g, cls) {
    if (g.icon) {
      return `<img class="${cls}" src="${esc(g.icon)}" alt="${esc(g.name)} icon" loading="lazy" width="512" height="512" />`;
    }
    const h = hue(g.id || g.name);
    return `<div class="${cls} icon-ph" style="--h:${h}" aria-hidden="true">${esc(initials(g.name))}</div>`;
  }

  const playBadge = (id, label = "Get it on Google Play") => `
    <a class="play-badge" href="${playUrl(id)}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="#34A853" d="M3.6 1.8 13.5 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Z"/>
        <path fill="#FBBC04" d="m16.8 15.3-3.3-3.3 3.3-3.3 3.8 2.2c1.1.6 1.1 1.6 0 2.2l-3.8 2.2Z"/>
        <path fill="#4285F4" d="M16.8 15.3 13.5 12 3.6 22.2c.4.2.9.2 1.4-.1l11.8-6.8Z"/>
        <path fill="#EA4335" d="M16.8 8.7 5 1.9c-.5-.3-1-.3-1.4-.1L13.5 12l3.3-3.3Z"/>
      </svg>
      <span>${esc(label)}</span>
    </a>`;

  // Studio text
  document.querySelectorAll("[data-studio]").forEach((el) => {
    const v = studio[el.dataset.studio];
    if (v) el.textContent = v;
  });
  document.querySelectorAll("[data-studio-href]").forEach((el) => {
    const v = studio[el.dataset.studioHref];
    if (v) el.href = v;
    else el.remove();
  });
  document.querySelectorAll("[data-studio-mail]").forEach((el) => {
    if (studio.email) {
      el.href = "mailto:" + studio.email;
      el.textContent = studio.email;
    } else el.remove();
  });
  if (studio.name) document.title = studio.name;
  document.getElementById("year").textContent = new Date().getFullYear();
  document.getElementById("game-count").textContent = games.length;

  // Hero spotlight
  const feat = games.find((g) => g.featured) || games[0];
  const heroEl = document.getElementById("hero-feature");
  if (feat) {
    heroEl.innerHTML = `
      <div class="spot">
        <span class="spot-label">Featured</span>
        ${iconHtml(feat, "spot-icon")}
        <h3>${esc(feat.name)}</h3>
        <p class="genre">${esc(feat.genre)}</p>
        <p>${esc(feat.tagline)}</p>
        ${playBadge(feat.id)}
      </div>`;
  } else heroEl.remove();

  // Filters
  const genres = ["All", ...new Set(games.map((g) => g.genre).filter(Boolean))];
  const filtersEl = document.getElementById("filters");
  const grid = document.getElementById("game-grid");
  let active = "All";

  function renderFilters() {
    if (genres.length <= 2) { filtersEl.remove(); return; }
    filtersEl.innerHTML = genres
      .map((g) => `<button role="tab" aria-selected="${g === active}" data-g="${esc(g)}">${esc(g)}</button>`)
      .join("");
  }

  function renderGrid() {
    const list = active === "All" ? games : games.filter((g) => g.genre === active);
    if (!list.length) {
      grid.innerHTML = `<p class="empty">No games yet — check back soon.</p>`;
      return;
    }
    grid.innerHTML = list
      .map((g) => `
        <article class="card">
          <a class="card-top" href="${playUrl(g.id)}" target="_blank" rel="noopener" aria-label="${esc(g.name)} on Google Play">
            ${iconHtml(g, "card-icon")}
          </a>
          <div class="card-body">
            <h3>${esc(g.name)}</h3>
            <p class="genre">${esc(g.genre)}</p>
            <p class="tagline">${esc(g.tagline)}</p>
          </div>
          ${playBadge(g.id, "Google Play")}
        </article>`)
      .join("");
  }

  filtersEl.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-g]");
    if (!b) return;
    active = b.dataset.g;
    renderFilters();
    renderGrid();
  });

  renderFilters();
  renderGrid();
})();
