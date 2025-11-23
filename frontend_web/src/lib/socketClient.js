import { io } from 'socket.io-client'
import { getToken } from '../app'

let socket = null

export function getSocket() {
  // If a socket instance exists reuse it.
  if (socket) return socket

  const token = getToken()
  // If there is no token (user not authenticated) do NOT create a socket.
  // Creating a socket without a token causes the server to attempt JWT
  // verification and produce 'jwt malformed' logs.
  if (!token) {
    console.debug('[socketClient] no token available, not creating socket')
    return null
  }

  // create a singleton socket instance; token passed both in query (legacy) and auth
  // We disable autoConnect so the app can control when to start connecting.
  // Prefer 'polling' first to avoid browsers blocking websocket upgrades in some
  // development environments; Socket.IO will upgrade to websocket if available.
  socket = io('http://localhost:8080', {
    query: { token },
    auth: { token },
    transports: ['polling', 'websocket'],
    autoConnect: false,
  })

  // Start connecting explicitly; callers should call connect() to ensure
  // connection is initiated when appropriate. We attempt a connect here
  // after creating the socket to preserve previous behavior where the
  // provider immediately connects once token exists.
  try { socket.connect() } catch (e) { /* ignore */ }

  return socket
}

export function connect() {
  const s = getSocket()
  if (!s) return null
  // If the socket instance exists but is not connected, ensure it's connecting
  try { if (s && s.connect) s.connect() } catch (e) { /* ignore */ }
  return s
}

export function disconnect() {
  if (socket) {
    try { socket.disconnect() } catch (e) { /* ignore */ }
    socket = null
  }
}

export function on(event, cb) {
  const s = getSocket()
  if (!s) return
  s.on(event, cb)
}

export function off(event, cb) {
  if (!socket) return
  socket.off(event, cb)
}

export function emit(event, payload) {
  const s = getSocket()
  if (!s) return
  s.emit(event, payload)
}

export function raw() { return getSocket() }
