// Inicializar mapa centrado en Xalapa
const map = L.map("map").setView([19.5438, -96.9103], 13);

// Base map con Stadia Outdoors
var Stadia_Outdoors = L.tileLayer(
  "https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}",
  {
    minZoom: 0,
    maxZoom: 20,
    ext: "png",
  }
).addTo(map);

// Geolocalización usuario
let userMarker;
let userCircle;

const userIcon = L.divIcon({
  className: "user-location",
  html: '<div class="user-circle"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// --- FUNCIÓN PARA CALCULAR DISTANCIA ---
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (!userMarker) {
        userMarker = L.marker([lat, lon], { icon: userIcon })
          .addTo(map)
          .bindPopup("Tu ubicación en tiempo real")
          .openPopup();

        userCircle = L.circle([lat, lon], {
          radius: 200,
          color: "orange",
          fillColor: "rgba(255, 174, 0, 0.63)",
          fillOpacity: 0.4,
        }).addTo(map);

        map.setView([lat, lon], 15);
      } else {
        userMarker.setLatLng([lat, lon]);
        userCircle.setLatLng([lat, lon]);
      }

      // --- MODIFICACIÓN: LLAMAR A AMBAS FUNCIONES DE DETECCIÓN ---
      findNearbyStops(lat, lon, userCircle.getRadius());
      findNearbyRoutes(lat, lon, userCircle.getRadius());
    },
    (err) => console.error("Error al obtener ubicación:", err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Sidebar
const menuBtn = document.querySelector(".menu-btn");
const sidebar = document.getElementById("sidebar");
menuBtn.addEventListener("click", () => sidebar.classList.toggle("active"));

// === RUTAS Y PARADAS ===
const routesListEl = document.getElementById("routes-cards-container");
const routeInfoEl = document.getElementById("route-info");
const searchInput = document.querySelector(".search-box input");

const routesIndex = {};
const routeLayers = {};
let activeRoute = null;

// --- Cargar paradas ---
let allStops = [];
const nearbyStopsLayer = L.layerGroup().addTo(map); // Capa para las paradas cercanas

fetch("../data/all_stops.geojson")
  .then((r) => r.json())
  .then((fc) => {
    allStops = fc.features;
  });

// 1) Cargar e indexar Rutas
fetch("../data/all_routes.geojson")
  .then((r) => r.json())
  .then((fc) => {
    (fc.features || []).forEach((f) => {
      const props = f.properties || {};
      const id = props.id_ruta;
      if (!routesIndex[id]) routesIndex[id] = [];
      routesIndex[id].push(f);
    });
    renderSidebar(Object.keys(routesIndex).sort((a, b) => a - b));
  });

// --- FUNCIÓN PARA ENCONTRAR PARADAS CERCANAS ---
function findNearbyStops(userLat, userLon, radius) {
  nearbyStopsLayer.clearLayers(); // Limpia las paradas anteriores

  allStops.forEach((stop) => {
    const stopCoords = stop.geometry.coordinates;
    const distance = getDistance(
      userLat,
      userLon,
      stopCoords[1],
      stopCoords[0]
    );

    if (distance <= radius) {
      L.marker([stopCoords[1], stopCoords[0]])
        .addTo(nearbyStopsLayer)
        .bindPopup(`Parada: ${stop.properties.name || "Sin nombre"}`);
    }
  });
}

// --- FUNCIÓN PARA ENCONTRAR RUTAS CERCANAS ---
function findNearbyRoutes(userLat, userLon, radius) {
  const nearbyRoutesList = document.getElementById("nearby-routes-list");
  let nearbyRoutes = [];

  for (const routeId in routesIndex) {
    const routeFeatures = routesIndex[routeId];
    let isNearby = false;

    for (const feature of routeFeatures) {
      const coords = feature.geometry.coordinates;

      for (const point of coords) {
        const distance = getDistance(userLat, userLon, point[1], point[0]);
        if (distance <= radius) {
          nearbyRoutes.push(routeId);
          isNearby = true;
          break;
        }
      }
      if (isNearby) break;
    }
  }

  if (nearbyRoutes.length > 0) {
    nearbyRoutesList.innerHTML = "";
    [...new Set(nearbyRoutes)]
      .sort((a, b) => a - b)
      .forEach((id) => {
        const props = routesIndex[id][0].properties;
        const card = document.createElement("div");
        card.className = "route-card";
        card.dataset.id = id;
        card.innerHTML = `
                <div class="card-body">
                    <div class="card-title">${props.nombre}</div>
                    <div class="card-sub">🕒 ${props.horario}</div>
                </div>
            `;
        card.addEventListener("click", () => selectRoute(id, props, card));
        nearbyRoutesList.appendChild(card);
      });
  } else {
    nearbyRoutesList.innerHTML = "<p>No hay rutas cercanas a tu ubicación.</p>";
  }
}

// 2) Sidebar con tarjetas
function renderSidebar(ids) {
  routesListEl.innerHTML = "";
  ids.forEach((id) => {
    const props = routesIndex[id][0].properties;
    const card = document.createElement("div");
    card.className = "route-card";
    card.dataset.id = id;
    card.innerHTML = `
      <div class="card-body">
        <div class="card-title">${props.nombre}</div>
        <div class="card-sub">🕒 ${props.horario}</div>
        ${props.notas ? `<div class="card-notes">📝 ${props.notas}</div>` : ""}
      </div>
    `;
    card.addEventListener("click", () => selectRoute(id, props, card));
    routesListEl.appendChild(card);
  });
}

// 3) Selección desde sidebar - CON DESELECCIÓN
function selectRoute(id, props, cardEl) {
  if (activeRoute === id) {
    routeLayers[id].remove();
    activeRoute = null;
    if (cardEl) cardEl.classList.remove("active");
    routeInfoEl.innerHTML = "Selecciona una ruta…";
    return;
  }

  if (activeRoute && routeLayers[activeRoute]) {
    routeLayers[activeRoute].remove();
    document
      .querySelector(`.route-card[data-id="${activeRoute}"]`)
      ?.classList.remove("active");
  }

  if (!routeLayers[id]) {
    const group = L.geoJSON(
      { type: "FeatureCollection", features: routesIndex[id] },
      {
        style: { color: getColor(id), weight: 3, opacity: 0.9 },
      }
    );
    routeLayers[id] = group;
  }

  routeLayers[id].addTo(map);
  activeRoute = id;
  if (cardEl) cardEl.classList.add("active");
  map.fitBounds(routeLayers[id].getBounds(), { padding: [20, 20] });
  showRouteInfo(id, props);
}

// 4) Mostrar info completa
function showRouteInfo(id, props) {
  routeInfoEl.innerHTML = `
    <h2>${props.nombre}</h2>
    <p><strong>🕒 Horario:</strong> ${props.horario}</p>
    ${props.notas ? `<p><strong>📝 Notas:</strong> ${props.notas}</p>` : ""}
    ${
      props.img
        ? `<div><img src="${props.img}" alt="Ruta ${id}" style="max-width:100%; border-radius:10px"></div>`
        : ""
    }
  `;
}

// 5) Búsqueda
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();

    if (q === "") {
      sidebar.classList.remove("active");
    } else {
      sidebar.classList.add("active");
    }

    Array.from(routesListEl.children).forEach((card) => {
      card.style.display = card.textContent.toLowerCase().includes(q)
        ? ""
        : "none";
    });
  });
}

