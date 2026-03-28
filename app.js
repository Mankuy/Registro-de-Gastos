// === CONFIGURACIÓN NUCLEAR FIREBASE (FIJA) ===
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

// Inicialización forzada
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
window.fbAuth = firebase.auth();
window.fbDatabase = firebase.database();
// =============================================

'use strict';
// ... aquí sigue el resto de tu código app.js ...
'use strict';

// ════════════════════════════════════════════════════════════
//  CONSTANTS & DEFAULTS
// ════════════════════════════════════════════════════════════

const DEFAULT_MEMBERS   = ['Facu', 'Lu', 'Fran'];
const DEFAULT_COMMERCES = ['Supermercado', 'Almacén', 'Feria', 'Farmacia', 'Otros'];

// Categorías del perfil "Familia" original (para migración)
const FAMILIA_INCOME_ROWS = [
  'Sueldo Servicio Facu', 'sueldo residencial', 'sueldo Casa de la Mujer',
  'Sueldo Plemuu', 'Pacientes'
];
const FAMILIA_EXPENSE_ROWS = [
  'Alquiler', 'UTE', 'Antel', 'Seguro auto', 'Patente', 'IM', 'OSE',
  'Celular Facu', 'Celular Lu', 'Psicóloga Lu', 'Flacso', 'Flores',
  'Fondo de Solidaridad Facu', 'Fondo de Solidaridad Lu', 'Nafta',
  'Casmu Fran', 'Casmu Lu', 'Casmu Facu', 'Club', 'Clotilda'
];

// Plantilla "🏡 Familia con hija/o (Uruguay)"
const TEMPLATE_UY_INCOME = [
  'Sueldo 1', 'Sueldo 2', 'Aguinaldo/Salario Vacacional', 'Otros Ingresos'
];
const TEMPLATE_UY_EXPENSE = [
  'Alquiler/Cuota', 'Gastos Comunes', 'Tributos Domiciliarios (IM)',
  'UTE (Luz)', 'OSE (Agua)', 'Antel/Internet', 'Supergás/Calefacción',
  'Nafta', 'Seguro Auto', 'Patente', 'Mecánico/Lavadero',
  'Mutualista/Fonasa', 'Tíckets/Medicamentos', 'Terapia',
  'Jardín', 'Pañales/Higiene', 'Ropa infantil', 'Pediatra', 'Juguetes/Paseos',
  'Supermercado', 'Feria/Verdulería', 'Carnicería', 'Delivery/PedidosYa',
  'Educación/Cursos', 'Fondo de Solidaridad', 'Suscripciones (Netflix, etc.)',
  'Tarjetas de Crédito', 'Imprevistos'
];

// Plantilla "💑 Pareja (Uruguay)"
const TEMPLATE_PAREJA_INCOME = [
  'Sueldo 1', 'Sueldo 2', 'Aguinaldo / Salario Vacacional', 'Otros Ingresos'
];
const TEMPLATE_PAREJA_EXPENSE = [
  'Alquiler / Cuota', 'Gastos Comunes', 'Tributos (IM)',
  'UTE (Luz)', 'OSE (Agua)', 'Antel / Internet', 'Gas / Calefacción',
  'Nafta', 'Seguro Auto', 'Patente',
  'Mutualista / FONASA', 'Tíckets / Medicamentos', 'Terapia',
  'Supermercado', 'Feria / Verdulería', 'Carnicería', 'Comida Afuera',
  'Ropa', 'Suscripciones', 'Fondo de Solidaridad', 'Ahorro', 'Imprevistos'
];

// Plantilla "👥 Amigos (Uruguay)"
const TEMPLATE_AMIGOS_INCOME = [
  'Juntes/Vaquitas', 'Mi aporte', 'Otros ingresos'
];
const TEMPLATE_AMIGOS_EXPENSE = [
  'Entrada a boliche/evento', 'Bar/Cantina', 'Almuerzo/Merienda afuera', 'Delivery/PedidosYa',
  'Omnibus/STM', 'Taxi/Uber/Cabify', 'Nafta (auto propio)',
  'Bebidas/Faso', 'Cigarros', 'Snacks/Kiosco',
  'Cine/Teatro', 'Streaming (Spotify, Netflix…)', 'Videojuegos/Steam',
  'Entradas recitales/festivales',
  'Ropa/Calzado', 'Corte de pelo/Estética',
  'Celular (plan/recarga)', 'Apps/Suscripciones',
  'Regalo', 'Imprevistos'
];

// Plantilla "🧍 Solo/a (Uruguay)"
const TEMPLATE_SOLO_INCOME = [
  'Sueldo', 'Changas/Freelance', 'Aguinaldo/Salario Vacacional', 'Otros ingresos'
];
const TEMPLATE_SOLO_EXPENSE = [
  'Alquiler', 'Gastos comunes', 'UTE (Luz)', 'OSE (Agua)', 'Antel/Internet', 'Supergás',
  'Supermercado', 'Feria/Verdulería', 'Delivery/PedidosYa', 'Almuerzo laboral',
  'Omnibus/STM', 'Taxi/Uber/Cabify', 'Nafta', 'Seguro/Patente moto',
  'Mutualista/Fonasa', 'Tíckets/Medicamentos', 'Terapia',
  'Salidas/Bares', 'Cine/Eventos', 'Streaming (Spotify, Netflix…)', 'Videojuegos',
  'Ropa/Calzado', 'Corte de pelo/Estética',
  'Celular (plan)', 'Apps/Suscripciones',
  'Educación/Cursos', 'Libros/Material',
  'Fondo de Solidaridad', 'Ahorro/Colchón', 'Tarjeta de crédito', 'Imprevistos'
];

const CHART_COLORS = [
  '#7c3aed', '#ef4444', '#10b981', '#f59e0b', '#3b82f6',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#84cc16'
];

// Grupos de subcategorías de egresos
const EXPENSE_GROUPS = {
  '':       { label: '',          emoji: '○',   title: 'Sin grupo — clic para asignar' },
  fijos:    { label: 'Fijos',     emoji: '🏠',  title: 'Gastos Fijos' },
  comida:   { label: 'Comida',    emoji: '🛒',  title: 'Compras / Comida' },
  afuera:   { label: 'Afuera',    emoji: '🍽️',  title: 'Comida Afuera' },
  animales: { label: 'Animales',  emoji: '🐾',  title: 'Animales' },
  ninos:    { label: 'Niñxs',     emoji: '👶',  title: 'Gastos en Niñxs' },
  salud:    { label: 'Salud',     emoji: '💊',  title: 'Salud' },
  vehiculo: { label: 'Vehículo',  emoji: '🚗',  title: 'Vehículo' },
  ocio:     { label: 'Ocio',      emoji: '🎭',  title: 'Ocio y Entretenimiento' },
  otros:    { label: 'Otros',     emoji: '📦',  title: 'Otros' }
};
const GROUP_ORDER = ['', 'fijos', 'comida', 'afuera', 'animales', 'ninos', 'salud', 'vehiculo', 'ocio', 'otros'];

function getEffectiveGroups() {
  const custom = (state && state.customGroups) ? state.customGroups : [];
  const result = Object.assign({}, EXPENSE_GROUPS);
  custom.forEach(g => { result[g.key] = { label: g.label, emoji: g.emoji, title: g.label }; });
  return result;
}
function getEffectiveGroupOrder() {
  const custom = (state && state.customGroups) ? state.customGroups : [];
  return GROUP_ORDER.concat(custom.map(g => g.key));
}

// ════════════════════════════════════════════════════════════
//  STORAGE KEYS
// ════════════════════════════════════════════════════════════

const KEY_DARK_MODE = 'hogar_dark_mode';
const KEY_LEGACY    = 'hogar_v2';

// FIX: dominio con TLD válido para Firebase Auth
const FB_EMAIL_DOMAIN = '@gestor.hogar.app';

function _profilesKey(uid) { return 'hogar_profiles_' + uid; }
function _activeIdKey(uid) { return 'hogar_active_id_' + uid; }

// ════════════════════════════════════════════════════════════
//  AUTH STATE
// ════════════════════════════════════════════════════════════

let currentUserId = null;
let _pendingWelcome = null;

// ════════════════════════════════════════════════════════════
//  PROFILE / STATE
// ════════════════════════════════════════════════════════════

let profiles    = {};
let activeId    = '';
let state       = {};
let currentMonth = null;

// ════════════════════════════════════════════════════════════
//  AUTH FUNCTIONS
// ════════════════════════════════════════════════════════════

function _fbError(code) {
  return ({
    'auth/email-already-in-use': 'Ese usuario ya existe — elegí otro',
    'auth/wrong-password':       'Contraseña incorrecta',
    'auth/user-not-found':       'Usuario no encontrado',
    'auth/invalid-credential':   'Usuario o contraseña incorrectos',
    'auth/invalid-email':        'Nombre de usuario inválido — usá solo letras, números y guiones',
    'auth/weak-password':        'La contraseña debe tener al menos 6 caracteres',
    'auth/too-many-requests':    'Demasiados intentos. Esperá unos minutos.',
    'auth/network-request-failed': 'Error de red. Verificá tu conexión.',
  })[code] || 'Error de autenticación';
}

async function registerUser(username, displayName, password) {
  username    = (username || '').trim().toLowerCase();
  displayName = (displayName || '').trim() || username;
  password    = password || '';

  if (!username)         return { ok: false, error: 'Ingresá un nombre de usuario' };
  
  // Validamos que el nombre de usuario sea simple (letras y números)
  const validUserRegex = /^[a-zA-Z0-9._]+$/;
  if (!validUserRegex.test(username)) {
    return { ok: false, error: 'El usuario solo puede tener letras, números, puntos o guión bajo' };
  }

  if (!password)         return { ok: false, error: 'Ingresá una contraseña' };
  if (password.length < 4) return { ok: false, error: 'Mínimo 4 caracteres' };

  try {
    // MAGIA: Le pegamos el dominio para que Firebase lo acepte como mail
    const fakeEmail = username + "@gestor.hogar.app";
    
    // Creamos el usuario en Firebase Auth
    const userCredential = await fbAuth.createUserWithEmailAndPassword(fakeEmail, password);
    const userId = userCredential.user.uid;

    // Guardamos su perfil en la base de datos (Realtime Database)
    await dbRef(`users/${userId}/auth`).set({
      username: username,
      displayName: displayName
    });

    return { ok: true, userId: userId };
  } catch (e) {
    console.error("Error en registro:", e);
    // Si el usuario ya existe en Firebase, damos un aviso claro
    if (e.code === 'auth/email-already-in-use') return { ok: false, error: 'Ese usuario ya existe' };
    return { ok: false, error: 'Error: ' + e.message };
  }
}
async function loginUser(username, password) {
  username = (username || '').trim().toLowerCase();
  if (!username || !password) return { ok: false, error: 'Completá todos los campos' };

  try {
    // MAGIA: También le pegamos el dominio aquí para entrar
    const fakeEmail = username + "@gestor.hogar.app";
    
    const userCredential = await fbAuth.signInWithEmailAndPassword(fakeEmail, password);
    return { ok: true, userId: userCredential.user.uid };
  } catch (e) {
    console.error("Error en login:", e);
    return { ok: false, error: 'Usuario o contraseña incorrectos' };
  }
}

