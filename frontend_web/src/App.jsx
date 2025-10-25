import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Menu from './pages/Menu'
import Game from './pages/Game'

export default function App() {
  return (
    <Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/menu" element={<Menu />} />
  <Route path="/game" element={<Game />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
