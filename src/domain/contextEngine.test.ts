import { describe, expect, it } from "vitest";
import { mockOgramContext, mockPracticeSignals } from "./mockData";
import type {
  ContextEnvironment,
  ContextReceiptProvenance,
  JourneyEntry,
  OgramInjectedContext,
  PracticeSignal,
} from "./types";
import {
  assembleContextReceipt,
  resolveContextEnvironment,
} from "./contextEngine";

const journey: JourneyEntry[] = [
  {
    id: "journey-completed",
    dateLabel: "Yesterday",
    title: "Give files a home",
    focus: "workspace_hygiene",
    status: "completed",
    proof: "Started the artifact in a dedicated project.",
  },
  {
    id: "journey-today",
    dateLabel: "Today",
    title: "Know when to move to a new task",
    focus: "thread_hygiene",
    status: "today",
  },
];

function provenance(
  environment: ContextEnvironment,
): ContextReceiptProvenance {
  return {
    ogramContext: {
      provenanceId: "context-profile-01",
      kind: "ogram_context",
      environment,
      version: "ogram-context/v1",
      capturedAt: "2026-08-29T09:55:00.000Z",
    },
    practiceSignals: {
      provenanceId: "codex-review-01",
      kind: "codex_practice_signals",
      environment,
      version: "practice-signal-taxonomy/v1",
      capturedAt: "2026-08-29T09:58:00.000Z",
    },
    learningJourney: {
      provenanceId: "journey-projection-01",
      kind: "ogram_learning_journey",
      environment,
      version: "learning-journey/v2",
      capturedAt: "2026-08-29T09:59:00.000Z",
    },
  };
}

function productionContext(): OgramInjectedContext {
  return {
    sourceLabel: "ogram-injected-context",
    environment: "production",
    learner: { ...mockOgramContext.learner },
    roleGoals: [...mockOgramContext.roleGoals],
    workshopNotes: [...mockOgramContext.workshopNotes],
    preferences: [...mockOgramContext.preferences],
    privacyBoundary: mockOgramContext.privacyBoundary,
    requiredTraining: mockOgramContext.requiredTraining
      ? { ...mockOgramContext.requiredTraining }
      : null,
  };
}

