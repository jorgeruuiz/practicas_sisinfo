// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import {
  requireAuthOrRedirect,
  getPublicUser,
  saveAuth,
  clearAuth,
} from "../app";
import { disconnect as disconnectSocket } from "../lib/socketClient";

export default function Profile() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [nombre, setNombre] = useState(me?.NombreUser || "");
  const [clave, setClave] = useState("");

  useEffect(() => {
    // opcional: cargar más info del perfil
    (async () => {
      try {
        const res = await fetch("http://localhost:3000/me", {
          credentials: "omit",
        });
        // si tu backend requiere token en header, añade Authorization.
        // este ejemplo confía en que el socket o el token se gestiona en fetch interceptor (si tienes).
      } catch {}
      setLoading(false);
    })();
  }, []);

  async function updateProfile() {
    setStatus("Guardando...");
    try {
      const res = await fetch("http://localhost:3000/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          NombreUser: nombre,
          Contrasena: clave || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus("Error: " + (j?.message || JSON.stringify(j)));
        return;
      }
      // si backend devuelve el nuevo publicUser y/o un token refrescado:
      if (j?.publicUser && j?.accessToken) {
        saveAuth(j.accessToken, j.publicUser);
      }
      setClave("");
      setStatus("Perfil actualizado ✅");
    } catch (e) {
      setStatus("Fetch error: " + e.message);
    }
  }

  function logout() {
    try {
      disconnectSocket();
    } catch {}
    clearAuth();
    window.location.href = "/login";
  }

  if (loading) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">Perfil</h1>
        <button className="btn" onClick={logout}>
          Logout
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <div>
          <label className="block text-sm mb-1">Nombre de usuario</label>
          <input
            className="w-full p-2 border rounded"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">
            Nueva contraseña (opcional)
          </label>
          <input
            type="password"
            className="w-full p-2 border rounded"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={updateProfile}>
          Guardar cambios
        </button>
        <pre className="text-sm">{status}</pre>
      </div>

      <div className="card p-4 mt-4">
        <div className="text-sm text-gray-600 mb-2">Datos actuales</div>
        <div>
          <strong>ID:</strong> {me?.id}
        </div>
        <div>
          <strong>Usuario:</strong> {me?.NombreUser}
        </div>
      </div>
    </div>
  );
}
