Simple test frontend for Cuestionados — migrated to React

This project now uses React + React Router and a small modular socket manager. The React app mounts in `index.html` and exposes two routes:

- /login -> login page
- /game  -> match UI (connects to backend via Socket.IO)

How to run (Windows PowerShell):

```powershell
cd frontend_web
npm install
npm run dev
# open http://localhost:5174 in your browser
```

Notes:
- The React pages reuse the existing auth helpers in `src/app.js` (which store the token and publicUser in localStorage).
- The socket wrapper is in `src/lib/socket.js` — it reads the token from localStorage and connects to the backend at http://localhost:3000.
- Legacy static scripts and pages are preserved under `src/legacy` and `game.legacy.html` for reference.

