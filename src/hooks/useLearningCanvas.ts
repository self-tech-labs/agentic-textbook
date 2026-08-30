import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyExperiencePatches,
  asExperienceDocument,
  compileExperience,
  experienceDigest,
} from "../domain/compiler";
import type {
  AssetReference,
  CanvasEvent,
  CanvasEventActor,
  CanvasEventType,
  CompileResult,
  ContextClaim,
  ExperiencePatchOperation,
  LearningCanvasState,
  LearningExperienceDocument,
} from "../domain/experience";
import {
  decisionLabExperience,
  fixtureContextClaims,
  fixtureContextSnapshotId,
  fixtureLearningBrief,
} from "../domain/fixtures";
import {
  advanceRuntime,
  createRuntimeState,
  submitRuntimeResponse,
} from "../domain/runtime";
import {
  clearCanvasState,
  loadCanvasState,
  saveCanvasState,
} from "../lib/canvasPersistence";

function makeId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function addEvent(
  state: LearningCanvasState,
  actor: CanvasEventActor,
  type: CanvasEventType,
  summary: string,
  payload: Record<string, unknown> | undefined,
  idempotencyKey: string,
  now = new Date(),
  experience: LearningExperienceDocument = state.activeExperience,
): LearningCanvasState {
  const revision = state.revision + 1;
  const event: CanvasEvent = {
    id: makeId("event"),
    sequence: state.events.length + 1,
    revision,
    idempotencyKey,
    type,
    actor,
    at: now.toISOString(),
    summary,
    experienceId: experience.experienceId,
    experienceRevision: experience.draftRevision,
    payload,
  };
  return {
    ...state,
    revision,
    events: [...state.events, event],
    sync: {
      ...state.sync,
      status: "queued",
      orderedOutbox: [...state.sync.orderedOutbox, event.id],
    },
  };
}

function lastEvent(state: LearningCanvasState): CanvasEvent {
  const event = state.events.at(-1);
  if (!event) throw new Error("The event ledger is unexpectedly empty.");
  return event;
}

function acceptedClaimIds(state: LearningCanvasState): string[] {
  return state.contextClaims
    .filter(
      (claim) => claim.review === "accepted" || claim.review === "corrected",
    )
    .map((claim) => claim.id);
}

function commandResult<Result extends Record<string, unknown>>(
  state: LearningCanvasState,
  idempotencyKey: string,
): Result | null {
  const receipt = state.commandReceipts.find(
    (candidate) => candidate.key === idempotencyKey,
  );
  return receipt ? (receipt.result as Result) : null;
}

function addCommandReceipt<Result extends Record<string, unknown>>(
  state: LearningCanvasState,
  key: string,
  result: Result,
): LearningCanvasState {
  return {
    ...state,
    commandReceipts: [...state.commandReceipts, { key, result }],
  };
}

export function createInitialCanvasState(now = new Date()): LearningCanvasState {
  const activeExperience = structuredClone(decisionLabExperience);
  const validation = compileExperience(
    activeExperience,
    fixtureLearningBrief.approvedClaimIds,
    now,
  );
  if (!validation.valid) {
    throw new Error("The bundled experience fixture did not compile.");
  }

  let state: LearningCanvasState = {
    version: 2,
    revision: 0,
    contextSnapshotId: fixtureContextSnapshotId,
    contextClaims: structuredClone(fixtureContextClaims),
    learningBrief: structuredClone(fixtureLearningBrief),
    activeExperience,
    publishedRevisions: [structuredClone(activeExperience)],
    design: {
      status: "published",
      draft: null,
      validation,
      approvedDraftRevision: null,
    },
    runtime: createRuntimeState(activeExperience, now),
    events: [],
    consentReceipts: [
      {
        id: "consent-context-demo-01",
        type: "context_use",
        actor: "learner",
        at: now.toISOString(),
        subjectIds: fixtureLearningBrief.approvedClaimIds,
        purpose: "Compose and run this local learning experience.",
        digest: "demo-context-consent",
      },
    ],
    commandReceipts: [],
    learnerFeedback: null,
    sync: { status: "local", orderedOutbox: [] },
  };

  state = addEvent(
    state,
    "ogram",
    "context.snapshot.loaded",
    "Loaded four learner-reviewed context claims.",
    { approvedClaimCount: fixtureLearningBrief.approvedClaimIds.length },
    "initial-context",
    now,
  );
  state = addEvent(
    state,
    "ogram",
    "design.experience.published",
    `Published “${activeExperience.metadata.title}” after compiler approval.`,
    { digest: validation.digest, source: "bundled-fixture" },
    "initial-publish",
    now,
  );
  state = addEvent(
    state,
    "learner",
    "runtime.started",
    "Started the published learning experience.",
    { entryNodeId: activeExperience.entryNodeId },
    "initial-runtime",
    now,
  );
  return { ...state, sync: { status: "local", orderedOutbox: [] } };
}

