import { assembleContextReceipt, resolveContextEnvironment } from "./contextEngine";
import {
  chooseFocus,
  createCapsule,
  validateLearningModuleInput,
} from "./lessonEngine";
import { mockOgramContext, mockPracticeSignals } from "./mockData";
import {
  compileContextPackReview,
  createContextPackingInstrument,
  evaluateContextPack,
  normalizeContextPackPlacements,
} from "./practiceEngine";
import { contextPackCardIds, signalIds } from "./types";
import type {
  CapsuleDraftInput,
  ContextPackCardId,
  ContextPackCoachingMove,
  ContextPackPlacement,
  ContextPackReviewResolution,
  ContextReceipt,
  ContextReceiptProvenance,
  JourneyEntry,
  LearningEvent,
  LearningModuleInput,
  LearningState,
  OgramInjectedContext,
  PracticeContract,
  PracticeSignal,
  SharedContextPackSnapshot,
} from "./types";

export interface LearningSessionDependencies {
  now: () => Date;
  makeId: (prefix: string) => string;
  contextProvenance?: (
    request: ContextProvenanceRequest,
  ) => ContextReceiptProvenance;
}

export interface ContextProvenanceRequest {
  sessionId: string;
  revision: number;
  context: OgramInjectedContext;
  capturedAt: string;
}

export interface RevisionResult {
  revision: number;
}

export interface LearningTransition<R extends object> {
  state: LearningState;
  result: R & RevisionResult;
}

interface PendingTransition<R extends object> {
  state: LearningState;
  result: R;
}

function systemId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export const systemLearningSessionDependencies: LearningSessionDependencies = {
  now: () => new Date(),
  makeId: systemId,
};

function validNow(dependencies: LearningSessionDependencies): Date {
  const now = dependencies.now();
  if (Number.isNaN(now.getTime())) {
    throw new Error("Learning session time must be a valid date.");
  }
  return new Date(now.getTime());
}

function createEvent(
  dependencies: LearningSessionDependencies,
  sessionId: string,
  revision: number,
  type: LearningEvent["type"],
  actor: LearningEvent["actor"],
  summary: string,
  payload: Record<string, unknown>,
  at: Date,
): LearningEvent {
  return {
    id: dependencies.makeId("event"),
    sessionId,
    revision,
    type,
    at: at.toISOString(),
    actor,
    summary,
    payload: { revision, ...payload },
  };
}

function resolveContextProvenance(
  dependencies: LearningSessionDependencies,
  sessionId: string,
  revision: number,
  context: OgramInjectedContext,
  capturedAt: string,
): ContextReceiptProvenance {
  const environment = resolveContextEnvironment(context);
  if (dependencies.contextProvenance) {
    return dependencies.contextProvenance({
      sessionId,
      revision,
      context,
      capturedAt,
    });
  }
  if (environment === "production") {
    throw new Error(
      "Production context receipts require producer-supplied source provenance.",
    );
  }
  return {
    ogramContext: {
      provenanceId: "synthetic:ogram-context-fixture:v1",
      kind: "ogram_context",
      environment,
      version: "ogram-context/v1",
      capturedAt,
    },
    practiceSignals: {
      provenanceId: `synthetic:codex-practice:${sessionId}:r${revision}`,
      kind: "codex_practice_signals",
      environment,
      version: "practice-signal-taxonomy/v1",
      capturedAt,
    },
    learningJourney: {
      provenanceId: `synthetic:learning-journey:${sessionId}:r${revision}`,
      kind: "ogram_learning_journey",
      environment,
      version: "learning-journey/v3",
      capturedAt,
    },
  };
}

function createContextReceipt(
  dependencies: LearningSessionDependencies,
  sessionId: string,
  revision: number,
  context: OgramInjectedContext,
  signals: readonly PracticeSignal[],
  journey: readonly JourneyEntry[],
  now: Date,
): ContextReceipt {
  const assembledAt = now.toISOString();
  return assembleContextReceipt({
    receiptId: `receipt-${sessionId}-r${revision}`,
    context,
    signals,
    journey,
    provenance: resolveContextProvenance(
      dependencies,
      sessionId,
      revision,
      context,
      assembledAt,
    ),
    assembledAt,
  });
}

const allowedSignalKeys = new Set([
  "id",
  "label",
  "level",
  "confidence",
  "evidence",
  "recommendation",
  "sourceTaskCount",
]);

function boundedSignalText(
  value: string,
  maximum: number,
  field: string,
): void {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`${field} must contain 1–${maximum} characters.`);
  }
}

function cloneSignals(signals: readonly PracticeSignal[]): PracticeSignal[] {
  if (!Array.isArray(signals) || signals.length < 1 || signals.length > 4) {
    throw new Error("Practice signals must contain 1–4 observations.");
  }
  const seen = new Set<PracticeSignal["id"]>();
  return signals.map((signal, index) => {
    if (!signal || typeof signal !== "object" || Array.isArray(signal)) {
      throw new Error(`signals[${index}] must be an observation object.`);
    }
    const unexpected = Object.keys(signal).filter(
      (key) => !allowedSignalKeys.has(key),
    );
    if (unexpected.length > 0) {
      throw new Error(
        `signals[${index}] contains unsupported fields: ${unexpected.join(", ")}.`,
      );
    }
    if (!signalIds.includes(signal.id)) {
      throw new Error(`signals[${index}].id must be a supported practice signal.`);
    }
    if (
      signal.level !== "watch" &&
      signal.level !== "practice" &&
      signal.level !== "priority"
    ) {
      throw new Error(`signals[${index}].level is not supported.`);
    }
    if (
      !Number.isFinite(signal.confidence) ||
      signal.confidence < 0 ||
      signal.confidence > 1
    ) {
      throw new Error(`signals[${index}].confidence must be between 0 and 1.`);
    }
    if (
      !Number.isInteger(signal.sourceTaskCount) ||
      signal.sourceTaskCount < 1 ||
      signal.sourceTaskCount > 8
    ) {
      throw new Error(
        `signals[${index}].sourceTaskCount must be an integer from 1 to 8.`,
      );
    }
    if (seen.has(signal.id)) {
      throw new Error(`Practice signals contains duplicate id ${signal.id}.`);
    }
    seen.add(signal.id);
    boundedSignalText(signal.label, 80, `signals[${index}].label`);
    boundedSignalText(signal.evidence, 320, `signals[${index}].evidence`);
    boundedSignalText(
      signal.recommendation,
      240,
      `signals[${index}].recommendation`,
    );
    return { ...signal };
  });
}

