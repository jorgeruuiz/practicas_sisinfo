import React, { useEffect, useRef, useState } from "react";
import { requireAuthOrRedirect, getPublicUser } from "../app";
import { useSocket } from "../lib/SocketProvider";

const BASE = "http://localhost:3000";

// ------------------------ AUXILIAR REST ------------------------
async function fetchUserByName(name) {
  const res = await fetch(
    `${BASE}/user/byName?name=${encodeURIComponent(name)}`
  );
  if (!res.ok) {
    let err = null;
    try {
      err = await res.json();
    } catch {}
    throw new Error(
      (err && (err.message || err.error)) || `HTTP ${res.status}`
    );
  }
  return res.json(); // { id, NombreUser, ... }
}

// ------------------------ COMPONENTE PRINCIPAL ------------------------
export default function Friends() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const socket = useSocket();

  const [connected, setConnected] = useState(socket?.connected || false);
  const [status, setStatus] = useState("");
  const [incoming, setIncoming] = useState([]); // solicitudes recibidas
  const [knownFriends, setKnownFriends] = useState([]); // amigos desde BD
  const [targetToAdd, setTargetToAdd] = useState("");
  const [targetToRemove, setTargetToRemove] = useState("");
  const [manualRequestId, setManualRequestId] = useState("");
  const [log, setLog] = useState([]);
  const logRef = useRef(null);

  const addLog = (line) =>
    setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] ${line}`]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // ------------------------ EVENTOS SOCKET ------------------------
  useEffect(() => {
    if (!socket) return;

    // 🔌 Cuando se conecta
    const onConnect = () => {
      setConnected(true);
      addLog("🔌 conectado");
      // Pedir datos reales al reconectarse
      socket.emit("friend:list");
      socket.emit("friend:list:pending");
    };

    const onDisconnect = () => {
      setConnected(false);
      addLog("🔌 desconectado");
    };

    // ✅ Autenticación confirmada desde el servidor
    const onAuthOk = () => {
      setConnected(true);
      addLog("✅ autenticado correctamente");
      socket.emit("friend:list");
      socket.emit("friend:list:pending");
    };

    const onIncoming = (d) => {
      addLog(`📥 friend:incoming ${d?.id || ""}`);
      if (d?.id) setIncoming((prev) => [...prev, d]);
    };

    const onAccepted = (d) => {
      addLog(`✅ friend:accepted ${JSON.stringify(d)}`);
      socket.emit("friend:list"); // actualizar lista
    };

    const onAcceptOk = (d) => {
      addLog(`🤝 friend:accept:ok ${JSON.stringify(d)}`);
      socket.emit("friend:list"); // actualizar lista
    };

    const onRemoved = (d) => {
      addLog(`🧹 friend:removed ${JSON.stringify(d)}`);
      socket.emit("friend:list");
    };

    const onReqOk = (d) => addLog(`📨 friend:request:ok ${d?.id || ""}`);
    const onRemOk = (d) => addLog(`🧹 friend:remove:ok ${JSON.stringify(d)}`);
    const onError = (d) =>
      addLog(
        `❌ friend:error ${typeof d === "string" ? d : JSON.stringify(d)}`
      );

    const onList = (arr) => {
      addLog(`📜 friend:list:ok (${arr.length} amigos)`);
      setKnownFriends(arr.map((u) => ({ id: u.id, nombre: u.NombreUser })));
    };

    const onPending = (rows) => {
      addLog(`🕒 friend:list:pending:ok (${rows.length} solicitudes)`);
      setIncoming(rows);
    };

    const onRefresh = () => {
      addLog("🔁 friend:list:refresh");
      socket.emit("friend:list");
    };

    // 🚀 Registro de eventos
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("auth:ok", onAuthOk);
    socket.on("friend:incoming", onIncoming);
    socket.on("friend:accepted", onAccepted);
    socket.on("friend:accept:ok", onAcceptOk);
    socket.on("friend:removed", onRemoved);
    socket.on("friend:request:ok", onReqOk);
    socket.on("friend:remove:ok", onRemOk);
    socket.on("friend:error", onError);
    socket.on("friend:list:ok", onList);
    socket.on("friend:list:pending:ok", onPending);
    socket.on("friend:list:refresh", onRefresh);

    // 📡 Si ya está conectado cuando se monta
    if (socket.connected) {
      setConnected(true);
      socket.emit("friend:list");
      socket.emit("friend:list:pending");
    }

    // 🧹 Cleanup
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("auth:ok", onAuthOk);
      socket.off("friend:incoming", onIncoming);
      socket.off("friend:accepted", onAccepted);
      socket.off("friend:accept:ok", onAcceptOk);
      socket.off("friend:removed", onRemoved);
      socket.off("friend:request:ok", onReqOk);
      socket.off("friend:remove:ok", onRemOk);
      socket.off("friend:error", onError);
      socket.off("friend:list:ok", onList);
      socket.off("friend:list:pending:ok", onPending);
      socket.off("friend:list:refresh", onRefresh);
    };
  }, [socket, me.id]);

  // ------------------------ ACCIONES UI ------------------------
  async function sendFriendRequest() {
    if (!targetToAdd.trim()) return;
    setStatus("Enviando solicitud…");
    try {
      const user = await fetchUserByName(targetToAdd.trim());
      socket.emit("friend:request", { fromId: me.id, toId: user.id });
      addLog(
        `➡️ emit friend:request from=${me.id} to=${user.id} (${user.NombreUser})`
      );
      setStatus("Solicitud enviada ✅");
      setTargetToAdd("");
    } catch (e) {
      setStatus("Error: " + e.message);
      addLog(`❌ request error: ${e.message}`);
    }
  }

  function acceptFromIncoming(idx) {
    const r = incoming[idx];
    if (!r) return;
    socket.emit("friend:accept", { requestId: r.id, accepterId: me.id });
    addLog(`➡️ emit friend:accept requestId=${r.id} accepter=${me.id}`);
    setIncoming((list) => list.filter((_, i) => i !== idx));
  }

  async function removeFriendByName() {
    if (!targetToRemove.trim()) return;
    setStatus("Eliminando amistad…");
    try {
      const user = await fetchUserByName(targetToRemove.trim());
      socket.emit("friend:remove", { userA: me.id, userB: user.id });
      addLog(
        `➡️ emit friend:remove A=${me.id} B=${user.id} (${user.NombreUser})`
      );
      setStatus("Amistad eliminada ✅");
      setTargetToRemove("");
    } catch (e) {
      setStatus("Error: " + e.message);
      addLog(`❌ remove error: ${e.message}`);
    }
  }

  // ------------------------ RENDER ------------------------
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Amigos</h1>
        <span
          className={`text-sm px-2 py-1 rounded ${
            connected
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>

      <div className="text-sm text-gray-600">
        <div>
          <strong>Mi ID:</strong> {me?.id}
        </div>
        <div>
          <strong>Usuario:</strong> {me?.NombreUser}
        </div>
      </div>

      {/* Mis amigos */}
      <div className="card p-4">
        <h2 className="font-semibold mb-2">Mis amigos</h2>
        {knownFriends.length === 0 ? (
          <div className="text-sm text-gray-600">No tienes amigos aún.</div>
        ) : (
          <div className="space-y-2">
            {knownFriends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div>{f.nombre || f.NombreUser || f.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solicitudes recibidas */}
      <div className="card p-4">
        <h2 className="font-semibold mb-2">Solicitudes recibidas</h2>
        {incoming.length === 0 ? (
          <div className="text-sm text-gray-600">
            No hay solicitudes pendientes.
          </div>
        ) : (
          <div className="space-y-2">
            {incoming.map((r, i) => (
              <div
                key={r.id || i}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="text-sm">
                  <div>
                    <strong>Request:</strong> {r.id}
                  </div>
                  <div>De: {r.Remitente || r.fromId}</div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => acceptFromIncoming(i)}
                >
                  Aceptar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enviar solicitud */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Enviar solicitud</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 p-2 border rounded"
            placeholder="Nombre de usuario"
            value={targetToAdd}
            onChange={(e) => setTargetToAdd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendFriendRequest()}
          />
          <button className="btn-primary" onClick={sendFriendRequest}>
            Enviar
          </button>
        </div>
      </div>

      {/* Eliminar amistad */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Eliminar amistad</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 p-2 border rounded"
            placeholder="Nombre de usuario"
            value={targetToRemove}
            onChange={(e) => setTargetToRemove(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && removeFriendByName()}
          />
          <button className="btn" onClick={removeFriendByName}>
            Eliminar
          </button>
        </div>
      </div>

      {/* Estado + Log */}
      <div className="text-sm text-gray-700">{status}</div>
      <div
        className="card p-3 h-48 overflow-auto text-xs bg-gray-50 border"
        ref={logRef}
      >
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
