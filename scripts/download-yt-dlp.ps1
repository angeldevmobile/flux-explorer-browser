# download-yt-dlp.ps1
# Descarga yt-dlp.exe en flux-engine/bin/ para bundlearlo con Flux Browser.
# Ejecutar una sola vez antes de compilar: .\scripts\download-yt-dlp.ps1

$ErrorActionPreference = "Stop"

$dest = Join-Path $PSScriptRoot "..\flux-engine\bin\yt-dlp.exe"
$dest = [System.IO.Path]::GetFullPath($dest)
$url  = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"

Write-Host "Descargando yt-dlp.exe..."
Write-Host "Destino: $dest"

$dir = Split-Path $dest
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing

$size = (Get-Item $dest).Length / 1MB
Write-Host "Listo. yt-dlp.exe descargado ($([math]::Round($size,1)) MB)"
Write-Host "Ahora compila con: cd flux-engine && cargo build --release --bin orion-browser"
