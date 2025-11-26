import { db } from '../db/db.js';
import { usuario, preguntas, mensajes, amistad, partidaCompetitiva } from '../db/schemas/schemas.js';
import { v4 as uuidv4 } from 'uuid';
import { eq, or } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// List all users (public fields only)
export async function listUsers(req, res) {
  try {
    const rows = await db.select().from(usuario);
    const users = (rows || []).map(u => ({ id: u.id, NombreUser: u.NombreUser, Correo: u.Correo, tipoUser: u.tipoUser || 'user' }));
    res.json({ users });
  } catch (err) {
    console.error('admin.listUsers error', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

// Delete a user by id
export async function deleteUser(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    // Authenticate requester via Bearer token
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });
    let requesterId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      requesterId = decoded.userId;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Load requester and target
    const reqRows = await db.select().from(usuario).where(eq(usuario.id, requesterId));
    if (reqRows.length === 0) return res.status(403).json({ error: 'Requester not found' });
    const requester = reqRows[0];
    if (requester.tipoUser !== 'admin') return res.status(403).json({ error: 'Only admins can delete users' });

    if (requesterId === id) return res.status(403).json({ error: 'Admins cannot delete themselves' });

    const targetRows = await db.select().from(usuario).where(eq(usuario.id, id));
    if (targetRows.length === 0) return res.status(404).json({ error: 'Target user not found' });
    const target = targetRows[0];
    if (target.tipoUser === 'admin') return res.status(403).json({ error: 'Cannot delete another admin' });

    // Borrar mensajes relacionados (emitidos o recibidos)
    await db.delete(mensajes).where(or(eq(mensajes.fromId, id), eq(mensajes.toId, id)));
    // Borrar partidas donde participó
    await db.delete(partidaCompetitiva).where(or(eq(partidaCompetitiva.Jugador1, id), eq(partidaCompetitiva.Jugador2, id)));
    // Borrar amistades donde figura (Remitente o Destinatario)
    await db.delete(amistad).where(or(eq(amistad.Remitente, id), eq(amistad.Destinatario, id)));

    // Borrar usuario
    await db.delete(usuario).where(eq(usuario.id, id));
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('admin.deleteUser error', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

// Create a question
export async function createQuestion(req, res) {
  try {
    const { pregunta, respuesta_correcta, respuesta_incorrecta1, respuesta_incorrecta2, respuesta_incorrecta3, tematica, dificultad } = req.body;
    if (!pregunta || !respuesta_correcta || !respuesta_incorrecta1 || !respuesta_incorrecta2 || !respuesta_incorrecta3 || !tematica || !dificultad) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const id = uuidv4();
    await db.insert(preguntas).values({ id, pregunta, respuesta_correcta, respuesta_incorrecta1, respuesta_incorrecta2, respuesta_incorrecta3, tematica, dificultad });
    res.json({ message: 'Question created', id });
  } catch (err) {
    console.error('admin.createQuestion error', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

// Delete a question by id
export async function deleteQuestion(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    await db.delete(preguntas).where(eq(preguntas.id, id));
    res.json({ message: 'Question deleted' });
  } catch (err) {
    console.error('admin.deleteQuestion error', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

// List questions (basic fields)
export async function listQuestions(req, res) {
  try {
    const rows = await db.select().from(preguntas).orderBy();
    const qs = (rows || []).map(q => ({ id: q.id, pregunta: q.pregunta, tematica: q.tematica, dificultad: q.dificultad }));
    res.json({ questions: qs });
  } catch (err) {
    console.error('admin.listQuestions error', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
