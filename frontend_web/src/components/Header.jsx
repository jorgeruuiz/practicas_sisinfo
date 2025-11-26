import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicUser, clearAuth } from '../app'

export default function Header() {
  const nav = useNavigate()
  const user = getPublicUser()

  return (
    <header className="w-full py-3 border-b bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.tipoUser !== 'admin' && (
            <button className="btn" onClick={() => nav('/menu')}>Menu</button>
          )}
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-3">
          <div>{user?.NombreUser ? `Hola, ${user.NombreUser}` : 'Invitado'}</div>
          {user?.tipoUser === 'admin' && (
            <button className="btn btn-sm" onClick={() => { clearAuth(); window.location = '/login'; }}>Logout</button>
          )}
        </div>
      </div>
    </header>
  )
}