function initialJourney(): JourneyEntry[] {
  return [
    {
      id: "journey-01",
      dateLabel: "Wed",
      title: "Make context portable",
      focus: "task_shaping",
      status: "completed",
      proof: "Created a one-paragraph handoff brief.",
      proofStatus: "confirmed",
    },
    {
      id: "journey-02",
      dateLabel: "Thu",
      title: "Give files a home",
      focus: "workspace_hygiene",
      status: "completed",
      proof: "Started work inside a dedicated project.",
      proofStatus: "confirmed",
    },
  ];
}

function queuedSync(
  current: LearningState["journeySync"],
  additionalEvents = 1,
): LearningState["journeySync"] {
  return {
    status: "queued",
    mode: "local-queue",
    pendingCount: current.pendingCount + additionalEvents,
    detail:
      "Committed locally. The durable journey outbox will process this event after the React commit.",
    lastSyncedAt: current.lastSyncedAt,
  };
}

function advance<R extends object>(
  current: LearningState,
  mutate: (revision: number) => PendingTransition<R>,
): LearningTransition<R> {
  if (!Number.isInteger(current.revision) || current.revision < 1) {
    throw new Error("The current learning revision must be a positive integer.");
  }
  const revision = current.revision + 1;
  const transition = mutate(revision);
  return {
    state: { ...transition.state, revision },
    result: { ...transition.result, revision },
  };
}

function cloneLearningModule(moduleInput: LearningModuleInput, id: string) {
  if (moduleInput.kind === "video") {
    return { ...moduleInput, id, provider: "YouTube" as const };
  }
  if (moduleInput.kind === "walkthrough") {
    return { ...moduleInput, id, steps: [...moduleInput.steps] };
  }
  return {
    ...moduleInput,
    id,
    options: moduleInput.options.map((option) => ({ ...option })),
  };
}

function completedContract(
  edited: PracticeContract | undefined,
  fallback: PracticeContract,
): PracticeContract {
  const source = edited ?? fallback;
  const normalized: PracticeContract = {
    cue: source.cue.trim(),
    response: source.response.trim(),
    proof: source.proof.trim(),
  };
  for (const [field, value] of Object.entries(normalized)) {
    if (value.length < 8 || value.length > 220) {
      throw new Error(`${field} must contain 8–220 characters.`);
    }
  }
  return normalized;
}

export function createInitialLearningState(
  dependencies: LearningSessionDependencies,
  revisionBase = 0,
): LearningState {
  if (!Number.isInteger(revisionBase) || revisionBase < 0) {
    throw new Error("revisionBase must be a non-negative integer.");
  }
  const now = validNow(dependencies);
  const sessionId = dependencies.makeId("learn-session");
  const signals = cloneSignals(mockPracticeSignals);
  const journey = initialJourney();
  const contextReceiptRevision = revisionBase + 1;
  const contextReceipt = createContextReceipt(
    dependencies,
    sessionId,
    contextReceiptRevision,
    mockOgramContext,
    signals,
    journey,
    now,
  );
  const activeCapsule = createCapsule(
    {
      focus: chooseFocus(signals),
      personalizedScenario: "",
      coachNote:
        "Your work often changes mode halfway through. Today, practise noticing that boundary before the context becomes a burden.",
      sourceTaskCount: 8,
      contextReceiptId: contextReceipt.receiptId,
    },
    mockOgramContext,
    signals,
    now,
    dependencies.makeId("capsule"),
  );
  const activeJourneyEntry: JourneyEntry = {
    id: dependencies.makeId("journey"),
    capsuleId: activeCapsule.id,
    dateLabel: "Today",
    title: activeCapsule.title,
    focus: activeCapsule.focus,
    status: "today",
    proofStatus: "awaiting",
  };
  const contextEvent = createEvent(
    dependencies,
    sessionId,
    contextReceiptRevision,
    "context_loaded",
    "ogram",
    "Synthetic workshop, role, and journey context loaded.",
    { contextReceiptId: contextReceipt.receiptId },
    now,
  );
  const signalsRevision = revisionBase + 2;
  const signalsEvent = createEvent(
    dependencies,
    sessionId,
    signalsRevision,
    "coaching_signals_submitted",
    "codex",
    "Three privacy-preserving practice signals prepared from mock task metadata.",
    {
      signalCount: signals.length,
      reviewedTaskCount: Math.max(
        ...signals.map((signal) => signal.sourceTaskCount),
      ),
      rawTaskContentShared: false,
    },
    now,
  );
  const capsuleRevision = revisionBase + 3;
  const capsuleEvent = createEvent(
    dependencies,
    sessionId,
    capsuleRevision,
    "capsule_published",
    "codex",
    "Today’s five-minute lesson was published.",
    {
      capsuleId: activeCapsule.id,
      contextReceiptId: contextReceipt.receiptId,
      focus: activeCapsule.focus,
      compiler: activeCapsule.compiler,
    },
    now,
  );

  return {
    version: 4,
    sessionId,
    revision: capsuleRevision,
    context: mockOgramContext,
    contextReceipt,
    signals,
    activeCapsule,
    journey: [...journey, activeJourneyEntry],
    events: [contextEvent, signalsEvent, capsuleEvent],
    journeySync: {
      status: "idle",
      mode: null,
      pendingCount: 0,
      detail: "The learning journey is ready to enter the durable outbox.",
      lastSyncedAt: null,
    },
  };
}

type UnknownRecord = Record<string, unknown>;