function logoutUser() {
  fbAuth.signOut();
  currentUserId = null;
  profiles = {};
  activeId = '';
  state    = {};
  currentMonth = null;
  historialOpen = false;
  showLoginScreen();
}

// ════════════════════════════════════════════════════════════
//  LOGIN SCREEN UI
// ════════════════════════════════════════════════════════════

function showLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (screen) screen.classList.remove('hidden');
  const lastUser = localStorage.getItem('hogar_last_username') || '';
  if (lastUser) {
    switchLoginTab('login');
    const inp = document.getElementById('login-username');
    if (inp) inp.value = lastUser;
  } else {
    switchLoginTab('register');
  }
  ['login-error', 'register-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.hidden = true; el.textContent = ''; }
  });
}

function hideLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (screen) screen.classList.add('hidden');
}

function switchLoginTab(tab) {
  const loginWrap     = document.getElementById('login-form-wrap');
  const registerWrap  = document.getElementById('register-form-wrap');
  const loginTabBtn   = document.getElementById('tab-login-btn');
  const regTabBtn     = document.getElementById('tab-register-btn');

  const showLogin = (tab === 'login');
  if (loginWrap)    loginWrap.hidden    = !showLogin;
  if (registerWrap) registerWrap.hidden = showLogin;
  if (loginTabBtn)  loginTabBtn.classList.toggle('active', showLogin);
  if (regTabBtn)    regTabBtn.classList.toggle('active', !showLogin);
}

function initLoginScreen() {
  document.getElementById('tab-login-btn')?.addEventListener('click', () => switchLoginTab('login'));
  document.getElementById('tab-register-btn')?.addEventListener('click', () => switchLoginTab('register'));

  // ─── Login submit ─────────────────────────────────────────
  document.getElementById('btn-login')?.addEventListener('click', async function () {
    const username  = (document.getElementById('login-username')?.value || '').trim();
    const password  = document.getElementById('login-password')?.value || '';
    const errorEl   = document.getElementById('login-error');
    if (!username || !password) {
      if (errorEl) { errorEl.textContent = 'Completá usuario y contraseña'; errorEl.hidden = false; }
      return;
    }
    this.disabled    = true;
    this.textContent = 'Verificando…';
    const result = await loginUser(username, password);
    this.disabled    = false;
    this.textContent = 'Entrar';

    if (!result.ok) {
      if (errorEl) { errorEl.textContent = result.error; errorEl.hidden = false; }
    }
  });

  ['login-username', 'login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btn-login')?.click();
    });
  });

  // ─── Register submit ──────────────────────────────────────
  document.getElementById('btn-register')?.addEventListener('click', async function () {
    const displayName = (document.getElementById('reg-displayname')?.value || '').trim();
    const username    = (document.getElementById('reg-username')?.value || '').trim();
    const password    = document.getElementById('reg-password')?.value || '';
    const password2   = document.getElementById('reg-password2')?.value || '';
    const errorEl     = document.getElementById('register-error');

    if (!username || !password) {
      if (errorEl) { errorEl.textContent = 'Completá usuario y contraseña'; errorEl.hidden = false; }
      return;
    }
    if (password !== password2) {
      if (errorEl) { errorEl.textContent = 'Las contraseñas no coinciden'; errorEl.hidden = false; }
      return;
    }
    this.disabled    = true;
    this.textContent = 'Creando cuenta…';
    const result = await registerUser(username, displayName || username, password);
    this.disabled    = false;
    this.textContent = 'Crear cuenta';

    if (result.ok) {
      _pendingWelcome = result.displayName || displayName || username;
    } else {
      if (errorEl) { errorEl.textContent = result.error; errorEl.hidden = false; }
    }
  });

  ['reg-displayname', 'reg-username', 'reg-password', 'reg-password2'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btn-register')?.click();
    });
  });
}

// ════════════════════════════════════════════════════════════
//  MIGRATION
// ════════════════════════════════════════════════════════════

function runMigrationIfNeeded(userId) {
  if (localStorage.getItem(_profilesKey(userId))) return;

  const legacyProfiles = localStorage.getItem('hogar_profiles');
  if (legacyProfiles) {
    localStorage.setItem(_profilesKey(userId), legacyProfiles);
    const legacyActiveId = localStorage.getItem('hogar_active_id');
    if (legacyActiveId) localStorage.setItem(_activeIdKey(userId), legacyActiveId);
    console.info('[Gestor del Hogar] Perfiles globales migrados al usuario', userId);
    return;
  }

  const raw = localStorage.getItem(KEY_LEGACY);
  if (!raw) return;
  let old;
  try { old = JSON.parse(raw); } catch (e) { return; }

  const familiaProfile = {
    id:       'familia', name: 'Familia',
    months:   old.months    || {},
    members:  old.members   || DEFAULT_MEMBERS.slice(),
    commerces:old.commerces || DEFAULT_COMMERCES.slice(),
    apiKey:   old.apiKey    || '',
    currentMonth: old.currentMonth || null,
    collapsed: { income: false, expense: false, insights: false },
    _incomeDefaults:  FAMILIA_INCOME_ROWS,
    _expenseDefaults: FAMILIA_EXPENSE_ROWS
  };

  Object.values(familiaProfile.months).forEach(month => {
    if (month.expense) {
      month.expense.forEach(row => {
        if (row.paymentMethod === undefined) row.paymentMethod = '';
        if (row.group        === undefined) row.group         = '';
      });
    }
  });

  const migratedProfiles = { familia: familiaProfile };
  localStorage.setItem(_profilesKey(userId), JSON.stringify(migratedProfiles));
  localStorage.setItem(_activeIdKey(userId), 'familia');
  console.info('[Gestor del Hogar] Datos v2 migrados al usuario', userId);
}

// ════════════════════════════════════════════════════════════
//  PROFILE / STATE MANAGEMENT
// ════════════════════════════════════════════════════════════

function _buildDefaultProfile(id, name) {
  return {
    id, name,
    months:    {},
    members:   DEFAULT_MEMBERS.slice(),
    commerces: DEFAULT_COMMERCES.slice(),
    apiKey:    '',
    currentMonth: null,
    collapsed: { income: false, expense: false, insights: false },
    _incomeDefaults:  FAMILIA_INCOME_ROWS,
    _expenseDefaults: FAMILIA_EXPENSE_ROWS
  };
}

