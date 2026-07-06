# build-extension.ps1
# Empaqueta la extension Scolyax para subir a la Chrome Web Store.
# Uso: .\build-extension.ps1  (desde la raiz del proyecto)
# Requisito previo: node generate-icons.js  (para generar los PNG de iconos)

$ErrorActionPreference = "Stop"
$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExtSrc    = Join-Path $Root "frontend\public\scolyax-extension"
$PublicDir = Join-Path $Root "frontend\public"
$BuildDir  = Join-Path $Root "dist-extension"
$ZipOut    = Join-Path $Root "scolyax-extension.zip"

Write-Host "`n🔧  Scolyax Extension Builder" -ForegroundColor Cyan
Write-Host "==============================`n"

# ── 1. Generar iconos si no existen ─────────────────────────────────────────
$IconDir = Join-Path $ExtSrc "icons"
if (-not (Test-Path (Join-Path $IconDir "icon-128.png"))) {
    Write-Host "⚙️  Generando iconos desde SVG..."

    # Intentar con sharp (Node)
    $GenScript = Join-Path $ExtSrc "generate-icons.js"
    $NodeOk = $false
    try {
        Push-Location $ExtSrc
        $result = & node $GenScript 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host $result
            $NodeOk = $true
        }
        Pop-Location
    } catch { Pop-Location }

    if (-not $NodeOk) {
        # Fallback: copiar PNGs existentes del proyecto como iconos
        Write-Host "⚠️  sharp no disponible; copiando PNGs existentes como iconos..." -ForegroundColor Yellow
        if (-not (Test-Path $IconDir)) { New-Item -ItemType Directory -Path $IconDir | Out-Null }

        $src192 = Join-Path $PublicDir "web-app-manifest-192x192.png"
        $src96  = Join-Path $PublicDir "favicon-96x96.png"

        if (Test-Path $src192) {
            Copy-Item $src192 (Join-Path $IconDir "icon-128.png") -Force
            Copy-Item $src192 (Join-Path $IconDir "icon-48.png")  -Force
            Copy-Item $src192 (Join-Path $IconDir "icon-16.png")  -Force
            Write-Host "   ✅  Iconos copiados desde web-app-manifest-192x192.png"
        } elseif (Test-Path $src96) {
            Copy-Item $src96 (Join-Path $IconDir "icon-128.png") -Force
            Copy-Item $src96 (Join-Path $IconDir "icon-48.png")  -Force
            Copy-Item $src96 (Join-Path $IconDir "icon-16.png")  -Force
            Write-Host "   ✅  Iconos copiados desde favicon-96x96.png"
        } else {
            Write-Host "   ⚠️  No se encontraron PNGs de iconos. Agrega manualmente icons/icon-16.png, icons/icon-48.png, icons/icon-128.png" -ForegroundColor Red
        }
    }
} else {
    Write-Host "✅  Iconos ya existen, omitiendo generacion."
}

# ── 2. Crear directorio de build limpio ────────────────────────────────────
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
New-Item -ItemType Directory -Path $BuildDir | Out-Null
Write-Host "📁  Directorio de build: $BuildDir"

# ── 3. Copiar archivos de la extensión ─────────────────────────────────────
$FilesToCopy = @("manifest.json", "background.js", "content.js", "blocked.html")
foreach ($f in $FilesToCopy) {
    $src = Join-Path $ExtSrc $f
    Copy-Item $src (Join-Path $BuildDir $f) -Force
    Write-Host "   ✅  $f"
}

# Copiar carpeta icons/
$BuildIconDir = Join-Path $BuildDir "icons"
if (Test-Path $IconDir) {
    Copy-Item $IconDir $BuildIconDir -Recurse -Force
    Write-Host "   ✅  icons/"
} else {
    Write-Host "   ⚠️  Carpeta icons/ no encontrada. El ZIP no tendra iconos." -ForegroundColor Yellow
}

# ── 4. Crear ZIP ───────────────────────────────────────────────────────────
if (Test-Path $ZipOut) { Remove-Item $ZipOut -Force }
Compress-Archive -Path "$BuildDir\*" -DestinationPath $ZipOut -CompressionLevel Optimal
Write-Host "`n📦  ZIP creado: $ZipOut"

$size = [math]::Round((Get-Item $ZipOut).Length / 1KB, 1)
Write-Host "    Tamaño: $size KB"

# ── 5. Instrucciones ───────────────────────────────────────────────────────
Write-Host @"

─────────────────────────────────────────────────────
  ✅  Extension lista para subir al Chrome Web Store
─────────────────────────────────────────────────────
  Archivo: scolyax-extension.zip

  Próximos pasos:
  1. Paga la cuenta de desarrollador (USD 5, unica vez)
     → https://chrome.google.com/webstore/devconsole/register

  2. Entra al Developer Dashboard
     → https://chrome.google.com/webstore/devconsole

  3. Clic en "New Item" y sube scolyax-extension.zip

  4. Completa la ficha:
       · Descripción detallada
       · Capturas de pantalla (1280×800 o 640×400)
       · Ícono 128×128 del store (ya incluido en el ZIP)
       · URL de política de privacidad
         → https://scolyax.vercel.app/privacy-extension.html
       · Categoría: Productivity / Education

  5. Envía para revisión (normalmente 1-3 días hábiles)
─────────────────────────────────────────────────────
"@ -ForegroundColor Green