export interface CanvasActions {
  getState: () => LearningCanvasState;
  reset: () => void;
  proposeLearningNeeds: (input: {
    baseRevision: number;
    idempotencyKey: string;
    claims: ContextClaim[];
  }) => { revision: number; eventId: string; proposedClaimIds: string[] };
  reviewContextClaim: (
    claimId: string,
    decision: "accepted" | "rejected",
  ) => { eventId: string; claimId: string; decision: string };
  createDraft: (input: {
    basePublishedRevision: number;
    idempotencyKey: string;
    document: LearningExperienceDocument;
  }) => { eventId: string; experienceId: string; draftRevision: number };
  patchDraft: (input: {
    baseDraftRevision: number;
    idempotencyKey: string;
    operations: ExperiencePatchOperation[];
  }) => { eventId: string; draftRevision: number; operationCount: number };
  validateDraft: (input: {
    draftRevision: number;
    idempotencyKey: string;
  }) => {
    eventId: string;
    draftRevision: number;
    valid: boolean;
    digest: string;
    diagnostics: CompileResult["diagnostics"];
  };
  requestDraftReview: (input: {
    draftRevision: number;
    idempotencyKey: string;
  }) => { eventId: string; draftRevision: number; status: "awaiting_review" };
  approveDraft: (draftRevision: number) => {
    eventId: string;
    receiptId: string;
    draftRevision: number;
  };
  publishDraft: (input: {
    draftRevision: number;
    idempotencyKey: string;
  }) => {
    eventId: string;
    experienceId: string;
    publishedRevision: number;
    digest: string;
  };
  registerDraftAsset: (input: {
    draftRevision: number;
    idempotencyKey: string;
    asset: AssetReference;
  }) => { eventId: string; assetId: string; draftRevision: number };
  proposeAdaptation: (input: {
    basePublishedRevision: number;
    idempotencyKey: string;
    rationale: string;
    operations: ExperiencePatchOperation[];
  }) => {
    eventId: string;
    draftRevision: number;
    valid: boolean;
    status: "awaiting_review" | "validation_failed";
  };
  submitLearnerResponse: (
    nodeId: string,
    value: unknown,
    confidence?: number,
  ) => { eventId: string; correct?: boolean };
  advance: () => { eventId: string; status: string; currentNodeId: string | null };
  submitLearnerFeedback: (
    level: "too_easy" | "right_level" | "too_hard",
    note?: string,
  ) => { eventId: string };
}