const eventTypes = new Set<LearningEvent["type"]>([
  "context_loaded",
  "coaching_signals_submitted",
  "capsule_published",
  "learning_module_added",
  "practice_attempt_shared",
  "practice_consent_withdrawn",
  "practice_coaching_recorded",
  "practice_review_resolved",
  "choice_recorded",
  "training_completed",
  "desktop_follow_up_queued",
]);
const eventActors = new Set<LearningEvent["actor"]>([
  "codex",
  "learner",
  "ogram",
]);
const syncStatuses = new Set<LearningState["journeySync"]["status"]>([
  "idle",
  "queued",
  "syncing",
  "synced",
  "error",
]);
const syncModes = new Set<NonNullable<LearningState["journeySync"]["mode"]>>([
  "native-ipc",
  "management-api",
  "local-queue",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim()) &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isContext(value: unknown, snapshot: boolean): boolean {
  if (!isRecord(value) || value.sourceLabel !== "ogram-injected-context") {
    return false;
  }
  if (
    snapshot
      ? value.environment !== "synthetic" && value.environment !== "production"
      : value.environment !== undefined &&
        value.environment !== "synthetic" &&
        value.environment !== "production"
  ) {
    return false;
  }
  if (
    !snapshot &&
    value.environment === undefined &&
    value.synthetic !== true
  ) {
    return false;
  }
  if (!isRecord(value.learner)) return false;
  if (
    !isNonEmptyString(value.learner.displayName) ||
    !isNonEmptyString(value.learner.role) ||
    !isNonEmptyString(value.learner.organisation) ||
    !isNonEmptyString(value.learner.locale) ||
    !isStringList(value.roleGoals) ||
    !isStringList(value.workshopNotes) ||
    !isStringList(value.preferences) ||
    !isNonEmptyString(value.privacyBoundary)
  ) {
    return false;
  }
  if (value.requiredTraining === null) return true;
  return (
    isRecord(value.requiredTraining) &&
    isNonEmptyString(value.requiredTraining.id) &&
    isNonEmptyString(value.requiredTraining.title) &&
    isNonEmptyString(value.requiredTraining.dueLabel) &&
    (value.requiredTraining.status === "assigned" ||
      value.requiredTraining.status === "completed")
  );
}

function isPracticeContract(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return [value.cue, value.response, value.proof].every(
    (field) =>
      typeof field === "string" &&
      field.trim().length >= 8 &&
      field.trim().length <= 220,
  );
}

function isLearningModule(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.description)
  ) {
    return false;
  }
  if (
    value.id.length < 8 ||
    value.id.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.id)
  ) {
    return false;
  }
  try {
    if (value.kind === "video") {
      if (
        Object.keys(value).some(
          (key) =>
            !["id", "kind", "title", "description", "provider", "url"].includes(
              key,
            ),
        )
      ) {
        return false;
      }
      if (value.provider !== "YouTube") return false;
      validateLearningModuleInput({
        kind: "video",
        title: value.title,
        description: value.description,
        url: value.url,
      } as LearningModuleInput);
      return true;
    }
    if (value.kind === "walkthrough") {
      if (
        Object.keys(value).some(
          (key) =>
            !["id", "kind", "title", "description", "steps"].includes(key),
        )
      ) {
        return false;
      }
      validateLearningModuleInput({
        kind: "walkthrough",
        title: value.title,
        description: value.description,
        steps: value.steps,
      } as LearningModuleInput);
      return true;
    }
    if (value.kind === "mini_game") {
      if (
        Object.keys(value).some(
          (key) =>
            ![
              "id",
              "kind",
              "title",
              "description",
              "prompt",
              "options",
            ].includes(key),
        )
      ) {
        return false;
      }
      validateLearningModuleInput({
        kind: "mini_game",
        title: value.title,
        description: value.description,
        prompt: value.prompt,
        options: value.options,
      } as LearningModuleInput);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function isContextPackingCollaboration(
  instrumentValue: unknown,
  collaborationValue: unknown,
): boolean {
  if (!isRecord(instrumentValue) || instrumentValue.kind !== "context_packing") {
    return false;
  }
  if (
    !isNonEmptyString(instrumentValue.title) ||
    !isNonEmptyString(instrumentValue.prompt) ||
    !Array.isArray(instrumentValue.cards) ||
    instrumentValue.cards.length !== contextPackCardIds.length
  ) {
    return false;
  }
  const cardIds = new Set<string>();
  for (const card of instrumentValue.cards) {
    if (
      !isRecord(card) ||
      typeof card.id !== "string" ||
      !contextPackCardIds.includes(card.id as (typeof contextPackCardIds)[number]) ||
      cardIds.has(card.id) ||
      !isNonEmptyString(card.label) ||
      !isNonEmptyString(card.description) ||
      (card.expectedZone !== "carry" && card.expectedZone !== "leave")
    ) {
      return false;
    }
    cardIds.add(card.id);
  }
  const canonicalInstrument = createContextPackingInstrument();
  if (JSON.stringify(instrumentValue) !== JSON.stringify(canonicalInstrument)) {
    return false;
  }
  if (!isRecord(collaborationValue)) return false;
  if (
    !["drafting", "awaiting_review", "revision_requested", "ready"].includes(
      String(collaborationValue.phase),
    ) ||
    !["private", "granted", "consumed"].includes(
      String(collaborationValue.consent),
    ) ||
    !Number.isInteger(collaborationValue.attemptRevision) ||
    Number(collaborationValue.attemptRevision) < 0 ||
    !Array.isArray(collaborationValue.snapshots) ||
    collaborationValue.snapshots.length > 12 ||
    !Array.isArray(collaborationValue.reviews) ||
    collaborationValue.reviews.length > 12
  ) {
    return false;
  }
  const instrument = canonicalInstrument;
  let expectedRevision = 1;
  for (const snapshot of collaborationValue.snapshots) {
    if (
      !isRecord(snapshot) ||
      snapshot.attemptRevision !== expectedRevision ||
      !isTimestamp(snapshot.sharedAt) ||
      !Array.isArray(snapshot.placements)
    ) {
      return false;
    }
    try {
      normalizeContextPackPlacements(
        instrument,
        snapshot.placements as ContextPackPlacement[],
      );
    } catch {
      return false;
    }
    expectedRevision += 1;
  }
  if (
    Number(collaborationValue.attemptRevision) !==
    collaborationValue.snapshots.length
  ) {
    return false;
  }
  const reviewIds = new Set<string>();
  const reviewedRevisions = new Set<number>();
  for (const review of collaborationValue.reviews) {
    if (
      !isRecord(review) ||
      !isNonEmptyString(review.id) ||
      reviewIds.has(review.id) ||
      !Number.isInteger(review.attemptRevision) ||
      Number(review.attemptRevision) < 1 ||
      Number(review.attemptRevision) > Number(collaborationValue.attemptRevision) ||
      reviewedRevisions.has(Number(review.attemptRevision)) ||
      !isTimestamp(review.at) ||
      (review.move !== "reconsider_card" && review.move !== "confirm_ready") ||
      (review.cardId !== null &&
        (typeof review.cardId !== "string" ||
          !contextPackCardIds.includes(
            review.cardId as (typeof contextPackCardIds)[number],
          ))) ||
      !isNonEmptyString(review.message) ||
      review.message.length > 320 ||
      (review.resolution !== "pending" &&
        review.resolution !== "accepted" &&
        review.resolution !== "dismissed")
    ) {
      return false;
    }
    if (
      (review.move === "confirm_ready" &&
        (review.cardId !== null || review.resolution !== "accepted")) ||
      (review.move === "reconsider_card" && review.cardId === null)
    ) {
      return false;
    }
    const snapshot = collaborationValue.snapshots.find(
      (candidate) =>
        isRecord(candidate) &&
        candidate.attemptRevision === review.attemptRevision,
    );
    if (!snapshot) return false;
    try {
      const canonicalReview = compileContextPackReview(
        instrument,
        snapshot as unknown as SharedContextPackSnapshot,
        review.move as ContextPackCoachingMove,
        review.cardId as ContextPackCardId | null,
        String(review.id),
        String(review.at),
      );
      if (
        canonicalReview.message !== review.message ||
        canonicalReview.move !== review.move ||
        canonicalReview.cardId !== review.cardId
      ) {
        return false;
      }
    } catch {
      return false;
    }
    reviewIds.add(review.id);
    reviewedRevisions.add(Number(review.attemptRevision));
  }
  const latestReview = collaborationValue.reviews.at(-1);
  const latestSnapshot = collaborationValue.snapshots.at(-1);
  if (
    (collaborationValue.phase === "awaiting_review") !==
      (collaborationValue.consent === "granted") ||
    (collaborationValue.phase === "drafting" &&
      collaborationValue.consent !== "private") ||
    ((collaborationValue.phase === "revision_requested" ||
      collaborationValue.phase === "ready") &&
      collaborationValue.consent !== "consumed") ||
    (collaborationValue.phase === "ready" &&
      (!isRecord(latestReview) ||
        latestReview.move !== "confirm_ready" ||
        latestReview.attemptRevision !== collaborationValue.attemptRevision ||
        !isRecord(latestSnapshot) ||
        !Array.isArray(latestSnapshot.placements) ||
        !evaluateContextPack(
          instrument,
          latestSnapshot.placements as ContextPackPlacement[],
        ).isReady)) ||
    (collaborationValue.phase === "revision_requested" &&
      (!isRecord(latestReview) ||
        latestReview.move !== "reconsider_card" ||
        latestReview.attemptRevision !== collaborationValue.attemptRevision))
  ) {
    return false;
  }
  return true;
}

function isCapsule(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !isTimestamp(value.createdAt) ||
    (value.status !== "draft" &&
      value.status !== "active" &&
      value.status !== "completed") ||
    typeof value.focus !== "string" ||
    !signalIds.includes(value.focus as (typeof signalIds)[number]) ||
    !isNonEmptyString(value.eyebrow) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.learningObjective) ||
    !isNonEmptyString(value.principle) ||
    !isNonEmptyString(value.whyToday) ||
    !Number.isInteger(value.durationMinutes) ||
    Number(value.durationMinutes) < 1 ||
    !isNonEmptyString(value.personalizedScenario) ||
    !isNonEmptyString(value.challengePrompt) ||
    !isNonEmptyString(value.coachNote) ||
    !isPracticeContract(value.practiceContract) ||
    !isRecord(value.compiler)
  ) {
    return false;
  }
  const compiler = value.compiler;
  if (
    !isNonEmptyString(compiler.recipeId) ||
    !isNonEmptyString(compiler.recipeVersion) ||
    !isNonEmptyString(compiler.contextReceiptId) ||
    (compiler.difficulty !== "guided" && compiler.difficulty !== "stretch") ||
    (compiler.practiceMode !== "decision" &&
      compiler.practiceMode !== "rehearsal") ||
    (compiler.proofMode !== "next_action" &&
      compiler.proofMode !== "observed_habit")
  ) {
    return false;
  }
  if (!Array.isArray(value.choices) || value.choices.length < 2) return false;
  const choiceIds = new Set<string>();
  let correctChoices = 0;
  for (const choice of value.choices) {
    if (
      !isRecord(choice) ||
      !isNonEmptyString(choice.id) ||
      choiceIds.has(choice.id) ||
      !isNonEmptyString(choice.label) ||
      !isNonEmptyString(choice.shorthand) ||
      !isNonEmptyString(choice.description) ||
      !isNonEmptyString(choice.feedback) ||
      typeof choice.correct !== "boolean"
    ) {
      return false;
    }
    choiceIds.add(choice.id);
    if (choice.correct) correctChoices += 1;
  }
  if (
    correctChoices !== 1 ||
    (value.selectedChoiceId !== null &&
      (typeof value.selectedChoiceId !== "string" ||
        !choiceIds.has(value.selectedChoiceId)))
  ) {
    return false;
  }
  if (!Array.isArray(value.checkpoints) || value.checkpoints.length !== 3) {
    return false;
  }
  const checkpointIds = new Set<string>();
  for (const checkpoint of value.checkpoints) {
    if (
      !isRecord(checkpoint) ||
      (checkpoint.id !== "notice" &&
        checkpoint.id !== "choose" &&
        checkpoint.id !== "apply") ||
      checkpointIds.has(checkpoint.id) ||
      !isNonEmptyString(checkpoint.label) ||
      !isNonEmptyString(checkpoint.detail) ||
      (checkpoint.status !== "locked" &&
        checkpoint.status !== "current" &&
        checkpoint.status !== "done")
    ) {
      return false;
    }
    checkpointIds.add(checkpoint.id);
  }
  const modulesValid =
    value.learningModules === undefined ||
    (Array.isArray(value.learningModules) &&
      value.learningModules.length <= 2 &&
      value.learningModules.every(isLearningModule));
  if (!modulesValid) return false;
  if (value.focus === "thread_hygiene") {
    return isContextPackingCollaboration(
      value.practiceInstrument,
      value.collaboration,
    );
  }
  return value.practiceInstrument === undefined && value.collaboration === undefined;
}

