import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requireAuthOrRedirect, getPublicUser, clearAuth } from '../app'
import { useSocket } from '../lib/SocketProvider'
import { disconnect as disconnectSocket } from '../lib/socketClient'

export default function Menu() {
  requireAuthOrRedirect()
  const nav = useNavigate()
  const socket = useSocket()
  const publicUser = getPublicUser()

  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!socket) return

    function onPartidaCreada(d) {
      setMessage(d?.mensaje || 'Partida creada. Esperando oponente...')
    }

    function onPartidaEncontrada(d) {
      setMessage('Partida encontrada. Preparando preguntas...')
    }

    function onPartidaCancelada(d) {
      // Server confirmed cancellation
      setSearching(false)
      setMessage(d?.mensaje || 'Búsqueda de partida cancelada')
    }

    function onPartidaLista(d) {
      // questions ready: navigate to game screen where the preguntas will be shown
      try {
        // store payload so the Game page won't miss it if it mounts after this event
        sessionStorage.setItem('partidaLista', JSON.stringify(d || {}))
      } catch (e) { /* ignore */ }
      setSearching(false)
      setMessage('')
      nav('/game')
    }

    socket.on('partidaCreada', onPartidaCreada)
    socket.on('partidaEncontrada', onPartidaEncontrada)
    socket.on('partidaLista', onPartidaLista)
  socket.on('partidaCancelada', onPartidaCancelada)

    return () => {
      socket.off('partidaCreada', onPartidaCreada)
      socket.off('partidaEncontrada', onPartidaEncontrada)
      socket.off('partidaLista', onPartidaLista)
      socket.off('partidaCancelada', onPartidaCancelada)
    }
  }, [socket, nav])

  function buscarPartidaCompetitiva() {
    if (!socket) {
      setMessage('Socket no conectado. Intenta recargar la página.')
      return
    }
    try {
      socket.emit('buscarPartida', { idJugador: publicUser.id })
      setSearching(true)
      setMessage('Buscando oponente...')
    } catch (e) {
      console.warn('emit buscarPartida failed', e)
      setMessage('Error iniciando búsqueda')
      setSearching(false)
    }
  }

  async function cancelarBusqueda() {
    if (!socket) {
      setMessage('Socket no conectado. Intenta recargar la página.')
      setSearching(false)
      return
    }
    try {
      socket.emit('cancelarBusqueda', { idJugador: publicUser.id })
      // keep UI optimistic until server confirms via 'partidaCancelada'
      setMessage('Cancelando búsqueda...')
    } catch (e) {
      console.warn('emit cancelarBusqueda failed', e)
      setMessage('Error al cancelar la búsqueda')
      setSearching(false)
    }
  }

  function logout() {
    try { disconnectSocket() } catch (_) {}
    clearAuth()
    nav('/login')
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">Menú</h1>
        <div>
          <strong>{publicUser?.NombreUser}</strong>
          <button className="ml-3 btn" onClick={logout}>Logout</button>
        </div>
      </div>

      <p className="mb-4">Bienvenido, <strong>{publicUser?.NombreUser}</strong></p>

      <div className="space-y-3">
        {!searching ? (
          <button className="btn w-full" onClick={buscarPartidaCompetitiva}>Buscar partida competitiva</button>
        ) : (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <div className="flex-1">
              <div className="font-medium">{message || 'Buscando...'}</div>
              <div className="text-sm text-gray-600">Esperando a que se encuentre un oponente.</div>
            </div>
            <div>
              <button className="btn btn-ghost" onClick={cancelarBusqueda}>Cancelar búsqueda</button>
            </div>
          </div>
        )}

        <button className="btn-outline w-full" onClick={() => nav('/profile')}>Perfil (pendiente)</button>
        <button className="btn-outline w-full" onClick={() => nav('/training')}>Entrenamiento (pendiente)</button>
      </div>
    </div>
  )
}
