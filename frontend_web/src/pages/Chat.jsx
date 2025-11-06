// src/pages/Chat.jsx
import React, { useEffect, useRef, useState } from "react";
import { requireAuthOrRedirect, getPublicUser } from "../app";
import { useSocket } from "../lib/SocketProvider";
import { useSearchParams } from 'react-router-dom'

const BASE = 'http://localhost:3000'

export default function Chat() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const socket = useSocket();

  const [searchParams] = useSearchParams()
  const preUser = searchParams.get('userId') || ''

  const [room, setRoom] = useState("global"); // sala "global" por defecto
  const [toUserId, setToUserId] = useState(preUser); // para mensajes directos
  const [msg, setMsg] = useState("");
  const [log, setLog] = useState([]); // {from, text, room?, to?}
  const [threadLoading, setThreadLoading] = useState(false)
  const listRef = useRef(null);

  const isDirect = Boolean(preUser);

  // autoscroll
  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [log]);

  // When visiting /chat?userId=..., load private thread via REST
  useEffect(() => {
    async function loadThreadFor(userId) {
      if (!userId) return
      setThreadLoading(true)
      try {
        const res = await fetch(`${BASE}/chat/thread?userA=${encodeURIComponent(me.id)}&userB=${encodeURIComponent(userId)}&limit=200`)
        if (!res.ok) throw new Error('Thread fetch failed')
        const j = await res.json()
        if (j?.messages) {
          // normalize to common shape: { from: {id,nombre?}, text }
          const rows = j.messages.map(m => ({ from: { id: m.fromId }, text: m.texto, id: m.id }))
          setLog(rows)
        }
      } catch (e) {
        console.debug('loadThread error', e)
      } finally {
        setThreadLoading(false)
      }
    }
    if (preUser) loadThreadFor(preUser)
  }, [preUser, me.id])

  useEffect(() => {
    if (!socket) return;
    // if we're in direct mode, don't join a room
    if (!isDirect) {
      try {
        socket.emit("chat:join", { room });
      } catch {}
    }

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

  async function sendDirect() {
    if (!msg.trim() || !toUserId.trim()) return;
    try {
      const res = await fetch(`${BASE}/chat/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId: me.id, toId: toUserId.trim(), texto: msg }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        console.debug('sendMessage failed', j)
        return
      }
      const j = await res.json().catch(() => null)
      // append to local log
      setLog((l) => [
        ...l,
        { from: { id: me.id, nombre: me.NombreUser }, text: msg, id: j?.message?.id },
      ])
      setMsg("")
    } catch (err) { console.debug('sendMessage error', err) }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl mb-4">Chat</h1>

      <div className="card p-4 mb-4">
        {!isDirect ? (
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
        ) : (
          <div className="mb-2">
            <div className="text-sm text-muted-foreground">
              Chat directo con ID: <strong>{toUserId}</strong>
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="md:col-span-2 flex gap-2">
            <input
              className="flex-1 p-2 border rounded"
              placeholder={isDirect ? "Escribe un mensaje directo…" : "Escribe un mensaje para la sala…"}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (isDirect) sendDirect();
                  else sendToRoom();
                }
              }}
            />
            <button className="btn-primary" onClick={() => (isDirect ? sendDirect() : sendToRoom())}>
              {isDirect ? "Enviar" : "Enviar sala"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 p-2 border rounded"
              placeholder="ID de usuario (DM)"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              disabled={isDirect}
            />
            <button className="btn" onClick={sendDirect} disabled={!toUserId.trim()}>
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
