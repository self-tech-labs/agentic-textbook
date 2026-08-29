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
  learningObjective: string;
  principle: string;
  challengePrompt: string;
  defaultScenario: string;
  choices: CapsuleChoice[];
  practiceContract: LearningCapsule["practiceContract"];
}

const recipes: Record<SignalId, LessonRecipe> = {
  thread_hygiene: {
    eyebrow: "Today’s lesson",
    title: "Know when to move to a new task",
    learningObjective:
      "Choose when to keep going, fork the task, or start fresh.",
    principle:
      "Keep going while the goal stays the same. Fork when a new deliverable needs the decisions you have already made. Start fresh when the new goal is unrelated.",
    challengePrompt:
      "The plan is approved. The next job is a separate deliverable. What would you do?",
    defaultScenario:
      "You have spent a long task shaping a workshop. The decisions are clear, but the conversation still contains rejected ideas and dead ends. Now you need to make a polished follow-up page.",
    choices: [
      {
        id: "continue",
        label: "Keep going here",
        shorthand: "Same task",
        description: "Stay in the current task and begin the page straight away.",
        feedback:
          "Keeping going works when the goal has not changed. Here, you are moving from planning to a new deliverable, so the old exploration will make the work harder to follow.",
        correct: false,
      },
      {
        id: "fork",
        label: "Fork the task",
        shorthand: "Keep what matters",
        description: "Carry the approved decisions into a clean new branch.",
        feedback:
          "A fork keeps the approved decisions while leaving rejected ideas behind. The new deliverable gets a clean place to grow.",
        correct: true,
      },
      {
        id: "fresh",
        label: "Start a fresh task",
        shorthand: "Clean slate",
        description: "Open a new task without bringing any context across.",
        feedback:
          "A fresh task is best for an unrelated goal. Here, you would lose the approved decisions that the next deliverable still needs.",
        correct: false,
      },
    ],
    practiceContract: {
      cue: "The deliverable changes, even though some earlier decisions still matter.",
      response: "Pause and choose: keep going, fork, or start fresh.",
      proof: "The next production task starts in a fork with a short handoff brief.",
    },
  },
  workspace_hygiene: {
    eyebrow: "Today’s lesson",
    title: "Give every piece of work a clear home",
    learningObjective:
      "Set up the right project folder before Codex creates or changes files.",
    principle:
      "A dedicated project folder tells Codex where the work belongs, what it may change, and where you can review the result later.",
    challengePrompt:
      "You are about to ask Codex for a small microsite. What should you do first?",
    defaultScenario:
      "Someone asks for a quick prototype during a call. You have a blank Codex task open, but no project is selected and no folder has been created.",
    choices: [
      {
        id: "generate_first",
        label: "Make the files, then organise them",
        shorthand: "Fast start",
        description: "Ask for the files now and decide where they belong afterward.",
        feedback:
          "This can leave files scattered or hard to continue later. A short setup now makes the work safer and easier to review.",
        correct: false,
      },
      {
        id: "prepare_workspace",
        label: "Create a project folder",
        shorthand: "Clear home",
        description: "Choose a dedicated folder, explain the goal, then let Codex inspect it.",
        feedback:
          "The folder gives the work a clear boundary. Everything Codex creates will be easier to find, review, and continue later.",
        correct: true,
      },
      {
        id: "use_desktop",
        label: "Save to Desktop",
        shorthand: "Visible pile",
        description: "Use a familiar broad folder so the output is easy to spot.",
        feedback:
          "The Desktop is easy to see, but it is not a useful project boundary. A dedicated folder keeps the work together and reusable.",
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
    eyebrow: "Today’s lesson",
    title: "Match the model to the work",
    learningObjective:
      "Choose a model and reasoning level that fit the task’s real complexity.",
    principle:
      "Choose more reasoning when the work is ambiguous, interconnected, or hard to verify—not simply because it feels important.",
    challengePrompt:
      "This is a short rewrite with a clear source and finish line. Which setup fits the work?",
    defaultScenario:
      "You need a 250-word email tightened for clarity. The facts are final, no tools are needed, and you will review the wording yourself.",
    choices: [
      {
        id: "sol_ultra",
        label: "Sol · Ultra",
        shorthand: "Maximum depth",
        description: "Use the strongest model at the deepest reasoning setting.",
        feedback:
          "This would make a simple rewrite slower without meaningfully improving the result. Save this setup for difficult, interconnected work.",
        correct: false,
      },
      {
        id: "fast_lane",
        label: "Fast model · Low reasoning",
        shorthand: "Good fit",
        description: "Use a fast model, light reasoning, and a clear brief.",
        feedback:
          "This task is narrow, easy to review, and easy to redo. A fast model with light reasoning is a good fit.",
        correct: true,
      },
      {
        id: "terra_high",
        label: "Terra · High",
        shorthand: "Extra analysis",
        description: "Add deeper reasoning in case the wording hides complexity.",
        feedback:
          "This would work, but it is more than the task needs. Start light and increase reasoning only if the work turns out to be ambiguous.",
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
    eyebrow: "Today’s lesson",
    title: "Give Codex a clear finish line",
    learningObjective:
      "Turn a vague request into a brief with an outcome, boundaries, and a check.",
    principle:
      "A useful brief explains the outcome, the context that matters, the boundaries, and how you will check the result.",
    challengePrompt:
      "Which request gives Codex the clearest finish line without telling it every tiny step?",
    defaultScenario:
      "You need Codex to review a proposal before it is sent. The document exists, but your first instinct is simply to write: ‘make this better.’",
    choices: [
      {
        id: "vague",
        label: "Make this better",
        shorthand: "Open-ended",
        description: "Let Codex decide what improvement means.",
        feedback:
          "Without a finish line, Codex may improve things that do not matter or change things that should stay as they are.",
        correct: false,
      },
      {
        id: "brief",
        label: "Name the outcome, boundaries, and check",
        shorthand: "Clear brief",
        description: "Explain the audience, the decision, what must stay fixed, and how you will review it.",
        feedback:
          "This leaves Codex room to make good decisions while making success easy for you to recognise.",
        correct: true,
      },
      {
        id: "micromanage",
        label: "Specify every edit",
        shorthand: "Manual recipe",
        description: "Write a long sequence of exact sentence-level instructions.",
        feedback:
          "This removes much of the useful judgment Codex can bring. Be precise about the result and constraints, then let it propose the route.",
        correct: false,
      },
    ],
    practiceContract: {
      cue: "My request relies on a word such as ‘better’ or ‘professional.’",
      response: "Replace it with an outcome, boundaries, and a way to check the result.",
      proof: "The next task begins with a clear definition of done.",
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
    learningObjective: recipe.learningObjective,
    principle: recipe.principle,
    whyToday:
      focusSignal?.evidence ??
      `This practice was selected from ${input.sourceTaskCount} recent task summaries.`,
    durationMinutes: 5,
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
      "Try this once in real work today. That is enough to make the lesson useful.",
    learningModules: [],
  };
}
