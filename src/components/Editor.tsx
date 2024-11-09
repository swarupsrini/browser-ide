// src/components/Editor.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentMetadata } from "../types";
import { FileText, Lock, Save } from "lucide-react";
import { computeDocumentChanges } from "../utils/diff-utils";
import { useLsp } from "../hooks/useLsp";
import { Position, CompletionItem } from "vscode-languageserver-types";
import DiagnosticGutter from "./DiagnosticGutter";
import { Diagnostic } from "vscode-languageserver-types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorProps {
  content: string;
  path: string | null;
  language: string;
  metadata?: DocumentMetadata;
  readOnly?: boolean;
  isDirty?: boolean;
  diagnostics?: Diagnostic[];
  onContentChange?: (content: string) => void;
  onSave?: () => void;
}

export default function Editor({
  content: initialContent,
  path,
  language,
  metadata,
  readOnly = false,
  isDirty = false,
  diagnostics,
  onContentChange,
  onSave,
}: EditorProps) {
  const [value, setValue] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [cursorPosition, setCursorPosition] = useState<Position>({
    line: 0,
    character: 0,
  });
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const { completions, requestCompletions, getHover, getDefinition } = useLsp();
  const [showCompletions, setShowCompletions] = useState(false);
  const [hoverContent, setHoverContent] = useState<string | null>(null);
  const [selectedCompletion, setSelectedCompletion] = useState(0);

  useEffect(() => {
    setValue(initialContent);
    setOriginalContent(initialContent);
  }, [initialContent]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onContentChange?.(newValue);
    },
    [onContentChange]
  );

  // Calculate cursor position and request completions if needed
  const updateCursorPosition = useCallback((target: HTMLTextAreaElement) => {
    const content = target.value;
    const pos = target.selectionStart;

    // Calculate line and column
    const textBeforeCursor = content.substring(0, pos);
    const lines = textBeforeCursor.split("\n");
    const position: Position = {
      line: lines.length - 1,
      character: lines[lines.length - 1].length,
    };

    setCursorPosition(position);
    return position;
  }, []);

  const handleSelect = useCallback(
    async (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      const position = updateCursorPosition(target);

      if (path && !readOnly) {
        // Check if we're in a completion trigger context
        const lineText = target.value.split("\n")[position.line];
        const triggerChars = [".", " "];
        const lastChar = lineText[position.character - 1];

        if (triggerChars.includes(lastChar)) {
          requestCompletions(path, position);
          setShowCompletions(true);
          setSelectedCompletion(0);
        } else {
          setShowCompletions(false);
        }
      }
    },
    [path, readOnly, requestCompletions, updateCursorPosition]
  );

  // Handle hover
  const handleMouseMove = useCallback(
    async (e: React.MouseEvent<HTMLTextAreaElement>) => {
      if (!path || readOnly || !editorRef.current) return;
      console.log("Mouse move in editor"); // Debug log

      const target = editorRef.current;
      const rect = target.getBoundingClientRect();

      // Get character position from mouse coordinates
      const charWidth = 8; // Approximate character width in pixels
      const lineHeight = 20; // Approximate line height in pixels

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate line and column
      const line = Math.floor(y / lineHeight);
      const character = Math.floor(x / charWidth);

      // Add debouncing to prevent too many calls
      const position: Position = { line, character };
      console.log("Calculated position:", position); // Debug log

      // Only trigger hover if the mouse has been still for a moment
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      hoverTimeoutRef.current = setTimeout(async () => {
        console.log("Triggering hover request", path, position); // Debug log
        const hoverResult = await getHover(path, position);
        console.log("Hover result:", hoverResult); // Debug log
        if (hoverResult) {
          const content =
            typeof hoverResult.contents === "string"
              ? hoverResult.contents
              : "value" in hoverResult.contents
              ? hoverResult.contents.value
              : Array.isArray(hoverResult.contents)
              ? hoverResult.contents.join("\n")
              : "";

          setHoverContent(content);
        } else {
          setHoverContent(null);
        }
      }, 300) as any; // 300ms delay
    },
    [path, readOnly, getHover]
  );

  // Add a reference for the hover timeout
  const hoverTimeoutRef = useRef<any>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Handle completion selection
  const applyCompletion = useCallback(
    (completion: CompletionItem) => {
      if (!editorRef.current) return;

      const target = editorRef.current;
      const pos = target.selectionStart;
      const text = target.value;

      // Find the start of the word we're completing
      let wordStart = pos;
      while (wordStart > 0 && /[\w.]/.test(text[wordStart - 1])) {
        wordStart--;
      }

      // Apply the completion
      const newText =
        text.substring(0, wordStart) +
        (completion.insertText || completion.label) +
        text.substring(pos);

      setValue(newText);
      onContentChange?.(newText);
      setShowCompletions(false);
    },
    [onContentChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle completion navigation
      if (showCompletions && completions?.items.length) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedCompletion(
            (prev) => (prev + 1) % completions.items.length
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCompletion((prev) =>
            prev === 0 ? completions.items.length - 1 : prev - 1
          );
          return;
        }
        if (e.key === "Enter" && completions.items[selectedCompletion]) {
          e.preventDefault();
          applyCompletion(completions.items[selectedCompletion]);
          return;
        }
        if (e.key === "Escape") {
          setShowCompletions(false);
          return;
        }
      }

      // Handle tab key
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;

        const newValue =
          value.substring(0, start) + "  " + value.substring(end);
        setValue(newValue);
        onContentChange?.(newValue);

        // Move cursor after the inserted tab
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }

      // Handle save shortcut (Ctrl/Cmd + S)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && onSave) {
          onSave();
        }
      }
    },
    [
      value,
      onContentChange,
      isDirty,
      onSave,
      showCompletions,
      completions,
      selectedCompletion,
      applyCompletion,
    ]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none p-2 border-b bg-background flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <h3 className="text-sm font-medium flex items-center gap-2">
            {path}
            {isDirty && <span className="text-muted-foreground">•</span>}
            {readOnly && <Lock className="w-4 h-4 text-muted-foreground" />}
          </h3>
        </div>
        <div className="flex items-center gap-4">
          {isDirty && onSave && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onSave}
              className="h-8 px-2"
            >
              <Save className="w-4 h-4" />
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Ln {cursorPosition.line + 1}, Col {cursorPosition.character + 1}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 border-none relative">
        <div className="p-4 min-h-full">
          {diagnostics && (
            <DiagnosticGutter
              diagnostics={diagnostics}
              lineCount={value.split("\n").length}
              onLineClick={(line) => {
                if (editorRef.current) {
                  // Calculate position to scroll to
                  const lines = value.split("\n");
                  const pos = lines
                    .slice(0, line)
                    .reduce((acc, curr) => acc + curr.length + 1, 0);
                  editorRef.current.focus();
                  editorRef.current.setSelectionRange(pos, pos);
                }
              }}
            />
          )}
          <textarea
            ref={editorRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onMouseMove={handleMouseMove}
            className={cn(
              "w-full h-full min-h-[calc(100vh-10rem)]",
              "font-mono text-sm",
              "bg-transparent border-none outline-none resize-none",
              "focus:ring-0 focus:outline-none",
              readOnly && "cursor-default"
            )}
            spellCheck={false}
            readOnly={readOnly}
          />

          {/* Completions popup */}
          {showCompletions && completions?.items.length && (
            <div
              className="absolute z-50 bg-popover border rounded-md shadow-lg p-1 max-h-48 overflow-y-auto"
              style={{
                left: cursorPosition.character * 8, // Approximate character width
                top: (cursorPosition.line + 1) * 20, // Approximate line height
              }}
            >
              {completions.items.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "px-2 py-1 cursor-pointer",
                    index === selectedCompletion
                      ? "bg-accent"
                      : "hover:bg-accent"
                  )}
                  onClick={() => applyCompletion(item)}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.detail && (
                    <span className="text-muted-foreground ml-2 text-sm">
                      {item.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Hover tooltip */}
          {hoverContent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute"
                    style={{
                      left: cursorPosition.character * 8,
                      top: cursorPosition.line * 20,
                    }}
                  >
                    <div className="w-1 h-1 opacity-0" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="max-w-md whitespace-pre-wrap">{hoverContent}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export { Editor };