// colores
function getColor(id) {
  const palette = [
    "#2563eb",
    "#e74c3c",
    "#27ae60",
    "#8e44ad",
    "#f39c12",
    "#10b981",
    "#d946ef",
    "#ef4444",
    "#0ea5e9",
    "#f59e0b",
  ];
  return palette[id % palette.length];
}

// === BOTÓN APLICAR FILTROS ===
const filterBtn = document.getElementById("filter-btn");
const filterPanel = document.getElementById("filter-panel");

filterBtn.addEventListener("click", () => {
  filterPanel.classList.toggle("active");

  if (filterPanel.classList.contains("active")) {
    const routesList = document.getElementById("routes-list");
    routesList.scrollTop = 0;
  }
});

// === FILTRADO DE RUTAS ===
function filtrarRutas() {
  const origen = document
    .getElementById("origen-input")
    .value.trim()
    .toLowerCase();
  const destino = document
    .getElementById("destino-input")
    .value.trim()
    .toLowerCase();
  const rutasSeguras =
    document.getElementById("rutas-seguras")?.checked || false;
  const soloCercanas =
    document.getElementById("rutas-cercanas")?.checked || false;

  if (!origen && !destino && !rutasSeguras && !soloCercanas) {
    const resultEl = document.getElementById("filtered-routes");
    resultEl.innerHTML = `<p class="no-routes" style="color: #e74c3c; font-weight: bold;">⚠️ No has introducido ningún dato para filtrar</p>`;
    resultEl.style.display = "block";

    routesListEl.style.display = "none";
    routeInfoEl.style.display = "none";

    return [];
  }

  const resultados = Object.keys(routesIndex).filter((id) => {
    const props = routesIndex[id][0].properties;
    const desc = (props.desc || "").toLowerCase();

    if (origen && !desc.includes(origen)) return false;
    if (destino && !desc.includes(destino)) return false;
    if (rutasSeguras && !props.segura) return false;
    return true;
  });

  Object.keys(routeLayers).forEach((id) => map.removeLayer(routeLayers[id]));

  routesListEl.style.display = "none";
  routeInfoEl.style.display = "none";

  const resultEl = document.getElementById("filtered-routes");
  resultEl.innerHTML = "";
  resultEl.style.display = "block";

  if (resultados.length > 0) {
    resultEl.innerHTML = `<h3>Rutas encontradas:</h3>`;
    resultados.forEach((id) => {
      const props = routesIndex[id][0].properties;
      const div = document.createElement("div");
      div.className = "route-card";
      div.dataset.id = id;
      div.innerHTML = `
        <div class="card-body">
          <div class="card-title">${props.nombre}</div>
          <div class="card-sub">🕒 ${props.horario}</div>
          ${
            props.notas ? `<div class="card-notes">📝 ${props.notas}</div>` : ""
          }
        </div>
      `;

      div.addEventListener("click", () => {
        selectRoute(id, props, div);
      });

      resultEl.appendChild(div);
    });
  } else {
    resultEl.innerHTML = `<p class="no-routes">No se encontraron rutas con esos filtros 😢</p>`;
  }

  return resultados;
}

