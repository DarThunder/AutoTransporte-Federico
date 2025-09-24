// Inicializar mapa centrado en Xalapa
const map = L.map('map').setView([19.5438, -96.9103], 13);

// Base map con Stadia Outdoors
L.tileLayer('https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}', {
  minZoom: 0,
  maxZoom: 20,
  ext: 'png'
}).addTo(map);

// Geolocalización usuario
let userMarker;
let userCircle;

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
        userMarker = L.marker([lat, lon], { icon: userIcon })
          .addTo(map)
          .bindPopup("Tu ubicación en tiempo real")
          .openPopup();

        userCircle = L.circle([lat, lon], {
          radius: 200,
          color: "orange",
          fillColor: "rgba(255, 174, 0, 0.63)",
          fillOpacity: 0.4
        }).addTo(map);

        map.setView([lat, lon], 15);
      } else {
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

// === RUTAS (sidebar y mapa) ===
const routesListEl = document.getElementById('routes-list');
const routeInfoEl  = document.getElementById('route-info');
const searchInput  = document.querySelector('.search-box input');

const routesIndex = {};
let allFeatures = [];
const routeLayers = {};
let activeRoute = null;

fetch('../data/all_routes.geojson')
  .then(r => r.json())
  .then(fc => {
    allFeatures = fc.features || [];
    allFeatures.forEach(f => {
      const props = f.properties || {};
      const id = props.id_ruta;
      if (!routesIndex[id]) routesIndex[id] = [];
      routesIndex[id].push(f);
    });
    renderSidebar(Object.keys(routesIndex).sort((a,b)=>a-b));
  });

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
        <div class="card-sub">🕐 ${props.horario}</div>
        ${props.notas ? `<div class="card-notes">📝 ${props.notas}</div>` : ""}
      </div>
    `;
    card.addEventListener('click', () => selectRoute(id, card));
    routesListEl.appendChild(card);
  });
}

function selectRoute(id, cardEl) {
  const props = routesIndex[id][0].properties;
  if (activeRoute && routeLayers[activeRoute]) {
    routeLayers[activeRoute].remove();
    document.querySelector(`.route-card[data-id="${activeRoute}"]`)?.classList.remove('active');
  }
  if (!routeLayers[id]) {
    const group = L.geoJSON({ type: 'FeatureCollection', features: routesIndex[id] }, {
      style: { color: getColor(id), weight: 3, opacity: 0.9 }
    });
    routeLayers[id] = group;
  }
  routeLayers[id].addTo(map);
  activeRoute = id;
  if(cardEl) cardEl.classList.add('active');
  map.fitBounds(routeLayers[id].getBounds(), { padding: [20, 20] });
  showRouteInfo(id, props);
}

function showRouteInfo(id, props) {
  routeInfoEl.innerHTML = `
    <h2>${props.nombre}</h2>
    <p><strong>🕐 Horario:</strong> ${props.horario}</p>
    ${props.notas ? `<p><strong>📝 Notas:</strong> ${props.notas}</p>` : ""}
    ${props.img ? `<div><img src="${props.img}" alt="Ruta ${id}" style="max-width:100%; border-radius:10px"></div>` : ""}
  `;
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    sidebar.classList.toggle('active', q !== '');
    Array.from(routesListEl.children).forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// === PANELES DE ADMIN ===
const filterBtn = document.getElementById("filter-btn");
const filterPanel = document.getElementById("filter-panel");
const addBtn = document.getElementById("add-btn");
const addPanel = document.getElementById("add-panel");

filterBtn.addEventListener("click", () => {
  addPanel.style.display = "none";
  filterPanel.style.display = filterPanel.style.display === "block" ? "none" : "block";
});

document.querySelector(".btn-apply").addEventListener("click", () => alert("Filtros aplicados 🚌"));
document.querySelector(".btn-clear").addEventListener("click", () => {
    filterPanel.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
    filterPanel.querySelectorAll("input[list]").forEach(inp => inp.value = "");
    document.getElementById("filtered-routes").innerHTML = "";
});

addBtn.addEventListener("click", () => {
  openAddPanel();
});

document.getElementById("btn-save-route").addEventListener("click", () => {
  const routeId = document.getElementById("route-id").value;
  const routeName = document.getElementById("route-name").value;
  const routeSchedule = document.getElementById("route-schedule").value;
  const routeOrigin = document.getElementById("route-origin").value;
  const routeDestination = document.getElementById("route-destination").value;
  const routeNotes = document.getElementById("route-notes").value;

  if (routeName && routeSchedule) {
    if (routeId) {
      const featuresToUpdate = routesIndex[routeId];
      featuresToUpdate.forEach(feature => {
        feature.properties.nombre = routeName;
        feature.properties.horario = routeSchedule;
        feature.properties.origen = routeOrigin;
        feature.properties.destino = routeDestination;
        feature.properties.notas = routeNotes;
      });
      alert(`Ruta ${routeName} actualizada.`);
      
      renderSidebar(Object.keys(routesIndex).sort((a,b)=>a-b));
      const cardEl = document.querySelector(`.route-card[data-id="${routeId}"]`);
      selectRoute(routeId, cardEl);
    } else {
      alert("La funcionalidad para agregar nuevas rutas aún no está implementada.");
    }
    
    closeAddPanel();
  } else {
    alert("Por favor completa al menos el nombre y horario de la ruta");
  }
});

document.getElementById("btn-cancel-add").addEventListener("click", () => {
  closeAddPanel();
});

function openAddPanel() {
  filterPanel.style.display = "none";
  addPanel.querySelector('h3').textContent = "Agregar Nueva Ruta";
  document.getElementById("btn-save-route").textContent = "Guardar Ruta";
  addPanel.style.display = "block";
}

function openEditPanel(id, props) {
  filterPanel.style.display = "none";
  addPanel.querySelector('h3').textContent = "Editar Ruta";
  document.getElementById("btn-save-route").textContent = "Guardar Cambios";

  document.getElementById("route-id").value = id;
  document.getElementById("route-name").value = props.nombre;
  document.getElementById("route-schedule").value = props.horario;
  document.getElementById("route-origin").value = props.origen || "";
  document.getElementById("route-destination").value = props.destino || "";
  document.getElementById("route-notes").value = props.notas || "";

  addPanel.style.display = "block";
}

function closeAddPanel() {
    addPanel.style.display = "none";
    clearAddForm();
}

function clearAddForm() {
  document.getElementById("route-id").value = "";
  document.getElementById("route-name").value = "";
  document.getElementById("route-schedule").value = "";
  document.getElementById("route-origin").value = "";
  document.getElementById("route-destination").value = "";
  document.getElementById("route-notes").value = "";
}

// === BOTONES DE ADMINISTRACIÓN (Editar, Eliminar y Descargar) ===
const editBtn = document.getElementById("edit-btn");
const deleteBtn = document.getElementById("delete-btn");
const downloadBtn = document.getElementById("download-btn");

editBtn.addEventListener("click", () => {
  if (activeRoute) {
    const props = routesIndex[activeRoute][0].properties;
    openEditPanel(activeRoute, props);
  } else {
    alert("Primero selecciona una ruta para editar");
  }
});

deleteBtn.addEventListener("click", () => {
  if (activeRoute) {
    const routeName = routesIndex[activeRoute][0].properties.nombre;
    if (confirm(`¿Estás seguro de que deseas eliminar la ruta "${routeName}"?`)) {
      alert(`Ruta ${routeName} eliminada 🗑️`);
    }
  } else {
    alert("Primero selecciona una ruta para eliminar");
  }
});

downloadBtn.addEventListener("click", () => {
  const updatedGeoJSON = {
    type: "FeatureCollection",
    features: allFeatures
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(updatedGeoJSON, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "all_routes_actualizado.geojson");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});


// Drag & Drop
const fileUploadArea = document.getElementById("file-upload-area");
// ... (resto del código de Drag & Drop) ...

// Colores
function getColor(id) {
  const palette = ['#2563eb','#e74c3c','#27ae60','#8e44ad','#f39c12','#10b981','#d946ef','#ef4444','#0ea5e9','#f59e0b'];
  return palette[id % palette.length];
}