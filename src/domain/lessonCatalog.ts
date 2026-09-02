import type {
  CanvasRegion,
  PedagogicalMode,
} from "./agentCanvas";
import {
  BLUEPRINT_REGISTRY,
  LESSON_REGISTRY,
  type RegisteredBlueprintId,
} from "./lessonRegistry";

export type LessonLevel = "beginner" | "intermediate" | "advanced";
export type PreferredLearningMode =
  | "visual"
  | "quantitative"
  | "code"
  | "scenario"
  | "reading";

export interface LessonBriefV1 {
  schemaVersion: 1;
  id: string;
  topic: string;
  desiredOutcome: string;
  currentLevel: LessonLevel;
  availableMinutes: number;
  preferredModes: PreferredLearningMode[];
  accessibilityNotes: string;
  personalizeFromRecentTasks: boolean;
  starterId: string | null;
  blueprintId: RegisteredBlueprintId | "open_topic_v1";
  updatedAt: string;
}

export interface LessonStarter {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  topic: string;
  desiredOutcome: string;
  currentLevel: LessonLevel;
  availableMinutes: number;
  preferredModes: PreferredLearningMode[];
  blueprintId: RegisteredBlueprintId;
}

export const LESSON_STARTERS: LessonStarter[] = [
  {
    id: "starter-codex",
    eyebrow: "Personalized · current",
    title: "Build a better Codex workflow",
    description:
      "Start with the desktop workflow, then select current modules from your reviewed learning signals.",
    topic: "How to use the Codex app effectively",
    desiredOutcome:
      "Complete a real task in Codex using a clear brief, inspection, testing, and refinement loop.",
    currentLevel: "beginner",
    availableMinutes: 18,
    preferredModes: ["visual", "scenario", "code"],
    blueprintId: "codex_current_personalized_v1",
  },
  {
    id: "starter-algebra",
    eyebrow: "Quantitative · adaptive",
    title: "Algebra and functions",
    description:
      "Use formulas, a worked example, a tolerance-aware numeric check, and targeted remediation.",
    topic: "Linear functions and slope",
    desiredOutcome:
      "Calculate, interpret, and explain the slope of a linear function from two points.",
    currentLevel: "beginner",
    availableMinutes: 14,
    preferredModes: ["visual", "quantitative"],
    blueprintId: "algebra_functions_v1",
  },
  {
    id: "starter-code",
    eyebrow: "Executable · three languages",
    title: "Debug JavaScript, TypeScript, or Python",
    description:
      "Read a failing example, run a constrained code lab, and submit test-backed evidence.",
    topic: "Debugging small programs",
    desiredOutcome:
      "Find a defect, explain its cause, and produce a passing fix in the selected language.",
    currentLevel: "intermediate",
    availableMinutes: 18,
    preferredModes: ["code", "scenario"],
    blueprintId: "code_debugging_v1",
  },
];

function makeBriefId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return "brief-" + crypto.randomUUID();
  }
  return "brief-" + Date.now().toString(36);
}