function isJourneySync(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.status === "string" &&
    syncStatuses.has(value.status as LearningState["journeySync"]["status"]) &&
    (value.mode === null ||
      (typeof value.mode === "string" &&
        syncModes.has(
          value.mode as NonNullable<LearningState["journeySync"]["mode"]>,
        ))) &&
    Number.isInteger(value.pendingCount) &&
    Number(value.pendingCount) >= 0 &&
    typeof value.detail === "string" &&
    (value.lastSyncedAt === null || isTimestamp(value.lastSyncedAt))
  );
}

function hasValidEvents(
  value: unknown,
  sessionId: string,
  stateRevision: number,
): value is LearningEvent[] {
  if (!Array.isArray(value) || value.length < 1) return false;
  const ids = new Set<string>();
  let previousRevision = 0;
  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      !isNonEmptyString(candidate.id) ||
      ids.has(candidate.id) ||
      candidate.sessionId !== sessionId ||
      !Number.isInteger(candidate.revision) ||
      Number(candidate.revision) <= previousRevision ||
      Number(candidate.revision) > stateRevision ||
      typeof candidate.type !== "string" ||
      !eventTypes.has(candidate.type as LearningEvent["type"]) ||
      !isTimestamp(candidate.at) ||
      typeof candidate.actor !== "string" ||
      !eventActors.has(candidate.actor as LearningEvent["actor"]) ||
      !isNonEmptyString(candidate.summary) ||
      !isRecord(candidate.payload) ||
      candidate.payload.revision !== candidate.revision
    ) {
      return false;
    }
    ids.add(candidate.id);
    previousRevision = Number(candidate.revision);
  }
  return true;
}

