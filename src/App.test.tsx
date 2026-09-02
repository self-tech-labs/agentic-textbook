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

describe("learn.ogram v4", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__OGRAM_WEBMCP_TOOLS__;
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("starts as a passive personal canvas with no in-page conversation", async () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /bring any question/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ask codex/i })).not.toBeInTheDocument();
    expect(screen.getByText(/use the lesson brief i prepared/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /topic or question/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /personalize from recent codex tasks/i })).toBeChecked();
    await waitFor(() =>
      expect(screen.getByText(/open this page in codex desktop/i)).toBeInTheDocument(),
    );

    await waitFor(() => expect(tool("learn_begin_session")).toBeDefined());
    await waitFor(() => expect(screen.getByText(/^preview$/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /choose context/i }));
    expect(screen.getByText(/context reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(/past work, projects/i)).toBeInTheDocument();
  });

  it("does not race native registration during React development remounts", async () => {
    const registerTool = vi.fn(
      async (
        _definition: WebMcpToolDefinition,
        _options?: { signal?: AbortSignal },
      ) => undefined,
    );
    Object.defineProperty(document, "modelContext", {
      value: { registerTool },
      configurable: true,
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(3));
    expect(registerTool.mock.calls.map(([definition]) => definition.name)).toEqual([
      "learn_get_start_brief",
      "learn_get_authoring_capabilities",
      "learn_begin_session",
    ]);
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
    const lessonDeck = document.querySelector(".lesson-deck");
    const lessonSlots = lessonDeck?.querySelectorAll<HTMLElement>(".lesson-slot");
    expect(document.documentElement).toHaveClass("has-lesson-deck");
    expect(lessonSlots).toHaveLength(6);
    expect(lessonSlots?.[0]).toHaveAttribute("id", "region-transformer-goal");
    expect(lessonSlots?.[0]).toHaveAttribute("data-canvas-region", "transformer-goal");
    expect(lessonSlots?.[0]).toHaveAttribute("data-panel-mode", "screen");
    expect(lessonSlots?.[0]?.querySelectorAll(".lesson-scene-marker")).toHaveLength(2);
    expect(lessonSlots?.[0]?.querySelector(".lesson-panel > section")).toBeInTheDocument();
    expect(
      await screen.findByText(/query–key scores are normalized with softmax/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what is the training target/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show tokens scene 2 of 2/i }));
    fireEvent.click(screen.getByRole("button", { name: /inspect token model/i }));
    expect(screen.getByText("“model”").parentElement).toHaveTextContent(
      /starts with a learned vector/i,
    );
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

    const widgetHeading = await screen.findByRole("heading", {
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
          sourceScopes: ["current_conversation", "connected_sources"],
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
    expect(screen.queryByText(/twenty-minute study window/i)).not.toBeInTheDocument();
    expect(screen.getByText(/proposal 1 of 2/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /use this/i })).toHaveLength(1);
    const correctButton = screen.getByRole("button", {
      name: /correct before using/i,
    });
    expect(screen.getAllByRole("button", { name: /don’t use/i })).toHaveLength(1);
    fireEvent.click(correctButton);
    fireEvent.change(
      screen.getByRole("textbox", { name: /correct this learning signal/i }),
      {
        target: {
          value:
            "The learner writes TypeScript and wants a concise introduction to machine-learning math.",
        },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /save correction \+ use/i }),
    );
    expect(screen.getByText(/twenty-minute study window/i)).toBeInTheDocument();
    expect(screen.getByText(/proposal 2 of 2/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /use this/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /use this/i }));

    expect(screen.getByText(/your context choices are complete/i)).toBeInTheDocument();
    expect(screen.getByText(/2 approved · 0 left out/i)).toBeInTheDocument();

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

  it("ends on a clear completion screen after the final required response", async () => {
    render(<App />);
    await waitFor(() => expect(window.__OGRAM_WEBMCP_TOOLS__).toBeDefined());
    let nonce = "";
    await act(async () => {
      nonce = (
        tool("learn_begin_session").execute({ topic: "How transformers work" }) as {
          nonce: string;
        }
      ).nonce;
    });
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
        idempotencyKey: "prepare-completion-ui-01",
        template: "transformer_technical_beginner",
      });
    });
    fireEvent.click(screen.getByRole("button", { name: /approve this lesson/i }));

    await waitFor(() =>
      expect(window.__OGRAM_WEBMCP_TOOLS__?.learn_get_session).toBeDefined(),
    );
    const approved = tool("learn_get_session").execute({ nonce }) as {
      revision: number;
      lesson: { draftRevision: number };
    };
    await act(async () => {
      tool("learn_publish_lesson").execute({
        nonce,
        baseRevision: approved.revision,
        draftRevision: approved.lesson.draftRevision,
        idempotencyKey: "publish-completion-ui-01",
      });
    });

    fireEvent.click(
      screen.getByRole("button", { name: /show practice scene 2 of 2/i }),
    );
    const choiceHeading = screen.getByRole("heading", {
      name: /what is the model trained to produce/i,
    });
    const choiceBox = choiceHeading.closest(".learner-interaction");
    if (!choiceBox) throw new Error("Expected the choice interaction.");
    fireEvent.click(
      within(choiceBox as HTMLElement).getByRole("radio", {
        name: /probability distribution for the next token/i,
      }),
    );
    fireEvent.click(
      within(choiceBox as HTMLElement).getByRole("button", { name: /save my answer/i }),
    );
    expect(screen.queryByRole("heading", { name: /you finished the lesson/i })).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /show reflect scene 2 of 2/i }),
    );
    const reflectionHeading = screen.getByRole("heading", {
      name: /how does a transformer turn text into a next-token prediction/i,
    });
    const reflectionBox = reflectionHeading.closest(".learner-interaction");
    if (!reflectionBox) throw new Error("Expected the reflection interaction.");
    fireEvent.change(within(reflectionBox as HTMLElement).getByRole("textbox"), {
      target: {
        value:
          "Text becomes tokens and vectors; attention gathers relevant context through repeated blocks before the model predicts a distribution for the next token.",
      },
    });
    fireEvent.click(
      within(reflectionBox as HTMLElement).getByRole("button", { name: /save my answer/i }),
    );

    expect(screen.getByRole("heading", { name: /you finished the lesson/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start a new lesson/i })).toBeInTheDocument();
    expect(screen.getByText(/lesson complete · evidence saved/i)).toBeInTheDocument();
  });

  it("renders progressive lesson construction as each region arrives", async () => {
    render(<App />);
    await waitFor(() => expect(window.__OGRAM_WEBMCP_TOOLS__).toBeDefined());
    let nonce = "";
    await act(async () => {
      nonce = (
        tool("learn_begin_session").execute({ topic: "How transformers work" }) as {
          nonce: string;
        }
      ).nonce;
    });
    await waitFor(() =>
      expect(window.__OGRAM_WEBMCP_TOOLS__?.learn_get_session).toBeDefined(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /continue without personal context/i }),
    );

    const beforeStart = tool("learn_get_session").execute({ nonce }) as {
      revision: number;
    };
    let revision = beforeStart.revision;
    let draftRevision = 0;
    let firstRegionId = "";
    await act(async () => {
      const started = tool("learn_prepare_lesson").execute({
        nonce,
        baseRevision: revision,
        idempotencyKey: "ui-progressive-start-01",
        phase: "start",
        template: "transformer_technical_beginner",
      }) as { revision: number; draftRevision: number; regionIds: string[] };
      revision = started.revision;
      draftRevision = started.draftRevision;
      firstRegionId = started.regionIds[0]!;
    });

    expect(screen.getByText(/0 of 6 sections ready/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/folded notebook preview/i)).toBeInTheDocument();
    expect(screen.getByText(/new sections will appear here one by one/i)).toBeInTheDocument();
    expect(screen.queryByText(/json|catalog|region commits|governed components/i)).not.toBeInTheDocument();

    await act(async () => {
      tool("learn_prepare_lesson").execute({
        nonce,
        baseRevision: revision,
        idempotencyKey: "ui-progressive-region-01",
        phase: "region",
        template: "transformer_technical_beginner",
        draftRevision,
        regionId: firstRegionId,
      });
    });

    expect(screen.getByText(/1 of 6 sections ready/i)).toBeInTheDocument();
    expect(await screen.findByText(/now shaping tokens become vectors/i)).toBeInTheDocument();
    expect(document.querySelector('[data-json-render="ogram.learning.v1"]')).not.toBeInTheDocument();
    expect(document.querySelectorAll(".folded-notebook__sections li.is-ready")).toHaveLength(1);
  });
});
