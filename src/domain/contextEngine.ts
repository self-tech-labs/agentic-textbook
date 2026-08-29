import { signalIds } from "./types";
import type {
  ContextEnvironment,
  ContextReceipt,
  ContextReceiptProvenance,
  ContextSource,
  ContextSourceKind,
  JourneyEntry,
  OgramContextSnapshot,
  OgramInjectedContext,
  PracticeSignal,
  SignalId,
} from "./types";

export interface AssembleContextReceiptInput {
  receiptId: string;
  context: OgramInjectedContext;
  signals: readonly PracticeSignal[];
  journey: readonly JourneyEntry[];
  provenance: ContextReceiptProvenance;
  assembledAt?: Date | string;
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
const allowedContextKeys = new Set([
  "sourceLabel",
  "environment",
  "synthetic",
  "learner",
  "roleGoals",
  "workshopNotes",
  "preferences",
  "privacyBoundary",
  "requiredTraining",
]);
const allowedLearnerKeys = new Set([
  "displayName",
  "role",
  "organisation",
  "locale",
]);
const allowedTrainingKeys = new Set([
  "id",
  "title",
  "dueLabel",
  "status",
]);
const allowedJourneyKeys = new Set([
  "id",
  "capsuleId",
  "dateLabel",
  "title",
  "focus",
  "status",
  "proof",
  "proofStatus",
  "completedAt",
]);

function exactObjectKeys(
  value: object,
  allowed: ReadonlySet<string>,
  field: string,
): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `${field} contains unsupported fields: ${unexpected.join(", ")}.`,
    );
  }
}

function opaqueId(value: string, field: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length < 8 ||
    trimmed.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(trimmed)
  ) {
    throw new Error(
      `${field} must be an opaque 8–160 character identifier without spaces.`,
    );
  }
  return trimmed;
}

function version(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new Error(`${field} must contain a 1–80 character version.`);
  }
  return trimmed;
}

function timestamp(value: Date | string, field: string): string {
  const candidate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error(`${field} must be a valid date-time.`);
  }
  if (
    typeof value === "string" &&
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim())
  ) {
    throw new Error(`${field} must include an explicit time-zone offset.`);
  }
  return candidate.toISOString();
}

function boundedText(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    throw new Error(
      `${field} must contain ${minimum}–${maximum} characters.`,
    );
  }
  return value;
}

function cloneStringList(
  values: unknown,
  field: string,
  maximumItems: number,
  maximumItemLength: number,
): string[] {
  if (!Array.isArray(values) || values.length > maximumItems) {
    throw new Error(`${field} must contain at most ${maximumItems} items.`);
  }
  return values.map((value, index) =>
    boundedText(value, `${field}[${index}]`, 1, maximumItemLength),
  );
}

export function resolveContextEnvironment(
  context: OgramInjectedContext,
): ContextEnvironment {
  const environment = context.environment ??
    (context.synthetic === true ? "synthetic" : undefined);
  if (environment !== "synthetic" && environment !== "production") {
    throw new Error("context.environment must be synthetic or production.");
  }
  if (environment === "production" && context.synthetic !== undefined) {
    throw new Error("Production context cannot carry the synthetic fixture flag.");
  }
  return environment;
}

