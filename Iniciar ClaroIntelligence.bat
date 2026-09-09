@echo off
chcp 65001 > nul
title ClaroIntelligence - Iniciando...
powershell -ExecutionPolicy Bypass -File "%~dp0launch.ps1"
