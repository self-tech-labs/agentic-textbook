import { signalIds } from "../domain/types";
import type {
  CapsuleDraftInput,
  LearningModuleInput,
  LearningState,
  PracticeSignal,
  SignalId,
  SignalLevel,
} from "../domain/types";
import type { LearningActions } from "../hooks/useLearningStore";

type JsonSchema = Record<string, unknown>;

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute(input: unknown): unknown | Promise<unknown>;
}

export interface WebMcpRegistration {
  supported: boolean;
  toolCount: number;
  toolNames: string[];
  cleanup: () => void;
}

const signalLabels: Record<SignalId, string> = {
  thread_hygiene: "Thread hygiene",
  workspace_hygiene: "Workspace hygiene",
  effort_fit: "Reasoning fit",
  task_shaping: "Task shaping",
};

function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool input must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(
  object: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): string {
  const value = object[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new Error(`${key} must contain ${min}–${max} characters.`);
  }
  return trimmed;
}

function numberInRange(
  object: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number.`);
  }
  if (value < min || value > max) {
    throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  return value;
}

function focusId(value: unknown): SignalId {
  if (typeof value !== "string" || !signalIds.includes(value as SignalId)) {
    throw new Error("focus must be a supported practice signal id.");
  }
  return value as SignalId;
}

function stringList(
  value: unknown,
  key: string,
  minItems: number,
  maxItems: number,
  minLength: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) {
    throw new Error(`${key} must contain ${minItems}–${maxItems} items.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${key}[${index}] must be a string.`);
    }
    const trimmed = item.trim();
    if (trimmed.length < minLength || trimmed.length > maxLength) {
      throw new Error(
        `${key}[${index}] must contain ${minLength}–${maxLength} characters.`,
      );
    }
    return trimmed;
  });
}

function miniGameFromTemplate(
  template: unknown,
  title: string,
  description: string,
): LearningModuleInput {
  if (template === "context_packing") {
    return {
      kind: "mini_game",
      title,
      description,
      prompt: "You are forking an approved plan into a new production task. What should you bring across?",
      options: [
        {
          id: "everything",
          label: "The full conversation, including rejected ideas",
          feedback:
            "That brings the clutter with you. A fork is most useful when you carry only the decisions the next task needs.",
          correct: false,
        },
        {
          id: "decision_pack",
          label: "Approved decisions, constraints, and the definition of done",
          feedback:
            "That is the useful context pack: enough to work well, without carrying the whole exploration.",
          correct: true,
        },
        {
          id: "headline_only",
          label: "Only the name of the new deliverable",
          feedback:
            "That is clean, but too thin. The new task still needs the decisions and boundaries you have already agreed.",
          correct: false,
        },
      ],
    };
  }

  if (template === "reasoning_match") {
    return {
      kind: "mini_game",
      title,
      description,
      prompt: "Which task is most likely to benefit from deeper reasoning?",
      options: [
        {
          id: "short_rewrite",
          label: "Tighten a short email whose facts are already final",
          feedback:
            "This is narrow and easy to review, so a fast model with light reasoning should be enough.",
          correct: false,
        },
        {
          id: "architecture_change",
          label: "Plan a multi-file change with unclear dependencies and tests",
          feedback:
            "This has ambiguity, connected decisions, and a higher verification cost. Deeper reasoning can change the outcome.",
          correct: true,
        },
        {
          id: "format_list",
          label: "Turn a finished list into a clean table",
          feedback:
            "This is a bounded transformation. More reasoning is unlikely to add much value.",
          correct: false,
        },
      ],
    };
  }

  throw new Error("gameTemplate must be context_packing or reasoning_match.");
}

function parseLearningModule(input: Record<string, unknown>): LearningModuleInput {
  const kind = input.kind;
  const title = requiredString(input, "title", 4, 80);
  const description = requiredString(input, "description", 12, 220);

  if (kind === "video") {
    const videoId = requiredString(input, "videoId", 11, 11);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      throw new Error("videoId must be a valid 11-character YouTube video id.");
    }
    return {
      kind,
      title,
      description,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (kind === "walkthrough") {
    return {
      kind,
      title,
      description,
      steps: stringList(input.steps, "steps", 2, 6, 8, 180),
    };
  }

  if (kind === "mini_game") {
    return miniGameFromTemplate(input.gameTemplate, title, description);
  }

  throw new Error("kind must be video, walkthrough, or mini_game.");
}

function reveal(sectionId: string): void {
  window.setTimeout(() => {
    const section = document.getElementById(sectionId);
    if (section instanceof HTMLDetailsElement) section.open = true;
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function publicJourney(state: LearningState) {
  return {
    activeCapsule: {
      id: state.activeCapsule.id,
      title: state.activeCapsule.title,
      focus: state.activeCapsule.focus,
      status: state.activeCapsule.status,
    },
    journey: state.journey,
    assignedTraining: state.context.requiredTraining,
    desktopBridge: state.desktopBridge,
  };
}

function parseSignals(input: unknown): PracticeSignal[] {
  const object = objectInput(input);
  const rawSignals = object.signals;
  if (!Array.isArray(rawSignals) || rawSignals.length < 1 || rawSignals.length > 4) {
    throw new Error("signals must contain between 1 and 4 items.");
  }
  const seen = new Set<SignalId>();
  return rawSignals.map((raw) => {
    const item = objectInput(raw);
    const id = focusId(item.id);
    if (seen.has(id)) throw new Error(`Duplicate signal: ${id}.`);
    seen.add(id);
    const level = item.level;
    if (level !== "watch" && level !== "practice" && level !== "priority") {
      throw new Error(`Invalid level for ${id}.`);
    }
    return {
      id,
      label: signalLabels[id],
      level: level as SignalLevel,
      confidence: numberInRange(item, "confidence", 0, 1),
      evidence: requiredString(item, "evidence", 12, 220),
      recommendation: requiredString(item, "recommendation", 12, 220),
      sourceTaskCount: Math.round(numberInRange(item, "sourceTaskCount", 1, 20)),
    };
  });
}

export function createOgramLearningTools(
  actions: LearningActions,
): WebMcpToolDefinition[] {
  const readOnly = {
    readOnlyHint: true,
    untrustedContentHint: false,
  };
  const write = {
    readOnlyHint: false,
    untrustedContentHint: false,
  };

  return [
    {
      name: "ogram_get_learning_mission",
      description:
        "Start a user-requested daily Codex-practice review. Returns the privacy boundary, review rubric, and exact next calls. It never reads Codex history itself.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: readOnly,
      execute: () => ({
        mission:
          "Turn recent Codex working habits into one practical lesson on the visible Ogram page.",
        consentBoundary:
          "Only review tasks the user has authorized you to inspect. Do not send raw prompts, outputs, file contents, task titles, people, companies, or client data to this page.",
        workflow: [
          "Read Ogram context with ogram_get_injected_context.",
          "Use your own authorized Codex task tools to inspect at most 8 recent tasks from the last 7 days.",
          "Derive 1–4 behavioural signals: thread hygiene, workspace hygiene, reasoning fit, or task shaping.",
          "Send only counts, confidence, a sanitized behavioural summary, and a recommendation with ogram_submit_practice_signals.",
          "Publish one capsule with ogram_publish_daily_capsule.",
          "Optionally add one relevant video, walkthrough, or Ogram-built mini-game with ogram_add_learning_module.",
          "Invite the learner to complete the visible scenario; never mark completion without their explicit response.",
        ],
        signalIds,
        rawTaskContentAllowed: false,
      }),
    },
    {
      name: "ogram_get_injected_context",
      description:
        "Read the synthetic Ogram-injected role, workshop, preference, and assigned-training context used to tailor this prototype lesson.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: readOnly,
      execute: () => {
        const context = actions.getState().context;
        return {
          ...context,
          usage:
            "Use this only to personalize examples and relevance. Do not infer sensitive traits or override the learner’s stated goal.",
        };
      },
    },
    {
      name: "ogram_get_learning_journey",
      description:
        "Read the current capsule, prior practice proofs, assigned training, and desktop-sync status without conversation content.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: readOnly,
      execute: () => publicJourney(actions.getState()),
    },
    {
      name: "ogram_submit_practice_signals",
      description:
        "Add 1–4 privacy-preserving behavioural observations from an authorized review. Visibly updates and reveals the lesson rationale. Never pass raw task text or names.",
      inputSchema: {
        type: "object",
        properties: {
          signals: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                id: { type: "string", enum: signalIds },
                level: {
                  type: "string",
                  enum: ["watch", "practice", "priority"],
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                evidence: {
                  type: "string",
                  description:
                    "12–220 character behavioural summary with no raw content, titles, file paths, people, organisations, or client details.",
                },
                recommendation: { type: "string", minLength: 12, maxLength: 220 },
                sourceTaskCount: { type: "integer", minimum: 1, maximum: 20 },
              },
              required: [
                "id",
                "level",
                "confidence",
                "evidence",
                "recommendation",
                "sourceTaskCount",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["signals"],
        additionalProperties: false,
      },
      annotations: write,
      execute: (input) => {
        const signals = parseSignals(input);
        const result = actions.submitSignals(signals);
        reveal("evidence-signals");
        return {
          ok: true,
          eventId: result.eventId,
          acceptedSignalIds: signals.map((signal) => signal.id),
          rawTaskContentStored: false,
          visibleChange: "The lesson rationale was updated and revealed.",
          nextTool: "ogram_publish_daily_capsule",
        };
      },
    },
    {
      name: "ogram_publish_daily_capsule",
      description:
        "Publish one tailored daily practice to the visible page. Ogram’s recipe and injected context control the lesson, scenario, feedback, and visual structure; you select only the behavioural focus and aggregate task count.",
      inputSchema: {
        type: "object",
        properties: {
          focus: { type: "string", enum: signalIds },
          sourceTaskCount: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["focus", "sourceTaskCount"],
        additionalProperties: false,
      },
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const draft: CapsuleDraftInput = {
          focus: focusId(object.focus),
          personalizedScenario: "",
          coachNote: "",
          sourceTaskCount: Math.round(
            numberInRange(object, "sourceTaskCount", 1, 20),
          ),
        };
        const result = actions.publishCapsule(draft);
        reveal("todays-practice");
        return {
          ok: true,
          ...result,
          visibleChange: "A new daily lesson is active on the page.",
          learnerActionRequired: "Complete the scenario before marking it done.",
        };
      },
    },
    {
      name: "ogram_add_learning_module",
      description:
        "Add an optional learning aid to the active lesson. Supports a validated YouTube video id, a short step-by-step walkthrough, or one of Ogram’s safe interactive game templates. This tool never accepts HTML, CSS, JavaScript, or recording commands.",
      inputSchema: {
        type: "object",
        properties: {
          capsuleId: { type: "string", minLength: 8, maxLength: 100 },
          kind: {
            type: "string",
            enum: ["video", "walkthrough", "mini_game"],
          },
          title: { type: "string", minLength: 4, maxLength: 80 },
          description: { type: "string", minLength: 12, maxLength: 220 },
          videoId: {
            type: "string",
            pattern: "^[A-Za-z0-9_-]{11}$",
            description:
              "Required for video modules. Find a relevant public YouTube video using your own authorized browsing capability, then pass only its 11-character id.",
          },
          steps: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: { type: "string", minLength: 8, maxLength: 180 },
            description: "Required for walkthrough modules.",
          },
          gameTemplate: {
            type: "string",
            enum: ["context_packing", "reasoning_match"],
            description:
              "Required for mini_game modules. Ogram owns the interaction and answer rubric; the agent selects the relevant template.",
          },
        },
        required: ["capsuleId", "kind", "title", "description"],
        additionalProperties: false,
      },
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const capsuleId = requiredString(object, "capsuleId", 8, 100);
        const module = parseLearningModule(object);
        const result = actions.addLearningModule(capsuleId, module);
        reveal("learning-modules");
        return {
          ok: true,
          ...result,
          moduleKind: module.kind,
          visibleChange: "An optional learning aid was added to the first step.",
          safety:
            "Rendered by an Ogram-owned component. No executable page code was accepted.",
        };
      },
    },
    {
      name: "ogram_queue_desktop_follow_up",
      description:
        "Queue the active practice cue for the Ogram desktop journey after completion, so a later matching Codex behaviour can become proof of application.",
      inputSchema: {
        type: "object",
        properties: {
          capsuleId: { type: "string", minLength: 8, maxLength: 100 },
          reason: { type: "string", minLength: 8, maxLength: 180 },
        },
        required: ["capsuleId", "reason"],
        additionalProperties: false,
      },
      annotations: write,
      execute: async (input) => {
        const object = objectInput(input);
        const result = await actions.queueDesktopFollowUp(
          requiredString(object, "capsuleId", 8, 100),
          requiredString(object, "reason", 8, 180),
        );
        reveal("desktop-loop");
        return {
          ok: true,
          ...result,
          visibleChange: "Desktop learning-loop status updated.",
        };
      },
    },
  ];
}

export async function registerOgramLearningTools(
  actions: LearningActions,
): Promise<WebMcpRegistration> {
  const tools = createOgramLearningTools(actions);
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    window.__OGRAM_WEBMCP_TOOLS__ = Object.fromEntries(
      tools.map((tool) => [tool.name, tool]),
    );
  }

  const controller = new AbortController();
  const supported = typeof document.modelContext?.registerTool === "function";

  if (supported) {
    await Promise.all(
      tools.map((tool) =>
        document.modelContext!.registerTool(tool, { signal: controller.signal }),
      ),
    );
  }

  return {
    supported,
    toolCount: tools.length,
    toolNames: tools.map((tool) => tool.name),
    cleanup: () => {
      controller.abort();
      delete window.__OGRAM_WEBMCP_TOOLS__;
    },
  };
}
