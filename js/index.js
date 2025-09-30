// Inicializar mapa centrado en Xalapa
const map = L.map('map').setView([19.5438, -96.9103], 13);

// Base map con Stadia Outdoors
var Stadia_Outdoors = L.tileLayer('https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  ext: 'png'
}).addTo(map);

// Geolocalización usuario
let userMarker;
let userCircle; // círculo del radio

const userIcon = L.divIcon({
  className: "user-location",
  html: '<div class="user-circle"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (!userMarker) {
        // marcador del usuario
        userMarker = L.marker([lat, lon], { icon: userIcon })
          .addTo(map)
          .bindPopup("Tu ubicación en tiempo real")
          .openPopup();

        // círculo alrededor de la ubicación
        userCircle = L.circle([lat, lon], {
          radius: 200, 
          color: "orange",
          fillColor: "rgba(255, 174, 0, 0.63)",
          fillOpacity: 0.4
        }).addTo(map);

        map.setView([lat, lon], 15);
      } else {
        // actualizar posición del marcador y círculo
        userMarker.setLatLng([lat, lon]);
        userCircle.setLatLng([lat, lon]);
      }
    },
    (err) => console.error("Error al obtener ubicación:", err.message),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Sidebar
const menuBtn = document.querySelector('.menu-btn');
const sidebar = document.getElementById('sidebar');
menuBtn.addEventListener('click', () => sidebar.classList.toggle('active'));

// === RUTAS (solo sidebar) ===
const routesListEl = document.getElementById('routes-cards-container');
const routeInfoEl  = document.getElementById('route-info');
const searchInput  = document.querySelector('.search-box input');

const routesIndex = {};   // { id_ruta: [Feature, Feature, ...] }
const routeLayers = {};   // { id_ruta: L.LayerGroup }
let activeRoute = null;

// 1) Cargar e indexar
fetch('../data/all_routes.geojson')
  .then(r => r.json())
  .then(fc => {
    (fc.features || []).forEach(f => {
      const props = f.properties || {};
      const id = props.id_ruta;
      if (!routesIndex[id]) routesIndex[id] = [];
      routesIndex[id].push(f);
    });
    renderSidebar(Object.keys(routesIndex).sort((a,b)=>a-b));
  });//*

// 2) Sidebar con tarjetas
function renderSidebar(ids) {
  routesListEl.innerHTML = '';
  ids.forEach(id => {
    const props = routesIndex[id][0].properties;
    const card = document.createElement('div');
    card.className = 'route-card';
    card.dataset.id = id;
    card.innerHTML = `
      <div class="card-body">
        <div class="card-title">${props.nombre}</div>
        <div class="card-sub">🕒 ${props.horario}</div>
        ${props.notas ? `<div class="card-notes">📝 ${props.notas}</div>` : ""}
      </div>
    `;
    card.addEventListener('click', () => selectRoute(id, props, card));
    routesListEl.appendChild(card);
  });
}

// 3) Selección desde sidebar - CON DESELECCIÓN
function selectRoute(id, props, cardEl) {
  // Si ya está seleccionada esta ruta, la deseleccionamos
  if (activeRoute === id) {
    routeLayers[id].remove();
    activeRoute = null;
    cardEl.classList.remove('active');
    routeInfoEl.innerHTML = "Selecciona una ruta…";
    return;
  }
  
  // Si hay otra ruta activa, la deseleccionamos primero
  if (activeRoute && routeLayers[activeRoute]) {
    routeLayers[activeRoute].remove();
    document.querySelector(`.route-card[data-id="${activeRoute}"]`)?.classList.remove('active');
  }
  
  // Creamos la capa si no existe
  if (!routeLayers[id]) {
    const group = L.geoJSON({ type: 'FeatureCollection', features: routesIndex[id] }, {
      style: { color: getColor(id), weight: 3, opacity: 0.9 }
    });
    routeLayers[id] = group;
  }
  
  // Mostramos la ruta seleccionada
  routeLayers[id].addTo(map);
  activeRoute = id;
  cardEl.classList.add('active');
  map.fitBounds(routeLayers[id].getBounds(), { padding: [20, 20] });
  showRouteInfo(id, props);
}

// 4) Mostrar info completa
function showRouteInfo(id, props) {
  routeInfoEl.innerHTML = `
    <h2>${props.nombre}</h2>
    <p><strong>🕒 Horario:</strong> ${props.horario}</p>
    ${props.notas ? `<p><strong>📝 Notas:</strong> ${props.notas}</p>` : ""}
    ${props.img ? `<div><img src="${props.img}" alt="Ruta ${id}" style="max-width:100%; border-radius:10px"></div>` : ""}
  `;
}

// 5) Búsqueda
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();

    //"q" es el texto que se escribe dentro el input
    if(q === ''){
      //Si el input no tiene texto, el sidebar va a ocultarse
      sidebar.classList.remove('active');
    } else {
      //Si, si tiene va a aparecer
      sidebar.classList.add('active');
    }

    Array.from(routesListEl.children).forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// colores
