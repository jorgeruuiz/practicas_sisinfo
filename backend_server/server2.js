import './src/config/dotenv-config.js';
import { Server } from 'socket.io';
import http from 'http';
import { app } from './app.js';
import { authenticate } from './src/login/login.js';

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

}

// Escuchar eventos de conexión al servidor
io.on('connection', newConnection);
