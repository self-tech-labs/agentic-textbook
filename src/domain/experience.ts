export const primitiveIds = [
  "orient.objective",
  "diagnose.prediction",
  "explain.concept",
  "model.worked_example",
  "practice.choice",
  "practice.sort",
  "consolidate.reflection",
  "transfer.commitment",
  "media.explainer",
] as const;

export type PrimitiveId = (typeof primitiveIds)[number];

export type LearningRole =
  | "activate"
  | "explain"
  | "model"
  | "practice"
  | "retrieve"
  | "assess"
  | "reflect"
  | "transfer";

export type ContextClaimSource =
  | "learner"
  | "codex_observation"
  | "ogram_profile"
  | "ogram_pixel"
  | "ogram_journey";

export type ContextClaimReview =
  | "pending"
  | "accepted"
  | "corrected"
  | "rejected";

export interface ContextClaim {
  id: string;
  kind:
    | "stated_goal"
    | "current_project"
    | "active_research"
    | "prior_knowledge"
    | "misconception"
    | "behaviour_pattern"
    | "business_constraint"
    | "preference"
    | "accessibility"
    | "journey_evidence";
  summary: string;
  source: ContextClaimSource;
  confidence?: number;
  sensitivity: "low" | "personal" | "restricted";
  evidenceRefs: string[];
  allowedPurposes: string[];
  observedAt: string;
  expiresAt?: string;
  review: ContextClaimReview;
}

export interface LearningBrief {
  id: string;
  version: number;
  desiredCapability: string;
  whyNow: string;
  transferContext: string;
  estimatedMinutes: number;
  locale: string;
  approvedClaimIds: string[];
  prohibitedUses: string[];
  createdAt: string;
}

