(function () {
"use strict";

const app = document.getElementById("app");
const STORE = "mercado-solidario-v1";       // banco COMPARTILHADO (inventário da igreja)
const USER_KEY = "mercado-solidario-user";
const THEME_KEY = "mercado-solidario-theme";
const BASE_USERS = window.USERS || [];        // usuários "oficiais" (js/users.js)
const USERS_KEY = "mercado-solidario-users";  // usuários criados pelo app (neste navegador)
let currentUser = null;
let editId = null;         // id da entrada (doação) em edição
let saidaEditId = null;    // id da saída em edição
let familiaEditId = null;  // id da família em edição
let view = "entradas";     // aba atual: "entradas" | "saidas" | "familias"

const UNIDADES = ["Gramas", "Quilos", "Caixas", "Pacotes", "Unidade"];
const AVATAR_CORES = ["#1cb0f6", "#58cc02", "#ce82ff", "#ff9600", "#ffc800", "#ff4b4b", "#2ec4b6"];

// =====================================================
// BANCO DE DADOS (JSON em localStorage) — 100% offline
//   produtos: [ { id, nome, qtd, unidade, data, por, ts } ]
// =====================================================
const DB_VERSION = 1;
function normalizeDB(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    v: DB_VERSION,
    produtos: Array.isArray(d.produtos) ? d.produtos : [],
    saidas: Array.isArray(d.saidas) ? d.saidas : [],
    familias: Array.isArray(d.familias) ? d.familias : []
  };
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
function loadExtraUsers() {
  try { const a = JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function saveExtraUsers(arr) { try { localStorage.setItem(USERS_KEY, JSON.stringify(arr)); } catch (e) {} }
function allUsers() {
  const seen = new Set(), out = [];
  BASE_USERS.concat(loadExtraUsers()).forEach(u => {
    const k = String(u.id || "").toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); out.push(u); }
  });
  return out;
}
function findUser(input) {
  const q = String(input || "").trim().toLowerCase();
  if (!q) return null;
  return allUsers().find(u => u.id.toLowerCase() === q) || null;
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

  <div class="tabs">
    <button class="tab ${view === "entradas" ? "active" : ""}" data-view="entradas">📥 Entradas</button>
    <button class="tab ${view === "saidas" ? "active" : ""}" data-view="saidas">📤 Saídas</button>
    <button class="tab ${view === "familias" ? "active" : ""}" data-view="familias">👪 Famílias</button>
  </div>

  <div id="viewContent"></div>`;

  app.querySelector("#themeBtn").addEventListener("click", toggleTheme);
  app.querySelector("#cfgBtn").addEventListener("click", openSettings);
  app.querySelector("#logoutBtn").addEventListener("click", logout);
  app.querySelectorAll(".tabs .tab").forEach(t => t.addEventListener("click", () => {
    if (view === t.dataset.view) return;
    view = t.dataset.view; editId = null; saidaEditId = null; familiaEditId = null; home();
  }));

  if (view === "saidas") renderSaidas();
  else if (view === "familias") renderFamilias();
  else renderEntradas();
  window.scrollTo(0, 0);
}

// ---------- ENTRADAS (doações) ----------
function renderEntradas() {
  const host = app.querySelector("#viewContent");
  const editando = editId !== null;
  const p = editando ? DB.produtos.find(x => x.id === editId) : null;
  const v = p || { nome: "", qtd: 1, unidade: "Unidade", data: ymd(Date.now()) };

  host.innerHTML = `
  <div class="card form-card">
    <h2>${editando ? "✏️ Editar doação" : "➕ Registrar doações"}</h2>
    <div class="fsub">${editando ? "Atualize os dados da doação." : "Adicione um ou vários produtos de uma vez."}</div>
    <div id="itemRows"></div>
    ${editando ? "" : `<button class="add-row-btn" id="addRowBtn">＋ Adicionar outro produto</button>`}
    <div class="field full" style="margin-top:14px">
      <label for="f-data">Data da doação</label>
      <input id="f-data" class="type-input" style="text-align:left" type="date" value="${esc(v.data)}">
    </div>
    <div class="form-actions">
      <button class="btn" id="saveBtn">${editando ? "Salvar alterações" : "Adicionar doações"}</button>
      ${editando ? `<button class="btn ghost" id="cancelBtn">Cancelar</button>` : ""}
    </div>
    <div id="msgHolder"></div>
  </div>

  <div class="section-h">Doações registradas</div>
  <div class="toolbar">
    <input id="search" class="type-input" style="text-align:left" placeholder="🔎 Buscar por produto…">
  </div>
  <div id="list"></div>`;

  app.querySelector("#saveBtn").addEventListener("click", saveAll);
  const cancel = app.querySelector("#cancelBtn");
  if (cancel) cancel.addEventListener("click", () => { editId = null; home(); });
  app.querySelector("#search").addEventListener("input", renderList);
  const addRowBtn = app.querySelector("#addRowBtn");
  if (addRowBtn) addRowBtn.addEventListener("click", () => {
    const r = addItemRow(); updateRemoveButtons();
    const inp = r && r.querySelector(".prod-inp"); if (inp) inp.focus();
  });
  app.querySelector("#f-data").addEventListener("keydown", e => { if (e.key === "Enter") saveAll(); });

  addItemRow(editando ? v : null);
  updateRemoveButtons();
  renderList();
  if (editando) { const fi = app.querySelector(".prod-inp"); if (fi) fi.focus(); }
}

// ---------- SAÍDAS (retiradas) ----------
function renderSaidas() {
  const host = app.querySelector("#viewContent");
  const editando = saidaEditId !== null;
  const s = editando ? DB.saidas.find(x => x.id === saidaEditId) : null;
  const v = s || { nome: "", qtd: 1, unidade: "Unidade", familia: "", obs: "", data: ymd(Date.now()) };

  host.innerHTML = `
  <div class="card form-card">
    <h2>${editando ? "✏️ Editar saída" : "📤 Registrar saída"}</h2>
    <div class="fsub">${editando ? "Atualize os dados da saída." : "Registre a saída de um ou vários produtos de uma vez."}</div>
    <div id="itemRows"></div>
    ${editando ? "" : `<button class="add-row-btn" id="addRowBtn">＋ Adicionar outro produto</button>`}
    <div class="form-grid" style="margin-top:14px">
      <div class="field full" style="position:relative">
        <label for="s-familia">Família (opcional)</label>
        <input id="s-familia" class="type-input" style="text-align:left" placeholder="Família que recebeu (digite ou escolha)" value="${esc(v.familia || "")}" autocomplete="off">
        <div class="suggest" id="sFamSuggest"></div>
      </div>
      <div class="field full">
        <label for="s-obs">Observação (opcional)</label>
        <textarea id="s-obs" class="type-input" rows="2" placeholder="Ex: entregue à família X">${esc(v.obs)}</textarea>
      </div>
      <div class="field full">
        <label for="s-data">Data da saída</label>
        <input id="s-data" class="type-input" style="text-align:left" type="date" value="${esc(v.data)}">
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="sSaveBtn">${editando ? "Salvar alterações" : "Registrar saída"}</button>
      ${editando ? `<button class="btn ghost" id="sCancelBtn">Cancelar</button>` : ""}
    </div>
    <div id="sMsgHolder"></div>
  </div>

  <div class="section-h">Saídas registradas</div>
  <div class="toolbar">
    <input id="sSearch" class="type-input" style="text-align:left" placeholder="🔎 Buscar por produto, família ou observação…">
  </div>
  <div id="saidaList"></div>`;

  attachAutocomplete(app.querySelector("#s-familia"), app.querySelector("#sFamSuggest"), distinctFamilias());
  app.querySelector("#sSaveBtn").addEventListener("click", salvarSaida);
  const c = app.querySelector("#sCancelBtn");
  if (c) c.addEventListener("click", () => { saidaEditId = null; home(); });
  app.querySelector("#sSearch").addEventListener("input", renderSaidaList);
  app.querySelector("#s-data").addEventListener("keydown", e => { if (e.key === "Enter") salvarSaida(); });
  const addRowBtn = app.querySelector("#addRowBtn");
  if (addRowBtn) addRowBtn.addEventListener("click", () => {
    const r = addItemRow(null, salvarSaida); updateRemoveButtons();
    const inp = r && r.querySelector(".prod-inp"); if (inp) inp.focus();
  });

  addItemRow(editando ? v : null, salvarSaida);
  updateRemoveButtons();
  renderSaidaList();
  if (editando) { const fi = app.querySelector(".prod-inp"); if (fi) fi.focus(); }
}

// ---------- FAMÍLIAS (cadastro) ----------
function renderFamilias() {
  const host = app.querySelector("#viewContent");
  const editando = familiaEditId !== null;
  const f = editando ? DB.familias.find(x => x.id === familiaEditId) : null;
  const v = f || { nome: "", obs: "" };

  host.innerHTML = `
  <div class="card form-card">
    <h2>${editando ? "✏️ Editar família" : "👪 Cadastrar família"}</h2>
    <div class="fsub">${editando ? "Atualize os dados da família." : "Cadastre uma família atendida pela igreja."}</div>
    <div class="form-grid">
      <div class="field full">
        <label for="fm-nome">Nome da família / responsável</label>
        <input id="fm-nome" class="type-input" style="text-align:left" placeholder="Ex: Família Silva" value="${esc(v.nome)}">
      </div>
      <div class="field full">
        <label for="fm-obs">Observação (opcional)</label>
        <textarea id="fm-obs" class="type-input" rows="2" placeholder="Ex: recebe cesta mensal">${esc(v.obs)}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="fmSaveBtn">${editando ? "Salvar alterações" : "Cadastrar família"}</button>
      ${editando ? `<button class="btn ghost" id="fmCancelBtn">Cancelar</button>` : ""}
    </div>
    <div id="fmMsgHolder"></div>
  </div>

  <div class="section-h">Famílias cadastradas</div>
  <div class="toolbar">
    <input id="fmSearch" class="type-input" style="text-align:left" placeholder="🔎 Buscar por nome ou observação…">
  </div>
  <div id="familiaList"></div>`;

  app.querySelector("#fmSaveBtn").addEventListener("click", salvarFamilia);
  const c = app.querySelector("#fmCancelBtn");
  if (c) c.addEventListener("click", () => { familiaEditId = null; home(); });
  app.querySelector("#fmSearch").addEventListener("input", renderFamiliaList);

  renderFamiliaList();
  if (editando) app.querySelector("#fm-nome").focus();
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

// ---------- autocomplete do campo Produto ----------
// lista os produtos já cadastrados (distinct, mais recentes primeiro)
function distinctNomes() {
  const seen = new Set(), out = [];
  for (let i = DB.produtos.length - 1; i >= 0; i--) {
    const nome = (DB.produtos[i].nome || "").trim();
    const key = nome.toLowerCase();
    if (nome && !seen.has(key)) { seen.add(key); out.push(nome); }
  }
  return out;
}

// nomes distintos das famílias cadastradas (mais recentes primeiro)
function distinctFamilias() {
  const seen = new Set(), out = [];
  for (let i = DB.familias.length - 1; i >= 0; i--) {
    const nome = (DB.familias[i].nome || "").trim();
    const key = nome.toLowerCase();
    if (nome && !seen.has(key)) { seen.add(key); out.push(nome); }
  }
  return out;
}

function attachAutocomplete(inp, box, source) {
  const todos = source || distinctNomes();
  if (!todos.length) return;
  const render = () => {
    const q = inp.value.trim().toLowerCase();
    let lista = q ? todos.filter(n => n.toLowerCase().startsWith(q) && n.toLowerCase() !== q) : todos;
    lista = lista.slice(0, 8);
    if (!lista.length) { box.classList.remove("open"); box.innerHTML = ""; return; }
    box.innerHTML = lista.map(n => `<button type="button" class="sug-item" data-n="${esc(n)}">${esc(n)}</button>`).join("");
    box.classList.add("open");
    box.querySelectorAll(".sug-item").forEach(b => b.addEventListener("mousedown", e => {
      e.preventDefault();
      inp.value = b.dataset.n;
      box.classList.remove("open");
      inp.focus();
    }));
  };
  inp.addEventListener("input", render);
  inp.addEventListener("focus", render);
  inp.addEventListener("blur", () => setTimeout(() => box.classList.remove("open"), 150));
}

// cria uma linha de produto no formulário (para adicionar vários de uma vez)
function addItemRow(vals, onEnter) {
  const rows = app.querySelector("#itemRows");
  if (!rows) return null;
  const save = onEnter || saveAll;
  const v = vals || { nome: "", qtd: 1, unidade: "Unidade" };
  const uniOpts = UNIDADES.map(u => `<option value="${u}">${u}</option>`).join("");
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <div class="ir-name">
      <input class="type-input prod-inp" style="text-align:left" placeholder="Produto (ex: Arroz)" value="${esc(v.nome)}" autocomplete="off">
      <div class="suggest prod-sug"></div>
    </div>
    <div class="ir-sub">
      <input class="type-input qty-inp" type="number" min="1" step="1" value="${esc(v.qtd)}" title="Quantidade">
      <select class="type-input unit-inp" title="Unidade">${uniOpts}</select>
      <button class="ir-del" title="Remover produto">✕</button>
    </div>`;
  rows.appendChild(row);
  row.querySelector(".unit-inp").value = v.unidade;

  const prodInp = row.querySelector(".prod-inp");
  const box = row.querySelector(".prod-sug");
  attachAutocomplete(prodInp, box);
  prodInp.addEventListener("keydown", e => {
    if (e.key === "Escape") { box.classList.remove("open"); return; }
    if (e.key === "Enter") { if (box.classList.contains("open")) box.classList.remove("open"); else save(); }
  });
  row.querySelector(".qty-inp").addEventListener("keydown", e => { if (e.key === "Enter") save(); });
  row.querySelector(".ir-del").addEventListener("click", () => {
    const total = app.querySelectorAll("#itemRows .item-row").length;
    if (total <= 1) {
      prodInp.value = ""; row.querySelector(".qty-inp").value = "1"; row.querySelector(".unit-inp").value = "Unidade"; prodInp.focus();
    } else {
      row.remove(); updateRemoveButtons();
    }
  });
  return row;
}

function updateRemoveButtons() {
  const rowsEls = app.querySelectorAll("#itemRows .item-row");
  const mostrar = rowsEls.length > 1 && editId === null && saidaEditId === null;
  rowsEls.forEach(r => { const d = r.querySelector(".ir-del"); if (d) d.style.display = mostrar ? "" : "none"; });
}

// =====================================================
// CRUD
// =====================================================
function saveAll() {
  const data = app.querySelector("#f-data").value;

  // edição: uma única linha atualiza o produto existente
  if (editId !== null) {
    const row = app.querySelector("#itemRows .item-row");
    const nome = row.querySelector(".prod-inp").value.trim();
    const qtd = Math.max(1, parseInt(row.querySelector(".qty-inp").value, 10) || 1);
    const unidade = row.querySelector(".unit-inp").value;
    if (!nome) { mostrarMsg("Informe o nome do produto.", true); row.querySelector(".prod-inp").focus(); return; }
    const p = DB.produtos.find(x => x.id === editId);
    if (p) Object.assign(p, { nome, qtd, unidade, data });
    saveDB();
    editId = null;
    home();
    mostrarMsg("Doação atualizada com sucesso! ✅", false);
    return;
  }

  // adição: cada linha com produto vira um registro
  const itens = [];
  app.querySelectorAll("#itemRows .item-row").forEach(row => {
    const nome = row.querySelector(".prod-inp").value.trim();
    if (!nome) return;
    const qtd = Math.max(1, parseInt(row.querySelector(".qty-inp").value, 10) || 1);
    const unidade = row.querySelector(".unit-inp").value;
    itens.push({ nome, qtd, unidade });
  });

  if (!itens.length) {
    mostrarMsg("Informe pelo menos um produto.", true);
    const fi = app.querySelector(".prod-inp"); if (fi) fi.focus();
    return;
  }

  const agora = Date.now();
  itens.forEach((it, i) => {
    DB.produtos.push({
      id: uid(), nome: it.nome, qtd: it.qtd, unidade: it.unidade, data,
      por: currentUser ? currentUser.id : "", ts: agora + i
    });
  });
  saveDB();
  home();
  mostrarMsg(itens.length === 1
    ? "Doação adicionada com sucesso! 🎉"
    : `${itens.length} doações adicionadas com sucesso! 🎉`, false);
}

function removerProduto(id) {
  const p = DB.produtos.find(x => x.id === id);
  if (!p) return;
  confirmDialog({
    title: "🗑️ Remover doação",
    message: `Remover <b>${esc(p.nome)}</b> (${esc(p.qtd)} ${esc(p.unidade)}) das doações?<br>Essa ação não pode ser desfeita.`,
    onOk: () => {
      DB.produtos = DB.produtos.filter(x => x.id !== id);
      saveDB();
      if (editId === id) editId = null;
      home();
      mostrarMsg("Doação removida.", false);
    }
  });
}

function confirmDialog(opts) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `
  <div class="modal">
    <h2>${opts.title}</h2>
    <p class="confirm-text">${opts.message}</p>
    <div class="confirm-actions">
      <button class="btn ghost" id="cCancel">Cancelar</button>
      <button class="btn red" id="cOk">${opts.okLabel || "Excluir"}</button>
    </div>
  </div>`;
  document.body.appendChild(bg);
  const onKey = e => { if (e.key === "Escape") close(); };
  function close() { document.removeEventListener("keydown", onKey); bg.remove(); }
  document.addEventListener("keydown", onKey);
  bg.querySelector("#cCancel").onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };
  bg.querySelector("#cOk").onclick = () => { close(); if (opts.onOk) opts.onOk(); };
}

