const firebaseConfig = {
  apiKey: "AIzaSyDFCba95ny7I2HAA2KVm8IQgzgq-YkLJDo", 
  authDomain: "registro-gastos-8a864.firebaseapp.com",
  databaseURL: "https://registro-gastos-8a864-default-rtdb.firebaseio.com/",
  projectId: "registro-gastos-8a864",
  storageBucket: "registro-gastos-8a864.firebasestorage.app",
  messagingSenderId: "893257009763",
  appId: "1:893257009763:web:56d9c9dbdb682a3417f576",
  measurementId: "G-P81R3MJQP7"
};

// Inicialización automática
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
if (typeof firebase !== 'undefined' && firebase.auth) {
    window.fbAuth = firebase.auth();
}