function hasValidReceiptAndContext(
  receiptValue: unknown,
  contextValue: unknown,
  signalsValue: unknown,
  journeyValue: unknown,
): receiptValue is ContextReceipt {
  if (
    !isRecord(receiptValue) ||
    receiptValue.schemaVersion !== 1 ||
    !isNonEmptyString(receiptValue.receiptId) ||
    (receiptValue.environment !== "synthetic" &&
      receiptValue.environment !== "production") ||
    !isTimestamp(receiptValue.assembledAt) ||
    !isRecord(receiptValue.provenance) ||
    !isContext(receiptValue.ogramContext, true) ||
    !Array.isArray(receiptValue.practiceSignals) ||
    !Array.isArray(receiptValue.learningJourney) ||
    !isContext(contextValue, false) ||
    !Array.isArray(signalsValue) ||
    !Array.isArray(journeyValue)
  ) {
    return false;
  }
  try {
    cloneSignals(receiptValue.practiceSignals as PracticeSignal[]);
    cloneSignals(signalsValue as PracticeSignal[]);
    const receiptSnapshot = assembleContextReceipt({
      receiptId: receiptValue.receiptId,
      context: receiptValue.ogramContext as OgramInjectedContext,
      signals: receiptValue.practiceSignals as PracticeSignal[],
      journey: receiptValue.learningJourney as JourneyEntry[],
      provenance: receiptValue.provenance as unknown as ContextReceiptProvenance,
      assembledAt: receiptValue.assembledAt,
    });
    const currentSnapshot = assembleContextReceipt({
      receiptId: receiptValue.receiptId,
      context: contextValue as OgramInjectedContext,
      signals: signalsValue as PracticeSignal[],
      journey: journeyValue as JourneyEntry[],
      provenance: receiptValue.provenance as unknown as ContextReceiptProvenance,
      assembledAt: receiptValue.assembledAt,
    });
    return (
      receiptSnapshot.environment === receiptValue.environment &&
      JSON.stringify(receiptSnapshot.ogramContext) ===
        JSON.stringify(currentSnapshot.ogramContext)
    );
  } catch {
    return false;
  }
}

export function isUsableLearningState(state: unknown): state is LearningState {
  if (
    !isRecord(state) ||
    state.version !== 4 ||
    !isNonEmptyString(state.sessionId) ||
    state.sessionId.length < 8 ||
    !Number.isInteger(state.revision) ||
    Number(state.revision) < 1 ||
    !isCapsule(state.activeCapsule) ||
    !isJourneySync(state.journeySync) ||
    !hasValidEvents(state.events, state.sessionId, Number(state.revision)) ||
    !hasValidReceiptAndContext(
      state.contextReceipt,
      state.context,
      state.signals,
      state.journey,
    )
  ) {
    return false;
  }
  const capsule = state.activeCapsule as LearningState["activeCapsule"];
  const receipt = state.contextReceipt as unknown as ContextReceipt;
  return capsule.compiler.contextReceiptId === receipt.receiptId;
}