// =====================================================
// SAÍDAS (CRUD)
// =====================================================
function salvarSaida() {
  const familia = app.querySelector("#s-familia").value.trim();
  const obs = app.querySelector("#s-obs").value.trim();
  const data = app.querySelector("#s-data").value;

  // edição: uma linha atualiza a saída existente
  if (saidaEditId !== null) {
    const row = app.querySelector("#itemRows .item-row");
    const nome = row.querySelector(".prod-inp").value.trim();
    const qtd = Math.max(1, parseInt(row.querySelector(".qty-inp").value, 10) || 1);
    const unidade = row.querySelector(".unit-inp").value;
    if (!nome) { mostrarMsg("Informe o nome do produto.", true, "#sMsgHolder"); row.querySelector(".prod-inp").focus(); return; }
    const s = DB.saidas.find(x => x.id === saidaEditId);
    if (s) Object.assign(s, { nome, qtd, unidade, familia, obs, data });
    garantirFamilia(familia);
    saveDB();
    saidaEditId = null;
    home();
    mostrarMsg("Saída atualizada com sucesso! ✅", false, "#sMsgHolder");
    return;
  }

  // registro: cada linha com produto vira uma saída (compartilham família/obs/data)
  const itens = [];
  app.querySelectorAll("#itemRows .item-row").forEach(row => {
    const nome = row.querySelector(".prod-inp").value.trim();
    if (!nome) return;
    const qtd = Math.max(1, parseInt(row.querySelector(".qty-inp").value, 10) || 1);
    const unidade = row.querySelector(".unit-inp").value;
    itens.push({ nome, qtd, unidade });
  });

  if (!itens.length) {
    mostrarMsg("Informe pelo menos um produto.", true, "#sMsgHolder");
    const fi = app.querySelector(".prod-inp"); if (fi) fi.focus();
    return;
  }

  const agora = Date.now();
  itens.forEach((it, i) => {
    DB.saidas.push({
      id: uid(), nome: it.nome, qtd: it.qtd, unidade: it.unidade, familia, obs, data,
      por: currentUser ? currentUser.id : "", ts: agora + i
    });
  });
  garantirFamilia(familia);
  saveDB();
  home();
  mostrarMsg(itens.length === 1
    ? "Saída registrada com sucesso! 🎉"
    : `${itens.length} saídas registradas com sucesso! 🎉`, false, "#sMsgHolder");
}

