// Ejecuta con: node scripts/merge-stops.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'original');

const features = [];

/**
 * Buscar recursivamente archivos stops*.geojson o route.geojson dentro de /stops
 */
function findStopFiles(baseDir, idRuta) {
  fs.readdirSync(baseDir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      findStopFiles(fullPath, idRuta); // recursión
    } else if (
      entry.isFile() &&
      (entry.name.toLowerCase().includes('stops') || entry.name.toLowerCase() === 'route.geojson')
    ) {
      try {
        const gj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const feats = gj.type === 'FeatureCollection' ? gj.features : [gj];
        feats.forEach(f => {
          f.properties = { ...(f.properties || {}), id_ruta: idRuta };
          features.push(f);
        });
        console.log(`✔ Paradas agregadas desde ${fullPath}`);
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
    findStopFiles(rutaDir, id);
  });

// salida
const all = { type: 'FeatureCollection', features };
const OUT = path.join(ROOT, 'data', 'all_stops.geojson');
fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log(`\n✅ Listo: ${OUT} con ${features.length} paradas`);