function snapshotContext(
  context: OgramInjectedContext,
  environment: ContextEnvironment,
): OgramContextSnapshot {
  exactObjectKeys(context, allowedContextKeys, "context");
  if (context.sourceLabel !== "ogram-injected-context") {
    throw new Error(
      "context.sourceLabel must be ogram-injected-context.",
    );
  }
  if (!context.learner || typeof context.learner !== "object") {
    throw new Error("context.learner must be an object.");
  }
  exactObjectKeys(context.learner, allowedLearnerKeys, "context.learner");
  if (context.requiredTraining) {
    exactObjectKeys(
      context.requiredTraining,
      allowedTrainingKeys,
      "context.requiredTraining",
    );
    if (
      context.requiredTraining.status !== "assigned" &&
      context.requiredTraining.status !== "completed"
    ) {
      throw new Error(
        "context.requiredTraining.status must be assigned or completed.",
      );
    }
  }
  return {
    sourceLabel: context.sourceLabel,
    environment,
    learner: {
      displayName: boundedText(
        context.learner.displayName,
        "learner.displayName",
        1,
        100,
      ),
      role: boundedText(context.learner.role, "learner.role", 1, 160),
      organisation: boundedText(
        context.learner.organisation,
        "learner.organisation",
        1,
        160,
      ),
      locale: boundedText(context.learner.locale, "learner.locale", 1, 80),
    },
    roleGoals: cloneStringList(context.roleGoals, "roleGoals", 8, 180),
    workshopNotes: cloneStringList(
      context.workshopNotes,
      "workshopNotes",
      12,
      240,
    ),
    preferences: cloneStringList(context.preferences, "preferences", 12, 180),
    privacyBoundary: boundedText(
      context.privacyBoundary,
      "privacyBoundary",
      1,
      500,
    ),
    requiredTraining: context.requiredTraining
      ? {
          id: opaqueId(context.requiredTraining.id, "requiredTraining.id"),
          title: boundedText(
            context.requiredTraining.title,
            "requiredTraining.title",
            1,
            160,
          ),
          dueLabel: boundedText(
            context.requiredTraining.dueLabel,
            "requiredTraining.dueLabel",
            1,
            80,
          ),
          status: context.requiredTraining.status,
        }
      : null,
  };
}

function cloneSource(
  source: ContextSource,
  expectedKind: ContextSourceKind,
  environment: ContextEnvironment,
  field: string,
): ContextSource {
  if (source.kind !== expectedKind) {
    throw new Error(`${field}.kind must be ${expectedKind}.`);
  }
  if (source.environment !== environment) {
    throw new Error(
      `${field}.environment must match the context environment (${environment}).`,
    );
  }
  return {
    provenanceId: opaqueId(source.provenanceId, `${field}.provenanceId`),
    kind: source.kind,
    environment: source.environment,
    version: version(source.version, `${field}.version`),
    capturedAt: timestamp(source.capturedAt, `${field}.capturedAt`),
  };
}

function cloneSignal(signal: PracticeSignal, index: number): PracticeSignal {
  const field = `signals[${index}]`;
  const unexpectedKeys = Object.keys(signal).filter(
    (key) => !allowedSignalKeys.has(key),
  );
  if (unexpectedKeys.length > 0) {
    throw new Error(
      `${field} contains unsupported fields: ${unexpectedKeys.join(", ")}.`,
    );
  }
  if (!signalIds.includes(signal.id)) {
    throw new Error(`${field}.id must be a supported practice signal.`);
  }
  if (
    signal.level !== "watch" &&
    signal.level !== "practice" &&
    signal.level !== "priority"
  ) {
    throw new Error(`${field}.level is not supported.`);
  }
  if (
    !Number.isFinite(signal.confidence) ||
    signal.confidence < 0 ||
    signal.confidence > 1
  ) {
    throw new Error(`${field}.confidence must be between 0 and 1.`);
  }
  if (
    !Number.isInteger(signal.sourceTaskCount) ||
    signal.sourceTaskCount < 1 ||
    signal.sourceTaskCount > 8
  ) {
    throw new Error(`${field}.sourceTaskCount must be an integer from 1 to 8.`);
  }

  return {
    id: signal.id,
    label: boundedText(signal.label, `${field}.label`, 1, 80),
    level: signal.level,
    confidence: signal.confidence,
    evidence: boundedText(signal.evidence, `${field}.evidence`, 1, 300),
    recommendation: boundedText(
      signal.recommendation,
      `${field}.recommendation`,
      1,
      300,
    ),
    sourceTaskCount: signal.sourceTaskCount,
  };
}