function renderSaidaList() {
  const wrap = app.querySelector("#saidaList");
  if (!wrap) return;
  const busca = (app.querySelector("#sSearch").value || "").trim().toLowerCase();
  let itens = DB.saidas.slice().reverse();
  if (busca) itens = itens.filter(s =>
    (s.nome || "").toLowerCase().includes(busca) ||
    (s.familia || "").toLowerCase().includes(busca) ||
    (s.obs || "").toLowerCase().includes(busca));

  if (!itens.length) {
    wrap.innerHTML = DB.saidas.length
      ? `<div class="empty-note"><div class="big">🔎</div>Nenhuma saída encontrada.</div>`
      : `<div class="empty-note"><div class="big">📤</div>Nenhuma saída registrada ainda.<br>Registre a primeira no formulário acima!</div>`;
    return;
  }

  wrap.innerHTML = itens.map(s => `
    <div class="prod">
      <div class="picon">📤</div>
      <div class="prod-info">
        <h3>${esc(s.nome)}</h3>
        <p><span class="qty">${esc(s.qtd)} ${esc(s.unidade)}</span> · ${dataBR(s.data)}${s.familia ? " · 👪 " + esc(s.familia) : ""}</p>
        ${s.obs ? `<p class="prod-obs">📝 ${esc(s.obs)}</p>` : ""}
      </div>
      <div class="row-actions">
        <button class="icon-btn" title="Editar" data-sedit="${s.id}">✏️</button>
        <button class="icon-btn del" title="Remover" data-sdel="${s.id}">🗑️</button>
      </div>
    </div>`).join("");

  wrap.querySelectorAll("[data-sedit]").forEach(b => b.onclick = () => { saidaEditId = b.dataset.sedit; home(); });
  wrap.querySelectorAll("[data-sdel]").forEach(b => b.onclick = () => removerSaida(b.dataset.sdel));
}

