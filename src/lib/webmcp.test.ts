import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LearningModule,
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
  LearningModuleInputSchema,
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
    version: 3,
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
    state = { ...state, revision, signals };
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
      };
      return { capsuleId, eventId: "event-capsule", revision };
    },
  );
  const addLearningModule = vi.fn(
    (
      capsuleId: string,
      moduleInput: Parameters<LearningToolActions["addLearningModule"]>[1],
    ) => {
      const revision = state.revision + 1;
      const moduleId = "module-new-12345678";
      const module = {
        ...moduleInput,
        id: moduleId,
        ...(moduleInput.kind === "video" ? { provider: "YouTube" as const } : {}),
      } as LearningModule;
      state = {
        ...state,
        revision,
        activeCapsule: {
          ...state.activeCapsule,
          id: capsuleId,
          learningModules: [
            ...(state.activeCapsule.learningModules ?? []),
            module,
          ],
        },
      };
      return { moduleId, eventId: "event-module", revision };
    },
  );
  const actions: LearningToolActions = {
    getState: () => state,
    awaitRevision,
    submitSignals,
    publishCapsule,
    addLearningModule,
  };

  return {
    actions,
    spies: {
      awaitRevision,
      submitSignals,
      publishCapsule,
      addLearningModule,
    },
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

  it("keeps a bounded six-tool surface with human-readable titles", async () => {
    const { actions } = mockActions();
    const tools = createOgramLearningTools(actions);

    expect(tools.map((tool) => tool.name)).toEqual([
      "ogram_get_learning_mission",
      "ogram_get_injected_context",
      "ogram_get_learning_journey",
      "ogram_submit_practice_signals",
      "ogram_publish_daily_capsule",
      "ogram_add_learning_module",
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
      revision: 2,
      reviewedTaskCount: 8,
      rawTaskContentStored: false,
      committedState: { revision: 2, signalCount: 1 },
    });
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
    });

    await expect(
      tool.execute({
        focus: "thread_hygiene",
        difficulty: "expert",
        sourceTaskCount: 20,
      }),
    ).rejects.toThrow(/Invalid tool input/);
  });

  it("commits only schema-bounded learning modules and awaits their revision", async () => {
    const { actions, spies } = mockActions();
    const tool = toolNamed(actions, "ogram_add_learning_module");
    expect(tool.inputSchema).toBe(LearningModuleInputSchema);

    const result = (await tool.execute({
      capsuleId: "capsule-1787997600000",
      templateId: "context_packing",
    })) as Record<string, unknown>;

    expect(spies.addLearningModule).toHaveBeenCalledWith(
      "capsule-1787997600000",
      expect.objectContaining({ kind: "mini_game" }),
    );
    expect(spies.awaitRevision).toHaveBeenCalledWith(2, "event-module");
    expect(result).toMatchObject({
      ok: true,
      revision: 2,
      moduleId: "module-new-12345678",
      module: { id: "module-new-12345678", kind: "mini_game" },
      moduleCount: 1,
    });

    await expect(
      tool.execute({
        capsuleId: "capsule-1787997600000",
        templateId: "context_packing",
        title: "Model-authored copy must not cross this boundary.",
      }),
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
    expect(registration.toolCount).toBe(6);
    expect(window.__OGRAM_WEBMCP_TOOLS__?.ogram_get_learning_mission).toBeDefined();
    registration.cleanup();
    expect(window.__OGRAM_WEBMCP_TOOLS__).toBeUndefined();
  });
});
