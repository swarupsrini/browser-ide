import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { useToast } from "./use-toast";
import { useCallback } from "react";

export function useWebSocketWithResponse() {
  const {
    sendMessage: rawSendMessage,
    lastMessage,
    readyState,
  } = useWebSocketContext();
  const { toast } = useToast();

  const sendMessageWithResponse = useCallback(
    async (message: string): Promise<string> => {
      if (readyState !== 1) {
        throw new Error("WebSocket not connected");
      }

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Server response timeout"));
        }, 5000);

        const messageHandler = (event: MessageEvent) => {
          clearTimeout(timeoutId);
          resolve(event.data);
        };

        const errorHandler = (error: Event) => {
          clearTimeout(timeoutId);
          reject(error);
        };

        // Add temporary listeners for this message
        const ws = (lastMessage as any)?.target;
        if (ws) {
          ws.addEventListener("message", messageHandler, { once: true });
          ws.addEventListener("error", errorHandler, { once: true });
        }

        rawSendMessage(message);
      });
    },
    [rawSendMessage, lastMessage, readyState]
  );

  return {
    sendMessage: sendMessageWithResponse,
    readyState,
  };
}
