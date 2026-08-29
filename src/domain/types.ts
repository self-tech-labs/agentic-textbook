export const signalIds = [
  "thread_hygiene",
  "workspace_hygiene",
  "effort_fit",
  "task_shaping",
] as const;

export type SignalId = (typeof signalIds)[number];
export type SignalLevel = "watch" | "practice" | "priority";
export type CapsuleStatus = "draft" | "active" | "completed";
export type CheckpointStatus = "locked" | "current" | "done";
export type CapsuleDifficulty = "guided" | "stretch";
export type PracticeMode = "decision" | "rehearsal";
export type ProofMode = "next_action" | "observed_habit";

export interface PracticeSignal {
  id: SignalId;
  label: string;
  level: SignalLevel;
  confidence: number;
  evidence: string;
  recommendation: string;
  sourceTaskCount: number;
}

export type ContextEnvironment = "synthetic" | "production";

export const contextSourceKinds = [
  "ogram_context",
  "codex_practice_signals",
  "ogram_learning_journey",
] as const;

export type ContextSourceKind = (typeof contextSourceKinds)[number];

/**
 * Provenance for one immutable input to a learning-context receipt.
 * IDs are opaque references supplied by the system that captured the input;
 * they must never contain task titles, file paths, or learner content.
 */
export interface ContextSource {
  readonly provenanceId: string;
  readonly kind: ContextSourceKind;
  readonly environment: ContextEnvironment;
  readonly version: string;
  readonly capturedAt: string;
}

export interface OgramContextContent {
  readonly sourceLabel: "ogram-injected-context";
  readonly learner: {
    readonly displayName: string;
    readonly role: string;
    readonly organisation: string;
    readonly locale: string;
  };
  readonly roleGoals: readonly string[];
  readonly workshopNotes: readonly string[];
  readonly preferences: readonly string[];
  readonly privacyBoundary: string;
  readonly requiredTraining: {
    readonly id: string;
    readonly title: string;
    readonly dueLabel: string;
    readonly status: "assigned" | "completed";
  } | null;
}

/**
 * New context producers identify their source environment explicitly. The
 * final branch keeps `synthetic: true` as a compatibility seam for the
 * existing public fixture; receipt assembly normalizes it to `environment`.
 */
export type OgramInjectedContext = OgramContextContent &
  (
    | { readonly environment: "production"; readonly synthetic?: never }
    | { readonly environment: "synthetic"; readonly synthetic?: true }
    | { readonly environment?: never; readonly synthetic: true }
  );

export interface OgramContextSnapshot extends OgramContextContent {
  readonly environment: ContextEnvironment;
}

export interface CapsuleChoice {
  id: string;
  label: string;
  shorthand: string;
  description: string;
  feedback: string;
  correct: boolean;
}

export interface CapsuleCheckpoint {
  id: "notice" | "choose" | "apply";
  label: string;
  detail: string;
  status: CheckpointStatus;
}

interface LearningModuleBase {
  id: string;
  title: string;
  description: string;
}

export interface VideoLearningModule extends LearningModuleBase {
  kind: "video";
  provider: "YouTube";
  url: string;
}

export interface WalkthroughLearningModule extends LearningModuleBase {
  kind: "walkthrough";
  steps: string[];
}

export interface MiniGameOption {
  id: string;
  label: string;
  feedback: string;
  correct: boolean;
}

export interface MiniGameLearningModule extends LearningModuleBase {
  kind: "mini_game";
  prompt: string;
  options: MiniGameOption[];
}

export type LearningModule =
  | VideoLearningModule
  | WalkthroughLearningModule
  | MiniGameLearningModule;

export type LearningModuleInput =
  | Omit<VideoLearningModule, "id" | "provider">
  | Omit<WalkthroughLearningModule, "id">
  | Omit<MiniGameLearningModule, "id">;

export interface PracticeContract {
  cue: string;
  response: string;
  proof: string;
}

export interface CapsuleCompilerMetadata {
  recipeId: string;
  recipeVersion: string;
  contextReceiptId: string;
  difficulty: CapsuleDifficulty;
  practiceMode: PracticeMode;
  proofMode: ProofMode;
}

export interface LearningCapsule {
  id: string;
  createdAt: string;
  status: CapsuleStatus;
  focus: SignalId;
  eyebrow: string;
  title: string;
  learningObjective: string;
  principle: string;
  whyToday: string;
  durationMinutes: number;
  personalizedScenario: string;
  challengePrompt: string;
  choices: CapsuleChoice[];
  selectedChoiceId: string | null;
  checkpoints: CapsuleCheckpoint[];
  practiceContract: PracticeContract;
  coachNote: string;
  compiler: CapsuleCompilerMetadata;
  learningModules?: LearningModule[];
}

export type LearningEventType =
  | "context_loaded"
  | "coaching_signals_submitted"
  | "capsule_published"
  | "learning_module_added"
  | "choice_recorded"
  | "training_completed"
  | "desktop_follow_up_queued";

export interface LearningEvent {
  id: string;
  sessionId: string;
  revision: number;
  type: LearningEventType;
  at: string;
  actor: "codex" | "learner" | "ogram";
  summary: string;
  payload?: Record<string, unknown>;
}

export interface JourneyEntry {
  id: string;
  capsuleId?: string;
  dateLabel: string;
  title: string;
  focus: SignalId;
  status: "completed" | "today" | "queued";
  proof?: string;
  proofStatus?: "awaiting" | "observed" | "confirmed";
  completedAt?: string;
}

export interface ContextReceiptProvenance {
  readonly ogramContext: ContextSource & { readonly kind: "ogram_context" };
  readonly practiceSignals: ContextSource & {
    readonly kind: "codex_practice_signals";
  };
  readonly learningJourney: ContextSource & {
    readonly kind: "ogram_learning_journey";
  };
}

/**
 * A privacy-bounded, immutable snapshot of every input used to create a
 * learning capsule. The receipt carries sanitized observations and journey
 * projections only; raw Codex task content has no field in this contract.
 */
export interface ContextReceipt {
  readonly schemaVersion: 1;
  readonly receiptId: string;
  readonly environment: ContextEnvironment;
  readonly assembledAt: string;
  readonly provenance: ContextReceiptProvenance;
  readonly ogramContext: OgramContextSnapshot;
  readonly practiceSignals: readonly Readonly<PracticeSignal>[];
  readonly learningJourney: readonly Readonly<JourneyEntry>[];
}

export interface LearningState {
  version: 3;
  sessionId: string;
  revision: number;
  context: OgramInjectedContext;
  contextReceipt: ContextReceipt;
  signals: PracticeSignal[];
  activeCapsule: LearningCapsule;
  journey: JourneyEntry[];
  events: LearningEvent[];
  journeySync: {
    status: "idle" | "queued" | "syncing" | "synced" | "error";
    mode: "native-ipc" | "management-api" | "local-queue" | null;
    pendingCount: number;
    detail: string;
    lastSyncedAt: string | null;
  };
}

export interface CapsuleDraftInput {
  focus: SignalId;
  personalizedScenario?: string;
  coachNote?: string;
  sourceTaskCount?: number;
  difficulty?: CapsuleDifficulty;
  practiceMode?: PracticeMode;
  proofMode?: ProofMode;
  contextReceiptId?: string;
}
