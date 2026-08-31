import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentCanvasEvent,
  AgentLearningCanvasState,
  CanvasRegion,
  CanvasRegionStatus,
  ContextConsentAttestation,
  LearnerContextClaim,
  LessonDocumentV3,
  LearningSessionStage,
  RegionContent,
  RegionHistoryEntry,
  RegionResponse,
  ResearchReference,
  TrustedPatchContent,
} from "../domain/agentCanvas";
import { validateLessonDocument } from "../domain/agentCanvas";
import { createTransformerSkeleton } from "../domain/transformerFixture";
import {
  clearCanvasState,
  loadCanvasState,
  saveCanvasState,
} from "../lib/canvasPersistence";

function clone<Value>(value: Value): Value {
  return structuredClone(value);
}

function makeId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function createGenericSkeleton(topic: string): CanvasRegion[] {
  const regions = [
    ["learning-goal", "01 · orientation", `A useful model of ${topic}`, "Set the learning goal.", "orient"],
    ["foundations", "02 · foundations", "Build the foundations", "Establish the minimum prerequisites.", "explain"],
    ["core-mechanism", "03 · mechanism", "See the core mechanism", "Trace how the central idea works.", "model"],
    ["worked-example", "04 · example", "Work through an example", "Apply the mechanism to one case.", "explain"],
    ["practice", "05 · practice", "Try it yourself", "Check understanding with a bounded task.", "practice"],
    ["teach-back", "06 · retrieval", "Explain it back", "Consolidate the idea in your own words.", "reflect"],
  ] as const;

  return regions.map(([id, label, title, objective, kind], index) => ({
    id,
    order: index + 1,
    label,
    title,
    objective,
    kind,
    revision: 0,
    status: "skeleton",
    content: [],
    provenance: [],
    history: [],
  }));
}

function skeletonForTopic(topic: string): CanvasRegion[] {
  return /transformer/i.test(topic)
    ? createTransformerSkeleton()
    : createGenericSkeleton(topic);
}

function appendEvent(
  state: AgentLearningCanvasState,
  actor: AgentCanvasEvent["actor"],
  type: AgentCanvasEvent["type"],
  summary: string,
  payload?: Record<string, unknown>,
): { state: AgentLearningCanvasState; event: AgentCanvasEvent } {
  const event: AgentCanvasEvent = {
    id: makeId("event"),
    sequence: state.events.length + 1,
    type,
    actor,
    at: new Date().toISOString(),
    summary,
    payload,
  };
  return {
    state: {
      ...state,
      revision: state.revision + 1,
      events: [...state.events, event],
    },
    event,
  };
}

function receipt<Result extends Record<string, unknown>>(
  state: AgentLearningCanvasState,
  key: string,
): Result | null {
  const match = state.commandReceipts.find((item) => item.key === key);
  return match ? (clone(match.result) as Result) : null;
}

function withReceipt<Result extends Record<string, unknown>>(
  state: AgentLearningCanvasState,
  key: string,
  result: Result,
): AgentLearningCanvasState {
  return {
    ...state,
    commandReceipts: [
      ...state.commandReceipts.slice(-199),
      { key, result: clone(result) },
    ],
  };
}

function requireCanvasRevision(
  state: AgentLearningCanvasState,
  expected: number,
): void {
  if (expected !== state.revision) {
    throw new Error(
      `Stale canvas revision. Expected ${expected}; the latest revision is ${state.revision}. Read learn_get_session and retry deliberately.`,
    );
  }
}

function requireRegion(
  state: AgentLearningCanvasState,
  regionId: string,
): CanvasRegion {
  const region = state.regions.find((item) => item.id === regionId);
  if (!region) throw new Error(`Canvas region ${regionId} does not exist.`);
  return region;
}

function requireRegionRevision(region: CanvasRegion, expected: number): void {
  if (expected !== region.revision) {
    throw new Error(
      `Stale region revision. Expected ${expected}; ${region.id} is now revision ${region.revision}. Read learn_get_canvas_snapshot and retry deliberately.`,
    );
  }
}

function snapshotRegion(region: CanvasRegion, undoToken: string): RegionHistoryEntry {
  return {
    undoToken,
    revision: region.revision,
    status: region.status,
    content: clone(region.content),
    provenance: clone(region.provenance),
    updatedAt: region.updatedAt,
    updateRationale: region.updateRationale,
  };
}

