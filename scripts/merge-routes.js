// Ejecuta con: node scripts/merge-routes.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'original');
const IMG_OUT = path.join(ROOT, 'data', 'img');

if (!fs.existsSync(IMG_OUT)) fs.mkdirSync(IMG_OUT, { recursive: true });

const features = [];

/**
 * Cargar metadatos desde route.json (si existe)
 */
function cargarMetadatos(rutaDir) {
  const jsonFile = path.join(rutaDir, 'route.json');
  if (fs.existsSync(jsonFile)) {
    try {
      return JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    } catch {
      console.warn(`⚠ No se pudo leer ${jsonFile}`);
    }
  }
  return {};
}

/**
 * Copiar imagen a data/img y devolver ruta relativa accesible
 */
function copiarImagen(rutaBase, numRuta) {
  const imagenDir = path.join(rutaBase, 'imagen');
  if (!fs.existsSync(imagenDir)) return '';

  const posibles = ['jpg', 'jpeg', 'png', 'webp'];
  const archivos = fs.readdirSync(imagenDir);
  const img = archivos.find(f =>
    posibles.some(ext => f.toLowerCase().endsWith('.' + ext))
  );
  if (!img) return '';

  const src = path.join(imagenDir, img);
  const ext = path.extname(img);
  const destName = `ruta_${numRuta}${ext}`;
  const dest = path.join(IMG_OUT, destName);

  fs.copyFileSync(src, dest);

  // ruta que podrá leer el navegador
  return `../data/img/${destName}`;
}

/**
 * Detectar sentido a partir del path
 */
function detectarSentido(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes('ida')) return 'Ida';
  if (lower.includes('vuelta')) return 'Vuelta';
  return '';
}






/**
 * Buscar recursivamente archivos route.geojson
 */
function findGeojsonFiles(baseDir, numRuta, rutaBase, meta) {
  fs.readdirSync(baseDir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      findGeojsonFiles(fullPath, numRuta, rutaBase, meta); // recursión
    } else if (entry.isFile() && entry.name.toLowerCase() === 'route.geojson') {
      try {
        const gj = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        const feats = gj.type === 'FeatureCollection' ? gj.features : [gj];

        feats.forEach(f => {
          f.properties = {
            ...(f.properties || {}),
            id_ruta: numRuta, // número corrido 1, 2, 3...
           nombre: `Ruta ${numRuta}: ${meta.desc || meta.name || ''}`.trim(),
            empresa: meta.empresa || f.properties?.empresa || 'Desconocida',
            sentido: detectarSentido(fullPath),
            img: copiarImagen(rutaBase, numRuta),
            horario: "10 am - 10 pm",
            notas: meta.notas || ''
          };
          features.push(f);
        });
        console.log(`✔ Ruta ${numRuta} agregada desde ${fullPath}`);
      } catch (e) {
        console.error(`✘ Error leyendo ${fullPath}:`, e.message);
      }
    }
  });
}

// recorrer carpetas 001, 002, 003...
const carpetas = fs
  .readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory());

carpetas.forEach((dir, idx) => {
  const numRuta = idx + 1; // 1, 2, 3...
  const rutaBase = path.join(DATA_DIR, dir.name);

  // cargar metadatos desde cualquier "route.json"
  let meta = {};
  const posibles = [
    path.join(rutaBase, 'route'),
    path.join(rutaBase, 'ida', 'route'),
    path.join(rutaBase, 'vuelta', 'route')
  ];
  posibles.forEach(p => {
    if (fs.existsSync(path.join(p, 'route.json'))) {
      meta = cargarMetadatos(p);
    }
  });

  findGeojsonFiles(rutaBase, numRuta, rutaBase, meta);
});

// salida
const all = { type: 'FeatureCollection', features };
const OUT = path.join(ROOT, 'data', 'all_routes.geojson');
fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
console.log(`\n✅ Listo: ${OUT} con ${features.length} features`);
