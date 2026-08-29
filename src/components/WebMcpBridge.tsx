import { useEffect, useState } from "react";
import type { WebMcpToolDefinition } from "../lib/webmcp";

export interface WebMcpBridgeStatus {
  supported: boolean;
  ready: boolean;
  toolCount: number;
  registeredCount: number;
  toolNames: string[];
  error: string | null;
}

interface WebMcpBridgeProps {
  tools: WebMcpToolDefinition[];
  onStatusChange: (status: WebMcpBridgeStatus) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function WebMcpBridge({ tools, onStatusChange }: WebMcpBridgeProps) {
  const [supported, setSupported] = useState(
    () => typeof document.modelContext?.registerTool === "function",
  );

  useEffect(() => {
    if (supported) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      if (typeof document.modelContext?.registerTool === "function") {
        window.clearInterval(timer);
        setSupported(true);
      } else if ((attempts += 1) >= 20) {
        window.clearInterval(timer);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [supported]);

  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.MODE === "test") {
      window.__OGRAM_WEBMCP_TOOLS__ = Object.fromEntries(
        tools.map((tool) => [tool.name, tool]),
      );
      return () => {
        delete window.__OGRAM_WEBMCP_TOOLS__;
      };
    }
  }, [tools]);

  useEffect(() => {
    const toolNames = tools.map((tool) => tool.name);
    if (!supported || !document.modelContext) {
      onStatusChange({
        supported: false,
        ready: false,
        toolCount: tools.length,
        registeredCount: 0,
        toolNames,
        error: null,
      });
      return;
    }

    const controller = new AbortController();
    let active = true;
    let registeredCount = 0;

    onStatusChange({
      supported: true,
      ready: false,
      toolCount: tools.length,
      registeredCount: 0,
      toolNames,
      error: null,
    });

    void Promise.all(
      tools.map(async (tool) => {
        await document.modelContext!.registerTool(tool, {
          signal: controller.signal,
        });
        if (!active) return;
        registeredCount += 1;
        onStatusChange({
          supported: true,
          ready: registeredCount === tools.length,
          toolCount: tools.length,
          registeredCount,
          toolNames,
          error: null,
        });
      }),
    ).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return;
      controller.abort();
      onStatusChange({
        supported: true,
        ready: false,
        toolCount: tools.length,
        registeredCount,
        toolNames,
        error: errorMessage(error),
      });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [onStatusChange, supported, tools]);

  return null;
}
