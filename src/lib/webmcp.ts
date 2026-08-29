import type { TSchema } from "@sinclair/typebox";
import { evaluateContextPack } from "../domain/practiceEngine";
import { compilePracticeSignals } from "../domain/signalEngine";
import { signalIds } from "../domain/types";
import type {
  CapsuleDraftInput,
  ContextPackCardId,
  ContextPackCoachingMove,
  LearningState,
  PracticeSignal,
} from "../domain/types";
import {
  EmptyInputSchema,
  InspectPracticeAttemptInputSchema,
  PracticeCoachingInputSchema,
  PracticeReviewInputSchema,
  PublishCapsuleInputSchema,
  parseToolInput,
} from "./webmcpSchemas";
import type { PracticeCoachingInput, PublishCapsuleInput } from "./webmcpSchemas";

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
  recordPracticeCoaching(
    capsuleId: string,
    attemptRevision: number,
    move: ContextPackCoachingMove,
    cardId: ContextPackCardId | null,
  ): RevisionResult & {
    reviewId: string;
    eventId: string;
    ready: boolean;
  };
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
      collaboration: state.activeCapsule.collaboration
        ? {
            phase: state.activeCapsule.collaboration.phase,
            attemptRevision: state.activeCapsule.collaboration.attemptRevision,
            consent: state.activeCapsule.collaboration.consent,
            reviewCount: state.activeCapsule.collaboration.reviews.length,
          }
        : null,
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
            "Turn recent Codex thread-hygiene patterns into one live context-packing lesson on the visible Ogram page.",
          consentBoundary:
            "Review only tasks the learner authorized. Submit structured counts only—never prompts, outputs, file contents, task titles, people, companies, or client data.",
          workflow: [
            "Read the Ogram context and current learning journey.",
            "Inspect at most 8 authorized recent tasks from the last 7 days with your own Codex task tools.",
            "Submit 1–4 structured observations with occurrence counts, sample size, level, and confidence.",
            "Publish the thread-hygiene capsule from its committed observation. This challenge branch intentionally exposes one flagship shared instrument.",
            "Wait for the learner to compose and explicitly share one live practice revision.",
            "Inspect that exact revision and add one bounded coaching move. The learner revises, re-shares, and remains the only actor who can finish.",
          ],
          signalIds,
          challengeFocus: "thread_hygiene",
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
        const before = actions.getState();
        if (JSON.stringify(before.signals) === JSON.stringify(signals)) {
          const existingEvent = [...before.events]
            .reverse()
            .find((event) => event.type === "coaching_signals_submitted");
          if (!existingEvent) {
            throw new Error(
              "The existing practice observations have no durable event receipt.",
            );
          }
          return {
            ok: true,
            replayed: true,
            eventId: existingEvent.id,
            revision: existingEvent.revision,
            committedState: {
              revision: before.revision,
              signalCount: before.signals.length,
            },
            acceptedSignalIds: signals.map((signal) => signal.id),
            reviewedTaskCount: Math.max(
              ...signals.map((signal) => signal.sourceTaskCount),
            ),
            rawTaskContentStored: false,
            nextTool: "ogram_publish_daily_capsule",
          };
        }
        const result = actions.submitSignals(signals);
        const state = await awaitCommittedRevision(actions, result);

        return {
          ok: true,
          replayed: false,
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
        "Compile and commit the flagship thread-hygiene context-packing practice. Difficulty, practice mode, and proof mode select bounded Ogram recipes.",
      inputSchema: PublishCapsuleInputSchema,
      annotations: write,
      execute: (input) => serializeWrite(async () => {
        const parsed = parseToolInput(PublishCapsuleInputSchema, input);
        const before = actions.getState();
        const draft = capsuleDraft(parsed, before);
        const currentCapsule = before.activeCapsule;
        const sameCompilerRequest =
          currentCapsule.status === "active" &&
          currentCapsule.focus === draft.focus &&
          currentCapsule.compiler.contextReceiptId ===
            (draft.contextReceiptId ?? before.contextReceipt.receiptId) &&
          currentCapsule.compiler.difficulty === (draft.difficulty ?? "guided") &&
          currentCapsule.compiler.practiceMode ===
            (draft.practiceMode ?? "decision") &&
          currentCapsule.compiler.proofMode ===
            (draft.proofMode ?? "next_action");
        const existingEvent = [...before.events]
          .reverse()
          .find(
            (event) =>
              event.type === "capsule_published" &&
              event.payload?.capsuleId === currentCapsule.id,
          );
        const latestSignalEvent = [...before.events]
          .reverse()
          .find((event) => event.type === "coaching_signals_submitted");
        if (
          sameCompilerRequest &&
          existingEvent &&
          (!latestSignalEvent || existingEvent.revision > latestSignalEvent.revision)
        ) {
          return {
            ok: true,
            replayed: true,
            eventId: existingEvent.id,
            revision: existingEvent.revision,
            capsuleId: currentCapsule.id,
            capsule: {
              id: currentCapsule.id,
              title: currentCapsule.title,
              focus: currentCapsule.focus,
              status: currentCapsule.status,
              durationMinutes: currentCapsule.durationMinutes,
              compiler: currentCapsule.compiler,
            },
            learnerActionRequired:
              "The learner composes and explicitly shares a context-pack revision through visible page controls.",
            nextTools: [
              "ogram_inspect_practice_attempt",
              "ogram_record_coaching_move",
            ],
          };
        }
        const result = actions.publishCapsule(draft);
        const state = await awaitCommittedRevision(actions, result);
        if (state.activeCapsule.id !== result.capsuleId) {
          throw new Error("The committed capsule does not match the mutation result.");
        }

        return {
          ok: true,
          replayed: false,
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
            "The learner composes and explicitly shares a context-pack revision through visible page controls.",
          nextTools: [
            "ogram_inspect_practice_attempt",
            "ogram_record_coaching_move",
          ],
        };
      }),
    },
    {
      name: "ogram_inspect_practice_attempt",
      title: "Inspect shared practice revision",
      description:
        "Read the exact context-pack revision the learner explicitly shared. Fails closed before consent, after withdrawal, and after one coaching move.",
      inputSchema: InspectPracticeAttemptInputSchema,
      annotations: untrustedRead,
      execute: (input) => {
        const parsed = parseToolInput(InspectPracticeAttemptInputSchema, input);
        const state = actions.getState();
        const capsule = state.activeCapsule;
        const instrument = capsule.practiceInstrument;
        const collaboration = capsule.collaboration;
        if (capsule.id !== parsed.capsuleId || !instrument || !collaboration) {
          throw new Error("That shared practice instrument is not active.");
        }
        if (
          collaboration.phase !== "awaiting_review" ||
          collaboration.consent !== "granted"
        ) {
          throw new Error(
            "Learner consent is not active. Ask the learner to share a revision from the visible page.",
          );
        }
        const snapshot = collaboration.snapshots.at(-1);
        if (
          !snapshot ||
          snapshot.attemptRevision !== collaboration.attemptRevision
        ) {
          throw new Error("The consented practice snapshot is unavailable.");
        }
        const evaluation = evaluateContextPack(instrument, snapshot.placements);
        const cardById = new Map(instrument.cards.map((card) => [card.id, card]));
        return {
          ok: true,
          capsuleId: capsule.id,
          attemptRevision: snapshot.attemptRevision,
          consentScope: "this_revision_only",
          cards: snapshot.placements.map((placement) => {
            const card = cardById.get(placement.cardId)!;
            return {
              cardId: placement.cardId,
              label: card.label,
              description: card.description,
              zone: placement.zone,
            };
          }),
          rubric: {
            sufficient: evaluation.indicators.sufficient,
            lean: evaluation.indicators.lean,
            private: evaluation.indicators.private,
          },
          previousBoundedReview: collaboration.reviews.at(-1)
            ? {
                attemptRevision: collaboration.reviews.at(-1)!.attemptRevision,
                move: collaboration.reviews.at(-1)!.move,
                cardId: collaboration.reviews.at(-1)!.cardId,
                resolution: collaboration.reviews.at(-1)!.resolution,
              }
            : null,
          privacy: {
            rawTaskContentShared: false,
            excluded: [
              "prompts",
              "responses",
              "files",
              "paths",
              "people",
              "client data",
              "private draft movements",
            ],
          },
          nextTool: "ogram_record_coaching_move",
        };
      },
    },
    {
      name: "ogram_record_coaching_move",
      title: "Add bounded practice coaching",
      description:
        "Attach one page-authored coaching marker to the exact consented revision. Accepts only a card ID or a ready confirmation—never prose or direct card changes.",
      inputSchema: PracticeCoachingInputSchema,
      annotations: write,
      execute: (input) =>
        serializeWrite(async () => {
          const parsed = parseToolInput(
            PracticeCoachingInputSchema,
            input,
          ) as PracticeCoachingInput;
          const cardId =
            parsed.move === "reconsider_card" ? parsed.cardId : null;
          const before = actions.getState();
          const existingReview = before.activeCapsule.collaboration?.reviews.find(
            (candidate) =>
              candidate.attemptRevision === parsed.attemptRevision,
          );
          if (existingReview) {
            if (
              before.activeCapsule.id !== parsed.capsuleId ||
              existingReview.move !== parsed.move ||
              existingReview.cardId !== cardId
            ) {
              throw new Error(
                "That revision already has a different bounded coaching move.",
              );
            }
            const existingEvent = before.events.find(
              (event) =>
                event.type === "practice_coaching_recorded" &&
                event.payload?.capsuleId === parsed.capsuleId &&
                event.payload?.attemptRevision === parsed.attemptRevision,
            );
            if (!existingEvent) {
              throw new Error(
                "The existing coaching move has no durable event receipt.",
              );
            }
            return {
              ok: true,
              replayed: true,
              eventId: existingEvent.id,
              revision: existingEvent.revision,
              capsuleId: before.activeCapsule.id,
              attemptRevision: parsed.attemptRevision,
              review: {
                id: existingReview.id,
                move: existingReview.move,
                cardId: existingReview.cardId,
                message: existingReview.message,
              },
              ready: existingReview.move === "confirm_ready",
              consentConsumed: true,
              agentMovedCards: 0,
              learnerActionRequired:
                existingReview.move === "confirm_ready"
                  ? "The learner may carry the practice into the human-owned commitment step."
                  : "The learner can accept, dismiss, or manually respond to this note before sharing a new revision.",
            };
          }
          const result = actions.recordPracticeCoaching(
            parsed.capsuleId,
            parsed.attemptRevision,
            parsed.move,
            cardId,
          );
          const state = await awaitCommittedRevision(actions, result);
          const review = state.activeCapsule.collaboration?.reviews.find(
            (candidate) => candidate.id === result.reviewId,
          );
          if (!review) {
            throw new Error("The committed coaching marker could not be verified.");
          }
          return {
            ok: true,
            replayed: false,
            eventId: result.eventId,
            revision: result.revision,
            capsuleId: state.activeCapsule.id,
            attemptRevision: parsed.attemptRevision,
            review: {
              id: review.id,
              move: review.move,
              cardId: review.cardId,
              message: review.message,
            },
            ready: result.ready,
            consentConsumed: true,
            agentMovedCards: 0,
            learnerActionRequired: result.ready
              ? "The learner may carry the practice into the human-owned commitment step."
              : "The learner can accept, dismiss, or manually respond to this note before sharing a new revision.",
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
