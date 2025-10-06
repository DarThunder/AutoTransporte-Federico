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

// --- HACER PARADAS CLICKEABLES ---
function makeStopsClickable() {
    nearbyStopsLayer.eachLayer(layer => {
        // Hacer que el marcador sea clickeable
        layer.on('click', function(e) {
            if (!isSelectingStop) return;
            
            e.originalEvent.stopPropagation();
            
            // Encontrar la parada correspondiente
            const stopData = findStopByCoordinates(e.latlng.lat, e.latlng.lng);
            
            if (stopData) {
                // Obtener el nombre de la ruta activa
                const routeName = activeRoute ? routesIndex[activeRoute][0].properties.nombre : 'Ruta actual';
                selectStop(stopData, routeName);
            }
        });
    });
}

// --- HACER TODAS LAS PARADAS CLICKEABLES ---
function makeAllStopsClickable() {
    // Hacer clickeables las paradas CERCANAS (las que ya están en el mapa)
    nearbyStopsLayer.eachLayer(layer => {
        layer.off('click'); // Remover eventos anteriores
        layer.on('click', function(e) {
            if (!isSelectingStop) return;
            
            e.originalEvent.stopPropagation();
            const stopData = findStopByCoordinates(e.latlng.lat, e.latlng.lng);
            
            if (stopData) {
                const routeName = activeRoute ? routesIndex[activeRoute][0].properties.nombre : 'Ruta actual';
                selectStop(stopData, routeName);
            }
        });
    });
}

function findNearestStop(lat, lng) {
    let nearestStop = null;
    let minDistance = Infinity;
    
    allStops.forEach(stop => {
        const stopLat = stop.geometry.coordinates[1];
        const stopLng = stop.geometry.coordinates[0];
        const distance = getDistance(lat, lng, stopLat, stopLng);
        
        if (distance < minDistance && distance < 100) { // ✅ 100 metros de tolerancia
            minDistance = distance;
            nearestStop = stop;
        }
    });
    
    return nearestStop;
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
  // Si ya está activa, la desactivamos
  if (activeRoute === id) {
    routeLayers[id].remove();
    activeRoute = null;
    if (cardEl) {
      cardEl.classList.remove("active");
      // Eliminar el route-info asociado
      const existingInfo = cardEl.nextElementSibling;
      if (existingInfo && existingInfo.classList.contains('route-info')) {
        existingInfo.remove();
      }
    }
    return;
  }


  // Remover ruta activa anterior
  if (activeRoute && routeLayers[activeRoute]) {
    routeLayers[activeRoute].remove();

    // Buscar TODAS las tarjetas con ese id y limpiarlas
    document.querySelectorAll(`.route-card[data-id="${activeRoute}"]`).forEach(prevCard => {
      prevCard.classList.remove("active");
      // Eliminar el route-info anterior si existe
      const prevInfo = prevCard.nextElementSibling;
      if (prevInfo && prevInfo.classList.contains('route-info')) {
        prevInfo.remove();
      }
    })
  }

  // Crear o agregar la nueva ruta al mapa
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
  if (cardEl) {
    cardEl.classList.add("active");
    // Insertar el route-info justo después del cardEl
    showRouteInfoBelowCard(id, props, cardEl);
  }
  map.fitBounds(routeLayers[id].getBounds(), { padding: [20, 20] });
}

