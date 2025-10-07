import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { auth } from "./firebase_config.js";

const loginLink = document.getElementById("login-link");

const handleLogout = (e) => {
  e.preventDefault();

  signOut(auth)
    .then(() => {
      console.log("Sesión cerrada exitosamente.");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Error al cerrar sesión:", error.message);
    });
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (loginLink) {
      loginLink.textContent = "Cerrar Sesión";
      loginLink.href = "#";
      loginLink.removeEventListener("click", handleLogout);
      loginLink.addEventListener("click", handleLogout);
    }
  } else {
    if (loginLink) {
      loginLink.textContent = "Iniciar sesión";
      loginLink.href = "IniciarS.html";
      loginLink.removeEventListener("click", handleLogout);
    }
  }
});
