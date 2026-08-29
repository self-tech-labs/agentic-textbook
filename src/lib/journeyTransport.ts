import type { LearningEvent } from "../domain/types";
import {
  assertValidLearningEventEnvelope,
  isValidLearningEventEnvelope,
} from "./learningEventContract";

export type JourneyDeliveryMode =
  | "native-ipc"
  | "management-api"
  | "local-queue";

export type JourneyDeliveryStatus = "pending" | "error" | "synced";

export interface LearningEventEnvelope {
  schemaVersion: 1;
  eventId: string;
  idempotencyKey: string;
  learningSessionId: string;
  occurredAt: string;
  type:
    | "learning.context.loaded"
    | "learning.signals.submitted"
    | "learning.capsule.published"
    | "learning.module.added"
    | "learning.practice_attempt.shared"
    | "learning.practice_consent.withdrawn"
    | "learning.practice_coaching.recorded"
    | "learning.practice_review.resolved"
    | "learning.choice.recorded"
    | "learning.training.completed"
    | "learning.desktop_follow_up.queued";
  actor: LearningEvent["actor"];
  capsuleId: string | null;
  data: Record<string, unknown>;
}

export interface LearningEventEnvelopeOptions {
  /**
   * Prefer a caller-owned session identifier when several pre-capsule events
   * belong to the same learning run. It is persisted with the envelope, so
   * every retry uses exactly the same value.
   */
  learningSessionId?: string;
}

export interface JourneyOutboxItem {
  envelope: LearningEventEnvelope;
  enqueuedAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
}

export interface JourneyOutboxSnapshot {
  items: JourneyOutboxItem[];
  deliveredEventIds: string[];
  deliveredThrough: Record<string, number>;
}

export interface JourneyEnqueueResult {
  enqueued: boolean;
  alreadyDelivered: boolean;
  item: JourneyOutboxItem | null;
  pendingCount: number;
}

export interface JourneyFlushResult {
  mode: JourneyDeliveryMode;
  attemptedMode?: Exclude<JourneyDeliveryMode, "local-queue">;
  status: JourneyDeliveryStatus;
  detail: string;
  deliveredEventIds: string[];
  pendingEventIds: string[];
  failedEventId?: string;
}

export interface DesktopPublishResult {
  mode: JourneyDeliveryMode;
  attemptedMode?: Exclude<JourneyDeliveryMode, "local-queue">;
  status: JourneyDeliveryStatus;
  detail: string;
  eventId: string;
  pendingCount: number;
}

interface StoredJourneyOutbox {
  version: 1;
  items: JourneyOutboxItem[];
  deliveredEventIds: string[];
  deliveredThrough: Record<string, number>;
}

interface DeliveryChannel {
  mode: Exclude<JourneyDeliveryMode, "local-queue">;
  send(envelope: LearningEventEnvelope): Promise<void>;
}

const eventTypeMap: Record<
  LearningEvent["type"],
  LearningEventEnvelope["type"]
> = {
  context_loaded: "learning.context.loaded",
  coaching_signals_submitted: "learning.signals.submitted",
  capsule_published: "learning.capsule.published",
  learning_module_added: "learning.module.added",
  practice_attempt_shared: "learning.practice_attempt.shared",
  practice_consent_withdrawn: "learning.practice_consent.withdrawn",
  practice_coaching_recorded: "learning.practice_coaching.recorded",
  practice_review_resolved: "learning.practice_review.resolved",
  choice_recorded: "learning.choice.recorded",
  training_completed: "learning.training.completed",
  desktop_follow_up_queued: "learning.desktop_follow_up.queued",
};

export const JOURNEY_OUTBOX_STORAGE_KEY = "ogram-learning-outbox:v1";

const maxDeliveryReceipts = 500;
const deliveryTimeoutMs = 10_000;
let flushTail: Promise<void> = Promise.resolve();

async function withDeliveryTimeout<T>(
  operation: Promise<T>,
  channelLabel: string,
): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`${channelLabel} timed out after 10 seconds.`)),
      deliveryTimeoutMs,
    );
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

