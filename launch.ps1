# ClaroIntelligence — Launcher Script
param([switch]$Quiet)

$apiDir = Join-Path $PSScriptRoot "clarointelligence-api"
$feDir  = Join-Path $PSScriptRoot "clarointelligence"

function Write-Header {
    Write-Host ""
    Write-Host "  ==========================================" -ForegroundColor Cyan
    Write-Host "   claro. intelligence  |  Sprint 3 MVP" -ForegroundColor White
    Write-Host "  ==========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Port($port) {
    $conn = netstat -ano 2>$null | Select-String ":$port\s.*LISTEN"
    return $conn.Count -gt 0
}

Write-Header

# Verificar Node.js
try { $ver = node --version 2>&1; Write-Host "  Node.js $ver detectado." -ForegroundColor Green }
catch { Write-Host "  [ERRO] Node.js nao encontrado. Instale em https://nodejs.org" -ForegroundColor Red; Read-Host "Pressione Enter"; exit 1 }

# Instalar deps backend se necessário
if (-not (Test-Path "$apiDir\node_modules")) {
    Write-Host "  Instalando dependencias do backend (unica vez)..." -ForegroundColor Yellow
    Push-Location $apiDir; npm install --silent; Pop-Location
}

# Seed se banco não existe
if (-not (Test-Path "$apiDir\clarointelligence.sqlite")) {
    Write-Host "  Configurando banco de dados..." -ForegroundColor Yellow
    Push-Location $apiDir
    node --experimental-sqlite src/seed.js
    Pop-Location
    Write-Host "  Banco configurado com 4 roteiros de demo." -ForegroundColor Green
}

# Iniciar backend
if (Test-Port 3001) {
    Write-Host "  API ja esta rodando na porta 3001." -ForegroundColor Green
} else {
    Write-Host "  Iniciando API (porta 3001)..." -ForegroundColor Cyan
    Start-Process "cmd.exe" -ArgumentList "/k", "title ClaroIntelligence API && cd /d `"$apiDir`" && npm run server" -WindowStyle Normal
    Start-Sleep -Seconds 4
}

# Instalar deps frontend se necessário
if (-not (Test-Path "$feDir\node_modules")) {
    Write-Host "  Instalando dependencias do frontend (unica vez)..." -ForegroundColor Yellow
    Push-Location $feDir; npm install --silent; Pop-Location
}

# Iniciar frontend
if (Test-Port 5173) {
    Write-Host "  Frontend ja esta rodando na porta 5173." -ForegroundColor Green
} else {
    Write-Host "  Iniciando Frontend (porta 5173)..." -ForegroundColor Cyan
    Start-Process "cmd.exe" -ArgumentList "/k", "title ClaroIntelligence Frontend && cd /d `"$feDir`" && npm run dev" -WindowStyle Normal
    Write-Host "  Aguardando Vite inicializar..." -ForegroundColor Gray
    Start-Sleep -Seconds 9
}

# Abrir navegador
Write-Host "  Abrindo navegador em http://localhost:5173/chat" -ForegroundColor Cyan
Start-Process "http://localhost:5173/chat"

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "   Sistema iniciado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "   Dashboard  : http://localhost:5173" -ForegroundColor White
Write-Host "   Chat Demo  : http://localhost:5173/chat" -ForegroundColor White
Write-Host "   API Health : http://localhost:3001/api/health" -ForegroundColor White
Write-Host ""
Write-Host "   Para encerrar: feche as janelas de servidor" -ForegroundColor Gray
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""
Start-Sleep -Seconds 4