// Función para limpiar filtros y mostrar todas las rutas nuevamente
function limpiarFiltros() {
  document.getElementById("origen-input").value = "";
  document.getElementById("destino-input").value = "";
  document.getElementById("rutas-seguras").checked = false;
  document.getElementById("rutas-cercanas").checked = false;

  const resultEl = document.getElementById("filtered-routes");
  resultEl.innerHTML = "";
  resultEl.style.display = "none";

  routesListEl.style.display = "block";
  routeInfoEl.style.display = "block";

  Object.keys(routeLayers).forEach((id) => {
    map.removeLayer(routeLayers[id]);
  });

  if (activeRoute) {
    selectRoute(activeRoute, routesIndex[activeRoute][0].properties);
  }
}

document.querySelector(".btn-clear").addEventListener("click", limpiarFiltros);
document.querySelector(".btn-apply").addEventListener("click", filtrarRutas);

// === AUTOCOMPLETAR DESTINOS SEGÚN ORIGEN ===
function obtenerDestinosDesdeOrigen(origen) {
  origen = origen.trim().toLowerCase();
  if (!origen) return [];

  const destinos = new Set();

  Object.keys(routesIndex).forEach((id) => {
    const props = routesIndex[id][0].properties;
    const zonas = (props.desc || "").split("/").map((z) => z.trim());

    if (zonas.map((z) => z.toLowerCase()).includes(origen)) {
      zonas.forEach((z) => {
        if (z.toLowerCase() !== origen) destinos.add(z);
      });
    }
  });

  return Array.from(destinos);
}

document.getElementById("origen-input").addEventListener("change", () => {
  const origen = document.getElementById("origen-input").value;
  const posiblesDestinos = obtenerDestinosDesdeOrigen(origen);

  const dataList = document.getElementById("destinos-sugeridos");
  dataList.innerHTML = "";

  if (posiblesDestinos.length === 0) {
    const option = document.createElement("option");
    option.value = "No hay destinos disponibles";
    dataList.appendChild(option);
  } else {
    posiblesDestinos.forEach((dest) => {
      const option = document.createElement("option");
      option.value = dest;
      dataList.appendChild(option);
    });
  }
});
