// Firebase init (CDN) — expose window.fb
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp,
  collection, query, where
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {"apiKey": "AIzaSyCXUmcICx_NBCUl8Nkcb-hgPL7BqLnzFDg", "authDomain": "civilisa-sceaux.firebaseapp.com", "projectId": "civilisa-sceaux", "storageBucket": "civilisa-sceaux.firebasestorage.app", "messagingSenderId": "512345085139", "appId": "1:512345085139:web:8af51687e930d1b083b026"};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
await signInAnonymously(auth);

window.fb = { app, auth, db, doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where };
