import { db } from '../db.js';
import { eq, like, or, desc, and, ne, sql } from 'drizzle-orm';
import { usuario, partidaCompetitiva, preguntas } from '../schemas/schemas.js';

// FUNCIONES DE CONSULTA A LA BASE DE DATOS
// ------------------------------------------------------------------------------------------------
// Cada función realiza una consulta específica a la base de datos
// Utilizan Drizzle ORM para construir y ejecutar las consultas
// ------------------------------------------------------------------------------------------------

// ------------------------------------------------------------------------------------------------
// Obtener usuario por NombreUser
export async function getUserByNombreUser(name) {
	if (!name) throw new Error('Missing name');
	const rows = await db.select().from(usuario).where(eq(usuario.NombreUser, name));
	if (rows.length === 0) return null;
	return rows[0];
}
// ------------------------------------------------------------------------------------------------