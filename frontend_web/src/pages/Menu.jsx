import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requireAuthOrRedirect, getPublicUser, clearAuth } from "../app";
import { useSocket } from "../lib/SocketProvider";
import { disconnect as disconnectSocket } from "../lib/socketClient";

// UI & Icons
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  LogOut,
  PlayCircle,
  Swords,
  User,
  Dumbbell,
  ChevronRight,
  XCircle,
  Gamepad2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Menu() {
  requireAuthOrRedirect();
  const nav = useNavigate();
  const socket = useSocket();
  const publicUser = getPublicUser();
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  // Derivations
  const displayName = publicUser?.NombreUser ?? "Jugador";
  const initials = useMemo(
    () =>
      displayName
        ?.split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("") || "J",
    [displayName]
  );

  useEffect(() => {
    if (!socket) return;

    function onPartidaCreada(d) {
      setMessage(d?.mensaje || "Partida creada. Esperando oponente...");
    }

    function onPartidaEncontrada() {
      setMessage("Partida encontrada. Preparando preguntas...");
    }

    function onPartidaCancelada(d) {
      setSearching(false);
      setMessage(d?.mensaje || "Búsqueda de partida cancelada");
    }

    function onPartidaLista(d) {
      try {
        sessionStorage.setItem("partidaLista", JSON.stringify(d || {}));
      } catch (e) {
        /* ignore */
      }
      setSearching(false);
      setMessage("");
      nav("/game");
    }

    socket.on("partidaCreada", onPartidaCreada);
    socket.on("partidaEncontrada", onPartidaEncontrada);
    socket.on("partidaLista", onPartidaLista);
    socket.on("partidaCancelada", onPartidaCancelada);

    return () => {
      socket.off("partidaCreada", onPartidaCreada);
      socket.off("partidaEncontrada", onPartidaEncontrada);
      socket.off("partidaLista", onPartidaLista);
      socket.off("partidaCancelada", onPartidaCancelada);
    };
  }, [socket, nav]);

  function buscarPartidaCompetitiva() {
    if (!socket) {
      setMessage("Socket no conectado. Intenta recargar la página.");
      return;
    }
    try {
      socket.emit("buscarPartida", { idJugador: publicUser.id });
      setSearching(true);
      setMessage("Buscando oponente...");
    } catch (e) {
      console.warn("emit buscarPartida failed", e);
      setMessage("Error iniciando búsqueda");
      setSearching(false);
    }
  }

  async function cancelarBusqueda() {
    if (!socket) {
      setMessage("Socket no conectado. Intenta recargar la página.");
      setSearching(false);
      return;
    }
    try {
      socket.emit("cancelarBusqueda", { idJugador: publicUser.id });
      setMessage("Cancelando búsqueda..."); // Esperar confirmación del servidor
    } catch (e) {
      console.warn("emit cancelarBusqueda failed", e);
      setMessage("Error al cancelar la búsqueda");
      setSearching(false);
    }
  }

  function logout() {
    try {
      disconnectSocket();
    } catch (_) {}
    clearAuth();
    nav("/login");
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key.toLowerCase() === "s" && !searching) buscarPartidaCompetitiva(); // start search
      if (e.key.toLowerCase() === "c" && searching) cancelarBusqueda(); // cancel
      if (e.key.toLowerCase() === "l") logout();
      if (e.key.toLowerCase() === "p") nav("/profile");
      if (e.key.toLowerCase() === "t") nav("/training");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searching]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.15),transparent_50%),radial-gradient(circle_at_80%_50%,rgba(147,51,234,0.15),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.2),transparent_45%),radial-gradient(circle_at_80%_50%,rgba(147,51,234,0.25),transparent_50%)]">
      <div className="container mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="mx-auto max-w-xl shadow-lg border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl grid place-items-center bg-gradient-to-br from-blue-500/90 to-violet-500/90 text-white font-semibold shadow-sm">
                  {initials}
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Menú
                    <Badge variant="secondary" className="rounded-full">
                      Quest
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Bienvenido,{" "}
                    <span className="font-medium">{displayName}</span>
                  </CardDescription>
                </div>
              </div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                      aria-label="Cerrar sesión"
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atajo: L</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardHeader>

            <Separator />

            <CardContent className="pt-6 space-y-4">
              <AnimatePresence initial={false}>
                {message && (
                  <motion.div
                    key={message}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Alert className="border-blue-300/50">
                      <Gamepad2 className="h-4 w-4" />
                      <AlertTitle>Estado</AlertTitle>
                      <AlertDescription>{message}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="grid grid-cols-1 gap-3">
                {!searching ? (
                  <Button
                    size="lg"
                    className="justify-between h-12 rounded-xl"
                    onClick={buscarPartidaCompetitiva}
                    aria-label="Buscar partida competitiva"
                  >
                    <span className="flex items-center gap-2">
                      <Swords className="h-5 w-5" /> Buscar partida competitiva
                    </span>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border p-4">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                    <div className="flex-1">
                      <div className="font-medium">
                        {message || "Buscando..."}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Esperando a que se encuentre un oponente.
                      </div>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            onClick={cancelarBusqueda}
                            aria-label="Cancelar búsqueda"
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Cancelar
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Atajo: C</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl"
                    onClick={() => nav("/profile")}
                    aria-label="Ir a perfil"
                  >
                    <User className="mr-2 h-5 w-5" /> Perfil (pendiente)
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl"
                    onClick={() => nav("/training")}
                    aria-label="Ir a entrenamiento"
                  >
                    <Dumbbell className="mr-2 h-5 w-5" /> Entrenamiento
                    (pendiente)
                  </Button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-between text-xs text-muted-foreground">
              <div>
                Consejos rápidos:{" "}
                <kbd className="px-1.5 py-0.5 rounded border">S</kbd> buscar ·{" "}
                <kbd className="px-1.5 py-0.5 rounded border">C</kbd> cancelar ·{" "}
                <kbd className="px-1.5 py-0.5 rounded border">L</kbd> logout
              </div>
              <div className="flex items-center gap-1">
                <PlayCircle className="h-3.5 w-3.5" />
                Listo para jugar
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
