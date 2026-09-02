import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLearningCanvas, type CanvasActions } from "../hooks/useLearningCanvas";
import { transformerLessonFixture } from "../domain/transformerFixture";
import { createLessonBrief } from "../domain/lessonCatalog";
import { saveLessonBrief } from "./lessonBriefPersistence";
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

describe("learn.ogram v4 WebMCP surface", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__OGRAM_WEBMCP_TOOLS__;
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("publishes fifteen tools while exposing only the three bootstrap tools", async () => {
    const { result } = renderHook(() => useLearningCanvas());
    const tools = createLearnTools(result.current.actions);
    expect(tools.map((tool) => tool.name)).toEqual([
      "learn_get_start_brief",
      "learn_get_authoring_capabilities",
      "learn_begin_session",
      "learn_get_context",
      "learn_propose_context",
      "learn_get_session",
      "learn_prepare_lesson",
      "learn_register_asset",
      "learn_register_code_exercise",
      "learn_publish_lesson",
      "learn_get_canvas_snapshot",
      "learn_patch_region",
      "learn_inject_widget",
      "learn_attach_research",
      "learn_revert_region",
    ]);
    expect(activeToolNames("ready", false)).toEqual([
      "learn_get_start_brief",
      "learn_get_authoring_capabilities",
      "learn_begin_session",
    ]);
    expect(() =>
      findTool(result.current.actions, "learn_get_session").execute({ nonce: "not-a-valid-session" }),
    ).toThrow(/call learn_begin_session first/i);

    const registration = await registerLearnTools(
      result.current.actions,
      "ready",
      false,
    );
    expect(registration.supported).toBe(false);
    expect(registration.toolNames).toEqual([
      "learn_get_start_brief",
      "learn_get_authoring_capabilities",
      "learn_begin_session",
    ]);
    expect(Object.keys(window.__OGRAM_WEBMCP_TOOLS__ ?? {})).toHaveLength(15);
    registration.cleanup();
    expect(window.__OGRAM_WEBMCP_TOOLS__).toBeUndefined();
  });

  it("labels learner-authored and externally sourced outputs as untrusted", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const tools = createLearnTools(result.current.actions);
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

    for (const name of [
      "learn_get_start_brief",
      "learn_get_context",
      "learn_get_session",
      "learn_get_canvas_snapshot",
      "learn_propose_context",
      "learn_register_asset",
      "learn_attach_research",
    ]) {
      expect(byName[name]?.annotations?.untrustedContentHint, name).toBe(true);
    }

    expect(
      byName.learn_get_authoring_capabilities?.annotations?.untrustedContentHint,
    ).toBe(false);
    expect(byName.learn_get_start_brief?.annotations?.readOnlyHint).toBe(true);
    expect(byName.learn_propose_context?.annotations?.readOnlyHint).toBe(false);
  });

  it("describes every bootstrap argument within the model-facing budget", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const begin = findTool(result.current.actions, "learn_begin_session");
    const properties = begin.inputSchema.properties as Record<
      string,
      { description?: unknown }
    >;

    for (const [name, property] of Object.entries(properties)) {
      expect(property.description, name).toEqual(expect.any(String));
      expect((property.description as string).length, name).toBeLessThanOrEqual(150);
    }
  });

  it("reads a generic saved brief and the registry before a session exists", () => {
    const brief = createLessonBrief({
      topic: "How plate tectonics reshape continents",
      desiredOutcome: "Explain one convergent and one divergent boundary.",
      preferredModes: ["visual", "scenario"],
      personalizeFromRecentTasks: false,
    });
    saveLessonBrief(brief);
    const { result } = renderHook(() => useLearningCanvas());
    const startBrief = findTool(
      result.current.actions,
      "learn_get_start_brief",
    ).execute({}) as {
      brief: typeof brief;
      personalizationRequested: boolean;
      instruction: string;
    };
    expect(startBrief).toMatchObject({
      brief: {
        id: brief.id,
        topic: "How plate tectonics reshape continents",
      },
      personalizationRequested: false,
      instruction: "Use the lesson brief I prepared on this page.",
    });

    const capabilities = findTool(
      result.current.actions,
      "learn_get_authoring_capabilities",
    ).execute({}) as {
      schemaVersion: number;
      content: Record<string, unknown>;
      exercises: Record<string, unknown>;
      blueprints: Record<string, unknown>;
      limits: { minimumRegions: number; maximumRegions: number };
    };
    expect(capabilities).toMatchObject({
      schemaVersion: 4,
      limits: { minimumRegions: 3, maximumRegions: 20 },
    });
    expect(Object.keys(capabilities.content)).toEqual(
      expect.arrayContaining(["formula", "diagram", "code_example", "media"]),
    );
    expect(Object.keys(capabilities.exercises)).toEqual(
      expect.arrayContaining(["choice", "reflection", "numeric", "code_lab"]),
    );
    expect(Object.keys(capabilities.blueprints)).toContain("open_topic_v1");
  });

  it("minimizes recent-task signals, ranks the topic radar, and falls back without history", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    const begin = findTool(actions, "learn_begin_session");
    expect(() =>
      begin.execute({
        topic: "Codex workflows",
        contextPack: {
          generatedAt: "2026-09-01T12:00:00.000Z",
          lookbackDays: 30,
          inspectedTaskCount: 1,
          signals: [
            {
              id: "raw-task-id-must-disappear",
              summary: "The learner repeatedly asks for browser-based verification.",
              kind: "preference",
              observedAt: "2026-07-01T12:00:00.000Z",
              sourceLabel: "Recent tasks",
            },
          ],
        },
      }),
    ).toThrow(/lookback window/i);

    expect(() =>
      begin.execute({
        topic: "Codex workflows",
        contextPack: {
          generatedAt: "2026-09-01T12:00:00.000Z",
          lookbackDays: 30,
          inspectedTaskCount: 0,
          signals: [],
          topicRadar: [
            {
              id: "unsourced-community-idea",
              topic: "Community pattern",
              summary: "An idea that cannot enter the radar without its source.",
              retrievedAt: "2026-09-01T12:00:00.000Z",
              learnerRelevance: 0.5,
              officialRecency: 0,
              communityCorroboration: 0.4,
              authority: "community_exploration",
            },
          ],
        },
      }),
    ).toThrow(/dated community source/i);

    expect(() =>
      begin.execute({
        topic: "Codex workflows",
        contextPack: {
          generatedAt: "2026-09-01T12:00:00.000Z",
          lookbackDays: 30,
          inspectedTaskCount: 0,
          signals: [],
          topicRadar: [
            {
              id: "stale-community-idea",
              topic: "Old community pattern",
              summary: "A source outside the momentum window must not affect ranking.",
              retrievedAt: "2026-09-01T12:00:00.000Z",
              learnerRelevance: 0.5,
              officialRecency: 0,
              communityCorroboration: 0.4,
              authority: "community_exploration",
              communitySources: [
                {
                  url: "https://community.example/old-pattern",
                  publishedAt: "2026-07-01T12:00:00.000Z",
                },
              ],
            },
          ],
        },
      }),
    ).toThrow(/previous 30 days/i);

    act(() => {
      begin.execute({
        topic: "Codex workflows",
        blueprintId: "codex_current_personalized_v1",
        contextPack: {
          generatedAt: "2026-09-01T12:00:00.000Z",
          lookbackDays: 30,
          inspectedTaskCount: 2,
          signals: [
            {
              id: "raw-task-id-must-disappear",
              summary: "The learner repeatedly asks for browser-based verification.",
              kind: "preference",
              confidence: 0.8,
              observedAt: "2026-08-28T12:00:00.000Z",
              sourceLabel: "Recent tasks",
            },
          ],
          topicRadar: [
            {
              id: "lower",
              topic: "Worktrees",
              summary: "A lower-ranked official module.",
              officialUrl: "https://learn.chatgpt.com/docs/app",
              officialPublishedAt: "2026-08-20T12:00:00.000Z",
              retrievedAt: "2026-09-01T12:00:00.000Z",
              learnerRelevance: 0.2,
              officialRecency: 0.4,
              communityCorroboration: 0.2,
              authority: "official",
              communitySources: [
                {
                  url: "https://community.example/worktrees",
                  publishedAt: "2026-08-25T12:00:00.000Z",
                  publisher: "Community example",
                },
              ],
            },
            {
              id: "higher",
              topic: "Computer Use",
              summary: "A highly relevant current module.",
              officialUrl: "https://learn.chatgpt.com/docs/computer-use",
              officialPublishedAt: "2026-08-28T12:00:00.000Z",
              retrievedAt: "2026-09-01T12:00:00.000Z",
              learnerRelevance: 1,
              officialRecency: 0.8,
              communityCorroboration: 0.5,
              authority: "official",
              communitySources: [
                {
                  url: "https://community.example/computer-use",
                  publishedAt: "2026-08-30T12:00:00.000Z",
                  publisher: "Community example",
                },
              ],
            },
          ],
        },
      });
    });
    expect(actions.getState().contextClaims[0]).toMatchObject({
      id: "context-signal-1",
      evidenceRef: "derived-task-summary:1",
      review: "pending",
    });
    expect(JSON.stringify(actions.getState().contextClaims)).not.toContain(
      "raw-task-id-must-disappear",
    );
    expect(actions.getState().topicRadar.map((signal) => signal.id)).toEqual([
      "higher",
      "lower",
    ]);
    expect(actions.getState().topicRadar[0]?.communitySources?.[0]).toMatchObject({
      publishedAt: "2026-08-30T12:00:00.000Z",
    });

    window.localStorage.clear();
    const fallback = renderHook(() => useLearningCanvas());
    let fallbackNonce = "";
    act(() => {
      fallbackNonce = (
        findTool(fallback.result.current.actions, "learn_begin_session").execute({
          topic: "Linear functions",
          blueprintId: "algebra_functions_v1",
          personalizeFromRecentTasks: true,
        }) as { nonce: string }
      ).nonce;
    });
    expect(fallback.result.current.actions.getState().session.personalization).toBe(
      "skipped",
    );
    expect(() =>
      findTool(fallback.result.current.actions, "learn_prepare_lesson").execute({
        nonce: fallbackNonce,
        baseRevision: fallback.result.current.actions.getState().revision,
        idempotencyKey: "history-unavailable-fallback-01",
        blueprintId: "algebra_functions_v1",
      }),
    ).not.toThrow();
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
    expect(registerTool).toHaveBeenCalledTimes(3);
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
    expect(context.toolNames).toHaveLength(10);
    expect(context.toolNames).toContain("learn_prepare_lesson");
    expect(context.toolNames).not.toContain("learn_inject_widget");
    context.cleanup();
  });

  it("makes past Codex history a first-class, consent-scoped context route", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    let started!: {
      nonce: string;
      revision: number;
      contextDiscoveryPolicy: {
        guidance: string;
        scopes: ReadonlyArray<{ id: string }>;
      };
      visualOutputPolicy: { destination: string; guidance: string };
    };
    act(() => {
      started = findTool(actions, "learn_begin_session").execute({
        topic: "How transformers work",
      }) as typeof started;
    });

    expect(started.contextDiscoveryPolicy.guidance).toMatch(/past Codex tasks/i);
    expect(started.contextDiscoveryPolicy.scopes.map((scope) => scope.id)).toContain(
      "project_history",
    );
    expect(started.visualOutputPolicy).toMatchObject({
      destination: "webmcp_canvas_only",
    });
    expect(started.visualOutputPolicy.guidance).toMatch(/do not create.*inline visualization/i);

    act(() => {
      findTool(actions, "learn_propose_context").execute({
        nonce: started.nonce,
        baseRevision: started.revision,
        idempotencyKey: "context-from-codex-history-01",
        consent: {
          obtainedAt: "2026-09-01T09:00:00Z",
          scope: "Inspect relevant past Codex tasks for this lesson only.",
          providerIds: ["codex-tasks"],
          sourceScopes: ["codex_history"],
        },
        claims: [
          {
            id: "claim-history-baseline",
            kind: "prior_knowledge",
            summary: "The learner has previously built React interfaces but has not studied attention math.",
            source: {
              route: "codex_history",
              providerId: "codex-tasks",
              providerLabel: "Past Codex tasks",
              resourceType: "task summary",
            },
            sensitivity: "low",
            allowedPurposes: ["lesson depth"],
            evidenceRef: "codex-task-opaque-01",
          },
        ],
      });
    });

    expect(actions.getState().contextClaims[0]?.source.route).toBe("codex_history");
    expect(actions.getState().session.contextConsent?.sourceScopes).toEqual([
      "codex_history",
    ]);
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
          sourceScopes: ["current_conversation"],
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
          sourceScopes: ["connected_sources"],
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

  it("rejects publication without exact learner approval", async () => {
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
        template: "transformer_technical_beginner",
      });
    });
    const state = actions.getState();
    expect(state.lesson.validation?.valid).toBe(true);
    await expect(
      findTool(actions, "learn_publish_lesson").execute({
        nonce,
        baseRevision: state.revision,
        draftRevision: state.lesson.draft!.revision,
        idempotencyKey: "publish-without-approval-01",
      }),
    ).rejects.toThrow(/exact compiled revision/i);

    act(() => actions.approveLesson(state.lesson.draft!.revision));
    await expect(
      findTool(actions, "learn_publish_lesson").execute({
        nonce,
        baseRevision: actions.getState().revision,
        draftRevision: state.lesson.draft!.revision + 1,
        idempotencyKey: "publish-wrong-revision-01",
      }),
    ).rejects.toThrow(/exact compiled revision/i);
  });

  it("shapes a lesson region by region before compiling the exact draft", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    const started = findTool(actions, "learn_begin_session").execute({
      topic: "How transformers work",
    }) as { nonce: string };
    act(() => actions.skipContext());

    const document = structuredClone(transformerLessonFixture);
    const outline = {
      id: document.id,
      revision: document.revision,
      topic: document.topic,
      title: document.title,
      subtitle: document.subtitle,
      audience: document.audience,
      estimatedMinutes: document.estimatedMinutes,
      objective: document.objective,
      approvedClaimIds: document.approvedClaimIds,
      regions: document.regions.map((region) => ({
        id: region.id,
        order: region.order,
        label: region.label,
        title: region.title,
        objective: region.objective,
        kind: region.kind,
      })),
    };

    let revision = actions.getState().revision;
    act(() => {
      const shaped = findTool(actions, "learn_prepare_lesson").execute({
        nonce: started.nonce,
        baseRevision: revision,
        idempotencyKey: "start-progressive-transformer-01",
        phase: "start",
        outline,
      }) as { revision: number; status: string };
      revision = shaped.revision;
      expect(shaped.status).toBe("shaping");
    });
    expect(actions.getState().lesson.construction?.regions).toHaveLength(6);
    expect(actions.getState().session.stage).toBe("context_review");

    document.regions.forEach((region, index) => {
      act(() => {
        const shaped = findTool(actions, "learn_prepare_lesson").execute({
          nonce: started.nonce,
          baseRevision: revision,
          idempotencyKey: `shape-progressive-transformer-${index + 1}`,
          phase: "region",
          draftRevision: document.revision,
          region,
        }) as { revision: number; shapedRegions: number; status: string };
        revision = shaped.revision;
        expect(shaped.shapedRegions).toBe(index + 1);
        expect(shaped.status).toBe(index === document.regions.length - 1 ? "ready_to_finalize" : "shaping");
      });
    });
    expect(
      actions.getState().lesson.construction?.regions.every(
        (region) => region.status === "ready" && region.content.length > 0,
      ),
    ).toBe(true);

    act(() => {
      findTool(actions, "learn_prepare_lesson").execute({
        nonce: started.nonce,
        baseRevision: revision,
        idempotencyKey: "finalize-progressive-transformer-01",
        phase: "finalize",
        draftRevision: document.revision,
      });
    });
    expect(actions.getState()).toMatchObject({
      session: { stage: "lesson_review" },
      lesson: {
        status: "awaiting_review",
        construction: null,
        draft: { title: document.title, revision: document.revision },
      },
    });
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

  it("restores the v4 notebook without restoring its nonce", () => {
    const first = renderHook(() => useLearningCanvas());
    act(() => {
      startPublishedTransformer(first.result.current.actions);
    });
    first.unmount();

    const restored = renderHook(() => useLearningCanvas());
    expect(restored.result.current.state.version).toBe(4);
    expect(restored.result.current.state.session.stage).toBe("learning");
    expect(restored.result.current.actions.getNonce()).toBeNull();
    expect(activeToolNames("learning", false)).toEqual([
      "learn_get_start_brief",
      "learn_get_authoring_capabilities",
      "learn_begin_session",
    ]);

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
    expect(activeToolNames("learning", true)).toHaveLength(15);
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

    expect(() =>
      findTool(actions, "learn_inject_widget").execute({
        nonce,
        regionId: region.id,
        baseRegionRevision: region.revision,
        idempotencyKey: "whole-document-widget-01",
        title: "Duplicated visualization",
        html: "<html><body><h1>Duplicated visualization</h1></body></html>",
        css: "body{}",
        javascript: "",
        accessibleSummary: "A whole document must not be injected into the canvas region.",
        height: 240,
        rationale: "Exercise the canvas-owned wrapper gate.",
      }),
    ).toThrow(/body fragment/i);
  });
});
