// src/contexts/WebSocketContext.tsx
"use client";

import React, { createContext, useContext, ReactNode } from "react";
import useWebSocket from "react-use-websocket";

const WebSocketContext = createContext<ReturnType<typeof useWebSocket> | null>(
  null
);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsInstance = useWebSocket("ws://localhost:8080", {
    retryOnError: true,
    onOpen: () => console.log("WebSocket connection opened"),
    shouldReconnect: () => true,
  });

  return (
    <WebSocketContext.Provider value={wsInstance}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
};
