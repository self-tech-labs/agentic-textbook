export type LearningSessionStage =
  | "ready"
  | "context_review"
  | "lesson_review"
  | "learning";

export type ContextClaimKind =
  | "stated_goal"
  | "prior_knowledge"
  | "current_project"
  | "preference"
  | "accessibility"
  | "business_constraint";

export type ContextDiscoveryScope =
  | "current_conversation"
  | "codex_history"
  | "project_history"
  | "ogram_profile"
  | "connected_sources";

export interface ContextSource {
  route:
    | "learner"
    | "conversation"
    | "codex_history"
    | "project_history"
    | "ogram"
    | "connected_mcp";
  providerId: string;
  providerLabel: string;
  resourceType: string;
}

export interface LearnerContextClaim {
  id: string;
  kind: ContextClaimKind;
  summary: string;
  source: ContextSource;
  confidence?: number;
  sensitivity: "low" | "personal" | "restricted";
  allowedPurposes: string[];
  evidenceRef: string;
  review: "pending" | "accepted" | "corrected" | "rejected";
  observedAt: string;
  correctedSummary?: string;
}

export interface ContextConsentAttestation {
  obtainedAt: string;
  scope: string;
  providerIds: string[];
  sourceScopes: ContextDiscoveryScope[];
}

export interface ResearchReference {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  claim: string;
}

export type RegionContent =
  | {
      type: "prose";
      heading?: string;
      text: string;
      emphasis?: string;
    }
  | {
      type: "key_points";
      items: string[];
    }
  | {
      type: "token_sequence";
      tokens: string[];
      caption: string;
      highlightedIndex?: number;
    }
  | {
      type: "attention_map";
      tokens: string[];
      focusIndex: number;
      weights: number[];
      explanation: string;
    }
  | {
      type: "transformer_stack";
      stages: Array<{ label: string; detail: string }>;
      caption: string;
    }
  | {
      type: "comparison";
      leftLabel: string;
      rightLabel: string;
      rows: Array<{ label: string; left: string; right: string }>;
    }
  | {
      type: "source_cards";
      summary: string;
      sources: ResearchReference[];
    }
  | {
      type: "sandbox_widget";
      widgetId: string;
      title: string;
      html: string;
      css: string;
      javascript: string;
      accessibleSummary: string;
      height: number;
    };

export interface ChoiceInteraction {
  type: "choice";
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    correct: boolean;
    feedback: string;
  }>;
}

export interface ReflectionInteraction {
  type: "reflection";
  prompt: string;
  placeholder: string;
  minimumCharacters: number;
  feedback: string;
}

export type LearnerInteraction = ChoiceInteraction | ReflectionInteraction;

export interface RegionResponse {
  value: string;
  correct?: boolean;
  submittedAt: string;
}

export interface RegionProvenance {
  actor: "ogram" | "agent";
  label: string;
  sourceRefs: string[];
  at: string;
}

export interface RegionHistoryEntry {
  undoToken: string;
  revision: number;
  status: CanvasRegionStatus;
  content: RegionContent[];
  provenance: RegionProvenance[];
  updatedAt?: string;
  updateRationale?: string;
}

export type CanvasRegionStatus =
  | "skeleton"
  | "ready"
  | "agent_working"
  | "updated";

export interface CanvasRegion {
  id: string;
  order: number;
  label: string;
  title: string;
  objective: string;
  kind: "orient" | "explain" | "model" | "practice" | "reflect";
  revision: number;
  status: CanvasRegionStatus;
  content: RegionContent[];
  interaction?: LearnerInteraction;
  response?: RegionResponse;
  provenance: RegionProvenance[];
  history: RegionHistoryEntry[];
  updatedAt?: string;
  updateRationale?: string;
}

export type LessonRegion = Omit<
  CanvasRegion,
  "revision" | "status" | "response" | "history" | "updatedAt" | "updateRationale"
>;

export interface LessonDocumentV3 {
  id: string;
  revision: number;
  topic: string;
  title: string;
  subtitle: string;
  audience: string;
  estimatedMinutes: number;
  objective: string;
  approvedClaimIds: string[];
  regions: LessonRegion[];
}

export interface LessonConstructionV3 {
  document: Omit<LessonDocumentV3, "regions">;
  regions: CanvasRegion[];
  startedAt: string;
}

