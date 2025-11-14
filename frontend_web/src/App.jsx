import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import Game from "./pages/Game";

import Register from "./pages/Register";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Training from "./pages/Training";
import Header from "./components/Header";

export default function App() {
  const location = useLocation();
  const hideHeader = ["/login", "/register", "/game"].includes(location.pathname);

  return (
    <div className="min-h-screen relative">
      {/* Fondo radial global fijo (visible en todas las rutas) */}
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_50%),radial-gradient(circle_at_75%_60%,rgba(147,51,234,0.12),transparent_55%)]"
        aria-hidden="true"
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {!hideHeader && <Header />}
        <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/menu" element={<Menu />} />
      <Route path="/game" element={<Game />} />

      <Route path="/chat" element={<Chat />} />
  <Route path="/training" element={<Training />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/friends" element={<Friends />} />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  );
}
