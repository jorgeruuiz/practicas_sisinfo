import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import fetch from 'node-fetch';
import { io } from 'socket.io-client';

async function runWithCredentials(NombreUser, Contrasena) {
  console.log('Iniciando login...');
  const res = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ NombreUser, Contrasena })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Login fallido:', err);
    process.exit(1);
  }

  const body = await res.json();
  const accessToken = body.accessToken;
  const publicUser = body.publicUser;

  if (!accessToken || !publicUser) {
    console.error('Respuesta de login no contiene accessToken/publicUser', body);
    process.exit(1);
  }

  console.log('Login OK, user id:', publicUser.id);

  // Conectar via socket.io con token en query
  const socket = io(`http://localhost:3000?token=${accessToken}`);

  socket.on('connect', () => {
    console.log('Socket conectado:', socket.id);
    // Emitir buscarPartida usando el id que nos dio el servidor
    socket.emit('buscarPartida', { idJugador: publicUser.id });
  });

  socket.on('partidaCreada', (d) => console.log('partidaCreada', d));
  socket.on('partidaEncontrada', (d) => console.log('partidaEncontrada', d));
  socket.on('error', (e) => console.log('socket error', e));

  socket.on('disconnect', () => {
    console.log('Socket desconectado');
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length >= 2) {
    const [NombreUser, Contrasena] = args;
    await runWithCredentials(NombreUser, Contrasena);
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    const NombreUser = await rl.question('NombreUser: ');
    const Contrasena = await rl.question('Contrasena: ');
    await runWithCredentials(NombreUser, Contrasena);
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Error en testClient:', err);
  process.exit(1);
});
