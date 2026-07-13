(function () {
"use strict";

const app = document.getElementById("app");
const STORE = "mercado-solidario-v1";       // banco COMPARTILHADO (inventário da igreja)
const USER_KEY = "mercado-solidario-user";
const THEME_KEY = "mercado-solidario-theme";
const USERS = window.USERS || [];
let currentUser = null;
let editId = null;   // id do produto em edição (null = adicionando)

const UNIDADES = ["Gramas", "Quilos", "Caixas", "Pacotes", "Unidade"];

// =====================================================
// BANCO DE DADOS (JSON em localStorage) — 100% offline
//   produtos: [ { id, nome, qtd, unidade, data, por, ts } ]
// =====================================================
const DB_VERSION = 1;
function normalizeDB(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return { v: DB_VERSION, produtos: Array.isArray(d.produtos) ? d.produtos : [] };
}
let DB = normalizeDB(null);
function loadDB() {
  try { return normalizeDB(JSON.parse(localStorage.getItem(STORE) || "{}")); }
  catch (e) { return normalizeDB(null); }
}
function saveDB() { try { localStorage.setItem(STORE, JSON.stringify(DB)); } catch (e) {} }

// ---------- export / import do db.json ----------
function exportDB() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "db-mercado-solidario-" + ymd(Date.now()) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importDB(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      DB = normalizeDB(JSON.parse(r.result));
      saveDB();
      alert("Banco de doações importado com sucesso! ✅");
      home();
    } catch (e) { alert("Arquivo inválido. Selecione um db.json exportado por este app."); }
  };
  r.readAsText(file);
}
function pickImportFile() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = () => { if (inp.files && inp.files[0]) importDB(inp.files[0]); };
  inp.click();
}

