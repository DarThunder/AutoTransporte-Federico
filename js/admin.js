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
    const routesListEl = document.getElementById('routes-list');
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
      });

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
            <div class="card-sub">🕐 ${props.horario}</div>
            ${props.notas ? `<div class="card-notes">📝 ${props.notas}</div>` : ""}
          </div>
        `;
        card.addEventListener('click', () => selectRoute(id, props, card));
        routesListEl.appendChild(card);
      });
    }

    // 3) Selección desde sidebar
    function selectRoute(id, props, cardEl) {
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
      cardEl.classList.add('active');
      map.fitBounds(routeLayers[id].getBounds(), { padding: [20, 20] });
      showRouteInfo(id, props);
    }

    // 4) Mostrar info completa
    function showRouteInfo(id, props) {
      routeInfoEl.innerHTML = `
        <h2>${props.nombre}</h2>
        <p><strong>🕐 Horario:</strong> ${props.horario}</p>
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
      filterPanel.style.display =
        filterPanel.style.display === "block" ? "none" : "block";
    });

    document.querySelector(".btn-apply").addEventListener("click", () => {
      alert("Filtros aplicados 🚌");
    });

    document.querySelector(".btn-clear").addEventListener("click", () => {
      filterPanel.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
      filterPanel.querySelectorAll("input[list]").forEach(inp => inp.value = "");
      document.getElementById("filtered-routes").innerHTML = "";
    });

    // === BOTONES DE ADMINISTRACIÓN ===
    const addBtn = document.getElementById("add-btn");
    const editBtn = document.getElementById("edit-btn");
    const deleteBtn = document.getElementById("delete-btn");

    addBtn.addEventListener("click", () => {
      //Funcion de agregar
    });

    editBtn.addEventListener("click", () => {
      if (activeRoute) {
        //Funcion de editar false
      } else {
        alert("Primero selecciona una ruta para editar");
        //Funcion de editar true
      }
    });

    deleteBtn.addEventListener("click", () => {
      if (activeRoute) {
        const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar la ruta ${activeRoute}?`);
        if (confirmDelete) {
          alert(`Ruta ${activeRoute} eliminada 🗑️`);
          // Aquí irá la lógica para eliminar la ruta
        }
      } else {
        alert("Primero selecciona una ruta para eliminar");
      }
    });