function cloneSignals(signals: readonly PracticeSignal[]): PracticeSignal[] {
  if (signals.length < 1 || signals.length > 4) {
    throw new Error("signals must contain 1–4 sanitized observations.");
  }
  const seen = new Set<SignalId>();
  return signals.map((signal, index) => {
    const cloned = cloneSignal(signal, index);
    if (seen.has(cloned.id)) {
      throw new Error(`signals contains duplicate signal id ${cloned.id}.`);
    }
    seen.add(cloned.id);
    return cloned;
  });
}

function cloneJourney(journey: readonly JourneyEntry[]): JourneyEntry[] {
  if (!Array.isArray(journey) || journey.length > 100) {
    throw new Error("journey must contain at most 100 entries.");
  }
  const seen = new Set<string>();
  return journey.map((entry, index) => {
    const field = `journey[${index}]`;
    exactObjectKeys(entry, allowedJourneyKeys, field);
    const id = opaqueId(entry.id, `${field}.id`);
    if (seen.has(id)) throw new Error(`journey contains duplicate id ${id}.`);
    seen.add(id);
    if (!signalIds.includes(entry.focus)) {
      throw new Error(`${field}.focus must be a supported practice signal.`);
    }
    if (
      entry.status !== "completed" &&
      entry.status !== "today" &&
      entry.status !== "queued"
    ) {
      throw new Error(`${field}.status is not supported.`);
    }
    if (
      entry.proofStatus !== undefined &&
      entry.proofStatus !== "awaiting" &&
      entry.proofStatus !== "observed" &&
      entry.proofStatus !== "confirmed"
    ) {
      throw new Error(`${field}.proofStatus is not supported.`);
    }
    return {
      id,
      ...(entry.capsuleId
        ? { capsuleId: opaqueId(entry.capsuleId, `${field}.capsuleId`) }
        : {}),
      dateLabel: boundedText(entry.dateLabel, `${field}.dateLabel`, 1, 40),
      title: boundedText(entry.title, `${field}.title`, 1, 160),
      focus: entry.focus,
      status: entry.status,
      ...(entry.proof
        ? { proof: boundedText(entry.proof, `${field}.proof`, 8, 220) }
        : {}),
      ...(entry.proofStatus ? { proofStatus: entry.proofStatus } : {}),
      ...(entry.completedAt
        ? { completedAt: timestamp(entry.completedAt, `${field}.completedAt`) }
        : {}),
    };
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export function assembleContextReceipt(
  input: AssembleContextReceiptInput,
): ContextReceipt {
  const environment = resolveContextEnvironment(input.context);
  const assembledAt = timestamp(
    input.assembledAt ?? new Date(),
    "assembledAt",
  );
  const provenance: ContextReceiptProvenance = {
    ogramContext: cloneSource(
      input.provenance.ogramContext,
      "ogram_context",
      environment,
      "provenance.ogramContext",
    ) as ContextReceiptProvenance["ogramContext"],
    practiceSignals: cloneSource(
      input.provenance.practiceSignals,
      "codex_practice_signals",
      environment,
      "provenance.practiceSignals",
    ) as ContextReceiptProvenance["practiceSignals"],
    learningJourney: cloneSource(
      input.provenance.learningJourney,
      "ogram_learning_journey",
      environment,
      "provenance.learningJourney",
    ) as ContextReceiptProvenance["learningJourney"],
  };

  const provenanceIds = Object.values(provenance).map(
    (source) => source.provenanceId,
  );
  if (new Set(provenanceIds).size !== provenanceIds.length) {
    throw new Error("Every context source must have a unique provenanceId.");
  }

  return deepFreeze({
    schemaVersion: 1,
    receiptId: opaqueId(input.receiptId, "receiptId"),
    environment,
    assembledAt,
    provenance,
    ogramContext: snapshotContext(input.context, environment),
    practiceSignals: cloneSignals(input.signals),
    learningJourney: cloneJourney(input.journey),
  });
}
