import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { WebMcpToolDefinition } from "./lib/webmcp";

function tool(name: string): WebMcpToolDefinition {
  const match = window.__OGRAM_WEBMCP_TOOLS__?.[name];
  if (!match) throw new Error(`Missing fallback tool ${name}.`);
  return match;
}

describe("learn.ogram v3", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__OGRAM_WEBMCP_TOOLS__;
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("starts as a passive agent-native canvas with no in-page conversation", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /learn a difficult idea/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ask codex/i })).not.toBeInTheDocument();
    expect(screen.getByText(/start in the conversation on the left/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/open this page in codex desktop/i)).toBeInTheDocument(),
    );

    await waitFor(() => expect(tool("learn_begin_session")).toBeDefined());
    await waitFor(() => expect(screen.getByText(/1 tools · v3/i)).toBeInTheDocument());
  });

  it("does not race native registration during React development remounts", async () => {
    const registerTool = vi.fn(async () => undefined);
    Object.defineProperty(document, "modelContext", {
      value: { registerTool },
      configurable: true,
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/site-tool registration failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/open this page in codex desktop/i)).not.toBeInTheDocument();
  });

  it("runs the generic transformers path, focuses a region, and accepts a reversible widget", async () => {
    render(<App />);
    await waitFor(() => expect(window.__OGRAM_WEBMCP_TOOLS__).toBeDefined());

    let nonce = "";
    await act(async () => {
      const result = tool("learn_begin_session").execute({
        topic: "How transformers work",
        goal: "Understand enough to explain self-attention.",
      }) as { nonce: string; guide: string[] };
      nonce = result.nonce;
      expect(result.guide).toHaveLength(5);
    });

    expect(
      screen.getByRole("heading", { name: /context stays proposed until you say yes/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/self-attention/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(window.__OGRAM_WEBMCP_TOOLS__?.learn_get_session).toBeDefined(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /continue without personal context/i }),
    );
    const beforeDraft = tool("learn_get_session").execute({ nonce }) as {
      revision: number;
    };

    await act(async () => {
      tool("learn_prepare_lesson").execute({
        nonce,
        baseRevision: beforeDraft.revision,
        idempotencyKey: "prepare-transformers-generic-01",
        template: "transformer_technical_beginner",
      });
    });

    expect(
      screen.getByRole("heading", { name: /how transformers build context/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(window.__OGRAM_WEBMCP_TOOLS__?.learn_get_session).toBeDefined(),
    );
    fireEvent.click(screen.getByRole("button", { name: /approve this lesson/i }));

    const approved = tool("learn_get_session").execute({ nonce }) as {
      revision: number;
      lesson: { draftRevision: number };
    };
    await act(async () => {
      tool("learn_publish_lesson").execute({
        nonce,
        baseRevision: approved.revision,
        draftRevision: approved.lesson.draftRevision,
        idempotencyKey: "publish-transformers-generic-01",
      });
    });

    expect(
      screen.getByRole("heading", { name: /self-attention: gather the useful context/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/query–key scores are normalized with softmax/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what is the training target/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(window.__OGRAM_WEBMCP_TOOLS__?.learn_get_canvas_snapshot).toBeDefined(),
    );

    const attentionHeading = screen.getByRole("heading", {
      name: /self-attention: gather the useful context/i,
    });
    const attentionRegion = attentionHeading.closest("section");
    if (!attentionRegion) throw new Error("Expected the attention region.");
    fireEvent.pointerDown(attentionRegion);

    const snapshot = tool("learn_get_canvas_snapshot").execute({ nonce }) as {
      focusedRegionId: string;
      regions: Array<{ id: string; revision: number }>;
    };
    expect(snapshot.focusedRegionId).toBe("self-attention");
    const attention = snapshot.regions.find((region) => region.id === "self-attention");
    if (!attention) throw new Error("Expected the semantic attention region.");

    await act(async () => {
      tool("learn_inject_widget").execute({
        nonce,
        regionId: "self-attention",
        baseRegionRevision: attention.revision,
        idempotencyKey: "inject-three-token-softmax-01",
        title: "Three-token softmax playground",
        html: '<main><label>Score <input id="score" type="range" min="0" max="10" /></label><output id="value">0</output></main>',
        css: "body{padding:24px;background:#f4f7ef;color:#173f31} main{display:grid;gap:16px} input{width:100%}",
        javascript:
          "const score=document.querySelector('#score');const value=document.querySelector('#value');score.addEventListener('input',()=>{value.textContent=score.value;window.learnOgram.emit('score',score.value)});",
        accessibleSummary:
          "A slider changes one of three attention scores so the learner can observe the normalized weight change.",
        height: 240,
        rationale: "Show softmax with three manipulable token scores.",
      });
    });

    const widgetHeading = screen.getByRole("heading", {
      name: /three-token softmax playground/i,
    });
    expect(widgetHeading).toBeInTheDocument();
    const widget = widgetHeading.closest("section");
    if (!widget) throw new Error("Expected the sandbox card.");
    const iframe = within(widget).getByTitle(/three-token softmax playground/i);
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    expect(iframe).not.toHaveAttribute("sandbox", expect.stringContaining("allow-same-origin"));
    expect(iframe.getAttribute("srcdoc")).toContain("connect-src 'none'");
    expect(iframe.getAttribute("srcdoc")).toContain("form-action 'none'");
    expect(iframe.getAttribute("srcdoc")).toContain("navigate-to 'none'");
    expect(within(attentionRegion).getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("keeps connector context proposed until the learner reviews each minimized claim", async () => {
    render(<App />);
    await waitFor(() => expect(window.__OGRAM_WEBMCP_TOOLS__).toBeDefined());
    let nonce = "";
    let revision = 0;
    await act(async () => {
      const started = tool("learn_begin_session").execute({
        topic: "How transformers work",
      }) as { nonce: string; revision: number };
      nonce = started.nonce;
      revision = started.revision;
    });
    await waitFor(() =>
      expect(window.__OGRAM_WEBMCP_TOOLS__?.learn_propose_context).toBeDefined(),
    );

    await act(async () => {
      tool("learn_propose_context").execute({
        nonce,
        baseRevision: revision,
        idempotencyKey: "propose-two-context-claims-01",
        consent: {
          obtainedAt: "2026-08-31T14:00:00.000Z",
          scope: "Propose relevant conversation and calendar context for this lesson only.",
          providerIds: ["codex-conversation", "google-calendar"],
        },
        claims: [
          {
            id: "claim-coding-baseline",
            kind: "prior_knowledge",
            summary: "The learner writes JavaScript but is new to machine-learning math.",
            source: {
              route: "conversation",
              providerId: "codex-conversation",
              providerLabel: "This Codex conversation",
              resourceType: "learner statement",
            },
            sensitivity: "low",
            allowedPurposes: ["lesson personalization"],
            evidenceRef: "conversation-turn-opaque-01",
          },
          {
            id: "claim-time-box",
            kind: "business_constraint",
            summary: "The learner has a twenty-minute study window before the next meeting.",
            source: {
              route: "connected_mcp",
              providerId: "google-calendar",
              providerLabel: "Google Calendar",
              resourceType: "availability summary",
            },
            sensitivity: "personal",
            allowedPurposes: ["lesson pacing"],
            evidenceRef: "calendar-availability-opaque-01",
          },
        ],
      });
    });

    expect(screen.getByText(/writes javascript but is new/i)).toBeInTheDocument();
    expect(screen.getByText(/twenty-minute study window/i)).toBeInTheDocument();
    const useButtons = screen.getAllByRole("button", { name: /use this/i });
    expect(useButtons).toHaveLength(2);
    fireEvent.click(useButtons[0]!);
    fireEvent.click(useButtons[1]!);

    const context = tool("learn_get_context").execute({ nonce }) as {
      acceptedClaimIds: string[];
      personalization: string;
    };
    expect(context.personalization).toBe("approved");
    expect(context.acceptedClaimIds).toEqual([
      "claim-coding-baseline",
      "claim-time-box",
    ]);
  });
});
