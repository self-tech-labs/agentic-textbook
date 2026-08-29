import type { LearningEvent } from "../domain/types";

export interface DesktopPublishResult {
  mode: "native-ipc" | "management-api" | "local-queue";
  detail: string;
  eventId: string;
}

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
    | "learning.choice.recorded"
    | "learning.training.completed"
    | "learning.desktop_follow_up.queued";
  actor: LearningEvent["actor"];
  capsuleId: string | null;
  data: Record<string, unknown>;
}

const eventTypeMap: Record<LearningEvent["type"], LearningEventEnvelope["type"]> = {
  context_loaded: "learning.context.loaded",
  coaching_signals_submitted: "learning.signals.submitted",
  capsule_published: "learning.capsule.published",
  choice_recorded: "learning.choice.recorded",
  training_completed: "learning.training.completed",
  desktop_follow_up_queued: "learning.desktop_follow_up.queued",
};

function managementEndpoint(): string | null {
  const base = import.meta.env.VITE_OGRAM_MANAGEMENT_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/v1/learning/events`;
}

export function learningDeepLink(capsuleId: string): string {
  return `app.ogram://learn/capsule/${encodeURIComponent(capsuleId)}`;
}

export function toLearningEventEnvelope(
  event: LearningEvent,
): LearningEventEnvelope {
  const payload = event.payload ?? {};
  const capsuleId =
    typeof payload.capsuleId === "string" ? payload.capsuleId : null;
  return {
    schemaVersion: 1,
    eventId: event.id,
    idempotencyKey: event.id,
    learningSessionId: capsuleId ? `learn-${capsuleId}` : `learn-${event.id}`,
    occurredAt: event.at,
    type: eventTypeMap[event.type],
    actor: event.actor,
    capsuleId,
    data: {
      summary: event.summary,
      ...payload,
    },
  };
}

export async function publishLearningEvent(
  event: LearningEvent,
): Promise<DesktopPublishResult> {
  const envelope = toLearningEventEnvelope(event);
  window.dispatchEvent(
    new CustomEvent("ogram:learning-event", { detail: envelope }),
  );

  if (window.ogramDesktop?.learning?.publishEvent) {
    const result = await window.ogramDesktop.learning.publishEvent(envelope);
    return {
      mode: "native-ipc",
      detail: "Synced through the Ogram desktop preload bridge.",
      eventId: result.eventId ?? event.id,
    };
  }

  const endpoint = managementEndpoint();
  if (endpoint) {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      throw new Error(`Ogram management API returned ${response.status}.`);
    }

    return {
      mode: "management-api",
      detail: "Synced to the shared Ogram learning journey.",
      eventId: event.id,
    };
  }

  return {
    mode: "local-queue",
    detail:
      "Queued locally in prototype mode. Configure VITE_OGRAM_MANAGEMENT_URL or the desktop preload bridge to sync.",
    eventId: event.id,
  };
}