function loadProfiles() {
  try {
    const raw = localStorage.getItem(_profilesKey(currentUserId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function saveProfiles() {
  state.currentMonth = currentMonth;
  profiles[activeId] = state;
  try {
    localStorage.setItem(_profilesKey(currentUserId), JSON.stringify(profiles));
    localStorage.setItem(_activeIdKey(currentUserId), activeId);
  } catch(e) { showToast('Error al guardar: almacenamiento lleno'); }
  if (currentUserId) {
    db.collection('profiles').doc(currentUserId)
      .set({ data: JSON.stringify(profiles), activeId })
      .catch(() => {});
  }
}

function saveState() { saveProfiles(); }

function initProfiles(userId) {
  currentUserId = userId;
  runMigrationIfNeeded(userId);

  profiles = loadProfiles();

  if (!profiles || Object.keys(profiles).length === 0) {
    const p = _buildDefaultProfile('familia', 'Familia');
    profiles = { familia: p };
    activeId = 'familia';
  } else {
    activeId = localStorage.getItem(_activeIdKey(userId)) || Object.keys(profiles)[0];
    if (!profiles[activeId]) activeId = Object.keys(profiles)[0];
  }

  activateProfile(activeId, false);
}

function activateProfile(id, doSave = true) {
  if (!profiles[id]) return;
  activeId = id;
  state    = profiles[id];

  if (!state.members)   state.members   = DEFAULT_MEMBERS.slice();
  if (!state.commerces) state.commerces = DEFAULT_COMMERCES.slice();
  if (!state.apiKey)    state.apiKey    = '';
  if (!state.months)    state.months    = {};
  if (!state.collapsed) state.collapsed = { income: false, expense: false, insights: false };

  if (state.currentMonth && state.months[state.currentMonth]) {
    currentMonth = state.currentMonth;
  } else {
    const keys = Object.keys(state.months);
    currentMonth = keys.length > 0 ? keys[keys.length - 1] : null;
  }

  if (doSave) saveProfiles();
}

function switchProfile(id) {
  if (id === activeId) { closeProfileMenu(); return; }
  state.currentMonth = currentMonth;
  profiles[activeId] = state;
  activateProfile(id, true);
  historialOpen = false;
  renderAll();
  renderProfileSelector();
  closeProfileMenu();
  showToast('Perfil "' + state.name + '" activo');
}

function createProfile(name, templateType) {
  name = (name || '').trim();
  if (!name) return;
  const id = 'p_' + Date.now();

  const INCOME_MAP  = {
    familia: TEMPLATE_UY_INCOME, pareja: TEMPLATE_PAREJA_INCOME,
    amigos:  TEMPLATE_AMIGOS_INCOME, solo: TEMPLATE_SOLO_INCOME, blank: []
  };
  const EXPENSE_MAP = {
    familia: TEMPLATE_UY_EXPENSE, pareja: TEMPLATE_PAREJA_EXPENSE,
    amigos:  TEMPLATE_AMIGOS_EXPENSE, solo: TEMPLATE_SOLO_EXPENSE, blank: []
  };

  const p = {
    id, name,
    months:    {},
    members:   DEFAULT_MEMBERS.slice(),
    commerces: DEFAULT_COMMERCES.slice(),
    apiKey:    state.apiKey || '',
    currentMonth: null,
    collapsed: { income: false, expense: false, insights: false },
    _incomeDefaults:  INCOME_MAP[templateType]  || [],
    _expenseDefaults: EXPENSE_MAP[templateType] || []
  };

  state.currentMonth = currentMonth;
  profiles[activeId] = state;
  profiles[id] = p;
  activateProfile(id, true);
  historialOpen = false;
  renderAll();
  renderProfileSelector();
  showToast('Perfil "' + name + '" creado ✓');
}

function deleteActiveProfile() {
  const keys = Object.keys(profiles);
  if (keys.length <= 1) { showToast('No podés eliminar el único perfil'); return; }
  if (!confirm('¿Eliminar el perfil "' + state.name + '" y todos sus datos? Esta acción no se puede deshacer.')) return;
  delete profiles[activeId];
  const nextId = Object.keys(profiles)[0];
  activateProfile(nextId, true);
  historialOpen = false;
  renderAll();
  renderProfileSelector();
  showToast('Perfil eliminado');
}

function renameActiveProfile(newName) {
  newName = (newName || '').trim();
  if (!newName) return;
  state.name = newName;
  saveProfiles();
  renderProfileSelector();
  showToast('Perfil renombrado a "' + newName + '"');
}

// ════════════════════════════════════════════════════════════
//  PROFILE SELECTOR (DROPDOWN)
// ════════════════════════════════════════════════════════════

let _profileMenuOpen = false;

function renderProfileSelector() {
  const avatarEl = document.getElementById('profile-avatar');
  const nameEl   = document.getElementById('profile-display-name');
  const menuEl   = document.getElementById('profile-menu');
  if (!avatarEl || !nameEl || !menuEl) return;

  const name = state.name || 'Perfil';
  avatarEl.textContent = name.charAt(0).toUpperCase();
  nameEl.textContent   = name;

  const fbUser = fbAuth.currentUser;
  const userDisplay = fbUser ? (fbUser.displayName || fbUser.email.split('@')[0] || '') : '';

  const profileItems = Object.values(profiles).map(p => `
    <button class="profile-menu-item${p.id === activeId ? ' active' : ''}"
            onclick="switchProfile(${JSON.stringify(p.id)})">
      <span style="width:20px;height:20px;border-radius:50%;background:var(--primary-light);
            color:var(--primary);display:inline-flex;align-items:center;justify-content:center;
            font-size:0.68rem;font-weight:800;flex-shrink:0;">
        ${esc(p.name.charAt(0).toUpperCase())}
      </span>
      ${esc(p.name)}
      ${p.id === activeId ? '<span style="margin-left:auto;font-size:0.7rem;">✓</span>' : ''}
    </button>
  `).join('');

  menuEl.innerHTML = `
    ${userDisplay ? `<div style="padding:0.5rem 1rem 0.4rem;font-size:0.72rem;color:var(--text-soft);border-bottom:1px solid var(--border);">👤 ${esc(userDisplay)}</div>` : ''}
    ${profileItems}
    <div class="profile-menu-divider"></div>
    <button class="profile-menu-item add-item" onclick="openNewProfileModal()">＋ Nuevo perfil</button>
    <button class="profile-menu-item" onclick="openRenameProfileModal()" style="font-size:0.8rem;color:var(--text-soft);">✏️ Renombrar perfil actual</button>
    <button class="profile-menu-item del-item" onclick="deleteActiveProfile()">🗑️ Eliminar perfil actual</button>
    <div class="profile-menu-divider"></div>
    <button class="profile-menu-item" onclick="logoutUser()" style="font-size:0.8rem;color:var(--text-soft);">🚪 Cerrar sesión</button>
  `;
}

function toggleProfileMenu() {
  const menu = document.getElementById('profile-menu');
  const btn  = document.getElementById('btn-profile');
  if (!menu) return;
  _profileMenuOpen = !_profileMenuOpen;
  menu.hidden = !_profileMenuOpen;
  if (btn) btn.setAttribute('aria-expanded', String(_profileMenuOpen));
}

function closeProfileMenu() {
  const menu = document.getElementById('profile-menu');
  const btn  = document.getElementById('btn-profile');
  if (menu) menu.hidden = true;
  if (btn)  btn.setAttribute('aria-expanded', 'false');
  _profileMenuOpen = false;
}

function openNewProfileModal() {
  closeProfileMenu();
  openModal(
    '✨ Nuevo perfil',
    `<label class="field-label" for="modal-profile-name">Nombre del perfil</label>
     <input type="text" id="modal-profile-name" placeholder="Ej: Negocio, Personal…" />
     <p class="field-label" style="margin-top:0.75rem;margin-bottom:0.5rem;">¿Con qué plantilla empezar?</p>
     <div style="display:flex;flex-direction:column;gap:0.5rem;">
       <label style="display:flex;align-items:flex-start;gap:0.6rem;cursor:pointer;font-size:0.85rem;">
         <input type="radio" name="profile-template" value="blank" checked style="margin-top:3px;width:auto;margin-bottom:0;" />
         <span><strong>En blanco</strong> — sin categorías precargadas</span>
       </label>
       <label style="display:flex;align-items:flex-start;gap:0.6rem;cursor:pointer;font-size:0.85rem;">
         <input type="radio" name="profile-template" value="pareja" style="margin-top:3px;width:auto;margin-bottom:0;" />
         <span><strong>💑 Pareja (Uruguay)</strong> — hogar de dos, sin hijxs</span>
       </label>
       <label style="display:flex;align-items:flex-start;gap:0.6rem;cursor:pointer;font-size:0.85rem;">
         <input type="radio" name="profile-template" value="familia" style="margin-top:3px;width:auto;margin-bottom:0;" />
         <span><strong>🏡 Familia con hija/o (Uruguay)</strong> — hogar con auto e hijx</span>
       </label>
       <label style="display:flex;align-items:flex-start;gap:0.6rem;cursor:pointer;font-size:0.85rem;">
         <input type="radio" name="profile-template" value="amigos" style="margin-top:3px;width:auto;margin-bottom:0;" />
         <span><strong>👥 Amigos (Uruguay)</strong> — grupo de jóvenes, salidas y joda</span>
       </label>
       <label style="display:flex;align-items:flex-start;gap:0.6rem;cursor:pointer;font-size:0.85rem;">
         <input type="radio" name="profile-template" value="solo" style="margin-top:3px;width:auto;margin-bottom:0;" />
         <span><strong>🧍 Solo/a (Uruguay)</strong> — joven independiente</span>
       </label>
     </div>`,
    'Crear perfil',
    function () {
      const nameEl    = document.getElementById('modal-profile-name');
      const templateR = document.querySelector('input[name="profile-template"]:checked');
      const name = nameEl ? nameEl.value.trim() : '';
      const tmpl = templateR ? templateR.value : 'blank';
      if (!name) { showToast('Ingresá un nombre para el perfil'); return; }
      createProfile(name, tmpl);
      closeModal();
    }
  );
  setTimeout(() => { document.getElementById('modal-profile-name')?.focus(); }, 50);
}

function openRenameProfileModal() {
  closeProfileMenu();
  openModal(
    '✏️ Renombrar perfil',
    `<label class="field-label" for="modal-rename-profile">Nuevo nombre</label>
     <input type="text" id="modal-rename-profile" value="${esc(state.name)}" />`,
    'Renombrar',
    function () {
      const inp = document.getElementById('modal-rename-profile');
      if (inp && inp.value.trim()) { renameActiveProfile(inp.value.trim()); closeModal(); }
      else showToast('Ingresá un nombre válido');
    }
  );
  setTimeout(() => {
    const inp = document.getElementById('modal-rename-profile');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

// ════════════════════════════════════════════════════════════
//  DARK MODE
// ════════════════════════════════════════════════════════════

function initDarkMode() {
  const pref       = localStorage.getItem(KEY_DARK_MODE);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark      = pref !== null ? pref === 'true' : prefersDark;
  setDarkMode(isDark, false);
}

function setDarkMode(on, save = true) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  const btn = document.getElementById('btn-dark-mode');
  if (btn) btn.textContent = on ? '☀️' : '🌙';
  if (save) localStorage.setItem(KEY_DARK_MODE, String(on));
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setDarkMode(!isDark);
}

// ════════════════════════════════════════════════════════════
//  MONTH MANAGEMENT
// ════════════════════════════════════════════════════════════

function _getDefaultRows(type) {
  const key = type === 'income' ? '_incomeDefaults' : '_expenseDefaults';
  return (state[key] && state[key].length > 0) ? state[key] : (type === 'income' ? FAMILIA_INCOME_ROWS : FAMILIA_EXPENSE_ROWS);
}

function addMonth(name) {
  if (!name || !name.trim()) return;
  name = name.trim();
  if (state.months[name]) { showToast('Ya existe un mes con ese nombre'); return; }

  state.months[name] = {
    income:  _getDefaultRows('income').map(n  => ({ name: n, value: '', who: '' })),
    expense: _getDefaultRows('expense').map(n => ({ name: n, value: '', who: '', commerce: '', paymentMethod: '', group: '' }))
  };
  currentMonth = name;
  saveState();
  renderAll();
  showToast('Mes "' + name + '" agregado');
}

function switchMonth(name) {
  currentMonth  = name;
  historialOpen = false;
  saveState();
  renderAll();
}

function deleteCurrentMonth() {
  if (!currentMonth) return;
  if (!confirm('¿Eliminar el mes "' + currentMonth + '"? Esta acción no se puede deshacer.')) return;
  delete state.months[currentMonth];
  const keys = Object.keys(state.months);
  currentMonth = keys.length > 0 ? keys[keys.length - 1] : null;
  saveState();
  renderAll();
  showToast('Mes eliminado');
}

// ════════════════════════════════════════════════════════════
//  ROW MANAGEMENT
// ════════════════════════════════════════════════════════════

function addRow(type, name) {
  if (!currentMonth || !name || !name.trim()) return;
  name = name.trim();
  const row = type === 'expense'
    ? { name, value: '', who: '', commerce: '', paymentMethod: '', group: '' }
    : { name, value: '', who: '' };
  state.months[currentMonth][type].push(row);
  saveState();
  renderMain();
}

function deleteRow(type, index) {
  if (!currentMonth) return;
  const rows = state.months[currentMonth][type];
  const row  = rows[index];
  if (row && row.value && parseFloat(row.value) !== 0) {
    if (!confirm('¿Eliminar la categoría "' + row.name + '"?')) return;
  }
  rows.splice(index, 1);
  saveState();
  renderMain();
}

function updateValue(type, index, val) {
  if (!currentMonth) return;
  state.months[currentMonth][type][index].value = val;
  saveState();
  debouncedLiveUpdate();
}

function updateWho(type, index, val) {
  if (!currentMonth) return;
  state.months[currentMonth][type][index].who = val;
  saveState();
  debouncedLiveUpdate();
}

function updateCommerce(type, index, val) {
  if (!currentMonth) return;
  state.months[currentMonth][type][index].commerce = val;
  if (val && val.trim() && !state.commerces.includes(val.trim())) {
    state.commerces.push(val.trim());
    updateCommercesDatalist();
  }
  saveState();
  debouncedLiveUpdate();
}

function updatePaymentMethod(type, index, val) {
  if (!currentMonth) return;
  if (!state.months[currentMonth][type][index]) return;
  state.months[currentMonth][type][index].paymentMethod = val;
  saveState();
}

function renameCategory(type, index, newName) {
  if (!currentMonth || !newName || !newName.trim()) return;
  state.months[currentMonth][type][index].name = newName.trim();
  saveState();
  showToast('Categoría actualizada');
}

// ════════════════════════════════════════════════════════════
//  GROUP BADGES
// ════════════════════════════════════════════════════════════

function cycleGroup(type, index) {
  if (!currentMonth || !state.months[currentMonth]) return;
  const row = state.months[currentMonth][type][index];
  if (!row) return;
  const currentGroup = row.group || '';
  const order = getEffectiveGroupOrder();
  const groups = getEffectiveGroups();
  const nextIdx = (order.indexOf(currentGroup) + 1) % order.length;
  row.group = order[nextIdx];
  saveState();

  const badge = document.getElementById('group-badge-' + type + '-' + index);
  if (badge) {
    const g = groups[row.group] || EXPENSE_GROUPS[''];
    badge.textContent   = row.group ? g.emoji : '○';
    badge.title         = g.title;
    badge.style.opacity = row.group ? '1' : '0.35';
  }
  debouncedLiveUpdate();
}

function getGroupBadgeHTML(group, type, index) {
  const g = getEffectiveGroups()[group || ''] || EXPENSE_GROUPS[''];
  return `<button class="group-badge"
    id="group-badge-${type}-${index}"
    onclick="cycleGroup('${type}',${index})"
    title="${esc(g.title)}"
    style="opacity:${group ? '1' : '0.35'}">${group ? g.emoji : '○'}</button>`;
}

// ════════════════════════════════════════════════════════════
//  COLLAPSIBLE SECTIONS
// ════════════════════════════════════════════════════════════

function toggleSection(name) {
  if (!state.collapsed) state.collapsed = { income: false, expense: false, insights: false };
  state.collapsed[name] = !state.collapsed[name];
  saveState();

  const card = document.getElementById('section-' + name);
  const btn  = document.getElementById('btn-collapse-' + name);
  if (card) card.classList.toggle('collapsed', state.collapsed[name]);
  if (btn)  btn.textContent = state.collapsed[name] ? '▸' : '▾';
}

// ════════════════════════════════════════════════════════════
//  MEMBER MANAGEMENT
// ════════════════════════════════════════════════════════════

function renderMembersDrawer() {
  const ul = document.getElementById('members-list');
  if (!ul) return;
  if (state.members.length === 0) {
    ul.innerHTML = '<li style="color:var(--text-soft);font-size:0.85rem;padding:0.5rem 0;">No hay miembros registrados.</li>';
    return;
  }
  ul.innerHTML = state.members.map((m, i) => `
    <li class="member-item" data-index="${i}">
      <div class="member-avatar">${esc(m.charAt(0))}</div>
      <span class="member-name" id="member-name-${i}">${esc(m)}</span>
      <button class="btn-member-edit" data-action="edit-member" data-index="${i}" title="Renombrar">✏️</button>
      <button class="btn-member-del"  data-action="del-member"  data-name="${esc(m)}"  title="Eliminar">🗑️</button>
    </li>
  `).join('');
}

function _handleMemberListClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'del-member')  deleteMember(btn.dataset.name);
  else if (action === 'edit-member') startMemberEdit(parseInt(btn.dataset.index, 10));
}

function addMember(name) {
  if (!name || !name.trim()) return;
  name = name.trim();
  if (state.members.includes(name)) { showToast('Ya existe ese miembro'); return; }
  state.members.push(name);
  saveState();
  renderMembersDrawer();
  refreshAllWhoSelects();
  showToast('"' + name + '" agregado');
}

function deleteMember(name) {
  if (!confirm('¿Eliminar a "' + name + '"? Sus gastos quedarán sin asignar.')) return;
  Object.values(state.months).forEach(month => {
    ['income', 'expense'].forEach(type => {
      month[type].forEach(row => { if (row.who === name) row.who = ''; });
    });
  });
  state.members = state.members.filter(m => m !== name);
  saveState();
  renderMembersDrawer();
  renderMain();
  showToast('"' + name + '" eliminado');
}

function renameMember(oldName, newName) {
  if (!newName || !newName.trim()) return;
  newName = newName.trim();
  if (state.members.includes(newName) && newName !== oldName) { showToast('Ya existe ese nombre'); return; }
  Object.values(state.months).forEach(month => {
    ['income', 'expense'].forEach(type => {
      month[type].forEach(row => { if (row.who === oldName) row.who = newName; });
    });
  });
  const idx = state.members.indexOf(oldName);
  if (idx !== -1) state.members[idx] = newName;
  saveState();
  renderMembersDrawer();
  refreshAllWhoSelects();
  showToast('Miembro renombrado');
}

function startMemberEdit(index) {
  const span = document.getElementById('member-name-' + index);
  if (!span) return;
  const currentName = state.members[index];
  const input       = document.createElement('input');
  input.type        = 'text';
  input.value       = currentName;
  input.className   = 'inline-edit-input';
  input.style.width = '120px';
  input.onblur = function () {
    const newName = this.value.trim();
    if (newName && newName !== currentName) renameMember(currentName, newName);
    else renderMembersDrawer();
  };
  input.onkeydown = function (e) {
    if (e.key === 'Enter')  this.blur();
    if (e.key === 'Escape') { this.value = currentName; this.blur(); }
  };
  span.innerHTML = '';
  span.appendChild(input);
  input.focus();
  input.select();
}

function refreshAllWhoSelects() { renderMain(); }

// ════════════════════════════════════════════════════════════
//  COMMERCE MANAGEMENT
// ════════════════════════════════════════════════════════════

function updateCommercesDatalist() {
  const dl = document.getElementById('dl-commerces');
  if (!dl) return;
  dl.innerHTML = state.commerces.map(c => `<option value="${esc(c)}"></option>`).join('');
}

// ════════════════════════════════════════════════════════════
//  HISTORIAL VIEW
// ════════════════════════════════════════════════════════════

let historialOpen = false;

function toggleHistorial() {
  historialOpen = !historialOpen;
  if (historialOpen) renderHistorial();
  else renderMain();
}

function renderHistorial() {
  if (!currentMonth || !state.months[currentMonth]) {
    showToast('Seleccioná un mes primero');
    historialOpen = false;
    return;
  }

  const month   = state.months[currentMonth];
  const allRows = [];

  month.income.forEach(r => {
    const amt = parseFloat(r.value) || 0;
    if (amt > 0) allRows.push({ type: 'income', name: r.name, amount: amt, who: r.who || '', commerce: '', paymentMethod: '', group: '' });
  });
  month.expense.forEach(r => {
    const amt = parseFloat(r.value) || 0;
    if (amt > 0) allRows.push({ type: 'expense', name: r.name, amount: amt, who: r.who || '', commerce: r.commerce || '', paymentMethod: r.paymentMethod || '', group: r.group || '' });
  });

  allRows.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
    return a.name.localeCompare(b.name, 'es');
  });

  const main = document.getElementById('main-content');
  if (!main) return;

  destroyCharts();

  const headerMonth = document.getElementById('header-month');
  if (headerMonth) headerMonth.textContent = currentMonth + ' — Historial';

  const totalIncome  = allRows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = allRows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const rowsHTML = allRows.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-soft);">No hay movimientos con monto registrado este mes</td></tr>`
    : allRows.map(r => {
      const g = r.group ? (getEffectiveGroups()[r.group] || EXPENSE_GROUPS['']).emoji : '';
      return `
        <tr>
          <td><span class="badge ${r.type === 'income' ? 'badge-income' : 'badge-expense'}">${r.type === 'income' ? '💚 Ingreso' : '🔴 Egreso'}</span></td>
          <td style="font-weight:500">${g ? g + ' ' : ''}${esc(r.name)}</td>
          <td>${esc(r.who) || '<span style="color:var(--text-soft)">—</span>'}</td>
          <td>${esc(r.commerce) || '<span style="color:var(--text-soft)">—</span>'}</td>
          <td>${esc(r.paymentMethod) || '<span style="color:var(--text-soft)">—</span>'}</td>
          <td style="font-weight:700;color:${r.type === 'income' ? 'var(--income)' : 'var(--expense)'}">
            ${fmt(r.amount)}
          </td>
        </tr>
      `;
    }).join('');

  main.innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">📜 Historial — ${esc(currentMonth)}</div>
        <button class="btn-add-row" onclick="toggleHistorial()">← Volver al mes</button>
      </div>
      <div class="table-wrap">
        <table style="min-width:640px">
          <thead>
            <tr>
              <th>Tipo</th><th>Categoría</th><th>Quién</th>
              <th>Comercio</th><th>Medio de pago</th>
              <th style="text-align:right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
            <tr class="total-row">
              <td colspan="5" style="text-align:left">Total ingresos / egresos</td>
              <td style="text-align:right">
                <span style="color:var(--income)">${fmt(totalIncome)}</span>
                &nbsp;/&nbsp;
                <span style="color:var(--expense)">${fmt(totalExpense)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
//  MAIN RENDER PIPELINE
// ════════════════════════════════════════════════════════════

function renderAll() {
  renderNav();
  if (historialOpen) renderHistorial();
  else renderMain();
}

function renderNav() {
  const nav = document.getElementById('month-nav');
  if (!nav) return;
  const keys = Object.keys(state.months);
  if (keys.length === 0) { nav.innerHTML = ''; return; }
  nav.innerHTML = keys.map(k =>
    `<button class="month-tab${k === currentMonth ? ' active' : ''}" onclick="switchMonth(${JSON.stringify(k)})">${esc(k)}</button>`
  ).join('');
}

function renderMain() {
  const main = document.getElementById('main-content');
  if (!main) return;

  destroyCharts();

  if (!currentMonth || !state.months[currentMonth]) {
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>Agregá un mes para comenzar</p>
        <button class="btn-primary-lg" onclick="openAddMonthModal()">+ Agregar primer mes</button>
      </div>`;
    updateCommercesDatalist();
    return;
  }

  const month        = state.months[currentMonth];
  const totalIncome  = sum(month.income);
  const totalExpense = sum(month.expense);
  const balance      = totalIncome - totalExpense;

  const headerMonth = document.getElementById('header-month');
  if (headerMonth) headerMonth.textContent = currentMonth;

  const collapsed = state.collapsed || {};

  main.innerHTML = `
    ${renderSummaryHTML(totalIncome, totalExpense, balance)}

    <div class="section-card${collapsed.insights ? ' collapsed' : ''}" id="section-insights">
      <div class="section-header">
        <div class="section-title">📊 Análisis del mes</div>
        <button class="btn-collapse" id="btn-collapse-insights" onclick="toggleSection('insights')" title="Colapsar/expandir">
          ${collapsed.insights ? '▸' : '▾'}
        </button>
      </div>
      <div class="section-body" id="section-body-insights">
        <div class="insights-cards">
          <div class="insight-card">
            <div class="insight-label">Mayor gastador</div>
            <div class="insight-value" id="insight-spender">—</div>
            <div class="insight-sub"  id="insight-spender-sub"></div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Comercio top</div>
            <div class="insight-value" id="insight-commerce">—</div>
            <div class="insight-sub"  id="insight-commerce-sub"></div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Mayor categoría</div>
            <div class="insight-value" id="insight-category">—</div>
            <div class="insight-sub"  id="insight-category-sub"></div>
          </div>
          <div class="insight-card">
            <div class="insight-label">Tasa de ahorro</div>
            <div class="insight-value" id="insight-savings">—</div>
            <div class="insight-sub">del ingreso total</div>
          </div>
        </div>
        <div class="alerts-list" id="insights-alerts"></div>
        <div id="group-analysis-wrap" style="padding:0 1.25rem 0.25rem;"></div>
        <div class="charts-grid">
          <div class="chart-wrap">
            <h4>Egresos por categoría</h4>
            <div class="chart-container"><canvas id="chart-pie"></canvas></div>
          </div>
          <div class="chart-wrap">
            <h4>Egresos por miembro</h4>
            <div class="chart-container"><canvas id="chart-bar"></canvas></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section-card${collapsed.income ? ' collapsed' : ''}" id="section-income">
      <div class="section-header">
        <div class="section-title">
          <span>💚</span> Ingresos
          <span class="badge badge-income">${month.income.length} ítems</span>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <button class="btn-add-row" onclick="openAddRowModal('income')">+ Agregar</button>
          <button class="btn-collapse" id="btn-collapse-income" onclick="toggleSection('income')" title="Colapsar/expandir">
            ${collapsed.income ? '▸' : '▾'}
          </button>
        </div>
      </div>
      <div class="section-body" id="section-body-income">
        <div class="table-wrap">${renderTable('income', month.income)}</div>
      </div>
    </div>

    <div class="section-card${collapsed.expense ? ' collapsed' : ''}" id="section-expense">
      <div class="section-header">
        <div class="section-title">
          <span>🔴</span> Egresos
          <span class="badge badge-expense">${month.expense.length} ítems</span>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <button class="btn-add-row" onclick="openAddRowModal('expense')">+ Agregar</button>
          <button class="btn-add-row" onclick="openGroupsModal()" title="Gestionar grupos">🏷️ Grupos</button>
          <button class="btn-add-row" style="color:var(--expense);border-color:var(--expense-light);" onclick="deleteCurrentMonth()">🗑️ Mes</button>
          <button class="btn-collapse" id="btn-collapse-expense" onclick="toggleSection('expense')" title="Colapsar/expandir">
            ${collapsed.expense ? '▸' : '▾'}
          </button>
        </div>
      </div>
      <div class="section-body" id="section-body-expense">
        <div class="table-wrap">${renderTable('expense', month.expense)}</div>
      </div>
    </div>
  `;

  updateCommercesDatalist();
  setTimeout(renderCharts, 0);
  setTimeout(updateInsightCards, 0);
}

function renderSummaryHTML(totalIncome, totalExpense, balance) {
  return `
    <div class="summary">
      <div class="summary-card income">
        <span class="label">Ingresos</span>
        <span class="amount" id="sum-income">${fmt(totalIncome)}</span>
        <span class="sublabel">Total del mes</span>
      </div>
      <div class="summary-card expense">
        <span class="label">Egresos</span>
        <span class="amount" id="sum-expense">${fmt(totalExpense)}</span>
        <span class="sublabel">Total del mes</span>
      </div>
      <div class="summary-card balance">
        <span class="label">Balance</span>
        <span class="amount" id="sum-balance" style="color:${balance < 0 ? 'var(--expense)' : 'var(--primary-dark)'}">${fmt(balance)}</span>
        <span class="sublabel">${balance >= 0 ? 'Superávit' : 'Déficit'}</span>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
//  RENDER HELPERS
// ════════════════════════════════════════════════════════════

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderMembersOptions(selectedWho) {
  const opts = state.members.map(m =>
    `<option value="${esc(m)}"${m === selectedWho ? ' selected' : ''}>${esc(m)}</option>`
  ).join('');
  return `<option value=""${!selectedWho ? ' selected' : ''}>Sin asignar</option>${opts}`;
}

function renderTable(type, rows) {
  const isExpense  = type === 'expense';
  const tableClass = isExpense ? 'expense-table' : '';

  const thead = isExpense
    ? `<tr><th>Categoría</th><th>Quién</th><th>Comercio</th><th>Medio de pago</th><th>Monto ($)</th><th></th></tr>`
    : `<tr><th>Categoría</th><th>Quién</th><th>Monto ($)</th><th></th></tr>`;

  const tbodyRows = rows.map((row, i) => {
    const groupBadge = isExpense ? getGroupBadgeHTML(row.group || '', type, i) : '';

    const categoryCell = `
      <td>
        <div class="cat-cell">
          ${groupBadge}
          <span class="cat-name" ondblclick="startInlineEdit(this,'${type}',${i})">${esc(row.name)}</span>
          <button class="btn-edit-inline" onclick="startInlineEdit(this.closest('.cat-cell').querySelector('.cat-name'),'${type}',${i})" title="Renombrar">✏️</button>
        </div>
      </td>`;

    const whoCell = `
      <td>
        <select class="table-select" onchange="updateWho('${type}',${i},this.value)">
          ${renderMembersOptions(row.who)}
        </select>
      </td>`;

    const commerceCell = isExpense
      ? `<td>
           <input class="table-input" type="text" list="dl-commerces"
             value="${esc(row.commerce)}" placeholder="Comercio…" autocomplete="off"
             onblur="updateCommerce('expense',${i},this.value)"
             onkeydown="if(event.key==='Enter')this.blur()" />
         </td>` : '';

    const paymentCell = isExpense
      ? `<td>
           <input class="table-input" type="text" list="dl-payment-methods"
             value="${esc(row.paymentMethod || '')}" placeholder="Pago…" autocomplete="off"
             style="width:105px"
             onblur="updatePaymentMethod('expense',${i},this.value)"
             onkeydown="if(event.key==='Enter')this.blur()" />
         </td>` : '';

    const amountCell = `
      <td>
        <input class="amount-input" type="number" min="0" step="0.01"
          value="${esc(row.value)}"
          oninput="updateValue('${type}',${i},this.value)" />
      </td>`;

    const deleteCell = `
      <td>
        <button class="btn-del" onclick="deleteRow('${type}',${i})" title="Eliminar">✕</button>
      </td>`;

    return `<tr>${categoryCell}${whoCell}${commerceCell}${paymentCell}${amountCell}${deleteCell}</tr>`;
  }).join('');

  const total = rows.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);

  const totalRow = isExpense
    ? `<tr class="total-row"><td>Total</td><td></td><td></td><td></td><td class="total-expense">${fmt(total)}</td><td></td></tr>`
    : `<tr class="total-row"><td>Total</td><td></td><td class="total-income">${fmt(total)}</td><td></td></tr>`;

  return `<table class="${tableClass}"><thead>${thead}</thead><tbody>${tbodyRows}${totalRow}</tbody></table>`;
}

// ════════════════════════════════════════════════════════════
//  LIVE UPDATE
// ════════════════════════════════════════════════════════════

let _liveTimer = null;

function debouncedLiveUpdate() {
  clearTimeout(_liveTimer);
  _liveTimer = setTimeout(() => {
    updateSummaryCards();
    updateInsightCards();
    renderCharts();
  }, 300);
}

function updateSummaryCards() {
  if (!currentMonth || !state.months[currentMonth]) return;
  const month        = state.months[currentMonth];
  const totalIncome  = sum(month.income);
  const totalExpense = sum(month.expense);
  const balance      = totalIncome - totalExpense;

  const elIncome  = document.getElementById('sum-income');
  const elExpense = document.getElementById('sum-expense');
  const elBalance = document.getElementById('sum-balance');

  if (elIncome)  elIncome.textContent  = fmt(totalIncome);
  if (elExpense) elExpense.textContent = fmt(totalExpense);
  if (elBalance) {
    elBalance.textContent = fmt(balance);
    elBalance.style.color = balance < 0 ? 'var(--expense)' : 'var(--primary-dark)';
  }

  document.querySelectorAll('.total-row').forEach(tr => {
    const incomeCell  = tr.querySelector('.total-income');
    const expenseCell = tr.querySelector('.total-expense');
    if (incomeCell)  incomeCell.textContent  = fmt(totalIncome);
    if (expenseCell) expenseCell.textContent = fmt(totalExpense);
  });
}

function calcInsights() {
  if (!currentMonth || !state.months[currentMonth]) {
    return { topSpender: null, topCommerce: null, topCategory: null, savingsRate: NaN, alerts: [], groupTotals: {} };
  }
  const month        = state.months[currentMonth];
  const totalIncome  = sum(month.income);
  const totalExpense = sum(month.expense);

  const spenderMap = {};
  month.expense.forEach(row => {
    const val = parseFloat(row.value) || 0;
    if (val > 0) { const key = row.who || '__unassigned__'; spenderMap[key] = (spenderMap[key] || 0) + val; }
  });
  let topSpender = null, topSpenderAmt = 0;
  Object.entries(spenderMap).forEach(([name, amt]) => {
    if (amt > topSpenderAmt) { topSpenderAmt = amt; topSpender = name; }
  });
  if (topSpender === '__unassigned__') topSpender = 'Sin asignar';

  const commerceMap = {};
  month.expense.forEach(row => {
    const val = parseFloat(row.value) || 0;
    if (val > 0 && row.commerce && row.commerce.trim()) {
      commerceMap[row.commerce.trim()] = (commerceMap[row.commerce.trim()] || 0) + val;
    }
  });
  let topCommerce = null, topCommerceAmt = 0;
  Object.entries(commerceMap).forEach(([name, amt]) => {
    if (amt > topCommerceAmt) { topCommerceAmt = amt; topCommerce = name; }
  });

  let topCategory = null, topCategoryAmt = 0;
  month.expense.forEach(row => {
    const val = parseFloat(row.value) || 0;
    if (val > topCategoryAmt) { topCategoryAmt = val; topCategory = row.name; }
  });

  const savingsRate = totalIncome > 0
    ? ((totalIncome - totalExpense) / totalIncome) * 100
    : NaN;

  const alerts = [];
  if (totalExpense > 0) {
    month.expense.forEach(row => {
      const val = parseFloat(row.value) || 0;
      const pct = (val / totalExpense) * 100;
      if (pct > 40) alerts.push(`⚠️ "${row.name}" representa el ${Math.round(pct)}% de tus egresos`);
    });
  }
  if (totalExpense > totalIncome && totalIncome > 0)
    alerts.push('🔴 Los egresos superan los ingresos este mes');
  if (totalIncome === 0)
    alerts.push('ℹ️ No hay ingresos registrados aún');

  const groupTotals = {};
  month.expense.forEach(row => {
    const val = parseFloat(row.value) || 0;
    const g   = row.group || '';
    if (val > 0 && g) groupTotals[g] = (groupTotals[g] || 0) + val;
  });

  return {
    topSpender:  topSpender  ? { name: topSpender,  amount: topSpenderAmt }  : null,
    topCommerce: topCommerce ? { name: topCommerce, amount: topCommerceAmt } : null,
    topCategory: topCategory ? { name: topCategory, amount: topCategoryAmt } : null,
    savingsRate, alerts, groupTotals
  };
}

function updateInsightCards() {
  const ins = calcInsights();
  const el  = (id) => document.getElementById(id);

  if (el('insight-spender')) {
    el('insight-spender').textContent = ins.topSpender ? ins.topSpender.name : '—';
    if (el('insight-spender-sub')) el('insight-spender-sub').textContent = ins.topSpender ? fmt(ins.topSpender.amount) : '';
  }
  if (el('insight-commerce')) {
    el('insight-commerce').textContent = ins.topCommerce ? ins.topCommerce.name : '—';
    if (el('insight-commerce-sub')) el('insight-commerce-sub').textContent = ins.topCommerce ? fmt(ins.topCommerce.amount) : '';
  }
  if (el('insight-category')) {
    el('insight-category').textContent = ins.topCategory ? ins.topCategory.name : '—';
    if (el('insight-category-sub')) el('insight-category-sub').textContent = ins.topCategory ? fmt(ins.topCategory.amount) : '';
  }
  if (el('insight-savings')) {
    if (isNaN(ins.savingsRate)) {
      el('insight-savings').textContent = '—';
      el('insight-savings').style.color = '';
    } else {
      el('insight-savings').textContent = Math.round(ins.savingsRate) + '%';
      el('insight-savings').style.color = ins.savingsRate >= 0 ? 'var(--income)' : 'var(--expense)';
    }
  }
  if (el('insights-alerts'))
    el('insights-alerts').innerHTML = ins.alerts.map(a => `<div class="alert-item">${esc(a)}</div>`).join('');

  const groupWrap = el('group-analysis-wrap');
  if (groupWrap) {
    const sortedGroups = Object.entries(ins.groupTotals).sort((a, b) => b[1] - a[1]);
    if (sortedGroups.length > 0) {
      const maxVal = sortedGroups[0][1];
      groupWrap.innerHTML = `
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-soft);margin-bottom:0.55rem;">
          Egresos por subcategoría
        </div>
        ${sortedGroups.map(([g, val]) => {
          const info = getEffectiveGroups()[g] || EXPENSE_GROUPS[''];
          const pct  = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
          return `
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.38rem;">
              <span style="font-size:0.85rem;width:1.3rem;text-align:center;flex-shrink:0;">${info.emoji}</span>
              <span style="font-size:0.78rem;min-width:72px;color:var(--text);font-weight:500;">${esc(info.label)}</span>
              <div style="flex:1;height:7px;background:var(--border);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:4px;transition:width 0.35s;"></div>
              </div>
              <span style="font-size:0.78rem;font-weight:700;min-width:68px;text-align:right;color:var(--expense);">${fmt(val)}</span>
            </div>`;
        }).join('')}
      `;
    } else {
      groupWrap.innerHTML = '';
    }
  }
}

// ════════════════════════════════════════════════════════════
//  CHARTS
// ════════════════════════════════════════════════════════════

let chartPie = null;
let chartBar = null;

function destroyCharts() {
  if (chartPie) { chartPie.destroy(); chartPie = null; }
  if (chartBar) { chartBar.destroy(); chartBar = null; }
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;
  if (!currentMonth || !state.months[currentMonth]) return;

  const canvasPie = document.getElementById('chart-pie');
  const canvasBar = document.getElementById('chart-bar');
  if (!canvasPie || !canvasBar) return;

  destroyCharts();

  const month       = state.months[currentMonth];
  const expenseRows = month.expense.filter(r => parseFloat(r.value) > 0);
  const pieLabels   = expenseRows.map(r => r.name);
  const pieData     = expenseRows.map(r => parseFloat(r.value));
  const pieColors   = expenseRows.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  chartPie = new Chart(canvasPie, {
    type: 'doughnut',
    data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: (ctx) => ' ' + ctx.label + ': $' + ctx.parsed.toLocaleString('es-UY') } }
      }
    }
  });

  const memberMap = {};
  state.members.forEach(m => { memberMap[m] = 0; });
  let unassigned = 0;
  month.expense.forEach(row => {
    const val = parseFloat(row.value) || 0;
    if (val <= 0) return;
    if (row.who && memberMap.hasOwnProperty(row.who)) memberMap[row.who] += val;
    else unassigned += val;
  });

  const barLabels = [], barData = [];
  state.members.forEach(m => { if (memberMap[m] > 0) { barLabels.push(m); barData.push(memberMap[m]); } });
  if (unassigned > 0) { barLabels.push('Sin asignar'); barData.push(unassigned); }

  chartBar = new Chart(canvasBar, {
    type: 'bar',
    data: { labels: barLabels, datasets: [{ data: barData, backgroundColor: CHART_COLORS[0], borderRadius: 4 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ' $' + ctx.parsed.x.toLocaleString('es-UY') } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { callback: (val) => '$' + val.toLocaleString('es-UY'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
//  INLINE CATEGORY EDITING
// ════════════════════════════════════════════════════════════

let _editCancelled = false;

function startInlineEdit(el, type, index) {
  const catNameSpan = el.classList && el.classList.contains('cat-name')
    ? el
    : el.closest && el.closest('.cat-cell') && el.closest('.cat-cell').querySelector('.cat-name');
  if (!catNameSpan) return;

  const currentName = catNameSpan.textContent;
  const input       = document.createElement('input');
  input.type        = 'text';
  input.value       = currentName;
  input.className   = 'inline-edit-input';
  input.onblur    = function () { saveInlineEdit(this, type, index, currentName); };
  input.onkeydown = function (e) { handleInlineEditKey(e, this, type, index); };
  catNameSpan.textContent = '';
  catNameSpan.appendChild(input);
  input.focus();
  input.select();
}

function saveInlineEdit(inputEl, type, index, originalName) {
  if (_editCancelled) { _editCancelled = false; renderMain(); return; }
  const newName = inputEl.value.trim();
  if (newName && newName !== originalName) { renameCategory(type, index, newName); renderMain(); }
  else renderMain();
}

function handleInlineEditKey(e, input, type, index) {
  if (e.key === 'Enter')   { e.preventDefault(); input.blur(); }
  else if (e.key === 'Escape') { _editCancelled = true; renderMain(); }
}

// ════════════════════════════════════════════════════════════
//  OCR & TICKET SCANNER
// ════════════════════════════════════════════════════════════

let ocrImageBase64 = '';
let ocrImageType   = 'image/jpeg';

function extractAmount(text) {
  const patterns = [
    /[Tt]otal\s*\n\s*([\d.,]+)/g,
    /(?:total|importe\s*total|a\s*pagar|monto\s*total)[^\d$]*\$?\s*([\d.,]+)/gi,
    /\bTOTAL[^\n:]*[:=]?\s*\$?\s*([\d.,]+)/gi,
    /\$\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g
  ];
  for (const pattern of patterns) {
    const matches = [];
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) matches.push(m[1]);
    if (matches.length > 0) {
      let raw = matches[matches.length - 1];
      if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw))      raw = raw.replace(/\./g, '').replace(',', '.');
      else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw)) raw = raw.replace(/,/g, '');
      else                                                    raw = raw.replace(',', '.');
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) return String(val);
    }
  }
  return '';
}

function extractCommerce(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length >= 3);
  const candidates = lines.slice(0, 6).filter(l =>
    !/^\d+$/.test(l) &&
    !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(l) &&
    !/^(fecha|rut|cuit|tel[eé]fono|direcci[oó]n|nombre|moneda|contado|consumo|e-ticket)/i.test(l) &&
    !/^[A-Z]\s*\d{9,}/.test(l) &&
    l.length < 60
  );
  if (candidates.length === 0) return '';
  const upperLine = candidates.find(l => l === l.toUpperCase() && l.length > 4 && /[A-Z]/.test(l));
  return upperLine || candidates[0];
}

