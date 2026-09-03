import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SandboxedWidget } from "./SandboxedWidget";

const widget = {
  type: "sandbox_widget" as const,
  widgetId: "softmax-timeout-fixture",
  title: "Three-token softmax playground",
  html: "<button>Change score</button>",
  css: "body { padding: 20px; }",
  javascript: "document.querySelector('button').addEventListener('click', () => {});",
  accessibleSummary:
    "Three token scores are normalized into weights; changing one score changes all three weights.",
  height: 240,
};

describe("SandboxedWidget", () => {
  afterEach(() => vi.useRealTimers());

  it("uses a no-origin, no-network iframe contract", () => {
    render(<SandboxedWidget widget={widget} />);
    const iframe = screen.getByTitle(widget.title);
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
    const source = iframe.getAttribute("srcdoc") ?? "";
    expect(source).toContain("default-src 'none'");
    expect(source).toContain("connect-src 'none'");
    expect(source).toContain("form-action 'none'");
    expect(source).toContain("navigate-to 'none'");
    expect(source).toContain("document.addEventListener('submit'");
  });

  it("removes a widget that misses the ready deadline and preserves its text fallback", () => {
    vi.useFakeTimers();
    render(<SandboxedWidget widget={widget} />);
    expect(screen.getByTitle(widget.title)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_001));

    expect(screen.queryByTitle(widget.title)).not.toBeInTheDocument();
    expect(screen.getByText(/interaction did not start/i)).toBeInTheDocument();
    expect(screen.getAllByText(widget.accessibleSummary).length).toBeGreaterThan(0);
  });

  it("offers an external stop control and keyboard-independent restart", () => {
    render(<SandboxedWidget widget={widget} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.queryByTitle(widget.title)).not.toBeInTheDocument();
    expect(screen.getByText(/interaction stopped/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start again/i }));
    expect(screen.getByTitle(widget.title)).toBeInTheDocument();
  });

  it("applies bounded height updates reported by the sandbox", () => {
    render(<SandboxedWidget widget={widget} />);
    const iframe = screen.getByTitle(widget.title) as HTMLIFrameElement;
    const resize = (height: number) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: iframe.contentWindow,
          data: {
            channel: "learn-ogram-widget-v3",
            widgetId: widget.widgetId,
            type: "resize",
            height,
          },
        }),
      );
    };

    act(() => resize(520));
    expect(iframe).toHaveStyle({ height: "520px" });

    act(() => resize(2_000));
    expect(iframe).toHaveStyle({ height: "720px" });

    act(() => resize(20));
    expect(iframe).toHaveStyle({ height: "180px" });
  });
});
