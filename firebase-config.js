// CONFIGURACIÓN FINAL CORREGIDA - Proyecto: registro-gastos-8a864
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

// Inicialización estilo Hunter (v8 Compat)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Exportar a la ventana global para que app.js no falle
window.fbAuth = firebase.auth();
window.fbDatabase = firebase.database();

console.log("🚀 Firebase conectado con la clave:", firebaseConfig.apiKey.slice(-5));