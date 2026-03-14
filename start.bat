@echo off
title BarOS V4 — Launcher
color 0A

echo.
echo  ██████╗  █████╗ ██████╗  ██████╗ ███████╗
echo  ██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██╔════╝
echo  ██████╔╝███████║██████╔╝██║   ██║███████╗
echo  ██╔══██╗██╔══██║██╔══██╗██║   ██║╚════██║
echo  ██████╔╝██║  ██║██║  ██║╚██████╔╝███████║
echo  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
echo                        V4 — DEV LAUNCHER
echo.
echo  [1/3] Backend FastAPI...
echo  [2/3] Frontend Vite...
echo  [3/3] Stripe Webhook Listener...
echo.

:: ── Charger les variables d'environnement depuis .env ──────────────────────
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        set "%%A=%%B"
    )
)

:: ── 1. Backend FastAPI ──────────────────────────────────────────────────────
start "BarOS — Backend" cmd /k "color 0B && echo [BACKEND] Demarrage FastAPI... && cd /d %~dp0 && call venv\Scripts\activate && uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"
:: Petite pause pour laisser le backend démarrer avant le frontend
timeout /t 2 /nobreak >nul

:: ── 2. Frontend Vite ────────────────────────────────────────────────────────
start "BarOS — Frontend" cmd /k "color 0D && echo [FRONTEND] Demarrage Vite... && cd /d %~dp0\frontend && npm run dev"

:: ── 3. Stripe CLI ───────────────────────────────────────────────────────────
start "BarOS — Stripe" cmd /k "color 0E && echo [STRIPE] Webhook listener... && stripe listen --forward-to localhost.1.12:8000/api/payments/webhook"

:: ── Ouvrir le navigateur après 4 secondes ──────────────────────────────────
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo.
echo  ✅  BarOS est lancé !
echo  • Backend  : http://localhost.1.12:8000
echo  • Frontend : http://localhost:5173
echo  • API Docs : http://localhost.1.12:8000/docs
echo.
echo  Ferme cette fenetre pour tout garder ouvert.
echo  Pour arreter : ferme les 3 fenetres de terminal.
echo.
pause