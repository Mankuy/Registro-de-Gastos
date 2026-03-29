'use strict';

// ════════════════════════════════════════════════════════════
//  1. CONFIGURACIÓN MAESTRA FIREBASE (VERIFICADA: TERMINA EN 'Do')
// ════════════════════════════════════════════════════════════
var firebaseConfig = {
  apiKey: "AIzaSyDFCba95ny7I2HAA2KVm8IQgzgq-YkLJDo", 
  authDomain: "registro-gastos-8a864.firebaseapp.com",
  databaseURL: "https://registro-gastos-8a864-default-rtdb.firebaseio.com/",
  projectId: "registro-gastos-8a864",
  storageBucket: "registro-gastos-8a864.firebasestorage.app",
  messagingSenderId: "893257009763",
  appId: "1:893257009763:web:56d9c9dbdb682a3417f576",
  measurementId: "G-P81R3MJQP7"
};

// Inicialización de Firebase (Estilo Compat v8)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const fbAuth = firebase.auth();
const fbDatabase = firebase.database();

// ════════════════════════════════════════════════════════════
//  2. VARIABLES DE ESTADO Y CONSTANTES
// ════════════════════════════════════════════════════════════
const DEFAULT_MEMBERS = ['Facu', 'Lu', 'Fran'];
const DEFAULT_COMMERCES = ['Supermercado', 'Almacén', 'Feria', 'Farmacia', 'Otros'];

let currentUserId = null;
let profiles = {};
let activeId = '';
let state = {};
let currentMonth = null;
let historialOpen = false;

// ════════════════════════════════════════════════════════════
//  3. FUNCIONES DE USUARIOS (ARREGLADAS)
// ════════════════════════════════════════════════════════════

async function registerUser(username, displayName, password) {
  username = (username || '').trim().toLowerCase();
  try {
    const fakeEmail = username + "@gestor.hogar.app";
    const userCredential = await fbAuth.createUserWithEmailAndPassword(fakeEmail, password);
    const userId = userCredential.user.uid;
    
    // Guardar info básica en la DB
    await fbDatabase.ref(`users/${userId}/auth`).set({
      username: username,
      displayName: displayName || username,
      createdAt: Date.now()
    });
    return { ok: true, userId };
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') return { ok: false, error: 'Ese usuario ya existe' };
    return { ok: false, error: e.message };
  }
}

async function loginUser(username, password) {
  username = (username || '').trim().toLowerCase();
  try {
    const fakeEmail = username + "@gestor.hogar.app";
    const userCredential = await fbAuth.signInWithEmailAndPassword(fakeEmail, password);
    return { ok: true, userId: userCredential.user.uid };
  } catch (e) {
    return { ok: false, error: 'Usuario o contraseña incorrectos' };
  }
}

// ════════════════════════════════════════════════════════════
//  4. MOTOR DE PERSISTENCIA (LOCAL + NUBE)
// ════════════════════════════════════════════════════════════

function saveState() {
  if (currentUserId && activeId && state) {
    // Guardar en el navegador (Local)
    localStorage.setItem('hogar_profiles_' + currentUserId, JSON.stringify(profiles));
    localStorage.setItem('hogar_active_id_' + currentUserId, activeId);
    
    // Sincronizar con Firebase (Para el Bot de Telegram)
    fbDatabase.ref(`users/${currentUserId}/data`).set(state)
      .then(() => console.log("☁️ Nube actualizada"))
      .catch(err => console.error("❌ Error de red:", err));
  }
}

function initProfiles(userId) {
  currentUserId = userId;
  const raw = localStorage.getItem('hogar_profiles_' + userId);
  profiles = raw ? JSON.parse(raw) : {};
  
  if (Object.keys(profiles).length === 0) {
    activeId = 'familia';
    profiles[activeId] = {
      id: 'familia', name: 'Familia', months: {}, 
      members: DEFAULT_MEMBERS.slice(), commerces: DEFAULT_COMMERCES.slice()
    };
  } else {
    activeId = localStorage.getItem('hogar_active_id_' + userId) || Object.keys(profiles)[0];
  }
  state = profiles[activeId];
  const keys = Object.keys(state.months);
  currentMonth = keys.length > 0 ? keys[keys.length - 1] : null;
}

