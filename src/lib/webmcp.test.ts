import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLearningCanvas, type CanvasActions } from "../hooks/useLearningCanvas";
import {
  activeToolNames,
  createLearnTools,
  registerLearnTools,
  type WebMcpToolDefinition,
} from "./webmcp";

function findTool(actions: CanvasActions, name: string): WebMcpToolDefinition {
  const match = createLearnTools(actions).find((tool) => tool.name === name);
  if (!match) throw new Error(`Missing tool ${name}.`);
  return match;
}

function startPublishedTransformer(actions: CanvasActions): string {
  const started = findTool(actions, "learn_begin_session").execute({
    topic: "How transformers work",
  }) as { nonce: string };
  actions.skipContext();
  const beforePrepare = actions.getState();
  findTool(actions, "learn_prepare_lesson").execute({
    nonce: started.nonce,
    baseRevision: beforePrepare.revision,
    idempotencyKey: "prepare-published-transformer-01",
    template: "transformer_technical_beginner",
  });
  const draft = actions.getState().lesson.draft;
  if (!draft) throw new Error("Expected a compiled draft.");
  actions.approveLesson(draft.revision);
  const beforePublish = actions.getState();
  findTool(actions, "learn_publish_lesson").execute({
    nonce: started.nonce,
    baseRevision: beforePublish.revision,
    draftRevision: draft.revision,
    idempotencyKey: "publish-published-transformer-01",
  });
  return started.nonce;
}

