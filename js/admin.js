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
        userCircle = L.circle([lat, lon], { radius: 200, color: "orange", fillColor: "rgba(255, 174, 0, 0.63)", fillOpacity: 0.4 }).addTo(map);
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
const routesListEl = document.getElementById('routes-cards-container');
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
    if (!routesIndex[id] || routesIndex[id].length === 0) return;
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
    if (!routesIndex[id]) {
        console.error(`La ruta con id ${id} no existe.`);
        return;
    }
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
  filterPanel.style.display = "none";  // Ocultar panel de filtros
  
  // Toggle: alternar visibilidad del panel de agregar
  if (addPanel.style.display === "block") {
    closeAddPanel();  // Si está visible, cerrarlo
  } else {
    openAddPanel();  // Si está oculto, abrirlo
  }
});

// --- LÓGICA PARA AGREGAR Y EDITAR RUTAS ---
document.getElementById("btn-save-route").addEventListener("click", () => {
  const routeId = document.getElementById("route-id").value;
  const routeName = document.getElementById("route-name").value;
  const routeSchedule = document.getElementById("route-schedule").value;
  const routeOrigin = document.getElementById("route-origin").value;
  const routeDestination = document.getElementById("route-destination").value;
  const routeNotes = document.getElementById("route-notes").value;
  const mujerSegura = document.getElementById("route-mujer-segura").checked;

  if (!routeName || !routeSchedule) {
    alert("Por favor completa al menos el nombre y horario de la ruta.");
    return;
  }

  // Si hay un routeId, estamos EDITANDO
  if (routeId) {
    const featuresToUpdate = routesIndex[routeId];
    featuresToUpdate.forEach(feature => {
      feature.properties.nombre = routeName;
      feature.properties.horario = routeSchedule;
      feature.properties.origen = routeOrigin;
      feature.properties.destino = routeDestination;
      feature.properties.notas = routeNotes;
      feature.properties.mujerSegura = mujerSegura; // <-- AÑADE ESTA LÍNEA
    });
    alert(`Ruta "${routeName}" actualizada.`);
    renderSidebar(Object.keys(routesIndex).sort((a,b)=>a-b));
    const cardEl = document.querySelector(`.route-card[data-id="${routeId}"]`);
    selectRoute(routeId, cardEl);
    closeAddPanel();
  } else {
    // Si NO hay routeId, estamos AGREGANDO una nueva ruta
    if (!uploadedFile) {
      alert("Por favor, selecciona un archivo GeoJSON para la nueva ruta.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const newRouteData = JSON.parse(event.target.result);
        const newRouteFeatures = newRouteData.features;

        if (!newRouteFeatures || newRouteFeatures.length === 0) {
          alert("El archivo GeoJSON no contiene 'features' válidas.");
          return;
        }

        const maxId = Object.keys(routesIndex).reduce((max, currentId) => Math.max(max, parseInt(currentId)), 0);
        const newId = maxId + 1;

        newRouteFeatures.forEach(feature => {
          feature.properties = feature.properties || {};
          feature.properties.id_ruta = newId;
          feature.properties.nombre = routeName;
          feature.properties.horario = routeSchedule;
          feature.properties.origen = routeOrigin;
          feature.properties.destino = routeDestination;
          feature.properties.notas = routeNotes;
          feature.properties.mujerSegura = mujerSegura; // <-- AÑADE ESTA LÍNEA
        });

        allFeatures.push(...newRouteFeatures);
        routesIndex[newId] = newRouteFeatures;

        renderSidebar(Object.keys(routesIndex).sort((a,b)=>a-b));
        alert(`Ruta "${routeName}" agregada con éxito.`);
        closeAddPanel();

      } catch (e) {
        alert("Error al leer o procesar el archivo GeoJSON. Asegúrate de que el formato es correcto.");
        console.error(e);
      }
    };
    reader.readAsText(uploadedFile);
  }
});

document.getElementById("btn-cancel-add").addEventListener("click", () => {
  closeAddPanel();
});

