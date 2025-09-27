import { db } from '../db/db.js';
import { partidaCompetitiva, usuario } from '../db/schemas/schemas.js';
import { eq, or, and, sql, isNull } from "drizzle-orm";
import { io } from '../../server.js';
import crypto from 'crypto';

// Tenemos que crear un objeto que mantenga las partidas activas en memoria
export let ActiveXObjects = {};
import { activeSockets } from '../../server.js';

