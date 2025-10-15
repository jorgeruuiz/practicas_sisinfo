import { db } from '../db/db.js';
import { amistad, usuario } from '../db/schemas/schemas.js';
import { eq, or, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// -- Funciones para la gestión de amistad ----------------------------------------------------
export async function createFriendRequest(fromId, toId) {
    if (!fromId || !toId) throw new Error('Faltan campos');
    if (fromId === toId) throw new Error('No puedes enviarte solicitud a ti mismo');

    const remitente = await db.select().from(usuario).where(eq(usuario.id, fromId));
    const destinatario = await db.select().from(usuario).where(eq(usuario.id, toId));
    if (remitente.length === 0 || destinatario.length === 0) throw new Error('Usuario no encontrado');

    const existing = await db.select().from(amistad).where(or(
        and(eq(amistad.Remitente, fromId), eq(amistad.Destinatario, toId)),
        and(eq(amistad.Remitente, toId), eq(amistad.Destinatario, fromId))
    ));
    if (existing.length > 0) throw new Error('Ya existe una solicitud o amistad entre estos usuarios');

    const id = uuidv4();
    await db.insert(amistad).values({ id, Remitente: fromId, Destinatario: toId, Estado: 'pending' });
    return { id };
}

export async function acceptFriendRequestById(requestId, accepterId) {
    if (!requestId || !accepterId) throw new Error('Faltan campos');
    const requests = await db.select().from(amistad).where(eq(amistad.id, requestId));
    if (requests.length === 0) throw new Error('Solicitud no encontrada');
    const request = requests[0];
    if (request.Destinatario !== accepterId) throw new Error('No autorizado');
    await db.update(amistad).set({ Estado: 'accepted' }).where(eq(amistad.id, requestId));
    return { id: requestId };
}

export async function removeFriendByUsers(userA, userB) {
    if (!userA || !userB) throw new Error('Faltan campos');
    await db.delete(amistad).where(or(
        and(eq(amistad.Remitente, userA), eq(amistad.Destinatario, userB)),
        and(eq(amistad.Remitente, userB), eq(amistad.Destinatario, userA))
    ));
    return { message: 'Eliminado' };
}

export async function getFriendsForUser(userId) {
    if (!userId) throw new Error('Falta id');
    const rels = await db.select().from(amistad).where(or(eq(amistad.Remitente, userId), eq(amistad.Destinatario, userId)));
    const friends = rels.filter(r => r.Estado === 'accepted').map(r => (r.Remitente === userId ? r.Destinatario : r.Remitente));
    return friends;
}

