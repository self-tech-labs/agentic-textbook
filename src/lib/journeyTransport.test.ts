import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import learningEventSchema from "../../contracts/learning-event.schema.json";
import type { LearningEvent } from "../domain/types";
import {
  enqueueLearningEvent,
  flushLearningEventOutbox,
  getJourneyOutbox,
  publishLearningEvent,
  retryLearningEventOutbox,
  toLearningEventEnvelope,
  type LearningEventEnvelope,
} from "./journeyTransport";

function learningEvent(
  id: string,
  overrides: Partial<LearningEvent> = {},
): LearningEvent {
  return {
    id,
    sessionId: "learning-session-shared",
    revision: 1,
    type: "training_completed",
    at: "2026-08-29T10:00:00.000Z",
    actor: "learner",
    summary: `Completed ${id}.`,
    payload: {
      capsuleId: "capsule-shared",
      contextReceiptId: "receipt-learning-session-shared-r1",
      proof: "A clean fork carries only approved decisions.",
      proofMode: "observed_habit",
    },
    ...overrides,
  };
}

describe("durable learning journey transport", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ogramDesktop;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses one explicitly supplied learning session across different event types", () => {
    const session = "learn-session-12345678";
    const context = toLearningEventEnvelope(
      learningEvent("event-context", {
        type: "context_loaded",
        actor: "ogram",
        payload: { contextReceiptId: "receipt-learning-session-shared-r1" },
      }),
      { learningSessionId: session },
    );
    const completion = toLearningEventEnvelope(
      learningEvent("event-complete"),
      { learningSessionId: session },
    );

    expect(context.learningSessionId).toBe(session);
    expect(completion.learningSessionId).toBe(session);
    expect(completion.idempotencyKey).toBe("event-complete");
  });

  it("validates every runtime event family against the public JSON Schema", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(learningEventSchema);
    const contextReceiptId = "receipt-learning-session-shared-r1";
    const capsuleId = "capsule-shared";
    const events: LearningEvent[] = [
      learningEvent("event-context-loaded", {
        revision: 1,
        type: "context_loaded",
        actor: "ogram",
        payload: { contextReceiptId },
      }),
      learningEvent("event-signals-submitted", {
        revision: 2,
        type: "coaching_signals_submitted",
        actor: "codex",
        payload: {
          signalCount: 3,
          reviewedTaskCount: 8,
          rawTaskContentShared: false,
        },
      }),
      learningEvent("event-capsule-published", {
        revision: 3,
        type: "capsule_published",
        actor: "codex",
        payload: {
          capsuleId,
          contextReceiptId,
          focus: "thread_hygiene",
          compiler: {
            recipeId: "ogram.practice.thread_hygiene",
            recipeVersion: "1.0.0",
            contextReceiptId,
            difficulty: "stretch",
            practiceMode: "rehearsal",
            proofMode: "observed_habit",
          },
        },
      }),
      learningEvent("event-module-added", {
        revision: 4,
        type: "learning_module_added",
        actor: "codex",
        payload: {
          capsuleId,
          moduleId: "module-shared",
          moduleKind: "mini_game",
        },
      }),
      learningEvent("event-practice-attempt-shared", {
        revision: 5,
        type: "practice_attempt_shared",
        actor: "learner",
        payload: {
          capsuleId,
          attemptRevision: 1,
          cardCount: 8,
          availableForAgentReview: true,
          consentGranted: true,
          rawTaskContentShared: false,
        },
      }),
      learningEvent("event-practice-consent-withdrawn", {
        revision: 6,
        type: "practice_consent_withdrawn",
        actor: "learner",
        payload: {
          capsuleId,
          attemptRevision: 1,
          accessRevoked: true,
        },
      }),
      learningEvent("event-practice-coaching-recorded", {
        revision: 7,
        type: "practice_coaching_recorded",
        actor: "codex",
        payload: {
          capsuleId,
          attemptRevision: 1,
          move: "reconsider_card",
          cardId: "done_when",
          ready: false,
        },
      }),
      learningEvent("event-practice-review-resolved", {
        revision: 8,
        type: "practice_review_resolved",
        actor: "learner",
        payload: {
          capsuleId,
          attemptRevision: 1,
          reviewId: "review-practice-r1",
          resolution: "accepted",
        },
      }),
      learningEvent("event-choice-recorded", {
        revision: 9,
        type: "choice_recorded",
        actor: "learner",
        payload: { capsuleId, choiceId: "fork", correct: true },
      }),
      learningEvent("event-training-completed", {
        revision: 10,
        type: "training_completed",
        actor: "learner",
        payload: {
          capsuleId,
          contextReceiptId,
          proof: "A clean fork carries only approved decisions.",
          proofMode: "observed_habit",
        },
      }),
      learningEvent("event-follow-up-queued", {
        revision: 11,
        type: "desktop_follow_up_queued",
        actor: "learner",
        payload: {
          capsuleId,
          contextReceiptId,
          cue: "The deliverable changes after decisions are approved.",
          response: "Fork with the approved decisions and constraints.",
          proof: "The new task can explain its own boundaries.",
          reason: "Look for the next matching task boundary.",
        },
      }),
    ];

    for (const event of events) {
      const envelope = toLearningEventEnvelope(event);
      expect(validate(envelope), JSON.stringify(validate.errors)).toBe(true);
      expect(envelope.data).not.toHaveProperty("capsuleId");
    }

    const invalid = {
      ...toLearningEventEnvelope(events[0]!),
      actor: "learner",
    };
    expect(validate(invalid)).toBe(false);
  });

  it("projects privacy-minimal practice share and coaching envelopes", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(learningEventSchema);
    const capsuleId = "capsule-shared";
    const shared = toLearningEventEnvelope(
      learningEvent("event-practice-shared", {
        revision: 5,
        type: "practice_attempt_shared",
        actor: "learner",
        summary: "Shared context pack r1.",
        payload: {
          capsuleId,
          attemptRevision: 1,
          cardCount: 8,
          availableForAgentReview: true,
          consentGranted: true,
          rawTaskContentShared: false,
        },
      }),
    );
    const coached = toLearningEventEnvelope(
      learningEvent("event-practice-coached", {
        revision: 6,
        type: "practice_coaching_recorded",
        actor: "codex",
        summary: "Recorded one bounded coaching move for r1.",
        payload: {
          capsuleId,
          attemptRevision: 1,
          move: "reconsider_card",
          cardId: "done_when",
          ready: false,
        },
      }),
    );

    expect(validate(shared), JSON.stringify(validate.errors)).toBe(true);
    expect(shared).toMatchObject({
      type: "learning.practice_attempt.shared",
      actor: "learner",
      capsuleId,
    });
    expect(shared.data).toEqual({
      attemptRevision: 1,
      cardCount: 8,
      availableForAgentReview: true,
      consentGranted: true,
      rawTaskContentShared: false,
      summary: "Shared context pack r1.",
      revision: 5,
    });

    expect(validate(coached), JSON.stringify(validate.errors)).toBe(true);
    expect(coached).toMatchObject({
      type: "learning.practice_coaching.recorded",
      actor: "codex",
      capsuleId,
    });
    expect(coached.data).toEqual({
      attemptRevision: 1,
      move: "reconsider_card",
      cardId: "done_when",
      ready: false,
      summary: "Recorded one bounded coaching move for r1.",
      revision: 6,
    });

    expect(shared.data).not.toHaveProperty("placements");
    expect(shared.data).not.toHaveProperty("rawTaskContent");
    expect(coached.data).not.toHaveProperty("message");
    expect(coached.data).not.toHaveProperty("expectedZone");

    const leaked = {
      ...shared,
      data: { ...shared.data, placements: { done_when: "leave" } },
    };
    expect(validate(leaked)).toBe(false);
    const inconsistentCoaching = {
      ...coached,
      data: { ...coached.data, ready: true },
    };
    expect(validate(inconsistentCoaching)).toBe(false);
    const ready = toLearningEventEnvelope(
      learningEvent("event-practice-ready", {
        revision: 7,
        type: "practice_coaching_recorded",
        actor: "codex",
        payload: {
          capsuleId,
          attemptRevision: 2,
          move: "confirm_ready",
          cardId: null,
          ready: true,
        },
      }),
    );
    expect(validate(ready), JSON.stringify(validate.errors)).toBe(true);
  });

  it("delivers practice share then coaching once, preserving queue order", async () => {
    const capsuleId = "capsule-shared";
    const shared = learningEvent("event-practice-r1-shared", {
      revision: 5,
      type: "practice_attempt_shared",
      actor: "learner",
      payload: {
        capsuleId,
        attemptRevision: 1,
        cardCount: 8,
        availableForAgentReview: true,
        consentGranted: true,
        rawTaskContentShared: false,
      },
    });
    const coached = learningEvent("event-practice-r1-coached", {
      revision: 6,
      type: "practice_coaching_recorded",
      actor: "codex",
      payload: {
        capsuleId,
        attemptRevision: 1,
        move: "reconsider_card",
        cardId: "done_when",
        ready: false,
      },
    });

    expect(enqueueLearningEvent(shared).enqueued).toBe(true);
    expect(enqueueLearningEvent(shared)).toMatchObject({
      enqueued: false,
      alreadyDelivered: false,
      pendingCount: 1,
    });
    expect(enqueueLearningEvent(coached).enqueued).toBe(true);

    const publishEvent = vi.fn(async (_envelope: LearningEventEnvelope) => ({}));
    window.ogramDesktop = { learning: { publishEvent } };

    await expect(flushLearningEventOutbox()).resolves.toMatchObject({
      status: "synced",
      deliveredEventIds: [
        "event-practice-r1-shared",
        "event-practice-r1-coached",
      ],
      pendingEventIds: [],
    });
    expect(
      publishEvent.mock.calls.map(([envelope]) => ({
        eventId: (envelope as { eventId: string }).eventId,
        type: (envelope as { type: string }).type,
      })),
    ).toEqual([
      {
        eventId: "event-practice-r1-shared",
        type: "learning.practice_attempt.shared",
      },
      {
        eventId: "event-practice-r1-coached",
        type: "learning.practice_coaching.recorded",
      },
    ]);

    expect(enqueueLearningEvent(shared)).toMatchObject({
      enqueued: false,
      alreadyDelivered: true,
      pendingCount: 0,
    });
    expect(enqueueLearningEvent(coached)).toMatchObject({
      enqueued: false,
      alreadyDelivered: true,
      pendingCount: 0,
    });
    await expect(retryLearningEventOutbox()).resolves.toMatchObject({
      status: "synced",
      deliveredEventIds: [],
    });
    expect(publishEvent).toHaveBeenCalledTimes(2);
    expect(getJourneyOutbox()).toMatchObject({
      items: [],
      deliveredThrough: { "learning-session-shared": 6 },
    });
  });

  it("persists an idempotent outbox entry and rejects event-id collisions", () => {
    const event = learningEvent("event-idempotent");

    expect(enqueueLearningEvent(event).enqueued).toBe(true);
    expect(enqueueLearningEvent(event)).toMatchObject({
      enqueued: false,
      alreadyDelivered: false,
      pendingCount: 1,
    });
    expect(getJourneyOutbox().items).toHaveLength(1);

    expect(() =>
      enqueueLearningEvent({ ...event, summary: "Different event content." }),
    ).toThrow(/different content/);
  });

  it("rejects an event whose actor and payload violate its event family", () => {
    const invalid = learningEvent("event-invalid", {
      actor: "codex",
    });

    expect(() => enqueueLearningEvent(invalid)).toThrow(
      /violates the public envelope contract/,
    );
    expect(getJourneyOutbox().items).toHaveLength(0);
  });

  it("does not replay a persisted envelope that violates the public contract", async () => {
    const event = learningEvent("event-tampered");
    const envelope = { ...toLearningEventEnvelope(event), actor: "codex" };
    window.localStorage.setItem(
      "ogram-learning-outbox:v1",
      JSON.stringify({
        version: 1,
        items: [
          {
            envelope,
            enqueuedAt: "2026-08-29T10:00:00.000Z",
            attempts: 0,
            lastAttemptAt: null,
            lastError: null,
          },
        ],
        deliveredEventIds: [],
      }),
    );
    const publishEvent = vi.fn(async () => ({}));
    window.ogramDesktop = { learning: { publishEvent } };

    expect(getJourneyOutbox().items).toHaveLength(0);
    expect(await flushLearningEventOutbox()).toMatchObject({
      status: "synced",
      deliveredEventIds: [],
    });
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it("reports a durable pending queue when no delivery channel exists", async () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const result = await publishLearningEvent(learningEvent("event-local"));

    expect(result).toMatchObject({
      mode: "local-queue",
      status: "pending",
      eventId: "event-local",
      pendingCount: 1,
    });
    expect(getJourneyOutbox().items[0]?.envelope.eventId).toBe("event-local");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("flushes queued events to the native preload bridge in order", async () => {
    enqueueLearningEvent(learningEvent("event-first"));
    enqueueLearningEvent(learningEvent("event-second"));
    const publishEvent = vi.fn(
      async (_envelope: unknown): Promise<{ eventId?: string }> => ({}),
    );
    window.ogramDesktop = { learning: { publishEvent } };

    const result = await flushLearningEventOutbox();

    expect(result).toMatchObject({
      mode: "native-ipc",
      status: "synced",
      deliveredEventIds: ["event-first", "event-second"],
      pendingEventIds: [],
    });
    expect(
      publishEvent.mock.calls.map(([envelope]) =>
        (envelope as { eventId: string }).eventId,
      ),
    ).toEqual(["event-first", "event-second"]);
    expect(getJourneyOutbox().items).toHaveLength(0);
  });

  it("posts queued events to the management endpoint in order", async () => {
    vi.stubEnv("VITE_OGRAM_MANAGEMENT_URL", "https://management.example.test/");
    const fetchMock = vi.fn(
      async (
        _input: RequestInfo | URL,
        _init?: RequestInit,
      ): Promise<Response> => ({ ok: true, status: 202 }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    enqueueLearningEvent(learningEvent("event-api-first"));
    enqueueLearningEvent(learningEvent("event-api-second"));

    const result = await flushLearningEventOutbox();

    expect(result).toMatchObject({
      mode: "management-api",
      status: "synced",
      deliveredEventIds: ["event-api-first", "event-api-second"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://management.example.test/v1/learning/events",
      "https://management.example.test/v1/learning/events",
    ]);
    expect(
      fetchMock.mock.calls.map(([, init]) =>
        JSON.parse(String(init?.body)).eventId,
      ),
    ).toEqual(["event-api-first", "event-api-second"]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
    });
  });

  it("stops on a delivery error, retains retry metadata, and later retries in order", async () => {
    enqueueLearningEvent(learningEvent("event-retry-first"));
    enqueueLearningEvent(learningEvent("event-retry-second"));
    const publishEvent = vi
      .fn<(envelope: unknown) => Promise<{ eventId?: string }>>()
      .mockRejectedValueOnce(new Error("desktop offline"))
      .mockResolvedValue({});
    window.ogramDesktop = { learning: { publishEvent } };

    const failed = await flushLearningEventOutbox();

    expect(failed).toMatchObject({
      mode: "local-queue",
      attemptedMode: "native-ipc",
      status: "error",
      failedEventId: "event-retry-first",
      pendingEventIds: ["event-retry-first", "event-retry-second"],
    });
    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(getJourneyOutbox().items[0]).toMatchObject({
      attempts: 1,
      lastError: "desktop offline",
    });

    const retried = await retryLearningEventOutbox();

    expect(retried).toMatchObject({
      mode: "native-ipc",
      status: "synced",
      deliveredEventIds: ["event-retry-first", "event-retry-second"],
    });
    expect(
      publishEvent.mock.calls.map(([envelope]) =>
        (envelope as { eventId: string }).eventId,
      ),
    ).toEqual([
      "event-retry-first",
      "event-retry-first",
      "event-retry-second",
    ]);
  });

  it("times out a hung desktop delivery and releases the queue for retry", async () => {
    vi.useFakeTimers();
    try {
      enqueueLearningEvent(learningEvent("event-timeout"));
      const publishEvent = vi
        .fn<(envelope: unknown) => Promise<Record<string, never>>>()
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValue({});
      window.ogramDesktop = { learning: { publishEvent } };

      const firstAttempt = flushLearningEventOutbox();
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(firstAttempt).resolves.toMatchObject({
        status: "error",
        failedEventId: "event-timeout",
      });

      await expect(retryLearningEventOutbox()).resolves.toMatchObject({
        status: "synced",
        deliveredEventIds: ["event-timeout"],
      });
      expect(publishEvent).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps canonical summary and revision even if a payload repeats them", () => {
    const envelope = toLearningEventEnvelope(
      learningEvent("event-canonical", {
        revision: 9,
        summary: "Canonical summary.",
        payload: {
          capsuleId: "capsule-shared",
          contextReceiptId: "receipt-learning-session-shared-r1",
          proof: "A clean fork carries only approved decisions.",
          proofMode: "observed_habit",
          revision: 999,
          summary: "Payload override.",
        },
      }),
    );

    expect(envelope.data).toMatchObject({
      revision: 9,
      summary: "Canonical summary.",
    });
  });

  it("does not enqueue or redeliver an event with a persisted delivery receipt", async () => {
    const publishEvent = vi.fn(
      async (_envelope: unknown): Promise<{ eventId?: string }> => ({}),
    );
    window.ogramDesktop = { learning: { publishEvent } };
    const event = learningEvent("event-once");

    expect((await publishLearningEvent(event)).status).toBe("synced");
    expect((await publishLearningEvent(event)).status).toBe("synced");

    expect(publishEvent).toHaveBeenCalledTimes(1);
    expect(getJourneyOutbox()).toMatchObject({
      items: [],
      deliveredEventIds: ["event-once"],
      deliveredThrough: { "learning-session-shared": 1 },
    });
  });

  it("uses the per-session delivered revision after recent event IDs are pruned", async () => {
    const publishEvent = vi.fn(async () => ({}));
    window.ogramDesktop = { learning: { publishEvent } };
    const event = learningEvent("event-old");

    expect((await publishLearningEvent(event)).status).toBe("synced");
    const stored = JSON.parse(
      window.localStorage.getItem("ogram-learning-outbox:v1")!,
    ) as Record<string, unknown>;
    stored.deliveredEventIds = [];
    window.localStorage.setItem(
      "ogram-learning-outbox:v1",
      JSON.stringify(stored),
    );

    expect(enqueueLearningEvent(event)).toMatchObject({
      enqueued: false,
      alreadyDelivered: true,
      pendingCount: 0,
    });
    expect(publishEvent).toHaveBeenCalledTimes(1);
  });
});