// =====================================================
// HELPERS
// =====================================================
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function uid() { return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

// datas
function ymd(ts) { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function dmy(ts) { const d = new Date(ts); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); }
function dataBR(iso) { if (!iso) return "—"; const p = String(iso).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso; }

// ---------- tema ----------
function currentTheme() { return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"; }
function toggleTheme() {
  const t = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.content = t === "light" ? "#f7f7f7" : "#131f24";
  const b = document.querySelector(".theme-toggle");
  if (b) { b.textContent = t === "dark" ? "☀️" : "🌙"; b.title = t === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"; }
}

// =====================================================
// LOGIN / USUÁRIOS (valida contra o banco em js/users.js)
// =====================================================
function findUser(input) {
  const q = String(input || "").trim().toLowerCase();
  if (!q) return null;
  return USERS.find(u => u.id.toLowerCase() === q) || null;
}
function login(user) {
  if (!user) return;
  currentUser = user;
  localStorage.setItem(USER_KEY, user.id);
  DB = loadDB();
  editId = null;
  home();
}
function logout() {
  currentUser = null;
  localStorage.removeItem(USER_KEY);
  loginScreen();
}
function loginScreen() {
  const dark = currentTheme() === "dark";
  app.innerHTML = `
  <div class="login">
    <button class="theme-toggle login-theme" title="${dark ? "Mudar para tema claro" : "Mudar para tema escuro"}">${dark ? "☀️" : "🌙"}</button>
    <div class="login-brand"><span>🤝</span> Mercado Solidário</div>
    <div class="login-sub">Controle de doações da igreja</div>
    <div class="login-title">Quem é você?</div>
    <div class="login-form">
      <input id="userInput" class="type-input" placeholder="Usuário" autocomplete="off" autocapitalize="off" spellcheck="false">
      <button class="btn" id="loginBtn">Entrar</button>
    </div>
    <div class="login-err" id="loginErr"></div>
    <div class="login-hint">Acesso apenas com login cadastrado.<br>Fale com o responsável se você ainda não tem acesso.</div>
  </div>`;

  app.querySelector(".login-theme").addEventListener("click", toggleTheme);
  const inp = app.querySelector("#userInput");
  const err = app.querySelector("#loginErr");
  const doLogin = () => {
    const u = findUser(inp.value);
    if (!u) { err.textContent = "Usuário “" + inp.value.trim() + "” não encontrado. 🤔"; inp.focus(); return; }
    login(u);
  };
  app.querySelector("#loginBtn").addEventListener("click", doLogin);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
  inp.focus();
  window.scrollTo(0, 0);
}

// =====================================================
// HOME — formulário de doação + lista
// =====================================================
function home() {
  const dark = currentTheme() === "dark";
  const totalItens = DB.produtos.reduce((s, p) => s + (parseInt(p.qtd, 10) || 0), 0);

  const uniOpts = UNIDADES.map(u => `<option value="${u}">${u}</option>`).join("");
  const editando = editId !== null;
  const p = editando ? DB.produtos.find(x => x.id === editId) : null;
  const v = p || { nome: "", qtd: 1, unidade: "Unidade", data: ymd(Date.now()) };

  app.innerHTML = `
  <div class="topbar">
    <div class="brand"><span>🤝</span> Mercado Solidário</div>
    <div class="top-right">
      <div class="stats"><span class="done">📦 ${totalItens}</span></div>
      <button class="cfg-btn" id="cfgBtn" title="Configurações">⚙️</button>
      <button class="theme-toggle" id="themeBtn" title="${dark ? "Mudar para tema claro" : "Mudar para tema escuro"}">${dark ? "☀️" : "🌙"}</button>
    </div>
  </div>

  <div class="user-bar">
    <div class="avatar sm" style="background:${currentUser.color}">${currentUser.avatar}</div>
    <div class="uwrap"><div class="uhi">Olá, ${esc(currentUser.name)}! 👋</div></div>
    <button class="nav-btn" id="logoutBtn">↩︎ Trocar usuário</button>
  </div>

  <div class="card form-card">
    <h2>${editando ? "✏️ Editar doação" : "➕ Registrar doação"}</h2>
    <div class="fsub">Preencha os dados do produto doado para a igreja.</div>
    <div class="form-grid">
      <div class="field full">
        <label for="f-nome">Produto</label>
        <input id="f-nome" class="type-input" style="text-align:left" placeholder="Ex: Arroz 5kg, Camiseta, Sabonete…" value="${esc(v.nome)}">
      </div>
      <div class="field">
        <label for="f-qtd">Quantidade</label>
        <input id="f-qtd" class="type-input" type="number" min="1" step="1" value="${esc(v.qtd)}">
      </div>
      <div class="field">
        <label for="f-unidade">Unidade</label>
        <select id="f-unidade" class="type-input">${uniOpts}</select>
      </div>
      <div class="field full">
        <label for="f-data">Data da doação</label>
        <input id="f-data" class="type-input" style="text-align:left" type="date" value="${esc(v.data)}">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="saveBtn">${editando ? "Salvar alterações" : "Adicionar doação"}</button>
      ${editando ? `<button class="btn ghost" id="cancelBtn">Cancelar</button>` : ""}
    </div>
    <div id="msgHolder"></div>
  </div>

  <div class="section-h">Doações registradas</div>
  <div class="toolbar">
    <input id="search" class="type-input" style="text-align:left" placeholder="🔎 Buscar por produto…">
  </div>
  <div id="list"></div>`;

  // valor do select de unidade
  app.querySelector("#f-unidade").value = v.unidade;

  // binds
  app.querySelector("#themeBtn").addEventListener("click", toggleTheme);
  app.querySelector("#cfgBtn").addEventListener("click", openSettings);
  app.querySelector("#logoutBtn").addEventListener("click", logout);
  app.querySelector("#saveBtn").addEventListener("click", salvarProduto);
  const cancel = app.querySelector("#cancelBtn");
  if (cancel) cancel.addEventListener("click", () => { editId = null; home(); });
  app.querySelector("#search").addEventListener("input", renderList);
  app.querySelector("#f-nome").addEventListener("keydown", e => { if (e.key === "Enter") salvarProduto(); });

  renderList();
  if (editando) app.querySelector("#f-nome").focus();
  window.scrollTo(0, 0);
}

function renderList() {
  const wrap = app.querySelector("#list");
  if (!wrap) return;
  const busca = (app.querySelector("#search").value || "").trim().toLowerCase();

  let itens = DB.produtos.slice().reverse();
  if (busca) itens = itens.filter(p => (p.nome || "").toLowerCase().includes(busca));

  if (!itens.length) {
    wrap.innerHTML = DB.produtos.length
      ? `<div class="empty-note"><div class="big">🔎</div>Nenhuma doação encontrada.</div>`
      : `<div class="empty-note"><div class="big">📦</div>Nenhuma doação registrada ainda.<br>Cadastre a primeira no formulário acima!</div>`;
    return;
  }

  wrap.innerHTML = itens.map(p => `
    <div class="prod">
      <div class="picon">📦</div>
      <div class="prod-info">
        <h3>${esc(p.nome)}</h3>
        <p><span class="qty">${esc(p.qtd)} ${esc(p.unidade)}</span> · ${dataBR(p.data)}</p>
      </div>
      <div class="row-actions">
        <button class="icon-btn" title="Editar" data-edit="${p.id}">✏️</button>
        <button class="icon-btn del" title="Remover" data-del="${p.id}">🗑️</button>
      </div>
    </div>`).join("");

  wrap.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { editId = b.dataset.edit; home(); });
  wrap.querySelectorAll("[data-del]").forEach(b => b.onclick = () => removerProduto(b.dataset.del));
}

// =====================================================
// CRUD
// =====================================================
function salvarProduto() {
  const nome = app.querySelector("#f-nome").value.trim();
  const qtd = Math.max(1, parseInt(app.querySelector("#f-qtd").value, 10) || 1);
  const unidade = app.querySelector("#f-unidade").value;
  const data = app.querySelector("#f-data").value;

  if (!nome) { mostrarMsg("Informe o nome do produto.", true); app.querySelector("#f-nome").focus(); return; }

  if (editId !== null) {
    const p = DB.produtos.find(x => x.id === editId);
    if (p) Object.assign(p, { nome, qtd, unidade, data });
    saveDB();
    editId = null;
    home();
    mostrarMsg("Doação atualizada com sucesso! ✅", false);
  } else {
    DB.produtos.push({
      id: uid(), nome, qtd, unidade, data,
      por: currentUser ? currentUser.id : "", ts: Date.now()
    });
    saveDB();
    home();
    mostrarMsg("Doação adicionada com sucesso! 🎉", false);
  }
}

function removerProduto(id) {
  const p = DB.produtos.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Remover "${p.nome}" das doações?`)) return;
  DB.produtos = DB.produtos.filter(x => x.id !== id);
  saveDB();
  if (editId === id) editId = null;
  home();
}

function mostrarMsg(texto, isErr) {
  const holder = app.querySelector("#msgHolder");
  if (!holder) return;
  holder.innerHTML = `<div class="form-msg ${isErr ? "err" : ""}">${esc(texto)}</div>`;
  clearTimeout(mostrarMsg._t);
  mostrarMsg._t = setTimeout(() => { const h = app.querySelector("#msgHolder"); if (h) h.innerHTML = ""; }, 3500);
}

// =====================================================
// POPUP DE CONFIGURAÇÕES
// =====================================================
function openSettings() {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `
  <div class="modal">
    <button class="close-x" title="Fechar">✕</button>
    <h2>⚙️ Configurações</h2>
    <div class="modal-actions">
      <button class="nav-btn" id="mResumo">📊 Resumo</button>
      <button class="nav-btn" id="mExport">⬇️ Exportar db.json</button>
      <button class="nav-btn" id="mImport">⬆️ Importar db.json</button>
    </div>
    <div class="modal-note">As doações ficam salvas neste navegador (banco JSON offline).<br>
    Use <b>Exportar</b> para gerar um <b>db.json</b> de backup ou levar para outro computador.</div>
  </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".close-x").onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };
  bg.querySelector("#mResumo").onclick = () => { close(); stats(); };
  bg.querySelector("#mExport").onclick = () => { close(); exportDB(); };
  bg.querySelector("#mImport").onclick = () => { close(); pickImportFile(); };
}