function removerSaida(id) {
  const s = DB.saidas.find(x => x.id === id);
  if (!s) return;
  confirmDialog({
    title: "🗑️ Remover saída",
    message: `Remover a saída de <b>${esc(s.nome)}</b> (${esc(s.qtd)} ${esc(s.unidade)})?<br>Essa ação não pode ser desfeita.`,
    onOk: () => {
      DB.saidas = DB.saidas.filter(x => x.id !== id);
      saveDB();
      if (saidaEditId === id) saidaEditId = null;
      home();
      mostrarMsg("Saída removida.", false, "#sMsgHolder");
    }
  });
}

// =====================================================
// FAMÍLIAS (CRUD)
// =====================================================
// cadastra a família automaticamente se ainda não existir (usado nas saídas)
function garantirFamilia(nome) {
  const n = (nome || "").trim();
  if (!n) return;
  const existe = DB.familias.some(f => (f.nome || "").trim().toLowerCase() === n.toLowerCase());
  if (!existe) {
    DB.familias.push({ id: uid(), nome: n, obs: "", por: currentUser ? currentUser.id : "", ts: Date.now() });
  }
}

function salvarFamilia() {
  const nome = app.querySelector("#fm-nome").value.trim();
  const obs = app.querySelector("#fm-obs").value.trim();

  if (!nome) { mostrarMsg("Informe o nome da família.", true, "#fmMsgHolder"); app.querySelector("#fm-nome").focus(); return; }

  if (familiaEditId !== null) {
    const f = DB.familias.find(x => x.id === familiaEditId);
    if (f) Object.assign(f, { nome, obs });
    saveDB();
    familiaEditId = null;
    home();
    mostrarMsg("Família atualizada com sucesso! ✅", false, "#fmMsgHolder");
  } else {
    DB.familias.push({ id: uid(), nome, obs, por: currentUser ? currentUser.id : "", ts: Date.now() });
    saveDB();
    home();
    mostrarMsg("Família cadastrada com sucesso! 🎉", false, "#fmMsgHolder");
  }
}