describe("learn.ogram v3 WebMCP surface", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__OGRAM_WEBMCP_TOOLS__;
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("publishes eleven tools while exposing only bootstrap before the handshake", async () => {
    const { result } = renderHook(() => useLearningCanvas());
    const tools = createLearnTools(result.current.actions);
    expect(tools.map((tool) => tool.name)).toEqual([
      "learn_begin_session",
      "learn_get_context",
      "learn_propose_context",
      "learn_get_session",
      "learn_prepare_lesson",
      "learn_publish_lesson",
      "learn_get_canvas_snapshot",
      "learn_patch_region",
      "learn_inject_widget",
      "learn_attach_research",
      "learn_revert_region",
    ]);
    expect(activeToolNames("ready", false)).toEqual(["learn_begin_session"]);
    expect(() =>
      findTool(result.current.actions, "learn_get_session").execute({ nonce: "not-a-valid-session" }),
    ).toThrow(/call learn_begin_session first/i);

    const registration = await registerLearnTools(
      result.current.actions,
      "ready",
      false,
    );
    expect(registration.supported).toBe(false);
    expect(registration.toolNames).toEqual(["learn_begin_session"]);
    expect(Object.keys(window.__OGRAM_WEBMCP_TOOLS__ ?? {})).toHaveLength(11);
    registration.cleanup();
    expect(window.__OGRAM_WEBMCP_TOOLS__).toBeUndefined();
  });

  it("rotates native tool groups with abortable stage lifecycles", async () => {
    const { result } = renderHook(() => useLearningCanvas());
    const registerTool = vi.fn();
    Object.defineProperty(document, "modelContext", {
      value: { registerTool },
      configurable: true,
    });

    const bootstrap = await registerLearnTools(
      result.current.actions,
      "ready",
      false,
    );
    expect(registerTool).toHaveBeenCalledTimes(1);
    const bootstrapSignal = registerTool.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(bootstrapSignal.aborted).toBe(false);
    bootstrap.cleanup();
    expect(bootstrapSignal.aborted).toBe(true);

    registerTool.mockClear();
    let nonce = "";
    act(() => {
      nonce = (
        findTool(result.current.actions, "learn_begin_session").execute({
          topic: "How transformers work",
        }) as { nonce: string }
      ).nonce;
    });
    expect(nonce).toMatch(/^session-nonce-/);
    const context = await registerLearnTools(
      result.current.actions,
      "context_review",
      true,
    );
    expect(context.toolNames).toHaveLength(6);
    expect(context.toolNames).toContain("learn_prepare_lesson");
    expect(context.toolNames).not.toContain("learn_inject_widget");
    context.cleanup();
  });

  it("requires consent coverage and separate learner review before personalization", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    let nonce = "";
    act(() => {
      nonce = (
        findTool(actions, "learn_begin_session").execute({
          topic: "How transformers work",
        }) as { nonce: string }
      ).nonce;
    });
    const revision = actions.getState().revision;
    const claim = {
      id: "claim-connected-context",
      kind: "current_project",
      summary: "The learner is prototyping a small JavaScript language-model visualization.",
      source: {
        route: "connected_mcp",
        providerId: "figma",
        providerLabel: "Figma",
        resourceType: "selected-frame summary",
      },
      sensitivity: "low",
      allowedPurposes: ["lesson personalization"],
      evidenceRef: "figma-opaque-frame-01",
    };

    expect(() =>
      findTool(actions, "learn_propose_context").execute({
        nonce,
        baseRevision: revision,
        idempotencyKey: "context-missing-provider-01",
        consent: {
          obtainedAt: "2026-08-31T14:00:00Z",
          scope: "Use this conversation context only for this lesson.",
          providerIds: ["codex-conversation"],
        },
        claims: [claim],
      }),
    ).toThrow(/does not cover context provider figma/i);

    act(() => {
      findTool(actions, "learn_propose_context").execute({
        nonce,
        baseRevision: revision,
        idempotencyKey: "context-covered-provider-01",
        consent: {
          obtainedAt: "2026-08-31T14:00:00Z",
          scope: "Use the summarized Figma context only for this lesson.",
          providerIds: ["figma"],
        },
        claims: [claim],
      });
    });
    expect(actions.getState().session.personalization).toBe("reviewing");
    expect(actions.getState().contextClaims[0]?.review).toBe("pending");
    expect(() =>
      findTool(actions, "learn_prepare_lesson").execute({
        nonce,
        baseRevision: actions.getState().revision,
        idempotencyKey: "prepare-before-context-review-01",
        template: "transformer_technical_beginner",
      }),
    ).toThrow(/must be reviewed/i);

    act(() => {
      actions.reviewContextClaim({
        claimId: "claim-connected-context",
        decision: "accepted",
      });
    });
    expect(actions.getState().session.personalization).toBe("approved");
    act(() => {
      findTool(actions, "learn_prepare_lesson").execute({
        nonce,
        baseRevision: actions.getState().revision,
        idempotencyKey: "prepare-after-context-review-01",
        template: "transformer_technical_beginner",
      });
    });
    expect(actions.getState().lesson.draft?.approvedClaimIds).toEqual([
      "claim-connected-context",
    ]);
  });

  it("rejects publication without exact learner approval", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    let nonce = "";
    act(() => {
      nonce = (
        findTool(actions, "learn_begin_session").execute({
          topic: "How transformers work",
        }) as { nonce: string }
      ).nonce;
      actions.skipContext();
    });
    act(() => {
      findTool(actions, "learn_prepare_lesson").execute({
        nonce,
        baseRevision: actions.getState().revision,
        idempotencyKey: "prepare-exact-approval-01",
      });
    });
    const state = actions.getState();
    expect(state.lesson.validation?.valid).toBe(true);
    expect(() =>
      findTool(actions, "learn_publish_lesson").execute({
        nonce,
        baseRevision: state.revision,
        draftRevision: state.lesson.draft!.revision,
        idempotencyKey: "publish-without-approval-01",
      }),
    ).toThrow(/exact compiled revision/i);

    act(() => actions.approveLesson(state.lesson.draft!.revision));
    expect(() =>
      findTool(actions, "learn_publish_lesson").execute({
        nonce,
        baseRevision: actions.getState().revision,
        draftRevision: state.lesson.draft!.revision + 1,
        idempotencyKey: "publish-wrong-revision-01",
      }),
    ).toThrow(/exact compiled revision/i);
  });

  it("keeps scoped region writes idempotent, concurrency-safe, undoable, and separate from learner evidence", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    let nonce = "";
    act(() => {
      nonce = startPublishedTransformer(actions);
    });

    act(() => {
      actions.submitLearnerResponse("next-token-practice", "next-token");
    });
    const responseBefore = structuredClone(
      actions.getState().regions.find((region) => region.id === "next-token-practice")?.response,
    );
    const target = actions
      .getState()
      .regions.find((region) => region.id === "next-token-practice")!;
    let firstResult: { regionRevision: number; undoToken: string } | null = null;
    act(() => {
      firstResult = findTool(actions, "learn_patch_region").execute({
        nonce,
        regionId: target.id,
        baseRegionRevision: target.revision,
        idempotencyKey: "patch-practice-explanation-01",
        operation: "append",
        rationale: "Distinguish logits from normalized probabilities.",
        content: [
          {
            type: "prose",
            text: "The model first produces logits. Softmax converts them into a probability distribution over the vocabulary.",
          },
        ],
      }) as { regionRevision: number; undoToken: string };
    });
    if (!firstResult) throw new Error("Expected a patch result.");

    const retry = findTool(actions, "learn_patch_region").execute({
      nonce,
      regionId: target.id,
      baseRegionRevision: target.revision,
      idempotencyKey: "patch-practice-explanation-01",
      operation: "append",
      rationale: "Distinguish logits from normalized probabilities.",
      content: [{ type: "prose", text: "Retry payload is ignored by idempotency." }],
    }) as { regionRevision: number; undoToken: string };
    expect(retry).toEqual(firstResult);
    expect(() =>
      findTool(actions, "learn_patch_region").execute({
        nonce,
        regionId: target.id,
        baseRegionRevision: target.revision,
        idempotencyKey: "patch-practice-stale-02",
        operation: "append",
        rationale: "A deliberately stale write.",
        content: [{ type: "prose", text: "This content must not be applied." }],
      }),
    ).toThrow(/stale region revision/i);

    expect(
      actions.getState().regions.find((region) => region.id === target.id)?.response,
    ).toEqual(responseBefore);
    act(() => {
      findTool(actions, "learn_revert_region").execute({
        nonce,
        regionId: target.id,
        baseRegionRevision: firstResult!.regionRevision,
        idempotencyKey: "revert-practice-explanation-01",
        undoToken: firstResult!.undoToken,
      });
    });
    const restored = actions.getState().regions.find((region) => region.id === target.id)!;
    expect(restored.content.some((block) => block.type === "prose" && block.text.includes("logits"))).toBe(false);
    expect(restored.response).toEqual(responseBefore);
  });

  it("reports focus and attaches bounded research to the requested region", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    let nonce = "";
    act(() => {
      nonce = startPublishedTransformer(actions);
      actions.focusRegion("self-attention", "Query–key scores are normalized with softmax");
    });
    const snapshot = findTool(actions, "learn_get_canvas_snapshot").execute({ nonce }) as {
      focusedRegionId: string;
      selectedText: string;
      rendererCapabilities: { sandboxWidget: { network: boolean } };
    };
    expect(snapshot.focusedRegionId).toBe("self-attention");
    expect(snapshot.selectedText).toMatch(/softmax/i);
    expect(snapshot.rendererCapabilities.sandboxWidget.network).toBe(false);

    const region = actions.getState().regions.find((item) => item.id === "self-attention")!;
    act(() => {
      findTool(actions, "learn_attach_research").execute({
        nonce,
        regionId: region.id,
        baseRegionRevision: region.revision,
        idempotencyKey: "attach-attention-paper-01",
        summary:
          "The original architecture uses scaled dot-product attention and parallel attention heads.",
        sources: [
          {
            id: "attention-is-all-you-need",
            title: "Attention Is All You Need",
            url: "https://arxiv.org/abs/1706.03762",
            publisher: "arXiv",
            publishedAt: "2017",
            claim: "Introduces the Transformer architecture built around attention mechanisms.",
          },
        ],
      });
    });
    const updated = actions.getState().regions.find((item) => item.id === region.id)!;
    expect(updated.content.at(-1)).toMatchObject({
      type: "source_cards",
      sources: [expect.objectContaining({ publisher: "arXiv" })],
    });
  });

  it("restores the v3 notebook without restoring its nonce", () => {
    const first = renderHook(() => useLearningCanvas());
    act(() => {
      startPublishedTransformer(first.result.current.actions);
    });
    first.unmount();

    const restored = renderHook(() => useLearningCanvas());
    expect(restored.result.current.state.version).toBe(3);
    expect(restored.result.current.state.session.stage).toBe("learning");
    expect(restored.result.current.actions.getNonce()).toBeNull();
    expect(activeToolNames("learning", false)).toEqual(["learn_begin_session"]);

    let resumed = { resumed: false, nonce: "" };
    act(() => {
      resumed = findTool(
        restored.result.current.actions,
        "learn_begin_session",
      ).execute({ topic: "How transformers work" }) as {
        resumed: boolean;
        nonce: string;
      };
    });
    expect(resumed).toMatchObject({ resumed: true });
    expect(resumed.nonce).toMatch(/^session-nonce-/);
    expect(activeToolNames("learning", true)).toHaveLength(11);
  });

  it("rejects oversized widget programs before changing the region", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    let nonce = "";
    act(() => {
      nonce = startPublishedTransformer(actions);
    });
    const region = actions.getState().regions.find((item) => item.id === "self-attention")!;
    expect(() =>
      findTool(actions, "learn_inject_widget").execute({
        nonce,
        regionId: region.id,
        baseRegionRevision: region.revision,
        idempotencyKey: "oversized-widget-program-01",
        title: "Too large",
        html: "<div>Fallback remains available.</div>",
        css: "body{}",
        javascript: "x".repeat(24_577),
        accessibleSummary: "A widget payload that is deliberately too large to run.",
        height: 240,
        rationale: "Exercise the sandbox size gate.",
      }),
    ).toThrow(/javascript exceeds 24 kb/i);
    expect(actions.getState().regions.find((item) => item.id === region.id)?.revision).toBe(
      region.revision,
    );
  });
});
