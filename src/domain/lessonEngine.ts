import type {
  CapsuleChoice,
  CapsuleDifficulty,
  CapsuleDraftInput,
  LearningCapsule,
  LearningModuleInput,
  OgramInjectedContext,
  PracticeSignal,
  PracticeMode,
  ProofMode,
  SignalId,
} from "./types";

interface LessonRecipe {
  recipeId: string;
  recipeVersion: string;
  eyebrow: string;
  title: string;
  learningObjective: string;
  principle: string;
  challengePrompt: string;
  defaultScenario: string;
  choices: CapsuleChoice[];
  practiceContract: LearningCapsule["practiceContract"];
  observedHabitProof: string;
}

const recipeVersion = "1.0.0";

const recipes: Record<SignalId, LessonRecipe> = {
  thread_hygiene: {
    recipeId: "ogram.practice.thread_hygiene",
    recipeVersion,
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
    observedHabitProof:
      "A later Codex session shows the new deliverable starting in a fork with a concise handoff.",
  },
  workspace_hygiene: {
    recipeId: "ogram.practice.workspace_hygiene",
    recipeVersion,
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
    observedHabitProof:
      "A later file-creating task starts inside a named project instead of a broad folder.",
  },
  effort_fit: {
    recipeId: "ogram.practice.effort_fit",
    recipeVersion,
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
    observedHabitProof:
      "A later bounded task begins with a model and reasoning level proportionate to its complexity.",
  },
  task_shaping: {
    recipeId: "ogram.practice.task_shaping",
    recipeVersion,
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
    observedHabitProof:
      "A later Codex request includes an outcome, boundaries, and a way to check the result.",
  },
};

const levelRank: Record<PracticeSignal["level"], number> = {
  watch: 1,
  practice: 2,
  priority: 3,
};

const difficultyOptions = ["guided", "stretch"] as const;
const practiceModeOptions = ["decision", "rehearsal"] as const;
const proofModeOptions = ["next_action", "observed_habit"] as const;
const legacyContextReceiptId = "receipt-legacy-untracked";
const youtubeWatchUrlPattern =
  /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as UnknownRecord;
}

function exactKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  field: string,
): void {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new Error(`${field} contains unsupported fields: ${unexpected.join(", ")}.`);
  }
}

function boundedText(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }
  const length = value.trim().length;
  if (length < minimum || length > maximum) {
    throw new Error(`${field} must contain ${minimum}–${maximum} characters.`);
  }
  return value;
}

/**
 * Validates the fully materialized, Ogram-owned module shape. This boundary is
 * intentionally independent of WebMCP so internal callers cannot bypass the
 * same content and URL limits enforced for site tools.
 */
export function validateLearningModuleInput(
  input: LearningModuleInput,
): LearningModuleInput {
  const candidate = record(input, "module");
  const title = boundedText(candidate.title, 4, 80, "module.title");
  const description = boundedText(
    candidate.description,
    12,
    220,
    "module.description",
  );

  if (candidate.kind === "video") {
    exactKeys(candidate, ["kind", "title", "description", "url"], "module");
    if (
      typeof candidate.url !== "string" ||
      !youtubeWatchUrlPattern.test(candidate.url)
    ) {
      throw new Error(
        "module.url must be an exact HTTPS youtube.com watch URL with one 11-character video id.",
      );
    }
    return { kind: "video", title, description, url: candidate.url };
  }

  if (candidate.kind === "walkthrough") {
    exactKeys(
      candidate,
      ["kind", "title", "description", "steps"],
      "module",
    );
    if (
      !Array.isArray(candidate.steps) ||
      candidate.steps.length < 2 ||
      candidate.steps.length > 6
    ) {
      throw new Error("module.steps must contain 2–6 steps.");
    }
    const steps = candidate.steps.map((step, index) =>
      boundedText(step, 8, 180, `module.steps[${index}]`),
    );
    return { kind: "walkthrough", title, description, steps };
  }

  if (candidate.kind !== "mini_game") {
    throw new Error("module.kind must be video, walkthrough, or mini_game.");
  }

  exactKeys(
    candidate,
    ["kind", "title", "description", "prompt", "options"],
    "module",
  );
  const prompt = boundedText(candidate.prompt, 12, 240, "module.prompt");
  if (
    !Array.isArray(candidate.options) ||
    candidate.options.length < 2 ||
    candidate.options.length > 4
  ) {
    throw new Error("module.options must contain 2–4 choices.");
  }
  const optionIds = new Set<string>();
  let correctCount = 0;
  const options = candidate.options.map((option, index) => {
    const choice = record(option, `module.options[${index}]`);
    exactKeys(
      choice,
      ["id", "label", "feedback", "correct"],
      `module.options[${index}]`,
    );
    if (
      typeof choice.id !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(choice.id)
    ) {
      throw new Error(
        `module.options[${index}].id must be a 2–40 character opaque id.`,
      );
    }
    if (optionIds.has(choice.id)) {
      throw new Error(`module.options contains duplicate id ${choice.id}.`);
    }
    optionIds.add(choice.id);
    const label = boundedText(
      choice.label,
      4,
      120,
      `module.options[${index}].label`,
    );
    const feedback = boundedText(
      choice.feedback,
      12,
      240,
      `module.options[${index}].feedback`,
    );
    if (typeof choice.correct !== "boolean") {
      throw new Error(`module.options[${index}].correct must be boolean.`);
    }
    if (choice.correct) correctCount += 1;
    return { id: choice.id, label, feedback, correct: choice.correct };
  });
  if (correctCount !== 1) {
    throw new Error("module.options must contain exactly one correct choice.");
  }
  return { kind: "mini_game", title, description, prompt, options };
}