function renderFamiliaList() {
  const wrap = app.querySelector("#familiaList");
  if (!wrap) return;
  const busca = (app.querySelector("#fmSearch").value || "").trim().toLowerCase();
  let itens = DB.familias.slice().reverse();
  if (busca) itens = itens.filter(f =>
    (f.nome || "").toLowerCase().includes(busca) ||
    (f.obs || "").toLowerCase().includes(busca));

  if (!itens.length) {
    wrap.innerHTML = DB.familias.length
      ? `<div class="empty-note"><div class="big">🔎</div>Nenhuma família encontrada.</div>`
      : `<div class="empty-note"><div class="big">👪</div>Nenhuma família cadastrada ainda.<br>Cadastre a primeira no formulário acima!</div>`;
    return;
  }

  wrap.innerHTML = itens.map(f => `
    <div class="prod">
      <div class="picon">👪</div>
      <div class="prod-info">
        <h3>${esc(f.nome)}</h3>
        <p>${f.obs ? "📝 " + esc(f.obs) : "cadastrada em " + dmy(f.ts || Date.now())}</p>
      </div>
      <div class="row-actions">
        <button class="icon-btn" title="Editar" data-fedit="${f.id}">✏️</button>
        <button class="icon-btn del" title="Remover" data-fdel="${f.id}">🗑️</button>
      </div>
    </div>`).join("");

  wrap.querySelectorAll("[data-fedit]").forEach(b => b.onclick = () => { familiaEditId = b.dataset.fedit; home(); });
  wrap.querySelectorAll("[data-fdel]").forEach(b => b.onclick = () => removerFamilia(b.dataset.fdel));
}

