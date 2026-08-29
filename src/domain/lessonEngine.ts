import type {
  CapsuleChoice,
  CapsuleDraftInput,
  LearningCapsule,
  OgramInjectedContext,
  PracticeSignal,
  SignalId,
} from "./types";

interface LessonRecipe {
  eyebrow: string;
  title: string;
  principle: string;
  challengePrompt: string;
  defaultScenario: string;
  choices: CapsuleChoice[];
  practiceContract: LearningCapsule["practiceContract"];
}

const recipes: Record<SignalId, LessonRecipe> = {
  thread_hygiene: {
    eyebrow: "Practice 01 · The three doors",
    title: "Know when the task has changed",
    principle:
      "Continue for the same goal. Fork when the deliverable changes. Start fresh when the goal is unrelated.",
    challengePrompt:
      "The strategy is approved. The next task is a separate deliverable. Which door keeps the useful context without the debris?",
    defaultScenario:
      "After 38 turns shaping a workshop, the decisions are clear—but the thread still holds rejected agendas and dead ends. Now you need a polished follow-up page.",
    choices: [
      {
        id: "continue",
        label: "Continue here",
        shorthand: "Same room",
        description: "Keep every message and switch directly into production.",
        feedback:
          "Reasonable only when the goal and working mode are still unchanged. Here the task has crossed from strategy into a new deliverable.",
        correct: false,
      },
      {
        id: "fork",
        label: "Fork the task",
        shorthand: "Useful memory",
        description: "Carry the approved decisions into a clean execution branch.",
        feedback:
          "Exactly. A fork keeps the decisions worth inheriting while leaving exploration and rejected paths behind.",
        correct: true,
      },
      {
        id: "fresh",
        label: "Start fresh",
        shorthand: "Clean slate",
        description: "Open an unrelated task with no inherited context.",
        feedback:
          "A fresh task is best when the goal is unrelated or the old context is actively misleading. Here you would lose useful approved decisions.",
        correct: false,
      },
    ],
    practiceContract: {
      cue: "The noun describing the deliverable changes.",
      response: "Pause and choose: continue, fork, or fresh.",
      proof: "The next production task begins in a fork with a one-paragraph brief.",
    },
  },
  workspace_hygiene: {
    eyebrow: "Practice 02 · Give work a home",
    title: "Land before you build",
    principle:
      "A project folder is more than storage: it gives Codex boundaries, durable context, and a place where changes can be reviewed.",
    challengePrompt:
      "You are about to ask Codex for a small client-facing microsite. What should happen before the first file is generated?",
    defaultScenario:
      "A stakeholder asks for a quick prototype during a call. You have a blank Codex task open, but no project is selected and no folder has been created.",
    choices: [
      {
        id: "generate_first",
        label: "Generate, then organise",
        shorthand: "Fast start",
        description: "Ask for the files now and decide where they belong afterward.",
        feedback:
          "This often creates orphaned files and makes review harder. The thirty-second setup pays for itself almost immediately.",
        correct: false,
      },
      {
        id: "prepare_workspace",
        label: "Create a landing zone",
        shorthand: "Bounded work",
        description: "Choose a dedicated folder, state the goal, then let Codex inspect it.",
        feedback:
          "Exactly. The folder gives the task a boundary and makes every created artifact easy to find, review, and continue later.",
        correct: true,
      },
      {
        id: "use_desktop",
        label: "Save to Desktop",
        shorthand: "Visible pile",
        description: "Use a familiar broad folder so the output is easy to spot.",
        feedback:
          "Visibility is not structure. A dedicated project is safer and leaves a reusable working context.",
        correct: false,
      },
    ],
    practiceContract: {
      cue: "The task will create or edit files.",
      response: "Choose a dedicated project folder before prompting.",
      proof: "The next created artifact lives inside a named, reviewable project.",
    },
  },
  effort_fit: {
    eyebrow: "Practice 03 · Match the gear",
    title: "Spend reasoning where it changes the outcome",
    principle:
      "Task complexity—not importance or anxiety—should choose the reasoning gear. Escalate when dependencies, ambiguity, or verification demand it.",
    challengePrompt:
      "This is a contained rewrite with a clear source and definition of done. Which setup is proportionate?",
    defaultScenario:
      "You need a 250-word client email tightened for clarity. The facts are final, no tools are needed, and you will review the wording yourself.",
    choices: [
      {
        id: "sol_ultra",
        label: "Sol · Ultra",
        shorthand: "Maximum depth",
        description: "Use the strongest model at the deepest reasoning setting.",
        feedback:
          "That is more latency and reasoning than this bounded rewrite needs. Reserve it for genuinely difficult, interdependent work.",
        correct: false,
      },
      {
        id: "fast_lane",
        label: "Fast model · Low",
        shorthand: "Proportionate",
        description: "Use a fast model with light reasoning and a crisp brief.",
        feedback:
          "Right. The task is narrow, reversible, and easy to verify. A fast lane is the professional choice, not a compromise.",
        correct: true,
      },
      {
        id: "terra_high",
        label: "Terra · High",
        shorthand: "Extra analysis",
        description: "Add deeper reasoning in case the wording hides complexity.",
        feedback:
          "Safe, but still disproportionate. Start light; escalate only if ambiguity or quality problems actually appear.",
        correct: false,
      },
    ],
    practiceContract: {
      cue: "Before sending a task, name its ambiguity and verification cost.",
      response: "Choose the lightest gear that can reliably satisfy the definition of done.",
      proof: "The next bounded review begins on a fast, low-reasoning setup.",
    },
  },
  task_shaping: {
    eyebrow: "Practice 04 · Define the finish line",
    title: "Make done visible",
    principle:
      "A useful brief names the outcome, relevant context, boundaries, and a check. More words are not automatically more context.",
    challengePrompt:
      "Which prompt gives Codex the clearest finish line without prescribing every keystroke?",
    defaultScenario:
      "You need Codex to review a client proposal before it is sent. The document exists, but your first instinct is simply to write: ‘make this better.’",
    choices: [
      {
        id: "vague",
        label: "Make this better",
        shorthand: "Open-ended",
        description: "Let Codex decide what improvement means.",
        feedback:
          "Without a finish line, the result may be polished in ways that do not matter—or change things that should stay intact.",
        correct: false,
      },
      {
        id: "brief",
        label: "Outcome + boundaries + check",
        shorthand: "Shaped task",
        description: "Name the audience, decision, constraints, and how you will verify it.",
        feedback:
          "Exactly. This gives Codex enough judgment room while making success observable.",
        correct: true,
      },
      {
        id: "micromanage",
        label: "Specify every edit",
        shorthand: "Manual recipe",
        description: "Write a long sequence of exact sentence-level instructions.",
        feedback:
          "That can remove the useful judgment you hired the agent for. Specify the outcome and constraints, then let it propose the route.",
        correct: false,
      },
    ],
    practiceContract: {
      cue: "The first prompt contains an adjective such as ‘better’ or ‘professional.’",
      response: "Replace it with an observable outcome, boundaries, and a verification step.",
      proof: "The next task ends with an explicit definition of done.",
    },
  },
};

