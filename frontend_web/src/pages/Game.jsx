import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requireAuthOrRedirect, getPublicUser, clearAuth } from '../app'
import { disconnect as disconnectSocket } from '../lib/socketClient'
import { useSocket } from '../lib/SocketProvider'

// Minimal Preguntados-style single-question UI
export default function Game() {
  requireAuthOrRedirect()
  const nav = useNavigate()
  const socket = useSocket()
  const publicUser = getPublicUser()

  const [status, setStatus] = useState('loading') // loading|match|waitingForOpponent|finished
  const [players, setPlayers] = useState([]) // [{id, NombreUser}]
  const [preguntas, setPreguntas] = useState([])
  const [partidaId, setPartidaId] = useState(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({}) // index -> selected option index
  const [revealed, setRevealed] = useState({}) // index -> bool
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    // If Menu stored a partidaLista in sessionStorage (navigation race), use it
    try {
      const raw = sessionStorage.getItem('partidaLista')
      if (raw) {
        const d = JSON.parse(raw)
        const rows = Array.isArray(d?.preguntas) ? d.preguntas : []
        setPartidaId(d?.partidaId ?? null)
        const prepared = rows.map(q => {
          const rawOptions = [
            { text: q.respuesta_correcta, isCorrect: true },
            q.respuesta_incorrecta1 ? { text: q.respuesta_incorrecta1, isCorrect: false } : null,
            q.respuesta_incorrecta2 ? { text: q.respuesta_incorrecta2, isCorrect: false } : null,
            q.respuesta_incorrecta3 ? { text: q.respuesta_incorrecta3, isCorrect: false } : null,
          ]
          // filter out missing or blank texts
          const present = rawOptions.filter(o => o && (o.text ?? '').toString().trim() !== '')
          const seed = q.id || Math.floor(Math.random() * 1e9)
          const shuffled = rawOptions.slice()
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.abs((seed + i) % (i + 1))
            const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
          }
          const options = shuffled.map(o => ({ text: (o && o.text) ? o.text.toString().trim() : '', isCorrect: !!(o && o.isCorrect) }))
          return { id: q.id, pregunta: q.pregunta || '', options }
        })
        if (prepared.length) {
          setPreguntas(prepared)
          setAnswers({})
          setRevealed({})
          setCurrent(0)
          setSummary(null)
          setStatus('match')
        }
        sessionStorage.removeItem('partidaLista')
      }
    } catch (e) { /* ignore malformed storage */ }

    if (!socket) return

    function onPartidaEncontrada(d) {
      const raw = Array.isArray(d?.jugadores) ? d.jugadores : (d?.players || [])
      const list = (raw || []).map(p => (p && typeof p === 'object') ? { id: p.id, NombreUser: p.NombreUser } : { id: p, NombreUser: undefined })
      setPlayers(list)
    }

    function onPartidaLista(d) {
      const rows = Array.isArray(d?.preguntas) ? d.preguntas : []
      setPartidaId(d?.partidaId ?? null)
      const prepared = rows.map(q => {
        const rawOptions = [
          { text: q.respuesta_correcta, isCorrect: true },
          q.respuesta_incorrecta1 ? { text: q.respuesta_incorrecta1, isCorrect: false } : null,
          q.respuesta_incorrecta2 ? { text: q.respuesta_incorrecta2, isCorrect: false } : null,
          q.respuesta_incorrecta3 ? { text: q.respuesta_incorrecta3, isCorrect: false } : null,
        ]
        const present = rawOptions.filter(o => o && (o.text ?? '').toString().trim() !== '')

        // deterministic shuffle using id when possible
        const seed = q.id || Math.floor(Math.random() * 1e9)
        const shuffled = rawOptions.slice()
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.abs((seed + i) % (i + 1))
          const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp
        }
        const options = shuffled.map(o => ({ text: (o && o.text) ? o.text.toString().trim() : '', isCorrect: !!(o && o.isCorrect) }))
        return { id: q.id, pregunta: q.pregunta || '', options }
      })
      setPreguntas(prepared)
      setAnswers({})
      setRevealed({})
      setCurrent(0)
      setSummary(null)
      setStatus('match')
    }

    function onPartidaFinalizada(d) {
      setSummary(d || null)
      setStatus('finished')
    }

    socket.on('partidaEncontrada', onPartidaEncontrada)
    socket.on('partidaLista', onPartidaLista)
    socket.on('partidaFinalizada', onPartidaFinalizada)

    return () => {
      socket.off('partidaEncontrada', onPartidaEncontrada)
      socket.off('partidaLista', onPartidaLista)
      socket.off('partidaFinalizada', onPartidaFinalizada)
    }
  }, [socket])

  function logoutAndGoLogin() {
    try { disconnectSocket() } catch (_) {}
    clearAuth()
    nav('/login')
  }

  function selectOption(optIdx) {
    if (revealed[current]) return
    setAnswers(a => ({ ...a, [current]: optIdx }))
    setRevealed(r => ({ ...r, [current]: true }))
  }

  function goPrev() { setCurrent(c => Math.max(0, c - 1)) }
  function goNext() { setCurrent(c => Math.min(preguntas.length - 1, c + 1)) }

  function finalizeAndSend() {
    // compute totals
    let total = 0
    let valid = 0
    preguntas.forEach((q, idx) => {
      const opts = Array.isArray(q.options) ? q.options : []
      if (!opts || opts.length === 0) return
      valid++
      const sel = answers[idx]
      if (sel == null) return
      if (opts[sel] && opts[sel].isCorrect) total++
    })
    if (socket && preguntas.length) {
      try {
        socket.emit('reportResults', { partidaId: partidaId, idJugador: publicUser.id, totalAciertos: total, totalPreguntasValidas: valid })
      } catch (e) { /* ignore */ }
    }
    setStatus('waitingForOpponent')
  }

  // minimal UI: show only what's necessary
  // When Game is shown it's expected the user is in an active match or awaiting questions.
  // Show a small loading state while partidaLista hasn't arrived yet.
  if (status === 'loading') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl">Cuestionados - Juego</h1>
          <div>
              <strong>{publicUser?.NombreUser}</strong>
            </div>
        </div>
        <div className="card p-4">Cargando partida... espera.</div>
      </div>
    )
  }

  if (status === 'waitingForOpponent') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card p-4">
          <div>Has enviado tus respuestas. Esperando a que el rival termine...</div>
        </div>
      </div>
    )
  }

  if (status === 'finished' && summary) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card p-4">
          <h3 className="text-lg mb-2">Resumen</h3>
          <div className="mb-2">Ganador: {summary.ganador ? (summary.ganador === publicUser.id ? 'Tú' : ((summary.jugadores || []).find(j => j.id === summary.ganador)?.nombre || summary.ganador)) : 'Empate'}</div>
          <table className="w-full table-auto">
            <thead>
              <tr><th className="p-2">Jugador</th><th className="p-2">Aciertos</th><th className="p-2">Variación</th></tr>
            </thead>
            <tbody>
              {(summary.jugadores || []).map((p, i) => (
                <tr key={i} className="border-t"><td className="p-2">{p.nombre || p.id}</td><td className="p-2">{p.reportedAciertos}</td><td className="p-2">{p.variacion >= 0 ? `+${p.variacion}` : p.variacion}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            <button className="btn" onClick={() => { setSummary(null); setStatus('loading'); setPlayers([]); setPreguntas([]); setPartidaId(null); nav('/menu') }}>Volver al menú</button>
          </div>
        </div>
      </div>
    )
  }

  // match state: show current question only
  if (status === 'match' && preguntas.length) {
    const q = preguntas[current] || { pregunta: '', options: [] }
    const opts = Array.isArray(q.options) ? q.options : []
    const sel = answers[current]
    const isRevealed = !!revealed[current]
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl">Cuestionados</h1>
          <div>
            <strong>{publicUser?.NombreUser}</strong>
            <button className="ml-2 btn" onClick={logoutAndGoLogin}>Logout</button>
          </div>
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-2">Pregunta {current + 1} / {preguntas.length}</div>
          <div className="p-6 border rounded mb-4 min-h-[6rem] text-lg">{q.pregunta}</div>
          <div className="space-y-3 max-h-[40vh] overflow-auto">
            {opts.map((opt, i) => {
              const text = (opt && opt.text) ? opt.text : ''
              const correct = !!(opt && opt.isCorrect)
              let cls = 'p-4 border rounded cursor-pointer min-h-[3rem] flex items-center'
              if (isRevealed) {
                if (correct) cls += ' bg-green-100 border-green-500'
                else if (sel === i) cls += ' bg-red-100 border-red-500'
                else cls += ' bg-white'
              } else {
                cls += ' hover:bg-gray-50'
              }
              return (
                <div key={i} className={cls} onClick={() => selectOption(i)}>
                  <div className="text-base">{text}</div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button className="btn" disabled={current === 0} onClick={goPrev}>← Anterior</button>
            {current < preguntas.length - 1 ? (
              <button className="btn" onClick={goNext}>Siguiente →</button>
            ) : (
              <button className="btn-primary" onClick={finalizeAndSend}>Finalizar</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // default: minimal waiting
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="card p-4">Esperando partida...</div>
    </div>
  )
}