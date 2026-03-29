'use strict';


// === CONFIGURACIÓN MAESTRA Y ÚNICA ===
var firebaseConfig = {
  apiKey: "AIzaSyDFCba95ny7I2HAA2KVm8IQgzgq-YkLJ0o", 
  authDomain: "registro-gastos-8a864.firebaseapp.com",
  databaseURL: "https://registro-gastos-8a864-default-rtdb.firebaseio.com",
  projectId: "registro-gastos-8a864",
  storageBucket: "registro-gastos-8a864.firebasestorage.app",
  messagingSenderId: "893257009763",
  appId: "1:893257009763:web:56d9c9dbdb682a3417f576",
  measurementId: "G-P81R3MJQP7"
};

// Inicialización forzada
if (firebase.apps.length) {
    firebase.app().delete().then(() => firebase.initializeApp(firebaseConfig));
} else {
    firebase.initializeApp(firebaseConfig);
}
window.fbAuth = firebase.auth();
window.fbDatabase = firebase.database();
// =====================================

'use strict';
// ... el resto de tu código de app.js ...

// ════════════════════════════════════════════════════════════
//  2. CONSTANTES Y PLANTILLAS (URUGUAY)
// ════════════════════════════════════════════════════════════
const DEFAULT_MEMBERS = ['Facu', 'Lu', 'Fran'];
const DEFAULT_COMMERCES = ['Supermercado', 'Almacén', 'Feria', 'Farmacia', 'Otros'];

const TEMPLATE_UY_INCOME = ['Sueldo 1', 'Sueldo 2', 'Aguinaldo/Salario Vacacional', 'Otros Ingresos'];
const TEMPLATE_UY_EXPENSE = [
  'Alquiler/Cuota', 'Gastos Comunes', 'Tributos Domiciliarios (IM)',
  'UTE (Luz)', 'OSE (Agua)', 'Antel/Internet', 'Supergás/Calefacción',
  'Nafta', 'Seguro Auto', 'Patente', 'Mutualista/Fonasa', 'Supermercado', 
  'Feria/Verdulería', 'PedidosYa', 'Educación', 'Imprevistos'
];

const CHART_COLORS = ['#7c3aed', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#06b6d4'];

// ════════════════════════════════════════════════════════════
//  3. VARIABLES DE ESTADO
// ════════════════════════════════════════════════════════════
let currentUserId = null;
let profiles = {};
let activeId = '';
let state = {};
let currentMonth = null;
let historialOpen = false;

// ════════════════════════════════════════════════════════════
//  4. AUTENTICACIÓN (ARREGLADA PARA QUE NO DE ERROR)
// ════════════════════════════════════════════════════════════

async function registerUser(username, displayName, password) {
  username = (username || '').trim().toLowerCase();
  if (!username || !password) return { ok: false, error: 'Completá los campos' };
  
  try {
    const fakeEmail = username + "@gestor.hogar.app";
    const userCredential = await fbAuth.createUserWithEmailAndPassword(fakeEmail, password);
    const userId = userCredential.user.uid;

    await fbDatabase.ref(`users/${userId}/auth`).set({
      username: username,
      displayName: displayName || username,
      createdAt: Date.now()
    });

    return { ok: true, userId: userId };
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') return { ok: false, error: 'Ese usuario ya existe' };
    return { ok: false, error: e.message };
  }
}

async function loginUser(username, password) {
  username = (username || '').trim().toLowerCase();
  if (!username || !password) return { ok: false, error: 'Completá los campos' };
  try {
    const fakeEmail = username + "@gestor.hogar.app";
    const userCredential = await fbAuth.signInWithEmailAndPassword(fakeEmail, password);
    return { ok: true, userId: userCredential.user.uid };
  } catch (e) {
    return { ok: false, error: 'Usuario o contraseña incorrectos' };
  }
}

// ════════════════════════════════════════════════════════════
//  5. MOTOR DE LA APP (LÓGICA ORIGINAL RESTAURADA)
// ════════════════════════════════════════════════════════════

function saveState() {
  if (currentUserId && activeId) {
    localStorage.setItem('hogar_profiles_' + currentUserId, JSON.stringify(profiles));
    localStorage.setItem('hogar_active_id_' + currentUserId, activeId);
    // Sincronización con Firebase para el Bot de Telegram
    fbDatabase.ref(`users/${currentUserId}/data`).set(profiles[activeId]);
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
      members: DEFAULT_MEMBERS.slice(), commerces: DEFAULT_COMMERCES.slice(),
      _incomeDefaults: TEMPLATE_UY_INCOME, _expenseDefaults: TEMPLATE_UY_EXPENSE
    };
  } else {
    activeId = localStorage.getItem('hogar_active_id_' + userId) || Object.keys(profiles)[0];
  }
  state = profiles[activeId];
  const keys = Object.keys(state.months);
  currentMonth = keys.length > 0 ? keys[keys.length - 1] : null;
}

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

  main.innerHTML = `
    <div class="summary">
      <div class="summary-card income"><span class="label">Ingresos</span><span class="amount">$${tInc.toLocaleString()}</span></div>
      <div class="summary-card expense"><span class="label">Egresos</span><span class="amount">$${tExp.toLocaleString()}</span></div>
    </div>
    <div class="section-card">
      <div class="section-header"><div class="section-title">Ingresos</div><button class="btn-add-row" onclick="openAddRowModal('income')">+ Agregar</button></div>
      <div class="table-wrap">${renderTable('income', month.income)}</div>
    </div>
    <div class="section-card" style="margin-top:20px">
      <div class="section-header"><div class="section-title">Egresos</div><button class="btn-add-row" onclick="openAddRowModal('expense')">+ Agregar</button></div>
      <div class="table-wrap">${renderTable('expense', month.expense)}</div>
    </div>`;
}

