import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveAuth } from '../app'
import { connect as connectSocket } from '../lib/socketClient'

export default function Login() {
  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')
  const [status, setStatus] = useState('')
  const nav = useNavigate()

  async function doLogin() {
    if (!nombre || !clave) { setStatus('Rellena ambos campos'); return }
    setStatus('Logging...')
    try {
      const res = await fetch('http://localhost:3000/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ NombreUser: nombre, Contrasena: clave })
      })
      const j = await res.json()
      if (!res.ok) { setStatus('Login error: ' + JSON.stringify(j)); return }
      saveAuth(j.accessToken, j.publicUser)
  // Create the socket connection once we've stored the token
  try { connectSocket() } catch (e) { console.warn('socket connect failed', e) }
      nav('/game')
    } catch (err) { setStatus('Fetch error: ' + err.message) }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl mb-4">Login (React)</h1>
      <div className="mb-2">
        <input className="w-full p-2 border rounded" placeholder="NombreUser" value={nombre} onChange={e => setNombre(e.target.value)} />
      </div>
      <div className="mb-2">
        <input className="w-full p-2 border rounded" placeholder="Contrasena" value={clave} onChange={e => setClave(e.target.value)} type="password" />
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={doLogin}>Login</button>
      </div>
      <pre className="mt-4">{status}</pre>
    </div>
  )
}
