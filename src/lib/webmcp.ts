import type { TSchema } from "@sinclair/typebox";
import { compilePracticeSignals } from "../domain/signalEngine";
import { signalIds } from "../domain/types";
import type {
  CapsuleDraftInput,
  LearningModuleInput,
  LearningState,
  PracticeSignal,
} from "../domain/types";
import {
  EmptyInputSchema,
  LearningModuleInputSchema,
  PracticeReviewInputSchema,
  PublishCapsuleInputSchema,
  parseToolInput,
} from "./webmcpSchemas";
import type {
  LearningModuleToolInput,
  PublishCapsuleInput,
} from "./webmcpSchemas";

export interface WebMcpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: TSchema;
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

interface RevisionResult {
  revision: number;
  eventId: string;
}

export interface LearningToolActions {
  getState(): LearningState;
  awaitRevision(revision: number, eventId?: string): Promise<LearningState>;
  submitSignals(signals: PracticeSignal[]): RevisionResult & { eventId: string };
  publishCapsule(input: CapsuleDraftInput): RevisionResult & {
    capsuleId: string;
    eventId: string;
  };
  addLearningModule(
    capsuleId: string,
    module: LearningModuleInput,
  ): RevisionResult & { moduleId: string; eventId: string };
}

async function awaitCommittedRevision<T extends RevisionResult>(
  actions: LearningToolActions,
  result: T,
): Promise<LearningState> {
  if (!Number.isInteger(result.revision) || result.revision < 1) {
    throw new Error("The learning mutation returned an invalid revision.");
  }
  return actions.awaitRevision(result.revision, result.eventId);
}

