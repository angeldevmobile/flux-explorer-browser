# build-backend.ps1
# Compila el backend Node.js en un ejecutable standalone (flux-backend.exe)
# y lo deja en flux-engine/bin/ para que el build de Rust lo bundle junto al browser.
#
# Requisitos: Node.js 18+ instalado (solo para compilar, el usuario final no necesita Node.js)
# Ejecutar: .\scripts\build-backend.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root "flux-backend"

Write-Host "=== Flux Backend Build ===" -ForegroundColor Cyan

# 1. Instalar dependencias
Write-Host "[1/4] Instalando dependencias..."
Push-Location $backend
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install falló" }

# 2. Generar Prisma client con binario de SQLite para Windows
Write-Host "[2/4] Generando Prisma client..."
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate falló" }

# 3. Compilar TypeScript
Write-Host "[3/4] Compilando TypeScript..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "tsc falló" }

# 4. Empaquetar con pkg → flux-backend.exe
Write-Host "[4/4] Empaquetando en exe standalone..."
npx @yao-pkg/pkg dist/index.js `
    --target node18-win-x64 `
    --output "../flux-engine/bin/flux-backend.exe" `
    --assets "node_modules/.prisma/client/query_engine*" `
    --compress GZip
if ($LASTEXITCODE -ne 0) { throw "pkg falló" }

Pop-Location

$size = [math]::Round((Get-Item "$root\flux-engine\bin\flux-backend.exe").Length / 1MB, 1)
Write-Host ""
Write-Host "flux-backend.exe listo ($size MB)" -ForegroundColor Green
Write-Host "Ahora compila el browser: cd flux-engine && cargo build --release --bin orion-browser"
