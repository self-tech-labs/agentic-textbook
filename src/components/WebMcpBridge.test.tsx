import { Type } from "@sinclair/typebox";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebMcpToolDefinition } from "../lib/webmcp";
import { WebMcpBridge } from "./WebMcpBridge";

function tools(): WebMcpToolDefinition[] {
  return ["first", "second"].map((name) => ({
    name: `ogram_${name}`,
    title: name,
    description: `${name} test tool`,
    inputSchema: Type.Object({}, { additionalProperties: false }),
    execute: () => ({ ok: true }),
  }));
}

describe("WebMcpBridge", () => {
  afterEach(() => {
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
    delete window.__OGRAM_WEBMCP_TOOLS__;
    vi.restoreAllMocks();
  });

  it("reports tools as live only after their registration promises resolve", async () => {
    const registerTool = vi.fn(
      async (
        _tool: WebMcpToolDefinition,
        _options?: { signal?: AbortSignal },
      ) => undefined,
    );
    Object.defineProperty(document, "modelContext", {
      value: { registerTool },
      configurable: true,
    });
    const onStatusChange = vi.fn();

    const view = render(
      <WebMcpBridge tools={tools()} onStatusChange={onStatusChange} />,
    );

    await waitFor(() =>
      expect(onStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          supported: true,
          ready: true,
          toolCount: 2,
          registeredCount: 2,
          error: null,
        }),
      ),
    );
    expect(registerTool).toHaveBeenCalledTimes(2);
    const signal = registerTool.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);

    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("surfaces a rejected registration instead of claiming every tool is live", async () => {
    const registerTool = vi
      .fn<
        (
          tool: WebMcpToolDefinition,
          options?: { signal?: AbortSignal },
        ) => Promise<void>
      >()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("registration denied"));
    Object.defineProperty(document, "modelContext", {
      value: { registerTool },
      configurable: true,
    });
    const onStatusChange = vi.fn();

    render(<WebMcpBridge tools={tools()} onStatusChange={onStatusChange} />);

    await waitFor(() =>
      expect(onStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          supported: true,
          ready: false,
          error: "registration denied",
        }),
      ),
    );
  });

  it("does not present the development registry as native WebMCP readiness", async () => {
    const onStatusChange = vi.fn();

    render(<WebMcpBridge tools={tools()} onStatusChange={onStatusChange} />);

    await waitFor(() =>
      expect(onStatusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          supported: false,
          ready: false,
          registeredCount: 0,
        }),
      ),
    );
  });
});