function removerFamilia(id) {
  const f = DB.familias.find(x => x.id === id);
  if (!f) return;
  confirmDialog({
    title: "🗑️ Remover família",
    message: `Remover <b>${esc(f.nome)}</b> do cadastro?<br>Essa ação não pode ser desfeita.`,
    onOk: () => {
      DB.familias = DB.familias.filter(x => x.id !== id);
      saveDB();
      if (familiaEditId === id) familiaEditId = null;
      home();
      mostrarMsg("Família removida.", false, "#fmMsgHolder");
    }
  });
}

function mostrarMsg(texto, isErr, holderSel) {
  const sel = holderSel || "#msgHolder";
  const holder = app.querySelector(sel);
  if (!holder) return;
  holder.innerHTML = `<div class="form-msg ${isErr ? "err" : ""}">${esc(texto)}</div>`;
  clearTimeout(mostrarMsg._t);
  mostrarMsg._t = setTimeout(() => { const h = app.querySelector(sel); if (h) h.innerHTML = ""; }, 3500);
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
      <button class="nav-btn" id="mAddUser">👤 Adicionar usuário</button>
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
  bg.querySelector("#mAddUser").onclick = () => { close(); openAddUser(); };
  bg.querySelector("#mExport").onclick = () => { close(); exportDB(); };
  bg.querySelector("#mImport").onclick = () => { close(); pickImportFile(); };
}

