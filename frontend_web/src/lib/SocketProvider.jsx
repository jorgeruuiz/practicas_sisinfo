import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getSocket,
  connect,
  raw as rawSocket,
  disconnect,
} from "./socketClient";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const listenersAttached = useRef(false);
  // Do not auto-connect on mount. Connection is created explicitly after login
  // by calling `connect()` from `socketClient`. This provider will pick up
  // the singleton socket instance on demand and attach listeners once.

  function ensureSocketRef() {
    if (socketRef.current) return socketRef.current;
    const s = getSocket();
    if (!s) return null;
    socketRef.current = s;
    if (!listenersAttached.current) {
      listenersAttached.current = true;
      s.on("connect", () => setConnected(true));
      s.on("disconnect", () => setConnected(false));
      // keep other events silent in UI; infra-level errors can be
      // inspected through browser devtools network/console if needed
    }
    return s;
  }

  const api = {
    raw: () => getSocket(),
    on: (ev, cb) => {
      const s = ensureSocketRef();
      if (s) s.on(ev, cb);
    },
    off: (ev, cb) => {
      const s = socketRef.current || getSocket();
      if (s) s.off(ev, cb);
    },
    emit: (ev, payload) => {
      const s = socketRef.current || getSocket();
      if (s) s.emit(ev, payload);
    },
    connected,
  };

  return (
    <SocketContext.Provider value={api}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