function nextUndoHistory(
  region: CanvasRegion,
  undoToken: string,
): RegionHistoryEntry[] {
  if (region.status === "agent_working" && region.history.length) {
    const beforeWorking = region.history.at(-1)!;
    return [
      ...region.history.slice(0, -1),
      { ...clone(beforeWorking), undoToken },
    ];
  }
  return [...region.history, snapshotRegion(region, undoToken)].slice(-12);
}

function replaceRegion(
  state: AgentLearningCanvasState,
  nextRegion: CanvasRegion,
): AgentLearningCanvasState {
  return {
    ...state,
    regions: state.regions.map((region) =>
      region.id === nextRegion.id ? nextRegion : region,
    ),
  };
}

function acceptedClaimIds(state: AgentLearningCanvasState): string[] {
  return state.contextClaims
    .filter((claim) => claim.review === "accepted" || claim.review === "corrected")
    .map((claim) => claim.id);
}

export function createInitialCanvasState(): AgentLearningCanvasState {
  return {
    version: 3,
    revision: 0,
    session: {
      id: null,
      topic: null,
      goal: null,
      stage: "ready",
      startedAt: null,
      contextConsent: null,
      personalization: "undecided",
    },
    contextClaims: [],
    lesson: {
      status: "skeleton",
      draft: null,
      validation: null,
      approvedDraftRevision: null,
      publishedRevision: null,
    },
    regions: [],
    focus: { regionId: null, selectedText: null },
    events: [],
    commandReceipts: [],
  };
}

export const firstToolGuide = [
  "Tell me what you want to understand and why it matters to you.",
  "Choose whether I may use context from this conversation or connected sources.",
  "Review, correct, or reject every proposed context card on the canvas.",
  "Approve the lesson outline, then work through the living notebook at your pace.",
  "When you get stuck, ask me here in Codex. I can read the focused region, reshape it, add an interaction, or research the question.",
] as const;

export interface CanvasActions {
  getState: () => AgentLearningCanvasState;
  getNonce: () => string | null;
  beginSession: (input: { topic: string; goal?: string }) => {
    sessionId: string;
    nonce: string;
    stage: LearningSessionStage;
    resumed: boolean;
    guide: readonly string[];
    suggestedPrompts: string[];
    revision: number;
  };
  proposeContext: (input: {
    baseRevision: number;
    idempotencyKey: string;
    consent: ContextConsentAttestation;
    claims: LearnerContextClaim[];
  }) => {
    revision: number;
    eventId: string;
    proposedClaimIds: string[];
    status: "awaiting_learner_review";
  };
  reviewContextClaim: (input: {
    claimId: string;
    decision: "accepted" | "corrected" | "rejected";
    correctedSummary?: string;
  }) => { eventId: string; claimId: string; decision: string; revision: number };
  skipContext: () => { eventId: string; revision: number };
  prepareLesson: (input: {
    baseRevision: number;
    idempotencyKey: string;
    document: LessonDocumentV3;
  }) => {
    revision: number;
    eventId: string;
    draftRevision: number;
    valid: boolean;
    digest: string;
    diagnostics: ReturnType<typeof validateLessonDocument>["diagnostics"];
    status: "awaiting_learner_review" | "validation_failed";
  };
  approveLesson: (draftRevision: number) => {
    eventId: string;
    draftRevision: number;
    digest: string;
    revision: number;
  };
  publishLesson: (input: {
    baseRevision: number;
    draftRevision: number;
    idempotencyKey: string;
  }) => {
    eventId: string;
    publishedRevision: number;
    canvasRevision: number;
    regionIds: string[];
  };
  focusRegion: (regionId: string | null, selectedText?: string | null) => void;
  patchRegion: (input: {
    regionId: string;
    baseRegionRevision: number;
    idempotencyKey: string;
    operation: "replace" | "append" | "annotate" | "set_status";
    content?: TrustedPatchContent[];
    status?: CanvasRegionStatus;
    rationale: string;
    sourceRefs?: string[];
  }) => {
    eventId: string;
    regionId: string;
    regionRevision: number;
    canvasRevision: number;
    undoToken: string;
  };
  injectWidget: (input: {
    regionId: string;
    baseRegionRevision: number;
    idempotencyKey: string;
    widget: Extract<RegionContent, { type: "sandbox_widget" }>;
    rationale: string;
  }) => {
    eventId: string;
    regionId: string;
    regionRevision: number;
    canvasRevision: number;
    undoToken: string;
  };
  attachResearch: (input: {
    regionId: string;
    baseRegionRevision: number;
    idempotencyKey: string;
    summary: string;
    sources: ResearchReference[];
  }) => {
    eventId: string;
    regionId: string;
    regionRevision: number;
    canvasRevision: number;
    undoToken: string;
  };
  revertRegion: (input: {
    regionId: string;
    baseRegionRevision: number;
    idempotencyKey: string;
    undoToken: string;
    actor?: "agent" | "learner";
  }) => {
    eventId: string;
    regionId: string;
    regionRevision: number;
    canvasRevision: number;
  };
  submitLearnerResponse: (regionId: string, value: string) => {
    eventId: string;
    correct?: boolean;
    revision: number;
  };
  reset: () => void;
}

