const fs = require('fs');
const path = require('path');

const files = [
  { src: 'public/manifest.json', dest: 'dist/manifest.json' },
  { src: 'public/manifest.json', dest: 'dist/pwa-manifest.json' }, // TEST: Nombre alternativo
  { src: 'public/app-manifest.json', dest: 'dist/app-manifest.json' },
  { src: 'public/service-worker.js', dest: 'dist/service-worker.js' },
  { src: 'public/web-app-manifest-192x192.png', dest: 'dist/web-app-manifest-192x192.png' },
  { src: 'public/web-app-manifest-512x512.png', dest: 'dist/web-app-manifest-512x512.png' },
  { src: 'public/apple-touch-icon.png', dest: 'dist/apple-touch-icon.png' },
  { src: 'public/favicon.svg', dest: 'dist/favicon.svg' },
  { src: 'public/favicon.ico', dest: 'dist/favicon.ico' }
];

console.log('📦 Copiando archivos PWA a dist/...');

// Asegurar que dist existe
if (!fs.existsSync('dist')) {
  console.log('❌ dist/ no existe - el build de Vite falló');
  process.exit(1);
}

files.forEach(({ src, dest }) => {
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      const stats = fs.statSync(dest);
      console.log(`✅ ${src} → ${dest} (${stats.size} bytes)`);
    } else {
      console.log(`⚠️  ${src} no encontrado, saltando...`);
    }
  } catch (error) {
    console.error(`❌ Error copiando ${src}:`, error.message);
  }
});

// Corregir referencia a manifest.json en index.html
try {
  const indexPath = 'dist/index.html';
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf-8');
    
    // Reemplazar /assets/manifest-[hash].json con /manifest.json
    const before = html.match(/\/assets\/manifest-[a-zA-Z0-9]+\.json/);
    html = html.replace(/\/assets\/manifest-[a-zA-Z0-9]+\.json/g, '/manifest.json');
    
    fs.writeFileSync(indexPath, html);
    console.log(`✅ index.html actualizado: ${before} → /manifest.json`);
  } else {
    console.warn('⚠️  dist/index.html no encontrado');
  }
} catch (error) {
  console.error('❌ Error actualizando index.html:', error.message);
}

// Verificar que archivos existen en dist
console.log('\n🔍 Verificando archivos finales en dist/:');
const checkFiles = ['manifest.json', 'pwa-manifest.json', 'service-worker.js'];
checkFiles.forEach(file => {
  const filePath = `dist/${file}`;
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`   ✅ ${file}: ${stats.size} bytes`);
  } else {
    console.log(`   ❌ ${file}: NO EXISTE`);
  }
});

console.log('\n✅ Archivos PWA copiados exitosamente');
