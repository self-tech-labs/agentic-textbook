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

export interface PracticeSignal {
  id: SignalId;
  label: string;
  level: SignalLevel;
  confidence: number;
  evidence: string;
  recommendation: string;
  sourceTaskCount: number;
}

export interface OgramInjectedContext {
  sourceLabel: "ogram-injected-context";
  synthetic: true;
  learner: {
    displayName: string;
    role: string;
    organisation: string;
    locale: string;
  };
  roleGoals: string[];
  workshopNotes: string[];
  preferences: string[];
  privacyBoundary: string;
  requiredTraining: {
    id: string;
    title: string;
    dueLabel: string;
    status: "assigned" | "completed";
  } | null;
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
  practiceContract: {
    cue: string;
    response: string;
    proof: string;
  };
  coachNote: string;
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
  type: LearningEventType;
  at: string;
  actor: "codex" | "learner" | "ogram";
  summary: string;
  payload?: Record<string, unknown>;
}

export interface JourneyEntry {
  id: string;
  dateLabel: string;
  title: string;
  focus: SignalId;
  status: "completed" | "today" | "queued";
  proof?: string;
}

export interface LearningState {
  version: 2;
  context: OgramInjectedContext;
  signals: PracticeSignal[];
  activeCapsule: LearningCapsule;
  journey: JourneyEntry[];
  events: LearningEvent[];
  desktopBridge: {
    status: "ready" | "queued" | "synced";
    detail: string;
  };
}

export interface CapsuleDraftInput {
  focus: SignalId;
  personalizedScenario: string;
  coachNote: string;
  sourceTaskCount: number;
}
