import { describe, expect, it } from "vitest";
import type { LearningEvent } from "../domain/types";
import { learningDeepLink, toLearningEventEnvelope } from "./desktopBridge";

describe("desktop learning contract", () => {
  it("maps internal events to an idempotent transport envelope", () => {
    const event: LearningEvent = {
      id: "event-12345678",
      sessionId: "learning-session-12345678",
      revision: 7,
      type: "training_completed",
      at: "2026-08-29T10:00:00.000Z",
      actor: "learner",
      summary: "Completed a synthetic capsule.",
      payload: {
        capsuleId: "capsule-12345678",
        contextReceiptId: "receipt-12345678",
        proof: "Forked a task.",
        proofMode: "observed_habit",
      },
    };

    expect(toLearningEventEnvelope(event)).toEqual({
      schemaVersion: 1,
      eventId: "event-12345678",
      idempotencyKey: "event-12345678",
      learningSessionId: "learning-session-12345678",
      occurredAt: "2026-08-29T10:00:00.000Z",
      type: "learning.training.completed",
      actor: "learner",
      capsuleId: "capsule-12345678",
      data: {
        summary: "Completed a synthetic capsule.",
        revision: 7,
        contextReceiptId: "receipt-12345678",
        proof: "Forked a task.",
        proofMode: "observed_habit",
      },
    });
  });

  it("uses the existing Ogram application protocol without putting data in the URL", () => {
    expect(learningDeepLink("capsule one")).toBe(
      "app.ogram://learn/capsule/capsule%20one",
    );
  });
});
