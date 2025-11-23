import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveAuth } from "../app";
import { connect as connectSocket } from "../lib/socketClient";
import { motion, AnimatePresence } from "framer-motion";

// UI
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

// Icons
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";

export default function Login() {
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function doLogin() {
    if (!nombre || !clave) {
      setStatus("Rellena ambos campos");
      return;
    }
    setLoading(true);
    setStatus("Logging...");
    try {
      const res = await fetch("http://localhost:8080/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ NombreUser: nombre, Contrasena: clave }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus("Login error: " + (j?.message || JSON.stringify(j)));
        setLoading(false);
        return;
      }
      saveAuth(j.accessToken, j.publicUser);
      try {
        connectSocket();
      } catch (e) {
        console.warn("socket connect failed", e);
      }
      nav("/menu");
    } catch (err) {
      setStatus("Fetch error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card className="border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <LogIn className="h-6 w-6" /> Iniciar sesión
            </CardTitle>
            <CardDescription>
              Accede para buscar partidas competitivas.
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de usuario</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="nombre"
                  placeholder="NombreUser"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clave">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="clave"
                  type="password"
                  placeholder="********"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert>
                    <AlertTitle>Estado</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap break-words">
                      {status}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>

          <CardFooter className="flex justify-between gap-3">
            <Button
              className="h-11 rounded-xl flex-1"
              onClick={doLogin}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}{" "}
              Login
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => nav("/register")}
            >
              Crear cuenta
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