function emptyOutbox(): StoredJourneyOutbox {
  return {
    version: 1,
    items: [],
    deliveredEventIds: [],
    deliveredThrough: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLearningEventEnvelope(value: unknown): value is LearningEventEnvelope {
  return isValidLearningEventEnvelope(value);
}

function isOutboxItem(value: unknown): value is JourneyOutboxItem {
  if (!isRecord(value)) return false;
  return (
    isLearningEventEnvelope(value.envelope) &&
    typeof value.enqueuedAt === "string" &&
    typeof value.attempts === "number" &&
    Number.isInteger(value.attempts) &&
    value.attempts >= 0 &&
    (typeof value.lastAttemptAt === "string" || value.lastAttemptAt === null) &&
    (typeof value.lastError === "string" || value.lastError === null)
  );
}

function browserStorage(): Storage {
  if (typeof window === "undefined") {
    throw new Error("The learning outbox requires a browser storage context.");
  }
  return window.localStorage;
}

function loadStoredOutbox(): StoredJourneyOutbox {
  const serialized = browserStorage().getItem(JOURNEY_OUTBOX_STORAGE_KEY);
  if (!serialized) return emptyOutbox();

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed) || parsed.version !== 1) return emptyOutbox();
    if (!Array.isArray(parsed.items) || !parsed.items.every(isOutboxItem)) {
      return emptyOutbox();
    }
    if (
      !Array.isArray(parsed.deliveredEventIds) ||
      !parsed.deliveredEventIds.every((id) => typeof id === "string")
    ) {
      return emptyOutbox();
    }

    const deliveredThrough = isRecord(parsed.deliveredThrough)
      ? Object.entries(parsed.deliveredThrough).reduce<Record<string, number>>(
          (valid, [sessionId, revision]) => {
            if (
              sessionId.length >= 8 &&
              sessionId.length <= 180 &&
              typeof revision === "number" &&
              Number.isInteger(revision) &&
              revision >= 1
            ) {
              valid[sessionId] = revision;
            }
            return valid;
          },
          {},
        )
      : {};

    return {
      version: 1,
      items: parsed.items,
      deliveredEventIds: [...new Set(parsed.deliveredEventIds)].slice(
        -maxDeliveryReceipts,
      ),
      deliveredThrough,
    };
  } catch {
    return emptyOutbox();
  }
}

function saveStoredOutbox(outbox: StoredJourneyOutbox): void {
  browserStorage().setItem(JOURNEY_OUTBOX_STORAGE_KEY, JSON.stringify(outbox));
}

function copyItem(item: JourneyOutboxItem): JourneyOutboxItem {
  return {
    ...item,
    envelope: {
      ...item.envelope,
      data: { ...item.envelope.data },
    },
  };
}

function stableIdentifier(prefix: string, source: string): string {
  const candidate = `${prefix}${source}`;
  if (candidate.length >= 8 && candidate.length <= 180) return candidate;

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}id-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function suppliedSessionId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error("learningSessionId must be a string.");
  }
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 180) {
    throw new Error("learningSessionId must contain 8–180 characters.");
  }
  return trimmed;
}

function resolveLearningSessionId(
  event: LearningEvent,
  capsuleId: string | null,
  options: LearningEventEnvelopeOptions,
): string {
  const fromOptions = suppliedSessionId(options.learningSessionId);
  if (fromOptions) return fromOptions;

  const fromEvent = suppliedSessionId(event.sessionId);
  if (fromEvent) return fromEvent;

  const fromPayload = suppliedSessionId(event.payload?.learningSessionId);
  if (fromPayload) return fromPayload;

  return capsuleId
    ? stableIdentifier("learn-", capsuleId)
    : stableIdentifier("learn-", event.id);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim().slice(0, 300) || "Unknown delivery error.";
}

function managementEndpoint(): string | null {
  const base = import.meta.env.VITE_OGRAM_MANAGEMENT_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/v1/learning/events`;
}

function deliveryChannel(): DeliveryChannel | null {
  if (window.ogramDesktop?.learning?.publishEvent) {
    return {
      mode: "native-ipc",
      async send(envelope) {
        await withDeliveryTimeout(
          window.ogramDesktop!.learning!.publishEvent(envelope),
          "Ogram desktop delivery",
        );
      },
    };
  }

  const endpoint = managementEndpoint();
  if (!endpoint) return null;

  return {
    mode: "management-api",
    async send(envelope) {
      const controller = new AbortController();
      const timer = window.setTimeout(
        () => controller.abort("Ogram management delivery timed out."),
        deliveryTimeoutMs,
      );
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(envelope),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
      if (!response.ok) {
        throw new Error(`Ogram management API returned ${response.status}.`);
      }
    },
  };
}

export function learningDeepLink(capsuleId: string): string {
  return `app.ogram://learn/capsule/${encodeURIComponent(capsuleId)}`;
}

