// Inicializar mapa centrado en Xalapa
const map = L.map('map').setView([19.5438, -96.9103], 13);

// Base map con estilo suave (Carto Light)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> colaboradores &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

// Marcador en el centro de Xalapa
L.marker([19.5438, -96.9103]).addTo(map)
  .bindPopup("Centro de Xalapa")
  .openPopup();
