import React from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicUser } from '../app'

export default function Header() {
  const nav = useNavigate()
  const user = getPublicUser()

  return (
    <header className="w-full py-3 border-b bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost" onClick={() => nav('/menu')}>Menu</button>
        </div>
        <div className="text-sm text-muted-foreground">
          {user?.NombreUser ? `Hola, ${user.NombreUser}` : 'Invitado'}
        </div>
      </div>
    </header>
  )
}
