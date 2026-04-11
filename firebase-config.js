const firebaseConfig = {
  apiKey: "AIzaSyDFCba95ny7I2HAA2KVm8IQgzgq-YkLJ0o",
  authDomain: "registro-gastos-8a864.firebaseapp.com",
  projectId: "registro-gastos-8a864",
  storageBucket: "registro-gastos-8a864.firebasestorage.app",
  messagingSenderId: "893257009763",
  appId: "1:893257009763:web:56d9c9dbdb682a3417f576"
};

firebase.initializeApp(firebaseConfig);
const db     = firebase.firestore();
const fbAuth = firebase.auth();

// Forzar persistencia local para que funcione en todos los navegadores
fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
