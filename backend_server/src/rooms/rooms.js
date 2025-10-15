import { db } from '../db/db.js';
import { partidaCompetitiva, usuario, preguntas } from '../db/schemas/schemas.js';
import { eq, or, and, sql, isNull } from "drizzle-orm";
import { io } from '../../server.js';
import { activeSockets } from '../../server.js';
import crypto from 'crypto';

// ------------------------------------------------------------------------------------------------
// SISTEMA DE PARTIDAS ESTILO PREGUNTADOS
// ------------------------------------------------------------------------------------------------
// Gestión de salas, emparejamiento, preguntas y respuestas en tiempo real
// ------------------------------------------------------------------------------------------------

// Objeto que mantiene las partidas activas en memoria
export let ActiveXObjects = {};

// Función para manejar la petición de búsqueda de partida competitiva por parte de un usuario
export async function findGame(socket, data) {
	try {
		// Exigimos solo `data.idJugador`. Sacamos el resto desde la BD (tabla usuario).
		const idJugador = data?.idJugador || null;

		if (!idJugador) {
			socket.emit('error', { message: 'Falta idJugador en data' });
			return null;
		}

		// Obtener usuario de la BD para sacar Puntuacion y EstadoPartida
		const usuarioRow = await db.select().from(usuario).where(eq(usuario.id, idJugador)).get();
		if (!usuarioRow) {
			socket.emit('error', { message: 'Usuario no encontrado en BD' });
			return null;
		}

		// Requerir que el usuario esté logueado y que no esté ya en una partida
		if (usuarioRow.estadoUser !== 'logged') {
			socket.emit('error', { message: 'Debes iniciar sesión (estado logged) para buscar partida' });
			return null;
		}

		if (usuarioRow.EstadoPartida !== null && usuarioRow.EstadoPartida !== '') {
			// Si tiene cualquier estado distinto de null/'' significa que está en proceso
			socket.emit('error', { message: 'Ya estás en una partida o en proceso de emparejamiento' });
			return null;
		}

		const puntuacion = usuarioRow.Puntuacion ?? 1200;

		// Intentar emparejar en una partida existente
		const idPartida = await pairing(idJugador, puntuacion);
		if (idPartida) {
			// Unirse a la partida encontrada
			await joinExistingGame(socket, idJugador, idPartida);
			return idPartida;
		}

		// No se encontró partida: crear nueva
		const newId = await createNewGame(socket, idJugador);
		return newId;

	} catch (error) {
		console.error('Error en findGame:', error);
		socket.emit('error', { message: 'Error interno al buscar partida' });
		return null;
	}
}

// Función auxiliar para manejar la creación de una nueva partida competitiva
export async function createNewGame(socket, idJugador) {
	try {
		if (!idJugador) {
			socket.emit('error', { message: 'Falta idJugador para crear partida' });
			return null;
		}

		const gameId = crypto.randomUUID();

		// Insertar partida en BD (Jugador2 queda null)
		await db.insert(partidaCompetitiva).values({
			id: gameId,
			Jugador1: idJugador,
			Jugador2: null,
			Ganador: null,
			Variacion_J1: 0,
			Variacion_J2: 0
		}).run();

		// Actualizar estado del usuario en BD
		await db.update(usuario).set({ EstadoPartida: 'pairing' }).where(eq(usuario.id, idJugador)).run();

		// Crear objeto en memoria
		ActiveXObjects[gameId] = {
			id: gameId,
			players: [idJugador],
			playerSockets: [socket.id],
			estado: 'esperando',
			preguntas: [],
			progresoJugadores: {},
			tiempoInicio: null
		};

		// Inicializar progreso del primer jugador
		ActiveXObjects[gameId].progresoJugadores[idJugador] = {
			preguntaActual: 0,
			respuestas: [],
			aciertos: 0,
			terminado: false,
			tiempoFinalizacion: null
		};

		// Unir socket a la sala
		socket.join(gameId);

		// Notificar al jugador
		socket.emit('partidaCreada', { partidaId: gameId, mensaje: 'Partida creada. Esperando oponente...' });

		console.log(`Partida creada ${gameId} por jugador ${idJugador}`);
		return gameId;

	} catch (error) {
		console.error('Error creando partida:', error);
		socket.emit('error', { message: 'Error interno creando partida' });
		return null;
	}
}

// Función auxiliar para manejar la unión a una partida competitiva existente
export async function joinExistingGame(socket, idJugador, gameId) {
	try {
		if (!idJugador) {
			socket.emit('error', { message: 'Falta idJugador para unirse a partida' });
			return null;
		}

		// Actualizar BD: establecer Jugador2
		await db.update(partidaCompetitiva).set({ Jugador2: idJugador }).where(eq(partidaCompetitiva.id, gameId)).run();

		// Actualizar estado del jugador
		await db.update(usuario).set({ EstadoPartida: 'ingame' }).where(eq(usuario.id, idJugador)).run();

		// Actualizar el objeto en memoria
		const partida = ActiveXObjects[gameId];
		if (partida) {
			partida.players.push(idJugador);
			partida.playerSockets.push(socket.id);
			partida.estado = 'en_progreso';

			partida.progresoJugadores[idJugador] = {
				preguntaActual: 0,
				respuestas: [],
				aciertos: 0,
				terminado: false,
				tiempoFinalizacion: null
			};
		}

		// Unir al socket a la sala
		socket.join(gameId);

		// Asegurar que todos los sockets registrados en `playerSockets` están unidos a la sala
		if (partida && Array.isArray(partida.playerSockets)) {
			for (const sid of partida.playerSockets) {
				try {
					const s = io.sockets.sockets.get(sid);
					if (s) s.join(gameId);
				} catch (err) {
					// Ignorar si el socket ya no existe
					console.debug(`No se pudo unir socket ${sid} a la sala ${gameId}:`, err?.message || err);
				}
			}
		}

		// Notificar a ambos jugadores que la partida está lista
		io.to(gameId).emit('partidaEncontrada', { partidaId: gameId, jugadores: partida?.players || [] });

		console.log(`Jugador ${idJugador} unido a la partida ${gameId}`);
		return gameId;

	} catch (error) {
		console.error('Error uniendo jugador a partida:', error);
		socket.emit('error', { message: 'Error interno al unirse a la partida' });
		return null;
	}
}

// Función auxiliar que permite buscar partidas existentes donde sea posible emparejar a un nuevo
// jugador, siendo posible el emparejamiento por ELO (similar nivel)
export async function pairing(idJugador, puntuacionBuscador) {
	try {
		if (!idJugador || puntuacionBuscador === undefined) {
			return null;
		}

		const limiteElo = 200; // umbral razonable

		// Buscar partidas pendientes (Jugador2 IS NULL)
		const partidasPendientes = await db.select().from(partidaCompetitiva).where(isNull(partidaCompetitiva.Jugador2)).all();

		for (const p of partidasPendientes) {
			if (!p.Jugador1) continue;
			// Obtener info del jugador1
			const j1 = await db.select().from(usuario).where(eq(usuario.id, p.Jugador1)).get();
			if (!j1) continue;

			const diff = Math.abs((j1.Puntuacion || 1200) - (puntuacionBuscador || 1200));
			if (diff <= limiteElo) {
				// Devolver primera partida compatible
				return p.id;
			}
		}

		return null;

	} catch (error) {
		console.error('Error en pairing:', error);
		return null;
	}
}