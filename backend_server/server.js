import "./src/config/dotenv-config.js";
import { Server } from "socket.io";
import http from "http";
import { app } from "./app.js";
import { authenticate } from "./src/login/login.js";
import {
  findGame,
  cancelFindGame,
  receivePlayerResults,
} from "./src/rooms/rooms.js";
import {
  createFriendRequest,
  acceptFriendRequestById,
  removeFriendByUsers,
  getFriendsForUser,
} from "./src/friendship/friends.js";
import { db } from "./src/db/db.js";
import { usuario, amistad } from "./src/db/schemas/schemas.js";
import { eq, or, and, inArray } from "drizzle-orm";

// Objeto que almacenará los sockets con los usuarios conectados al servidor
export let activeSockets = new Map();

// Crear el servidor manualmente para poder utilizar WebSockets
export const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*",
  },
  connectionStateRecovery: {
    // the backup duration of the sessions and the packets
    maxDisconnectionDuration: 2 * 60 * 1000,
    // whether to skip middlewares upon successful recovery
    skipMiddlewares: false,
  },
});
const lastListAt = new Map();
// Función para emitir la lista de amigos actualizada a un usuario específico
async function emitFriendsList(userId) {
  try {
    const ids = await getFriendsForUser(userId);
    const rows =
      ids && ids.length
        ? await db.select().from(usuario).where(inArray(usuario.id, ids))
        : [];

    const s = activeSockets.get(userId);
    if (s) {
      s.emit(
        "friend:list:ok",
        rows.map((u) => ({
          id: u.id,
          NombreUser: u.NombreUser,
          FotoPerfil: u.FotoPerfil || null,
          Puntuacion: u.Puntuacion,
        }))
      );
    }
  } catch (e) {
    console.error("emitFriendsList error for", userId, e);
    const s = activeSockets.get(userId);
    if (s) s.emit("friend:error", { message: "No se pudo refrescar la lista" });
  }
}

