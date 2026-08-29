import type { OgramInjectedContext, PracticeSignal } from "./types";

export const mockOgramContext: OgramInjectedContext = {
  sourceLabel: "ogram-injected-context",
  synthetic: true,
  learner: {
    displayName: "Léa Martin",
    role: "Client success & operations lead",
    organisation: "Atelier North — mock account",
    locale: "French-speaking Switzerland",
  },
  roleGoals: [
    "Turn workshop notes into crisp client follow-ups",
    "Prepare delivery plans without losing source context",
    "Review bilingual documents quickly and reliably",
  ],
  workshopNotes: [
    "Prefers one concrete habit over a long catalogue of tips",
    "Often moves from strategy into production inside the same Codex task",
    "Needs client context to remain private and attributable",
  ],
  preferences: [
    "Short sessions under 10 minutes",
    "Real work scenarios, not generic quizzes",
    "A visible definition of done",
  ],
  privacyBoundary:
    "Only behavioural summaries may leave Codex. Never send raw task text, source files, client names, or conversation transcripts.",
  requiredTraining: {
    id: "required-safe-client-context",
    title: "Handling client context safely",
    dueLabel: "Due Friday",
    status: "assigned",
  },
};

export const mockPracticeSignals: PracticeSignal[] = [
  {
    id: "thread_hygiene",
    label: "Thread hygiene",
    level: "priority",
    confidence: 0.94,
    evidence:
      "Across 6 of 8 synthetic recent tasks, strategy and execution stayed in one long thread after the goal changed.",
    recommendation:
      "Practice choosing between continue, fork, and fresh before the next phase begins.",
    sourceTaskCount: 8,
  },
  {
    id: "effort_fit",
    label: "Reasoning fit",
    level: "practice",
    confidence: 0.86,
    evidence:
      "A short copy review used an expensive reasoning setting, while one multi-file task began underpowered.",
    recommendation:
      "Name the task shape first, then choose the smallest model and reasoning level that can do it well.",
    sourceTaskCount: 5,
  },
  {
    id: "workspace_hygiene",
    label: "Workspace hygiene",
    level: "watch",
    confidence: 0.78,
    evidence:
      "Two synthetic tasks started outside a saved project, leaving generated files without a clear home.",
    recommendation:
      "Create or select a dedicated project folder before asking Codex to make files.",
    sourceTaskCount: 4,
  },
];