describe("contextEngine", () => {
  it("assembles a production receipt with explicit, versioned provenance", () => {
    const receipt = assembleContextReceipt({
      receiptId: "receipt-learning-01",
      context: productionContext(),
      signals: mockPracticeSignals,
      journey,
      provenance: provenance("production"),
      assembledAt: "2026-08-29T10:00:00+00:00",
    });

    expect(receipt).toMatchObject({
      schemaVersion: 1,
      receiptId: "receipt-learning-01",
      environment: "production",
      assembledAt: "2026-08-29T10:00:00.000Z",
      provenance: {
        ogramContext: {
          provenanceId: "context-profile-01",
          version: "ogram-context/v1",
        },
        practiceSignals: {
          provenanceId: "codex-review-01",
          version: "practice-signal-taxonomy/v1",
        },
      },
    });
    expect(receipt.practiceSignals).toHaveLength(3);
    expect(receipt.learningJourney).toEqual(journey);
    expect(receipt.ogramContext.environment).toBe("production");
    expect(receipt.ogramContext).not.toHaveProperty("synthetic");
  });

  it("normalizes the legacy synthetic fixture without leaking its flag", () => {
    expect(resolveContextEnvironment(mockOgramContext)).toBe("synthetic");

    const receipt = assembleContextReceipt({
      receiptId: "receipt-synthetic-01",
      context: mockOgramContext,
      signals: mockPracticeSignals,
      journey,
      provenance: provenance("synthetic"),
      assembledAt: "2026-08-29T10:00:00.000Z",
    });

    expect(receipt.environment).toBe("synthetic");
    expect(receipt.ogramContext.environment).toBe("synthetic");
    expect(receipt.ogramContext).not.toHaveProperty("synthetic");
  });

  it("deeply freezes cloned inputs so later mutations cannot alter provenance", () => {
    const context = productionContext();
    const signals = mockPracticeSignals.map((signal) => ({ ...signal }));
    const mutableJourney = journey.map((entry) => ({ ...entry }));
    const receipt = assembleContextReceipt({
      receiptId: "receipt-immutable-01",
      context,
      signals,
      journey: mutableJourney,
      provenance: provenance("production"),
      assembledAt: "2026-08-29T10:00:00.000Z",
    });

    signals[0]!.evidence = "Changed after assembly.";
    mutableJourney[0]!.title = "Changed after assembly";
    (context.roleGoals as string[])[0] = "Changed after assembly";

    expect(receipt.practiceSignals[0]!.evidence).toBe(
      mockPracticeSignals[0]!.evidence,
    );
    expect(receipt.learningJourney[0]!.title).toBe("Give files a home");
    expect(receipt.ogramContext.roleGoals[0]).toBe(
      mockOgramContext.roleGoals[0],
    );
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.provenance.practiceSignals)).toBe(true);
    expect(Object.isFrozen(receipt.ogramContext.roleGoals)).toBe(true);
    expect(Object.isFrozen(receipt.practiceSignals[0])).toBe(true);
  });

  it("fails closed for provenance mismatches and raw-shaped signal fields", () => {
    const baseline = provenance("production");
    const mismatched: ContextReceiptProvenance = {
      ...baseline,
      practiceSignals: {
        ...baseline.practiceSignals,
        environment: "synthetic",
      },
    };

    expect(() =>
      assembleContextReceipt({
        receiptId: "receipt-mismatch-01",
        context: productionContext(),
        signals: mockPracticeSignals,
        journey,
        provenance: mismatched,
        assembledAt: "2026-08-29T10:00:00.000Z",
      }),
    ).toThrow(/must match the context environment/);

    const rawShapedSignal = {
      ...mockPracticeSignals[0]!,
      rawTaskContent: "A raw transcript must never enter a receipt.",
    } as PracticeSignal;
    expect(() =>
      assembleContextReceipt({
        receiptId: "receipt-unsafe-01",
        context: productionContext(),
        signals: [rawShapedSignal],
        journey,
        provenance: provenance("production"),
        assembledAt: "2026-08-29T10:00:00.000Z",
      }),
    ).toThrow(/unsupported fields: rawTaskContent/);
  });

  it("bounds injected context and journey projections at the receipt boundary", () => {
    const oversizedContext = productionContext() as OgramInjectedContext & {
      roleGoals: string[];
    };
    oversizedContext.roleGoals = Array.from(
      { length: 9 },
      (_, index) => `Goal ${index}`,
    );
    expect(() =>
      assembleContextReceipt({
        receiptId: "receipt-oversized-01",
        context: oversizedContext,
        signals: mockPracticeSignals,
        journey,
        provenance: provenance("production"),
      }),
    ).toThrow(/roleGoals must contain at most 8 items/);

    const invalidTraining = productionContext() as unknown as Record<
      string,
      unknown
    >;
    invalidTraining.requiredTraining = {
      id: "training-invalid-01",
      title: "Invalid training",
      dueLabel: "Tomorrow",
      status: "invented",
    };
    expect(() =>
      assembleContextReceipt({
        receiptId: "receipt-invalid-training-01",
        context: invalidTraining as unknown as OgramInjectedContext,
        signals: mockPracticeSignals,
        journey,
        provenance: provenance("production"),
      }),
    ).toThrow(/status must be assigned or completed/);

    expect(() =>
      assembleContextReceipt({
        receiptId: "receipt-long-journey-01",
        context: productionContext(),
        signals: mockPracticeSignals,
        journey: Array.from({ length: 101 }, (_, index) => ({
          ...journey[0]!,
          id: `journey-entry-${index.toString().padStart(3, "0")}`,
        })),
        provenance: provenance("production"),
      }),
    ).toThrow(/journey must contain at most 100 entries/);
  });
});
