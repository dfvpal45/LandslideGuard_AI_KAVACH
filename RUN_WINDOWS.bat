@echo off
echo Starting LandslideGuard AI backend...
start "LandslideGuard Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"
timeout /t 3 >nul
echo Starting LandslideGuard AI frontend...
start "LandslideGuard Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo Open http://localhost:5173 after Vite starts.
pause