export function useLearningCanvas(): {
  state: LearningCanvasState;
  actions: CanvasActions;
} {
  const [state, setState] = useState<LearningCanvasState>(
    () => loadCanvasState() ?? createInitialCanvasState(),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    saveCanvasState(state);
  }, [state]);

  const commit = useCallback(
    <Result,>(operation: (current: LearningCanvasState) => [LearningCanvasState, Result]): Result => {
      const [next, result] = operation(stateRef.current);
      stateRef.current = next;
      setState(next);
      return result;
    },
    [],
  );

  const getState = useCallback(() => stateRef.current, []);

  const reset = useCallback(() => {
    clearCanvasState();
    const next = createInitialCanvasState();
    stateRef.current = next;
    setState(next);
  }, []);

  const proposeLearningNeeds = useCallback<CanvasActions["proposeLearningNeeds"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["proposeLearningNeeds"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        if (input.baseRevision !== current.revision) {
          throw new Error(
            `Revision conflict: context is at ${current.revision}, not ${input.baseRevision}.`,
          );
        }
        if (input.claims.length < 1 || input.claims.length > 6) {
          throw new Error("Propose between one and six context claims.");
        }
        const incoming = input.claims.map((claim) => {
          if (claim.summary.trim().length < 12 || claim.summary.length > 320) {
            throw new Error("Each claim summary must contain 12–320 characters.");
          }
          if (current.contextClaims.some((candidate) => candidate.id === claim.id)) {
            throw new Error(`Context claim id already exists: ${claim.id}.`);
          }
          return { ...structuredClone(claim), review: "pending" as const };
        });
        let next: LearningCanvasState = {
          ...current,
          contextClaims: [...current.contextClaims, ...incoming],
        };
        next = addEvent(
          next,
          "agent",
          "context.claim.proposed",
          `Proposed ${incoming.length} context hypothesis${incoming.length === 1 ? "" : "es"} for learner review.`,
          { claimIds: incoming.map((claim) => claim.id) },
          input.idempotencyKey,
        );
        const result = {
          revision: next.revision,
          eventId: lastEvent(next).id,
          proposedClaimIds: incoming.map((claim) => claim.id),
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const reviewContextClaim = useCallback<CanvasActions["reviewContextClaim"]>(
    (claimId, decision) =>
      commit((current) => {
        const claim = current.contextClaims.find((candidate) => candidate.id === claimId);
        if (!claim) throw new Error("Unknown context claim.");
        if (claim.review !== "pending") {
          throw new Error("Only a pending context claim can be reviewed.");
        }
        const contextClaims = current.contextClaims.map((candidate) =>
          candidate.id === claimId ? { ...candidate, review: decision } : candidate,
        );
        const approvedClaimIds = contextClaims
          .filter((candidate) => candidate.review === "accepted" || candidate.review === "corrected")
          .map((candidate) => candidate.id);
        let next: LearningCanvasState = {
          ...current,
          contextClaims,
          learningBrief: {
            ...current.learningBrief,
            version: current.learningBrief.version + 1,
            approvedClaimIds,
          },
        };
        const key = `human-context-${claimId}-${Date.now()}`;
        next = addEvent(
          next,
          "learner",
          "context.claim.reviewed",
          `${decision === "accepted" ? "Accepted" : "Rejected"} an agent-proposed context claim.`,
          { claimId, decision },
          key,
        );
        return [next, { eventId: lastEvent(next).id, claimId, decision }];
      }),
    [commit],
  );

  const createDraft = useCallback<CanvasActions["createDraft"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["createDraft"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        if (input.basePublishedRevision !== current.activeExperience.draftRevision) {
          throw new Error(
            `Published revision conflict: expected ${current.activeExperience.draftRevision}.`,
          );
        }
        const document = asExperienceDocument(input.document);
        if (document.draftRevision !== input.basePublishedRevision + 1) {
          throw new Error("A new draft revision must be exactly one after the published revision.");
        }
        if (
          document.contextSnapshotId !== current.contextSnapshotId ||
          document.learningBriefId !== current.learningBrief.id
        ) {
          throw new Error("The draft must bind to the active context snapshot and learning brief.");
        }
        let next: LearningCanvasState = {
          ...current,
          design: {
            status: "drafting",
            draft: document,
            validation: null,
            approvedDraftRevision: null,
          },
        };
        next = addEvent(
          next,
          "agent",
          "design.draft.created",
          `Composed draft revision ${document.draftRevision} with ${document.nodes.length} learning nodes.`,
          { nodeCount: document.nodes.length, objectiveCount: document.objectives.length },
          input.idempotencyKey,
          new Date(),
          document,
        );
        const result = {
          eventId: lastEvent(next).id,
          experienceId: document.experienceId,
          draftRevision: document.draftRevision,
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const patchDraft = useCallback<CanvasActions["patchDraft"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["patchDraft"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        const draft = current.design.draft;
        if (!draft || draft.draftRevision !== input.baseDraftRevision) {
          throw new Error("Draft revision conflict. Read the current session before patching.");
        }
        const patched = applyExperiencePatches(draft, input.operations);
        patched.draftRevision = input.baseDraftRevision + 1;
        let next: LearningCanvasState = {
          ...current,
          design: {
            status: "drafting",
            draft: patched,
            validation: null,
            approvedDraftRevision: null,
          },
        };
        next = addEvent(
          next,
          "agent",
          "design.draft.patched",
          `Applied ${input.operations.length} bounded design operation${input.operations.length === 1 ? "" : "s"}.`,
          { operationCount: input.operations.length },
          input.idempotencyKey,
          new Date(),
          patched,
        );
        const result = {
          eventId: lastEvent(next).id,
          draftRevision: patched.draftRevision,
          operationCount: input.operations.length,
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const validateDraft = useCallback<CanvasActions["validateDraft"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["validateDraft"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        const draft = current.design.draft;
        if (!draft || draft.draftRevision !== input.draftRevision) {
          throw new Error("Draft revision conflict. Validate the current draft revision.");
        }
        const validation = compileExperience(draft, acceptedClaimIds(current));
        let next: LearningCanvasState = {
          ...current,
          design: {
            ...current.design,
            status: validation.valid ? "drafting" : "validation_failed",
            validation,
            approvedDraftRevision: null,
          },
        };
        next = addEvent(
          next,
          "ogram",
          "design.draft.validated",
          validation.valid
            ? `Compiler accepted revision ${draft.draftRevision}.`
            : `Compiler rejected revision ${draft.draftRevision} with ${validation.diagnostics.filter((item) => item.severity === "error").length} hard error(s).`,
          {
            valid: validation.valid,
            digest: validation.digest,
            errorCount: validation.diagnostics.filter((item) => item.severity === "error").length,
            warningCount: validation.diagnostics.filter((item) => item.severity === "warning").length,
          },
          input.idempotencyKey,
          new Date(),
          draft,
        );
        const result = {
          eventId: lastEvent(next).id,
          draftRevision: draft.draftRevision,
          valid: validation.valid,
          digest: validation.digest,
          diagnostics: validation.diagnostics,
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const requestDraftReview = useCallback<CanvasActions["requestDraftReview"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["requestDraftReview"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        const draft = current.design.draft;
        if (!draft || draft.draftRevision !== input.draftRevision) {
          throw new Error("Draft revision conflict. Request review for the current draft.");
        }
        const validation = current.design.validation;
        if (
          !validation?.valid ||
          validation.digest !== experienceDigest(draft)
        ) {
          throw new Error("The exact draft revision must pass the compiler before review.");
        }
        const requestedAt = new Date();
        let next: LearningCanvasState = {
          ...current,
          design: {
            ...current.design,
            status: "awaiting_review",
            reviewRequestedAt: requestedAt.toISOString(),
          },
        };
        next = addEvent(
          next,
          "agent",
          "design.review.requested",
          `Requested learner review for “${draft.metadata.title}”.`,
          { digest: validation.digest },
          input.idempotencyKey,
          requestedAt,
          draft,
        );
        const result = {
          eventId: lastEvent(next).id,
          draftRevision: draft.draftRevision,
          status: "awaiting_review" as const,
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const approveDraft = useCallback<CanvasActions["approveDraft"]>(
    (draftRevision) =>
      commit((current) => {
        const draft = current.design.draft;
        const validation = current.design.validation;
        if (
          current.design.status !== "awaiting_review" ||
          !draft ||
          draft.draftRevision !== draftRevision ||
          !validation?.valid ||
          validation.digest !== experienceDigest(draft)
        ) {
          throw new Error("Only the exact, compiled revision awaiting review can be approved.");
        }
        const receiptId = makeId("consent");
        const now = new Date();
        let next: LearningCanvasState = {
          ...current,
          design: {
            ...current.design,
            status: "approved",
            approvedDraftRevision: draftRevision,
          },
          consentReceipts: [
            ...current.consentReceipts,
            {
              id: receiptId,
              type: "experience_publication",
              actor: "learner",
              at: now.toISOString(),
              subjectIds: [draft.experienceId, String(draftRevision)],
              purpose: "Publish and run this exact compiled experience revision.",
              digest: validation.digest,
            },
          ],
        };
        next = addEvent(
          next,
          "learner",
          "design.review.approved",
          `Approved exact revision ${draftRevision} for publication.`,
          { receiptId, digest: validation.digest },
          `human-approve-${receiptId}`,
          now,
          draft,
        );
        return [
          next,
          { eventId: lastEvent(next).id, receiptId, draftRevision },
        ];
      }),
    [commit],
  );

  const publishDraft = useCallback<CanvasActions["publishDraft"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["publishDraft"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        const draft = current.design.draft;
        if (
          !draft ||
          draft.draftRevision !== input.draftRevision ||
          current.design.status !== "approved" ||
          current.design.approvedDraftRevision !== input.draftRevision
        ) {
          throw new Error("Learner approval for this exact revision is required before publication.");
        }
        const validation = compileExperience(draft, acceptedClaimIds(current));
        if (!validation.valid) {
          throw new Error("The approved draft no longer passes the compiler.");
        }
        const runtime = createRuntimeState(draft);
        let next: LearningCanvasState = {
          ...current,
          activeExperience: structuredClone(draft),
          publishedRevisions: [
            ...current.publishedRevisions,
            structuredClone(draft),
          ],
          runtime,
          design: {
            status: "published",
            draft: null,
            validation,
            approvedDraftRevision: null,
          },
          learnerFeedback: null,
        };
        next = addEvent(
          next,
          "ogram",
          "design.experience.published",
          `Published “${draft.metadata.title}” revision ${draft.draftRevision}.`,
          { digest: validation.digest },
          input.idempotencyKey,
          new Date(),
          draft,
        );
        const publishedEventId = lastEvent(next).id;
        next = addEvent(
          next,
          "learner",
          "runtime.started",
          "Started the newly published experience.",
          { entryNodeId: draft.entryNodeId },
          `${input.idempotencyKey}:runtime`,
          new Date(),
          draft,
        );
        const result = {
          eventId: publishedEventId,
          experienceId: draft.experienceId,
          publishedRevision: draft.draftRevision,
          digest: validation.digest,
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const registerDraftAsset = useCallback<CanvasActions["registerDraftAsset"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["registerDraftAsset"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        const draft = current.design.draft;
        if (!draft || draft.draftRevision !== input.draftRevision) {
          throw new Error("Register the asset against the current draft revision.");
        }
        if (draft.assets.some((asset) => asset.id === input.asset.id)) {
          throw new Error(`Asset id already exists: ${input.asset.id}.`);
        }
        const nextDraft = {
          ...draft,
          draftRevision: draft.draftRevision + 1,
          assets: [...draft.assets, structuredClone(input.asset)],
        };
        let next: LearningCanvasState = {
          ...current,
          design: {
            status: "drafting",
            draft: nextDraft,
            validation: null,
            approvedDraftRevision: null,
          },
        };
        next = addEvent(
          next,
          "agent",
          "design.asset.registered",
          `Registered governed ${input.asset.kind} asset “${input.asset.id}”.`,
          { assetId: input.asset.id, kind: input.asset.kind, digest: input.asset.digest },
          input.idempotencyKey,
          new Date(),
          nextDraft,
        );
        const result = {
          eventId: lastEvent(next).id,
          assetId: input.asset.id,
          draftRevision: nextDraft.draftRevision,
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const proposeAdaptation = useCallback<CanvasActions["proposeAdaptation"]>(
    (input) =>
      commit((current) => {
        const existing = commandResult<ReturnType<CanvasActions["proposeAdaptation"]>>(
          current,
          input.idempotencyKey,
        );
        if (existing) return [current, existing];
        if (input.basePublishedRevision !== current.activeExperience.draftRevision) {
          throw new Error("Adaptation must start from the currently published revision.");
        }
        if (input.rationale.trim().length < 12 || input.rationale.length > 360) {
          throw new Error("Adaptation rationale must contain 12–360 characters.");
        }
        let draft = applyExperiencePatches(current.activeExperience, input.operations);
        draft = { ...draft, draftRevision: input.basePublishedRevision + 1 };
        const validation = compileExperience(draft, acceptedClaimIds(current));
        const status: "awaiting_review" | "validation_failed" = validation.valid
          ? "awaiting_review"
          : "validation_failed";
        let next: LearningCanvasState = {
          ...current,
          design: {
            status,
            draft,
            validation,
            approvedDraftRevision: null,
            reviewRequestedAt: validation.valid ? new Date().toISOString() : undefined,
          },
        };
        next = addEvent(
          next,
          "agent",
          "adaptation.proposed",
          `Proposed learner-reviewed adaptation revision ${draft.draftRevision}.`,
          { rationale: input.rationale, operationCount: input.operations.length, valid: validation.valid },
          input.idempotencyKey,
          new Date(),
          draft,
        );
        const result = {
          eventId: lastEvent(next).id,
          draftRevision: draft.draftRevision,
          valid: validation.valid,
          status,
        };
        return [addCommandReceipt(next, input.idempotencyKey, result), result];
      }),
    [commit],
  );

  const submitLearnerResponse = useCallback<CanvasActions["submitLearnerResponse"]>(
    (nodeId, value, confidence) =>
      commit((current) => {
        const submitted = submitRuntimeResponse(
          current.activeExperience,
          current.runtime,
          nodeId,
          value,
          confidence,
        );
        let next: LearningCanvasState = { ...current, runtime: submitted.runtime };
        const key = `human-response-${makeId(nodeId)}`;
        next = addEvent(
          next,
          "learner",
          "runtime.response.submitted",
          `Submitted an unassisted response to ${nodeId}.`,
          {
            nodeId,
            correct: submitted.response.correct,
            confidence,
            responseKind: typeof value,
          },
          key,
        );
        const responseEventId = lastEvent(next).id;
        if (submitted.response.correct !== undefined) {
          next = addEvent(
            next,
            "ogram",
            "runtime.feedback.presented",
            "Presented explanatory feedback after the learner attempt.",
            { nodeId, correct: submitted.response.correct },
            `${key}:feedback`,
          );
        }
        return [next, { eventId: responseEventId, correct: submitted.response.correct }];
      }),
    [commit],
  );

  const advance = useCallback<CanvasActions["advance"]>(
    () =>
      commit((current) => {
        const runtime = advanceRuntime(current.activeExperience, current.runtime);
        let next: LearningCanvasState = { ...current, runtime };
        const key = `human-advance-${makeId("node")}`;
        if (runtime.status === "completed") {
          next = addEvent(
            next,
            "learner",
            "runtime.completed",
            "Completed the experience with the required learner-generated evidence.",
            {
              responseCount: Object.keys(runtime.responses).length,
              masteryClaimed: false,
              delayedTransferStillRequired: true,
            },
            key,
          );
        } else {
          next = addEvent(
            next,
            "learner",
            "runtime.node.entered",
            `Entered learning node ${runtime.currentNodeId}.`,
            { nodeId: runtime.currentNodeId },
            key,
          );
        }
        return [
          next,
          {
            eventId: lastEvent(next).id,
            status: runtime.status,
            currentNodeId: runtime.currentNodeId,
          },
        ];
      }),
    [commit],
  );

  const submitLearnerFeedback = useCallback<CanvasActions["submitLearnerFeedback"]>(
    (level, note) =>
      commit((current) => {
        const submittedAt = new Date().toISOString();
        let next: LearningCanvasState = {
          ...current,
          learnerFeedback: {
            level,
            note: note?.trim() || undefined,
            submittedAt,
          },
        };
        next = addEvent(
          next,
          "learner",
          "learner.feedback.submitted",
          `Marked the experience ${level.replace("_", " ")}.`,
          { level, noteLength: note?.trim().length ?? 0 },
          `human-feedback-${makeId("feedback")}`,
        );
        return [next, { eventId: lastEvent(next).id }];
      }),
    [commit],
  );

  const actions = useMemo<CanvasActions>(
    () => ({
      getState,
      reset,
      proposeLearningNeeds,
      reviewContextClaim,
      createDraft,
      patchDraft,
      validateDraft,
      requestDraftReview,
      approveDraft,
      publishDraft,
      registerDraftAsset,
      proposeAdaptation,
      submitLearnerResponse,
      advance,
      submitLearnerFeedback,
    }),
    [
      advance,
      approveDraft,
      createDraft,
      getState,
      patchDraft,
      proposeAdaptation,
      proposeLearningNeeds,
      publishDraft,
      registerDraftAsset,
      requestDraftReview,
      reset,
      reviewContextClaim,
      submitLearnerFeedback,
      submitLearnerResponse,
      validateDraft,
    ],
  );

  return { state, actions };
}
