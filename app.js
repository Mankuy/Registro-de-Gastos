// === CONFIGURACIÓN MAESTRA FIREBASE (INTEGRADA) ===
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

// Inicialización de los motores
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const fbAuth = firebase.auth();
const fbDatabase = firebase.database();
// =================================================

'use strict';

// ─── LÓGICA DE USUARIOS (FIJADA POR HUNTER) ──────

async function registerUser(username, displayName, password) {
  username = (username || '').trim().toLowerCase();
  if (!username || !password) return { ok: false, error: 'Completá los campos' };
  
  // Quitamos la validación molesta de caracteres especiales
  try {
    const fakeEmail = username + "@gestor.hogar.app";
    // Registro directo en Firebase
    const userCredential = await fbAuth.createUserWithEmailAndPassword(fakeEmail, password);
    const userId = userCredential.user.uid;

    // Guardamos en la base de datos para que el Bot sepa quién eres
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
    console.error("Error Login:", e);
    return { ok: false, error: 'Usuario o contraseña incorrectos' };
  }
}

// ─── LÓGICA DE SINCRONIZACIÓN (BOT DE TELEGRAM) ───

function syncWithFirebase() {
    if (currentUserId && activeId && profiles[activeId]) {
        const mesFormateado = currentMonth || "Sin Mes";
        const path = `users/${currentUserId}/data`;
        fbDatabase.ref(path).set(profiles[activeId])
            .then(() => console.log("☁️ Sincronizado con la nube"))
            .catch(err => console.error("❌ Error nube:", err));
    }
}

// Modificamos la función de guardado para que siempre suba los datos
const originalSaveState = typeof saveState !== 'undefined' ? saveState : function(){};
window.saveState = function() {
    // Guardar localmente (como antes)
    localStorage.setItem('hogar_profiles_' + currentUserId, JSON.stringify(profiles));
    // Guardar en la nube (para el Bot)
    syncWithFirebase();
};

// ... (El resto del código de la app que maneja los botones y tablas sigue aquí abajo) ...
// Nota: Claude Code te ayudará a completar las funciones visuales una vez que entres.