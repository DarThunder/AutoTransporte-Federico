import { auth, db } from "./firebase_config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const registroForm = document.getElementById("registro-form");

registroForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const nombre = registroForm.nombre.value;
  const apellido = registroForm.apellido.value;
  const email = registroForm.email.value;
  const password = registroForm.password.value;

  console.log("Nombre:", nombre);
  console.log("Apellido:", apellido);
  console.log("Email:", email);

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      return setDoc(doc(db, "Usuarios", user.uid), {
        nombre: nombre,
        apellido: apellido,
        email: email,
        rol: "user",
      });
    })
    .then(() => {
      alert("¡Registro exitoso!");
      window.location.href = "iniciarS.html";
    })
    .catch((error) => {
      console.error("Error en el registro:", error.message);
      alert("Error: " + error.message);
    });
});