// 4) Mostrar info completa
function showRouteInfoBelowCard(id, props, cardEl) {
  const infoDiv = document.createElement('div');
  infoDiv.className = 'route-info';
  infoDiv.innerHTML = `
    <h2>${props.nombre}</h2>
    <p><strong>🕒 Horario:</strong> ${props.horario}</p>
    ${props.notas ? `<p><strong>📌 Notas:</strong> ${props.notas}</p>` : ""}
    ${props.img
      ? `<div><img src="${props.img}" alt="Ruta ${id}" style="max-width:100%; border-radius:10px"></div>`
      : ""
    }

     <!-- BOTÓN PARA MARCAR PARADA DESTINO -->
    <div style="margin-top: 15px; padding: 10px; background: #e9e7d9; border-radius: 8px;">
      <button id="mark-stop-btn-${id}" class="btn-apply" style="width: 100%; margin-bottom: 8px;">
        <i class="fas fa-bullseye"></i> Marcar Parada de Destino
      </button>
      
      <button id="cancel-selection-btn-${id}" class="btn-clear" style="width: 100%; display: none;">
        <i class="fas fa-times"></i> Cancelar Selección
      </button>
      
      <p style="font-size: 12px; margin: 5px 0 0 0; color: #666;">
        Haz clic en el botón y luego selecciona una parada en el mapa
      </p>
    </div>
  `;

  // Insertar el infoDiv justo después del cardEl
  cardEl.parentNode.insertBefore(infoDiv, cardEl.nextSibling);

  // Agregar evento al botón de marcar parada
  document.getElementById(`mark-stop-btn-${id}`).addEventListener('click', function() {
    startStopSelection(id, props);
  });

  // Agregar evento al botón de cancelar selección de la parada
  document.getElementById(`cancel-selection-btn-${id}`).addEventListener('click', function() {
    cancelStopSelection();
  });
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

  const resultados = Object.keys(routesIndex).filter(id => {
    const props = routesIndex[id][0].properties;
    
    // Buscar en TODOS los campos de texto disponibles
    const textoBusqueda = [
      props.desc || "",       // Descripción de la ruta
      props.nombre || "",     // Nombre completo
      props.name || "",       // Nombre alternativo
      props.notes || "",      // Notas
      props.notas || "",      // Notas en español
      props.origen || "",     // Origen específico
      props.destino || ""     // Destino específico
    ].join(" ").toLowerCase();

    // Verificar filtro de origen
    if (origen && !textoBusqueda.includes(origen)) return false;
    
    // Verificar filtro de destino
    if (destino && !textoBusqueda.includes(destino)) return false;
    
    // ===== INICIO DE LA MODIFICACIÓN =====
    // Verificar filtro de rutas "Mujer Segura"
    if (rutasSeguras && !props.mujerSegura) {
      return false; // Si el filtro está activo y la ruta no es segura, la descartamos.
    }
    // ===== FIN DE LA MODIFICACIÓN =====
    
    return true;
  });

  Object.keys(routeLayers).forEach((id) => map.removeLayer(routeLayers[id]));

  routesListEl.style.display = "none";
  routeInfoEl.style.display = "none";

  const resultEl = document.getElementById("filtered-routes");
  resultEl.innerHTML = "";
  resultEl.style.display = "block";

  if (resultados.length > 0) {
    resultEl.innerHTML = `<h3>Rutas encontradas: ${resultados.length}</h3>`;
    resultados.forEach(id => {
      const props = routesIndex[id][0].properties;
      const div = document.createElement("div");
      div.className = "route-card";
      div.dataset.id = id;
      div.innerHTML = `
        <div class="card-body">
          <div class="card-title">${props.nombre || props.name || 'Ruta ' + id}</div>
          <div class="card-sub">🕒 ${props.horario || 'Horario no disponible'}</div>
          ${props.notas || props.notes ? `<div class="card-notes">📝 ${props.notas || props.notes}</div>` : ""}
          ${props.desc ? `<div class="card-notes">📍 ${props.desc}</div>` : ""}
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

  Object.keys(routesIndex).forEach(id => {
    const props = routesIndex[id][0].properties;
    
    // Priorizar el campo 'desc' que contiene las paradas, si no existe usar 'nombre'
    const textoRuta = props.desc || props.nombre || props.name || "";
    
    if (!textoRuta) return;
    
    // Buscar separadores comunes en las descripciones de rutas
    const posiblesSeparadores = ["/", "|", "-", ",", ";", "→", "->"];
    let zonas = [textoRuta];
    
    // Intentar dividir usando diferentes separadores
    for (let separador of posiblesSeparadores) {
      if (textoRuta.includes(separador)) {
        zonas = textoRuta.split(separador).map(z => z.trim());
        break;
      }
    }
    
    // También considerar el campo 'origen' y 'destino' si existen
    if (props.origen) zonas.push(props.origen);
    if (props.destino) zonas.push(props.destino);
    
    // Si encontramos el origen, agregar las demás zonas como destinos
    const zonasMinusculas = zonas.map(z => z.toLowerCase());
    if (zonasMinusculas.includes(origen)) {
      zonas.forEach(z => {
        const zonaLimpia = z.trim();
        if (zonaLimpia && zonaLimpia.toLowerCase() !== origen) {
          destinos.add(zonaLimpia);
        }
      });
    }
  });

  return Array.from(destinos).filter(dest => dest.length > 0);
}

// Escuchar cuando el usuario cambia el origen 
document.getElementById("origen-input").addEventListener("input", (e) => {
  const origen = e.target.value.trim();

  const destinoSelect = document.getElementById("destino-input");
  destinoSelect.innerHTML = "";

  if (origen.length < 2) return;

  const posiblesDestinos = obtenerDestinosDesdeOrigen(origen);

  if (posiblesDestinos.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No hay destinos disponibles";
    option.disabled = true;
    destinoSelect.appendChild(option);
  } else {
    posiblesDestinos.slice(0, 40).forEach(dest => {
      const option = document.createElement("option");
      option.value = dest;
      option.textContent = dest;
      destinoSelect.appendChild(option);
    });
  }
});

// Menu desplegable Rutas Cercanas
var coll = document.getElementById("BotonDesplegableRutasCercanas");
coll.addEventListener("click", function(){
  this.classList.toggle("active");
  var content = document.getElementById("nearby-routes-list");
  var textoBoton = document.getElementById("TextoRutas");
  if (content.style.display === "block") {
    content.style.display = "none";
    textoBoton.textContent = "Rutas Cercanas ↓"
  } else {
    content.style.display = "block";
    textoBoton.textContent= "Rutas Cercanas ↑"
  }
})

// Sistema de destino para marcador 
let destinationMarker = null;
let selectedStop = null;
let isSelectingStop = false;

function startStopSelection(routeId, routeProps) {
    isSelectingStop = true;
    
    alert("🗺️ Selección de paradas activada\n\nSelecciona la parada de tu destino, cuando este cerca recibirás una alerta");
    
    // Hacer que todas las paradas existentes sean clickeables
    makeAllStopsClickable();
    
    // También permitir clic en cualquier parte del mapa para buscar paradas cercanas
    map.once('click', function(e) {
        if (!isSelectingStop) return;
        
        // Buscar la parada más cercana al clic (con mayor tolerancia)
        const nearestStop = findNearestStop(e.latlng.lat, e.latlng.lng);
        
        if (nearestStop) {
            selectStop(nearestStop, routeProps.nombre);
        } else {
            alert("No se encontró una parada cerca de este punto. Intenta hacer clic directamente sobre un marcador de parada.");
            resetStopSelection();
        }
    });

    // Mostrar botón de cancelar y ocultar botón normal
    document.querySelectorAll('[id^="cancel-selection-btn-"]').forEach(btn => {
        btn.style.display = 'block';
    });
    document.querySelectorAll('[id^="mark-stop-btn-"]').forEach(btn => {
        btn.style.display = 'none';
    });
}

function findStopByCoordinates(lat, lng) {
    return allStops.find(stop => {
        const stopLat = stop.geometry.coordinates[1];
        const stopLng = stop.geometry.coordinates[0];
        const distance = getDistance(lat, lng, stopLat, stopLng);
        return distance < 30; // 30 metros de tolerancia (más preciso)
    });
}

function selectStop(stop, routeName) {
    selectedStop = stop;
    const stopName = stop.properties.name || 'Parada sin nombre';
    
    // Preguntar confirmación
    const confirmar = confirm(`¿Quieres marcar esta parada como destino?\n\n📍 ${stopName}\n🚌 Ruta: ${routeName}\n\nLa aplicación te alertará cuando estés cerca.`);
    
    if (confirmar) {
        setupDestination(stop, routeName);
    }
    
    isSelectingStop = false;
    resetStopSelection();
}

function setupDestination(stop, routeName) {
    const stopName = stop.properties.name || 'Parada sin nombre';
    const coords = stop.geometry.coordinates;
    
    // Remover marcador anterior si existe
    if (destinationMarker) {
        map.removeLayer(destinationMarker);
    }
    
    // Crear marcador de destino
    destinationMarker = L.marker([coords[1], coords[0]], {
        icon: L.divIcon({
            className: 'destination-marker',
            html: '<div style="width:24px;height:24px;background:#ff4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.3);"></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).addTo(map)
    .bindPopup(`
        🎯 <strong>Destino establecido</strong><br>
        📍 ${stopName}<br>
        🚌 Ruta: ${routeName}<br>
        <button onclick="removeDestination()" style="margin-top:8px; padding:5px 10px; background:#ff4444; color:white; border:none; border-radius:4px; cursor:pointer;">
            ❌ Eliminar destino
        </button>
    `)
    .openPopup();
    
    // ✅ AGREGAR BOTÓN DE ELIMINAR EN EL PANEL DE INFORMACIÓN
    addRemoveButtonToRouteInfo(routeName, stopName);
    
    // Iniciar monitoreo
    startMonitoring();
    
    // Mostrar notificación
    showNotification(`🎯 Destino establecido: ${stopName}`);
}


function addRemoveButtonToRouteInfo(routeName, stopName) {
    // Buscar todos los route-info activos
    document.querySelectorAll('.route-info').forEach(infoDiv => {
        // Verificar si ya existe un botón de eliminar
        const existingRemoveBtn = infoDiv.querySelector('.remove-destination-btn');
        if (existingRemoveBtn) return;
        
        // Crear el botón de eliminar
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-destination-btn';
        removeBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar destino seleccionado';
        removeBtn.style.cssText = `
            width: 100%;
            margin-top: 10px;
            padding: 10px;
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        `;
        
        removeBtn.addEventListener('click', removeDestination);
        
        // Agregar información del destino actual
        const destinationInfo = document.createElement('div');
        destinationInfo.style.cssText = `
            margin: 10px 0;
            padding: 10px;
            background: #e9e7d9;
            border-radius: 8px;
            font-size: 13px;
        `;
        destinationInfo.innerHTML = `
            <strong>🎯 Destino actual:</strong><br>
            📍 ${stopName}<br>
            🚌 ${routeName}
        `;
        
        // Insertar antes del botón de marcar parada
        const markStopContainer = infoDiv.querySelector('div[style*="background: #e9e7d9"]');
        if (markStopContainer) {
            markStopContainer.parentNode.insertBefore(destinationInfo, markStopContainer);
            markStopContainer.parentNode.insertBefore(removeBtn, markStopContainer);
        }
    });
}

function resetStopSelection() {
    isSelectingStop = false;
    map.off('click');
    
    // Solo resetear si no hay un destino seleccionado
    if (!selectedStop) {
        document.querySelectorAll('[id^="mark-stop-btn-"]').forEach(btn => {
            btn.style.display = 'block';
        });
        document.querySelectorAll('[id^="cancel-selection-btn-"]').forEach(btn => {
            btn.style.display = 'none';
        });
    }
}

function startMonitoring() {
    // Verificar cada 3 segundos
    setInterval(() => {
        if (!userMarker || !selectedStop) return;
        
        const userLatLng = userMarker.getLatLng();
        const destCoords = selectedStop.geometry.coordinates;
        const distance = getDistance(
            userLatLng.lat, 
            userLatLng.lng, 
            destCoords[1], 
            destCoords[0]
        );
        
        // Alertas basadas en distancia
        if (distance <= 100) { // 100 metros
            showNotification("🎉 ¡LLEGASTE A TU DESTINO!", true);
            playSound();
            removeDestination();
        } else if (distance <= 300) { // 300 metros
            showNotification("🔔 Estás muy cerca de tu destino (300m)");
        } else if (distance <= 500) { // 500 metros
            showNotification("📍 Te estás acercando a tu destino (500m)");
        }
    }, 3000);
}

function showNotification(message, isUrgent = false) {
    // Crear notificación 
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 70px;
        right: 10px;
        background: ${isUrgent ? '#4CAF50' : '#2c3e50'};
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 250px;
        font-size: 13px;
        font-weight: 400;
        opacity: 0.95;
        animation: fadeIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 3000);
}
function playSound() {
    // Sonido simple de notificación
    try {
        const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
        audio.play();
    } catch (e) {
        // Si falla el audio, hacemos un beep con el sistema
        console.log("🔔 ¡LLEGASTE!");
    }
}

function removeDestination() {
    if (destinationMarker) {
        map.removeLayer(destinationMarker);
        destinationMarker = null;
    }
    selectedStop = null;
    
    document.querySelectorAll('.route-info').forEach(infoDiv => {
        const removeBtn = infoDiv.querySelector('.remove-destination-btn');
        const destinationInfo = infoDiv.querySelector('div[style*="background: #e9e7d9"]');
        
        // Buscar el elemento de información de destino 
        const allDivs = infoDiv.querySelectorAll('div');
        let destinationInfoElement = null;
        
        allDivs.forEach(div => {
            if (div.innerHTML.includes('🎯 Destino actual:')) {
                destinationInfoElement = div;
            }
        });
        
        if (removeBtn) removeBtn.remove();
        if (destinationInfoElement) destinationInfoElement.remove();
    });
    
    showNotification("🗑️ Destino eliminado");
    resetStopSelection();
}

// FUNCIÓN PARA VER EL DESTINO ACTUAL
function showCurrentDestination() {
    if (!selectedStop) {
        showNotification("ℹ️ No hay ningún destino establecido");
        return;
    }
    
    const stopName = selectedStop.properties.name || 'Parada sin nombre';
    if (destinationMarker) {
        destinationMarker.openPopup();
        showNotification(`🎯 Destino actual: ${stopName}`);
    }
}

map.on('dblclick', function() {
    if (selectedStop) {
        showCurrentDestination();
    }
});

function cancelStopSelection() {
    resetStopSelection();
    showNotification("Selección de destino cancelada");
    
    // Ocultar botón de cancelar y mostrar botón normal
    document.querySelectorAll('[id^="cancel-selection-btn-"]').forEach(btn => {
        btn.style.display = 'none';
    });
    document.querySelectorAll('[id^="mark-stop-btn-"]').forEach(btn => {
        btn.style.display = 'block';
    });
}
