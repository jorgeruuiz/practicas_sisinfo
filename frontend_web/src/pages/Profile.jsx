// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import {
  requireAuthOrRedirect,
  getPublicUser,
  saveAuth,
  clearAuth,
} from "../app";
// UI
import { Button } from "@/components/ui/button";
import { disconnect as disconnectSocket } from "../lib/socketClient";
import { useNavigate } from 'react-router-dom'

export default function Profile() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const nav = useNavigate()
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [nombre, setNombre] = useState(me?.NombreUser || "");
  const [clave, setClave] = useState("");
  const [currentClave, setCurrentClave] = useState("");

  useEffect(() => {
    // opcional: cargar más info del perfil
    (async () => {
      try {
        const res = await fetch(`http://localhost:8080/user/byId?id=${encodeURIComponent(me?.id)}`);
        const j = await res.json().catch(() => null);
        if (res.ok && j) {
          // store stats in state
          setStats({
            Puntuacion: j.Puntuacion,
            totalGames: j.totalGames,
            totalWins: j.totalWins,
            totalLosses: j.totalLosses,
            totalDraws: j.totalDraws,
            actualStreak: j.actualStreak,
            maxStreak: j.maxStreak
          });
        }
        // si tu backend requiere token en header, añade Authorization.
        // este ejemplo confía en que el socket o el token se gestiona en fetch interceptor (si tienes).
      } catch {}
      setLoading(false);
    })();
  }, []);

  const [stats, setStats] = useState({
    Puntuacion: me?.Puntuacion ?? 0,
    totalGames: me?.totalGames ?? 0,
    totalWins: me?.totalWins ?? 0,
    totalLosses: me?.totalLosses ?? 0,
    totalDraws: me?.totalDraws ?? 0,
    actualStreak: me?.actualStreak ?? 0,
    maxStreak: me?.maxStreak ?? 0,
  });

  async function updateProfile() {
    setStatus("Guardando...");
    try {
      // Si el usuario quiere cambiar la contraseña, pedir la contraseña actual
      if (clave) {
        if (!currentClave) {
          setStatus("Introduce tu contraseña actual para cambiarla.");
          return;
        }
        const res = await fetch("http://localhost:8080/changePassword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: me.id, currentPassword: currentClave, newPassword: clave }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          setStatus("Error: " + ((j && (j.message || j.error)) || `HTTP ${res.status}`));
          return;
        }
        setClave("");
        setCurrentClave("");
        setStatus("Contraseña cambiada ✅");
        return;
      }

      // Solo actualizar nombre/ foto de perfil usando el endpoint existente
      const res2 = await fetch("http://localhost:8080/editUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: me.id, NombreUser: nombre, FotoPerfil: "none" }),
      });
      const j2 = await res2.json().catch(() => null);
      if (!res2.ok) {
        setStatus("Error: " + ((j2 && (j2.message || j2.error)) || `HTTP ${res2.status}`));
        return;
      }
      if (j2?.publicUser && j2?.accessToken) {
        saveAuth(j2.accessToken, j2.publicUser);
      }
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
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => nav('/friends')}>Friends</button>
          <button className="btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div>
          <label className="block text-sm mb-1">Nombre de usuario</label>
          <input
            className="w-full p-2 border rounded bg-gray-50"
            value={nombre}
            readOnly
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
        {/*
          If the user provides a new password, require their current password
        */}
        {clave ? (
          <div>
            <label className="block text-sm mb-1">Contraseña actual</label>
            <input
              type="password"
              className="w-full p-2 border rounded"
              value={currentClave}
              onChange={(e) => setCurrentClave(e.target.value)}
            />
          </div>
        ) : null}
        <Button className="h-11 rounded-xl" onClick={updateProfile}>
          Guardar cambios
        </Button>
        <pre className="text-sm">{status}</pre>
      </div>

      <div className="card p-4 mt-4">
        <div className="text-sm text-gray-600 mb-2">Estadísticas</div>
        <div className="grid grid-cols-2 gap-2">
          <div><strong>Puntuación:</strong> {stats.Puntuacion}</div>
          <div><strong>Partidas:</strong> {stats.totalGames}</div>
          <div><strong>Victorias:</strong> {stats.totalWins}</div>
          <div><strong>Derrotas:</strong> {stats.totalLosses}</div>
          <div><strong>Empates:</strong> {stats.totalDraws}</div>
          <div><strong>Racha actual:</strong> {stats.actualStreak}</div>
          <div><strong>Racha máxima:</strong> {stats.maxStreak}</div>
        </div>
      </div>
    </div>
  );
}
