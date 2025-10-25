import './src/config/dotenv-config.js';
import { Server } from 'socket.io';
import http from 'http';
import { app } from './app.js';
import { authenticate } from './src/login/login.js';
import { findGame, cancelFindGame, receivePlayerResults } from './src/rooms/rooms.js';
import { createFriendRequest, acceptFriendRequestById, removeFriendByUsers } from './src/friendship/friends.js';
import { db } from './src/db/db.js';
import { amistad } from './src/db/schemas/schemas.js';
import { eq } from 'drizzle-orm';

// Objeto que almacenará los sockets con los usuarios conectados al servidor
export let activeSockets = new Map();

// Crear el servidor manualmente para poder utilizar WebSockets
export const server = http.createServer(app);
export const io = new Server(server, {
    cors: {
        origin: '*'
    },
    connectionStateRecovery: {
        // the backup duration of the sessions and the packets
        maxDisconnectionDuration: 2 * 60 * 1000,
        // whether to skip middlewares upon successful recovery
        skipMiddlewares: false
    }
})

const PORT = app.get('port');

// Iniciar el servidor en el puerto especificado
server.listen(PORT, () => {
    console.log(`Servidor corriendo en la direccion http://localhost:${PORT}`);
});

// -----------------------------------------------------------------------------------------------
// Función que se ejecuta cada vez que un nuevo cliente se conecta al servidor
// (manejo de conexiones y eventos)
// -----------------------------------------------------------------------------------------------
async function newConnection(socket) {
    // Nueva conexión vía webSocket
    console.log("Usuario conectado, id: " + socket.id)
    await authenticate(socket);

    // Aquí habrá que gestionar los posibles eventos/mensajes que nos pueden llegar del cliente
    console.log("Escuchando eventos...");

    // ------------------------------------------------------------------------------------------
    // Envío de heartbeats de forma periódica (cada 5 segundos) por parte del servidor
    // para asegurar que los sockets de los clientes no se desconecten por inactividad
    // ------------------------------------------------------------------------------------------
    setInterval(() => {
        io.emit('ping', { message: 'Ping!' });
    }, 5000);

    socket.on('pong', (data) => {
        console.log('Pong recibido!' + data.message);
    });

    // ------------------------------------------------------------------------------------------
    // Desconexión del cliente
    // ------------------------------------------------------------------------------------------
    socket.on('disconnect', async () => {
        console.log("Usuario desconectado")
        
        // Eliminar el socket del usuario desconectado del mapa
        for (let [userId, userSocket] of activeSockets.entries()) {
            if (userSocket.id === socket.id) {
                activeSockets.delete(userId);
                console.log(`Usuario ${userId} desconectado y eliminado de activeSockets`);
                break;
            }
        }
    });

    // ------------------------------------------------------------------------------------------
    // Eventos en tiempo real (partidas emparejadas)
    // ------------------------------------------------------------------------------------------

    // Evento para buscar una partida competitiva
    socket.on('buscarPartida', async (data) => {
        try {
            await findGame(socket, data);
        } catch (err) {
            console.error('Error en handler buscarPartida:', err);
            socket.emit('error', { message: 'Error interno al procesar buscarPartida' });
        }
    });

    socket.on('cancelarBusqueda', async (data) => {
        try {
            const idJugador = data.idJugador;
            cancelFindGame(socket, idJugador);
        } catch (err) {
            console.error('Error en handler cancelarBusqueda:', err);
            socket.emit('error', { message: 'Error interno al procesar cancelarBusqueda' });
        }
    });
    
    // ------------------------------------------------------------------------------------------
    // Eventos de amistad vía WebSocket
    // ------------------------------------------------------------------------------------------
    socket.on('friend:request', async (data) => {
        try {
            const fromId = data?.fromId;
            const toId = data?.toId;
            const result = await createFriendRequest(fromId, toId);
            socket.emit('friend:request:ok', result);
            // Notificar al destinatario si está conectado
            if (activeSockets.has(toId)) {
                const s = activeSockets.get(toId);
                s.emit('friend:incoming', { fromId, id: result.id });
            }
        } catch (err) {
            console.error('Error en friend:request', err);
            socket.emit('friend:error', { message: String(err) });
        }
    });

    socket.on('friend:accept', async (data) => {
        try {
            const requestId = data?.requestId;
            const accepterId = data?.accepterId;
            const result = await acceptFriendRequestById(requestId, accepterId);
            socket.emit('friend:accept:ok', result);
            // Notificar al remitente si está conectado
            const reqs = await db.select().from(amistad).where(eq(amistad.id, requestId));
            const req = reqs && reqs.length ? reqs[0] : null;
            if (req && activeSockets.has(req.Remitente)) {
                const s = activeSockets.get(req.Remitente);
                s.emit('friend:accepted', { by: accepterId, id: requestId });
            }
        } catch (err) {
            console.error('Error en friend:accept', err);
            socket.emit('friend:error', { message: String(err) });
        }
    });

    socket.on('friend:remove', async (data) => {
        try {
            const userA = data?.userA;
            const userB = data?.userB;
            const result = await removeFriendByUsers(userA, userB);
            socket.emit('friend:remove:ok', result);
            if (activeSockets.has(userB)) {
                const s = activeSockets.get(userB);
                s.emit('friend:removed', { by: userA });
            }
        } catch (err) {
            console.error('Error en friend:remove', err);
            socket.emit('friend:error', { message: String(err) });
        }
    });

    // Evento para recibir el informe final de aciertos desde el cliente
    socket.on('reportResults', async (data) => {
        try {
            const partidaId = data?.partidaId;
            const idJugador = data?.idJugador;
            const totalAciertos = data?.totalAciertos;
            await receivePlayerResults(partidaId, idJugador, totalAciertos);
        } catch (err) {
            console.error('Error en handler reportResults:', err);
            socket.emit('error', { message: 'Error interno al procesar reportResults' });
        }
    });
    // ------------------------------------------------------------------------------------------
}

// Escuchar eventos de conexión al servidor
io.on('connection', newConnection);
