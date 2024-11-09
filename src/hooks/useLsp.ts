// src/hooks/useLsp.ts

import { useCallback, useEffect, useState } from "react";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import { useWebSocketWithResponse } from "./useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { debounce } from "@/utils/debounce";
import {
  CompletionList,
  Position,
  Hover,
  Location,
  CompletionItem,
  Diagnostic,
} from "vscode-languageserver-types";
import { TextDocumentIdentifier } from "vscode-languageserver-protocol";

export function useLsp() {
  // const { sendMessage } = useWebSocketContext();
  const { sendMessage } = useWebSocketWithResponse();
  const { toast } = useToast();
  const [completions, setCompletions] = useState<CompletionList | null>(null);

  const requestCompletions = useCallback(
    debounce(async (path: string, position: Position) => {
      try {
        // Cast to unknown then string since sendMessage returns void
        const response = (await sendMessage(
          JSON.stringify({
            type: "Completion",
            content: {
              path,
              position,
            },
          })
        )) as unknown as string;

        if (!response) return;

        const data = JSON.parse(response);
        if (data.type === "CompletionResponse") {
          setCompletions(data.content.completions || null);
        } else if (data.type === "Error") {
          throw new Error(data.content.message);
        }
      } catch (error) {
        console.error("Failed to get completions:", error);
        toast({
          variant: "destructive",
          title: "Completion Error",
          description:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }, 150),
    [sendMessage, toast]
  );

  const getHover = useCallback(
    async (path: string, position: Position): Promise<Hover | null> => {
      console.log("getHover", path, position);
      try {
        const response = await sendMessage(
          JSON.stringify({
            type: "Hover",
            content: {
              path,
              position,
            },
          })
        );

        console.log("Raw response:", response);

        if (response === undefined) return null;

        const data = JSON.parse(response as string);
        if (data.type === "HoverResponse") {
          return data.content.hover;
        } else if (data.type === "Error") {
          throw new Error(data.content.message);
        }
        return null;
      } catch (error) {
        console.error("Failed to get hover info:", error);
        return null;
      }
    },
    [sendMessage]
  );

  const getDefinition = useCallback(
    async (path: string, position: Position): Promise<Location[] | null> => {
      try {
        const response = (await sendMessage(
          JSON.stringify({
            type: "Definition",
            content: {
              path,
              position,
            },
          })
        )) as unknown as string;

        if (!response) return null;

        const data = JSON.parse(response);
        if (data.type === "DefinitionResponse") {
          return data.content.locations;
        } else if (data.type === "Error") {
          throw new Error(data.content.message);
        }
        return null;
      } catch (error) {
        console.error("Failed to get definition:", error);
        return null;
      }
    },
    [sendMessage]
  );

  // Add diagnostics support
  const [diagnostics, setDiagnostics] = useState<Map<string, Diagnostic[]>>(
    new Map()
  );

  return {
    completions,
    requestCompletions,
    getHover,
    getDefinition,
    diagnostics,
  };
}