// ════════════════════════════════════════════════════════════
//  5. INTERFAZ VISUAL (UI)
// ════════════════════════════════════════════════════════════

function renderAll() {
  renderNav();
  if (historialOpen) renderHistorial(); else renderMain();
}

function renderNav() {
  const nav = document.getElementById('month-nav');
  if (!nav) return;
  const keys = Object.keys(state.months);
  nav.innerHTML = keys.map(k => `<button class="month-tab${k === currentMonth ? ' active' : ''}" onclick="switchMonth('${k}')">${k}</button>`).join('');
}

function switchMonth(name) { currentMonth = name; historialOpen = false; renderAll(); }

function renderMain() {
  const main = document.getElementById('main-content');
  if (!main) return;
  if (!currentMonth) {
    main.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Agregá un mes para empezar</p><button class="btn-primary-lg" onclick="openAddMonthModal()">+ Agregar mes</button></div>`;
    return;
  }
  
  const month = state.months[currentMonth];
  const tInc = sum(month.income);
  const tExp = sum(month.expense);
  const bal = tInc - tExp;

  document.getElementById('header-month').textContent = currentMonth;

  main.innerHTML = `
    <div class="summary">
        <div class="summary-card income"><span class="label">Ingresos</span><span class="amount">$${tInc.toLocaleString('es-UY')}</span></div>
        <div class="summary-card expense"><span class="label">Egresos</span><span class="amount">$${tExp.toLocaleString('es-UY')}</span></div>
        <div class="summary-card balance"><span class="label">Balance</span><span class="amount" style="color:${bal < 0 ? '#ef4444' : '#10b981'}">$${bal.toLocaleString('es-UY')}</span></div>
    </div>
    <div class="section-card" id="section-income" style="margin-bottom:20px">
      <div class="section-header"><div class="section-title">💚 Ingresos</div><button class="btn-add-row" onclick="openAddRowModal('income')">+ Agregar</button></div>
      <div class="table-wrap">${renderTable('income', month.income)}</div>
    </div>
    <div class="section-card" id="section-expense">
      <div class="section-header"><div class="section-title">🔴 Egresos</div><button class="btn-add-row" onclick="openAddRowModal('expense')">+ Agregar</button></div>
      <div class="table-wrap">${renderTable('expense', month.expense)}</div>
    </div>`;
}

function renderTable(type, rows) {
  const isExp = type === 'expense';
  const tbody = rows.map((r, i) => `
    <tr>
      <td>${r.name}</td>
      <td><select class="table-select" onchange="updateWho('${type}',${i},this.value)">${renderMembersOptions(r.who)}</select></td>
      ${isExp ? `<td><input type="text" value="${r.commerce || ''}" onblur="updateCommerce(${i},this.value)" class="table-input" placeholder="Donde..."></td>` : ''}
      <td><input type="number" value="${r.value}" oninput="updateValue('${type}',${i},this.value)" class="amount-input"></td>
      <td><button class="btn-del" onclick="deleteRow('${type}',${i})">✕</button></td>
    </tr>`).join('');
  return `<table><thead><tr><th>Categoría</th><th>Quién</th>${isExp ? '<th>Comercio</th>' : ''}<th>Monto</th><th></th></tr></thead><tbody>${tbody}</tbody></table>`;
}

function renderMembersOptions(sel) {
  return `<option value="">-</option>` + state.members.map(m => `<option value="${m}" ${m===sel?'selected':''}>${m}</option>`).join('');
}

// ════════════════════════════════════════════════════════════
//  6. ACCIONES DE LOS BOTONES
// ════════════════════════════════════════════════════════════

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('btn-dark-mode').textContent = isDark ? '🌙' : '☀️';
}

function openMembersDrawer() {
  document.getElementById('members-overlay').classList.add('open');
  document.getElementById('members-drawer').classList.add('open');
  const list = document.getElementById('members-list');
  list.innerHTML = state.members.map((m, i) => `
    <li class="member-item">
        <span class="member-avatar">${m.charAt(0)}</span>
        <span class="member-name">${m}</span>
        <button class="btn-del" onclick="deleteMember(${i})">🗑️</button>
    </li>`).join('');
}

function closeMembersDrawer() {
  document.getElementById('members-overlay').classList.remove('open');
  document.getElementById('members-drawer').classList.remove('open');
}

function deleteMember(i) {
  state.members.splice(i, 1); saveState(); openMembersDrawer();
}

function openAddRowModal(type) {
  const n = prompt("Nombre de categoría:");
  if(n) { 
    state.months[currentMonth][type].push({name: n, value: '', who: '', commerce: '', group: ''}); 
    saveState(); renderMain(); 
  }
}

function openAddMonthModal() {
  const n = prompt("Nombre del mes (Ej: Abril 2026):");
  if(n) { 
    state.months[n] = { income: [], expense: [] };
    currentMonth = n; saveState(); renderAll(); 
  }
}

function exportCSV() {
  let csv = "\uFEFFTipo,Categoria,Quien,Monto\n";
  const month = state.months[currentMonth];
  month.income.forEach(r => csv += `Ingreso,${r.name},${r.who},${r.value}\n`);
  month.expense.forEach(r => csv += `Egreso,${r.name},${r.who},${r.value}\n`);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Gastos_${currentMonth}.csv`; a.click();
}

// ════════════════════════════════════════════════════════════
//  7. ACTUALIZACIÓN DE DATOS (MECANISMO)
// ════════════════════════════════════════════════════════════
function updateValue(t, i, v) { state.months[currentMonth][t][i].value = v; saveState(); updateSummaryOnly(); }
function updateWho(t, i, v) { state.months[currentMonth][t][i].who = v; saveState(); }
function updateCommerce(i, v) { state.months[currentMonth].expense[i].commerce = v; saveState(); }
function deleteRow(t, i) { if(confirm("¿Eliminar categoría?")) { state.months[currentMonth][t].splice(i, 1); saveState(); renderMain(); } }
function sum(arr) { return arr.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0); }
function updateSummaryOnly() {
    const month = state.months[currentMonth];
    const cards = document.querySelectorAll('.summary-card .amount');
    if(cards.length >= 2) {
        cards[0].textContent = '$' + sum(month.income).toLocaleString('es-UY');
        cards[1].textContent = '$' + sum(month.expense).toLocaleString('es-UY');
    }
}

