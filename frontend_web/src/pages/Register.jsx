// src/pages/Register.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { saveAuth } from "../app";
import { connect as connectSocket } from "../lib/socketClient";

export default function Register() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [status, setStatus] = useState("");
  const nav = useNavigate();

  async function doRegister() {
    if (!nombre || !correo || !clave) {
      setStatus("Rellena nombre, correo y contraseña.");
      return;
    }
    setStatus("Creando cuenta...");
    try {
      const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          NombreUser: nombre,
          Correo: correo, // <-- requerido por tu backend
          Contrasena: clave,
        }),
      });

      // intenta parsear JSON incluso si hay error
      let j = null;
      try {
        j = await res.json();
      } catch {
        /* ignore */
      }

      if (!res.ok) {
        const msg = (j && (j.message || j.error)) || `HTTP ${res.status}`;
        setStatus("Error: " + msg);
        return;
      }

      // Si tu backend devuelve token tras registrar (no siempre):
      if (j?.accessToken && j?.publicUser) {
        saveAuth(j.accessToken, j.publicUser);
        try {
          connectSocket();
        } catch {}
        nav("/menu");
        return;
      }

      // Muchos backends de registro piden verificación de correo
      setStatus("Cuenta creada ✅. Revisa tu correo para verificar la cuenta.");
      nav("/login");
    } catch (e) {
      setStatus("Fetch error: " + e.message);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl mb-4">Crear cuenta</h1>
      <div className="mb-2">
        <input
          className="w-full p-2 border rounded"
          placeholder="Nombre de usuario"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div className="mb-2">
        <input
          type="email"
          className="w-full p-2 border rounded"
          placeholder="Correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
      </div>
      <div className="mb-2">
        <input
          type="password"
          className="w-full p-2 border rounded"
          placeholder="Contraseña"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={doRegister}>
          Registrarse
        </button>
        <Link className="btn" to="/login">
          Ya tengo cuenta
        </Link>
      </div>
      <pre className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">
        {status}
      </pre>
    </div>
  );
}
