import { saveAuth } from './app.js';

const status = document.getElementById('status');
const btn = document.getElementById('btnLogin');

btn.addEventListener('click', async () => {
  const NombreUser = document.getElementById('username').value.trim();
  const Contrasena = document.getElementById('password').value.trim();
  if (!NombreUser || !Contrasena) { status.innerText = 'Rellena ambos campos'; return; }
  status.innerText = 'Logging...';
  try {
    const res = await fetch('http://localhost:3000/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ NombreUser, Contrasena })
    });
    const j = await res.json();
    if (!res.ok) { status.innerText = 'Login error: ' + JSON.stringify(j); return; }
    saveAuth(j.accessToken, j.publicUser);
    window.location = 'game.html';
  } catch (err) { status.innerText = 'Fetch error: ' + err; }
});
