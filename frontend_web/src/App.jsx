import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import Game from "./pages/Game";

import Register from "./pages/Register";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";

export default function App() {
  return (
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
  );
}
