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

  it("publishes a narrow eight-tool surface and a strict privacy mission", async () => {
    const tools = createOgramLearningTools(mockActions());
    expect(tools).toHaveLength(8);

    const mission = (await tools[0]!.execute({})) as Record<string, unknown>;
    expect(mission.rawTaskContentAllowed).toBe(false);
    expect(mission.signalIds).toEqual([
      "thread_hygiene",
      "workspace_hygiene",
      "effort_fit",
      "task_shaping",
    ]);
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
    expect(registration.toolCount).toBe(8);
    expect(window.__OGRAM_WEBMCP_TOOLS__?.ogram_get_learning_mission).toBeDefined();
    registration.cleanup();
    expect(window.__OGRAM_WEBMCP_TOOLS__).toBeUndefined();
  });
});