// =====================================================
// RESUMO / DASHBOARD
// =====================================================
function stats() {
  const prods = DB.produtos;
  const totalRegistros = prods.length;
  const totalItens = prods.reduce((s, p) => s + (parseInt(p.qtd, 10) || 0), 0);

  let html = `
  <div class="dash-head">
    <button class="dash-back" id="back" title="Voltar">←</button>
    <h1>📊 Resumo das doações</h1>
    <button class="theme-toggle" title="Tema">${currentTheme() === "dark" ? "☀️" : "🌙"}</button>
  </div>`;

  if (!totalRegistros) {
    html += `<div class="empty-note"><div class="big">🌱</div>
      Ainda não há doações registradas.<br>Volte e cadastre a primeira!
      <div style="height:20px"></div>
      <button class="btn" id="go">Registrar doação</button></div>`;
    app.innerHTML = html;
    app.querySelector("#back").onclick = home;
    app.querySelector("#go").onclick = home;
    app.querySelector(".theme-toggle").onclick = () => { toggleTheme(); stats(); };
    return;
  }

  html += `<div class="tiles">
    <div class="tile a"><div class="v">${totalRegistros}</div><div class="k">registros</div></div>
    <div class="tile b"><div class="v">${totalItens}</div><div class="k">itens no total</div></div>
  </div>`;

  html += `<div class="panel"><h2>Doações (últimos 14 dias)</h2><div class="psub">Registros por dia</div>${buildDayBars(prods)}</div>`;
  html += `<div class="panel"><h2>Últimas doações</h2><div class="psub">As ${Math.min(8, totalRegistros)} mais recentes</div>${buildRecent(prods)}</div>`;

  html += `<div class="io-row">
    <button class="nav-btn" id="expBtn">⬇️ Exportar db.json</button>
    <button class="nav-btn" id="home">🏠 Voltar</button>
  </div><div style="height:24px"></div>`;

  app.innerHTML = html;
  app.querySelector("#back").onclick = home;
  app.querySelector("#home").onclick = home;
  app.querySelector("#expBtn").onclick = exportDB;
  app.querySelector(".theme-toggle").onclick = () => { toggleTheme(); stats(); };
  window.scrollTo(0, 0);
}

