// ==========================================
// SISFAR V2
// CONFIGURAÇÃO DO FIREBASE
// ==========================================


// Importação do Firebase App
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";


// Importação do Firebase Authentication
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


// Importação do Firestore
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// ==========================================
// CONFIGURAÇÃO DO PROJETO SISFAR V2
// ==========================================

const firebaseConfig = {

  apiKey:
    "AIzaSyArFHNzeIiiWXhgsCqmJ8JAw9e0QAvZeX4",

  authDomain:
    "sisfar-v2.firebaseapp.com",

  projectId:
    "sisfar-v2",

  storageBucket:
    "sisfar-v2.firebasestorage.app",

  messagingSenderId:
    "165061409275",

  appId:
    "1:165061409275:web:6e213eb846b0bf732f335e"

};


// ==========================================
// INICIALIZAÇÃO DO FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);


// ==========================================
// AUTHENTICATION
// ==========================================

const auth = getAuth(app);


// ==========================================
// FIRESTORE
// ==========================================

const db = getFirestore(app);


// ==========================================
// EXPORTAÇÕES
// ==========================================
// Permite que o app.js utilize
// Authentication e Firestore.
// ==========================================

export {
  app,
  auth,
  db
};