export function restoreLearningState(
  cached: unknown,
  dependencies: LearningSessionDependencies,
): LearningState {
  if (!isUsableLearningState(cached)) {
    return createInitialLearningState(dependencies);
  }
  const receipt = cached.contextReceipt;
  let normalized: LearningState = {
    ...cached,
    contextReceipt: assembleContextReceipt({
      receiptId: receipt.receiptId,
      context: receipt.ogramContext as OgramInjectedContext,
      signals: receipt.practiceSignals,
      journey: receipt.learningJourney,
      provenance: receipt.provenance,
      assembledAt: receipt.assembledAt,
    }),
  };
  const collaboration = normalized.activeCapsule.collaboration;
  if (collaboration) {
    const practiceInstrument = createContextPackingInstrument();
    normalized = {
      ...normalized,
      activeCapsule: {
        ...normalized.activeCapsule,
        practiceInstrument,
        collaboration: {
          ...collaboration,
          reviews: collaboration.reviews.map((review) => {
            const snapshot = collaboration.snapshots.find(
              (candidate) =>
                candidate.attemptRevision === review.attemptRevision,
            )!;
            const canonical = compileContextPackReview(
              practiceInstrument,
              snapshot,
              review.move,
              review.cardId,
              review.id,
              review.at,
            );
            return { ...review, message: canonical.message };
          }),
        },
      },
    };
  }
  if (normalized.activeCapsule.collaboration?.consent === "granted") {
    normalized = {
      ...normalized,
      activeCapsule: {
        ...normalized.activeCapsule,
        collaboration: {
          ...normalized.activeCapsule.collaboration,
          consent: "private",
          phase: "drafting",
        },
      },
    };
  }
  if (normalized.journeySync.status !== "syncing") return normalized;
  return {
    ...normalized,
    journeySync: {
      ...normalized.journeySync,
      status: "queued",
      detail: "A cached delivery was interrupted and is ready to retry.",
    },
  };
}

export function resetLearningSession(
  current: LearningState,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ sessionId: string }> {
  const state = createInitialLearningState(dependencies, current.revision);
  return {
    state,
    result: { revision: state.revision, sessionId: state.sessionId },
  };
}

export function retryJourneySyncTransition(
  current: LearningState,
): LearningTransition<Record<string, never>> {
  return advance(current, () => ({
    state: {
      ...current,
      journeySync: {
        ...current.journeySync,
        status: "queued",
        detail: "A manual retry of the durable learning outbox was requested.",
      },
    },
    result: {},
  }));
}

export function submitSignalsTransition(
  current: LearningState,
  submittedSignals: PracticeSignal[],
  dependencies: LearningSessionDependencies,
): LearningTransition<{ eventId: string }> {
  return advance(current, (revision) => {
    const signals = cloneSignals(submittedSignals);
    const now = validNow(dependencies);
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "coaching_signals_submitted",
      "codex",
      `${signals.length} reviewed practice signal${signals.length === 1 ? "" : "s"} committed without raw task content.`,
      {
        signalCount: signals.length,
        reviewedTaskCount: Math.max(
          ...signals.map((signal) => signal.sourceTaskCount),
        ),
        rawTaskContentShared: false,
      },
      now,
    );
    return {
      state: {
        ...current,
        signals,
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { eventId: event.id },
    };
  });
}

export function publishCapsuleTransition(
  current: LearningState,
  input: CapsuleDraftInput,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ capsuleId: string; eventId: string }> {
  if (
    current.activeCapsule.status === "active" &&
    (current.activeCapsule.collaboration?.attemptRevision ?? 0) > 0
  ) {
    throw new Error(
      "The learner has started this shared practice. Finish or reset it before publishing another capsule.",
    );
  }
  return advance(current, (revision) => {
    const now = validNow(dependencies);
    const signals = cloneSignals(current.signals);
    const contextReceipt = createContextReceipt(
      dependencies,
      current.sessionId,
      revision,
      current.context,
      signals,
      current.journey,
      now,
    );
    const capsule = createCapsule(
      { ...input, contextReceiptId: contextReceipt.receiptId },
      current.context,
      signals,
      now,
      dependencies.makeId("capsule"),
    );
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "capsule_published",
      "codex",
      `Published “${capsule.title}” as today’s lesson.`,
      {
        capsuleId: capsule.id,
        contextReceiptId: contextReceipt.receiptId,
        focus: capsule.focus,
        compiler: capsule.compiler,
      },
      now,
    );
    const journey = current.journey
      .map((entry): JourneyEntry =>
        entry.status === "today" ? { ...entry, status: "queued" } : entry,
      )
      .concat({
        id: dependencies.makeId("journey"),
        capsuleId: capsule.id,
        dateLabel: "Today",
        title: capsule.title,
        focus: capsule.focus,
        status: "today",
        proofStatus: "awaiting",
      });
    return {
      state: {
        ...current,
        contextReceipt,
        signals,
        activeCapsule: capsule,
        journey,
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { capsuleId: capsule.id, eventId: event.id },
    };
  });
}

export function addLearningModuleTransition(
  current: LearningState,
  capsuleId: string,
  moduleInput: LearningModuleInput,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ moduleId: string; eventId: string }> {
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    if (capsule.id !== capsuleId) {
      throw new Error("That capsule is no longer active.");
    }
    if (capsule.status !== "active") {
      throw new Error("Optional modules can only be added to an active capsule.");
    }
    if ((capsule.learningModules ?? []).length >= 2) {
      throw new Error("A daily lesson can contain at most two optional modules.");
    }
    const now = validNow(dependencies);
    const validatedModule = validateLearningModuleInput(moduleInput);
    const moduleId = dependencies.makeId("module");
    const module = cloneLearningModule(validatedModule, moduleId);
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "learning_module_added",
      "codex",
      `Added an optional ${module.kind.replace("_", " ")} to today’s lesson.`,
      { capsuleId, moduleId, moduleKind: module.kind },
      now,
    );
    return {
      state: {
        ...current,
        activeCapsule: {
          ...capsule,
          learningModules: [...(capsule.learningModules ?? []), module],
        },
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { moduleId, eventId: event.id },
    };
  });
}

