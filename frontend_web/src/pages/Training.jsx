import React, { useEffect, useState } from 'react';
import { requireAuthOrRedirect } from '../app';

const BASE = 'http://localhost:3000';

function shuffleArray(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Training() {
  requireAuthOrRedirect();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [stage, setStage] = useState('choose'); // 'choose' | 'quiz' | 'finished'

  useEffect(() => {
    // reset when topic changes
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setShowAnswer(false);
    setScore(0);
  }, [topic]);

  // loadQuestions accepts optional topicArg to allow immediate load when selecting from choices
  async function loadQuestions(topicArg) {
    const topicToUse = topicArg || topic;
    if (!topicToUse) return;
    setLoading(true);
    setFinished(false);
    try {
      // ensure state topic matches chosen
      if (topicArg) setTopic(topicArg);
      const q = encodeURIComponent(topicToUse);
      const res = await fetch(`${BASE}/questions/byTopic?topic=${q}&limit=10`);
      if (!res.ok) throw new Error('Failed to load');
      const j = await res.json();
      const qs = (j.questions || []).map(item => ({
        ...item,
        options: shuffleArray([
          item.respuesta_correcta,
          item.respuesta_incorrecta1,
          item.respuesta_incorrecta2,
          item.respuesta_incorrecta3
        ])
      }));
      setQuestions(qs);
      setIndex(0);
      setScore(0);
      setStage('quiz');
    } catch (e) {
      console.debug('loadQuestions error', e);
    } finally {
      setLoading(false);
    }
  }

  function chooseAnswer(ans) {
    if (showAnswer) return;
    setSelected(ans);
    setShowAnswer(true);
    if (ans === questions[index].respuesta_correcta) setScore(s => s + 1);
  }

  function next() {
    setSelected(null);
    setShowAnswer(false);
    if (index + 1 < questions.length) setIndex(i => i + 1);
    else {
      // finished
      setFinished(true);
      setStage('finished');
    }
  }

  function retrySame() {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setShowAnswer(false);
    setFinished(false);
  }

  function newRound() {
    // load new questions (could yield a different random set)
    // keep same topic, fetch new set
    setStage('quiz');
    loadQuestions(topic);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl mb-4">Entrenamiento</h1>

      <div className="card p-4 mb-4">
        {stage === 'choose' && (
          <div>
            <div className="text-sm mb-2">Selecciona una temática para entrenar</div>
            <div className="grid grid-cols-2 gap-2">
              {['CINE','CIENCIA','DEPORTES','HISTORIA'].map(t => (
                <button key={t} className="p-3 border rounded btn" onClick={() => loadQuestions(t)}>{t}</button>
              ))}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">Elige una de las temáticas para comenzar la ronda.</div>
          </div>
        )}
        {stage === 'quiz' && (
          <div className="text-sm text-gray-600">Temática: <strong>{topic}</strong></div>
        )}
      </div>

      {loading && <div className="card p-4">Cargando preguntas…</div>}

      {!loading && questions.length === 0 && !finished && (
        <div className="card p-4">No hay preguntas cargadas. Pulsa "Cargar" para obtener preguntas de la temática.</div>
      )}

      {finished && (
        <div className="card p-4">
          <h2 className="text-xl mb-2">Resumen de la sesión</h2>
          <div className="mb-2">Has respondido <strong>{score}</strong> de <strong>{questions.length}</strong> preguntas.</div>
          <div className="mb-4">Porcentaje: <strong>{questions.length > 0 ? Math.round((score / questions.length) * 100) : 0}%</strong></div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={retrySame}>Reintentar misma ronda</button>
            <button className="btn" onClick={newRound}>Nueva ronda (otras preguntas)</button>
          </div>
        </div>
      )}

      {!finished && questions.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 text-sm text-gray-600">Pregunta {index + 1} / {questions.length}</div>
          <div className="text-lg font-medium mb-3">{questions[index].pregunta}</div>
          <div className="grid gap-2">
            {questions[index].options.map((opt, i) => {
              const isCorrect = opt === questions[index].respuesta_correcta;
              const selectedClass = selected === opt ? 'ring-2 ring-blue-400' : '';
              const resultClass = showAnswer ? (isCorrect ? 'bg-green-100' : (selected === opt ? 'bg-red-100' : '')) : '';
              return (
                <button key={i} className={`p-3 text-left border rounded ${selectedClass} ${resultClass}`} onClick={() => chooseAnswer(opt)}>
                  {opt}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>Score: {score}</div>
            <div>
              <button className="btn" onClick={next} disabled={!showAnswer}>Siguiente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
