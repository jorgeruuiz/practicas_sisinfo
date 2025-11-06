import EventEmitter from 'events';
import { eq } from 'drizzle-orm';

// Simple, encapsulated notifier module.
// Exports:
// - notifier: an EventEmitter that other modules (e.g. chat) can emit to.
// - initNotifier({ activeSockets, db, usuario }): initialize delivery handler.

export const notifier = new EventEmitter();

let _activeSockets = null;
let _db = null;
let _usuario = null;
let _initialized = false;

export function initNotifier({ activeSockets, db, usuario }) {
  if (_initialized) return;
  _initialized = true;
  _activeSockets = activeSockets;
  _db = db;
  _usuario = usuario;

  notifier.on('message:sent', async ({ id, fromId, toId, texto }) => {
    try {
      // Resolve sender name (best-effort)
      let senderName = null;
      try {
        const rows = await _db.select().from(_usuario).where(eq(_usuario.id, fromId));
        if (rows && rows.length) senderName = rows[0].NombreUser;
      } catch (e) {
        // ignore resolution errors
      }
      // debug: resolved sender name
      // console.debug('notifier: senderName resolved', { fromId, senderName });

      const payload = { from: { id: fromId, nombre: senderName }, text: texto, id };

      if (!_activeSockets) {
        // nothing to do
        return;
      }

      // Try to find recipient socket: match by socket.user.id (stringified) or map key equality
      let destSocket = null;

      // Fast-path: try map get with the provided id (if keys are stored as same type)
      try {
        destSocket = _activeSockets.get(toId);
      } catch (e) { /* ignore */ }

      // Fallback: iterate and match socket.user.id string equality
      if (!destSocket) {
        for (const [k, sock] of _activeSockets.entries()) {
          try {
            if (sock && sock.user && String(sock.user.id) === String(toId)) {
              destSocket = sock;
              break;
            }
          } catch (e) { /* ignore */ }
        }
      }

      if (destSocket) {
        // debug: indicate delivery
        // console.debug('notifier: delivering message', { id, fromId, toId, senderName, socketUserId: destSocket.user?.id });
        destSocket.emit('chat:message', payload);
      } else {
        // not connected — nothing to do for now
      }
    } catch (err) {
      console.error('notifications.handler error', err);
    }
  });
}

export default { notifier, initNotifier };