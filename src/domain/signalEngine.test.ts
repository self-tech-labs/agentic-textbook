import { describe, expect, it } from "vitest";
import { compilePracticeSignals } from "./signalEngine";

describe("signalEngine", () => {
  it("compiles counts into page-owned, privacy-bounded copy", () => {
    const [signal] = compilePracticeSignals([
      {
        id: "thread_hygiene",
        level: "priority",
        confidence: 0.94,
        occurrences: 6,
        sampleSize: 8,
      },
    ]);

    expect(signal).toMatchObject({
      id: "thread_hygiene",
      label: "Thread hygiene",
      sourceTaskCount: 8,
    });
    expect(signal?.evidence).toContain("6 of 8 authorized recent tasks");
    expect(signal?.recommendation).toContain("continue, fork, and fresh");
  });

  it("rejects impossible counts and duplicate observations", () => {
    expect(() =>
      compilePracticeSignals([
        {
          id: "effort_fit",
          level: "watch",
          confidence: 0.7,
          occurrences: 5,
          sampleSize: 3,
        },
      ]),
    ).toThrow(/greater than sampleSize/);

    const duplicate = {
      id: "task_shaping" as const,
      level: "practice" as const,
      confidence: 0.8,
      occurrences: 2,
      sampleSize: 4,
    };
    expect(() => compilePracticeSignals([duplicate, duplicate])).toThrow(
      /Duplicate practice signal/,
    );
  });
});