function buildDayBars(prods) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); days.push({ ts: d.getTime(), key: ymd(d.getTime()), n: 0 }); }
  const idx = {}; days.forEach(d => idx[d.key] = d);
  prods.forEach(p => { const k = p.data || ymd(p.ts || Date.now()); if (idx[k]) idx[k].n++; });
  const maxN = Math.max(1, ...days.map(d => d.n));
  const cols = days.map(d => {
    const h = d.n ? Math.max(6, Math.round(d.n / maxN * 100)) : 0;
    return `<div class="day-col${d.n ? "" : " empty"}" title="${dmy(d.ts)} — ${d.n} doação(ões)">
      <div class="day-n">${d.n || ""}</div>
      <div class="day-fill" style="height:${d.n ? h + "%" : "3px"}"></div>
      <div class="day-cap">${String(new Date(d.ts).getDate()).padStart(2, "0")}</div>
    </div>`;
  }).join("");
  return `<div class="day-bars">${cols}</div>`;
}

function buildRecent(prods) {
  const rows = prods.slice(-8).reverse().map(p => `<tr>
    <td>${dataBR(p.data)}</td>
    <td>${esc(p.nome)}</td>
    <td style="font-weight:800">${esc(p.qtd)} ${esc(p.unidade)}</td>
  </tr>`).join("");
  return `<div class="tbl-wrap"><table class="rec">
    <thead><tr><th>Data</th><th>Produto</th><th>Qtd</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// =====================================================
// BOOT
// =====================================================
(function boot() {
  const saved = localStorage.getItem(USER_KEY);
  const u = saved ? findUser(saved) : null;
  if (u) login(u); else loginScreen();
})();
})();
