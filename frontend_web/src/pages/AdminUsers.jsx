import React, { useEffect, useState } from 'react';
import { requireAuthOrRedirect, getPublicUser } from '../app';
import { useNavigate } from 'react-router-dom';

export default function AdminUsers() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!me || me.tipoUser !== 'admin') return;
    fetchUsers();
  }, [me]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/admin/users');
      const j = await res.json().catch(() => null);
      if (res.ok) setUsers(j.users || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }

  if (!me || me.tipoUser !== 'admin') return <div className="p-6">Acceso denegado</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4">Usuarios — {me.NombreUser}</h1>
      <div className="mb-4">
        <button className="btn" onClick={() => nav('/admin')}>Volver</button>
      </div>
      <div className="card p-4">
        <h2 className="font-semibold mb-2">Listado de usuarios (id — NombreUser — Correo — tipo)</h2>
        <div className="space-y-2 max-h-96 overflow-auto">
          {users.map(u => (
            <div key={u.id} className="border p-2 rounded">
              <div className="font-medium">{u.id} — {u.NombreUser}</div>
              <div className="text-xs text-muted-foreground">{u.Correo} — {u.tipoUser}</div>
            </div>
          ))}
          {users.length === 0 && <div className="text-sm text-muted-foreground">No hay usuarios</div>}
        </div>
      </div>
    </div>
  );
}