export interface LearningObjective {
  id: string;
  statement: string;
  successCriteria: string[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  correct: boolean;
  feedback: string;
}

interface NodeBase {
  id: string;
  primitiveVersion: "1";
  learningRole: LearningRole;
  objectiveIds: string[];
}

export interface ObjectiveNode extends NodeBase {
  primitiveId: "orient.objective";
  props: {
    heading: string;
    body: string;
    successCriteria: string[];
    relevance: string;
  };
}

export interface PredictionNode extends NodeBase {
  primitiveId: "diagnose.prediction";
  props: {
    prompt: string;
    context?: string;
    options: ChoiceOption[];
    askConfidence: boolean;
  };
}

export interface ConceptNode extends NodeBase {
  primitiveId: "explain.concept";
  props: {
    title: string;
    body: string;
    keyPoint: string;
    sourceLabel?: string;
  };
}

export interface WorkedExampleNode extends NodeBase {
  primitiveId: "model.worked_example";
  props: {
    title: string;
    scenario: string;
    steps: Array<{ label: string; detail: string }>;
    takeaway: string;
  };
}

export interface ChoiceNode extends NodeBase {
  primitiveId: "practice.choice";
  props: {
    prompt: string;
    context?: string;
    options: ChoiceOption[];
    askConfidence?: boolean;
  };
}

export interface SortNode extends NodeBase {
  primitiveId: "practice.sort";
  props: {
    prompt: string;
    buckets: Array<{ id: string; label: string; description?: string }>;
    items: Array<{ id: string; label: string; correctBucketId: string }>;
    feedback: string;
  };
}

export interface ReflectionNode extends NodeBase {
  primitiveId: "consolidate.reflection";
  props: {
    prompt: string;
    sentenceStarter?: string;
    minimumCharacters: number;
    feedback: string;
  };
}

export interface TransferNode extends NodeBase {
  primitiveId: "transfer.commitment";
  props: {
    prompt: string;
    cue: string;
    proof: string;
    minimumCharacters: number;
  };
}

export interface MediaNode extends NodeBase {
  primitiveId: "media.explainer";
  props: {
    title: string;
    body?: string;
    assetId: string;
  };
}

export type LearningNode =
  | ObjectiveNode
  | PredictionNode
  | ConceptNode
  | WorkedExampleNode
  | ChoiceNode
  | SortNode
  | ReflectionNode
  | TransferNode
  | MediaNode;

export type EdgeCondition =
  | { op: "always" }
  | { op: "answer_equals"; nodeId: string; value: string }
  | { op: "response_correct"; nodeId: string; value: boolean };

export interface LearningEdge {
  id: string;
  from: string;
  to: string;
  condition: EdgeCondition;
}

export interface CompletionPolicy {
  requiredObjectiveIds: string[];
  requiredNodeIds: string[];
  minimumUnassistedAttempts: number;
  requireTransfer: boolean;
}

export interface AdaptationPolicy {
  mode: "learner_reviewed";
  maxRevisionsPerSession: number;
  preserveCompletedEvidence: boolean;
}

export interface AssetReference {
  id: string;
  kind: "image" | "audio" | "video";
  uri: string;
  alt: string;
  caption?: string;
  transcript?: string;
  digest: string;
  generatedBy?: string;
}

export interface ProvenanceReference {
  id: string;
  lane: "pedagogy" | "content" | "personalization" | "generation";
  label: string;
  sourceRef: string;
}

export interface LearningExperienceDocument {
  specVersion: "1.0";
  registryVersion: "ogram.learning.v1";
  pedagogyPolicyVersion: "2026.1";
  experienceId: string;
  draftRevision: number;
  contextSnapshotId: string;
  learningBriefId: string;
  metadata: {
    title: string;
    locale: string;
    estimatedMinutes: number;
    rationale: string;
    theme: "field-notes" | "decision-lab" | "systems-map";
  };
  objectives: LearningObjective[];
  nodes: LearningNode[];
  edges: LearningEdge[];
  entryNodeId: string;
  completion: CompletionPolicy;
  adaptation: AdaptationPolicy;
  assets: AssetReference[];
  provenance: ProvenanceReference[];
}

export type DiagnosticSeverity = "error" | "warning" | "recommendation";

export interface CompilerDiagnostic {
  ruleId: string;
  ruleVersion: "1";
  severity: DiagnosticSeverity;
  path: string;
  explanation: string;
  suggestedRepair: string;
  researchReferences: string[];
}

export interface RuntimeProgram {
  digest: string;
  compiledAt: string;
  document: LearningExperienceDocument;
}

export interface CompileResult {
  valid: boolean;
  digest: string;
  diagnostics: CompilerDiagnostic[];
  program?: RuntimeProgram;
}

export interface LearnerResponse {
  nodeId: string;
  value: unknown;
  correct?: boolean;
  confidence?: number;
  assisted: boolean;
  submittedAt: string;
}

export interface LearningRuntimeState {
  experienceId: string;
  experienceRevision: number;
  status: "ready" | "active" | "completed" | "paused" | "error";
  currentNodeId: string | null;
  visitedNodeIds: string[];
  responses: Record<string, LearnerResponse>;
  startedAt: string;
  completedAt?: string;
}

export type CanvasEventActor = "agent" | "learner" | "ogram";

export type CanvasEventType =
  | "context.snapshot.loaded"
  | "context.claim.proposed"
  | "context.claim.reviewed"
  | "design.draft.created"
  | "design.draft.patched"
  | "design.draft.validated"
  | "design.review.requested"
  | "design.review.approved"
  | "design.experience.published"
  | "design.asset.registered"
  | "runtime.started"
  | "runtime.node.entered"
  | "runtime.response.submitted"
  | "runtime.feedback.presented"
  | "runtime.completed"
  | "learner.feedback.submitted"
  | "adaptation.proposed";

export interface CanvasEvent {
  id: string;
  sequence: number;
  revision: number;
  idempotencyKey: string;
  type: CanvasEventType;
  actor: CanvasEventActor;
  at: string;
  summary: string;
  experienceId?: string;
  experienceRevision?: number;
  payload?: Record<string, unknown>;
}

export interface ConsentReceipt {
  id: string;
  type: "context_use" | "experience_publication" | "adaptive_revision";
  actor: "learner";
  at: string;
  subjectIds: string[];
  purpose: string;
  digest: string;
}

export type ExperiencePatchOperation =
  | {
      op: "replace_metadata";
      metadata: LearningExperienceDocument["metadata"];
    }
  | { op: "upsert_node"; node: LearningNode }
  | { op: "remove_node"; nodeId: string }
  | { op: "upsert_edge"; edge: LearningEdge }
  | { op: "remove_edge"; edgeId: string }
  | { op: "set_completion"; completion: CompletionPolicy };

export interface DesignState {
  status:
    | "published"
    | "drafting"
    | "validation_failed"
    | "awaiting_review"
    | "approved";
  draft: LearningExperienceDocument | null;
  validation: CompileResult | null;
  approvedDraftRevision: number | null;
  reviewRequestedAt?: string;
}

export interface CommandReceipt {
  key: string;
  result: Record<string, unknown>;
}

export interface LearningCanvasState {
  version: 2;
  revision: number;
  contextSnapshotId: string;
  contextClaims: ContextClaim[];
  learningBrief: LearningBrief;
  activeExperience: LearningExperienceDocument;
  publishedRevisions: LearningExperienceDocument[];
  design: DesignState;
  runtime: LearningRuntimeState;
  events: CanvasEvent[];
  consentReceipts: ConsentReceipt[];
  commandReceipts: CommandReceipt[];
  learnerFeedback: {
    level: "too_easy" | "right_level" | "too_hard";
    note?: string;
    submittedAt: string;
  } | null;
  sync: {
    status: "local" | "queued" | "synced";
    orderedOutbox: string[];
  };
}