function ensureAgentWritable(state: AgentLearningCanvasState): void {
  if (state.session.stage !== "learning" || state.lesson.status !== "published") {
    throw new Error("The lesson must be published before its regions can be changed.");
  }
}

export function useLearningCanvas(): {
  state: AgentLearningCanvasState;
  actions: CanvasActions;
} {
  const [state, setState] = useState<AgentLearningCanvasState>(() =>
    loadCanvasState() ?? createInitialCanvasState(),
  );
  const stateRef = useRef(state);
  const nonceRef = useRef<string | null>(null);

  const commit = useCallback((next: AgentLearningCanvasState) => {
    stateRef.current = next;
    saveCanvasState(next);
    setState(next);
  }, []);

  const actions = useMemo<CanvasActions>(() => {
    const getState = () => stateRef.current;
    const getNonce = () => nonceRef.current;

    const beginSession: CanvasActions["beginSession"] = ({ topic, goal }) => {
      const cleanTopic = topic.trim();
      if (!cleanTopic) throw new Error("A learning topic is required.");

      const current = stateRef.current;
      const resumed =
        current.session.id !== null &&
        current.session.topic?.toLocaleLowerCase() === cleanTopic.toLocaleLowerCase();
      if (current.session.id !== null && !resumed) {
        throw new Error(
          `A session about “${current.session.topic}” already owns this canvas. The learner must use Session → Start a new topic before it can be replaced.`,
        );
      }
      const nonce = makeId("session-nonce");
      nonceRef.current = nonce;

      if (resumed) {
        commit({ ...current });
        return {
          sessionId: current.session.id!,
          nonce,
          stage: current.session.stage,
          resumed: true,
          guide: firstToolGuide,
          suggestedPrompts: [
            "Use no personal context; prepare the technical-beginner lesson.",
            "I consent to you proposing relevant context from this conversation for my review.",
            "Read the canvas and help me with the region I am focused on.",
          ],
          revision: current.revision,
        };
      }

      const base: AgentLearningCanvasState = {
        ...createInitialCanvasState(),
        session: {
          id: makeId("learning-session"),
          topic: cleanTopic,
          goal: goal?.trim() || null,
          stage: "context_review",
          startedAt: new Date().toISOString(),
          contextConsent: null,
          personalization: "undecided",
        },
        regions: skeletonForTopic(cleanTopic),
      };
      const evolved = appendEvent(
        base,
        "agent",
        "agent.session.started",
        `Started a learning session about ${cleanTopic}.`,
        { topic: cleanTopic, goal: goal?.trim() || null },
      );
      commit(evolved.state);

      return {
        sessionId: evolved.state.session.id!,
        nonce,
        stage: evolved.state.session.stage,
        resumed: false,
        guide: firstToolGuide,
        suggestedPrompts: [
          "Use no personal context; prepare the technical-beginner lesson.",
          "I consent to you proposing relevant context from this conversation for my review.",
          "Once the notebook is published, read my focused region before changing it.",
        ],
        revision: evolved.state.revision,
      };
    };

    const proposeContext: CanvasActions["proposeContext"] = (input) => {
      const current = stateRef.current;
      const previous = receipt<ReturnType<CanvasActions["proposeContext"]>>(
        current,
        input.idempotencyKey,
      );
      if (previous) return previous;
      requireCanvasRevision(current, input.baseRevision);
      if (current.session.stage !== "context_review") {
        throw new Error("Context can only be proposed before the lesson is prepared.");
      }
      if (!input.claims.length) throw new Error("At least one context claim is required.");
      if (!input.consent.scope.trim() || !input.consent.obtainedAt) {
        throw new Error("A conversation-consent attestation is required before context can be proposed.");
      }
      const knownIds = new Set(current.contextClaims.map((claim) => claim.id));
      const proposedIds = new Set<string>();
      for (const claim of input.claims) {
        if (knownIds.has(claim.id) || proposedIds.has(claim.id)) {
          throw new Error(`Context claim id ${claim.id} is already in use.`);
        }
        proposedIds.add(claim.id);
        if (claim.review !== "pending") {
          throw new Error("New context claims must await learner review.");
        }
        if (claim.summary.trim().length > 240) {
          throw new Error(`Context claim ${claim.id} is not privacy-minimized (240 character maximum).`);
        }
        if (
          claim.source.route !== "learner" &&
          !input.consent.providerIds.includes(claim.source.providerId)
        ) {
          throw new Error(
            `Consent does not cover context provider ${claim.source.providerId}.`,
          );
        }
      }

      const next: AgentLearningCanvasState = {
        ...current,
        session: {
          ...current.session,
          contextConsent: clone(input.consent),
          personalization: "reviewing",
        },
        contextClaims: [...current.contextClaims, ...clone(input.claims)],
      };
      const evolved = appendEvent(
        next,
        "agent",
        "context.claim.proposed",
        `Proposed ${input.claims.length} minimized context claim${input.claims.length === 1 ? "" : "s"} for learner review.`,
        { claimIds: [...proposedIds] },
      );
      const result = {
        revision: evolved.state.revision,
        eventId: evolved.event.id,
        proposedClaimIds: [...proposedIds],
        status: "awaiting_learner_review" as const,
      };
      commit(withReceipt(evolved.state, input.idempotencyKey, result));
      return result;
    };

    const reviewContextClaim: CanvasActions["reviewContextClaim"] = (input) => {
      const current = stateRef.current;
      const claim = current.contextClaims.find((item) => item.id === input.claimId);
      if (!claim) throw new Error(`Context claim ${input.claimId} does not exist.`);
      if (claim.review !== "pending") {
        throw new Error(`Context claim ${input.claimId} has already been reviewed.`);
      }
      if (
        input.decision === "corrected" &&
        (!input.correctedSummary || input.correctedSummary.trim().length < 3)
      ) {
        throw new Error("A corrected claim needs the learner's corrected wording.");
      }
      if (
        input.decision === "corrected" &&
        input.correctedSummary!.trim().length > 240
      ) {
        throw new Error("A corrected context claim must stay under 240 characters.");
      }

      const contextClaims: LearnerContextClaim[] = current.contextClaims.map((item) =>
        item.id === input.claimId
          ? {
              ...item,
              review: input.decision,
              correctedSummary:
                input.decision === "corrected"
                  ? input.correctedSummary!.trim()
                  : undefined,
            }
          : item,
      );
      const pending = contextClaims.some((item) => item.review === "pending");
      const usable = contextClaims.some(
        (item) => item.review === "accepted" || item.review === "corrected",
      );
      const evolved = appendEvent(
        {
          ...current,
          contextClaims,
          session: {
            ...current.session,
            personalization: pending ? "reviewing" : usable ? "approved" : "skipped",
          },
        },
        "learner",
        "context.claim.reviewed",
        `${input.decision === "accepted" ? "Accepted" : input.decision === "corrected" ? "Corrected" : "Rejected"} a proposed context claim.`,
        { claimId: input.claimId, decision: input.decision },
      );
      commit(evolved.state);
      return {
        eventId: evolved.event.id,
        claimId: input.claimId,
        decision: input.decision,
        revision: evolved.state.revision,
      };
    };

    const skipContext: CanvasActions["skipContext"] = () => {
      const current = stateRef.current;
      if (current.session.stage !== "context_review") {
        throw new Error("Context selection has already finished.");
      }
      const evolved = appendEvent(
        {
          ...current,
          contextClaims: current.contextClaims.map((claim) =>
            claim.review === "pending"
              ? ({ ...claim, review: "rejected" } as LearnerContextClaim)
              : claim,
          ),
          session: { ...current.session, personalization: "skipped" },
        },
        "learner",
        "context.personalization.skipped",
        "Chose a generic lesson without personal context.",
      );
      commit(evolved.state);
      return { eventId: evolved.event.id, revision: evolved.state.revision };
    };

    const prepareLesson: CanvasActions["prepareLesson"] = (input) => {
      const current = stateRef.current;
      const previous = receipt<ReturnType<CanvasActions["prepareLesson"]>>(
        current,
        input.idempotencyKey,
      );
      if (previous) return previous;
      requireCanvasRevision(current, input.baseRevision);
      if (current.contextClaims.some((claim) => claim.review === "pending")) {
        throw new Error("Every proposed context claim must be reviewed or skipped first.");
      }
      if (current.session.personalization === "undecided") {
        throw new Error("The learner must approve context use or choose the generic lesson first.");
      }
      if (current.session.stage === "ready") {
        throw new Error("Call learn_begin_session before preparing a lesson.");
      }

      const validation = validateLessonDocument(input.document, acceptedClaimIds(current));
      const protectedResponses = current.regions.filter((region) => region.response);
      for (const protectedRegion of protectedResponses) {
        const replacement = input.document.regions.find(
          (region) => region.id === protectedRegion.id,
        );
        if (
          !replacement ||
          JSON.stringify(replacement.interaction) !==
            JSON.stringify(protectedRegion.interaction)
        ) {
          validation.valid = false;
          validation.diagnostics.push({
            path: `regions.${protectedRegion.id}`,
            severity: "error",
            explanation:
              "Published learner evidence is immutable; keep this region and its interaction unchanged.",
          });
        }
      }

      const status = validation.valid
        ? ("awaiting_learner_review" as const)
        : ("validation_failed" as const);
      const errorCount = validation.diagnostics.filter(
        (item) => item.severity === "error",
      ).length;
      const evolved = appendEvent(
        {
          ...current,
          lesson: {
            ...current.lesson,
            status: validation.valid ? "awaiting_review" : current.lesson.status,
            draft: validation.valid ? clone(input.document) : current.lesson.draft,
            validation,
            approvedDraftRevision: null,
          },
          session: validation.valid
            ? { ...current.session, stage: "lesson_review" }
            : current.session,
        },
        "agent",
        "lesson.draft.prepared",
        validation.valid
          ? `Prepared “${input.document.title}” for learner review.`
          : `The proposed lesson failed ${errorCount} compiler check${errorCount === 1 ? "" : "s"}.`,
        {
          draftRevision: input.document.revision,
          digest: validation.digest,
          valid: validation.valid,
        },
      );
      const result = {
        revision: evolved.state.revision,
        eventId: evolved.event.id,
        draftRevision: input.document.revision,
        valid: validation.valid,
        digest: validation.digest,
        diagnostics: clone(validation.diagnostics),
        status,
      };
      commit(withReceipt(evolved.state, input.idempotencyKey, result));
      return result;
    };

    const approveLesson: CanvasActions["approveLesson"] = (draftRevision) => {
      const current = stateRef.current;
      if (
        !current.lesson.draft ||
        !current.lesson.validation?.valid ||
        current.lesson.draft.revision !== draftRevision
      ) {
        throw new Error("Only the exact compiled lesson revision can be approved.");
      }
      const evolved = appendEvent(
        {
          ...current,
          lesson: {
            ...current.lesson,
            status: "approved",
            approvedDraftRevision: draftRevision,
          },
        },
        "learner",
        "lesson.draft.approved",
        `Approved lesson revision ${draftRevision}.`,
        { draftRevision, digest: current.lesson.validation.digest },
      );
      commit(evolved.state);
      return {
        eventId: evolved.event.id,
        draftRevision,
        digest: current.lesson.validation.digest,
        revision: evolved.state.revision,
      };
    };

    const publishLesson: CanvasActions["publishLesson"] = (input) => {
      const current = stateRef.current;
      const previous = receipt<ReturnType<CanvasActions["publishLesson"]>>(
        current,
        input.idempotencyKey,
      );
      if (previous) return previous;
      requireCanvasRevision(current, input.baseRevision);
      const draft = current.lesson.draft;
      if (
        !draft ||
        !current.lesson.validation?.valid ||
        current.lesson.status !== "approved" ||
        current.lesson.approvedDraftRevision !== input.draftRevision ||
        draft.revision !== input.draftRevision
      ) {
        throw new Error("Publication requires learner approval of this exact compiled revision.");
      }

      const previousById = new Map(current.regions.map((region) => [region.id, region]));
      const regions: CanvasRegion[] = draft.regions.map((region) => ({
        ...clone(region),
        revision: 1,
        status: "ready",
        response: previousById.get(region.id)?.response
          ? clone(previousById.get(region.id)!.response)
          : undefined,
        history: [],
      }));
      const evolved = appendEvent(
        {
          ...current,
          regions,
          focus: { regionId: regions[0]?.id ?? null, selectedText: null },
          lesson: {
            ...current.lesson,
            status: "published",
            publishedRevision: input.draftRevision,
          },
          session: { ...current.session, stage: "learning" },
        },
        "agent",
        "lesson.published",
        `Published “${draft.title}” to the learning canvas.`,
        {
          draftRevision: input.draftRevision,
          digest: current.lesson.validation.digest,
        },
      );
      const result = {
        eventId: evolved.event.id,
        publishedRevision: input.draftRevision,
        canvasRevision: evolved.state.revision,
        regionIds: regions.map((region) => region.id),
      };
      commit(withReceipt(evolved.state, input.idempotencyKey, result));
      return result;
    };

    const focusRegion: CanvasActions["focusRegion"] = (
      regionId,
      selectedText = null,
    ) => {
      const current = stateRef.current;
      if (regionId && !current.regions.some((region) => region.id === regionId)) return;
      const cleanSelection = selectedText?.trim().slice(0, 500) || null;
      if (
        current.focus.regionId === regionId &&
        current.focus.selectedText === cleanSelection
      ) {
        return;
      }
      const next = {
        ...current,
        focus: { regionId, selectedText: cleanSelection },
      };
      stateRef.current = next;
      saveCanvasState(next);
      setState(next);
    };

    const patchRegion: CanvasActions["patchRegion"] = (input) => {
      const current = stateRef.current;
      const previous = receipt<ReturnType<CanvasActions["patchRegion"]>>(
        current,
        input.idempotencyKey,
      );
      if (previous) return previous;
      ensureAgentWritable(current);
      const region = requireRegion(current, input.regionId);
      requireRegionRevision(region, input.baseRegionRevision);
      if (input.operation !== "set_status" && !input.content?.length) {
        throw new Error(`${input.operation} requires at least one trusted content block.`);
      }
      if (input.operation === "set_status" && !input.status) {
        throw new Error("set_status requires a region status.");
      }
      const undoToken = makeId("undo");
      const at = new Date().toISOString();
      let content = clone(region.content);
      if (input.operation === "replace") content = clone(input.content!);
      if (input.operation === "append" || input.operation === "annotate") {
        content = [...content, ...clone(input.content!)];
      }
      const status =
        input.operation === "set_status" ? input.status! : ("updated" as const);
      const nextRegion: CanvasRegion = {
        ...region,
        revision: region.revision + 1,
        status,
        content,
        provenance:
          input.operation === "set_status"
            ? region.provenance
            : [
                ...region.provenance,
                {
                  actor: "agent",
                  label: "Updated by Codex",
                  sourceRefs: input.sourceRefs ?? [],
                  at,
                },
              ],
        history: nextUndoHistory(region, undoToken),
        updatedAt: at,
        updateRationale: input.rationale.trim(),
      };
      const evolved = appendEvent(
        replaceRegion(current, nextRegion),
        "agent",
        "canvas.region.patched",
        input.operation === "set_status"
          ? `Marked “${region.title}” as ${status.replace("_", " ")}.`
          : `Updated “${region.title}” on the learning canvas.`,
        {
          regionId: region.id,
          operation: input.operation,
          regionRevision: nextRegion.revision,
        },
      );
      const result = {
        eventId: evolved.event.id,
        regionId: region.id,
        regionRevision: nextRegion.revision,
        canvasRevision: evolved.state.revision,
        undoToken,
      };
      commit(withReceipt(evolved.state, input.idempotencyKey, result));
      return result;
    };

    const injectWidget: CanvasActions["injectWidget"] = (input) => {
      const current = stateRef.current;
      const previous = receipt<ReturnType<CanvasActions["injectWidget"]>>(
        current,
        input.idempotencyKey,
      );
      if (previous) return previous;
      ensureAgentWritable(current);
      const region = requireRegion(current, input.regionId);
      requireRegionRevision(region, input.baseRegionRevision);
      if (input.widget.html.length > 12_288) throw new Error("Widget HTML exceeds 12 KB.");
      if (input.widget.css.length > 12_288) throw new Error("Widget CSS exceeds 12 KB.");
      if (input.widget.javascript.length > 24_576) {
        throw new Error("Widget JavaScript exceeds 24 KB.");
      }
      if (input.widget.height < 180 || input.widget.height > 720) {
        throw new Error("Widget height must be between 180 and 720 pixels.");
      }

      const undoToken = makeId("undo");
      const at = new Date().toISOString();
      const nextRegion: CanvasRegion = {
        ...region,
        revision: region.revision + 1,
        status: "updated",
        content: [...region.content, clone(input.widget)],
        provenance: [
          ...region.provenance,
          {
            actor: "agent",
            label: "Interactive model added by Codex",
            sourceRefs: [],
            at,
          },
        ],
        history: nextUndoHistory(region, undoToken),
        updatedAt: at,
        updateRationale: input.rationale.trim(),
      };
      const evolved = appendEvent(
        replaceRegion(current, nextRegion),
        "agent",
        "canvas.widget.injected",
        `Added “${input.widget.title}” inside “${region.title}”.`,
        {
          regionId: region.id,
          widgetId: input.widget.widgetId,
          regionRevision: nextRegion.revision,
        },
      );
      const result = {
        eventId: evolved.event.id,
        regionId: region.id,
        regionRevision: nextRegion.revision,
        canvasRevision: evolved.state.revision,
        undoToken,
      };
      commit(withReceipt(evolved.state, input.idempotencyKey, result));
      return result;
    };

    const attachResearch: CanvasActions["attachResearch"] = (input) => {
      const current = stateRef.current;
      const previous = receipt<ReturnType<CanvasActions["attachResearch"]>>(
        current,
        input.idempotencyKey,
      );
      if (previous) return previous;
      ensureAgentWritable(current);
      const region = requireRegion(current, input.regionId);
      requireRegionRevision(region, input.baseRegionRevision);
      if (!input.sources.length || input.sources.length > 8) {
        throw new Error("Research needs one to eight bounded references.");
      }
      for (const source of input.sources) {
        const url = new URL(source.url);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          throw new Error(
            `Research source ${source.id} must use an HTTP(S) canonical URL.`,
          );
        }
      }

      const undoToken = makeId("undo");
      const at = new Date().toISOString();
      const nextRegion: CanvasRegion = {
        ...region,
        revision: region.revision + 1,
        status: "updated",
        content: [
          ...region.content,
          {
            type: "source_cards",
            summary: input.summary.trim(),
            sources: clone(input.sources),
          },
        ],
        provenance: [
          ...region.provenance,
          {
            actor: "agent",
            label: "Research attached by Codex",
            sourceRefs: input.sources.map((source) => source.url),
            at,
          },
        ],
        history: nextUndoHistory(region, undoToken),
        updatedAt: at,
        updateRationale: "Attached bounded, sourced context.",
      };
      const evolved = appendEvent(
        replaceRegion(current, nextRegion),
        "agent",
        "canvas.research.attached",
        `Attached ${input.sources.length} research source${input.sources.length === 1 ? "" : "s"} to “${region.title}”.`,
        { regionId: region.id, sourceIds: input.sources.map((source) => source.id) },
      );
      const result = {
        eventId: evolved.event.id,
        regionId: region.id,
        regionRevision: nextRegion.revision,
        canvasRevision: evolved.state.revision,
        undoToken,
      };
      commit(withReceipt(evolved.state, input.idempotencyKey, result));
      return result;
    };

    const revertRegion: CanvasActions["revertRegion"] = (input) => {
      const current = stateRef.current;
      const previous = receipt<ReturnType<CanvasActions["revertRegion"]>>(
        current,
        input.idempotencyKey,
      );
      if (previous) return previous;
      ensureAgentWritable(current);
      const region = requireRegion(current, input.regionId);
      requireRegionRevision(region, input.baseRegionRevision);
      const historyIndex = region.history.findIndex(
        (entry) => entry.undoToken === input.undoToken,
      );
      if (historyIndex < 0) throw new Error("That undo token is no longer available.");
      const snapshot = region.history[historyIndex]!;
      const nextRegion: CanvasRegion = {
        ...region,
        revision: region.revision + 1,
        status: snapshot.status,
        content: clone(snapshot.content),
        provenance: clone(snapshot.provenance),
        history: region.history.slice(0, historyIndex),
        updatedAt: snapshot.updatedAt,
        updateRationale: snapshot.updateRationale,
      };
      const evolved = appendEvent(
        replaceRegion(current, nextRegion),
        input.actor ?? "learner",
        "canvas.region.reverted",
        `Restored the previous version of “${region.title}”.`,
        { regionId: region.id, restoredFromRevision: snapshot.revision },
      );
      const result = {
        eventId: evolved.event.id,
        regionId: region.id,
        regionRevision: nextRegion.revision,
        canvasRevision: evolved.state.revision,
      };
      commit(withReceipt(evolved.state, input.idempotencyKey, result));
      return result;
    };

    const submitLearnerResponse: CanvasActions["submitLearnerResponse"] = (
      regionId,
      value,
    ) => {
      const current = stateRef.current;
      const region = requireRegion(current, regionId);
      if (!region.interaction) {
        throw new Error("This region does not accept a learner response.");
      }
      if (region.response) throw new Error("Submitted learner evidence is immutable.");
      const cleanValue = value.trim();
      let response: RegionResponse;
      if (region.interaction.type === "choice") {
        const option = region.interaction.options.find((item) => item.id === cleanValue);
        if (!option) throw new Error("Choose one of the provided answers.");
        response = {
          value: option.id,
          correct: option.correct,
          submittedAt: new Date().toISOString(),
        };
      } else {
        if (cleanValue.length < region.interaction.minimumCharacters) {
          throw new Error(
            `Write at least ${region.interaction.minimumCharacters} characters before saving your teach-back.`,
          );
        }
        response = { value: cleanValue, submittedAt: new Date().toISOString() };
      }
      const nextRegion = { ...region, revision: region.revision + 1, response };
      const evolved = appendEvent(
        replaceRegion(current, nextRegion),
        "learner",
        "learner.response.submitted",
        `Saved learner evidence for “${region.title}”.`,
        { regionId, correct: response.correct },
      );
      commit(evolved.state);
      return {
        eventId: evolved.event.id,
        correct: response.correct,
        revision: evolved.state.revision,
      };
    };

    const reset = () => {
      nonceRef.current = null;
      clearCanvasState();
      const initial = createInitialCanvasState();
      stateRef.current = initial;
      setState(initial);
    };

    return {
      getState,
      getNonce,
      beginSession,
      proposeContext,
      reviewContextClaim,
      skipContext,
      prepareLesson,
      approveLesson,
      publishLesson,
      focusRegion,
      patchRegion,
      injectWidget,
      attachResearch,
      revertRegion,
      submitLearnerResponse,
      reset,
    };
  }, [commit]);

  useEffect(() => {
    const workingRegions = state.regions.filter(
      (region) => region.status === "agent_working" && region.updatedAt,
    );
    if (!workingRegions.length) return;
    const timeoutAt = Math.min(
      ...workingRegions.map(
        (region) => new Date(region.updatedAt!).getTime() + 90_000,
      ),
    );
    const timer = window.setTimeout(() => {
      const current = actions.getState();
      const now = Date.now();
      current.regions
        .filter(
          (region) =>
            region.status === "agent_working" &&
            region.updatedAt &&
            now - new Date(region.updatedAt).getTime() >= 90_000,
        )
        .forEach((region) => {
          actions.patchRegion({
            regionId: region.id,
            baseRegionRevision: region.revision,
            idempotencyKey: `agent-timeout-${region.id}-${region.revision}`,
            operation: "set_status",
            status: "ready",
            rationale: "Agent activity timed out cleanly; existing lesson content was preserved.",
          });
        });
    }, Math.max(0, timeoutAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [actions, state.regions]);

  return { state, actions };
}
