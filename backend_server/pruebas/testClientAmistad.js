import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

async function loginUser(nombre, contrasena) {
  const res = await fetch('http://localhost:8080/login', {
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

function attachFriendHandlers(socket, incomingRequests) {
  socket.on('friend:incoming', (d) => {
    console.log('[socket] friend:incoming', d);
    if (d && d.id) {
      incomingRequests.push(d);
    }
  });
  socket.on('friend:accepted', (d) => console.log('[socket] friend:accepted', d));
  socket.on('friend:removed', (d) => console.log('[socket] friend:removed', d));
  socket.on('friend:request:ok', (d) => console.log('[socket] friend:request:ok', d));
  socket.on('friend:accept:ok', (d) => console.log('[socket] friend:accept:ok', d));
  socket.on('friend:remove:ok', (d) => console.log('[socket] friend:remove:ok', d));
  socket.on('friend:error', (d) => console.error('[socket] friend:error', d));
}

async function interactiveClient() {
  const rl = readline.createInterface({ input, output });
  try {
    // Check CLI args first
    const args = process.argv.slice(2);
    let nombre, pass;
    if (args.length >= 2) {
      nombre = args[0];
      pass = args[1];
      console.log('Usando credenciales desde args');
    } else {
      nombre = await rl.question('NombreUser: ');
      pass = await rl.question('Contrasena: ');
    }
    console.log('Logueando...');
    const { accessToken, publicUser } = await loginUser(nombre, pass);
    console.log('Logueado:', publicUser.id, publicUser.NombreUser);

    const socket = io(`http://localhost:8080?token=${accessToken}`);
    const incomingRequests = [];
    attachFriendHandlers(socket, incomingRequests);

    await new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('[socket] conectado', socket.id);
        resolve();
      });
      socket.on('connect_error', (err) => {
        console.error('Socket connect_error', err);
      });
    });

    // Interactive loop
    while (true) {
      const cmd = (await rl.question('\nComando (send/accept/remove/list/quit): ')).trim();
      if (cmd === 'quit') break;

      if (cmd === 'send') {
        const targetName = await rl.question('Target NombreUser to send request: ');
        if (!targetName) { console.log('Target required'); continue; }
        try {
          const res = await fetch(`http://localhost:8080/user/byName?name=${encodeURIComponent(targetName)}`);
          if (!res.ok) { const e = await res.json().catch(()=>({})); console.error('Lookup failed', e); continue; }
          const body = await res.json();
          const targetId = body.id;
          socket.emit('friend:request', { fromId: publicUser.id, toId: targetId });
          console.log('Solicitud enviada a', targetName, '->', targetId);
        } catch (err) {
          console.error('Error fetching user', err);
        }
      } else if (cmd === 'accept') {
        if (incomingRequests.length === 0) {
          console.log('No incoming requests cached. Wait for friend:incoming events or use accept with requestId.');
          const id = await rl.question('Request id to accept (or empty to skip): ');
          if (!id) continue;
          socket.emit('friend:accept', { requestId: id, accepterId: publicUser.id });
        } else {
          console.log('Incoming requests:');
          incomingRequests.forEach((r, i) => console.log(i, r));
          const idx = await rl.question('Index to accept: ');
          const i = parseInt(idx, 10);
          if (Number.isNaN(i) || !incomingRequests[i]) { console.log('Invalid index'); continue; }
          const rid = incomingRequests[i].id;
          socket.emit('friend:accept', { requestId: rid, accepterId: publicUser.id });
          console.log('Aceptada request', rid);
        }
      } else if (cmd === 'remove') {
        const targetName = await rl.question('User NombreUser to remove friend: ');
        if (!targetName) { console.log('Target required'); continue; }
        try {
          const res = await fetch(`http://localhost:8080/user/byName?name=${encodeURIComponent(targetName)}`);
          if (!res.ok) { const e = await res.json().catch(()=>({})); console.error('Lookup failed', e); continue; }
          const body = await res.json();
          const targetId = body.id;
          socket.emit('friend:remove', { userA: publicUser.id, userB: targetId });
          console.log('Remove sent for', targetName, '->', targetId);
        } catch (err) {
          console.error('Error fetching user', err);
        }
      } else if (cmd === 'list') {
        console.log('Incoming requests cached:', incomingRequests);
      } else {
        console.log('Unknown command');
      }
    }

    socket.disconnect();
    console.log('Desconectado y saliendo');
  } finally {
    rl.close();
  }
}

interactiveClient().catch(err => {
  console.error('Error en testClientAmistad:', err);
  process.exitCode = 1;
});
