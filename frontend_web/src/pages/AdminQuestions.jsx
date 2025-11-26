import React, { useEffect, useState } from 'react';
import { requireAuthOrRedirect, getPublicUser } from '../app';
import { useNavigate } from 'react-router-dom';

export default function AdminQuestions() {
  requireAuthOrRedirect();
  const me = getPublicUser();
  const nav = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!me || me.tipoUser !== 'admin') return;
    fetchQuestions();
  }, [me]);

  async function fetchQuestions() {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/admin/questions');
      const j = await res.json().catch(() => null);
      if (res.ok) setQuestions(j.questions || []);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }

  if (!me || me.tipoUser !== 'admin') return <div className="p-6">Acceso denegado</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4">Preguntas — {me.NombreUser}</h1>
      <div className="mb-4">
        <button className="btn" onClick={() => nav('/admin')}>Volver</button>
      </div>
      <div className="card p-4">
        <h2 className="font-semibold mb-2">Listado de preguntas (id — pregunta)</h2>
        <div className="space-y-2 max-h-96 overflow-auto">
          {questions.map(q => (
            <div key={q.id} className="border p-2 rounded">
              <div className="font-medium">{q.id} — {q.pregunta}</div>
              <div className="text-xs text-muted-foreground">Temática: {q.tematica} — Dificultad: {q.dificultad}</div>
            </div>
          ))}
          {questions.length === 0 && <div className="text-sm text-muted-foreground">No hay preguntas</div>}
        </div>
      </div>
    </div>
  );
}
