// Inicializar mapa centrado en Xalapa
const map = L.map('map').setView([19.5438, -96.9103], 13);

// Base map con Stadia Outdoors
var Stadia_Outdoors = L.tileLayer('https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  ext: 'png'
}).addTo(map);

// Marcador en el centro de Xalapa (referencia inicial)
L.marker([19.5438, -96.9103]).addTo(map)
  .bindPopup("Centro de Xalapa")
  .openPopup();

// === Geolocalización en tiempo real del usuario ===
let userMarker;

// Ícono circular con animación (CSS + divIcon)
const userIcon = L.divIcon({
  className: "user-location",
  html: "", // fuerza a renderizar un div visible aunque esté vacío
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});


// Verificar soporte de geolocalización
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (!userMarker) {
        // Primer marcador
        userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map)
          .bindPopup("Tu ubicación en tiempo real").openPopup();

        // Centrar mapa en la ubicación del usuario
        map.setView([lat, lon], 15);
      } else {
        // Actualizar posición del marcador
        userMarker.setLatLng([lat, lon]);
      }
    },
    (err) => {
      console.error("Error al obtener ubicación: ", err.message);
    },
    {
      enableHighAccuracy: true, // GPS preciso
      timeout: 5000,
      maximumAge: 0
    }
  );
} else {
  alert("Tu navegador no soporta geolocalización.");
}