function boundedOption<T extends string>(
  value: T | undefined,
  options: readonly T[],
  fallback: T,
  field: string,
): T {
  const selected = value ?? fallback;
  if (!options.includes(selected)) {
    throw new Error(`${field} must be one of: ${options.join(", ")}.`);
  }
  return selected;
}

function contextReceiptId(value: string | undefined): string {
  const selected = value?.trim();
  if (!selected) return legacyContextReceiptId;
  if (
    selected.length < 8 ||
    selected.length > 160 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(selected)
  ) {
    throw new Error(
      "contextReceiptId must be an opaque 8–160 character identifier without spaces.",
    );
  }
  return selected;
}

function resolvedCapsuleId(value: string | undefined, now: Date): string {
  const selected = value ?? `capsule-${now.getTime()}`;
  if (
    selected.length < 8 ||
    selected.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(selected)
  ) {
    throw new Error(
      "capsuleId must be an opaque 8–120 character identifier without spaces.",
    );
  }
  return selected;
}

function reviewedTaskCount(
  requestedCount: number | undefined,
  focusSignal: PracticeSignal | undefined,
  signals: PracticeSignal[],
): number | null {
  if (requestedCount !== undefined) {
    if (
      !Number.isInteger(requestedCount) ||
      requestedCount < 1 ||
      requestedCount > 20
    ) {
      throw new Error("sourceTaskCount must be an integer from 1 to 20.");
    }
    return requestedCount;
  }
  if (focusSignal) return focusSignal.sourceTaskCount;
  const inferred = Math.max(0, ...signals.map((signal) => signal.sourceTaskCount));
  return inferred > 0 ? inferred : null;
}

function roleTailoring(context: OgramInjectedContext): string {
  const role = context.learner.role.trim() || "daily work";
  const goal = context.roleGoals.find((candidate) => candidate.trim())?.trim();
  return goal ? `${role} · ${goal}` : role;
}

function defaultCoachNote(
  context: OgramInjectedContext,
  practiceMode: PracticeMode,
): string {
  const instruction =
    practiceMode === "rehearsal"
      ? "Rehearse the response once, then use it in real work today."
      : "Try this once in real work today. That is enough to make the lesson useful.";
  const training = context.requiredTraining;
  if (!training) return instruction;
  const journeyCopy =
    training.status === "assigned"
      ? ` This also advances “${training.title}” in your learning journey.`
      : ` This reinforces “${training.title}”, already completed in your learning journey.`;
  return `${instruction}${journeyCopy}`;
}

function challengePrompt(
  recipe: LessonRecipe,
  difficulty: CapsuleDifficulty,
  practiceMode: PracticeMode,
): string {
  const modeCopy =
    practiceMode === "rehearsal"
      ? `Rehearse the move by choosing the response you want to make automatic. ${recipe.challengePrompt}`
      : recipe.challengePrompt;
  return difficulty === "stretch"
    ? `${modeCopy} Then name the boundary that rules out the alternatives.`
    : modeCopy;
}

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
  capsuleId?: string,
): LearningCapsule {
  const recipe = recipes[input.focus];
  const focusSignal = signals.find((signal) => signal.id === input.focus);
  const difficulty = boundedOption<CapsuleDifficulty>(
    input.difficulty,
    difficultyOptions,
    "guided",
    "difficulty",
  );
  const practiceMode = boundedOption<PracticeMode>(
    input.practiceMode,
    practiceModeOptions,
    "decision",
    "practiceMode",
  );
  const proofMode = boundedOption<ProofMode>(
    input.proofMode,
    proofModeOptions,
    "next_action",
    "proofMode",
  );
  const selectedReceiptId = contextReceiptId(input.contextReceiptId);
  const sourceTaskCount = reviewedTaskCount(
    input.sourceTaskCount,
    focusSignal,
    signals,
  );
  const scenario =
    input.personalizedScenario?.trim() || recipe.defaultScenario;
  const createdAt = now.toISOString();
  const taskFallback = sourceTaskCount
    ? `This practice was selected from ${sourceTaskCount} recent task summaries.`
    : "This practice was selected from the learner’s current role and learning journey.";
  const practiceContract = {
    ...recipe.practiceContract,
    proof:
      proofMode === "observed_habit"
        ? recipe.observedHabitProof
        : recipe.practiceContract.proof,
  };

  return {
    id: resolvedCapsuleId(capsuleId, now),
    createdAt,
    status: "active",
    focus: input.focus,
    eyebrow: recipe.eyebrow,
    title: recipe.title,
    learningObjective: recipe.learningObjective,
    principle: recipe.principle,
    whyToday: focusSignal?.evidence ?? taskFallback,
    durationMinutes: difficulty === "stretch" ? 7 : 5,
    personalizedScenario: `${scenario} · Tailored for ${roleTailoring(context)}.`,
    challengePrompt: challengePrompt(recipe, difficulty, practiceMode),
    choices: recipe.choices.map((choice) => ({ ...choice })),
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
        detail:
          practiceMode === "rehearsal"
            ? "Rehearse the response and inspect the consequence."
            : "Work the scenario and inspect the consequence.",
        status: "locked",
      },
      {
        id: "apply",
        label: "Apply",
        detail:
          proofMode === "observed_habit"
            ? "Carry the habit into work so a later signal can confirm it."
            : "Carry one observable habit into real work.",
        status: "locked",
      },
    ],
    practiceContract,
    coachNote:
      input.coachNote?.trim() || defaultCoachNote(context, practiceMode),
    compiler: {
      recipeId: recipe.recipeId,
      recipeVersion: recipe.recipeVersion,
      contextReceiptId: selectedReceiptId,
      difficulty,
      practiceMode,
      proofMode,
    },
    learningModules: [],
  };
}
