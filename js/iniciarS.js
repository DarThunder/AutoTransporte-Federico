import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import { auth, db } from "./firebase_config.js";

const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = loginForm.email.value;
  const password = loginForm.password.value;
  console.log("email:", email);
  console.log("contraseña:", password);

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.log("Usuario inició sesión con UID:", user.uid);

      const userDocRef = doc(db, "Usuarios", user.uid);
      return getDoc(userDocRef);
    })
    .then((docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        console.log("Datos del usuario:", userData);
        alert(`¡Bienvenido de nuevo, ${userData.nombre}!`);

        if (userData.rol == "admin") {
          window.location.href = "Admin.html";
        } else {
          window.location.href = "index.html";
        }
      } else {
        console.log("No se encontraron datos para este usuario en Firestore.");
      }
    })
    .catch((error) => {
      console.error("Error al iniciar sesión:", error.message);
      alert("Error: " + error.message);
    });
});
