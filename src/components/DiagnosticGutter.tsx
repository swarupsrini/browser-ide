import React from "react";
import { AlertCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DiagnosticGutterProps {
  diagnostics: Diagnostic[];
  lineCount: number;
  onLineClick?: (line: number) => void;
}

const getSeverityIcon = (severity?: DiagnosticSeverity) => {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return <XCircle className="w-4 h-4 text-red-500" />;
    case DiagnosticSeverity.Warning:
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case DiagnosticSeverity.Information:
      return <Info className="w-4 h-4 text-blue-500" />;
    case DiagnosticSeverity.Hint:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
    default:
      return null;
  }
};

export default function DiagnosticGutter({
  diagnostics,
  lineCount,
  onLineClick,
}: DiagnosticGutterProps) {
  // Group diagnostics by line
  const diagnosticsByLine = React.useMemo(() => {
    const map = new Map<number, Diagnostic[]>();
    diagnostics.forEach((diagnostic) => {
      const line = diagnostic.range.start.line;
      const existing = map.get(line) || [];
      map.set(line, [...existing, diagnostic]);
    });
    return map;
  }, [diagnostics]);

  return (
    <div className="flex flex-col border-r border-border w-6">
      {Array.from({ length: lineCount }, (_, i) => {
        const lineDiagnostics = diagnosticsByLine.get(i);
        if (!lineDiagnostics?.length) return <div key={i} className="h-6" />;

        return (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="h-6 flex items-center justify-center hover:bg-accent"
                  onClick={() => onLineClick?.(i)}
                >
                  {getSeverityIcon(lineDiagnostics[0].severity)}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <div className="flex flex-col gap-2">
                  {lineDiagnostics.map((diagnostic, index) => (
                    <div key={index} className="flex items-start gap-2">
                      {getSeverityIcon(diagnostic.severity)}
                      <span className="text-sm">{diagnostic.message}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
