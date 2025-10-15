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

        if (usuarioRow.EstadoPartida === 'pairing' || usuarioRow.EstadoPartida === 'ingame') {
            // Si está emparejando o en partida, no puede buscar otra
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
			preguntas: undefined,
			totalPreguntas: 0,
			totalAciertos: {},
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

		// Actualizar el objeto en memoria
		const partida = ActiveXObjects[gameId];
		if (partida) {
			partida.players.push(idJugador);
			partida.playerSockets.push(socket.id);
			partida.estado = 'en_progreso';
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

        // Actualizar estado de ambos jugadores en BD
        for (const pid of partida?.players || []) {
            try {
                await db.update(usuario).set({ EstadoPartida: 'ingame' }).where(eq(usuario.id, pid)).run();
            } catch (e) {
                console.warn('No se pudo actualizar EstadoPartida para', pid, e?.message || e);
            }
        }
		console.log(`Jugador ${idJugador} unido a la partida ${gameId}`);

        // Enviar preguntas a ambos jugadores
        await sendQuestionsToPlayers(gameId);
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

// Función para obtener 10 preguntas aleatorias de la base de datos y enviarlas a los jugadores
// de una partida lista para comenzar
export async function sendQuestionsToPlayers(partidaId) {
	try {
		const partida = ActiveXObjects[partidaId];
		if (!partida) {
			console.error('sendQuestionsToPlayers: partida no encontrada', partidaId);
			return null;
		}

		// Obtener hasta 10 preguntas aleatorias
		const rows = await db.select({
			id: preguntas.id,
			pregunta: preguntas.pregunta,
			respuesta_correcta: preguntas.respuesta_correcta,
			respuesta_incorrecta1: preguntas.respuesta_incorrecta1,
			respuesta_incorrecta2: preguntas.respuesta_incorrecta2,
			respuesta_incorrecta3: preguntas.respuesta_incorrecta3,
			tematica: preguntas.tematica,
			dificultad: preguntas.dificultad
		}).from(preguntas).orderBy(sql`RANDOM()`).limit(10).all();

		if (!rows || rows.length === 0) {
			console.warn('No hay preguntas disponibles en la BD');
			io.to(partidaId).emit('error', { message: 'No hay preguntas disponibles' });
			return null;
		}

		// Preparar preguntas para enviar (no las mantenemos en memoria en el servidor,
		// solo guardamos el número total de preguntas para controlar el progreso)
		const prepared = rows.map(r => ({
			id: r.id,
			pregunta: r.pregunta,
			respuesta_correcta: r.respuesta_correcta,
			respuesta_incorrecta1: r.respuesta_incorrecta1,
			respuesta_incorrecta2: r.respuesta_incorrecta2,
			respuesta_incorrecta3: r.respuesta_incorrecta3,
			tematica: r.tematica,
			dificultad: r.dificultad
		}));
		// No almacenar preguntas completas en memoria para economizar; almacenar solo el total
		partida.totalPreguntas = prepared.length;
		partida.preguntas = undefined;
		partida.estado = 'en_progreso';

		// Emitir preguntas tal cual (el frontend se encargará de mezclar/ocultar la correcta y de la gestión de tiempo)
		io.to(partidaId).emit('partidaLista', { partidaId, preguntas: prepared });

		console.log(`Se enviaron ${prepared.length} preguntas a la partida ${partidaId}`);
		return prepared.length;

	} catch (error) {
		console.error('Error en sendQuestionsToPlayers:', error);
		try { io.to(partidaId).emit('error', { message: 'Error obteniendo preguntas' }); } catch(_) {}
		return null;
	}
}

// Función para recibir y procesar las respuestas de los jugadores de una partida
export async function receivePlayerResults(partidaId, idJugador, totalAciertos) {
    try {
        if (!partidaId || !idJugador || totalAciertos === undefined) {
            console.warn('receivePlayerAnswers: datos incompletos');
            return false;
        }

        const partida = ActiveXObjects[partidaId];
        if (!partida) {
            console.warn('receivePlayerAnswers: partida no encontrada', partidaId);
            return false;
        }

        if (!partida.players.includes(idJugador)) {
            console.warn('receivePlayerAnswers: jugador no en la partida', idJugador, partidaId);
            return false;
        }

        // Actualizar totalAciertos para el jugador
        partida.totalAciertos[idJugador] = totalAciertos;        

        // comprobar si ya han reportado todos los jugadores; si es así, finalizar la partida
        const players = partida.players || [];
        const allReported = players.length >= 2 && players.every(pid => typeof partida.totalAciertos[pid] === 'number');
        if (allReported) {
            try {
                await finalizeGame(partidaId);
            } catch (err) {
                console.error('Error al finalizar partida tras reportes:', err);
            }
        }

    } catch (error) {
        console.error('Error en receivePlayerAnswers:', error);
        return false;
    }
    return true;
}

// Función para determinar el ganador de una partida y actualizar la base de datos con las nuevas
// puntuaciones de los jugadores según el sistema ELO
export async function finalizeGame(partidaId) {
	try {
		const partida = ActiveXObjects[partidaId];
		if (!partida) {
			console.error('finalizeGame: partida no encontrada', partidaId);
			return false;
		}

		// Allow finalizing even if estado differs; user logic controls when to call finalizeGame
		const players = partida.players || [];
		if (players.length < 2) {
			console.warn('finalizeGame: menos de 2 jugadores en la partida', partidaId);
			return false;
		}

		const idJ1 = players[0];
		const idJ2 = players[1];

		const aciertosJ1 = Number(partida.totalAciertos[idJ1] || 0);
		const aciertosJ2 = Number(partida.totalAciertos[idJ2] || 0);

		// Determinar ganador por aciertos. Empate => null
		let ganador = null;
		if (aciertosJ1 > aciertosJ2) ganador = idJ1;
		else if (aciertosJ2 > aciertosJ1) ganador = idJ2;

		// Obtener puntuaciones actuales en BD
		const user1 = await db.select().from(usuario).where(eq(usuario.id, idJ1)).get();
		const user2 = await db.select().from(usuario).where(eq(usuario.id, idJ2)).get();
		const score1 = user1?.Puntuacion ?? 1200;
		const score2 = user2?.Puntuacion ?? 1200;

		const expected1 = 1 / (1 + Math.pow(10, (score2 - score1) / 400));
		const expected2 = 1 / (1 + Math.pow(10, (score1 - score2) / 400));

		let s1 = 0.5, s2 = 0.5;
		if (ganador === idJ1) { s1 = 1; s2 = 0; }
		else if (ganador === idJ2) { s1 = 0; s2 = 1; }

		const K = 20; // factor de ajuste
		const delta1 = Math.round(K * (s1 - expected1));
		const delta2 = Math.round(K * (s2 - expected2));

		// Actualizar partidaCompetitiva en BD
		try {
			await db.update(partidaCompetitiva).set({
				Ganador: ganador,
				Variacion_J1: delta1,
				Variacion_J2: delta2
			}).where(eq(partidaCompetitiva.id, partidaId)).run();
		} catch (e) {
			console.warn('finalizeGame: error actualizando partidaCompetitiva', e?.message || e);
		}

		// Actualizar usuarios en BD: puntuación y EstadoPartida
		try {
			await db.update(usuario).set({ Puntuacion: score1 + delta1, EstadoPartida: null }).where(eq(usuario.id, idJ1)).run();
		} catch (e) { console.warn('finalizeGame: error actualizando usuario1', e?.message || e); }
		try {
			await db.update(usuario).set({ Puntuacion: score2 + delta2, EstadoPartida: null }).where(eq(usuario.id, idJ2)).run();
		} catch (e) { console.warn('finalizeGame: error actualizando usuario2', e?.message || e); }

		// Emitir evento de finalización con resumen
		const summary = {
			partidaId,
			totalPreguntas: partida.totalPreguntas || 0,
			jugadores: [
				{ id: idJ1, reportedAciertos: aciertosJ1, variacion: delta1, nuevaPuntuacion: score1 + delta1 },
				{ id: idJ2, reportedAciertos: aciertosJ2, variacion: delta2, nuevaPuntuacion: score2 + delta2 }
			],
			ganador
		};

		try { io.to(partidaId).emit('partidaFinalizada', summary); } catch (e) { /* ignore */ }

		partida.estado = 'finalizada';
		console.log('finalizeGame: partida finalizada', partidaId, summary);

        // Limpiar memoria
        delete ActiveXObjects[partidaId];

        // Devolver resumen
		return summary;

	} catch (error) {
		console.error('Error en finalizeGame:', error);
		return false;
	}

}