function renderTable(type, rows) {
  const tbody = rows.map((r, i) => `
    <tr>
      <td>${r.name}</td>
      <td><select onchange="updateWho('${type}',${i},this.value)">${renderMembersOptions(r.who)}</select></td>
      <td><input type="number" value="${r.value}" oninput="updateValue('${type}',${i},this.value)" class="amount-input"></td>
      <td><button class="btn-del" onclick="deleteRow('${type}',${i})">✕</button></td>
    </tr>`).join('');
  return `<table><thead><tr><th>Categoría</th><th>Quién</th><th>Monto</th><th></th></tr></thead><tbody>${tbody}</tbody></table>`;
}

function renderMembersOptions(sel) {
  return `<option value="">-</option>` + state.members.map(m => `<option value="${m}" ${m===sel?'selected':''}>${m}</option>`).join('');
}

function updateValue(t, i, v) { state.months[currentMonth][t][i].value = v; saveState(); updateSummaryOnly(); }
function updateWho(t, i, v) { state.months[currentMonth][t][i].who = v; saveState(); }
function deleteRow(t, i) { state.months[currentMonth][t].splice(i, 1); saveState(); renderMain(); }

function openAddRowModal(type) {
  const n = prompt("Nombre de categoría:");
  if(n) { state.months[currentMonth][type].push({name: n, value: '', who: ''}); saveState(); renderMain(); }
}

function openAddMonthModal() {
  const n = prompt("Nombre del mes (ej: Abril 2026):");
  if(n) { 
    state.months[n] = { 
        income: state._incomeDefaults.map(x=>({name:x, value:'', who:''})), 
        expense: state._expenseDefaults.map(x=>({name:x, value:'', who:''})) 
    };
    currentMonth = n; saveState(); renderAll(); 
  }
}

function updateSummaryOnly() {
    const month = state.months[currentMonth];
    document.querySelectorAll('.summary-card.income .amount')[0].textContent = '$' + sum(month.income).toLocaleString();
    document.querySelectorAll('.summary-card.expense .amount')[0].textContent = '$' + sum(month.expense).toLocaleString();
}

function sum(arr) { return arr.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0); }

// ════════════════════════════════════════════════════════════
//  6. EVENTOS DE INICIO
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
  // Tabs Login/Registro
  document.getElementById('tab-login-btn')?.addEventListener('click', () => {
    document.getElementById('login-form-wrap').hidden = false;
    document.getElementById('register-form-wrap').hidden = true;
    document.getElementById('tab-login-btn').classList.add('active');
    document.getElementById('tab-register-btn').classList.remove('active');
  });
  document.getElementById('tab-register-btn')?.addEventListener('click', () => {
    document.getElementById('login-form-wrap').hidden = true;
    document.getElementById('register-form-wrap').hidden = false;
    document.getElementById('tab-login-btn').classList.remove('active');
    document.getElementById('tab-register-btn').classList.add('active');
  });

  // Botón Entrar
  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    const res = await loginUser(u, p);
    if (res.ok) {
        initProfiles(res.userId);
        document.getElementById('login-screen').classList.add('hidden');
        renderAll();
    } else { alert(res.error); }
  });

  // Botón Crear Cuenta
  document.getElementById('btn-register')?.addEventListener('click', async () => {
    const u = document.getElementById('reg-username').value;
    const p = document.getElementById('reg-password').value;
    const res = await registerUser(u, "Familia", p);
    if (res.ok) {
        initProfiles(res.userId);
        document.getElementById('login-screen').classList.add('hidden');
        renderAll();
    } else { alert(res.error); }
  });

  document.getElementById('btn-add-month')?.addEventListener('click', openAddMonthModal);
});

window.switchMonth = switchMonth;
window.openAddRowModal = openAddRowModal;
window.updateValue = updateValue;
window.deleteRow = deleteRow;
window.updateWho = updateWho;