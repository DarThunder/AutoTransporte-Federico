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

// Ícono circular con animación (CSS + divIcon) - DEFINIDO FUERA del callback
const userIcon = L.divIcon({
  className: "user-location",
  html: '<div class="user-circle"></div>', // Asegúrate de incluir el HTML
  iconSize: [26, 26], // Tamaño ligeramente mayor para contener la animación
  iconAnchor: [13, 13] // centro del ícono
});

// Verificar soporte de geolocalización
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      console.log("Ubicación obtenida:", lat, lon);

      if (!userMarker) {
        userMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map)
          .bindPopup("Tu ubicación en tiempo real").openPopup();

        console.log("Marcador añadido al mapa.");
        
        // Centrar el mapa
        map.setView([lat, lon], 15);
      } else {
        userMarker.setLatLng([lat, lon]);
        console.log("Marcador actualizado:", lat, lon);
      }
    },
    (err) => {
      console.error("Error al obtener ubicación:", err.message);
      alert("No se pudo obtener tu ubicación. Asegúrate de habilitar los permisos de ubicación.");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000, // Aumenté el timeout
      maximumAge: 0
    }
  );
} else {
  console.warn("Tu navegador no soporta geolocalización.");
  alert("Tu navegador no soporta geolocalización.");
} 