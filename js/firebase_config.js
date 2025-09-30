import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
//import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6uTpMAcSRMytBYCan4SPBccyX7-2EbpA",
  authDomain: "el-rutero-6bd7e.firebaseapp.com",
  projectId: "el-rutero-6bd7e",
  storageBucket: "el-rutero-6bd7e.firebasestorage.app",
  messagingSenderId: "407996303971",
  appId: "1:407996303971:web:e0b90a318348fad94f8656",
  measurementId: "G-4SD7V2CVD5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
//const analytics = getAnalytics(app);
export const db = getFirestore(app);
