  // Inicializar mapa centrado en Xalapa
  const map = L.map('map').setView([19.5438, -96.9103], 13);

  // Base map con Stadia Outdoors
  var Stadia_Outdoors = L.tileLayer('https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}', {
    minZoom: 0,
    maxZoom: 20,
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

  // Sidebar toggle
  const menuBtn = document.querySelector('.menu-btn');
  const sidebar = document.getElementById('sidebar');

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
  });

  // === RUTAS (lista + capas) ===
  const routesListEl = document.getElementById('routes-list');
  const routeInfoEl  = document.getElementById('route-info');
  const searchInput  = document.querySelector('.search-box input');

  const routesIndex = {};   // { id_ruta: [Feature, Feature, ...] }
  const routeLayers = {};   // { id_ruta: L.LayerGroup }
  const activeRoutes = new Set();
  let highlightedLayer = null;

  // 1) Cargar e indexar todas las rutas
  fetch('../data/all_routes.geojson')
    .then(r => r.json())
    .then(fc => {
      (fc.features || []).forEach(f => {
        const props = f.properties || {};
        const id = props.id_ruta || props.id || props.route_id || 'ND';
        if (!routesIndex[id]) routesIndex[id] = [];
        routesIndex[id].push(f);
      });

      const idsOrdenados = Object.keys(routesIndex).sort((a,b)=>a.localeCompare(b, 'es', { numeric: true }));
      renderSidebar(idsOrdenados);
    })
    .catch(err => {
      console.error('Error cargando all_routes.geojson:', err);
      routeInfoEl.textContent = 'No se pudieron cargar las rutas.';
    });

  // 2) Pintar lista en sidebar
  function renderSidebar(ids) {
    routesListEl.innerHTML = '';
    ids.forEach(id => {
      const color = getColor(id);
      const item = document.createElement('div');
      item.className = 'route-item';
      item.dataset.id = id;
      item.innerHTML = `
        <span class="color-dot" style="background:${color}"></span>
        <span>Ruta ${id}</span>
      `;
      item.addEventListener('click', () => toggleRoute(id, item));
      routesListEl.appendChild(item);
    });
  }

  // 3) Activar/Desactivar una ruta
  function toggleRoute(id, itemEl) {
    // si está activa, quitar
    if (activeRoutes.has(id)) {
      activeRoutes.delete(id);
      if (routeLayers[id]) {
        routeLayers[id].remove();
      }
      itemEl.classList.remove('active');
      routeInfoEl.textContent = 'Selecciona una ruta…';
      return;
    }

    // activar: crear layerGroup si no existe
    if (!routeLayers[id]) {
      const color = getColor(id);
      const group = L.geoJSON({ type: 'FeatureCollection', features: routesIndex[id] }, {
        style: { color, weight: 3, opacity: 0.9 },
        onEachFeature: (feature, layer) => {
          layer.on('click', () => {
            highlightLayer(layer);
            showRouteInfo(id, feature.properties || {});
            // popup opcional
            const nombre = feature.properties?.name || feature.properties?.nombre || `Ruta ${id}`;
            layer.bindPopup(`<b>${nombre}</b><br/>ID: ${id}`).openPopup();
          });
        }
      });
      routeLayers[id] = group;
    }

    // añadir al mapa
    routeLayers[id].addTo(map);
    activeRoutes.add(id);
    itemEl.classList.add('active');

    // encuadrar a la ruta
    try { map.fitBounds(routeLayers[id].getBounds(), { padding: [20, 20] }); } catch {}
  }

  // 4) Resaltar la línea clickeada
  function highlightLayer(layer) {
    // reset a previo
    if (highlightedLayer && highlightedLayer.setStyle) {
      highlightedLayer.setStyle({ weight: 3, opacity: 0.9 });
    }
    // resaltar actual
    if (layer.setStyle) {
      layer.setStyle({ weight: 6, opacity: 1 });
      if (layer.bringToFront) layer.bringToFront();
    }
    highlightedLayer = layer;
  }

  // 5) Mostrar info en panel (arriba del sidebar)
  function showRouteInfo(id, props) {
    const nombre = props.name || props.nombre || `Ruta ${id}`;
    const extra  = props.description || props.info || '';
    routeInfoEl.innerHTML = `
      <div><strong>${nombre}</strong></div>
      <div>ID: ${id}</div>
      ${extra ? `<div style="margin-top:.25rem">${extra}</div>` : ''}
      <button id="btn-centrar" style="
        margin-top:.5rem; padding:.35rem .6rem; border:none; border-radius:8px;
        background:#2563eb; color:#fff; cursor:pointer;">Centrar</button>
    `;
    const btn = document.getElementById('btn-centrar');
    btn.onclick = () => {
      if (routeLayers[id]) {
        try { map.fitBounds(routeLayers[id].getBounds(), { padding: [20, 20] }); } catch {}
      }
    };
  }

  // 6) Búsqueda: filtra lista por texto del input del header
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      Array.from(routesListEl.children).forEach(item => {
        const txt = item.textContent.toLowerCase();
        item.style.display = txt.includes(q) ? '' : 'none';
      });
    });
  }

  // paleta determinística por id
  function getColor(id) {
    const palette = ['#2563eb','#e74c3c','#27ae60','#8e44ad','#f39c12','#10b981','#d946ef','#ef4444','#0ea5e9','#f59e0b'];
    let hash = 0; for (let i=0;i<id.length;i++) hash = id.charCodeAt(i) + ((hash<<5)-hash);
    return palette[Math.abs(hash) % palette.length];
  }