const levelRank: Record<PracticeSignal["level"], number> = {
  watch: 1,
  practice: 2,
  priority: 3,
};

export function chooseFocus(signals: PracticeSignal[]): SignalId {
  let best = signals[0];
  for (const signal of signals) {
    if (
      !best ||
      levelRank[signal.level] > levelRank[best.level] ||
      (signal.level === best.level && signal.confidence > best.confidence)
    ) {
      best = signal;
    }
  }
  return best?.id ?? "task_shaping";
}

export function createCapsule(
  input: CapsuleDraftInput,
  context: OgramInjectedContext,
  signals: PracticeSignal[],
  now = new Date(),
): LearningCapsule {
  const recipe = recipes[input.focus];
  const focusSignal = signals.find((signal) => signal.id === input.focus);
  const scenario = input.personalizedScenario.trim() || recipe.defaultScenario;
  const roleTailoring = `${context.learner.role} · ${context.roleGoals[0] ?? "daily work"}`;

  return {
    id: `capsule-${now.getTime()}`,
    createdAt: now.toISOString(),
    status: "active",
    focus: input.focus,
    eyebrow: recipe.eyebrow,
    title: recipe.title,
    principle: recipe.principle,
    whyToday:
      focusSignal?.evidence ??
      `This practice was selected from ${input.sourceTaskCount} recent task summaries.`,
    durationMinutes: 7,
    personalizedScenario: `${scenario} · Tailored for ${roleTailoring}.`,
    challengePrompt: recipe.challengePrompt,
    choices: recipe.choices,
    selectedChoiceId: null,
    checkpoints: [
      {
        id: "notice",
        label: "Notice",
        detail: "Read the signal and name the decision point.",
        status: "current",
      },
      {
        id: "choose",
        label: "Choose",
        detail: "Work the scenario and inspect the consequence.",
        status: "locked",
      },
      {
        id: "apply",
        label: "Apply",
        detail: "Carry one observable habit into real work.",
        status: "locked",
      },
    ],
    practiceContract: recipe.practiceContract,
    coachNote:
      input.coachNote.trim() ||
      "One deliberate choice in real work is worth more than ten generic tips.",
  };
}
