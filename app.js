'use strict';

// 1. CONFIGURACIÓN FIREBASE (Corregida con la 'D' y el motor v8)
var firebaseConfig = {
  apiKey: "AIzaSyDFCba95ny7I2HAA2KVm8IQgzgq-YkLJDo", 
  authDomain: "registro-gastos-8a864.firebaseapp.com",
  databaseURL: "https://registro-gastos-8a864-default-rtdb.firebaseio.com",
  projectId: "registro-gastos-8a864",
  storageBucket: "registro-gastos-8a864.firebasestorage.app",
  messagingSenderId: "893257009763",
  appId: "1:893257009763:web:56d9c9dbdb682a3417f576",
  measurementId: "G-P81R3MJQP7"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const fbAuth = firebase.auth();
const fbDatabase = firebase.database();

// 2. CONSTANTES Y PLANTILLAS
const DEFAULT_MEMBERS = ['Facu', 'Lu', 'Fran'];
const DEFAULT_COMMERCES = ['Supermercado', 'Almacén', 'Feria', 'Farmacia', 'Otros'];

// 3. VARIABLES DE ESTADO
let currentUserId = null;
let profiles = {};
let activeId = '';
let state = {};
let currentMonth = null;
let historialOpen = false;

// 4. FUNCIONES DE AUTENTICACIÓN (ARREGLADAS)
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
  try {
    const fakeEmail = username + "@gestor.hogar.app";
    const userCredential = await fbAuth.signInWithEmailAndPassword(fakeEmail, password);
    return { ok: true, userId: userCredential.user.uid };
  } catch (e) {
    return { ok: false, error: 'Usuario o contraseña incorrectos' };
  }
}

// 5. FUNCIONES DE PERSISTENCIA (SINCRONIZACIÓN CON TELEGRAM)
function saveState() {
  if (currentUserId) {
    localStorage.setItem('hogar_profiles_' + currentUserId, JSON.stringify(profiles));
    localStorage.setItem('hogar_active_id_' + currentUserId, activeId);
    
    // Sincronizar con Firebase para el Bot
    if (activeId && state) {
        fbDatabase.ref(`users/${currentUserId}/data`).set(state);
    }
  }
}

// 6. INICIALIZACIÓN DE LA APP
function initProfiles(userId) {
  currentUserId = userId;
  const raw = localStorage.getItem('hogar_profiles_' + userId);
  profiles = raw ? JSON.parse(raw) : {};
  
  if (Object.keys(profiles).length === 0) {
    activeId = 'familia';
    profiles[activeId] = {
      id: 'familia', name: 'Familia', months: {}, members: DEFAULT_MEMBERS.slice(), commerces: DEFAULT_COMMERCES.slice()
    };
  } else {
    activeId = localStorage.getItem('hogar_active_id_' + userId) || Object.keys(profiles)[0];
  }
  state = profiles[activeId];
  const keys = Object.keys(state.months);
  currentMonth = keys.length > 0 ? keys[keys.length - 1] : null;
}

// 7. FUNCIONES DE UI (TABLAS Y BOTONES)
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
  if (!main || !currentMonth) return;
  const month = state.months[currentMonth];
  const headerMonth = document.getElementById('header-month');
  if (headerMonth) headerMonth.textContent = currentMonth;

  main.innerHTML = `
    <div class="section-card">
      <div class="section-header"><div class="section-title">Egresos</div><button class="btn-add-row" onclick="openAddRowModal('expense')">+ Agregar</button></div>
      <div class="section-body"><div class="table-wrap">${renderTable('expense', month.expense)}</div></div>
    </div>`;
}

function renderTable(type, rows) {
    const total = rows.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);
    const tbody = rows.map((r, i) => `<tr><td>${r.name}</td><td><input type="number" value="${r.value}" oninput="updateValue('${type}',${i},this.value)" class="amount-input"></td></tr>`).join('');
    return `<table><thead><tr><th>Categoría</th><th>Monto</th></tr></thead><tbody>${tbody}<tr><td>Total</td><td>$${total}</td></tr></tbody></table>`;
}

function updateValue(type, index, val) {
    state.months[currentMonth][type][index].value = val;
    saveState();
}

function openAddRowModal(type) {
    const name = prompt("Nombre de la categoría:");
    if (name) {
        state.months[currentMonth][type].push({ name, value: '', who: '', commerce: '', group: '' });
        saveState();
        renderMain();
    }
}

function openAddMonthModal() {
    const name = prompt("Nombre del mes (Ej: Abril 2026):");
    if (name) {
        state.months[name] = { income: [], expense: [] };
        currentMonth = name;
        saveState();
        renderAll();
    }
}

// 8. EVENTOS DE INICIO
document.addEventListener('DOMContentLoaded', function () {
  // Manejo de pestañas Login/Registro
  document.getElementById('tab-login-btn')?.addEventListener('click', () => {
    document.getElementById('login-form-wrap').hidden = false;
    document.getElementById('register-form-wrap').hidden = true;
  });
  document.getElementById('tab-register-btn')?.addEventListener('click', () => {
    document.getElementById('login-form-wrap').hidden = true;
    document.getElementById('register-form-wrap').hidden = false;
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

// EXPORTS GLOBALES
window.switchMonth = switchMonth;
window.openAddRowModal = openAddRowModal;
window.updateValue = updateValue;