function extractDate(text) {
  const fechaMatch = text.match(/[Ff]echa\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (fechaMatch) {
    const parts = fechaMatch[1].split('/');
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  const dateMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return '';
}

function extractPaymentMethod(text) {
  if (/tarjeta\s*de?\s*cr[eé]dito/i.test(text))  return 'Tarjeta de crédito';
  if (/tarjeta\s*de?\s*d[eé]bito/i.test(text))   return 'Tarjeta de débito';
  if (/cr[eé]dito/i.test(text))     return 'Tarjeta de crédito';
  if (/d[eé]bito/i.test(text))      return 'Tarjeta de débito';
  if (/transferencia/i.test(text))  return 'Transferencia';
  if (/efectivo/i.test(text))       return 'Efectivo';
  if (/qr|mercado\s*pago/i.test(text.toLowerCase())) return 'QR / Digital';
  return '';
}

function extractTicketData(rawText) {
  return {
    amount: extractAmount(rawText), commerce: extractCommerce(rawText),
    date: extractDate(rawText), paymentMethod: extractPaymentMethod(rawText), rawText
  };
}

async function processWithClaudeAPI(imageBase64, mediaType) {
  if (!state.apiKey) return null;

  const currentCategories = currentMonth && state.months[currentMonth]
    ? state.months[currentMonth].expense.map(r => r.name).join(', ')
    : '';
  const categoryHint = currentCategories
    ? `\nCategorías disponibles: ${currentCategories}. Si corresponde, incluí "suggestedCategory" con el nombre exacto.`
    : '';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            {
              type: 'text',
              text: `Analizá este ticket/factura y extraé la información en JSON:
{"total":<número sin símbolo>,"commerce":"<nombre>","date":"<YYYY-MM-DD>","paymentMethod":"<método en español>","details":"<productos separados por coma>","suggestedCategory":null}
Si no podés determinar un campo, usá null. Respondé ÚNICAMENTE con JSON válido.${categoryHint}`
            }
          ]
        }]
      })
    });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error?.message || `HTTP ${response.status}`); }
    const data = await response.json();
    const text = data.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return JSON.parse(text);
  } catch (e) {
    console.warn('Claude API error:', e.message);
    return null;
  }
}