export function toLearningEventEnvelope(
  event: LearningEvent,
  options: LearningEventEnvelopeOptions = {},
): LearningEventEnvelope {
  const payload = event.payload ?? {};
  const capsuleId =
    typeof payload.capsuleId === "string" ? payload.capsuleId : null;
  const {
    learningSessionId: _transportSessionId,
    capsuleId: _dataCapsuleId,
    revision: _payloadRevision,
    summary: _payloadSummary,
    ...eventData
  } = payload;

  const envelope: LearningEventEnvelope = {
    schemaVersion: 1,
    eventId: event.id,
    idempotencyKey: event.id,
    learningSessionId: resolveLearningSessionId(event, capsuleId, options),
    occurredAt: event.at,
    type: eventTypeMap[event.type],
    actor: event.actor,
    capsuleId,
    data: {
      ...eventData,
      summary: event.summary,
      revision: event.revision,
    },
  };
  assertValidLearningEventEnvelope(envelope);
  return envelope;
}

export function getJourneyOutbox(): JourneyOutboxSnapshot {
  const outbox = loadStoredOutbox();
  return {
    items: outbox.items.map(copyItem),
    deliveredEventIds: [...outbox.deliveredEventIds],
    deliveredThrough: { ...outbox.deliveredThrough },
  };
}

export function enqueueLearningEvent(
  event: LearningEvent,
  options: LearningEventEnvelopeOptions = {},
): JourneyEnqueueResult {
  const envelope = toLearningEventEnvelope(event, options);
  const outbox = loadStoredOutbox();
  const deliveredRevision =
    outbox.deliveredThrough[envelope.learningSessionId] ?? 0;
  const envelopeRevision = envelope.data.revision as number;

  if (
    outbox.deliveredEventIds.includes(envelope.eventId) ||
    envelopeRevision <= deliveredRevision
  ) {
    return {
      enqueued: false,
      alreadyDelivered: true,
      item: null,
      pendingCount: outbox.items.length,
    };
  }

  const existing = outbox.items.find(
    (item) => item.envelope.eventId === envelope.eventId,
  );
  if (existing) {
    if (JSON.stringify(existing.envelope) !== JSON.stringify(envelope)) {
      throw new Error(
        `Learning event ${envelope.eventId} is already queued with different content.`,
      );
    }
    return {
      enqueued: false,
      alreadyDelivered: false,
      item: copyItem(existing),
      pendingCount: outbox.items.length,
    };
  }

  const item: JourneyOutboxItem = {
    envelope,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
  };
  outbox.items.push(item);
  saveStoredOutbox(outbox);

  return {
    enqueued: true,
    alreadyDelivered: false,
    item: copyItem(item),
    pendingCount: outbox.items.length,
  };
}

