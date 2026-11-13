(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const CFG_KEY = "bz-admin-config";
  const TOKEN_KEY = "bz-admin-token";
  const ADMOB_TAG = "f08c47fec0942fa0";

  const state = {
    data: { studio: {}, games: [] },
    ads: "",
    sha: {},
    pendingIcons: new Map(), // repo path -> dataURL, waiting to be uploaded
    iconPreview: new Map(), // repo path -> dataURL, so freshly uploaded icons show before Pages redeploys
    dirty: new Set(), // "games" | "ads"
    connected: false,
    busy: false,
    editing: -1,
    dialogIcon: null,
  };

  // ---------- storage ----------
  const store = {
    get(area, k) { try { return area.getItem(k); } catch { return null; } },
    set(area, k, v) { try { area.setItem(k, v); } catch {} },
    del(area, k) { try { area.removeItem(k); } catch {} },
  };

  function guessRepo() {
    const h = location.hostname;
    if (h.endsWith(".github.io")) {
      const owner = h.split(".")[0];
      const seg = location.pathname.split("/").filter(Boolean);
      const repo = seg.length > 1 && seg[0] !== "admin" ? seg[0] : `${owner}.github.io`;
      return { owner, repo };
    }
    return { owner: "VinPhong09", repo: "BearZenoGame" };
  }

  let cfg = (() => {
    let saved = {};
    try { saved = JSON.parse(store.get(localStorage, CFG_KEY)) || {}; } catch {}
    const token = store.get(localStorage, TOKEN_KEY) || store.get(sessionStorage, TOKEN_KEY) || "";
    return { ...guessRepo(), branch: "main", ...saved, token, remember: !!store.get(localStorage, TOKEN_KEY) };
  })();

  function saveCfg() {
    store.set(localStorage, CFG_KEY, JSON.stringify({ owner: cfg.owner, repo: cfg.repo, branch: cfg.branch }));
    store.del(localStorage, TOKEN_KEY);
    store.del(sessionStorage, TOKEN_KEY);
    if (cfg.token) store.set(cfg.remember ? localStorage : sessionStorage, TOKEN_KEY, cfg.token);
  }

  // ---------- GitHub API ----------
  const b64enc = (str) => {
    let bin = "";
    new TextEncoder().encode(str).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  };
  const b64dec = (b64) =>
    new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`, {
      ...opts,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cfg.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.message || res.statusText);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async function getFile(p) {
    try {
      const j = await gh(`/contents/${encPath(p)}?ref=${encodeURIComponent(cfg.branch)}`);
      return { sha: j.sha, text: b64dec(j.content) };
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  const putFile = (p, base64, message, sha) =>
    gh(`/contents/${encPath(p)}`, {
      method: "PUT",
      body: JSON.stringify({ message, content: base64, branch: cfg.branch, ...(sha ? { sha } : {}) }),
    });

  // ---------- UI helpers ----------
  function notify(msg, type = "info") {
    const n = $("#notice");
    n.className = `notice ${type === "info" ? "" : type}`;
    n.innerHTML = msg;
    n.hidden = !msg;
  }

  function renderStatus() {
    const s = $("#status");
    const btn = $("#publish");
    const n = state.dirty.size;
    if (state.busy) {
      s.textContent = "Đang xử lý…";
      s.className = "status";
    } else if (!state.connected) {
      s.textContent = n ? "Có thay đổi — cần kết nối GitHub để publish" : "Chưa kết nối (chỉ xem)";
      s.className = n ? "status dirty" : "status";
    } else {
      s.textContent = n ? "Có thay đổi chưa publish" : `${cfg.owner}/${cfg.repo} · ${cfg.branch}`;
      s.className = n ? "status dirty" : "status";
    }
    btn.disabled = state.busy || !state.connected || n === 0;
  }

  function markDirty(key) {
    state.dirty.add(key);
    renderStatus();
  }

  const hue = (str) => [...String(str)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
  const initials = (name) =>
    String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  function placeholder(g, extra = "") {
    return `<div class="ic ph ${extra}" style="--h:${hue(g.id || g.name)}" aria-hidden="true">${esc(initials(g.name))}</div>`;
  }
  function iconSrc(path) {
    if (!path) return null;
    return state.pendingIcons.get(path) || state.iconPreview.get(path) || `/${path}`;
  }
  function iconHtml(g) {
    const src = iconSrc(g.icon);
    if (!src) return placeholder(g);
    return `<img class="ic" src="${esc(src)}" alt="" data-ph="${esc(placeholder(g))}" />`;
  }
  function wireIconFallback(root) {
    $$("img[data-ph]", root).forEach((img) => (img.onerror = () => (img.outerHTML = img.dataset.ph)));
  }

  // ---------- Games tab ----------
  function renderGames() {
    const games = state.data.games;
    $("#games-count").textContent = `(${games.length})`;
    const list = $("#game-list");
    if (!games.length) {
      list.innerHTML = `<li class="empty-list">Chưa có game nào. Bấm "+ Thêm game" để bắt đầu.</li>`;
    } else {
      list.innerHTML = games
        .map((g, i) => `
          <li class="game-row">
            ${iconHtml(g)}
            <div class="info">
              <strong>${esc(g.name)}${g.featured ? '<span class="badge">Nổi bật</span>' : ""}</strong>
              <small>${esc(g.genre || "—")} · ${esc(g.id)}</small>
            </div>
            <div class="actions">
              <button data-act="up" data-i="${i}" title="Lên" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button>
              <button data-act="down" data-i="${i}" title="Xuống" aria-label="Move down" ${i === games.length - 1 ? "disabled" : ""}>↓</button>
              <button data-act="edit" data-i="${i}">Sửa</button>
              <button data-act="del" data-i="${i}" class="danger">Xoá</button>
            </div>
          </li>`)
        .join("");
      wireIconFallback(list);
    }
    const genres = [...new Set(games.map((g) => g.genre).filter(Boolean))];
    $("#genres").innerHTML = genres.map((g) => `<option value="${esc(g)}">`).join("");
  }

  $("#game-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const i = +b.dataset.i;
    const games = state.data.games;
    if (b.dataset.act === "up" && i > 0) [games[i - 1], games[i]] = [games[i], games[i - 1]];
    else if (b.dataset.act === "down" && i < games.length - 1) [games[i + 1], games[i]] = [games[i], games[i + 1]];
    else if (b.dataset.act === "edit") return openDialog(i);
    else if (b.dataset.act === "del") {
      if (!confirm(`Xoá "${games[i].name}" khỏi danh sách? (Chỉ có hiệu lực sau khi Publish)`)) return;
      games.splice(i, 1);
    } else return;
    markDirty("games");
    renderGames();
  });

  // ---------- Game dialog ----------
  const dialog = $("#game-dialog");
  const form = $("#game-form");

  function parsePkg(v) {
    v = v.trim();
    try {
      const id = new URL(v).searchParams.get("id");
      if (id) return id;
    } catch {}
    return v;
  }
  const PKG_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

  function renderDialogIcon(g) {
    const box = $("#icon-preview");
    const src = state.dialogIcon || iconSrc(g.icon);
    box.className = "ic ic-lg";
    if (src) {
      box.style.removeProperty("--h");
      box.innerHTML = `<img src="${esc(src)}" alt="" />`;
      box.firstChild.onerror = () => renderDialogIcon({ ...g, icon: "" });
    } else {
      box.classList.add("ph");
      box.style.setProperty("--h", hue(g.id || g.name || "?"));
      box.textContent = initials(g.name || "?");
    }
  }

  function openDialog(i) {
    state.editing = i;
    state.dialogIcon = null;
    const g = i >= 0 ? state.data.games[i] : { id: "", name: "", genre: "", tagline: "", icon: "", featured: false };
    $("#dialog-title").textContent = i >= 0 ? "Sửa game" : "Thêm game";
    form.reset();
    form.id.value = g.id;
    form.name.value = g.name;
    form.genre.value = g.genre || "";
    form.tagline.value = g.tagline || "";
    form.featured.checked = !!g.featured;
    $("#form-error").hidden = true;
    renderDialogIcon(g);
    dialog.showModal();
  }

  function toPng512(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = 512;
        const s = Math.min(img.width, img.height);
        c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 512, 512);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được file ảnh")); };
      img.src = url;
    });
  }

  form.icon.addEventListener("change", async () => {
    const f = form.icon.files[0];
    if (!f) return;
    try {
      state.dialogIcon = await toPng512(f);
      renderDialogIcon({ name: form.name.value, id: form.id.value });
    } catch (e) {
      showFormError(e.message);
    }
  });
  form.name.addEventListener("input", () => {
    if (!state.dialogIcon && !(state.editing >= 0 && state.data.games[state.editing].icon))
      renderDialogIcon({ name: form.name.value, id: form.id.value });
  });

  function showFormError(msg) {
    const el = $("#form-error");
    el.textContent = msg;
    el.hidden = false;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const games = state.data.games;
    const id = parsePkg(form.id.value);
    if (!PKG_RE.test(id)) return showFormError("Package name không hợp lệ (ví dụ: com.studio.mygame).");
    const dup = games.findIndex((g) => g.id === id);
    if (dup >= 0 && dup !== state.editing) return showFormError(`Package "${id}" đã có trong danh sách.`);

    const prev = state.editing >= 0 ? games[state.editing] : {};
    const g = {
      id,
      name: form.name.value.trim(),
      genre: form.genre.value.trim(),
      tagline: form.tagline.value.trim(),
      icon: prev.icon || "",
    };
    if (state.dialogIcon) {
      // Unique filename so browsers/CDN never serve a stale cached icon.
      g.icon = `assets/games/${id}-${Date.now().toString(36)}.png`;
      state.pendingIcons.set(g.icon, state.dialogIcon);
    }
    if (form.featured.checked) {
      games.forEach((x) => delete x.featured);
      g.featured = true;
    }

    if (state.editing >= 0) games[state.editing] = g;
    else games.push(g);
    dialog.close();
    markDirty("games");
    renderGames();
  });

  $("#cancel-dialog").addEventListener("click", () => dialog.close());
  $("#add-game").addEventListener("click", () => openDialog(-1));

  // ---------- Studio tab ----------
  const studioForm = $("#studio-form");
  function renderStudio() {
    const s = state.data.studio;
    for (const el of studioForm.elements) if (el.name) el.value = s[el.name] || "";
  }
  studioForm.addEventListener("input", (e) => {
    if (!e.target.name) return;
    state.data.studio[e.target.name] = e.target.value.trim();
    markDirty("games");
  });
  studioForm.addEventListener("submit", (e) => e.preventDefault());

  // ---------- app-ads.txt tab ----------
  const adsText = $("#ads-text");
  function checkAds() {
    const lines = state.ads.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const out = [];
    const records = lines.filter((l) => !/^[a-z]+=/i.test(l)); // skip variables like contact=
    const bad = records.filter((l) => l.split(",").length < 3);
    const admob = records.filter((l) => /^google\.com\s*,/i.test(l));
    if (!records.length) out.push(["bad", "File chưa có dòng nào."]);
    bad.forEach((l) => out.push(["bad", `Sai định dạng (cần ít nhất 3 phần cách nhau bởi dấu phẩy): ${l}`]));
    if (/pub-0{16}/.test(state.ads)) out.push(["bad", "Vẫn còn publisher ID mẫu pub-0000000000000000 — thay bằng ID AdMob thật."]);
    admob.forEach((l) => {
      const parts = l.split(",").map((p) => p.trim());
      if (!/^pub-\d{16}$/.test(parts[1])) out.push(["bad", `Publisher ID không đúng dạng pub-XXXXXXXXXXXXXXXX: ${parts[1]}`]);
      if (parts[3] && parts[3] !== ADMOB_TAG) out.push(["bad", `ID TAG của Google phải là ${ADMOB_TAG}.`]);
    });
    if (!out.length) out.push(["good", `✓ ${records.length} dòng hợp lệ.`]);
    $("#ads-check").innerHTML = out.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("");
  }
  adsText.addEventListener("input", () => {
    state.ads = adsText.value;
    markDirty("ads");
    checkAds();
  });

  // ---------- Tabs ----------
  $(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    $$(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  });
  const showTab = (name) => $(`.tabs button[data-tab="${name}"]`).click();

  // ---------- Load ----------
  function setData(json, ads) {
    state.data = {
      studio: { ...(json && json.studio) },
      games: Array.isArray(json && json.games) ? json.games : [],
    };
    state.ads = ads || "";
    state.pendingIcons.clear();
    state.dirty.clear();
    adsText.value = state.ads;
    renderGames();
    renderStudio();
    checkAds();
    renderStatus();
  }

  async function loadLocal() {
    const [json, ads] = await Promise.all([
      fetch("/games.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/app-ads.txt", { cache: "no-cache" }).then((r) => (r.ok ? r.text() : "")).catch(() => ""),
    ]);
    setData(json, ads);
  }

  async function loadRemote() {
    const [json, ads] = await Promise.all([getFile("games.json"), getFile("app-ads.txt")]);
    state.sha.json = json && json.sha;
    state.sha.ads = ads && ads.sha;
    let parsed = null;
    if (json) {
      try { parsed = JSON.parse(json.text); } catch { throw new Error("games.json trên GitHub không phải JSON hợp lệ."); }
    }
    setData(parsed, ads ? ads.text : "");
  }

  async function connect() {
    state.busy = true;
    renderStatus();
    try {
      const repo = await gh("");
      if (!repo.permissions || !repo.permissions.push)
        throw new Error("Token không có quyền ghi (Contents: Read and write) vào repo này.");
      state.connected = true;
      await loadRemote();
      notify(`Đã kết nối <strong>${esc(cfg.owner)}/${esc(cfg.repo)}</strong> (${esc(cfg.branch)}). Dữ liệu đang được tải từ GitHub.`, "ok");
    } catch (e) {
      state.connected = false;
      const msg = e.status === 401 ? "Token không hợp lệ hoặc đã hết hạn." : e.status === 404 ? "Không tìm thấy repo, hoặc token không có quyền truy cập repo này." : e.message;
      notify(`Không kết nối được GitHub: ${esc(msg)}`, "err");
      throw e;
    } finally {
      state.busy = false;
      renderStatus();
    }
  }

  // ---------- Settings ----------
  const sForm = $("#settings-form");
  sForm.owner.value = cfg.owner;
  sForm.repo.value = cfg.repo;
  sForm.branch.value = cfg.branch;
  sForm.token.value = cfg.token;
  sForm.remember.checked = cfg.remember;

  sForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.dirty.size && !confirm("Kết nối lại sẽ tải dữ liệu từ GitHub và bỏ các thay đổi chưa publish. Tiếp tục?")) return;
    cfg = {
      owner: sForm.owner.value.trim(),
      repo: sForm.repo.value.trim(),
      branch: sForm.branch.value.trim() || "main",
      token: sForm.token.value.trim(),
      remember: sForm.remember.checked,
    };
    saveCfg();
    try {
      await connect();
      showTab("games");
    } catch {}
  });

  $("#disconnect").addEventListener("click", async () => {
    cfg.token = "";
    sForm.token.value = "";
    saveCfg();
    state.connected = false;
    notify("Đã ngắt kết nối và xoá token khỏi trình duyệt.");
    await loadLocal();
  });

  // ---------- Publish ----------
  $("#publish").addEventListener("click", async () => {
    if (!state.connected || !state.dirty.size) return;
    state.busy = true;
    renderStatus();
    notify("Đang publish lên GitHub…");
    try {
      if (state.dirty.has("games")) {
        const used = new Set(state.data.games.map((g) => g.icon));
        for (const [path, dataUrl] of state.pendingIcons) {
          if (used.has(path)) {
            await putFile(path, dataUrl.split(",")[1], `Admin: upload icon ${path.split("/").pop()}`);
            state.iconPreview.set(path, dataUrl);
          }
          state.pendingIcons.delete(path);
        }
        const body = JSON.stringify(state.data, null, 2) + "\n";
        const r = await putFile("games.json", b64enc(body), "Admin: update games", state.sha.json);
        state.sha.json = r.content.sha;
        state.dirty.delete("games");
      }
      if (state.dirty.has("ads")) {
        const text = state.ads.endsWith("\n") ? state.ads : state.ads + "\n";
        const r = await putFile("app-ads.txt", b64enc(text), "Admin: update app-ads.txt", state.sha.ads);
        state.sha.ads = r.content.sha;
        state.dirty.delete("ads");
      }
      notify("✓ Đã publish! Vercel sẽ tự deploy lại, thường mất khoảng 1 phút để trang cập nhật.", "ok");
    } catch (e) {
      const msg = e.status === 409 || e.status === 422
        ? "File trên GitHub đã bị thay đổi ở nơi khác. Hãy kết nối lại để tải bản mới nhất rồi sửa lại."
        : e.message;
      notify(`Publish thất bại: ${esc(msg)}`, "err");
    } finally {
      state.busy = false;
      renderStatus();
      renderGames();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (state.dirty.size) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- Init ----------
  (async () => {
    if (cfg.token) {
      try { return await connect(); } catch {}
    } else {
      notify('Chế độ xem. Vào tab <strong>Kết nối GitHub</strong> và nhập token để thêm/sửa game và publish.');
    }
    await loadLocal();
  })();
})();
