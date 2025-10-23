import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requireAuthOrRedirect, getPublicUser, clearAuth } from '../app'
import { disconnect as disconnectSocket } from '../lib/socketClient'
import { useSocket } from '../lib/SocketProvider'

function shuffleArray(arr) {
  const copy = arr.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function Game() {
  const nav = useNavigate()
  useEffect(() => { requireAuthOrRedirect() }, [])
  const publicUser = getPublicUser()

  const socket = useSocket()

  const [status, setStatus] = useState('idle') // idle|waiting|match
  const [last, setLast] = useState(null)
  const [match, setMatch] = useState(null)
  // matchWithOptions stores match where each question includes a stable 'options' array
  const [matchWithOptions, setMatchWithOptions] = useState(null)
  const [answers, setAnswers] = useState({})

  useEffect(() => {
    if (!socket) return
    socket.on('connect', () => setStatus(s => s))
    socket.on('disconnect', () => { setStatus('idle') })
    socket.on('partidaLista', (data) => {
      setLast(data)
      setMatch(data)
      // prepare stable options for each question
      const prepared = { ...data, preguntas: (data.preguntas || []).map(q => {
        // collect possible answers, ignore falsy/missing ones
        const rawOptions = [
          { text: q.respuesta_correcta, isCorrect: true },
          q.respuesta_incorrecta1 ? { text: q.respuesta_incorrecta1, isCorrect: false } : null,
          q.respuesta_incorrecta2 ? { text: q.respuesta_incorrecta2, isCorrect: false } : null,
          q.respuesta_incorrecta3 ? { text: q.respuesta_incorrecta3, isCorrect: false } : null,
        ].filter(Boolean)

        // deterministic-ish shuffle using question id (falls back to random)
        const seed = q.id || Math.floor(Math.random()*1e9)
        const shuffled = rawOptions.slice()
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.abs((seed + i) % (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }

        // ensure each option has text and isCorrect
        const finalOptions = shuffled.map(o => ({ text: o.text || '', isCorrect: !!o.isCorrect }))
        return { ...q, options: finalOptions }
      }) }
      setMatchWithOptions(prepared)
      setAnswers({})
      setStatus('match')
    })
    socket.on('partidaFinalizada', (d) => { setLast(d); setStatus('idle'); setMatch(null); setMatchWithOptions(null) })
    socket.on('partidaCreada', (d) => { setLast(d) })

    return () => {
      socket.off('partidaLista')
      socket.off('partidaFinalizada')
      socket.off('partidaCreada')
    }
  }, [socket])

  function buscarPartida() {
    if (!socket) return
    socket.emit('buscarPartida', { idJugador: publicUser.id })
    setStatus('waiting')
  }

  function logout() { clearAuth(); nav('/login') }

  // Disconnect the socket and clear auth
  function logoutAndDisconnect() {
    try { disconnectSocket() } catch (e) { /* ignore */ }
    clearAuth()
    nav('/login')
  }

  function selectOption(qIdx, optIdx) {
    setAnswers(a => ({ ...a, [qIdx]: optIdx }))
  }

  function comprobar() {
    if (!matchWithOptions) return
    const preguntas = matchWithOptions.preguntas || []
    let total = 0
    let totalPreguntasValidas = 0
    preguntas.forEach((q, idx) => {
      const sel = answers[idx]
      const options = q.options || []
      // Only consider this pregunta if it has at least one option
      if (!options || options.length === 0) return
      totalPreguntasValidas++
      if (sel == null) return
      if (sel < 0 || sel >= options.length) return
      if (options[sel] && options[sel].isCorrect) total++
    })
    if (socket) socket.emit('reportResults', { partidaId: matchWithOptions.partidaId, idJugador: publicUser.id, totalAciertos: total, totalPreguntasValidas })
    setStatus('waiting')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl">Cuestionados - Juego</h1>
        <div>
          <strong>{publicUser?.NombreUser} ({publicUser?.id})</strong>
          <button className="ml-2 btn" onClick={logoutAndDisconnect}>Logout</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2">
          {status === 'idle' && (
            <div className="card">
              <p>Pulsa <strong>Buscar partida</strong> para empezar una partida competitiva.</p>
              <button className="btn mt-3" onClick={buscarPartida}>Buscar partida</button>
            </div>
          )}

          {status === 'waiting' && (
            <div className="card">Buscando oponente... espera.</div>
          )}

          {status === 'match' && matchWithOptions && (
            <div className="card">
              <h3 className="text-lg">Partida {matchWithOptions.partidaId}</h3>
              <div className="mt-3 space-y-3">
                {(matchWithOptions.preguntas || []).map((q, qi) => {
                  const options = Array.isArray(q.options) ? q.options : []
                  const safeOptions = options.filter(Boolean)
                  return (
                    <div key={qi} className="p-3 border rounded">
                      <div className="font-semibold">Pregunta {qi + 1}: {q.pregunta}</div>
                      <div className="mt-2 space-y-1">
                                {safeOptions.map((opt, oi) => (
                                  <label key={oi} className="block">
                                    <input type="radio" name={`q_${qi}`} checked={answers[qi] === oi} onChange={() => selectOption(qi, oi)} />
                                    <span className="ml-2">{(opt && opt.text) || ''}</span>
                                  </label>
                                ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4">
                <button className="btn" onClick={comprobar}>Comprobar respuestas</button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            {/* right column intentionally left empty for simpler UI */}
          </div>
        </div>
      </div>
    </div>
  )
}
