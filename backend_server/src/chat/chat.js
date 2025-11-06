import { db } from '../db/db.js';
import { mensajes, usuario, amistad } from '../db/schemas/schemas.js';
import { eq, or, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { notifier } from '../notifications/notifications.js';

// POST /chat/sendMessage
export async function sendMessage(req, res) {
  try {
    const { fromId, toId, texto } = req.body || {};
    if (!fromId || !toId || typeof texto !== 'string') return res.status(400).json({ error: 'Faltan campos' });

    // Verify users exist
    const from = await db.select().from(usuario).where(eq(usuario.id, fromId));
    const to = await db.select().from(usuario).where(eq(usuario.id, toId));
    if (from.length === 0 || to.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Verify friendship exists and accepted
    const rel = await db.select().from(amistad).where(or(
      and(eq(amistad.Remitente, fromId), eq(amistad.Destinatario, toId)),
      and(eq(amistad.Remitente, toId), eq(amistad.Destinatario, fromId))
    ));
    if (rel.length === 0 || !rel.some(r => r.Estado === 'accepted')) {
      return res.status(403).json({ error: 'Solo puedes enviar mensajes a amigos aceptados' });
    }

    const id = uuidv4();
    await db.insert(mensajes).values({ id, fromId, toId, texto, leido: 0 });
    const inserted = { id, fromId, toId, texto };
    // Emit internal notification so notifier can forward to connected sockets
    try {
      notifier.emit('message:sent', { id, fromId, toId, texto });
    } catch (e) {
      console.error('notifier.emit error', e);
    }
    return res.status(201).json({ ok: true, message: inserted });
  } catch (err) {
    console.error('sendMessage error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// GET /chat/thread?userA=...&userB=...&limit=50&offset=0
export async function listMessagesBetween(req, res) {
  try {
    const userA = req.query.userA;
    const userB = req.query.userB;
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    if (!userA || !userB) return res.status(400).json({ error: 'Missing users' });

    // Fetch messages where (from=userA and to=userB) or viceversa
    const rows = await db.select().from(mensajes).where(or(
      and(eq(mensajes.fromId, userA), eq(mensajes.toId, userB)),
      and(eq(mensajes.fromId, userB), eq(mensajes.toId, userA))
    )).orderBy(mensajes.created_at).limit(limit).offset(offset);

    return res.status(200).json({ ok: true, messages: rows });
  } catch (err) {
    console.error('listMessagesBetween error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// DELETE /chat/message/:id (requesterId in body for auth simple check)
export async function deleteMessage(req, res) {
  try {
    const id = req.params.id;
    const { requesterId } = req.body || {};
    if (!id || !requesterId) return res.status(400).json({ error: 'Faltan campos' });

    const rows = await db.select().from(mensajes).where(eq(mensajes.id, id));
    if (rows.length === 0) return res.status(404).json({ error: 'Mensaje no encontrado' });
    const msg = rows[0];
    if (msg.fromId !== requesterId) return res.status(403).json({ error: 'No autorizado' });

    await db.delete(mensajes).where(eq(mensajes.id, id));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('deleteMessage error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

export default { sendMessage, listMessagesBetween, deleteMessage };
