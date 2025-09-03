// Ejecuta con: node scripts/merge-routes.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'original'); // apuntando a la carpeta correcta

const features = [];

fs.readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .forEach(dir => {
    const id = dir.name; // "001", "002", ...
    // Cambiado: eliminamos 'shapefile'
    const gjPath = path.join(DATA_DIR, id, 'route', 'route.geojson'); 
    if (fs.existsSync(gjPath)) {
      try {
        const gj = JSON.parse(fs.readFileSync(gjPath, 'utf8'));
        const feats = gj.type === 'FeatureCollection' ? gj.features : [gj];
        feats.forEach(f => {
          f.properties = { ...(f.properties || {}), id_ruta: id };
          features.push(f);
        });
      } catch (e) {
        console.error(`Error leyendo ${gjPath}:`, e.message);
      }
    }
  });

const all = { type: 'FeatureCollection', features };
const OUT = path.join(ROOT, 'data', 'all_routes.geojson'); // salida en data/
fs.writeFileSync(OUT, JSON.stringify(all, null, 2)); // formato legible
console.log(`Listo: ${OUT} con ${features.length} features`);
