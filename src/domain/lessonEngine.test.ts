import { describe, expect, it } from "vitest";
import { chooseFocus, createCapsule } from "./lessonEngine";
import { mockOgramContext, mockPracticeSignals } from "./mockData";

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
    expect(capsule.title).toBe("Spend reasoning where it changes the outcome");
    expect(capsule.personalizedScenario).toContain("Client success & operations lead");
    expect(capsule.choices.filter((choice) => choice.correct)).toHaveLength(1);
    expect(capsule.status).toBe("active");
  });
});