// ════════════════════════════════════════════════════════════
//  8. EVENTOS DE INICIO
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
  // Tabs Login
  document.getElementById('tab-login-btn')?.addEventListener('click', () => {
    document.getElementById('login-form-wrap').hidden = false; document.getElementById('register-form-wrap').hidden = true;
    document.getElementById('tab-login-btn').classList.add('active'); document.getElementById('tab-register-btn').classList.remove('active');
  });
  document.getElementById('tab-register-btn')?.addEventListener('click', () => {
    document.getElementById('login-form-wrap').hidden = true; document.getElementById('register-form-wrap').hidden = false;
    document.getElementById('tab-login-btn').classList.remove('active'); document.getElementById('tab-register-btn').classList.add('active');
  });

  // Login
  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const res = await loginUser(document.getElementById('login-username').value, document.getElementById('login-password').value);
    if (res.ok) { initProfiles(res.userId); document.getElementById('login-screen').classList.add('hidden'); renderAll(); } else { alert(res.error); }
  });

  // Registro
  document.getElementById('btn-register')?.addEventListener('click', async () => {
    const res = await registerUser(document.getElementById('reg-username').value, "Familia", document.getElementById('reg-password').value);
    if (res.ok) { initProfiles(res.userId); document.getElementById('login-screen').classList.add('hidden'); renderAll(); } else { alert(res.error); }
  });

  // Botones de Header
  document.getElementById('btn-dark-mode')?.addEventListener('click', toggleDarkMode);
  document.getElementById('btn-members')?.addEventListener('click', openMembersDrawer);
  document.getElementById('btn-close-members')?.addEventListener('click', closeMembersDrawer);
  document.getElementById('btn-add-month')?.addEventListener('click', openAddMonthModal);
  document.getElementById('btn-export')?.addEventListener('click', exportCSV);
  document.getElementById('btn-add-member')?.addEventListener('click', () => {
    const inp = document.getElementById('new-member-input'); if(inp.value) { addMember(inp.value); inp.value = ''; }
  });
});

// EXPORTS PARA HTML
window.switchMonth = switchMonth;
window.openAddRowModal = openAddRowModal;
window.updateValue = updateValue;
window.deleteRow = deleteRow;
window.updateWho = updateWho;
window.deleteMember = deleteMember;