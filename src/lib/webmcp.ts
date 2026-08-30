import { asExperienceDocument } from "../domain/compiler";
import type {
  AssetReference,
  ContextClaim,
  ExperiencePatchOperation,
} from "../domain/experience";
import {
  learningExperienceInputSchema,
  type JsonSchema,
} from "../domain/experienceSchema";
import { canvasContract } from "../domain/primitiveRegistry";
import type { CanvasActions } from "../hooks/useLearningCanvas";

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

const emptyInputSchema: JsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

const idempotencySchema = {
  type: "string",
  minLength: 8,
  maxLength: 160,
  description: "Stable key for this exact command and any retry.",
};

function commandSchema(
  required: string[],
  properties: Record<string, unknown>,
): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: [...required, "idempotencyKey"],
    properties: { ...properties, idempotencyKey: idempotencySchema },
  };
}

const operationsSchema = {
  type: "array",
  minItems: 1,
  maxItems: 20,
  items: {
    type: "object",
    required: ["op"],
    properties: {
      op: {
        type: "string",
        enum: [
          "replace_metadata",
          "upsert_node",
          "remove_node",
          "upsert_edge",
          "remove_edge",
          "set_completion",
        ],
      },
    },
  },
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

function requiredInteger(
  object: Record<string, unknown>,
  key: string,
  minimum = 0,
): number {
  const value = object[key];
  if (!Number.isInteger(value) || Number(value) < minimum) {
    throw new Error(`${key} must be an integer of at least ${minimum}.`);
  }
  return Number(value);
}

function idempotencyKey(object: Record<string, unknown>): string {
  return requiredString(object, "idempotencyKey", 8, 160);
}

function reveal(sectionId: string): void {
  window.setTimeout(() => {
    const section = document.getElementById(sectionId);
    if (section instanceof HTMLDetailsElement) section.open = true;
    section?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 0);
}

function parseClaims(input: Record<string, unknown>): ContextClaim[] {
  const rawClaims = input.claims;
  if (!Array.isArray(rawClaims) || rawClaims.length < 1 || rawClaims.length > 6) {
    throw new Error("claims must contain one to six reviewable hypotheses.");
  }
  const kinds: ContextClaim["kind"][] = [
    "stated_goal",
    "current_project",
    "active_research",
    "prior_knowledge",
    "misconception",
    "behaviour_pattern",
    "business_constraint",
    "preference",
    "accessibility",
    "journey_evidence",
  ];
  const sources: ContextClaim["source"][] = [
    "learner",
    "codex_observation",
    "ogram_profile",
    "ogram_pixel",
    "ogram_journey",
  ];
  return rawClaims.map((raw) => {
    const claim = objectInput(raw);
    if (!kinds.includes(claim.kind as ContextClaim["kind"])) {
      throw new Error("Each claim needs a supported kind.");
    }
    if (!sources.includes(claim.source as ContextClaim["source"])) {
      throw new Error("Each claim needs a supported source.");
    }
    if (
      claim.sensitivity !== "low" &&
      claim.sensitivity !== "personal" &&
      claim.sensitivity !== "restricted"
    ) {
      throw new Error("Each claim needs a valid sensitivity.");
    }
    if (
      claim.confidence !== undefined &&
      (typeof claim.confidence !== "number" ||
        claim.confidence < 0 ||
        claim.confidence > 1)
    ) {
      throw new Error("Claim confidence must be between 0 and 1.");
    }
    if (
      !Array.isArray(claim.evidenceRefs) ||
      !claim.evidenceRefs.every((item) => typeof item === "string")
    ) {
      throw new Error("Claim evidenceRefs must contain opaque string ids.");
    }
    if (
      !Array.isArray(claim.allowedPurposes) ||
      claim.allowedPurposes.length < 1 ||
      !claim.allowedPurposes.every((item) => typeof item === "string")
    ) {
      throw new Error("Claim allowedPurposes must contain string ids.");
    }
    return {
      id: requiredString(claim, "id", 4, 120),
      kind: claim.kind as ContextClaim["kind"],
      summary: requiredString(claim, "summary", 12, 320),
      source: claim.source as ContextClaim["source"],
      confidence: claim.confidence as number | undefined,
      sensitivity: claim.sensitivity,
      evidenceRefs: claim.evidenceRefs as string[],
      allowedPurposes: claim.allowedPurposes as string[],
      observedAt:
        typeof claim.observedAt === "string"
          ? claim.observedAt
          : new Date().toISOString(),
      expiresAt:
        typeof claim.expiresAt === "string" ? claim.expiresAt : undefined,
      review: "pending",
    };
  });
}

function parseOperations(value: unknown): ExperiencePatchOperation[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error("operations must contain one to twenty bounded operations.");
  }
  return structuredClone(value) as ExperiencePatchOperation[];
}

function parseAsset(value: unknown): AssetReference {
  const asset = objectInput(value);
  if (asset.kind !== "image" && asset.kind !== "audio" && asset.kind !== "video") {
    throw new Error("asset.kind must be image, audio, or video.");
  }
  const uri = requiredString(asset, "uri", 8, 500);
  if (!uri.startsWith("https://") && !uri.startsWith("ogram-asset://")) {
    throw new Error("asset.uri must use HTTPS or an Ogram asset handle.");
  }
  return {
    id: requiredString(asset, "id", 4, 120),
    kind: asset.kind,
    uri,
    alt: requiredString(asset, "alt", 3, 400),
    caption:
      typeof asset.caption === "string" ? asset.caption.trim() : undefined,
    transcript:
      typeof asset.transcript === "string"
        ? asset.transcript.trim()
        : undefined,
    digest: requiredString(asset, "digest", 8, 180),
    generatedBy:
      typeof asset.generatedBy === "string"
        ? asset.generatedBy.trim()
        : undefined,
  };
}

function publicContext(actions: CanvasActions) {
  const state = actions.getState();
  return {
    revision: state.revision,
    contextSnapshotId: state.contextSnapshotId,
    learningBrief: state.learningBrief,
    claims: state.contextClaims.map((claim) => ({
      ...claim,
      evidenceRefs: claim.evidenceRefs.map(() => "opaque-reference"),
    })),
    consentBoundary: {
      observationsAreHypotheses: true,
      learnerReviewRequired: true,
      rawConversationRequested: false,
      selectedSourceMaterialRequiresSeparateConsent: true,
    },
  };
}

function publicSession(actions: CanvasActions) {
  const state = actions.getState();
  return {
    revision: state.revision,
    published: {
      experienceId: state.activeExperience.experienceId,
      revision: state.activeExperience.draftRevision,
      title: state.activeExperience.metadata.title,
      digest: state.design.validation?.digest,
    },
    design: {
      status: state.design.status,
      draftRevision: state.design.draft?.draftRevision ?? null,
      valid: state.design.validation?.valid ?? null,
      diagnosticCounts: state.design.validation
        ? {
            errors: state.design.validation.diagnostics.filter(
              (item) => item.severity === "error",
            ).length,
            warnings: state.design.validation.diagnostics.filter(
              (item) => item.severity === "warning",
            ).length,
          }
        : null,
      learnerApprovalRecorded: state.design.approvedDraftRevision !== null,
    },
    runtime: {
      status: state.runtime.status,
      currentNodeId: state.runtime.currentNodeId,
      visitedNodeIds: state.runtime.visitedNodeIds,
      responseEvidence: Object.values(state.runtime.responses).map((response) => ({
        nodeId: response.nodeId,
        correct: response.correct,
        confidence: response.confidence,
        assisted: response.assisted,
      })),
    },
    learnerFeedback: state.learnerFeedback,
    ledger: {
      eventCount: state.events.length,
      lastSequence: state.events.at(-1)?.sequence ?? 0,
      orderedOutboxCount: state.sync.orderedOutbox.length,
      recentEvents: state.events.slice(-12).map((event) => ({
        sequence: event.sequence,
        type: event.type,
        actor: event.actor,
        at: event.at,
        summary: event.summary,
      })),
    },
  };
}

export function createOgramLearningTools(
  actions: CanvasActions,
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
    idempotentHint: true,
    openWorldHint: false,
  };

  return [
    {
      name: "ogram_get_canvas_contract",
      description:
        "Start here. Read the generative canvas capabilities, trusted learning primitives, pedagogical limits, human-only actions, workflow, and document schema.",
      inputSchema: emptyInputSchema,
      annotations: readOnly,
      execute: () => ({
        ...canvasContract,
        documentSchema: learningExperienceInputSchema,
        workflow: [
          "Read reviewed context with ogram_get_learning_context.",
          "Optionally propose new hypotheses and wait for learner review.",
          "Compose a complete LearningExperienceDocument from supported primitives.",
          "Create or patch a revisioned draft and validate it.",
          "Repair hard errors; warnings preserve agent judgment.",
          "Request learner review. Only the learner approves the exact digest.",
          "Publish after approval; use session evidence for reviewed adaptations.",
        ],
        essentialWebMcpRole:
          "WebMCP is the live query/command port between agent reasoning and this visible canvas. Ogram remains the compiler, renderer, consent authority, runtime, memory, and ledger.",
      }),
    },
    {
      name: "ogram_get_learning_context",
      description:
        "Read the versioned learning brief and reviewable context claims. Only accepted or corrected claim ids may be used as personalization provenance.",
      inputSchema: emptyInputSchema,
      annotations: readOnly,
      execute: () => publicContext(actions),
    },
    {
      name: "ogram_propose_learning_needs",
      description:
        "Propose privacy-minimized learning-need hypotheses for visible learner review. This never approves a claim and must not contain raw conversations, files, secrets, or reconstructed client content.",
      inputSchema: commandSchema(["baseRevision", "claims"], {
        baseRevision: { type: "integer", minimum: 0 },
        claims: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            required: [
              "id",
              "kind",
              "summary",
              "source",
              "sensitivity",
              "evidenceRefs",
              "allowedPurposes",
            ],
            properties: {
              id: { type: "string", minLength: 4, maxLength: 120 },
              kind: { type: "string" },
              summary: { type: "string", minLength: 12, maxLength: 320 },
              source: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              sensitivity: {
                type: "string",
                enum: ["low", "personal", "restricted"],
              },
              evidenceRefs: { type: "array", items: { type: "string" } },
              allowedPurposes: {
                type: "array",
                minItems: 1,
                items: { type: "string" },
              },
              observedAt: { type: "string" },
              expiresAt: { type: "string" },
            },
            additionalProperties: false,
          },
        },
      }),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.proposeLearningNeeds({
          baseRevision: requiredInteger(object, "baseRevision"),
          idempotencyKey: idempotencyKey(object),
          claims: parseClaims(object),
        });
        reveal("context-dock");
        return {
          ok: true,
          ...result,
          visibleChange: "Pending hypotheses are visible in the context dock.",
          learnerActionRequired: "Accept or reject each claim.",
        };
      },
    },
    {
      name: "ogram_create_experience_draft",
      description:
        "Create a complete agent-authored experience from any supported primitive composition. Objective, content, topology, branching, interaction, feedback, and transfer are all authored—not selected from a lesson recipe.",
      inputSchema: commandSchema(
        ["basePublishedRevision", "document"],
        {
          basePublishedRevision: { type: "integer", minimum: 1 },
          document: learningExperienceInputSchema,
        },
      ),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.createDraft({
          basePublishedRevision: requiredInteger(
            object,
            "basePublishedRevision",
            1,
          ),
          idempotencyKey: idempotencyKey(object),
          document: asExperienceDocument(object.document),
        });
        reveal("compiler-inspector");
        return {
          ok: true,
          ...result,
          nextTool: "ogram_validate_experience",
          visibleChange: "The draft transaction is visible in the inspector.",
        };
      },
    },
    {
      name: "ogram_patch_experience_draft",
      description:
        "Patch the draft using bounded semantic operations. Arbitrary code, executable expressions, HTML, CSS, and JSON-pointer mutation are not accepted.",
      inputSchema: commandSchema(["baseDraftRevision", "operations"], {
        baseDraftRevision: { type: "integer", minimum: 1 },
        operations: operationsSchema,
      }),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.patchDraft({
          baseDraftRevision: requiredInteger(object, "baseDraftRevision", 1),
          idempotencyKey: idempotencyKey(object),
          operations: parseOperations(object.operations),
        });
        reveal("compiler-inspector");
        return { ok: true, ...result, nextTool: "ogram_validate_experience" };
      },
    },
    {
      name: "ogram_validate_experience",
      description:
        "Compile the exact draft against structure, capabilities, learning science policy, privacy, accessibility, governed media, and bounded flow. Hard errors block review.",
      inputSchema: commandSchema(["draftRevision"], {
        draftRevision: { type: "integer", minimum: 1 },
      }),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.validateDraft({
          draftRevision: requiredInteger(object, "draftRevision", 1),
          idempotencyKey: idempotencyKey(object),
        });
        reveal("compiler-inspector");
        return {
          ok: result.valid,
          ...result,
          nextTool: result.valid
            ? "ogram_request_learner_review"
            : "ogram_patch_experience_draft",
        };
      },
    },
    {
      name: "ogram_request_learner_review",
      description:
        "Place the exact compiler-approved draft in visible learner review. This does not approve or publish it; only the learner creates that consent receipt.",
      inputSchema: commandSchema(["draftRevision"], {
        draftRevision: { type: "integer", minimum: 1 },
      }),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.requestDraftReview({
          draftRevision: requiredInteger(object, "draftRevision", 1),
          idempotencyKey: idempotencyKey(object),
        });
        reveal("draft-review");
        return {
          ok: true,
          ...result,
          visibleChange: "The exact revision is awaiting learner approval.",
          humanOnlyAction: "approve this revision",
        };
      },
    },
    {
      name: "ogram_publish_experience",
      description:
        "Publish and start the exact draft only after learner approval. This fails closed when the human receipt is absent, stale, or bound to another digest.",
      inputSchema: commandSchema(["draftRevision"], {
        draftRevision: { type: "integer", minimum: 1 },
      }),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.publishDraft({
          draftRevision: requiredInteger(object, "draftRevision", 1),
          idempotencyKey: idempotencyKey(object),
        });
        reveal("learning-stage");
        return {
          ok: true,
          ...result,
          visibleChange: "The compiled experience is live on the shared canvas.",
          learnerOwnsResponses: true,
        };
      },
    },
    {
      name: "ogram_register_generated_asset",
      description:
        "Attach an image, audio, or video reference to the current draft. WebMCP carries governed metadata—not binary media or embed code. Accessibility is enforced by the compiler.",
      inputSchema: commandSchema(["draftRevision", "asset"], {
        draftRevision: { type: "integer", minimum: 1 },
        asset: {
          type: "object",
          additionalProperties: false,
          required: ["id", "kind", "uri", "alt", "digest"],
          properties: {
            id: { type: "string", minLength: 4, maxLength: 120 },
            kind: { type: "string", enum: ["image", "audio", "video"] },
            uri: { type: "string", minLength: 8, maxLength: 500 },
            alt: { type: "string", minLength: 3, maxLength: 400 },
            caption: { type: "string", maxLength: 400 },
            transcript: { type: "string", maxLength: 8000 },
            digest: { type: "string", minLength: 8, maxLength: 180 },
            generatedBy: { type: "string", maxLength: 120 },
          },
        },
      }),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.registerDraftAsset({
          draftRevision: requiredInteger(object, "draftRevision", 1),
          idempotencyKey: idempotencyKey(object),
          asset: parseAsset(object.asset),
        });
        reveal("compiler-inspector");
        return {
          ok: true,
          ...result,
          nextTool: "ogram_patch_experience_draft",
          note: "Reference the asset id from media.explainer, then validate the new revision.",
        };
      },
    },
    {
      name: "ogram_get_learning_session",
      description:
        "Read the design transaction, published revision, privacy-minimized learner evidence, feedback, and append-only ledger cursor. Raw free-text responses are never returned.",
      inputSchema: emptyInputSchema,
      annotations: readOnly,
      execute: () => publicSession(actions),
    },
    {
      name: "ogram_propose_adaptation",
      description:
        "Propose a bounded revision from the published experience using feedback or response evidence. It is compiled and still requires learner review; completed history is immutable.",
      inputSchema: commandSchema(
        ["basePublishedRevision", "rationale", "operations"],
        {
          basePublishedRevision: { type: "integer", minimum: 1 },
          rationale: { type: "string", minLength: 12, maxLength: 360 },
          operations: operationsSchema,
        },
      ),
      annotations: write,
      execute: (input) => {
        const object = objectInput(input);
        const result = actions.proposeAdaptation({
          basePublishedRevision: requiredInteger(
            object,
            "basePublishedRevision",
            1,
          ),
          idempotencyKey: idempotencyKey(object),
          rationale: requiredString(object, "rationale", 12, 360),
          operations: parseOperations(object.operations),
        });
        reveal(result.valid ? "draft-review" : "compiler-inspector");
        return {
          ok: result.valid,
          ...result,
          learnerReviewRequired: true,
          historyRewritten: false,
        };
      },
    },
  ];
}

export async function registerOgramLearningTools(
  actions: CanvasActions,
): Promise<WebMcpRegistration> {
  const tools = createOgramLearningTools(actions);
  window.__OGRAM_WEBMCP_TOOLS__ = Object.fromEntries(
    tools.map((tool) => [tool.name, tool]),
  );

  const controller = new AbortController();
  const supported = typeof document.modelContext?.registerTool === "function";
  if (supported) {
    await Promise.allSettled(
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
