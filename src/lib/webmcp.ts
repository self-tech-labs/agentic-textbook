import { signalIds } from "../domain/types";
import type {
  CapsuleDraftInput,
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
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
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

function reveal(sectionId: string): void {
  window.setTimeout(() => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const write = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
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
          "Turn recent Codex working habits into one practical lesson on the visible Ogram canvas.",
        consentBoundary:
          "Only review tasks the user has authorized you to inspect. Do not send raw prompts, outputs, file contents, task titles, people, companies, or client data to this page.",
        workflow: [
          "Read Ogram context with ogram_get_injected_context.",
          "Use your own authorized Codex task tools to inspect at most 8 recent tasks from the last 7 days.",
          "Derive 1–4 behavioural signals: thread hygiene, workspace hygiene, reasoning fit, or task shaping.",
          "Send only counts, confidence, a sanitized behavioural summary, and a recommendation with ogram_submit_practice_signals.",
          "Publish one capsule with ogram_publish_daily_capsule.",
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
        "Add 1–4 privacy-preserving behavioural observations from an authorized review. Visibly updates the Evidence signals panel. Never pass raw task text or names.",
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
          visibleChange: "Evidence signals panel updated.",
          nextTool: "ogram_publish_daily_capsule",
        };
      },
    },
    {
      name: "ogram_publish_daily_capsule",
      description:
        "Publish one tailored daily practice to the visible canvas. Ogram’s curated recipe controls lesson structure; you select the focus and personalize the work scenario.",
      inputSchema: {
        type: "object",
        properties: {
          focus: { type: "string", enum: signalIds },
          personalizedScenario: {
            type: "string",
            minLength: 20,
            maxLength: 900,
            description:
              "A sanitized role-relevant scenario. Do not reproduce any real prompt, task title, person, organisation, file path, or client detail.",
          },
          coachNote: { type: "string", minLength: 8, maxLength: 320 },
          sourceTaskCount: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: [
          "focus",
          "personalizedScenario",
          "coachNote",
          "sourceTaskCount",
        ],
        additionalProperties: false,
      },
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const draft: CapsuleDraftInput = {
          focus: focusId(object.focus),
          personalizedScenario: requiredString(
            object,
            "personalizedScenario",
            20,
            900,
          ),
          coachNote: requiredString(object, "coachNote", 8, 320),
          sourceTaskCount: Math.round(
            numberInRange(object, "sourceTaskCount", 1, 20),
          ),
        };
        const result = actions.publishCapsule(draft);
        reveal("todays-practice");
        return {
          ok: true,
          ...result,
          visibleChange: "A new capsule is active on the shared canvas.",
          learnerActionRequired: "Complete the scenario before marking it done.",
        };
      },
    },
    {
      name: "ogram_record_scenario_choice",
      description:
        "Record the learner’s explicit choice in the active scenario and reveal feedback on the shared canvas. Do not choose on the learner’s behalf.",
      inputSchema: {
        type: "object",
        properties: {
          capsuleId: { type: "string", minLength: 8, maxLength: 100 },
          choiceId: { type: "string", minLength: 2, maxLength: 80 },
        },
        required: ["capsuleId", "choiceId"],
        additionalProperties: false,
      },
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.recordChoice(
          requiredString(object, "capsuleId", 8, 100),
          requiredString(object, "choiceId", 2, 80),
        );
        reveal("practice-scenario");
        return { ok: true, ...result, visibleChange: "Scenario feedback revealed." };
      },
    },
    {
      name: "ogram_complete_capsule",
      description:
        "Complete the active capsule after the learner has answered the scenario and explicitly confirmed the practice commitment. Updates the visible journey.",
      inputSchema: {
        type: "object",
        properties: {
          capsuleId: { type: "string", minLength: 8, maxLength: 100 },
        },
        required: ["capsuleId"],
        additionalProperties: false,
      },
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.completeCapsule(
          requiredString(object, "capsuleId", 8, 100),
        );
        reveal("learning-journey");
        return {
          ok: true,
          ...result,
          visibleChange: "Journey marked complete; practice proof is now visible.",
          suggestedNextTool: "ogram_queue_desktop_follow_up",
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
  const fallbackRegistry = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  window.__OGRAM_WEBMCP_TOOLS__ = fallbackRegistry;

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
