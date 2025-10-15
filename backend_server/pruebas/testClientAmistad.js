import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

async function loginUser(nombre, contrasena) {
  const res = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ NombreUser: nombre, Contrasena: contrasena })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Login fallido: ' + JSON.stringify(err));
  }
  const body = await res.json();
  return { accessToken: body.accessToken, publicUser: body.publicUser };
}

function attachFriendHandlers(socket, label) {
  socket.on('friend:incoming', (d) => console.log(`[${label}] friend:incoming`, d));
  socket.on('friend:accepted', (d) => console.log(`[${label}] friend:accepted`, d));
  socket.on('friend:removed', (d) => console.log(`[${label}] friend:removed`, d));
  socket.on('friend:request:ok', (d) => console.log(`[${label}] friend:request:ok`, d));
  socket.on('friend:accept:ok', (d) => console.log(`[${label}] friend:accept:ok`, d));
  socket.on('friend:remove:ok', (d) => console.log(`[${label}] friend:remove:ok`, d));
  socket.on('friend:error', (d) => console.error(`[${label}] friend:error`, d));
}

async function runFlow(aCreds, bCreds) {
  console.log('Logueando usuarios...');
  const a = await loginUser(aCreds.nombre, aCreds.pass);
  const b = await loginUser(bCreds.nombre, bCreds.pass);
  console.log('Usuarios logueados:', a.publicUser.id, b.publicUser.id);

  const socketA = io(`http://localhost:3000?token=${a.accessToken}`);
  const socketB = io(`http://localhost:3000?token=${b.accessToken}`);

  attachFriendHandlers(socketA, 'A');
  attachFriendHandlers(socketB, 'B');

  await new Promise((resolve) => {
    let connected = 0;
    const onConnected = () => { connected += 1; if (connected === 2) resolve(); };
    socketA.on('connect', () => { console.log('[A] conectado', socketA.id); onConnected(); });
    socketB.on('connect', () => { console.log('[B] conectado', socketB.id); onConnected(); });
  });

  // A envia solicitud a B
  console.log('[A] Enviando friend:request');
  socketA.emit('friend:request', { fromId: a.publicUser.id, toId: b.publicUser.id });

  // Esperar a que B reciba friend:incoming (llegará desde servidor) y tomar el id
  let requestId = null;
  const incomingHandler = (d) => {
    if (d && d.fromId === a.publicUser.id && d.id) {
      requestId = d.id;
      console.log('[B] Capturado requestId:', requestId);
    }
  };
  socketB.on('friend:incoming', incomingHandler);

  // También capturar friend:request:ok en A para obtener id (fallback)
  socketA.on('friend:request:ok', (d) => {
    if (!requestId && d && d.id) {
      requestId = d.id;
      console.log('[A] Capturado requestId desde request:ok:', requestId);
    }
  });

  // Esperar un pequeño tiempo a tener el requestId
  await new Promise(r => setTimeout(r, 1200));

  if (!requestId) {
    console.error('No se obtuvo requestId, abortando');
  } else {
    // B acepta la solicitud
    console.log('[B] Aceptando solicitud');
    socketB.emit('friend:accept', { requestId, accepterId: b.publicUser.id });

    // Esperar un poco para que se propague
    await new Promise(r => setTimeout(r, 1000));

    // Ahora A elimina la amistad
    console.log('[A] Eliminando amistad');
    socketA.emit('friend:remove', { userA: a.publicUser.id, userB: b.publicUser.id });

    await new Promise(r => setTimeout(r, 1000));
  }

  // Cerrar sockets
  socketA.disconnect();
  socketB.disconnect();
  console.log('Flujo completado y sockets desconectados');
}

async function main() {
  const args = process.argv.slice(2);
  let aCreds, bCreds;
  if (args.length >= 4) {
    aCreds = { nombre: args[0], pass: args[1] };
    bCreds = { nombre: args[2], pass: args[3] };
  } else {
    const rl = readline.createInterface({ input, output });
    try {
      const aName = await rl.question('Usuario A (NombreUser): ');
      const aPass = await rl.question('Usuario A (Contrasena): ');
      const bName = await rl.question('Usuario B (NombreUser): ');
      const bPass = await rl.question('Usuario B (Contrasena): ');
      aCreds = { nombre: aName, pass: aPass };
      bCreds = { nombre: bName, pass: bPass };
    } finally {
      rl.close();
    }
  }

  try {
    await runFlow(aCreds, bCreds);
  } catch (err) {
    console.error('Error en testClientAmistad:', err);
    process.exitCode = 1;
  }
}

main();
