// Ejecuta con: node scripts/merge-routes.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'original');

const features = [];

/**
 * Buscar recursivamente archivos route.geojson
 */
function findGeojsonFiles(baseDir, idRuta) {
  fs.readdirSync(baseDir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      findGeojsonFiles(fullPath, idRuta); // recursión
    } else if (entry.isFile() && entry.name.toLowerCase() === 'route.geojson') {
      try {
        const gj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const feats = gj.type === 'FeatureCollection' ? gj.features : [gj];
        feats.forEach(f => {
          f.properties = { ...(f.properties || {}), id_ruta: idRuta };
          features.push(f);
        });
        console.log(`✔ Ruta agregada desde ${fullPath}`);
      } catch (e) {
        console.error(`✘ Error leyendo ${fullPath}:`, e.message);
      }
    }
  });
}

// recorrer carpetas 001, 002, 003...
fs.readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .forEach(dir => {
    const id = dir.name; // "001", "002", "003", etc.
    const rutaDir = path.join(DATA_DIR, id);
    findGeojsonFiles(rutaDir, id);
  });

// salida
const all = { type: 'FeatureCollection', features };
const OUT = path.join(ROOT, 'data', 'all_routes.geojson');
fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log(`\n✅ Listo: ${OUT} con ${features.length} features`);