export function sharePracticeAttemptTransition(
  current: LearningState,
  capsuleId: string,
  placements: ContextPackPlacement[],
  dependencies: LearningSessionDependencies,
): LearningTransition<{ attemptRevision: number; eventId: string }> {
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    const instrument = capsule.practiceInstrument;
    const collaboration = capsule.collaboration;
    if (capsule.id !== capsuleId) {
      throw new Error("That capsule is no longer active.");
    }
    if (capsule.status !== "active" || !instrument || !collaboration) {
      throw new Error("This capsule does not have an active shared instrument.");
    }
    if (collaboration.phase === "awaiting_review") {
      throw new Error("Codex already has one shared revision to review.");
    }
    if (collaboration.phase === "ready") {
      throw new Error("This context pack is already ready to carry forward.");
    }
    if (collaboration.reviews.at(-1)?.resolution === "pending") {
      throw new Error("Accept or dismiss the current coaching note before sharing again.");
    }
    if (collaboration.attemptRevision >= 12) {
      throw new Error("This practice supports at most 12 shared revisions.");
    }
    const normalized = normalizeContextPackPlacements(instrument, placements);
    const now = validNow(dependencies);
    const attemptRevision = collaboration.attemptRevision + 1;
    const snapshot = {
      attemptRevision,
      sharedAt: now.toISOString(),
      placements: normalized,
    };
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "practice_attempt_shared",
      "learner",
      `Shared context-pack revision r${attemptRevision} for one bounded Codex review.`,
      {
        capsuleId,
        attemptRevision,
        cardCount: normalized.length,
        availableForAgentReview: true,
        consentGranted: true,
        rawTaskContentShared: false,
      },
      now,
    );
    return {
      state: {
        ...current,
        activeCapsule: {
          ...capsule,
          collaboration: {
            ...collaboration,
            phase: "awaiting_review",
            consent: "granted",
            attemptRevision,
            snapshots: [...collaboration.snapshots, snapshot],
          },
        },
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { attemptRevision, eventId: event.id },
    };
  });
}

export function withdrawPracticeConsentTransition(
  current: LearningState,
  capsuleId: string,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ attemptRevision: number; eventId: string }> {
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    const collaboration = capsule.collaboration;
    if (capsule.id !== capsuleId || !collaboration) {
      throw new Error("That shared instrument is no longer active.");
    }
    if (
      collaboration.phase !== "awaiting_review" ||
      collaboration.consent !== "granted"
    ) {
      throw new Error("There is no active Codex review permission to withdraw.");
    }
    const now = validNow(dependencies);
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "practice_consent_withdrawn",
      "learner",
      `Withdrew Codex access to context-pack revision r${collaboration.attemptRevision}.`,
      {
        capsuleId,
        attemptRevision: collaboration.attemptRevision,
        accessRevoked: true,
      },
      now,
    );
    return {
      state: {
        ...current,
        activeCapsule: {
          ...capsule,
          collaboration: {
            ...collaboration,
            phase: "drafting",
            consent: "private",
          },
        },
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: {
        attemptRevision: collaboration.attemptRevision,
        eventId: event.id,
      },
    };
  });
}

export function recordPracticeCoachingTransition(
  current: LearningState,
  capsuleId: string,
  attemptRevision: number,
  move: ContextPackCoachingMove,
  cardId: ContextPackCardId | null,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ reviewId: string; eventId: string; ready: boolean }> {
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    const instrument = capsule.practiceInstrument;
    const collaboration = capsule.collaboration;
    if (capsule.id !== capsuleId || !instrument || !collaboration) {
      throw new Error("That shared instrument is no longer active.");
    }
    if (
      collaboration.phase !== "awaiting_review" ||
      collaboration.consent !== "granted"
    ) {
      throw new Error(
        "The learner has not granted access to a current practice revision.",
      );
    }
    if (
      !Number.isInteger(attemptRevision) ||
      attemptRevision !== collaboration.attemptRevision
    ) {
      throw new Error(
        `Practice revision r${attemptRevision} is stale. Inspect the newly shared revision.`,
      );
    }
    if (
      collaboration.reviews.some(
        (review) => review.attemptRevision === attemptRevision,
      )
    ) {
      throw new Error("Codex has already coached this practice revision.");
    }
    const snapshot = collaboration.snapshots.find(
      (candidate) => candidate.attemptRevision === attemptRevision,
    );
    if (!snapshot) throw new Error("The shared practice snapshot is unavailable.");
    const now = validNow(dependencies);
    const reviewId = dependencies.makeId("review");
    const review = compileContextPackReview(
      instrument,
      snapshot,
      move,
      cardId,
      reviewId,
      now.toISOString(),
    );
    const ready = review.move === "confirm_ready";
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "practice_coaching_recorded",
      "codex",
      ready
        ? `Confirmed context-pack revision r${attemptRevision} as ready.`
        : `Added one bounded coaching marker to context-pack revision r${attemptRevision}.`,
      {
        capsuleId,
        attemptRevision,
        move: review.move,
        cardId: review.cardId,
        ready,
      },
      now,
    );
    return {
      state: {
        ...current,
        activeCapsule: {
          ...capsule,
          collaboration: {
            ...collaboration,
            phase: ready ? "ready" : "revision_requested",
            consent: "consumed",
            reviews: [...collaboration.reviews, review],
          },
          checkpoints: ready
            ? capsule.checkpoints.map((checkpoint) => ({
                ...checkpoint,
                status:
                  checkpoint.id === "apply"
                    ? "current"
                    : checkpoint.id === "notice" || checkpoint.id === "choose"
                      ? "done"
                      : checkpoint.status,
              }))
            : capsule.checkpoints,
        },
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { reviewId, eventId: event.id, ready },
    };
  });
}

