const firebaseConfig = {
  apiKey: "AIzaSyDFCba95ny7I2HAA2KVm8IQqzqg-YkLJDo",
  authDomain: "registro-gastos-8a864.firebaseapp.com",
  projectId: "registro-gastos-8a864",
  storageBucket: "registro-gastos-8a864.firebasestorage.app",
  messagingSenderId: "893257009763",
  appId: "1:893257009763:web:56d9c9dbdb682a3417f576",
  databaseURL: "https://registro-gastos-8a864-default-rtdb.firebaseio.com/"
};

const FB_COLLECTIONS = {
  users: 'users',
  profiles: 'profiles'
};
const FB_DOCS = {
  userAuth: 'auth'
};

// --- EL PARCHE HUNTER PARA ARREGLAR EL ERROR fbAuth ---
// 1. Inicializamos Firebase 
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// 2. Forzamos la creación de fbAuth para que app.js no de error
if (typeof firebase !== 'undefined' && firebase.auth) {
  window.fbAuth = firebase.auth();
} else {
  console.warn("Falta el script de Firebase Auth en el HTML.");
}