function getColor(id) {
  const palette = ['#2563eb','#e74c3c','#27ae60','#8e44ad','#f39c12','#10b981','#d946ef','#ef4444','#0ea5e9','#f59e0b'];
  return palette[id % palette.length];
}

// === BOTÓN APLICAR FILTROS ===

const filterBtn = document.getElementById("filter-btn");
const filterPanel = document.getElementById("filter-panel");

filterBtn.addEventListener("click", () => {
  filterPanel.classList.toggle("active");
  
  // Hacer scroll al inicio para ver el panel
  if (filterPanel.classList.contains("active")) {
    const routesList = document.getElementById("routes-list");
    routesList.scrollTop = 0; // Scroll al inicio para ver el panel
  }
});

// === FILTRADO DE RUTAS ===
function filtrarRutas() {
  const origen = document.getElementById("origen-input").value.trim().toLowerCase();
  const destino = document.getElementById("destino-input").value.trim().toLowerCase();
  const rutasSeguras = document.getElementById("rutas-seguras")?.checked || false;
  const soloCercanas = document.getElementById("rutas-cercanas")?.checked || false;

  // Verificar si no hay ningún filtro aplicado
  if (!origen && !destino && !rutasSeguras && !soloCercanas) {
    // Mostrar mensaje de error
    const resultEl = document.getElementById("filtered-routes");
    resultEl.innerHTML = `<p class="no-routes" style="color: #e74c3c; font-weight: bold;">⚠️ No has introducido ningún dato para filtrar</p>`;
    resultEl.style.display = "block";
    
    // Ocultar lista original temporalmente
    routesListEl.style.display = "none";
    routeInfoEl.style.display = "none";
    
    return [];
  }

  const resultados = Object.keys(routesIndex).filter(id => {
    const props = routesIndex[id][0].properties;
    const desc = (props.desc || "").toLowerCase();

    if (origen && !desc.includes(origen)) return false;
    if (destino && !desc.includes(destino)) return false;
    if (rutasSeguras && !props.segura) return false;
    return true;
  });

  // 1. NO mostrar nada en el mapa todavía
  Object.keys(routeLayers).forEach(id => map.removeLayer(routeLayers[id]));

  // 2. Mostrar solo los resultados en el panel
  routesListEl.style.display = "none";
  routeInfoEl.style.display = "none";
  
  const resultEl = document.getElementById("filtered-routes");
  resultEl.innerHTML = "";
  resultEl.style.display = "block";

  if (resultados.length > 0) {
    resultEl.innerHTML = `<h3>Rutas encontradas:</h3>`;
    resultados.forEach(id => {
      const props = routesIndex[id][0].properties;
      const div = document.createElement("div");
      div.className = "route-card";
      div.dataset.id = id;
      div.innerHTML = `
        <div class="card-body">
          <div class="card-title">${props.nombre}</div>
          <div class="card-sub">🕒 ${props.horario}</div>
          ${props.notas ? `<div class="card-notes">📝 ${props.notas}</div>` : ""}
        </div>
      `;

      // 👇 Aquí recién se dibuja cuando el usuario haga clic
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
  // Restablecer valores de los filtros
  document.getElementById("origen-input").value = "";
  document.getElementById("destino-input").value = "";
  document.getElementById("rutas-seguras").checked = false;
  document.getElementById("rutas-cercanas").checked = false;
  
  // Ocultar resultados de filtro
  const resultEl = document.getElementById("filtered-routes");
  resultEl.innerHTML = "";
  resultEl.style.display = "none";
  
  // Mostrar lista original de rutas
  routesListEl.style.display = "block";
  routeInfoEl.style.display = "block";
  
  // Quitar todas las rutas del mapa
  Object.keys(routeLayers).forEach(id => {
    map.removeLayer(routeLayers[id]);
  });
  
  // Si había una ruta activa antes de filtrar, restaurarla
  if (activeRoute) {
    selectRoute(activeRoute, routesIndex[activeRoute][0].properties);
  }
}

// Modificar los event listeners para usar las nuevas funciones
document.querySelector(".btn-clear").addEventListener("click", limpiarFiltros);
document.querySelector(".btn-apply").addEventListener("click", filtrarRutas);

// === AUTOCOMPLETAR DESTINOS SEGÚN ORIGEN ===
function obtenerDestinosDesdeOrigen(origen) {
  origen = origen.trim().toLowerCase();
  if (!origen) return [];

  const destinos = new Set();

  Object.keys(routesIndex).forEach(id => {
    const props = routesIndex[id][0].properties;
    // "desc" contiene las paradas separadas por "/"
    const zonas = (props.desc || "").split("/").map(z => z.trim());

    // Si la ruta contiene el origen, guardamos las demás paradas como destinos posibles
    if (zonas.map(z => z.toLowerCase()).includes(origen)) {
      zonas.forEach(z => {
        if (z.toLowerCase() !== origen) destinos.add(z);
      });
    }
  });

  return Array.from(destinos);
}

// === Escuchar cuando el usuario cambia el ORIGEN ===
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
    posiblesDestinos.forEach(dest => {
      const option = document.createElement("option");
      option.value = dest;
      dataList.appendChild(option);
    });
  }
});