export function resolvePracticeReviewTransition(
  current: LearningState,
  capsuleId: string,
  reviewId: string,
  resolution: Exclude<ContextPackReviewResolution, "pending">,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ reviewId: string; eventId: string }> {
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    const collaboration = capsule.collaboration;
    if (capsule.id !== capsuleId || !collaboration) {
      throw new Error("That shared instrument is no longer active.");
    }
    if (resolution !== "accepted" && resolution !== "dismissed") {
      throw new Error("A coaching note can only be accepted or dismissed.");
    }
    const latestReview = collaboration.reviews.at(-1);
    if (
      !latestReview ||
      latestReview.id !== reviewId ||
      latestReview.move !== "reconsider_card" ||
      latestReview.resolution !== "pending"
    ) {
      throw new Error("That coaching note is no longer awaiting a learner decision.");
    }
    const now = validNow(dependencies);
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "practice_review_resolved",
      "learner",
      `${resolution === "accepted" ? "Accepted" : "Dismissed"} the bounded coaching move on context-pack revision r${latestReview.attemptRevision}.`,
      {
        capsuleId,
        attemptRevision: latestReview.attemptRevision,
        reviewId,
        resolution,
      },
      now,
    );
    return {
      state: {
        ...current,
        activeCapsule: {
          ...capsule,
          collaboration: {
            ...collaboration,
            reviews: collaboration.reviews.map((review) =>
              review.id === reviewId ? { ...review, resolution } : review,
            ),
          },
        },
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { reviewId, eventId: event.id },
    };
  });
}

export function recordChoiceTransition(
  current: LearningState,
  capsuleId: string,
  choiceId: string,
  dependencies: LearningSessionDependencies,
): LearningTransition<{
  correct: boolean;
  feedback: string;
  eventId: string;
}> {
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    if (capsule.id !== capsuleId) {
      throw new Error("That capsule is no longer active.");
    }
    if (capsule.status !== "active") {
      throw new Error("That capsule has already been completed.");
    }
    const choice = capsule.choices.find(
      (candidate) => candidate.id === choiceId,
    );
    if (!choice) throw new Error("Unknown scenario choice.");
    const now = validNow(dependencies);
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "choice_recorded",
      "learner",
      `Scenario response recorded: ${choice.label}.`,
      { capsuleId, choiceId, correct: choice.correct },
      now,
    );
    return {
      state: {
        ...current,
        activeCapsule: {
          ...capsule,
          selectedChoiceId: choiceId,
          checkpoints: capsule.checkpoints.map((checkpoint) => ({
            ...checkpoint,
            status:
              checkpoint.id === "apply"
                ? "current"
                : checkpoint.id === "notice" || checkpoint.id === "choose"
                  ? "done"
                  : checkpoint.status,
          })),
        },
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: {
        correct: choice.correct,
        feedback: choice.feedback,
        eventId: event.id,
      },
    };
  });
}

export function completeCapsuleTransition(
  current: LearningState,
  capsuleId: string,
  editedContract: PracticeContract | undefined,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ completedAt: string; eventId: string }> {
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    if (capsule.id !== capsuleId) {
      throw new Error("That capsule is no longer active.");
    }
    if (capsule.status !== "active") {
      throw new Error("That capsule has already been completed.");
    }
    if (capsule.practiceInstrument) {
      if (capsule.collaboration?.phase !== "ready") {
        throw new Error(
          "Complete the shared practice and receive a ready confirmation before finishing.",
        );
      }
    } else {
      const selectedChoice = capsule.choices.find(
        (choice) => choice.id === capsule.selectedChoiceId,
      );
      if (!selectedChoice?.correct) {
        throw new Error(
          "Choose the recommended answer before finishing the lesson.",
        );
      }
    }
    const practiceContract = completedContract(
      editedContract,
      capsule.practiceContract,
    );
    const now = validNow(dependencies);
    const completedAt = now.toISOString();
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "training_completed",
      "learner",
      `Completed “${capsule.title}” and confirmed a real-work practice contract.`,
      {
        capsuleId,
        contextReceiptId: capsule.compiler.contextReceiptId,
        proof: practiceContract.proof,
        proofMode: capsule.compiler.proofMode,
      },
      now,
    );
    return {
      state: {
        ...current,
        activeCapsule: {
          ...capsule,
          status: "completed",
          practiceContract,
          checkpoints: capsule.checkpoints.map((checkpoint) => ({
            ...checkpoint,
            status: "done",
          })),
        },
        journey: current.journey.map((entry) =>
          entry.capsuleId === capsuleId
            ? {
                ...entry,
                status: "completed",
                proof: practiceContract.proof,
                proofStatus: "awaiting",
                completedAt,
              }
            : entry,
        ),
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { completedAt, eventId: event.id },
    };
  });
}

export function queueDesktopFollowUpTransition(
  current: LearningState,
  capsuleId: string,
  reason: string,
  dependencies: LearningSessionDependencies,
): LearningTransition<{ eventId: string }> {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 8 || normalizedReason.length > 180) {
    throw new Error("reason must contain 8–180 characters.");
  }
  return advance(current, (revision) => {
    const capsule = current.activeCapsule;
    if (capsule.id !== capsuleId) {
      throw new Error("That capsule is no longer active.");
    }
    if (capsule.status !== "completed") {
      throw new Error("Finish the lesson before scheduling a follow-up.");
    }
    if (
      current.events.some(
        (event) =>
          event.type === "desktop_follow_up_queued" &&
          event.payload?.capsuleId === capsuleId,
      )
    ) {
      throw new Error("A follow-up is already queued for this capsule.");
    }
    const now = validNow(dependencies);
    const event = createEvent(
      dependencies,
      current.sessionId,
      revision,
      "desktop_follow_up_queued",
      "learner",
      "The learner asked Ogram to bring this practice back at the next matching moment.",
      {
        capsuleId,
        contextReceiptId: capsule.compiler.contextReceiptId,
        cue: capsule.practiceContract.cue,
        response: capsule.practiceContract.response,
        proof: capsule.practiceContract.proof,
        reason: normalizedReason,
      },
      now,
    );
    return {
      state: {
        ...current,
        events: [...current.events, event],
        journeySync: queuedSync(current.journeySync),
      },
      result: { eventId: event.id },
    };
  });
}