async function flushStoredOutbox(): Promise<JourneyFlushResult> {
  let outbox: StoredJourneyOutbox;
  try {
    outbox = loadStoredOutbox();
  } catch (error) {
    return {
      mode: "local-queue",
      status: "error",
      detail: `The local learning outbox could not be read: ${errorMessage(error)}`,
      deliveredEventIds: [],
      pendingEventIds: [],
    };
  }

  const channel = deliveryChannel();
  if (!channel) {
    return {
      mode: "local-queue",
      status: outbox.items.length > 0 ? "pending" : "synced",
      detail:
        outbox.items.length > 0
          ? `${outbox.items.length} learning event${outbox.items.length === 1 ? " is" : "s are"} durably queued; no delivery channel is configured.`
          : "The local learning outbox is empty.",
      deliveredEventIds: [],
      pendingEventIds: outbox.items.map((item) => item.envelope.eventId),
    };
  }

  const deliveredEventIds: string[] = [];

  while (true) {
    try {
      outbox = loadStoredOutbox();
    } catch (error) {
      return {
        mode: "local-queue",
        attemptedMode: channel.mode,
        status: "error",
        detail: `The local learning outbox could not be read: ${errorMessage(error)}`,
        deliveredEventIds,
        pendingEventIds: [],
      };
    }

    const next = outbox.items[0];
    if (!next) {
      return {
        mode: channel.mode,
        status: "synced",
        detail:
          deliveredEventIds.length > 0
            ? `Synced ${deliveredEventIds.length} learning event${deliveredEventIds.length === 1 ? "" : "s"} through ${channel.mode}.`
            : "The learning outbox is already synced.",
        deliveredEventIds,
        pendingEventIds: [],
      };
    }

    next.attempts += 1;
    next.lastAttemptAt = new Date().toISOString();
    next.lastError = null;

    try {
      saveStoredOutbox(outbox);
    } catch (error) {
      return {
        mode: "local-queue",
        attemptedMode: channel.mode,
        status: "error",
        detail: `The next delivery attempt could not be persisted: ${errorMessage(error)}`,
        deliveredEventIds,
        pendingEventIds: outbox.items.map((item) => item.envelope.eventId),
        failedEventId: next.envelope.eventId,
      };
    }

    try {
      await channel.send(next.envelope);
    } catch (error) {
      const message = errorMessage(error);
      let pendingEventIds = outbox.items.map((item) => item.envelope.eventId);
      try {
        const latest = loadStoredOutbox();
        const failed = latest.items.find(
          (item) => item.envelope.eventId === next.envelope.eventId,
        );
        if (failed) failed.lastError = message;
        saveStoredOutbox(latest);
        pendingEventIds = latest.items.map((item) => item.envelope.eventId);
      } catch {
        // The delivery failure remains truthful even if storage became unavailable.
      }

      return {
        mode: "local-queue",
        attemptedMode: channel.mode,
        status: "error",
        detail: `Delivery through ${channel.mode} failed; the event remains queued for retry: ${message}`,
        deliveredEventIds,
        pendingEventIds,
        failedEventId: next.envelope.eventId,
      };
    }

    try {
      const latest = loadStoredOutbox();
      latest.items = latest.items.filter(
        (item) => item.envelope.eventId !== next.envelope.eventId,
      );
      latest.deliveredEventIds = [
        ...latest.deliveredEventIds.filter(
          (eventId) => eventId !== next.envelope.eventId,
        ),
        next.envelope.eventId,
      ].slice(-maxDeliveryReceipts);
      const deliveredRevision = next.envelope.data.revision as number;
      latest.deliveredThrough[next.envelope.learningSessionId] = Math.max(
        latest.deliveredThrough[next.envelope.learningSessionId] ?? 0,
        deliveredRevision,
      );
      saveStoredOutbox(latest);
      deliveredEventIds.push(next.envelope.eventId);
    } catch (error) {
      return {
        mode: "local-queue",
        attemptedMode: channel.mode,
        status: "error",
        detail: `Delivery was acknowledged but its local receipt could not be persisted; the idempotent event remains retryable: ${errorMessage(error)}`,
        deliveredEventIds,
        pendingEventIds: [next.envelope.eventId],
        failedEventId: next.envelope.eventId,
      };
    }
  }
}

export function flushLearningEventOutbox(): Promise<JourneyFlushResult> {
  const operation = flushTail.then(flushStoredOutbox, flushStoredOutbox);
  flushTail = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}

export const retryLearningEventOutbox = flushLearningEventOutbox;

export async function publishLearningEvent(
  event: LearningEvent,
  options: LearningEventEnvelopeOptions = {},
): Promise<DesktopPublishResult> {
  try {
    enqueueLearningEvent(event, options);
  } catch (error) {
    return {
      mode: "local-queue",
      status: "error",
      detail: `The learning event could not be added to the durable outbox: ${errorMessage(error)}`,
      eventId: event.id,
      pendingCount: 0,
    };
  }

  const result = await flushLearningEventOutbox();
  let snapshot: JourneyOutboxSnapshot;
  try {
    snapshot = getJourneyOutbox();
  } catch (error) {
    return {
      mode: "local-queue",
      attemptedMode: result.attemptedMode,
      status: "error",
      detail: `Delivery status could not be read from the durable outbox: ${errorMessage(error)}`,
      eventId: event.id,
      pendingCount: result.pendingEventIds.length,
    };
  }

  const envelope = toLearningEventEnvelope(event, options);
  const delivered =
    snapshot.deliveredEventIds.includes(event.id) ||
    (snapshot.deliveredThrough[envelope.learningSessionId] ?? 0) >=
      (envelope.data.revision as number);
  const failed = result.failedEventId === event.id;

  return {
    mode: delivered ? result.mode : "local-queue",
    attemptedMode: result.attemptedMode,
    status: delivered ? "synced" : failed ? "error" : "pending",
    detail: delivered
      ? `Learning event ${event.id} is synced through ${result.mode}.`
      : failed
        ? result.detail
        : `Learning event ${event.id} is durably queued behind ${snapshot.items.length} pending event${snapshot.items.length === 1 ? "" : "s"}.`,
    eventId: event.id,
    pendingCount: snapshot.items.length,
  };
}
