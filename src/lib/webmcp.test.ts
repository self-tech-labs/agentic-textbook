import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState, type LearningActions } from "../hooks/useLearningStore";
import { createOgramLearningTools, registerOgramLearningTools } from "./webmcp";

function mockActions(): LearningActions {
  const state = createInitialState(new Date("2026-08-29T10:00:00.000Z"));
  return {
    getState: () => state,
    reset: vi.fn(),
    submitSignals: vi.fn(() => ({ eventId: "event-signals" })),
    publishCapsule: vi.fn(() => ({
      capsuleId: "capsule-new",
      eventId: "event-capsule",
    })),
    addLearningModule: vi.fn(() => ({
      moduleId: "module-new",
      eventId: "event-module",
    })),
    recordChoice: vi.fn(() => ({
      correct: true,
      feedback: "Exactly.",
      eventId: "event-choice",
    })),
    completeCapsule: vi.fn(() => ({
      completedAt: "2026-08-29T10:05:00.000Z",
      eventId: "event-complete",
    })),
    queueDesktopFollowUp: vi.fn(async () => ({
      eventId: "event-desktop",
      mode: "local-queue",
      detail: "Queued.",
    })),
  };
}

describe("Ogram WebMCP tools", () => {
  beforeEach(() => {
    delete window.__OGRAM_WEBMCP_TOOLS__;
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("publishes a narrow seven-tool surface and a strict privacy mission", async () => {
    const tools = createOgramLearningTools(mockActions());
    expect(tools).toHaveLength(7);

    const mission = (await tools[0]!.execute({})) as Record<string, unknown>;
    expect(mission.rawTaskContentAllowed).toBe(false);
    expect(mission.signalIds).toEqual([
      "thread_hygiene",
      "workspace_hygiene",
      "effort_fit",
      "task_shaping",
    ]);
  });

  it("accepts bounded learning modules but no executable canvas code", () => {
    const actions = mockActions();
    const tools = createOgramLearningTools(actions);
    const moduleTool = tools.find(
      (candidate) => candidate.name === "ogram_add_learning_module",
    )!;

    moduleTool.execute({
      capsuleId: "capsule-1787997600000",
      kind: "mini_game",
      title: "Pack the right context",
      description: "A short practice for choosing what belongs in a fork.",
      gameTemplate: "context_packing",
    });
    expect(actions.addLearningModule).toHaveBeenCalledWith(
      "capsule-1787997600000",
      expect.objectContaining({ kind: "mini_game" }),
    );

    expect(() =>
      moduleTool.execute({
        capsuleId: "capsule-1787997600000",
        kind: "html",
        title: "Run this code",
        description: "An arbitrary block that should never reach the page.",
        html: "<script>alert(1)</script>",
      }),
    ).toThrow(/kind/);
  });

  it("rejects raw-shaped or underspecified observations before state mutation", () => {
    const actions = mockActions();
    const tool = createOgramLearningTools(actions).find(
      (candidate) => candidate.name === "ogram_submit_practice_signals",
    )!;

    expect(() =>
      tool.execute({
        signals: [
          {
            id: "thread_hygiene",
            level: "priority",
            confidence: 0.9,
            evidence: "too short",
            recommendation: "also short",
            sourceTaskCount: 2,
          },
        ],
      }),
    ).toThrow(/evidence/);
    expect(actions.submitSignals).not.toHaveBeenCalled();
  });

  it("keeps a browser-test registry when native WebMCP is unavailable", async () => {
    const registration = await registerOgramLearningTools(mockActions());
    expect(registration.supported).toBe(false);
    expect(registration.toolCount).toBe(7);
    expect(window.__OGRAM_WEBMCP_TOOLS__?.ogram_get_learning_mission).toBeDefined();
    registration.cleanup();
    expect(window.__OGRAM_WEBMCP_TOOLS__).toBeUndefined();
  });
});
