// src/pages/Chat.jsx
import React, { useEffect, useRef, useState } from "react";
import { requireAuthOrRedirect, getPublicUser } from "../app";
import { useSocket } from "../lib/SocketProvider";

export default function Chat() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const socket = useSocket();

  const [room, setRoom] = useState("global"); // sala "global" por defecto
  const [toUserId, setToUserId] = useState(""); // para mensajes directos
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState([]); // {from, text, room?, to?}
  const listRef = useRef(null);

  // autoscroll
  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (!socket) return;
    try {
      socket.emit("chat:join", { room });
    } catch {}

    function onMessage(payload) {
      // payload: { from:{id,nombre}, text, room?, to? }
      setLog((l) => [...l, payload]);
    }
    socket.on("chat:message", onMessage);
    return () => socket.off("chat:message", onMessage);
  }, [socket, room]);

  function sendToRoom() {
    if (!msg.trim()) return;
    try {
      socket.emit("chat:send", { room, text: msg });
      setLog((l) => [
        ...l,
        { from: { id: me.id, nombre: me.NombreUser }, text: msg, room },
      ]);
      setMsg("");
    } catch {}
  }

  function sendDirect() {
    if (!msg.trim() || !toUserId.trim()) return;
    try {
      socket.emit("chat:sendDirect", { to: toUserId.trim(), text: msg });
      setLog((l) => [
        ...l,
        {
          from: { id: me.id, nombre: me.NombreUser },
          text: `[DM→${toUserId}] ${msg}`,
        },
      ]);
      setMsg("");
    } catch {}
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl mb-4">Chat</h1>

      <div className="card p-4 mb-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-sm mb-1">Sala</label>
            <input
              className="w-full p-2 border rounded"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </div>
          <button
            className="btn"
            onClick={() => {
              /* re-join ocurre por useEffect al cambiar room */
            }}
          >
            Cambiar sala
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-2 flex gap-2">
            <input
              className="flex-1 p-2 border rounded"
              placeholder="Escribe un mensaje para la sala…"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendToRoom();
              }}
            />
            <button className="btn-primary" onClick={sendToRoom}>
              Enviar sala
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 p-2 border rounded"
              placeholder="ID de usuario (DM)"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
            />
            <button className="btn" onClick={sendDirect}>
              Enviar DM
            </button>
          </div>
        </div>
      </div>

      <div ref={listRef} className="card p-4 h-[50vh] overflow-auto space-y-2">
        {log.map((m, i) => (
          <div key={i} className="p-2 border rounded">
            <div className="text-sm text-gray-600">
              <strong>{m.from?.nombre || m.from?.id || "desconocido"}</strong>
              {m.room ? <span className="ml-2">[sala: {m.room}]</span> : null}
            </div>
            <div className="whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