function populateOCRForm(extracted) {
  const el = (id) => document.getElementById(id);
  const amountVal = extracted.total || extracted.amount || null;
  if (el('ocr-amount-value')) el('ocr-amount-value').textContent = amountVal ? '$' + Number(amountVal).toLocaleString('es-UY') : '—';
  if (el('ocr-amount-input')) el('ocr-amount-input').value = amountVal || '';
  if (el('ocr-commerce'))     el('ocr-commerce').value     = extracted.commerce || '';
  if (el('ocr-date'))         el('ocr-date').value         = extracted.date || new Date().toISOString().slice(0, 10);
  if (el('ocr-payment-method')) el('ocr-payment-method').value = extracted.paymentMethod || '';
  if (el('ocr-raw-text'))    el('ocr-raw-text').value    = extracted.details || extracted.rawText || '';

  const catSel = el('ocr-category');
  if (catSel) {
    const suggested = extracted.suggestedCategory || null;
    if (suggested) {
      const option = Array.from(catSel.options).find(o => o.value.toLowerCase() === suggested.toLowerCase());
      catSel.value = option ? option.value : '';
    } else {
      catSel.value = '';
    }
  }
}

function openOCRModal() {
  if (!currentMonth) { showToast('Primero creá un mes para registrar gastos'); return; }
  const overlay = document.getElementById('ocr-overlay');
  if (overlay) overlay.classList.add('open');

  const aiBadge = document.getElementById('ocr-ai-badge');
  if (aiBadge) aiBadge.hidden = !state.apiKey;

  const preview     = document.getElementById('ocr-preview');
  const zoneContent = document.getElementById('ocr-zone-content');
  const progressW   = document.getElementById('ocr-progress-wrap');
  const resultW     = document.getElementById('ocr-result-wrap');
  const modalFoot   = document.getElementById('ocr-modal-foot');

  if (preview)     { preview.hidden = true; preview.src = ''; }
  if (zoneContent)  zoneContent.hidden = false;
  if (progressW)    progressW.hidden   = true;
  if (resultW)      resultW.hidden     = true;
  if (modalFoot)    modalFoot.hidden   = true;
  const camFile = document.getElementById('ocr-file-camera');
  const browFile = document.getElementById('ocr-file-browse');
  if (camFile)  camFile.value  = '';
  if (browFile) browFile.value = '';
  ocrImageBase64 = '';

  const catSel = document.getElementById('ocr-category');
  if (catSel && state.months[currentMonth]) {
    catSel.innerHTML =
      `<option value="" disabled selected>— Seleccioná una categoría —</option>` +
      state.months[currentMonth].expense.map(r => `<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('') +
      `<option value="__new__">Nueva categoría…</option>`;
  }

  const whoSel = document.getElementById('ocr-who');
  if (whoSel) whoSel.innerHTML = renderMembersOptions('');
}

function closeOCRModal() {
  const overlay = document.getElementById('ocr-overlay');
  if (overlay) overlay.classList.remove('open');
  ocrImageBase64 = '';
}

function _handleOCRFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const preview     = document.getElementById('ocr-preview');
  const zoneContent = document.getElementById('ocr-zone-content');
  const ocrZone     = document.getElementById('ocr-zone');
  const reader      = new FileReader();

  reader.onload = function (ev) {
    const dataUrl = ev.target.result;
    if (preview)     { preview.src = dataUrl; preview.hidden = false; }
    if (zoneContent)  zoneContent.hidden = true;
    if (ocrZone)      ocrZone.style.minHeight = 'auto';

    const parts    = dataUrl.split(',');
    ocrImageBase64 = parts.length > 1 ? parts[1] : '';
    ocrImageType   = file.type || 'image/jpeg';
    processOCR(file);
  };
  reader.readAsDataURL(file);
}

async function processOCR(file) {
  const progressW   = document.getElementById('ocr-progress-wrap');
  const progressBar = document.getElementById('ocr-progress-bar');
  const progressTxt = document.getElementById('ocr-progress-text');
  const resultW     = document.getElementById('ocr-result-wrap');
  const modalFoot   = document.getElementById('ocr-modal-foot');

  if (progressW)   progressW.hidden   = false;
  if (resultW)     resultW.hidden     = true;
  if (modalFoot)   modalFoot.hidden   = true;
  if (progressBar) progressBar.style.width = '0%';

  if (state.apiKey && ocrImageBase64) {
    if (progressTxt) progressTxt.textContent = '🤖 Procesando con IA (Claude)…';
    if (progressBar) progressBar.style.width = '50%';

    const claudeResult = await processWithClaudeAPI(ocrImageBase64, ocrImageType);
    if (claudeResult) {
      if (progressBar) progressBar.style.width = '100%';
      if (progressTxt) progressTxt.textContent = '✅ Análisis con IA completado';
      setTimeout(() => {
        if (progressW) progressW.hidden = true;
        if (resultW)   resultW.hidden   = false;
        if (modalFoot) modalFoot.hidden = false;
        populateOCRForm(claudeResult);
      }, 400);
      return;
    }
    if (progressTxt) progressTxt.textContent = 'IA no disponible, usando OCR local…';
  }

  if (typeof Tesseract === 'undefined') {
    if (progressW) progressW.hidden = true;
    showToast('Tesseract.js no disponible. Verificá tu conexión a internet.');
    return;
  }

  try {
    const worker = await Tesseract.createWorker('spa', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && progressBar && progressTxt) {
          const pct = Math.round((m.progress || 0) * 100);
          progressBar.style.width = pct + '%';
          progressTxt.textContent = 'Reconociendo texto… ' + pct + '%';
        } else if (progressTxt && m.status) {
          progressTxt.textContent = m.status + '…';
        }
      }
    });
    const result  = await worker.recognize(file);
    await worker.terminate();
    const rawText  = result.data.text || '';
    const extracted = extractTicketData(rawText);

    if (progressW) progressW.hidden = true;
    if (resultW)   resultW.hidden   = false;
    if (modalFoot) modalFoot.hidden = false;
    populateOCRForm(extracted);
  } catch (err) {
    console.error('OCR error:', err);
    if (progressW) progressW.hidden = true;
    showToast('Error al procesar la imagen: ' + (err.message || err));
  }
}

function _handleOCRAddExpense() {
  if (!currentMonth) { showToast('No hay mes activo'); return; }
  const catSel     = document.getElementById('ocr-category');
  const whoSel     = document.getElementById('ocr-who');
  const commerceEl = document.getElementById('ocr-commerce');
  const amountInp  = document.getElementById('ocr-amount-input');
  const paymentEl  = document.getElementById('ocr-payment-method');

  const catValue     = catSel     ? catSel.value            : '';
  const whoValue     = whoSel     ? whoSel.value            : '';
  const commValue    = commerceEl ? commerceEl.value.trim() : '';
  const amtValue     = amountInp  ? parseFloat(amountInp.value) : 0;
  const paymentValue = paymentEl  ? paymentEl.value.trim()  : '';

  if (!catValue) { showToast('Seleccioná una categoría'); return; }
  if (!amtValue || amtValue <= 0) { showToast('Ingresá un monto válido'); return; }

  let finalCatName = catValue;
  if (catValue === '__new__') {
    const newName = prompt('Nombre de la nueva categoría:');
    if (!newName || !newName.trim()) { showToast('Categoría cancelada'); return; }
    finalCatName = newName.trim();
  }

  const month    = state.months[currentMonth];
  const existing = month.expense.find(r => r.name === finalCatName);
  if (existing) {
    existing.value = String((parseFloat(existing.value) || 0) + amtValue);
    if (commValue)    existing.commerce      = commValue;
    if (whoValue)     existing.who           = whoValue;
    if (paymentValue) existing.paymentMethod = paymentValue;
  } else {
    month.expense.push({ name: finalCatName, value: String(amtValue), who: whoValue, commerce: commValue, paymentMethod: paymentValue, group: '' });
  }

  if (commValue && !state.commerces.includes(commValue)) state.commerces.push(commValue);
  saveState();
  renderMain();
  closeOCRModal();
  showToast('Gasto agregado: ' + finalCatName);
}

// ════════════════════════════════════════════════════════════
//  SETTINGS MODAL
// ════════════════════════════════════════════════════════════

function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) overlay.classList.add('open');
  const keyInput = document.getElementById('settings-api-key');
  if (keyInput) keyInput.value = state.apiKey || '';
  _updateSettingsStatus();
}

function closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (overlay) overlay.classList.remove('open');
}

function saveSettings() {
  const keyInput = document.getElementById('settings-api-key');
  const newKey   = keyInput ? keyInput.value.trim() : '';
  state.apiKey   = newKey;
  saveState();
  _updateSettingsStatus();
  showToast(newKey ? '✅ API Key guardada' : 'API Key eliminada');
  closeSettings();
}

function clearApiKey() {
  state.apiKey = '';
  saveState();
  const keyInput = document.getElementById('settings-api-key');
  if (keyInput) keyInput.value = '';
  _updateSettingsStatus();
  showToast('API Key eliminada');
}

function _updateSettingsStatus() {
  const statusEl = document.getElementById('settings-api-status');
  if (!statusEl) return;
  if (state.apiKey) {
    statusEl.className   = 'settings-status ok';
    statusEl.textContent = '✅ Claude API configurada — OCR con IA activo';
  } else {
    statusEl.className   = 'settings-status none';
    statusEl.textContent = 'Sin configurar — se usará Tesseract.js (OCR local)';
  }
}

// ════════════════════════════════════════════════════════════
//  MODAL SYSTEM
// ════════════════════════════════════════════════════════════

let _modalAction = null;

function openModal(title, bodyHTML, confirmText, action) {
  const overlay   = document.getElementById('modal-overlay');
  const titleEl   = document.getElementById('modal-title');
  const bodyEl    = document.getElementById('modal-body');
  const confirmEl = document.getElementById('modal-confirm');

  if (titleEl)   titleEl.textContent  = title;
  if (bodyEl)    bodyEl.innerHTML      = bodyHTML;
  if (confirmEl) confirmEl.textContent = confirmText || 'Confirmar';

  _modalAction = action;
  if (overlay) overlay.classList.add('open');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
  _modalAction = null;
  const confirmBtn = document.getElementById('modal-confirm');
  if (confirmBtn) confirmBtn.style.display = '';
  window._refreshGroupsModal = null;
}

function openGroupsModal() {
  if (!state) return;
  if (!state.customGroups) state.customGroups = [];

  function renderGroupsBody() {
    const custom = state.customGroups;
    const rows = custom.length === 0
      ? `<p style="color:var(--text-soft);font-size:0.85rem;">No hay grupos personalizados aún.</p>`
      : custom.map((g, i) => `
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
            <span style="font-size:1.2rem;width:1.6rem;text-align:center;">${esc(g.emoji)}</span>
            <span style="flex:1;font-size:0.9rem;">${esc(g.label)}</span>
            <button class="btn-cancel" style="padding:2px 8px;font-size:0.78rem;" onclick="deleteCustomGroup(${i})">✕</button>
          </div>`).join('');
    return `
      <div id="custom-groups-list" style="margin-bottom:1rem;">${rows}</div>
      <hr style="margin:0.75rem 0;border-color:var(--border);">
      <p style="font-size:0.82rem;color:var(--text-soft);margin-bottom:0.5rem;">Agregar grupo nuevo:</p>
      <div style="display:flex;gap:0.4rem;align-items:center;">
        <input id="new-group-emoji" type="text" maxlength="2" placeholder="🏷️" style="width:3rem;text-align:center;font-size:1.1rem;" />
        <input id="new-group-label" type="text" maxlength="20" placeholder="Nombre del grupo" style="flex:1;" />
        <button class="btn-confirm-sm" onclick="addCustomGroup()">Agregar</button>
      </div>
      <div id="new-group-error" style="color:var(--expense);font-size:0.8rem;margin-top:0.35rem;"></div>`;
  }

  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = '🏷️ Grupos de Egresos';
  document.getElementById('modal-body').innerHTML = renderGroupsBody();
  document.getElementById('modal-confirm').style.display = 'none';
  overlay.classList.add('open');

  window._refreshGroupsModal = function() {
    document.getElementById('modal-body').innerHTML = renderGroupsBody();
  };
}

window.addCustomGroup = function() {
  if (!state.customGroups) state.customGroups = [];
  const emoji = (document.getElementById('new-group-emoji')?.value || '').trim() || '🏷️';
  const label = (document.getElementById('new-group-label')?.value || '').trim();
  const errEl = document.getElementById('new-group-error');
  if (!label) { if (errEl) errEl.textContent = 'Ingresá un nombre.'; return; }
  const key = 'custom_' + label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
  state.customGroups.push({ key, label, emoji });
  saveState();
  if (window._refreshGroupsModal) window._refreshGroupsModal();
};

window.deleteCustomGroup = function(i) {
  if (!state.customGroups) return;
  state.customGroups.splice(i, 1);
  saveState();
  if (window._refreshGroupsModal) window._refreshGroupsModal();
};

function openAddMonthModal() {
  const now         = new Date();
  const monthNames  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const defaultName = monthNames[now.getMonth()] + ' ' + now.getFullYear();

  openModal(
    '+ Agregar mes',
    `<label class="field-label" for="modal-month-name">Nombre del mes</label>
     <input type="text" id="modal-month-name" placeholder="Ej: Enero 2025" value="${esc(defaultName)}" />`,
    'Agregar',
    function () {
      const input = document.getElementById('modal-month-name');
      if (input && input.value.trim()) { addMonth(input.value.trim()); closeModal(); }
      else showToast('Ingresá un nombre para el mes');
    }
  );
  setTimeout(() => {
    const input = document.getElementById('modal-month-name');
    if (input) { input.focus(); input.select(); }
  }, 50);
}

function openAddRowModal(type) {
  const typeLabel = type === 'income' ? 'ingreso' : 'egreso';
  openModal(
    '+ Agregar categoría de ' + typeLabel,
    `<label class="field-label" for="modal-row-name">Nombre de la categoría</label>
     <input type="text" id="modal-row-name" placeholder="Ej: Supermercado" />`,
    'Agregar',
    function () {
      const input = document.getElementById('modal-row-name');
      if (input && input.value.trim()) { addRow(type, input.value.trim()); closeModal(); }
      else showToast('Ingresá un nombre para la categoría');
    }
  );
  setTimeout(() => { document.getElementById('modal-row-name')?.focus(); }, 50);
}

// ════════════════════════════════════════════════════════════
//  DRAWER SYSTEM
// ════════════════════════════════════════════════════════════

function openMembersDrawer() {
  const overlay = document.getElementById('members-overlay');
  const drawer  = document.getElementById('members-drawer');
  if (overlay) overlay.classList.add('open');
  if (drawer)  drawer.classList.add('open');
  renderMembersDrawer();
}

function closeMembersDrawer() {
  const overlay = document.getElementById('members-overlay');
  const drawer  = document.getElementById('members-drawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer)  drawer.classList.remove('open');
}

// ════════════════════════════════════════════════════════════
//  EXPORT CSV
// ════════════════════════════════════════════════════════════

function exportCSV() {
  const monthKeys = Object.keys(state.months);
  if (monthKeys.length === 0) { showToast('No hay datos para exportar'); return; }

  const incomeCategories  = new Set();
  const expenseCategories = new Set();
  monthKeys.forEach(mk => {
    state.months[mk].income.forEach(r  => incomeCategories.add(r.name));
    state.months[mk].expense.forEach(r => expenseCategories.add(r.name));
  });

  const rows = [];
  rows.push(['Tipo', 'Categoría', 'Quién', 'Comercio', 'Medio de pago', ...monthKeys].join(','));

  incomeCategories.forEach(catName => {
    const row = ['Ingreso', csvCell(catName), '', '', ''];
    monthKeys.forEach(mk => {
      const found = state.months[mk].income.find(r => r.name === catName);
      row.push(found ? (parseFloat(found.value) || 0) : '');
    });
    rows.push(row.join(','));
  });

  expenseCategories.forEach(catName => {
    const row = ['Egreso', csvCell(catName), '', '', ''];
    monthKeys.forEach(mk => {
      const found = state.months[mk].expense.find(r => r.name === catName);
      row.push(found ? (parseFloat(found.value) || 0) : '');
    });
    rows.push(row.join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'gestor_hogar_' + state.name + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exportado');
}

function exportPDF() {
  if (!state || !state.months || Object.keys(state.months).length === 0) {
    showToast('No hay datos para exportar'); return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const profileName = state.name || 'Perfil';
  const today = new Date().toLocaleDateString('es-UY');
  const monthKeys = Object.keys(state.months).sort();

  doc.setFontSize(18);
  doc.setTextColor(124, 58, 237);
  doc.text('Gestor del Hogar — ' + profileName, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Exportado el ' + today, 14, 24);

  let y = 30;

  monthKeys.forEach(mk => {
    const monthData = state.months[mk];
    const totalIncome  = sum(monthData.income);
    const totalExpense = sum(monthData.expense);
    const balance      = totalIncome - totalExpense;

    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    if (y > 260) { doc.addPage(); y = 15; }
    doc.text(mk, 14, y);
    y += 2;

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const balTxt = 'Ingresos: $' + totalIncome.toLocaleString('es-UY') +
                   '   Egresos: $' + totalExpense.toLocaleString('es-UY') +
                   '   Balance: $' + balance.toLocaleString('es-UY');
    doc.text(balTxt, 14, y + 4);
    y += 8;

    if (monthData.income.length > 0) {
      const incRows = monthData.income
        .filter(r => parseFloat(r.value) > 0)
        .map(r => [r.name, r.who || '', '$' + (parseFloat(r.value)||0).toLocaleString('es-UY')]);
      if (incRows.length > 0) {
        doc.autoTable({
          startY: y,
          head: [['Ingreso', 'Quién', 'Monto']],
          body: incRows,
          theme: 'striped',
          headStyles: { fillColor: [16, 185, 129], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 2: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 4;
      }
    }

    if (monthData.expense.length > 0) {
      const expRows = monthData.expense
        .filter(r => parseFloat(r.value) > 0)
        .map(r => {
          const grp = getEffectiveGroups()[r.group] ? getEffectiveGroups()[r.group].label : '';
          return [r.name, grp, r.who || '', r.commerce || '', '$' + (parseFloat(r.value)||0).toLocaleString('es-UY')];
        });
      if (expRows.length > 0) {
        doc.autoTable({
          startY: y,
          head: [['Egreso', 'Grupo', 'Quién', 'Comercio', 'Monto']],
          body: expRows,
          theme: 'striped',
          headStyles: { fillColor: [239, 68, 68], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 4: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;
      }
    }
  });

  doc.save('gestor_hogar_' + profileName + '_' + new Date().toISOString().slice(0, 10) + '.pdf');
  showToast('PDF exportado');
}

function csvCell(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ════════════════════════════════════════════════════════════
//  TOAST & UTILITIES
// ════════════════════════════════════════════════════════════

let _toastTimer = null;

function showToast(msg, duration) {
  duration = duration || 2500;
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(_toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  _toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function fmt(n) {
  const num = parseFloat(n) || 0;
  if (num === 0) return '—';
  return '$' + num.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function sum(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((acc, r) => acc + (parseFloat(r.value) || 0), 0);
}

// ════════════════════════════════════════════════════════════
//  GLOBAL EXPORTS
// ════════════════════════════════════════════════════════════

window.switchMonth           = switchMonth;
window.openAddMonthModal     = openAddMonthModal;
window.openAddRowModal       = openAddRowModal;
window.deleteRow             = deleteRow;
window.updateValue           = updateValue;
window.updateWho             = updateWho;
window.updateCommerce        = updateCommerce;
window.updatePaymentMethod   = updatePaymentMethod;
window.startInlineEdit       = startInlineEdit;
window.closeModal            = closeModal;
window.deleteCurrentMonth    = deleteCurrentMonth;
window.toggleHistorial       = toggleHistorial;
window.startMemberEdit       = startMemberEdit;
window.switchProfile         = switchProfile;
window.openNewProfileModal   = openNewProfileModal;
window.openRenameProfileModal = openRenameProfileModal;
window.deleteActiveProfile   = deleteActiveProfile;
window.cycleGroup            = cycleGroup;
window.toggleSection         = toggleSection;
window.logoutUser            = logoutUser;
window.switchLoginTab        = switchLoginTab;
window.exportPDF             = exportPDF;
window.openGroupsModal       = openGroupsModal;

// ════════════════════════════════════════════════════════════
//  EVENT BINDINGS & INIT
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {

  initDarkMode();
  initLoginScreen();

  fbAuth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUserId = user.uid;
      try {
        const doc = await db.collection('profiles').doc(user.uid).get();
        if (doc.exists) {
          const d = doc.data();
          const parsed = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
          if (parsed && Object.keys(parsed).length > 0) {
            localStorage.setItem(_profilesKey(user.uid), JSON.stringify(parsed));
            if (d.activeId) localStorage.setItem(_activeIdKey(user.uid), d.activeId);
          }
        }
      } catch(e) {}
      initProfiles(user.uid);
      renderProfileSelector();
      renderAll();
      hideLoginScreen();
      if (_pendingWelcome) { showToast('¡Bienvenid@ ' + _pendingWelcome + '! 🎉'); _pendingWelcome = null; }
    } else {
      showLoginScreen();
    }
  });

  document.getElementById('btn-dark-mode')?.addEventListener('click', toggleDarkMode);

  document.getElementById('btn-profile')?.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleProfileMenu();
  });
  document.addEventListener('click', function (e) {
    if (!document.getElementById('profile-wrap')?.contains(e.target)) {
      closeProfileMenu();
    }
  });

  document.getElementById('btn-add-month')?.addEventListener('click', openAddMonthModal);
  document.getElementById('btn-members')?.addEventListener('click', openMembersDrawer);
  document.getElementById('btn-export')?.addEventListener('click', exportCSV);
  document.getElementById('btn-export-pdf')?.addEventListener('click', exportPDF);
  document.getElementById('btn-ticket')?.addEventListener('click', openOCRModal);
  document.getElementById('btn-historial')?.addEventListener('click', toggleHistorial);
  document.getElementById('btn-settings')?.addEventListener('click', openSettings);

  document.getElementById('btn-close-members')?.addEventListener('click', closeMembersDrawer);
  document.getElementById('members-overlay')?.addEventListener('click', closeMembersDrawer);
  document.getElementById('members-list')?.addEventListener('click', _handleMemberListClick);

  document.getElementById('btn-add-member')?.addEventListener('click', function () {
    const input = document.getElementById('new-member-input');
    if (input && input.value.trim()) { addMember(input.value.trim()); input.value = ''; }
  });
  document.getElementById('new-member-input')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (this.value.trim()) { addMember(this.value.trim()); this.value = ''; } }
  });

  document.getElementById('btn-close-ocr')?.addEventListener('click', closeOCRModal);
  document.getElementById('btn-ocr-cancel')?.addEventListener('click', closeOCRModal);
  document.getElementById('ocr-overlay')?.addEventListener('click', function (e) {
    if (e.target === this) closeOCRModal();
  });
  document.getElementById('btn-ocr-add-expense')?.addEventListener('click', _handleOCRAddExpense);

  document.getElementById('btn-ocr-camera')?.addEventListener('click', function (e) {
    e.stopPropagation();
    document.getElementById('ocr-file-camera')?.click();
  });
  document.getElementById('btn-ocr-browse')?.addEventListener('click', function (e) {
    e.stopPropagation();
    document.getElementById('ocr-file-browse')?.click();
  });
  document.getElementById('ocr-file-camera')?.addEventListener('change', function (e) {
    if (e.target.files[0]) _handleOCRFile(e.target.files[0]);
  });
  document.getElementById('ocr-file-browse')?.addEventListener('change', function (e) {
    if (e.target.files[0]) _handleOCRFile(e.target.files[0]);
  });

  const ocrZone = document.getElementById('ocr-zone');
  if (ocrZone) {
    ocrZone.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); this.classList.add('drag-over'); });
    ocrZone.addEventListener('dragleave', function (e) { e.stopPropagation(); this.classList.remove('drag-over'); });
    ocrZone.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation(); this.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) _handleOCRFile(file);
      else showToast('Por favor soltá una imagen (JPG, PNG, etc.)');
    });
    ocrZone.addEventListener('click', function (e) {
      if (e.target === this || e.target.id === 'ocr-preview') document.getElementById('ocr-file-browse')?.click();
    });
  }

  document.getElementById('btn-close-settings')?.addEventListener('click', closeSettings);
  document.getElementById('btn-settings-cancel')?.addEventListener('click', closeSettings);
  document.getElementById('btn-settings-save')?.addEventListener('click', saveSettings);
  document.getElementById('btn-settings-clear')?.addEventListener('click', clearApiKey);
  document.getElementById('settings-overlay')?.addEventListener('click', function (e) {
    if (e.target === this) closeSettings();
  });

  document.getElementById('modal-overlay')?.addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });
  document.getElementById('modal-confirm')?.addEventListener('click', function () {
    if (typeof _modalAction === 'function') _modalAction();
  });

});