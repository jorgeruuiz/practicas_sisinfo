import { db } from '../db.js';
import { eq, like, or, desc, and, ne, sql } from 'drizzle-orm';
import { usuario, partidaCompetitiva, preguntas } from '../schemas/schemas.js';

// ------------------------------------------------------------------------------------------------
// FUNCIONES DE CONSULTA A LA BASE DE DATOS
// ------------------------------------------------------------------------------------------------
// Cada función realiza una consulta específica a la base de datos
// Utilizan Drizzle ORM para construir y ejecutar las consultas
// ------------------------------------------------------------------------------------------------