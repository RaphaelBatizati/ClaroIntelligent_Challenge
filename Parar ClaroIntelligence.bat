@echo off
chcp 65001 > nul
title Parando ClaroIntelligence...

echo.
echo  Encerrando servidores ClaroIntelligence...

:: Matar processos nas portas 3001 e 5173
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| find ":3001 " ^| find "LISTEN"') do (
    echo  Parando API (PID %%p)...
    taskkill /PID %%p /F >nul 2>&1
)

for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| find ":5173 " ^| find "LISTEN"') do (
    echo  Parando Frontend (PID %%p)...
    taskkill /PID %%p /F >nul 2>&1
)

echo  Servidores encerrados.
timeout /t 2 /nobreak > nul
exit
