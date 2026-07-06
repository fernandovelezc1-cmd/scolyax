const fs = require('fs');
const path = require('path');

const stage = process.argv[2] || 'post'; // 'pre' o 'post'
const publicDir = 'public';
const distDir = 'dist';

if (stage === 'pre') {
  console.log('📋 [PRE-BUILD] Verificando que public/ tiene los archivos...');
  if (fs.existsSync(publicDir)) {
    console.log('✅ public/ existe');
  } else {
    console.warn('⚠️  public/ no encontrado');
  }
  process.exit(0);
}

// STAGE POST
console.log('📋 [POST-BUILD] Asegurando que manifest.json está en dist/...');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ no existe. Build de Vite falló.');
  process.exit(1);
}

const manifestPath = path.join(distDir, 'manifest.json');
const publicManifestPath = path.join(publicDir, 'manifest.json');

// Si ya existe, perfecto
if (fs.existsSync(manifestPath)) {
  const stats = fs.statSync(manifestPath);
  console.log(`✅ manifest.json YA está en dist/ (${stats.size} bytes)`);
  process.exit(0);
}

// Si no existe, copiar desde public/
if (fs.existsSync(publicManifestPath)) {
  try {
    fs.copyFileSync(publicManifestPath, manifestPath);
    console.log('✅ manifest.json copiado a dist/');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error copiando manifest.json: ${error.message}`);
    process.exit(1);
  }
} else {
  console.error('❌ manifest.json no existe en public/');
  process.exit(1);
}