const PORT = app.get("port");

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
  console.log("Usuario conectado, id: " + socket.id);
  await authenticate(socket);
  if (socket.user?.id) {
    socket.emit("auth:ok", { id: socket.user.id });
    console.log("✅ auth:ok emitido a", socket.user.id);
  } else {
    console.warn("⚠️ Socket autenticado sin user.id, desconectando...");
    return socket.disconnect(true);
  }

  // Registrar el socket del usuario autenticado
  const userId = socket.user?.id; // authenticate debe guardar el user en socket.user
  if (userId) {
    activeSockets.set(userId, socket);
    console.log(`Usuario ${userId} conectado y registrado en activeSockets`);
  }
  // Aquí habrá que gestionar los posibles eventos/mensajes que nos pueden llegar del cliente
  console.log("Escuchando eventos...");

  // ------------------------------------------------------------------------------------------
  // Envío de heartbeats de forma periódica (cada 5 segundos) por parte del servidor
  // para asegurar que los sockets de los clientes no se desconecten por inactividad
  // ------------------------------------------------------------------------------------------

  socket.on("pong", (data) => {
    console.log("Pong recibido!" + data.message);
  });

  // ------------------------------------------------------------------------------------------
  // Desconexión del cliente
  // ------------------------------------------------------------------------------------------
  socket.on("disconnect", async () => {
    console.log("Usuario desconectado");

    // Eliminar el socket del usuario desconectado del mapa
    for (let [userId, userSocket] of activeSockets.entries()) {
      if (userSocket.id === socket.id) {
        activeSockets.delete(userId);
        console.log(
          `Usuario ${userId} desconectado y eliminado de activeSockets`
        );
        break;
      }
    }
  });

  // ------------------------------------------------------------------------------------------
  // Eventos en tiempo real (partidas emparejadas)
  // ------------------------------------------------------------------------------------------

  // Evento para buscar una partida competitiva
  socket.on("buscarPartida", async (data) => {
    try {
      await findGame(socket, data);
    } catch (err) {
      console.error("Error en handler buscarPartida:", err);
      socket.emit("error", {
        message: "Error interno al procesar buscarPartida",
      });
    }
  });

  socket.on("cancelarBusqueda", async (data) => {
    console.log("Cancelar busqueda recibido");
    try {
      // Pass the whole data object to cancelFindGame (it expects an object with idJugador)
      await cancelFindGame(socket, data);
    } catch (err) {
      console.error("Error en handler cancelarBusqueda:", err);
      socket.emit("error", {
        message: "Error interno al procesar cancelarBusqueda",
      });
    }
  });

  // ------------------------------------------------------------------------------------------
  // Eventos de amistad vía WebSocket
  // ------------------------------------------------------------------------------------------
  socket.on("friend:request", async (data) => {
    try {
      const fromId = data?.fromId;
      const toId = data?.toId;
      const result = await createFriendRequest(fromId, toId);
      socket.emit("friend:request:ok", result);
      // Notificar al destinatario si está conectado
      if (activeSockets.has(toId)) {
        const s = activeSockets.get(toId);
        s.emit("friend:incoming", { fromId, id: result.id });
      }
    } catch (err) {
      console.error("Error en friend:request", err);
      socket.emit("friend:error", { message: String(err) });
    }
  });

  socket.on("friend:accept", async (data) => {
    try {
      const requestId = data?.requestId;
      const accepterId = data?.accepterId;

      // Actualiza el estado de la solicitud
      await acceptFriendRequestById(requestId, accepterId);

      // Obtener la solicitud completa
      const reqs = await db
        .select()
        .from(amistad)
        .where(eq(amistad.id, requestId));
      const req = reqs && reqs.length ? reqs[0] : null;

      // Emitir al que aceptó la amistad
      socket.emit("friend:accept:ok", {
        id: requestId,
        Remitente: req?.Remitente,
        Destinatario: req?.Destinatario,
      });

      // Notificar al remitente si está conectado
      if (req && activeSockets.has(req.Remitente)) {
        const s = activeSockets.get(req.Remitente);
        s.emit("friend:accepted", {
          id: requestId,
          Remitente: req.Remitente,
          Destinatario: req.Destinatario,
        });
      }
      if (req) {
        await emitFriendsList(req.Remitente);
        await emitFriendsList(req.Destinatario);
      }
      if (req) {
        const a = activeSockets.get(req.Remitente);
        const b = activeSockets.get(req.Destinatario);
        if (a) a.emit("friend:list:refresh");
        if (b) b.emit("friend:list:refresh");
      }
    } catch (err) {
      console.error("Error en friend:accept", err);
      socket.emit("friend:error", { message: String(err) });
    }
  });

  socket.on("friend:remove", async (data) => {
    try {
      const userA = data?.userA;
      const userB = data?.userB;
      const result = await removeFriendByUsers(userA, userB);
      socket.emit("friend:remove:ok", result);
      if (activeSockets.has(userB)) {
        const s = activeSockets.get(userB);
        s.emit("friend:removed", { by: userA });
      }
      await emitFriendsList(userA);
      await emitFriendsList(userB);
      const a = activeSockets.get(userA);
      const b = activeSockets.get(userB);
      if (a) a.emit("friend:list:refresh");
      if (b) b.emit("friend:list:refresh");
    } catch (err) {
      console.error("Error en friend:remove", err);
      socket.emit("friend:error", { message: String(err) });
    }
  });

  // Evento para recibir el informe final de aciertos desde el cliente
  socket.on("reportResults", async (data) => {
    try {
      const partidaId = data?.partidaId;
      const idJugador = data?.idJugador;
      const totalAciertos = data?.totalAciertos;
      await receivePlayerResults(partidaId, idJugador, totalAciertos);
    } catch (err) {
      console.error("Error en handler reportResults:", err);
      socket.emit("error", {
        message: "Error interno al procesar reportResults",
      });
    }
  });
  // ------------------------------------------------------------------------------------------
  socket.on("friend:list", async () => {
    const now = Date.now();
    const prev = lastListAt.get(socket.user.id) || 0;
    if (now - prev < 800) return; // evitar spam cada < 800ms
    lastListAt.set(socket.user.id, now);

    try {
      await emitFriendsList(socket.user.id);
    } catch (err) {
      console.error("❌ Error en friend:list:", err.message);
      socket.emit("friend:error", err.message);
    }
  });

  // Solicitudes pendientes recibidas
  socket.on("friend:list:pending", async () => {
    try {
      if (!socket.user?.id) throw new Error("No autenticado");
      const rows = await db
        .select()
        .from(amistad)
        .where(
          and(
            eq(amistad.Destinatario, socket.user.id),
            eq(amistad.Estado, "pending")
          )
        );
      socket.emit("friend:list:pending:ok", rows);
    } catch (e) {
      console.error("Error en friend:list:pending", e);
      socket.emit("friend:error", {
        message: e.message || "Error al obtener solicitudes pendientes",
      });
    }
  });

  // Solicitudes pendientes enviadas
  socket.on("friend:list:outgoing", async () => {
    try {
      if (!socket.user?.id) throw new Error("No autenticado");
      const rows = await db
        .select()
        .from(amistad)
        .where(
          and(
            eq(amistad.Remitente, socket.user.id),
            eq(amistad.Estado, "pending")
          )
        );
      socket.emit("friend:list:outgoing:ok", rows);
    } catch (e) {
      console.error("Error en friend:list:outgoing", e);
      socket.emit("friend:error", {
        message: e.message || "Error al obtener solicitudes enviadas",
      });
    }
  });
}
setInterval(() => {
  io.emit("ping", { message: "Ping!" });
}, 5000);

// Escuchar eventos de conexión al servidor
io.on("connection", newConnection);
