import { db } from '../src/db/db.js';
import { usuario, amistad } from '../src/db/schemas/schemas.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';
import { io as Client } from 'socket.io-client';

const BASE = 'http://localhost:3000';

async function ensureUser(nombre, correo) {
  const found = await db.select().from(usuario).where(eq(usuario.Correo, correo));
  if (found.length > 0) return found[0];
  const id = uuidv4();
  const hashed = await bcrypt.hash('test1234', 10);
  await db.insert(usuario).values({
    id,
    FotoPerfil: null,
    NombreUser: nombre,
    Correo: correo,
    Contrasena: hashed,
    estadoUser: 'unlogged',
    correoVerificado: 'yes'
  });
  const users = await db.select().from(usuario).where(eq(usuario.id, id));
  return users[0];
}

async function loginAndGetToken(nombre, passwd) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ NombreUser: nombre, Contrasena: passwd })
  });
  if (!res.ok) throw new Error('Login failed');
  const j = await res.json();
  return j.accessToken;
}

async function run() {
  try {
    const alice = await ensureUser('alice_socket', 'alice_socket@example.com');
    const bob = await ensureUser('bob_socket', 'bob_socket@example.com');

    const tokenA = await loginAndGetToken(alice.NombreUser, 'test1234');
    const tokenB = await loginAndGetToken(bob.NombreUser, 'test1234');

    // Connect sockets with token in query
    const socketA = Client(BASE, { query: { token: tokenA } });
    const socketB = Client(BASE, { query: { token: tokenB } });

    await new Promise((resolve, reject) => {
      let events = 0;
      socketA.on('connect', () => { events++; if (events === 2) resolve(); });
      socketB.on('connect', () => { events++; if (events === 2) resolve(); });
      setTimeout(() => reject(new Error('Sockets failed to connect')), 5000);
    });

    console.log('Sockets conectados');

    // Listen for incoming notifications on Bob
    let incoming = null;
    socketB.on('friend:incoming', (data) => {
      console.log('Bob received incoming', data);
      incoming = data;
    });

    // Alice sends friend request to Bob
    socketA.emit('friend:request', { fromId: alice.id, toId: bob.id });

    // Wait for notification and DB entry
    await new Promise((resolve, reject) => {
      const start = Date.now();
      const iv = setInterval(async () => {
        if (incoming) {
          clearInterval(iv);
          // check DB row
          const rows = await db.select().from(amistad).where(eq(amistad.Remitente, alice.id));
          if (rows.length === 0) return reject(new Error('No friendship row'));
          resolve(rows[0]);
        } else if (Date.now() - start > 5000) {
          clearInterval(iv); reject(new Error('Timeout waiting incoming'));
        }
      }, 200);
    }).then(async (row) => {
      console.log('Solicitud creada en BD', row.id);
      // Bob accepts
      socketB.emit('friend:accept', { requestId: row.id, accepterId: bob.id });
      // wait DB update
      await new Promise((resolve, reject) => {
        const start = Date.now();
        const iv = setInterval(async () => {
          const r = await db.select().from(amistad).where(eq(amistad.id, row.id));
          if (r.length && r[0].Estado === 'accepted') { clearInterval(iv); resolve(); }
          if (Date.now() - start > 5000) { clearInterval(iv); reject(new Error('Timeout waiting accepted')); }
        }, 200);
      });
      console.log('Solicitud aceptada correctamente');
    });

    socketA.disconnect(); socketB.disconnect();
    console.log('Test sockets OK');
    process.exit(0);
  } catch (err) {
    console.error('Socket test error:', err);
    process.exit(1);
  }
}

run();