export function createLessonBrief(
  overrides: Partial<LessonBriefV1> = {},
): LessonBriefV1 {
  return {
    schemaVersion: 1,
    id: makeBriefId(),
    topic: "",
    desiredOutcome: "",
    currentLevel: "beginner",
    availableMinutes: 15,
    preferredModes: ["visual"],
    accessibilityNotes: "",
    personalizeFromRecentTasks: true,
    starterId: null,
    blueprintId: "open_topic_v1",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function briefFromStarter(starter: LessonStarter): LessonBriefV1 {
  return createLessonBrief({
    topic: starter.topic,
    desiredOutcome: starter.desiredOutcome,
    currentLevel: starter.currentLevel,
    availableMinutes: starter.availableMinutes,
    preferredModes: starter.preferredModes,
    starterId: starter.id,
    blueprintId: starter.blueprintId,
  });
}

export function pedagogicalModeForBrief(
  brief: Pick<LessonBriefV1, "preferredModes"> &
    Partial<Pick<LessonBriefV1, "blueprintId">>,
): PedagogicalMode {
  const registeredBlueprint = brief.blueprintId
    ? BLUEPRINT_REGISTRY[
        brief.blueprintId as keyof typeof BLUEPRINT_REGISTRY
      ]
    : undefined;
  if (registeredBlueprint?.modes.length === 1) {
    return registeredBlueprint.modes[0] as PedagogicalMode;
  }
  const modes = brief.preferredModes;
  const pedagogicalPreferences = modes.filter(
    (mode) => mode === "quantitative" || mode === "code" || mode === "scenario",
  );
  if (pedagogicalPreferences.length > 1) return "mixed";
  if (modes.includes("quantitative")) return "quantitative";
  if (modes.includes("code")) return "code";
  if (modes.includes("scenario")) return "scenario";
  return "conceptual";
}

type SkeletonSpec = [
  id: string,
  label: string,
  title: string,
  objective: string,
  kind: CanvasRegion["kind"],
];

const skeletons: Record<PedagogicalMode, SkeletonSpec[]> = {
  conceptual: [
    ["orientation", "01 · orientation", "Frame the idea", "Set a useful finish line.", "orient"],
    ["model", "02 · mental model", "Build the core model", "Connect the key concepts.", "model"],
    ["practice", "03 · retrieval", "Explain and apply", "Create learner-owned evidence.", "reflect"],
  ],
  quantitative: [
    ["orientation", "01 · orientation", "Name the quantity", "Connect symbols to meaning.", "orient"],
    ["formula", "02 · formula", "Build the relationship", "Read and manipulate the formula.", "model"],
    ["worked-example", "03 · worked example", "Trace one solution", "Apply each operation deliberately.", "explain"],
    ["practice", "04 · numeric practice", "Calculate independently", "Submit a tolerance-aware answer.", "practice"],
    ["transfer", "05 · transfer", "Explain the result", "Connect the number back to the situation.", "reflect"],
  ],
  code: [
    ["orientation", "01 · orientation", "Define passing behavior", "Turn the outcome into an observable test.", "orient"],
    ["read-code", "02 · inspect", "Read the failing program", "Locate the behavior that needs attention.", "explain"],
    ["code-lab", "03 · execute", "Make the tests pass", "Produce test-backed code evidence.", "practice"],
    ["review", "04 · explain", "Explain the fix", "Connect the change to the root cause.", "reflect"],
  ],
  scenario: [
    ["brief", "01 · situation", "Enter the scenario", "Recognize the decision and constraints.", "orient"],
    ["decision", "02 · decision", "Choose a response", "Commit to a reasoned action.", "practice"],
    ["consequence", "03 · consequence", "Inspect the consequence", "Compare the result with the objective.", "model"],
    ["debrief", "04 · debrief", "Transfer the lesson", "State what you would do next time.", "reflect"],
  ],
  mixed: [
    ["orientation", "01 · orientation", "Set the destination", "Define a concrete learning outcome.", "orient"],
    ["model", "02 · model", "See the system", "Build a visual or conceptual map.", "model"],
    ["example", "03 · example", "Trace a real case", "Connect the model to action.", "explain"],
    ["practice", "04 · practice", "Try a bounded challenge", "Create learner-owned evidence.", "practice"],
    ["reflection", "05 · reflection", "Make it reusable", "State the next action in your own words.", "reflect"],
  ],
};

export function createSkeletonForBrief(
  topic: string,
  mode: PedagogicalMode,
): CanvasRegion[] {
  return skeletons[mode].map(([id, label, title, objective, kind], index) => ({
    id,
    order: index + 1,
    label,
    title: index === 0 && topic ? topic : title,
    objective,
    kind,
    revision: 0,
    status: "skeleton",
    content: [],
    provenance: [],
    history: [],
  }));
}

export function getLessonStarter(id: string | null | undefined) {
  return LESSON_STARTERS.find((starter) => starter.id === id) ?? null;
}

export function getBlueprint(id: string) {
  return BLUEPRINT_REGISTRY[id as RegisteredBlueprintId] ?? null;
}

export function getAuthoringCapabilities() {
  return LESSON_REGISTRY;
}
