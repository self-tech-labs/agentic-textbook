import { describe, expect, it } from "vitest";
import {
  chooseFocus,
  createCapsule,
  validateLearningModuleInput,
} from "./lessonEngine";
import { mockOgramContext, mockPracticeSignals } from "./mockData";
import type { CapsuleDraftInput } from "./types";

describe("lessonEngine", () => {
  it("chooses the highest-severity, highest-confidence signal", () => {
    expect(chooseFocus(mockPracticeSignals)).toBe("thread_hygiene");
  });

  it("combines agent personalization with an Ogram-owned recipe", () => {
    const capsule = createCapsule(
      {
        focus: "effort_fit",
        personalizedScenario:
          "A client-success lead needs a short, factual email tightened before lunch.",
        coachNote: "Spend reasoning where it can change the outcome.",
        sourceTaskCount: 5,
      },
      mockOgramContext,
      mockPracticeSignals,
      new Date("2026-08-29T10:00:00.000Z"),
    );

    expect(capsule.id).toBe("capsule-1787997600000");
    expect(capsule.title).toBe("Match the model to the work");
    expect(capsule.personalizedScenario).toContain("Client success & operations lead");
    expect(capsule.personalizedScenario).toContain(
      "Turn workshop notes into crisp client follow-ups",
    );
    expect(capsule.choices.filter((choice) => choice.correct)).toHaveLength(1);
    expect(capsule.status).toBe("active");
    expect(capsule.compiler).toEqual({
      recipeId: "ogram.practice.effort_fit",
      recipeVersion: "1.0.0",
      contextReceiptId: "receipt-legacy-untracked",
      difficulty: "guided",
      practiceMode: "decision",
      proofMode: "next_action",
    });
    expect(capsule.durationMinutes).toBe(5);
  });

  it("compiles bounded stretch rehearsal and observed-habit options", () => {
    const capsule = createCapsule(
      {
        focus: "thread_hygiene",
        difficulty: "stretch",
        practiceMode: "rehearsal",
        proofMode: "observed_habit",
        contextReceiptId: "receipt-production-01",
      },
      mockOgramContext,
      mockPracticeSignals,
      new Date("2026-08-29T10:00:00.000Z"),
    );

    expect(capsule.compiler).toEqual({
      recipeId: "ogram.practice.thread_hygiene",
      recipeVersion: "1.0.0",
      contextReceiptId: "receipt-production-01",
      difficulty: "stretch",
      practiceMode: "rehearsal",
      proofMode: "observed_habit",
    });
    expect(capsule.durationMinutes).toBe(7);
    expect(capsule.challengePrompt).toContain("Rehearse the move");
    expect(capsule.challengePrompt).toContain(
      "name the boundary that rules out the alternatives",
    );
    expect(capsule.practiceContract.proof).toContain("A later Codex session");
    expect(capsule.coachNote).toContain("Handling client context safely");
    expect(capsule.coachNote).toContain("learning journey");
  });

  it("returns the same isolated capsule for the same inputs and clock", () => {
    const input: CapsuleDraftInput = {
      focus: "task_shaping",
      contextReceiptId: "receipt-deterministic-01",
    };
    const now = new Date("2026-08-29T10:00:00.000Z");
    const first = createCapsule(input, mockOgramContext, mockPracticeSignals, now);
    const second = createCapsule(input, mockOgramContext, mockPracticeSignals, now);

    expect(first).toEqual(second);
    expect(first.choices).not.toBe(second.choices);
    expect(first.choices[0]).not.toBe(second.choices[0]);
    expect(first.practiceContract).not.toBe(second.practiceContract);
  });

  it("accepts injected capsule ids so equal timestamps cannot collide", () => {
    const now = new Date("2026-08-29T10:00:00.000Z");
    const first = createCapsule(
      { focus: "task_shaping" },
      mockOgramContext,
      mockPracticeSignals,
      now,
      "capsule-injected-0001",
    );
    const second = createCapsule(
      { focus: "task_shaping" },
      mockOgramContext,
      mockPracticeSignals,
      now,
      "capsule-injected-0002",
    );

    expect(first.createdAt).toBe(second.createdAt);
    expect(first.id).not.toBe(second.id);
    expect(() =>
      createCapsule(
        { focus: "task_shaping" },
        mockOgramContext,
        mockPracticeSignals,
        now,
        "bad id",
      ),
    ).toThrow(/capsuleId must be an opaque/);
  });

  it("validates materialized learning modules independently of WebMCP", () => {
    expect(
      validateLearningModuleInput({
        kind: "video",
        title: "Watch the boundary",
        description: "A short explanation of task boundaries.",
        url: "https://www.youtube.com/watch?v=abcDEF_123-",
      }),
    ).toMatchObject({ kind: "video" });
    expect(() =>
      validateLearningModuleInput({
        kind: "video",
        title: "Watch the boundary",
        description: "A short explanation of task boundaries.",
        url: "https://youtube.com/watch?v=abcDEF_123-&autoplay=1",
      }),
    ).toThrow(/exact HTTPS youtube\.com watch URL/);
    expect(() =>
      validateLearningModuleInput({
        kind: "walkthrough",
        title: "Try the boundary",
        description: "A short rehearsal of task boundaries.",
        steps: ["Too short"],
      }),
    ).toThrow(/2–6 steps/);
    expect(() =>
      validateLearningModuleInput({
        kind: "mini_game",
        title: "Choose a boundary",
        description: "A compact decision practice for task boundaries.",
        prompt: "Which response creates the clearest task boundary?",
        options: [
          {
            id: "same",
            label: "Keep going",
            feedback: "This carries old exploration into the next deliverable.",
            correct: true,
          },
          {
            id: "same",
            label: "Fork cleanly",
            feedback: "This preserves decisions inside a clean task boundary.",
            correct: true,
          },
        ],
      }),
    ).toThrow(/duplicate id/);
  });

  it("rejects values outside the bounded compiler vocabulary", () => {
    const invalidInput = {
      focus: "thread_hygiene",
      difficulty: "expert",
    } as unknown as CapsuleDraftInput;

    expect(() =>
      createCapsule(
        invalidInput,
        mockOgramContext,
        mockPracticeSignals,
        new Date("2026-08-29T10:00:00.000Z"),
      ),
    ).toThrow(/difficulty must be one of/);
  });
});
