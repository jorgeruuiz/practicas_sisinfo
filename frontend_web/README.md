Simple test frontend for Cuestionados

Files:
- index.html -> login page (stores token in localStorage)
- game.html -> simple UI to connect socket and search for a match

How to run:
1. Start the backend server (must be running on http://localhost:3000)
2. Install dependencies and run Vite dev server (recommended):

```powershell
cd frontend_web
npm install
npm run dev
# open http://localhost:5174 (Vite dev server)
```

The login page auto-redirects to the game UI if a valid token is present in localStorage.

Notes:
- This is a minimal test UI. It uses Socket.IO client from CDN and the login endpoint from the backend.
