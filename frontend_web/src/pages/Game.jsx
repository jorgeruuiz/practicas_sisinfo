import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requireAuthOrRedirect, getPublicUser, clearAuth } from "../app";
import { disconnect as disconnectSocket } from "../lib/socketClient";
import { useSocket } from "../lib/SocketProvider";
import { motion, AnimatePresence } from "framer-motion";

// UI (shadcn/ui)
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Icons
import {
  LogOut,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Gamepad2,
} from "lucide-react";

export default function Game() {
  requireAuthOrRedirect();
  const nav = useNavigate();
  const socket = useSocket();
  const publicUser = getPublicUser();

  const [status, setStatus] = useState("loading"); // loading|match|waitingForOpponent|finished
  const [players, setPlayers] = useState([]); // [{id, NombreUser}]
  const [preguntas, setPreguntas] = useState([]);
  const [partidaId, setPartidaId] = useState(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({}); // index -> selected option index
  const [revealed, setRevealed] = useState({}); // index -> bool
  const [summary, setSummary] = useState(null);

  const initials = useMemo(
    () =>
      (publicUser?.NombreUser || "U")
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("") || "U",
    [publicUser?.NombreUser]
  );

  useEffect(() => {
    // Helpers: hash string id to integer and seeded RNG (deterministic shuffle)
    function hashStringToInt(s) {
      if (!s) return 0;
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h >>> 0;
    }

    function seededRng(seed) {
      // Mulberry32
      let t = seed >>> 0;
      return function () {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    }

    // If Menu stored a partidaLista in sessionStorage (navigation race), use it
    try {
      const raw = sessionStorage.getItem("partidaLista");
      if (raw) {
        const d = JSON.parse(raw);
        const rows = Array.isArray(d?.preguntas) ? d.preguntas : [];
        setPartidaId(d?.partidaId ?? null);
        const prepared = rows.map((q) => {
          const rawOptions = [
            { text: q.respuesta_correcta, isCorrect: true },
            q.respuesta_incorrecta1
              ? { text: q.respuesta_incorrecta1, isCorrect: false }
              : null,
            q.respuesta_incorrecta2
              ? { text: q.respuesta_incorrecta2, isCorrect: false }
              : null,
            q.respuesta_incorrecta3
              ? { text: q.respuesta_incorrecta3, isCorrect: false }
              : null,
          ];
          const present = rawOptions.filter(
            (o) => o && (o.text ?? "").toString().trim() !== ""
          );
          const seed =
            (typeof q.id === "number" ? q.id : hashStringToInt(String(q.id))) ||
            Math.floor(Math.random() * 1e9);
          const shuffled = present.slice();
          const rand = seededRng(seed);
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
          }
          const options = shuffled.map((o) => ({
            text: o && o.text ? o.text.toString().trim() : "",
            isCorrect: !!(o && o.isCorrect),
          }));
          return { id: q.id, pregunta: q.pregunta || "", options };
        });
        if (prepared.length) {
          setPreguntas(prepared);
          setAnswers({});
          setRevealed({});
          setCurrent(0);
          setSummary(null);
          setStatus("match");
        }
        sessionStorage.removeItem("partidaLista");
      }
    } catch (e) {
      /* ignore malformed storage */
    }

    if (!socket) return;

    function onPartidaEncontrada(d) {
      const raw = Array.isArray(d?.jugadores) ? d.jugadores : d?.players || [];
      const list = (raw || []).map((p) =>
        p && typeof p === "object"
          ? { id: p.id, NombreUser: p.NombreUser }
          : { id: p, NombreUser: undefined }
      );
      setPlayers(list);
    }

    function onPartidaLista(d) {
      const rows = Array.isArray(d?.preguntas) ? d.preguntas : [];
      setPartidaId(d?.partidaId ?? null);
      const prepared = rows.map((q) => {
        const rawOptions = [
          { text: q.respuesta_correcta, isCorrect: true },
          q.respuesta_incorrecta1
            ? { text: q.respuesta_incorrecta1, isCorrect: false }
            : null,
          q.respuesta_incorrecta2
            ? { text: q.respuesta_incorrecta2, isCorrect: false }
            : null,
          q.respuesta_incorrecta3
            ? { text: q.respuesta_incorrecta3, isCorrect: false }
            : null,
        ];
        const present = rawOptions.filter(
          (o) => o && (o.text ?? "").toString().trim() !== ""
        );
        const seed =
          (typeof q.id === "number" ? q.id : hashStringToInt(String(q.id))) ||
          Math.floor(Math.random() * 1e9);
        const shuffled = present.slice();
        const rand = seededRng(seed);
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          const tmp = shuffled[i];
          shuffled[i] = shuffled[j];
          shuffled[j] = tmp;
        }
        const options = shuffled.map((o) => ({
          text: o && o.text ? o.text.toString().trim() : "",
          isCorrect: !!(o && o.isCorrect),
        }));
        return { id: q.id, pregunta: q.pregunta || "", options };
      });
      setPreguntas(prepared);
      setAnswers({});
      setRevealed({});
      setCurrent(0);
      setSummary(null);
      setStatus("match");
    }

    function onPartidaFinalizada(d) {
      setSummary(d || null);
      setStatus("finished");
    }

    socket.on("partidaEncontrada", onPartidaEncontrada);
    socket.on("partidaLista", onPartidaLista);
    socket.on("partidaFinalizada", onPartidaFinalizada);

    return () => {
      socket.off("partidaEncontrada", onPartidaEncontrada);
      socket.off("partidaLista", onPartidaLista);
      socket.off("partidaFinalizada", onPartidaFinalizada);
    };
  }, [socket]);

  function logoutAndGoLogin() {
    try {
      disconnectSocket();
    } catch (_) {}
    clearAuth();
    nav("/login");
  }

  function selectOption(optIdx) {
    if (revealed[current]) return;
    setAnswers((a) => ({ ...a, [current]: optIdx }));
    setRevealed((r) => ({ ...r, [current]: true }));
  }

  function goPrev() {
    setCurrent((c) => Math.max(0, c - 1));
  }
  function goNext() {
    setCurrent((c) => Math.min(preguntas.length - 1, c + 1));
  }

  function finalizeAndSend() {
    let total = 0;
    let valid = 0;
    preguntas.forEach((q, idx) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      if (!opts || opts.length === 0) return;
      valid++;
      const sel = answers[idx];
      if (sel == null) return;
      if (opts[sel] && opts[sel].isCorrect) total++;
    });
    if (socket && preguntas.length) {
      try {
        socket.emit("reportResults", {
          partidaId,
          idJugador: publicUser.id,
          totalAciertos: total,
          totalPreguntasValidas: valid,
        });
      } catch (e) {
        /* ignore */
      }
    }
    setStatus("waitingForOpponent");
  }

  // ---- Render helpers ----
  const Header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-500 text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-semibold leading-tight">
            {publicUser?.NombreUser}
          </div>
          <div className="text-xs text-muted-foreground">
            Partida {partidaId ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );

  // --- Status: loading ---
  if (status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)] p-4">
        <Card className="w-full max-w-3xl border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" /> Cuestionados - Juego
            </CardTitle>
            <CardDescription>Preparando tu partida...</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="py-10 grid place-items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Status: waitingForOpponent ---
  if (status === "waitingForOpponent") {
    return (
      <div className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)] p-4">
        <Card className="w-full max-w-xl border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Esperando rival
            </CardTitle>
            <CardDescription>
              Tus respuestas se han enviado. Esperando a que el rival termine...
            </CardDescription>
          </CardHeader>
          <CardContent>{Header}</CardContent>
        </Card>
      </div>
    );
  }

  // --- Status: finished ---
  if (status === "finished" && summary) {
    return (
      <div className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)] p-4">
        <Card className="w-full max-w-3xl border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" /> Resumen de la partida
            </CardTitle>
            <CardDescription>Resultados finales</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4">
            {Header}
            <div className="rounded-xl border p-4">
              <div className="mb-2">
                Ganador:{" "}
                {summary.ganador
                  ? summary.ganador === publicUser.id
                    ? "Tú"
                    : (summary.jugadores || []).find(
                        (j) => j.id === summary.ganador
                      )?.nombre || summary.ganador
                  : "Empate"}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left">
                    <tr className="border-b">
                      <th className="p-2">Jugador</th>
                      <th className="p-2">Aciertos</th>
                      <th className="p-2">Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.jugadores || []).map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2">{p.nombre || p.id}</td>
                        <td className="p-2">{p.reportedAciertos}</td>
                        <td className="p-2">
                          {p.variacion >= 0 ? `+${p.variacion}` : p.variacion}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="rounded-xl"
              onClick={() => {
                setSummary(null);
                setStatus("loading");
                setPlayers([]);
                setPreguntas([]);
                setPartidaId(null);
                nav("/menu");
              }}
            >
              Volver al menú
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // --- Status: match ---
  if (status === "match" && preguntas.length) {
    const q = preguntas[current] || { pregunta: "", options: [] };
    const opts = Array.isArray(q.options) ? q.options : [];
    const sel = answers[current];
    const isRevealed = !!revealed[current];

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)] p-4">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" /> Cuestionados
                </CardTitle>
                <CardDescription>
                  Pregunta {current + 1} / {preguntas.length}
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-4">
                {Header}

                <div className="p-5 border rounded-xl text-lg min-h-[6rem]">
                  {q.pregunta}
                </div>

                <ScrollArea className="max-h-[40vh] pr-2">
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {opts.map((opt, i) => {
                        const text = opt && opt.text ? opt.text : "";
                        const correct = !!(opt && opt.isCorrect);
                        let base =
                          "p-4 border rounded-xl cursor-pointer min-h-[3rem] flex items-center transition-colors";
                        if (isRevealed) {
                          if (correct) base += " bg-green-100 border-green-500";
                          else if (sel === i)
                            base += " bg-red-100 border-red-500";
                          else base += " bg-background";
                        } else {
                          base += " hover:bg-muted/40";
                        }
                        return (
                          <motion.div
                            key={i}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className={base}
                            onClick={() => selectOption(i)}
                          >
                            <div className="text-base">{text}</div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </ScrollArea>

                <AnimatePresence>
                  {isRevealed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Alert>
                        <AlertTitle>Respuesta registrada</AlertTitle>
                        <AlertDescription>
                          {sel != null && opts[sel]
                            ? opts[sel].isCorrect
                              ? "¡Correcta!"
                              : "Incorrecta"
                            : "Sin respuesta"}
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
              <CardFooter className="flex items-center gap-2 justify-between">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={current === 0}
                  onClick={goPrev}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
                </Button>
                {current < preguntas.length - 1 ? (
                  <Button className="rounded-xl" onClick={goNext}>
                    Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="rounded-xl" onClick={finalizeAndSend}>
                    Finalizar
                  </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // --- Default fallback ---
  return (
    <div className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)] p-4">
      <Card className="w-full max-w-xl border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle>Esperando partida...</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
