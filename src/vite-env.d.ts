/// <reference types="vite/client" />

import type { WebMcpToolDefinition } from "./lib/webmcp";

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: WebMcpToolDefinition,
        options?: { signal?: AbortSignal },
      ): Promise<void>;
    };
  }

  interface Window {
    __OGRAM_WEBMCP_TOOLS__?: Record<string, WebMcpToolDefinition>;
    ogramDesktop?: {
      learning?: {
        publishEvent(event: unknown): Promise<{ eventId?: string }>;
        openJourney?(capsuleId: string): Promise<void>;
      };
    };
  }
}

export {};
