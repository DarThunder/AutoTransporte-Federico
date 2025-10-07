import { auth, db } from "./firebase_config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  GeoPoint,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const alertFormContainer = document.getElementById("alert-form-container");
  const loginPrompt = document.getElementById("login-prompt");
  const trafficAlertForm = document.getElementById("traffic-alert-form");
  const trafficAlertsContainer = document.getElementById("traffic-alerts");

  // 1. Revisar estado de autenticación
  onAuthStateChanged(auth, (user) => {
    if (user) {
      alertFormContainer.style.display = "block";
      loginPrompt.style.display = "none";
    } else {
      alertFormContainer.style.display = "none";
      loginPrompt.style.display = "block";
    }
  });

  // 2. Enviar una nueva alerta de tráfico con geolocalización
  trafficAlertForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      alert("Debes iniciar sesión para poder reportar un incidente.");
      return;
    }

    // Obtener la ubicación del usuario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const incidentType = document.getElementById("incident-type").value;
          const description = document.getElementById("description").value;

          try {
            await addDoc(collection(db, "traffic_alerts"), {
              incidentType,
              description,
              location: new GeoPoint(latitude, longitude),
              timestamp: new Date(),
              userEmail: user.email,
            });

            trafficAlertForm.reset();
            alert("¡Gracias por tu reporte! La alerta ha sido enviada.");
          } catch (error) {
            console.error("Error al enviar la alerta:", error);
            alert(
              "Hubo un error al enviar tu reporte. Por favor, inténtalo de nuevo."
            );
          }
        },
        (error) => {
          console.error("Error al obtener la ubicación:", error);
          alert(
            "No se pudo obtener tu ubicación. Asegúrate de tener activados los permisos de localización en tu navegador."
          );
        }
      );
    } else {
      alert("Tu navegador no soporta la geolocalización.");
    }
  });

  // 3. Cargar y mostrar alertas en tiempo real
  const alertsQuery = query(
    collection(db, "traffic_alerts"),
    orderBy("timestamp", "desc"),
    limit(50)
  );

  onSnapshot(alertsQuery, (snapshot) => {
    trafficAlertsContainer.innerHTML = "";
    if (snapshot.empty) {
      trafficAlertsContainer.innerHTML =
        "<p>No hay alertas de tráfico recientes.</p>";
      return;
    }

    snapshot.forEach((doc) => {
      const alert = doc.data();
      const alertCard = document.createElement("div");
      alertCard.className = "alert-card";

      const time = alert.timestamp.toDate().toLocaleString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      });

      // Formatear la ubicación para mostrarla
      const locationString = `Lat: ${alert.location.latitude.toFixed(
        5
      )}, Lon: ${alert.location.longitude.toFixed(5)}`;

      alertCard.innerHTML = `
        <div class="alert-header">
          <span class="alert-type">${alert.incidentType.toUpperCase()}</span>
          <span class="alert-time">${time}</span>
        </div>
        <div class="alert-body">
          <p>${alert.description}</p>
          <p class="alert-location">
            <i class="fas fa-map-marker-alt"></i>
            <strong>Ubicación:</strong> ${locationString}
          </p>
        </div>
      `;

      trafficAlertsContainer.appendChild(alertCard);
    });
  });
});