// ---------- popup: adicionar usuário ----------
function openAddUser() {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `
  <div class="modal">
    <button class="close-x" title="Fechar">✕</button>
    <h2>👤 Adicionar usuário</h2>
    <div class="modal-form">
      <div class="field">
        <label for="u-nome">Nome</label>
        <input id="u-nome" class="type-input" style="text-align:left" placeholder="Ex: João" autocomplete="off">
      </div>
      <div class="field">
        <label for="u-id">Nome de usuário</label>
        <input id="u-id" class="type-input" style="text-align:left" placeholder="Ex: joao_ms" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="mini-hint">Deve terminar com <b>_ms</b>.</div>
      </div>
    </div>
    <div id="u-msg"></div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="btn" id="u-save">Cadastrar</button>
    </div>
  </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.querySelector(".close-x").onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };

  const nomeEl = bg.querySelector("#u-nome");
  const idEl = bg.querySelector("#u-id");
  const msg = bg.querySelector("#u-msg");
  const showErr = t => { msg.innerHTML = `<div class="form-msg err">${esc(t)}</div>`; };
  const showOk = t => { msg.innerHTML = `<div class="form-msg">${esc(t)}</div>`; };

  const salvar = () => {
    const nome = nomeEl.value.trim();
    const id = idEl.value.trim().toLowerCase().replace(/\s+/g, "");
    if (!nome) { showErr("Informe o nome."); nomeEl.focus(); return; }
    if (!id) { showErr("Informe o nome de usuário."); idEl.focus(); return; }
    if (!id.endsWith("_ms")) { showErr("O nome de usuário deve terminar com _ms."); idEl.focus(); return; }
    if (!/^[a-z0-9_]+_ms$/.test(id)) { showErr("Use só letras, números e _ (ex: joao_ms)."); idEl.focus(); return; }
    if (findUser(id)) { showErr("Esse nome de usuário já existe."); idEl.focus(); return; }

    const extras = loadExtraUsers();
    extras.push({ id, name: nome, avatar: "👤", color: AVATAR_CORES[extras.length % AVATAR_CORES.length] });
    saveExtraUsers(extras);
    showOk(`Usuário “${nome}” (${id}) cadastrado! ✅`);
    nomeEl.value = ""; idEl.value = ""; nomeEl.focus();
  };

  bg.querySelector("#u-save").onclick = salvar;
  nomeEl.addEventListener("keydown", e => { if (e.key === "Enter") idEl.focus(); });
  idEl.addEventListener("keydown", e => { if (e.key === "Enter") salvar(); });
  nomeEl.focus();
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