function openAddPanel() {
  clearAddForm();
  filterPanel.style.display = "none";
  addPanel.querySelector('h3').textContent = "Agregar Nueva Ruta";
  document.getElementById("btn-save-route").textContent = "Guardar Ruta";
  addPanel.style.display = "block";
}

function openEditPanel(id, props) {
  clearAddForm();
  filterPanel.style.display = "none";
  addPanel.querySelector('h3').textContent = "Editar Ruta";
  document.getElementById("btn-save-route").textContent = "Guardar Cambios";
  
  document.getElementById("route-id").value = id;
  document.getElementById("route-name").value = props.nombre;
  document.getElementById("route-schedule").value = props.horario;
  document.getElementById("route-origin").value = props.origen || "";
  document.getElementById("route-destination").value = props.destino || "";
  document.getElementById("route-notes").value = props.notas || "";
  
  document.getElementById("route-mujer-segura").checked = props.mujerSegura || false;

  addPanel.style.display = "block";
}

function closeAddPanel() {
    addPanel.style.display = "none";
    clearAddForm();
}

function clearAddForm() {
  document.getElementById("add-panel").reset();
  uploadedFile = null;
  fileInput.value = '';
  fileInfo.style.display = 'none';
  fileUploadArea.querySelector('.file-upload-content > i').style.display = 'block';
  fileUploadArea.querySelector('.file-upload-content > p').style.display = 'block';
  btnSelectFile.style.display = 'inline-flex';
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
      if (routeLayers[activeRoute]) {
        routeLayers[activeRoute].remove();
      }

      delete routesIndex[activeRoute];
      allFeatures = allFeatures.filter(f => f.properties.id_ruta !== activeRoute);

      routeInfoEl.innerHTML = 'Selecciona una ruta…';
      activeRoute = null;
      renderSidebar(Object.keys(routesIndex).sort((a,b)=>a-b));
      
      alert(`Ruta "${routeName}" eliminada.`);
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

// === FUNCIONALIDAD DE DRAG & DROP PARA ARCHIVOS ===
const fileUploadArea = document.getElementById("file-upload-area");
const fileInput = document.getElementById("route-file");
const btnSelectFile = document.getElementById("btn-select-file");
const fileInfo = document.getElementById("file-info");
const fileName = document.getElementById("file-name");
const btnRemoveFile = document.getElementById("btn-remove-file");
let uploadedFile = null;

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  fileUploadArea.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  fileUploadArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  fileUploadArea.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
  fileUploadArea.classList.add('drag-over');
}

function unhighlight(e) {
  fileUploadArea.classList.remove('drag-over');
}

fileUploadArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

btnSelectFile.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  if (files.length > 0) {
    const file = files[0];
    
    if (file.type === 'application/json' || file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
      uploadedFile = file;
      showFileInfo(file.name);
    } else {
      alert('Por favor selecciona un archivo GeoJSON válido (.geojson o .json)');
    }
  }
}

function showFileInfo(name) {
  fileName.textContent = name;
  fileInfo.style.display = 'flex';
  fileUploadArea.querySelector('.file-upload-content > i').style.display = 'none';
  fileUploadArea.querySelector('.file-upload-content > p').style.display = 'none';
  btnSelectFile.style.display = 'none';
}

btnRemoveFile.addEventListener('click', () => {
  uploadedFile = null;
  fileInput.value = '';
  fileInfo.style.display = 'none';
  fileUploadArea.querySelector('.file-upload-content > i').style.display = 'block';
  fileUploadArea.querySelector('.file-upload-content > p').style.display = 'block';
  btnSelectFile.style.display = 'inline-flex';
});

// Colores
function getColor(id) {
  const palette = ['#2563eb','#e74c3c','#27ae60','#8e44ad','#f39c12','#10b981','#d946ef','#ef4444','#0ea5e9','#f59e0b'];
  return palette[parseInt(id) % palette.length];
}