function miniGameFromTemplate(
  template: "context_packing" | "reasoning_match",
  title: string,
  description: string,
): LearningModuleInput {
  if (template === "context_packing") {
    return {
      kind: "mini_game",
      title,
      description,
      prompt:
        "You are forking an approved plan into a new production task. What should you bring across?",
      options: [
        {
          id: "everything",
          label: "The full conversation, including rejected ideas",
          feedback:
            "That brings the clutter with you. Carry only the decisions the next task needs.",
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
            "That is clean, but too thin. The new task still needs the agreed boundaries.",
          correct: false,
        },
      ],
    };
  }

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

function learningModuleFromToolInput(
  input: LearningModuleToolInput,
): LearningModuleInput {
  if (input.templateId === "clean_handoff") {
    return {
      kind: "walkthrough",
      title: "Build a clean handoff",
      description:
        "A short Ogram rehearsal for making a new task useful without carrying the whole exploration.",
      steps: [
        "Name the approved outcome in one sentence.",
        "Carry only decisions, constraints, and the definition of done.",
        "State what the new task must verify before it ships.",
      ],
    };
  }
  if (input.templateId === "effort_triage") {
    return {
      kind: "walkthrough",
      title: "Triage the work before choosing effort",
      description:
        "Use three Ogram checks to match model effort to the real shape of the task.",
      steps: [
        "Name the ambiguity that could change the result.",
        "Count the connected files, systems, or decisions.",
        "Choose the lightest effort that can verify the outcome.",
      ],
    };
  }
  return miniGameFromTemplate(
    input.templateId,
    input.templateId === "context_packing"
      ? "Pack only the context worth keeping"
      : "Match effort to the task",
    input.templateId === "context_packing"
      ? "A second lens for deciding what should cross into a clean production fork."
      : "A quick check for when deeper reasoning can materially change the outcome.",
  );
}

function publicJourney(state: LearningState) {
  return {
    revision: state.revision,
    activeCapsule: {
      id: state.activeCapsule.id,
      title: state.activeCapsule.title,
      focus: state.activeCapsule.focus,
      status: state.activeCapsule.status,
      compiler: state.activeCapsule.compiler,
      moduleCount: state.activeCapsule.learningModules?.length ?? 0,
    },
    journey: state.journey,
    assignedTraining: state.context.requiredTraining,
    journeySync: state.journeySync,
    contextReceiptId: state.contextReceipt.receiptId,
  };
}

function capsuleDraft(
  input: PublishCapsuleInput,
  state: LearningState,
): CapsuleDraftInput {
  const focusSignal = state.signals.find((signal) => signal.id === input.focus);
  if (!focusSignal) {
    throw new Error(
      `No committed ${input.focus} observation is available. Submit practice signals first.`,
    );
  }
  if (
    !Number.isInteger(focusSignal.sourceTaskCount) ||
    focusSignal.sourceTaskCount < 1 ||
    focusSignal.sourceTaskCount > 8
  ) {
    throw new Error("The committed review must cover between 1 and 8 tasks.");
  }

  return {
    focus: input.focus,
    sourceTaskCount: focusSignal.sourceTaskCount,
    difficulty: input.difficulty ?? "guided",
    practiceMode: input.practiceMode ?? "decision",
    proofMode: input.proofMode ?? "next_action",
  };
}

export function createOgramLearningTools(
  actions: LearningToolActions,
): WebMcpToolDefinition[] {
  const trustedRead = {
    readOnlyHint: true,
    untrustedContentHint: false,
  };
  const untrustedRead = {
    readOnlyHint: true,
    untrustedContentHint: true,
  };
  const write = {
    readOnlyHint: false,
    untrustedContentHint: false,
  };
  let writeTail: Promise<void> = Promise.resolve();
  const serializeWrite = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = writeTail.then(operation, operation);
    writeTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return [
    {
      name: "ogram_get_learning_mission",
      title: "Get learning mission",
      description:
        "Read the privacy boundary and review rubric for creating today's Ogram practice from authorized recent Codex work.",
      inputSchema: EmptyInputSchema,
      annotations: trustedRead,
      execute: (input) => {
        parseToolInput(EmptyInputSchema, input);
        return {
          mission:
            "Turn recent Codex working habits into one practical lesson on the visible Ogram page.",
          consentBoundary:
            "Review only tasks the learner authorized. Submit structured counts only—never prompts, outputs, file contents, task titles, people, companies, or client data.",
          workflow: [
            "Read the Ogram context and current learning journey.",
            "Inspect at most 8 authorized recent tasks from the last 7 days with your own Codex task tools.",
            "Submit 1–4 structured observations with occurrence counts, sample size, level, and confidence.",
            "Publish one capsule from a committed observation and optionally attach one bounded learning module.",
            "Invite the learner to complete the visible exercise; learner answers and completion remain page actions.",
          ],
          signalIds,
          reviewWindowDays: 7,
          maximumTaskCount: 8,
          rawTaskContentAllowed: false,
        };
      },
    },
    {
      name: "ogram_get_injected_context",
      title: "Get Ogram learning context",
      description:
        "Read the learner-authorized Ogram role, workshop, preference, and assigned-training context used by the capsule compiler.",
      inputSchema: EmptyInputSchema,
      annotations: untrustedRead,
      execute: (input) => {
        parseToolInput(EmptyInputSchema, input);
        const state = actions.getState();
        return {
          revision: state.revision,
          contextReceiptId: state.contextReceipt.receiptId,
          context: state.context,
          usage:
            "Use this context to select relevance and practice shape. Ogram owns the lesson copy and pedagogy.",
        };
      },
    },
    {
      name: "ogram_get_learning_journey",
      title: "Get learning journey",
      description:
        "Read the current capsule, prior practice proofs, assigned training, context receipt, and durable journey-sync state.",
      inputSchema: EmptyInputSchema,
      annotations: untrustedRead,
      execute: (input) => {
        parseToolInput(EmptyInputSchema, input);
        return publicJourney(actions.getState());
      },
    },
    {
      name: "ogram_submit_practice_signals",
      title: "Submit practice observations",
      description:
        "Commit 1–4 structured observations from up to 8 authorized recent tasks. Ogram compiles the counts into page-owned evidence and recommendations.",
      inputSchema: PracticeReviewInputSchema,
      annotations: write,
      execute: (input) => serializeWrite(async () => {
        const parsed = parseToolInput(PracticeReviewInputSchema, input);
        const signals = compilePracticeSignals(parsed.signals);
        const result = actions.submitSignals(signals);
        const state = await awaitCommittedRevision(actions, result);

        return {
          ok: true,
          eventId: result.eventId,
          revision: result.revision,
          committedState: {
            revision: state.revision,
            signalCount: state.signals.length,
          },
          acceptedSignalIds: signals.map((signal) => signal.id),
          reviewedTaskCount: Math.max(
            ...signals.map((signal) => signal.sourceTaskCount),
          ),
          rawTaskContentStored: false,
          nextTool: "ogram_publish_daily_capsule",
        };
      }),
    },
    {
      name: "ogram_publish_daily_capsule",
      title: "Publish daily capsule",
      description:
        "Compile and commit one visible daily practice from a submitted focus. Difficulty, practice mode, and proof mode select bounded Ogram recipes.",
      inputSchema: PublishCapsuleInputSchema,
      annotations: write,
      execute: (input) => serializeWrite(async () => {
        const parsed = parseToolInput(PublishCapsuleInputSchema, input);
        const draft = capsuleDraft(parsed, actions.getState());
        const result = actions.publishCapsule(draft);
        const state = await awaitCommittedRevision(actions, result);
        if (state.activeCapsule.id !== result.capsuleId) {
          throw new Error("The committed capsule does not match the mutation result.");
        }

        return {
          ok: true,
          eventId: result.eventId,
          revision: result.revision,
          capsuleId: result.capsuleId,
          capsule: {
            id: state.activeCapsule.id,
            title: state.activeCapsule.title,
            focus: state.activeCapsule.focus,
            status: state.activeCapsule.status,
            durationMinutes: state.activeCapsule.durationMinutes,
            compiler: state.activeCapsule.compiler,
          },
          learnerActionRequired:
            "The learner completes the scenario through visible page controls.",
        };
      }),
    },
    {
      name: "ogram_add_learning_module",
      title: "Add learning module",
      description:
        "Commit one Ogram-owned walkthrough or mini-game template to the active capsule. The input accepts no teaching copy or external URL.",
      inputSchema: LearningModuleInputSchema,
      annotations: write,
      execute: (input) => serializeWrite(async () => {
        const parsed = parseToolInput(LearningModuleInputSchema, input);
        const module = learningModuleFromToolInput(parsed);
        const result = actions.addLearningModule(parsed.capsuleId, module);
        const state = await awaitCommittedRevision(actions, result);
        const committedModule = state.activeCapsule.learningModules?.find(
          (candidate) => candidate.id === result.moduleId,
        );
        if (!committedModule) {
          throw new Error("The committed learning module could not be verified.");
        }

        return {
          ok: true,
          eventId: result.eventId,
          revision: result.revision,
          capsuleId: state.activeCapsule.id,
          moduleId: result.moduleId,
          module: {
            id: committedModule.id,
            kind: committedModule.kind,
            title: committedModule.title,
          },
          moduleCount: state.activeCapsule.learningModules?.length ?? 0,
          safety:
            "The module is rendered by an Ogram-owned component; no executable page code was accepted.",
        };
      }),
    },
  ];
}

export async function registerOgramLearningTools(
  actions: LearningToolActions,
): Promise<WebMcpRegistration> {
  const tools = createOgramLearningTools(actions);
  if (import.meta.env.DEV || import.meta.env.MODE === "test") {
    window.__OGRAM_WEBMCP_TOOLS__ = Object.fromEntries(
      tools.map((tool) => [tool.name, tool]),
    );
  }

  const controller = new AbortController();
  const supported = typeof document.modelContext?.registerTool === "function";

  try {
    if (supported) {
      await Promise.all(
        tools.map((tool) =>
          document.modelContext!.registerTool(tool, {
            signal: controller.signal,
          }),
        ),
      );
    }
  } catch (error) {
    controller.abort();
    delete window.__OGRAM_WEBMCP_TOOLS__;
    throw error;
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
