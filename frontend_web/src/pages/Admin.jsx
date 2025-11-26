import React, { useEffect, useState } from 'react';
import { requireAuthOrRedirect, getPublicUser, apiFetch } from '../app';
import { Button } from '@/components/ui/button';

export default function Admin() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const [users, setUsers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!me || me.tipoUser !== 'admin') return;
    // We'll not list all users; admin can delete by id
    fetchQuestions();
  }, [me]);

  async function fetchUsers() {
    // kept for compatibility but not used in UI
    try {
      const res = await apiFetch('http://localhost:8080/admin/users');
      const j = await res.json();
      if (res.ok) setUsers(j.users || []);
    } catch (e) { console.warn(e); }
  }

  async function fetchQuestions() {
    try {
      const res = await apiFetch('http://localhost:8080/admin/questions');
      const j = await res.json().catch(() => null);
      if (res.ok) setQuestions(j.questions || []);
    } catch (e) { console.warn(e); }
  }

  async function handleDeleteUser(id) {
    if (!id) { setStatus('Introduce un id de usuario'); return; }
    // do a preliminary check: fetch target user to ensure it's not an admin and not self
    try {
      const infoRes = await apiFetch(`http://localhost:8080/user/byId?id=${encodeURIComponent(id)}`);
      const info = await infoRes.json().catch(()=>null);
      if (!infoRes.ok) { setStatus('Usuario no encontrado'); return; }
      if (info.tipoUser === 'admin') { setStatus('No puedes eliminar a otro admin'); return; }
      if (info.id === me.id) { setStatus('No puedes eliminarte a ti mismo'); return; }
    } catch (e) { setStatus('Error comprobando usuario: ' + e.message); return; }

    if (!confirm('Eliminar usuario con id ' + id + ' ?')) return;
    try {
      const res = await apiFetch(`http://localhost:8080/admin/user/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setStatus('Error: ' + (j?.error || JSON.stringify(j))); return; }
      setStatus('Usuario eliminado');
      fetchUsers();
    } catch (e) { setStatus('Fetch error: ' + e.message); }
  }

  const [userIdToDelete, setUserIdToDelete] = useState('');
  const [questionIdToDelete, setQuestionIdToDelete] = useState('');

  async function handleCreateQuestion(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const body = Object.fromEntries(fd.entries());
    setLoading(true);
    try {
      const res = await apiFetch('http://localhost:8080/admin/question', { method: 'POST', body: JSON.stringify(body) });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setStatus('Error: ' + (j?.error || JSON.stringify(j))); return; }
      setStatus('Pregunta añadida');
      ev.target.reset();
    } catch (e) { setStatus('Fetch error: ' + e.message); }
    finally { setLoading(false); }
  }

  async function handleDeleteQuestion(id) {
    if (!confirm('Eliminar pregunta ' + id + ' ?')) return;
    try {
      const res = await apiFetch(`http://localhost:8080/admin/question/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const j = await res.json().catch(()=>null);
      if (!res.ok) { setStatus('Error: ' + (j?.error || JSON.stringify(j))); return; }
      setStatus('Pregunta eliminada');
      fetchQuestions();
    } catch (e) { setStatus('Fetch error: ' + e.message); }
  }

  if (!me || me.tipoUser !== 'admin') return <div className="p-6">Acceso denegado</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4">Admin — {me.NombreUser}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4" style={{minHeight: 'auto'}}>
          <h2 className="font-semibold mb-2">Eliminar usuario por id</h2>
          <div className="flex gap-2 mb-3">
            <input value={userIdToDelete} onChange={(e)=>setUserIdToDelete(e.target.value)} placeholder="Id de usuario" className="flex-1 p-2 border" />
            <Button variant="outline" onClick={()=>handleDeleteUser(userIdToDelete)}>Eliminar</Button>
          </div>
          <div className="flex gap-2 mb-2">
            <Button onClick={() => window.location.href = '/admin/users-list'}>Ver usuarios</Button>
          </div>
          <div className="text-sm text-muted-foreground">{status}</div>
        </div>

        <div className="card p-4" style={{minHeight: 'auto'}}>
          <h2 className="font-semibold mb-2">Eliminar pregunta por id</h2>
          <div className="flex gap-2 mb-3">
            <input value={questionIdToDelete} onChange={(e)=>setQuestionIdToDelete(e.target.value)} placeholder="Id de pregunta" className="flex-1 p-2 border" />
            <Button variant="outline" onClick={()=>handleDeleteQuestion(questionIdToDelete)}>Eliminar</Button>
          </div>
          <div className="flex gap-2 mb-2">
            <Button onClick={() => window.location.href = '/admin/questions-list'}>Ver preguntas</Button>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">{status}</div>

          <div className="mt-4">
            <h3 className="font-semibold mb-2">Añadir pregunta</h3>
            <form onSubmit={handleCreateQuestion} className="space-y-2">
              <input name="pregunta" placeholder="Pregunta" className="w-full p-2 border" required />
              <input name="respuesta_correcta" placeholder="Respuesta correcta" className="w-full p-2 border" required />
              <input name="respuesta_incorrecta1" placeholder="Incorrecta 1" className="w-full p-2 border" required />
              <input name="respuesta_incorrecta2" placeholder="Incorrecta 2" className="w-full p-2 border" required />
              <input name="respuesta_incorrecta3" placeholder="Incorrecta 3" className="w-full p-2 border" required />
              <input name="tematica" placeholder="Tematica" className="w-full p-2 border" required />
              <input name="dificultad" placeholder="Dificultad" className="w-full p-2 border" required />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>Añadir pregunta</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
