import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import Game from "./pages/Game";

import Register from "./pages/Register";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Header from "./components/Header";

export default function App() {
  const location = useLocation();
  const hideHeader = ["/login", "/register", "/game"].includes(location.pathname);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {!hideHeader && <Header />}
        <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/menu" element={<Menu />} />
      <Route path="/game" element={<Game />} />

      <Route path="/chat" element={<Chat />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/friends" element={<Friends />} />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </div>
  );
}
