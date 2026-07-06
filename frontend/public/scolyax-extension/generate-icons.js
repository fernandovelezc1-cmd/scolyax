/**
 * generate-icons.js
 * Genera los PNG de iconos de la extensión a partir del SVG del proyecto.
 * Uso: node generate-icons.js
 * Requiere: npm install sharp (solo para este script)
 */
const path = require('path')
const fs   = require('fs')

const SIZES = [16, 48, 128]
const svgSrc = path.join(__dirname, '..', 'scolyax-icon.svg')
const outDir = path.join(__dirname, 'icons')

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

;(async () => {
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.error('❌  Instala sharp primero:  npm install sharp')
    process.exit(1)
  }

  for (const size of SIZES) {
    const dest = path.join(outDir, `icon-${size}.png`)
    await sharp(svgSrc)
      .resize(size, size)
      .png()
      .toFile(dest)
    console.log(`✅  icons/icon-${size}.png`)
  }

  console.log('\n🎉  Iconos generados. Ahora ejecuta: npm run build:extension')
})()
