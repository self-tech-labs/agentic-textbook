import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LearningState,
  PracticeSignal,
} from "../domain/types";
import { createCapsule } from "../domain/lessonEngine";
import { mockOgramContext, mockPracticeSignals } from "../domain/mockData";
import {
  createOgramLearningTools,
  registerOgramLearningTools,
  type LearningToolActions,
} from "./webmcp";
import {
  InspectPracticeAttemptInputSchema,
  PracticeCoachingInputSchema,
  PracticeReviewInputSchema,
  PublishCapsuleInputSchema,
} from "./webmcpSchemas";

function testState(): LearningState {
  const contextReceiptId = "receipt-test-12345678";
  const activeCapsule = createCapsule(
    {
      focus: "thread_hygiene",
      sourceTaskCount: 8,
      contextReceiptId,
    },
    mockOgramContext,
    mockPracticeSignals,
    new Date("2026-08-29T10:00:00.000Z"),
  );
  return {
    version: 4,
    sessionId: "learn-session-test",
    revision: 1,
    context: mockOgramContext,
    contextReceipt: {
      receiptId: contextReceiptId,
    } as LearningState["contextReceipt"],
    signals: mockPracticeSignals.map((signal) => ({ ...signal })),
    activeCapsule,
    journey: [],
    events: [],
    journeySync: {
      status: "idle",
      mode: null,
      pendingCount: 0,
      detail: "Nothing pending.",
      lastSyncedAt: null,
    },
  };
}

function mockActions() {
  let state = testState();

  const awaitRevision = vi.fn(async (revision: number, eventId?: string) => {
    if (state.revision < revision) throw new Error("Revision not committed.");
    if (eventId && !eventId.startsWith("event-")) {
      throw new Error("Event not committed.");
    }
    return state;
  });
  const submitSignals = vi.fn((signals: PracticeSignal[]) => {
    const revision = state.revision + 1;
    state = {
      ...state,
      revision,
      signals,
      events: [
        ...state.events,
        {
          id: "event-signals",
          sessionId: state.sessionId,
          revision,
          type: "coaching_signals_submitted",
          at: "2026-08-29T10:00:15.000Z",
          actor: "codex",
          summary: "Committed bounded practice observations.",
          payload: {
            revision,
            signalCount: signals.length,
            reviewedTaskCount: Math.max(
              ...signals.map((signal) => signal.sourceTaskCount),
            ),
            rawTaskContentShared: false,
          },
        },
      ],
    };
    return { eventId: "event-signals", revision };
  });
  const publishCapsule = vi.fn(
    (input: Parameters<LearningToolActions["publishCapsule"]>[0]) => {
      const revision = state.revision + 1;
      const capsuleId = "capsule-new-12345678";
      state = {
        ...state,
        revision,
        activeCapsule: {
          ...state.activeCapsule,
          id: capsuleId,
          focus: input.focus,
          status: "active",
          compiler: {
            ...state.activeCapsule.compiler,
            contextReceiptId:
              input.contextReceiptId ?? state.contextReceipt.receiptId,
            difficulty: input.difficulty ?? "guided",
            practiceMode: input.practiceMode ?? "decision",
            proofMode: input.proofMode ?? "next_action",
          },
        },
        events: [
          ...state.events,
          {
            id: "event-capsule",
            sessionId: state.sessionId,
            revision,
            type: "capsule_published",
            at: "2026-08-29T10:00:30.000Z",
            actor: "codex",
            summary: "Published the flagship practice capsule.",
            payload: {
              revision,
              capsuleId,
              contextReceiptId: state.contextReceipt.receiptId,
              focus: input.focus,
              compiler: {
                ...state.activeCapsule.compiler,
                contextReceiptId:
                  input.contextReceiptId ?? state.contextReceipt.receiptId,
                difficulty: input.difficulty ?? "guided",
                practiceMode: input.practiceMode ?? "decision",
                proofMode: input.proofMode ?? "next_action",
              },
            },
          },
        ],
      };
      return { capsuleId, eventId: "event-capsule", revision };
    },
  );
  const recordPracticeCoaching = vi.fn(
    (
      capsuleId: string,
      attemptRevision: number,
      move: "reconsider_card" | "confirm_ready",
      cardId: Parameters<LearningToolActions["recordPracticeCoaching"]>[3],
    ) => {
      const revision = state.revision + 1;
      const reviewId = "review-new-12345678";
      state = {
        ...state,
        revision,
        activeCapsule: {
          ...state.activeCapsule,
          id: capsuleId,
          collaboration: state.activeCapsule.collaboration
            ? {
                ...state.activeCapsule.collaboration,
                phase: move === "confirm_ready" ? "ready" : "revision_requested",
                consent: "consumed",
                reviews: [
                  ...state.activeCapsule.collaboration.reviews,
                  {
                    id: reviewId,
                    attemptRevision,
                    at: "2026-08-29T10:01:00.000Z",
                    move,
                    cardId,
                    message: "Page-owned coaching copy.",
                    resolution:
                      move === "confirm_ready" ? "accepted" : "pending",
                  },
                ],
              }
            : undefined,
        },
        events: [
          ...state.events,
          {
            id: "event-review",
            sessionId: state.sessionId,
            revision,
            type: "practice_coaching_recorded",
            at: "2026-08-29T10:01:00.000Z",
            actor: "codex",
            summary: "Recorded one bounded coaching move.",
            payload: {
              revision,
              capsuleId,
              attemptRevision,
              move,
              cardId,
              ready: move === "confirm_ready",
            },
          },
        ],
      };
      return {
        reviewId,
        eventId: "event-review",
        revision,
        ready: move === "confirm_ready",
      };
    },
  );
  const actions: LearningToolActions = {
    getState: () => state,
    awaitRevision,
    submitSignals,
    publishCapsule,
    recordPracticeCoaching,
  };
  const grantPracticeAttempt = (ready = false) => {
    const instrument = state.activeCapsule.practiceInstrument!;
    const placements = instrument.cards.map((card) => ({
      cardId: card.id,
      zone:
        !ready && card.id === "full_conversation"
          ? ("carry" as const)
          : card.expectedZone,
    }));
    state = {
      ...state,
      activeCapsule: {
        ...state.activeCapsule,
        collaboration: {
          phase: "awaiting_review",
          consent: "granted",
          attemptRevision: 1,
          snapshots: [
            {
              attemptRevision: 1,
              sharedAt: "2026-08-29T10:00:30.000Z",
              placements,
            },
          ],
          reviews: [],
        },
      },
    };
  };

  return {
    actions,
    spies: {
      awaitRevision,
      submitSignals,
      publishCapsule,
      recordPracticeCoaching,
    },
    grantPracticeAttempt,
  };
}

