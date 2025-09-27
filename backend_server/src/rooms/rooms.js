import { db } from '../db/db.js';
import { partidaCompetitiva, usuario, preguntas } from '../db/schemas/schemas.js';
import { eq, or, and, sql, isNull } from "drizzle-orm";
import { io } from '../../server2.js';
import { activeSockets } from '../../server2.js';
import crypto from 'crypto';

// ------------------------------------------------------------------------------------------------
// SISTEMA DE PARTIDAS ESTILO PREGUNTADOS
// ------------------------------------------------------------------------------------------------
// Gestión de salas, emparejamiento, preguntas y respuestas en tiempo real
// ------------------------------------------------------------------------------------------------

// Objeto que mantiene las partidas activas en memoria
export let ActiveGames = {};