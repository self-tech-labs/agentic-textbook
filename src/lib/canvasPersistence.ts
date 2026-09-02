import type {
  AgentLearningCanvasState,
  CanvasRegion,
  ContextDiscoveryScope,
  ContextSource,
  LegacyLessonDocumentV3,
  LessonConstructionV4,
  LessonDocumentV4,
  LessonRegion,
} from "../domain/agentCanvas";
import {
  upgradeLessonDocumentV3,
  validateLessonDocument,
} from "../domain/agentCanvas";

export const canvasStorageKeyV4 = "learn-ogram-canvas:v4";
export const canvasStorageKeyV3 = "learn-ogram-canvas:v3";

function scopeForRoute(
  route: ContextSource["route"],
): ContextDiscoveryScope | null {
  if (route === "conversation") return "current_conversation";
  if (route === "codex_history") return "codex_history";
  if (route === "project_history") return "project_history";
  if (route === "ogram") return "ogram_profile";
  if (route === "connected_mcp") return "connected_sources";
  return null;
}

function lessonRegionFromCanvas(region: CanvasRegion): LessonRegion {
  const {
    revision: _revision,
    status: _status,
    response: _response,
    history: _history,
    updatedAt: _updatedAt,
    updateRationale: _updateRationale,
    ...lessonRegion
  } = region;
  return lessonRegion;
}

function isBaseState(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    Boolean(candidate.session) &&
    Boolean(candidate.lesson) &&
    Array.isArray(candidate.regions) &&
    Array.isArray(candidate.events)
  );
}

function withInferredConsent(state: AgentLearningCanvasState) {
  const existingConsent = state.session.contextConsent;
  const inferredScopes = Array.from(
    new Set(
      (state.contextClaims ?? [])
        .map((claim) => scopeForRoute(claim.source.route))
        .filter((scope): scope is ContextDiscoveryScope => Boolean(scope)),
    ),
  );
  return {
    ...state,
    session: {
      ...state.session,
      contextConsent: existingConsent
        ? {
            ...existingConsent,
            sourceScopes:
              existingConsent.sourceScopes?.length
                ? existingConsent.sourceScopes
                : inferredScopes.length
                  ? inferredScopes
                  : ["current_conversation"],
          }
        : null,
    },
    focus: {
      regionId: state.focus?.regionId ?? null,
      selectedText: null,
    },
  } satisfies AgentLearningCanvasState;
}

function normalizeV4(parsed: Record<string, unknown>): AgentLearningCanvasState | null {
  if (parsed.version !== 4 || !isBaseState(parsed)) return null;
  const state = parsed as unknown as AgentLearningCanvasState;
  return withInferredConsent({
    ...state,
    topicRadar: Array.isArray(state.topicRadar) ? state.topicRadar : [],
    session: {
      ...state.session,
      briefId: state.session.briefId ?? null,
      blueprintId: state.session.blueprintId ?? state.lesson.draft?.blueprintId ?? null,
      hostCapabilities: Array.isArray(state.session.hostCapabilities)
        ? state.session.hostCapabilities
        : [],
    },
    lesson: {
      ...state.lesson,
      construction: state.lesson.construction ?? null,
    },
  });
}

interface LegacyCanvasStateV3 {
  version: 3;
  revision: number;
  session: Omit<AgentLearningCanvasState["session"], "briefId" | "blueprintId" | "hostCapabilities">;
  contextClaims: AgentLearningCanvasState["contextClaims"];
  lesson: {
    status: AgentLearningCanvasState["lesson"]["status"];
    draft: LegacyLessonDocumentV3 | null;
    construction:
      | {
          document: Omit<LegacyLessonDocumentV3, "regions">;
          regions: CanvasRegion[];
          startedAt: string;
        }
      | null;
    validation: AgentLearningCanvasState["lesson"]["validation"];
    approvedDraftRevision: number | null;
    publishedRevision: number | null;
  };
  regions: CanvasRegion[];
  focus: AgentLearningCanvasState["focus"];
  events: AgentLearningCanvasState["events"];
  commandReceipts: AgentLearningCanvasState["commandReceipts"];
}

function migrateV3(parsed: Record<string, unknown>): AgentLearningCanvasState | null {
  if (parsed.version !== 3 || !isBaseState(parsed)) return null;
  const legacy = parsed as unknown as LegacyCanvasStateV3;
  const draft = legacy.lesson.draft
    ? upgradeLessonDocumentV3(legacy.lesson.draft, {
        blueprintId:
          /transformer/i.test(legacy.lesson.draft.topic)
            ? "transformer_technical_beginner"
            : "legacy_v3",
      })
    : null;

  let construction: LessonConstructionV4 | null = null;
  if (legacy.lesson.construction) {
    const fullLegacyDocument: LegacyLessonDocumentV3 = {
      ...legacy.lesson.construction.document,
      regions: legacy.lesson.construction.regions.map(lessonRegionFromCanvas),
    };
    const upgraded = upgradeLessonDocumentV3(fullLegacyDocument, {
      blueprintId: /transformer/i.test(fullLegacyDocument.topic)
        ? "transformer_technical_beginner"
        : "legacy_v3",
    });
    const { regions: _regions, ...document } = upgraded;
    construction = {
      document,
      regions: legacy.lesson.construction.regions,
      startedAt: legacy.lesson.construction.startedAt,
    };
  }

  const acceptedClaimIds = legacy.contextClaims
    .filter((claim) => claim.review === "accepted" || claim.review === "corrected")
    .map((claim) => claim.id);
  if (draft && !validateLessonDocument(draft, acceptedClaimIds).valid) {
    return null;
  }

  const migrated: AgentLearningCanvasState = {
    version: 4,
    revision: legacy.revision,
    session: {
      ...legacy.session,
      briefId: null,
      blueprintId: draft?.blueprintId ?? null,
      hostCapabilities: [],
    },
    contextClaims: legacy.contextClaims ?? [],
    topicRadar: [],
    lesson: {
      ...legacy.lesson,
      draft,
      construction,
      validation: draft
        ? validateLessonDocument(draft, acceptedClaimIds)
        : legacy.lesson.validation,
    },
    regions: legacy.regions,
    focus: legacy.focus ?? { regionId: null, selectedText: null },
    events: legacy.events,
    commandReceipts: legacy.commandReceipts ?? [],
    migratedFrom: 3,
  };

  const normalized = withInferredConsent(migrated);
  try {
    window.localStorage.setItem(canvasStorageKeyV4, JSON.stringify(normalized));
  } catch {
    // Migration remains available in memory if storage is unavailable.
  }
  return normalized;
}

export function loadCanvasState(): AgentLearningCanvasState | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(canvasStorageKeyV4);
    if (current) {
      const normalized = normalizeV4(JSON.parse(current));
      if (normalized) return normalized;
    }

    const legacy = window.localStorage.getItem(canvasStorageKeyV3);
    if (!legacy) return null;
    return migrateV3(JSON.parse(legacy));
  } catch {
    return null;
  }
}

export function saveCanvasState(state: AgentLearningCanvasState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(canvasStorageKeyV4, JSON.stringify(state));
  } catch {
    // The canvas remains usable when storage is unavailable.
  }
}

export function clearCanvasState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(canvasStorageKeyV4);
  window.localStorage.removeItem(canvasStorageKeyV3);
}
