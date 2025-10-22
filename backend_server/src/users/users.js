import { db } from '../db/db.js';
import { usuario } from '../db/schemas/schemas.js';
import { eq } from 'drizzle-orm';

export async function getUserByNameHandler(req, res) {
  try {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'Missing name query' });
    const rows = await db.select().from(usuario).where(eq(usuario.NombreUser, name));
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'User not found' });
    // return public info
    const u = rows[0];
    return res.status(200).json({ id: u.id, NombreUser: u.NombreUser, Puntuacion: u.Puntuacion });
  } catch (err) {
    console.error('getUserByNameHandler error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

export default { getUserByNameHandler };