export interface LessonDiagnostic {
  path: string;
  severity: "error" | "warning";
  explanation: string;
}

export interface LessonValidation {
  valid: boolean;
  digest: string;
  diagnostics: LessonDiagnostic[];
}

export interface AgentCanvasEvent {
  id: string;
  sequence: number;
  type:
    | "agent.session.started"
    | "context.claim.proposed"
    | "context.claim.reviewed"
    | "context.personalization.skipped"
    | "lesson.construction.started"
    | "lesson.construction.region_shaped"
    | "lesson.draft.prepared"
    | "lesson.draft.approved"
    | "lesson.published"
    | "canvas.region.focused"
    | "canvas.region.patched"
    | "canvas.widget.injected"
    | "canvas.research.attached"
    | "canvas.region.reverted"
    | "learner.response.submitted";
  actor: "agent" | "learner" | "ogram";
  at: string;
  summary: string;
  payload?: Record<string, unknown>;
}

export interface LearningSessionV3 {
  id: string | null;
  topic: string | null;
  goal: string | null;
  stage: LearningSessionStage;
  startedAt: string | null;
  contextConsent: ContextConsentAttestation | null;
  personalization: "undecided" | "reviewing" | "approved" | "skipped";
}

export interface CommandReceiptV3 {
  key: string;
  result: Record<string, unknown>;
}

export interface AgentLearningCanvasState {
  version: 3;
  revision: number;
  session: LearningSessionV3;
  contextClaims: LearnerContextClaim[];
  lesson: {
    status: "skeleton" | "awaiting_review" | "approved" | "published";
    draft: LessonDocumentV3 | null;
    construction: LessonConstructionV3 | null;
    validation: LessonValidation | null;
    approvedDraftRevision: number | null;
    publishedRevision: number | null;
  };
  regions: CanvasRegion[];
  focus: {
    regionId: string | null;
    selectedText: string | null;
  };
  events: AgentCanvasEvent[];
  commandReceipts: CommandReceiptV3[];
}

export type TrustedPatchContent = Exclude<RegionContent, { type: "sandbox_widget" }>;

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}

export function validateLessonDocument(
  document: LessonDocumentV3,
  acceptedClaimIds: string[],
): LessonValidation {
  const diagnostics: LessonDiagnostic[] = [];
  const ids = new Set<string>();

  if (document.title.trim().length < 6) {
    diagnostics.push({
      path: "title",
      severity: "error",
      explanation: "The lesson title must contain at least six characters.",
    });
  }
  if (document.objective.trim().length < 20) {
    diagnostics.push({
      path: "objective",
      severity: "error",
      explanation: "The lesson needs one observable learning objective.",
    });
  }
  if (document.regions.length < 4 || document.regions.length > 12) {
    diagnostics.push({
      path: "regions",
      severity: "error",
      explanation: "A lesson must contain four to twelve regions.",
    });
  }

  document.regions.forEach((region, index) => {
    if (ids.has(region.id)) {
      diagnostics.push({
        path: `regions[${index}].id`,
        severity: "error",
        explanation: "Region ids must be unique.",
      });
    }
    ids.add(region.id);
    if (!region.content.length) {
      diagnostics.push({
        path: `regions[${index}].content`,
        severity: "error",
        explanation: "Each region needs at least one accessible content block.",
      });
    }
  });

  const hasPractice = document.regions.some((region) => Boolean(region.interaction));
  if (!hasPractice) {
    diagnostics.push({
      path: "regions",
      severity: "error",
      explanation: "The lesson must include learner-owned practice or reflection.",
    });
  }

  for (const claimId of document.approvedClaimIds) {
    if (!acceptedClaimIds.includes(claimId)) {
      diagnostics.push({
        path: "approvedClaimIds",
        severity: "error",
        explanation: `Personalization claim ${claimId} has not been approved by the learner.`,
      });
    }
  }

  if (document.estimatedMinutes > 20) {
    diagnostics.push({
      path: "estimatedMinutes",
      severity: "warning",
      explanation: "The first prototype is designed for a focused session under twenty minutes.",
    });
  }

  return {
    valid: diagnostics.every((item) => item.severity !== "error"),
    digest: `lesson-${stableHash(JSON.stringify(document))}`,
    diagnostics,
  };
}
