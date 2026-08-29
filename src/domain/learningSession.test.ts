import { describe, expect, it } from "vitest";
import {
  addLearningModuleTransition,
  completeCapsuleTransition,
  createInitialLearningState,
  isUsableLearningState,
  publishCapsuleTransition,
  queueDesktopFollowUpTransition,
  recordChoiceTransition,
  resetLearningSession,
  restoreLearningState,
  retryJourneySyncTransition,
  submitSignalsTransition,
} from "./learningSession";
import type { LearningSessionDependencies } from "./learningSession";
import type {
  ContextReceiptProvenance,
  LearningModuleInput,
  LearningState,
  OgramInjectedContext,
  PracticeSignal,
} from "./types";

function deterministicDependencies(seed = "alpha"): LearningSessionDependencies {
  let id = 0;
  let tick = 0;
  const start = Date.parse("2026-08-29T08:00:00.000Z");
  return {
    now: () => new Date(start + tick++ * 60_000),
    makeId: (prefix) => `${prefix}-${seed}-${String(++id).padStart(3, "0")}`,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function correctChoiceId(state: LearningState): string {
  const choice = state.activeCapsule.choices.find((candidate) => candidate.correct);
  if (!choice) throw new Error("The fixture must contain a correct choice.");
  return choice.id;
}

function productionContext(): OgramInjectedContext {
  return {
    sourceLabel: "ogram-injected-context",
    environment: "production",
    learner: {
      displayName: "Léa Martin",
      role: "Client success & operations lead",
      organisation: "Atelier North",
      locale: "French-speaking Switzerland",
    },
    roleGoals: ["Create precise client handoffs"],
    workshopNotes: ["Practise one observable habit"],
    preferences: ["Short learning sessions"],
    privacyBoundary: "Only sanitized behavioural summaries may leave Codex.",
    requiredTraining: null,
  };
}

function producerProvenance(capturedAt: string): ContextReceiptProvenance {
  return {
    ogramContext: {
      provenanceId: "producer:ogram-profile:0001",
      kind: "ogram_context",
      environment: "production",
      version: "ogram-context/v1",
      capturedAt,
    },
    practiceSignals: {
      provenanceId: "producer:codex-review:0001",
      kind: "codex_practice_signals",
      environment: "production",
      version: "practice-signal-taxonomy/v1",
      capturedAt,
    },
    learningJourney: {
      provenanceId: "producer:learning-journey:0001",
      kind: "ogram_learning_journey",
      environment: "production",
      version: "learning-journey/v3",
      capturedAt,
    },
  };
}

describe("learningSession", () => {
  it("constructs one stable session with strictly monotonic event revisions", () => {
    const state = createInitialLearningState(deterministicDependencies());

    expect(state.revision).toBe(3);
    expect(state.events.map((event) => event.revision)).toEqual([1, 2, 3]);
    expect(new Set(state.events.map((event) => event.sessionId))).toEqual(
      new Set([state.sessionId]),
    );
    expect(state.activeCapsule.compiler.contextReceiptId).toBe(
      state.contextReceipt.receiptId,
    );
    expect(
      state.contextReceipt.provenance.ogramContext.provenanceId,
    ).toBe("synthetic:ogram-context-fixture:v1");
    expect(state.events.every((event) => event.payload?.revision === event.revision)).toBe(
      true,
    );
    expect(
      state.events.find((event) => event.type === "coaching_signals_submitted")
        ?.payload,
    ).not.toHaveProperty("contextReceiptId");
    expect(isUsableLearningState(state)).toBe(true);
  });

  it("keeps the visible receipt stable for signal-only writes and replaces it atomically on publish", () => {
    const dependencies = deterministicDependencies();
    const initial = createInitialLearningState(dependencies);
    const receiptBeforeSignals = initial.contextReceipt;
    const signals: PracticeSignal[] = initial.signals.slice(0, 2).map(
      (signal, index) => ({
        ...signal,
        sourceTaskCount: index === 0 ? 2 : 7,
      }),
    );

    const submitted = submitSignalsTransition(initial, signals, dependencies);
    expect(submitted.result.revision).toBe(4);
    expect(submitted.state.contextReceipt).toBe(receiptBeforeSignals);
    expect(submitted.state.activeCapsule.compiler.contextReceiptId).toBe(
      submitted.state.contextReceipt.receiptId,
    );
    expect(submitted.state.events.at(-1)?.payload?.reviewedTaskCount).toBe(7);
    expect(submitted.state.events.at(-1)?.payload).not.toHaveProperty(
      "contextReceiptId",
    );

    const published = publishCapsuleTransition(
      submitted.state,
      { focus: signals[1]!.id, difficulty: "stretch" },
      dependencies,
    );
    expect(published.result.revision).toBe(5);
    expect(published.state.contextReceipt).not.toBe(receiptBeforeSignals);
    expect(published.state.contextReceipt.practiceSignals).toHaveLength(2);
    expect(
      published.state.contextReceipt.provenance.practiceSignals.provenanceId,
    ).not.toBe(receiptBeforeSignals.provenance.practiceSignals.provenanceId);
    expect(
      published.state.contextReceipt.provenance.learningJourney.provenanceId,
    ).not.toBe(receiptBeforeSignals.provenance.learningJourney.provenanceId);
    expect(
      published.state.contextReceipt.provenance.ogramContext.provenanceId,
    ).toBe(receiptBeforeSignals.provenance.ogramContext.provenanceId);
    expect(published.state.activeCapsule.compiler.contextReceiptId).toBe(
      published.state.contextReceipt.receiptId,
    );
    expect(published.state.events.at(-1)?.payload?.contextReceiptId).toBe(
      published.state.contextReceipt.receiptId,
    );
    expect(isUsableLearningState(published.state)).toBe(true);
  });

  it("rejects malformed or duplicate signals before deriving event counts", () => {
    const dependencies = deterministicDependencies();
    const initial = createInitialLearningState(dependencies);
    const baseline = initial.signals[0]!;
    const invalidSignals: unknown[] = [
      [],
      [baseline, { ...baseline }],
      [{ ...baseline, id: "unknown_signal" }],
      [{ ...baseline, level: "urgent" }],
      [{ ...baseline, confidence: Number.NaN }],
      [{ ...baseline, confidence: 1.01 }],
      [{ ...baseline, sourceTaskCount: 0 }],
      [{ ...baseline, sourceTaskCount: 9 }],
      [{ ...baseline, rawTaskContent: "must never cross the boundary" }],
    ];

    for (const signals of invalidSignals) {
      expect(() =>
        submitSignalsTransition(
          initial,
          signals as PracticeSignal[],
          dependencies,
        ),
      ).toThrow();
    }
    expect(initial.revision).toBe(3);
    expect(initial.events).toHaveLength(3);
  });

  it("uses dependency-generated capsule ids when the clock does not advance", () => {
    let id = 0;
    const dependencies: LearningSessionDependencies = {
      now: () => new Date("2026-08-29T08:00:00.000Z"),
      makeId: (prefix) => `${prefix}-fixed-${String(++id).padStart(4, "0")}`,
    };
    const initial = createInitialLearningState(dependencies);
    const first = publishCapsuleTransition(
      initial,
      { focus: "thread_hygiene" },
      dependencies,
    );
    const second = publishCapsuleTransition(
      first.state,
      { focus: "thread_hygiene" },
      dependencies,
    );

    expect(initial.activeCapsule.createdAt).toBe(
      first.state.activeCapsule.createdAt,
    );
    expect(new Set([
      initial.activeCapsule.id,
      first.state.activeCapsule.id,
      second.state.activeCapsule.id,
    ]).size).toBe(3);
  });

  it("requires producer provenance for production receipts", () => {
    const dependencies = deterministicDependencies("production");
    const initial = createInitialLearningState(dependencies);
    const productionState: LearningState = {
      ...initial,
      context: productionContext(),
    };

    expect(() =>
      publishCapsuleTransition(
        productionState,
        { focus: "thread_hygiene" },
        dependencies,
      ),
    ).toThrow(/require producer-supplied source provenance/);

    const provenanceRequests: Array<{
      sessionId: string;
      revision: number;
      capturedAt: string;
    }> = [];
    const suppliedDependencies: LearningSessionDependencies = {
      ...dependencies,
      contextProvenance: ({ capturedAt, revision, sessionId }) => {
        provenanceRequests.push({ capturedAt, revision, sessionId });
        return producerProvenance(capturedAt);
      },
    };
    const published = publishCapsuleTransition(
      productionState,
      { focus: "thread_hygiene" },
      suppliedDependencies,
    );
    expect(published.state.contextReceipt.environment).toBe("production");
    expect(published.state.contextReceipt.provenance.ogramContext.provenanceId).toBe(
      "producer:ogram-profile:0001",
    );
    expect(published.state.contextReceipt.provenance.ogramContext.provenanceId).not.toContain(
      productionState.sessionId,
    );
    expect(provenanceRequests).toEqual([
      {
        sessionId: productionState.sessionId,
        revision: 4,
        capturedAt: published.state.contextReceipt.assembledAt,
      },
    ]);
    expect(isUsableLearningState(published.state)).toBe(true);
  });

  it("rejects unbounded learning modules before allocating ids or events", () => {
    const dependencies = deterministicDependencies();
    const initial = createInitialLearningState(dependencies);
    const capsuleId = initial.activeCapsule.id;
    const validVideo: LearningModuleInput = {
      kind: "video",
      title: "Watch the boundary",
      description: "A short explanation of clean task boundaries.",
      url: "https://www.youtube.com/watch?v=abcDEF_123-",
    };
    const invalidModules: unknown[] = [
      { ...validVideo, title: "No" },
      { ...validVideo, description: "Too short" },
      { ...validVideo, url: "http://www.youtube.com/watch?v=abcDEF_123-" },
      { ...validVideo, url: "https://www.youtube.com/embed/abcDEF_123-" },
      {
        kind: "walkthrough",
        title: "Try the boundary",
        description: "A short rehearsal of clean task boundaries.",
        steps: ["Only one step"],
      },
      {
        kind: "mini_game",
        title: "Choose a boundary",
        description: "A compact decision practice for task boundaries.",
        prompt: "Which response creates the clearest task boundary?",
        options: [
          {
            id: "keep",
            label: "Keep going",
            feedback: "This carries old exploration into the new deliverable.",
            correct: false,
          },
          {
            id: "fork",
            label: "Fork cleanly",
            feedback: "This moves the approved decisions into a clean task.",
            correct: false,
          },
        ],
      },
    ];

    for (const moduleInput of invalidModules) {
      expect(() =>
        addLearningModuleTransition(
          initial,
          capsuleId,
          moduleInput as LearningModuleInput,
          dependencies,
        ),
      ).toThrow();
    }
    const added = addLearningModuleTransition(
      initial,
      capsuleId,
      validVideo,
      dependencies,
    );
    expect(added.state.activeCapsule.learningModules?.[0]).toMatchObject({
      kind: "video",
      provider: "YouTube",
      url: validVideo.kind === "video" ? validVideo.url : "",
    });
    expect(added.result.revision).toBe(4);
  });

  it("rejects optional modules once the learner has completed the capsule", () => {
    const dependencies = deterministicDependencies();
    const initial = createInitialLearningState(dependencies);
    const selected = recordChoiceTransition(
      initial,
      initial.activeCapsule.id,
      correctChoiceId(initial),
      dependencies,
    );
    const completed = completeCapsuleTransition(
      selected.state,
      selected.state.activeCapsule.id,
      undefined,
      dependencies,
    );

    expect(() =>
      addLearningModuleTransition(
        completed.state,
        completed.state.activeCapsule.id,
        {
          kind: "walkthrough",
          title: "One clean rehearsal",
          description: "Practise the boundary while it is still visible.",
          steps: ["Name the outcome", "Name the boundary"],
        },
        dependencies,
      ),
    ).toThrow("only be added to an active capsule");
    expect(completed.state.events.at(-1)?.type).toBe("training_completed");
  });

  it("advances every learning mutation without changing the session identity", () => {
    const dependencies = deterministicDependencies();
    let state = createInitialLearningState(dependencies);
    const sessionId = state.sessionId;

    const published = publishCapsuleTransition(
      state,
      { focus: "task_shaping" },
      dependencies,
    );
    state = published.state;
    const module = addLearningModuleTransition(
      state,
      state.activeCapsule.id,
      {
        kind: "walkthrough",
        title: "One clean rehearsal",
        description: "Practise the move once.",
        steps: ["Name the outcome", "Name the boundary"],
      },
      dependencies,
    );
    state = module.state;
    const choice = recordChoiceTransition(
      state,
      state.activeCapsule.id,
      correctChoiceId(state),
      dependencies,
    );
    state = choice.state;
    const completed = completeCapsuleTransition(
      state,
      state.activeCapsule.id,
      undefined,
      dependencies,
    );
    state = completed.state;
    const followedUp = queueDesktopFollowUpTransition(
      state,
      state.activeCapsule.id,
      "Bring this back when the deliverable changes.",
      dependencies,
    );

    expect([
      published.result.revision,
      module.result.revision,
      choice.result.revision,
      completed.result.revision,
      followedUp.result.revision,
    ]).toEqual([4, 5, 6, 7, 8]);
    expect(followedUp.state.sessionId).toBe(sessionId);
    expect(followedUp.state.events.at(-1)?.revision).toBe(8);
    expect(
      followedUp.state.events.every((event) => event.sessionId === sessionId),
    ).toBe(true);
  });

  it("normalizes the learner contract and records an explicit, non-duplicable reminder", () => {
    const dependencies = deterministicDependencies();
    const initial = createInitialLearningState(dependencies);
    const selected = recordChoiceTransition(
      initial,
      initial.activeCapsule.id,
      correctChoiceId(initial),
      dependencies,
    );
    const editedContract = {
      cue: "  When the deliverable changes shape  ",
      response: "  Pause and choose the right task boundary  ",
      proof: "  The next deliverable begins with a clean handoff  ",
    };
    const completed = completeCapsuleTransition(
      selected.state,
      selected.state.activeCapsule.id,
      editedContract,
      dependencies,
    );
    const journeyEntry = completed.state.journey.find(
      (entry) => entry.capsuleId === completed.state.activeCapsule.id,
    );

    expect(completed.state.activeCapsule.practiceContract).toEqual({
      cue: "When the deliverable changes shape",
      response: "Pause and choose the right task boundary",
      proof: "The next deliverable begins with a clean handoff",
    });
    expect(journeyEntry).toMatchObject({
      status: "completed",
      proof: "The next deliverable begins with a clean handoff",
      proofStatus: "awaiting",
      completedAt: completed.result.completedAt,
    });

    const reminder = queueDesktopFollowUpTransition(
      completed.state,
      completed.state.activeCapsule.id,
      "  Bring this back at the next matching moment.  ",
      dependencies,
    );
    const event = reminder.state.events.at(-1);
    expect(event).toMatchObject({
      type: "desktop_follow_up_queued",
      actor: "learner",
      payload: {
        cue: "When the deliverable changes shape",
        response: "Pause and choose the right task boundary",
        proof: "The next deliverable begins with a clean handoff",
        reason: "Bring this back at the next matching moment.",
      },
    });
    expect(() =>
      queueDesktopFollowUpTransition(
        reminder.state,
        reminder.state.activeCapsule.id,
        "Bring this back at the next matching moment.",
        dependencies,
      ),
    ).toThrow("already queued");
  });

  it("rejects incomplete contracts before committing completion", () => {
    const dependencies = deterministicDependencies();
    const initial = createInitialLearningState(dependencies);
    const selected = recordChoiceTransition(
      initial,
      initial.activeCapsule.id,
      correctChoiceId(initial),
      dependencies,
    );

    expect(() =>
      completeCapsuleTransition(
        selected.state,
        selected.state.activeCapsule.id,
        { cue: "short", response: "A valid response", proof: "A valid proof" },
        dependencies,
      ),
    ).toThrow("cue must contain 8–220 characters");
    expect(selected.state.activeCapsule.status).toBe("active");
  });

  it("fails closed when cached nested state or capsule provenance is malformed", () => {
    const state = createInitialLearningState(deterministicDependencies());
    const receiptMismatch = clone(state);
    receiptMismatch.activeCapsule.compiler.contextReceiptId = "receipt-other-source";
    const brokenJourney = clone(state) as unknown as Record<string, unknown>;
    (brokenJourney.journey as Array<Record<string, unknown>>)[0]!.status =
      "invented";
    const brokenEvent = clone(state) as unknown as Record<string, unknown>;
    const events = brokenEvent.events as Array<Record<string, unknown>>;
    events[0]!.payload = { revision: 99 };
    const brokenSync = clone(state) as unknown as Record<string, unknown>;
    (brokenSync.journeySync as Record<string, unknown>).pendingCount = -1;
    const withModule = addLearningModuleTransition(
      state,
      state.activeCapsule.id,
      {
        kind: "video",
        title: "Watch the boundary",
        description: "A short explanation of clean task boundaries.",
        url: "https://www.youtube.com/watch?v=abcDEF_123-",
      },
      deterministicDependencies("cache"),
    ).state;
    const brokenModule = clone(withModule);
    const cachedModule = brokenModule.activeCapsule.learningModules?.[0];
    if (cachedModule?.kind === "video") {
      cachedModule.url = "https://evil.example/video";
    }
    const brokenModuleText = clone(withModule);
    const cachedTextModule = brokenModuleText.activeCapsule.learningModules?.[0];
    if (cachedTextModule) cachedTextModule.title = "x";

    expect(isUsableLearningState(receiptMismatch)).toBe(false);
    expect(isUsableLearningState(brokenJourney)).toBe(false);
    expect(isUsableLearningState(brokenEvent)).toBe(false);
    expect(isUsableLearningState(brokenSync)).toBe(false);
    expect(isUsableLearningState(brokenModule)).toBe(false);
    expect(isUsableLearningState(brokenModuleText)).toBe(false);

    const restored = restoreLearningState(
      receiptMismatch,
      deterministicDependencies("restored"),
    );
    expect(restored.sessionId).not.toBe(state.sessionId);
    expect(isUsableLearningState(restored)).toBe(true);
  });

  it("recovers interrupted sync and resets into a new, monotonic session", () => {
    const dependencies = deterministicDependencies();
    const initial = createInitialLearningState(dependencies);
    const syncing = clone(initial);
    syncing.journeySync.status = "syncing";
    const restored = restoreLearningState(syncing, dependencies);
    expect(restored.journeySync.status).toBe("queued");
    expect(restored.sessionId).toBe(initial.sessionId);
    expect(Object.isFrozen(restored.contextReceipt)).toBe(true);
    expect(Object.isFrozen(restored.contextReceipt.practiceSignals)).toBe(true);

    const retried = retryJourneySyncTransition(restored);
    const reset = resetLearningSession(retried.state, dependencies);
    expect(retried.result.revision).toBe(4);
    expect(reset.result.revision).toBe(7);
    expect(reset.state.events.map((event) => event.revision)).toEqual([5, 6, 7]);
    expect(reset.state.sessionId).not.toBe(initial.sessionId);
    expect(reset.state.events.every((event) => event.sessionId === reset.state.sessionId)).toBe(
      true,
    );
  });
});
