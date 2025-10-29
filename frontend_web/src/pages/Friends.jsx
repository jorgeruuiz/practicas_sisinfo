import React, { useEffect, useMemo, useRef, useState } from "react";
import { requireAuthOrRedirect, getPublicUser } from "../app";
import { useSocket } from "../lib/SocketProvider";
import { motion, AnimatePresence } from "framer-motion";

// UI (shadcn/ui)
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Icons (lucide-react)
import {
  Users,
  UserPlus,
  UserMinus,
  Check,
  PlugZap,
  Plug,
  AlertCircle,
  Search,
  Mail,
} from "lucide-react";

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
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  const initials = useMemo(
    () =>
      (me?.NombreUser || "User")
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("") || "U",
    [me?.NombreUser]
  );
  const connectionBadge = connected ? (
    <Badge className="gap-1" variant="secondary">
      <PlugZap className="h-3.5 w-3.5" /> Conectado
    </Badge>
  ) : (
    <Badge
      className="gap-1 bg-red-100 text-red-700 hover:bg-red-100"
      variant="secondary"
    >
      <Plug className="h-3.5 w-3.5" /> Desconectado
    </Badge>
  );

  const addLog = (line) =>
    setLog((p) => [...p, `[${new Date().toLocaleTimeString()}] ${line}`]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // ------------------------ EVENTOS SOCKET ------------------------
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      setConnected(true);
      addLog("🔌 conectado");
      socket.emit("friend:list");
      socket.emit("friend:list:pending");
    };

    const onDisconnect = () => {
      setConnected(false);
      addLog("🔌 desconectado");
    };
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
      socket.emit("friend:list");
    };
    const onAcceptOk = (d) => {
      addLog(`🤝 friend:accept:ok ${JSON.stringify(d)}`);
      socket.emit("friend:list");
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

    if (socket.connected) {
      setConnected(true);
      socket.emit("friend:list");
      socket.emit("friend:list:pending");
    }

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
  }, [socket, me?.id]);

  // ------------------------ ACCIONES UI ------------------------
  async function sendFriendRequest() {
    if (!targetToAdd.trim()) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
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
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)] p-4">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Amigos
                    {connectionBadge}
                  </CardTitle>
                  <CardDescription>
                    <span className="font-medium">{me?.NombreUser}</span> · ID:{" "}
                    {me?.id}
                  </CardDescription>
                </div>
              </div>
              <Users className="h-6 w-6 text-muted-foreground" />
            </CardHeader>

            <Separator />

            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
              {/* Lista de amigos */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">Mis amigos</h2>
                  <Badge variant="outline">{knownFriends.length}</Badge>
                </div>
                {knownFriends.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tienes amigos aún.
                  </p>
                ) : (
                  <ScrollArea className="h-56">
                    <div className="space-y-2 pr-2">
                      {knownFriends.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-2 border rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {(f.nombre || "?").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              {f.nombre || f.NombreUser || f.id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Solicitudes recibidas */}
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">Solicitudes recibidas</h2>
                  <Badge variant="outline">{incoming.length}</Badge>
                </div>
                {incoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay solicitudes pendientes.
                  </p>
                ) : (
                  <ScrollArea className="h-56">
                    <div className="space-y-2 pr-2">
                      {incoming.map((r, i) => (
                        <div
                          key={r.id || i}
                          className="flex items-center justify-between p-2 border rounded-lg"
                        >
                          <div className="text-xs">
                            <div>
                              <strong>Request:</strong> {r.id}
                            </div>
                            <div>De: {r.Remitente || r.fromId}</div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => acceptFromIncoming(i)}
                            className="rounded-lg"
                          >
                            <Check className="mr-2 h-4 w-4" /> Aceptar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Enviar solicitud */}
              <div className="rounded-xl border p-4 md:col-span-2">
                <h2 className="font-semibold mb-3">Enviar solicitud</h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nombre de usuario"
                      value={targetToAdd}
                      onChange={(e) => setTargetToAdd(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && sendFriendRequest()
                      }
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={sendFriendRequest}
                    disabled={busy}
                    className="rounded-xl"
                  >
                    <UserPlus className="mr-2 h-4 w-4" /> Enviar
                  </Button>
                </div>
              </div>

              {/* Eliminar amistad */}
              <div className="rounded-xl border p-4 md:col-span-2">
                <h2 className="font-semibold mb-3">Eliminar amistad</h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nombre de usuario"
                      value={targetToRemove}
                      onChange={(e) => setTargetToRemove(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && removeFriendByName()
                      }
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={removeFriendByName}
                    disabled={busy}
                    className="rounded-xl"
                  >
                    <UserMinus className="mr-2 h-4 w-4" /> Eliminar
                  </Button>
                </div>
              </div>

              {/* Estado */}
              <div className="md:col-span-2">
                <AnimatePresence>
                  {status && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Estado</AlertTitle>
                        <AlertDescription className="whitespace-pre-wrap break-words">
                          {status}
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Log */}
              <div className="md:col-span-2">
                <Label className="mb-2 block">Log</Label>
                <div
                  ref={logRef}
                  className="rounded-xl border bg-muted/30 h-48 overflow-auto p-3 text-xs"
                >
                  {log.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