function toolNamed(actions: LearningToolActions, name: string) {
  return createOgramLearningTools(actions).find((tool) => tool.name === name)!;
}

describe("Ogram WebMCP tools", () => {
  beforeEach(() => {
    delete window.__OGRAM_WEBMCP_TOOLS__;
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("keeps a bounded seven-tool surface focused on the repeated coaching loop", async () => {
    const { actions } = mockActions();
    const tools = createOgramLearningTools(actions);

    expect(tools.map((tool) => tool.name)).toEqual([
      "ogram_get_learning_mission",
      "ogram_get_injected_context",
      "ogram_get_learning_journey",
      "ogram_submit_practice_signals",
      "ogram_publish_daily_capsule",
      "ogram_inspect_practice_attempt",
      "ogram_record_coaching_move",
    ]);
    expect(tools.every((tool) => tool.title.length > 0)).toBe(true);

    const mission = (await tools[0]!.execute({})) as Record<string, unknown>;
    expect(mission).toMatchObject({
      rawTaskContentAllowed: false,
      maximumTaskCount: 8,
      signalIds: [
        "thread_hygiene",
        "workspace_hygiene",
        "effort_fit",
        "task_shaping",
      ],
    });
  });

  it("marks learner context and journey projections as untrusted reads", () => {
    const { actions } = mockActions();
    const tools = createOgramLearningTools(actions);

    expect(tools[0]?.annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: false,
    });
    expect(tools[1]?.annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(tools[2]?.annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(toolNamed(actions, "ogram_inspect_practice_attempt").annotations).toMatchObject({
      readOnlyHint: true,
      untrustedContentHint: true,
    });
    expect(toolNamed(actions, "ogram_record_coaching_move").annotations).toMatchObject({
      readOnlyHint: false,
      untrustedContentHint: false,
    });
  });

  it("fails closed before consent and returns only the learner-shared structural projection", async () => {
    const { actions, grantPracticeAttempt } = mockActions();
    const tool = toolNamed(actions, "ogram_inspect_practice_attempt");
    expect(tool.inputSchema).toBe(InspectPracticeAttemptInputSchema);
    const capsuleId = actions.getState().activeCapsule.id;

    expect(() => tool.execute({ capsuleId })).toThrow(/consent is not active/i);
    grantPracticeAttempt();
    const result = (await tool.execute({ capsuleId })) as Record<string, unknown>;
    expect(result).toMatchObject({
      ok: true,
      capsuleId,
      attemptRevision: 1,
      consentScope: "this_revision_only",
      rubric: { sufficient: true, lean: false, private: true },
      privacy: { rawTaskContentShared: false },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("expectedZone");
    expect(serialized).not.toContain("raw task");
    expect(serialized).not.toContain("client data\":");
  });

  it("records one schema-bounded coaching move and consumes the exact revision", async () => {
    const { actions, spies, grantPracticeAttempt } = mockActions();
    grantPracticeAttempt();
    const tool = toolNamed(actions, "ogram_record_coaching_move");
    expect(tool.inputSchema).toBe(PracticeCoachingInputSchema);
    const capsuleId = actions.getState().activeCapsule.id;

    const result = (await tool.execute({
      capsuleId,
      attemptRevision: 1,
      move: "reconsider_card",
      cardId: "full_conversation",
    })) as Record<string, unknown>;
    expect(spies.recordPracticeCoaching).toHaveBeenCalledWith(
      capsuleId,
      1,
      "reconsider_card",
      "full_conversation",
    );
    expect(spies.awaitRevision).toHaveBeenCalledWith(2, "event-review");
    expect(result).toMatchObject({
      ok: true,
      replayed: false,
      attemptRevision: 1,
      consentConsumed: true,
      agentMovedCards: 0,
      review: {
        move: "reconsider_card",
        cardId: "full_conversation",
        message: "Page-owned coaching copy.",
      },
    });
    const replayed = (await tool.execute({
      capsuleId,
      attemptRevision: 1,
      move: "reconsider_card",
      cardId: "full_conversation",
    })) as Record<string, unknown>;
    expect(replayed).toMatchObject({
      ok: true,
      replayed: true,
      eventId: "event-review",
      revision: 2,
    });
    expect(spies.recordPracticeCoaching).toHaveBeenCalledTimes(1);
    await expect(
      tool.execute({
        capsuleId,
        attemptRevision: 1,
        move: "reconsider_card",
        cardId: "full_conversation",
        message: "Arbitrary model prose must not cross.",
      }),
    ).rejects.toThrow(/Invalid tool input/);
  });

  it("uses the TypeBox review schema and compiles counts into page-owned copy", async () => {
    const { actions, spies } = mockActions();
    const tool = toolNamed(actions, "ogram_submit_practice_signals");
    expect(tool.inputSchema).toBe(PracticeReviewInputSchema);

    const result = (await tool.execute({
      signals: [
        {
          id: "thread_hygiene",
          level: "priority",
          confidence: 0.94,
          occurrences: 6,
          sampleSize: 8,
        },
      ],
    })) as Record<string, unknown>;

    expect(spies.submitSignals).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "thread_hygiene",
        sourceTaskCount: 8,
        evidence:
          "In 6 of 8 authorized recent tasks, the goal changed while work continued in the same task.",
      }),
    ]);
    expect(spies.awaitRevision).toHaveBeenCalledWith(2, "event-signals");
    expect(result).toMatchObject({
      ok: true,
      replayed: false,
      revision: 2,
      reviewedTaskCount: 8,
      rawTaskContentStored: false,
      committedState: { revision: 2, signalCount: 1 },
    });
    const replayed = (await tool.execute({
      signals: [
        {
          id: "thread_hygiene",
          level: "priority",
          confidence: 0.94,
          occurrences: 6,
          sampleSize: 8,
        },
      ],
    })) as Record<string, unknown>;
    expect(replayed).toMatchObject({
      ok: true,
      replayed: true,
      eventId: "event-signals",
      revision: 2,
    });
    expect(spies.submitSignals).toHaveBeenCalledTimes(1);
  });

  it("rejects raw prose, more than eight tasks, and impossible counts", async () => {
    const { actions, spies } = mockActions();
    const tool = toolNamed(actions, "ogram_submit_practice_signals");

    await expect(
      tool.execute({
        signals: [
          {
            id: "thread_hygiene",
            level: "priority",
            confidence: 0.9,
            occurrences: 2,
            sampleSize: 2,
            evidence: "Raw task-shaped prose must not cross the boundary.",
          },
        ],
      }),
    ).rejects.toThrow(/Invalid tool input/);
    await expect(
      tool.execute({
        signals: [
          {
            id: "thread_hygiene",
            level: "priority",
            confidence: 0.9,
            occurrences: 6,
            sampleSize: 9,
          },
        ],
      }),
    ).rejects.toThrow(/Invalid tool input/);
    await expect(
      tool.execute({
        signals: [
          {
            id: "thread_hygiene",
            level: "priority",
            confidence: 0.9,
            occurrences: 5,
            sampleSize: 3,
          },
        ],
      }),
    ).rejects.toThrow(/greater than sampleSize/);
    expect(spies.submitSignals).not.toHaveBeenCalled();
  });

  it("derives task count from committed signals and forwards bounded compiler modes", async () => {
    const { actions, spies } = mockActions();
    const tool = toolNamed(actions, "ogram_publish_daily_capsule");
    expect(tool.inputSchema).toBe(PublishCapsuleInputSchema);

    const result = (await tool.execute({
      focus: "thread_hygiene",
      difficulty: "stretch",
      practiceMode: "rehearsal",
      proofMode: "observed_habit",
    })) as Record<string, unknown>;

    expect(spies.publishCapsule).toHaveBeenCalledWith({
      focus: "thread_hygiene",
      sourceTaskCount: 8,
      difficulty: "stretch",
      practiceMode: "rehearsal",
      proofMode: "observed_habit",
    });
    expect(spies.awaitRevision).toHaveBeenCalledWith(2, "event-capsule");
    expect(result).toMatchObject({
      ok: true,
      replayed: false,
      revision: 2,
      capsuleId: "capsule-new-12345678",
      capsule: {
        id: "capsule-new-12345678",
        focus: "thread_hygiene",
        compiler: {
          difficulty: "stretch",
          practiceMode: "rehearsal",
          proofMode: "observed_habit",
        },
      },
      nextTools: [
        "ogram_inspect_practice_attempt",
        "ogram_record_coaching_move",
      ],
    });
    const replayed = (await tool.execute({
      focus: "thread_hygiene",
      difficulty: "stretch",
      practiceMode: "rehearsal",
      proofMode: "observed_habit",
    })) as Record<string, unknown>;
    expect(replayed).toMatchObject({
      ok: true,
      replayed: true,
      eventId: "event-capsule",
      revision: 2,
      capsuleId: "capsule-new-12345678",
    });
    expect(spies.publishCapsule).toHaveBeenCalledTimes(1);

    await expect(
      tool.execute({
        focus: "thread_hygiene",
        difficulty: "expert",
        sourceTaskCount: 20,
      }),
    ).rejects.toThrow(/Invalid tool input/);
    await expect(
      tool.execute({ focus: "effort_fit" }),
    ).rejects.toThrow(/Invalid tool input/);
  });

  it("serializes model writes through exact committed event receipts", async () => {
    const { actions, spies } = mockActions();
    let releaseFirst!: (state: LearningState) => void;
    const firstCommit = new Promise<LearningState>((resolve) => {
      releaseFirst = resolve;
    });
    spies.awaitRevision.mockImplementationOnce(() => firstCommit);
    const tools = createOgramLearningTools(actions);
    const signalTool = tools.find(
      (tool) => tool.name === "ogram_submit_practice_signals",
    )!;
    const publishTool = tools.find(
      (tool) => tool.name === "ogram_publish_daily_capsule",
    )!;

    const signals = signalTool.execute({
      signals: [
        {
          id: "thread_hygiene",
          level: "priority",
          confidence: 0.9,
          occurrences: 3,
          sampleSize: 4,
        },
      ],
    });
    await vi.waitFor(() => expect(spies.submitSignals).toHaveBeenCalledTimes(1));
    const publication = publishTool.execute({ focus: "thread_hygiene" });
    await Promise.resolve();
    expect(spies.publishCapsule).not.toHaveBeenCalled();

    releaseFirst(actions.getState());
    await signals;
    await publication;

    expect(spies.publishCapsule).toHaveBeenCalledTimes(1);
    expect(spies.awaitRevision).toHaveBeenNthCalledWith(
      1,
      2,
      "event-signals",
    );
    expect(spies.awaitRevision).toHaveBeenNthCalledWith(
      2,
      3,
      "event-capsule",
    );
  });

  it("keeps the browser-test registry when native WebMCP is unavailable", async () => {
    const { actions } = mockActions();
    const registration = await registerOgramLearningTools(actions);

    expect(registration.supported).toBe(false);
    expect(registration.toolCount).toBe(7);
    expect(window.__OGRAM_WEBMCP_TOOLS__?.ogram_get_learning_mission).toBeDefined();
    registration.cleanup();
    expect(window.__OGRAM_WEBMCP_TOOLS__).toBeUndefined();
  });
});
