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
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";

export default function Register() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function doRegister() {
    if (!nombre || !correo || !clave) {
      setStatus("Rellena nombre, correo y contraseña.");
      return;
    }
    setLoading(true);
    setStatus("Creando cuenta...");
    try {
      const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          NombreUser: nombre,
          Correo: correo,
          Contrasena: clave,
        }),
      });

      let j = null;
      try {
        j = await res.json();
      } catch {}

      if (!res.ok) {
        const msg = (j && (j.message || j.error)) || `HTTP ${res.status}`;
        setStatus("Error: " + msg);
        return;
      }

      if (j?.accessToken && j?.publicUser) {
        saveAuth(j.accessToken, j.publicUser);
        try {
          connectSocket();
        } catch {}
        nav("/menu");
        return;
      }

      setStatus("Cuenta creada ✅. Revisa tu correo para verificar la cuenta.");
      nav("/login");
    } catch (e) {
      setStatus("Fetch error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)] p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card className="border border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserPlus className="h-6 w-6" /> Crear cuenta
            </CardTitle>
            <CardDescription>Únete para competir y entrenar.</CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de usuario</Label>
              <Input
                id="nombre"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo">Correo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="correo"
                  type="email"
                  placeholder="tucorreo@ejemplo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
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

          <CardFooter className="flex flex-col sm:flex-row gap-3">
            <Button
              className="h-11 rounded-xl flex-1"
              onClick={doRegister}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Registrarse
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => nav("/login")}
            >
              Ya tengo cuenta
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
