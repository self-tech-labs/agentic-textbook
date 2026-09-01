import type {
  CanvasRegionStatus,
  ContextClaimKind,
  ContextDiscoveryScope,
  ContextSource,
  LearnerContextClaim,
  LearnerInteraction,
  LessonDocumentV3,
  LessonRegion,
  LearningSessionStage,
  RegionContent,
  ResearchReference,
  TrustedPatchContent,
} from "../domain/agentCanvas";
import { transformerLessonFixture } from "../domain/transformerFixture";
import type { JsonSchema } from "../domain/experienceSchema";
import type { CanvasActions } from "../hooks/useLearningCanvas";

export const contextDiscoveryPolicy = {
  retrievalOwner: "codex_host" as const,
  guidance:
    "A short current chat is not evidence that no useful context exists. After explicit learner consent, inspect relevant accessible past Codex tasks, conversations, and saved-project history before proposing minimized claims.",
  scopes: [
    {
      id: "current_conversation",
      label: "This conversation",
      route: "conversation",
    },
    {
      id: "codex_history",
      label: "Past Codex tasks and conversations",
      route: "codex_history",
    },
    {
      id: "project_history",
      label: "Saved-project task history",
      route: "project_history",
    },
    {
      id: "ogram_profile",
      label: "Ogram learner context",
      route: "ogram",
    },
    {
      id: "connected_sources",
      label: "Connected sources",
      route: "connected_mcp",
    },
  ],
  minimization:
    "Only a short claim, provider label, resource type, purpose, sensitivity, and opaque evidence reference may enter the canvas.",
} as const;

export const canvasVisualOutputPolicy = {
  destination: "webmcp_canvas_only" as const,
  conversationOutput: "text_coordination_only" as const,
  guidance:
    "Do not create or render a separate inline visualization, widget, or host visualization artifact in the Codex conversation. Read the canvas snapshot and author the visual directly in its target region with trusted content or learn_inject_widget.",
  widgetContract:
    "Widget HTML is a responsive body fragment. The canvas already supplies the title, sandbox label, Reset, Stop, and text-alternative chrome; do not duplicate them inside the widget.",
} as const;

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

const nonceSchema = {
  type: "string",
  minLength: 12,
  maxLength: 200,
  description: "In-memory nonce returned by learn_begin_session.",
};

const idempotencySchema = {
  type: "string",
  minLength: 8,
  maxLength: 160,
  description: "Stable key for this exact write and any retry.",
};

const researchReferenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "url", "publisher", "claim"],
  properties: {
    id: { type: "string", minLength: 2, maxLength: 120 },
    title: { type: "string", minLength: 3, maxLength: 240 },
    url: { type: "string", minLength: 10, maxLength: 1000 },
    publisher: { type: "string", minLength: 2, maxLength: 160 },
    publishedAt: { type: "string", maxLength: 80 },
    claim: { type: "string", minLength: 8, maxLength: 500 },
  },
};

const trustedContentSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "text"],
      properties: {
        type: { const: "prose" },
        heading: { type: "string", maxLength: 120 },
        text: { type: "string", minLength: 4, maxLength: 3000 },
        emphasis: { type: "string", maxLength: 600 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "items"],
      properties: {
        type: { const: "key_points" },
        items: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { type: "string", minLength: 2, maxLength: 400 },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "tokens", "caption"],
      properties: {
        type: { const: "token_sequence" },
        tokens: {
          type: "array",
          minItems: 2,
          maxItems: 16,
          items: { type: "string", minLength: 1, maxLength: 60 },
        },
        caption: { type: "string", minLength: 4, maxLength: 600 },
        highlightedIndex: { type: "integer", minimum: 0 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "tokens", "focusIndex", "weights", "explanation"],
      properties: {
        type: { const: "attention_map" },
        tokens: {
          type: "array",
          minItems: 2,
          maxItems: 12,
          items: { type: "string", minLength: 1, maxLength: 60 },
        },
        focusIndex: { type: "integer", minimum: 0 },
        weights: {
          type: "array",
          minItems: 2,
          maxItems: 12,
          items: { type: "number", minimum: 0, maximum: 1 },
        },
        explanation: { type: "string", minLength: 8, maxLength: 800 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "stages", "caption"],
      properties: {
        type: { const: "transformer_stack" },
        stages: {
          type: "array",
          minItems: 2,
          maxItems: 10,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "detail"],
            properties: {
              label: { type: "string", minLength: 1, maxLength: 100 },
              detail: { type: "string", minLength: 2, maxLength: 300 },
            },
          },
        },
        caption: { type: "string", minLength: 4, maxLength: 600 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "leftLabel", "rightLabel", "rows"],
      properties: {
        type: { const: "comparison" },
        leftLabel: { type: "string", minLength: 1, maxLength: 100 },
        rightLabel: { type: "string", minLength: 1, maxLength: 100 },
        rows: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "left", "right"],
            properties: {
              label: { type: "string", minLength: 1, maxLength: 100 },
              left: { type: "string", minLength: 1, maxLength: 400 },
              right: { type: "string", minLength: 1, maxLength: 400 },
            },
          },
        },
      },
    },
  ],
};

function objectInput(value: unknown, label = "Tool input"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(
  object: Record<string, unknown>,
  key: string,
  min = 1,
  max = 1000,
): string {
  const value = object[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) {
    throw new Error(`${key} must contain ${min}–${max} characters.`);
  }
  return clean;
}

function optionalString(
  object: Record<string, unknown>,
  key: string,
  max = 1000,
): string | undefined {
  if (object[key] === undefined) return undefined;
  return stringValue(object, key, 1, max);
}

function integerValue(
  object: Record<string, unknown>,
  key: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = object[key];
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}.`);
  }
  return Number(value);
}

function stringArray(
  object: Record<string, unknown>,
  key: string,
  maximum = 20,
): string[] {
  const value = object[key];
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${key} must be an array with at most ${maximum} items.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${key}[${index}] must be a non-empty string.`);
    }
    return item.trim();
  });
}

function enumArray<Value extends string>(
  object: Record<string, unknown>,
  key: string,
  values: readonly Value[],
  maximum = 20,
): Value[] {
  return stringArray(object, key, maximum).map((value, index) => {
    if (!values.includes(value as Value)) {
      throw new Error(`${key}[${index}] must be one of: ${values.join(", ")}.`);
    }
    return value as Value;
  });
}

function enumValue<Value extends string>(
  object: Record<string, unknown>,
  key: string,
  values: readonly Value[],
): Value {
  const value = object[key];
  if (typeof value !== "string" || !values.includes(value as Value)) {
    throw new Error(`${key} must be one of: ${values.join(", ")}.`);
  }
  return value as Value;
}

function requireNonce(
  object: Record<string, unknown>,
  actions: CanvasActions,
): void {
  const supplied = stringValue(object, "nonce", 12, 200);
  const active = actions.getNonce();
  if (!active || supplied !== active) {
    throw new Error("The session nonce is missing or expired. Call learn_begin_session first.");
  }
}

function parseReference(value: unknown): ResearchReference {
  const item = objectInput(value, "Research reference");
  const result: ResearchReference = {
    id: stringValue(item, "id", 2, 120),
    title: stringValue(item, "title", 3, 240),
    url: stringValue(item, "url", 10, 1000),
    publisher: stringValue(item, "publisher", 2, 160),
    claim: stringValue(item, "claim", 8, 500),
  };
  const publishedAt = optionalString(item, "publishedAt", 80);
  if (publishedAt) result.publishedAt = publishedAt;
  return result;
}

function numberArray(object: Record<string, unknown>, key: string): number[] {
  const value = object[key];
  if (!Array.isArray(value) || !value.length) throw new Error(`${key} must be a non-empty array.`);
  return value.map((item, index) => {
    if (typeof item !== "number" || !Number.isFinite(item) || item < 0 || item > 1) {
      throw new Error(`${key}[${index}] must be a number between 0 and 1.`);
    }
    return item;
  });
}

function parseTrustedContent(value: unknown): TrustedPatchContent {
  const item = objectInput(value, "Content block");
  const type = stringValue(item, "type", 2, 40);
  if (type === "prose") {
    const block: Extract<RegionContent, { type: "prose" }> = {
      type,
      text: stringValue(item, "text", 4, 3000),
    };
    const heading = optionalString(item, "heading", 120);
    const emphasis = optionalString(item, "emphasis", 600);
    if (heading) block.heading = heading;
    if (emphasis) block.emphasis = emphasis;
    return block;
  }
  if (type === "key_points") {
    const items = stringArray(item, "items", 8);
    if (!items.length) throw new Error("key_points needs at least one item.");
    return { type, items };
  }
  if (type === "token_sequence") {
    const tokens = stringArray(item, "tokens", 16);
    if (tokens.length < 2) throw new Error("token_sequence needs at least two tokens.");
    const highlightedIndex =
      item.highlightedIndex === undefined
        ? undefined
        : integerValue(item, "highlightedIndex", 0, tokens.length - 1);
    return {
      type,
      tokens,
      caption: stringValue(item, "caption", 4, 600),
      ...(highlightedIndex === undefined ? {} : { highlightedIndex }),
    };
  }
  if (type === "attention_map") {
    const tokens = stringArray(item, "tokens", 12);
    const weights = numberArray(item, "weights");
    if (tokens.length < 2 || tokens.length !== weights.length) {
      throw new Error("attention_map tokens and weights must have the same length of at least two.");
    }
    return {
      type,
      tokens,
      weights,
      focusIndex: integerValue(item, "focusIndex", 0, tokens.length - 1),
      explanation: stringValue(item, "explanation", 8, 800),
    };
  }
  if (type === "transformer_stack") {
    if (!Array.isArray(item.stages) || item.stages.length < 2 || item.stages.length > 10) {
      throw new Error("transformer_stack needs two to ten stages.");
    }
    return {
      type,
      stages: item.stages.map((value) => {
        const stage = objectInput(value, "Stack stage");
        return {
          label: stringValue(stage, "label", 1, 100),
          detail: stringValue(stage, "detail", 2, 300),
        };
      }),
      caption: stringValue(item, "caption", 4, 600),
    };
  }
  if (type === "comparison") {
    if (!Array.isArray(item.rows) || !item.rows.length || item.rows.length > 8) {
      throw new Error("comparison needs one to eight rows.");
    }
    return {
      type,
      leftLabel: stringValue(item, "leftLabel", 1, 100),
      rightLabel: stringValue(item, "rightLabel", 1, 100),
      rows: item.rows.map((value) => {
        const row = objectInput(value, "Comparison row");
        return {
          label: stringValue(row, "label", 1, 100),
          left: stringValue(row, "left", 1, 400),
          right: stringValue(row, "right", 1, 400),
        };
      }),
    };
  }
  throw new Error(`Unsupported trusted content type: ${type}.`);
}

function parseInteraction(value: unknown): LearnerInteraction | undefined {
  if (value === undefined) return undefined;
  const item = objectInput(value, "Interaction");
  const type = enumValue(item, "type", ["choice", "reflection"] as const);
  if (type === "choice") {
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 6) {
      throw new Error("A choice interaction needs two to six options.");
    }
    const options = item.options.map((value) => {
      const option = objectInput(value, "Choice option");
      if (typeof option.correct !== "boolean") throw new Error("Choice option correct must be boolean.");
      return {
        id: stringValue(option, "id", 1, 100),
        label: stringValue(option, "label", 1, 300),
        correct: option.correct,
        feedback: stringValue(option, "feedback", 3, 500),
      };
    });
    if (options.filter((option) => option.correct).length !== 1) {
      throw new Error("A choice interaction needs exactly one correct option.");
    }
    return { type, prompt: stringValue(item, "prompt", 5, 500), options };
  }
  return {
    type,
    prompt: stringValue(item, "prompt", 5, 500),
    placeholder: stringValue(item, "placeholder", 1, 300),
    minimumCharacters: integerValue(item, "minimumCharacters", 10, 1000),
    feedback: stringValue(item, "feedback", 3, 600),
  };
}

function parseLessonMetadata(
  value: unknown,
): Omit<LessonDocumentV3, "regions"> {
  const document = objectInput(value, "Lesson metadata");
  return {
    id: stringValue(document, "id", 3, 160),
    revision: integerValue(document, "revision", 1),
    topic: stringValue(document, "topic", 3, 240),
    title: stringValue(document, "title", 6, 240),
    subtitle: stringValue(document, "subtitle", 3, 400),
    audience: stringValue(document, "audience", 3, 400),
    estimatedMinutes: integerValue(document, "estimatedMinutes", 1, 120),
    objective: stringValue(document, "objective", 20, 700),
    approvedClaimIds: stringArray(document, "approvedClaimIds", 40),
  };
}

function parseLessonRegion(value: unknown, label = "Lesson region"): LessonRegion {
  const region = objectInput(value, label);
  if (!Array.isArray(region.content) || !region.content.length) {
    throw new Error(`${label} needs accessible content.`);
  }
  const sourceRefs = Array.isArray(region.sourceRefs)
    ? stringArray(region, "sourceRefs", 20)
    : [];
  const interaction = parseInteraction(region.interaction);
  const now = new Date().toISOString();
  return {
    id: stringValue(region, "id", 2, 120),
    order: integerValue(region, "order", 1, 99),
    label: stringValue(region, "label", 2, 120),
    title: stringValue(region, "title", 3, 240),
    objective: stringValue(region, "objective", 4, 500),
    kind: enumValue(
      region,
      "kind",
      ["orient", "explain", "model", "practice", "reflect"] as const,
    ),
    content: region.content.map(parseTrustedContent),
    ...(interaction ? { interaction } : {}),
    provenance: [
      {
        actor: "agent" as const,
        label: "Prepared by Codex",
        sourceRefs,
        at: now,
      },
    ],
  };
}

function parseLessonDocument(value: unknown): LessonDocumentV3 {
  const document = objectInput(value, "Lesson document");
  if (!Array.isArray(document.regions)) throw new Error("Lesson regions must be an array.");
  return {
    ...parseLessonMetadata(document),
    regions: document.regions.map((region, index) =>
      parseLessonRegion(region, `Region ${index + 1}`),
    ),
  };
}

function parseLessonOutline(value: unknown) {
  const outline = objectInput(value, "Lesson outline");
  if (!Array.isArray(outline.regions)) {
    throw new Error("Lesson outline regions must be an array.");
  }
  return {
    document: parseLessonMetadata(outline),
    regions: outline.regions.map((value, index) => {
      const region = objectInput(value, `Outline region ${index + 1}`);
      return {
        id: stringValue(region, "id", 2, 120),
        order: integerValue(region, "order", 1, 99),
        label: stringValue(region, "label", 2, 120),
        title: stringValue(region, "title", 3, 240),
        objective: stringValue(region, "objective", 4, 500),
        kind: enumValue(
          region,
          "kind",
          ["orient", "explain", "model", "practice", "reflect"] as const,
        ),
      };
    }),
  };
}

function defaultTransformerLesson(actions: CanvasActions): LessonDocumentV3 {
  const state = actions.getState();
  const accepted = state.contextClaims.filter(
    (claim) => claim.review === "accepted" || claim.review === "corrected",
  );
  const document = structuredClone(transformerLessonFixture);
  document.revision = Math.max(
    state.lesson.draft?.revision ?? 0,
    state.lesson.publishedRevision ?? 0,
  ) + 1;
  document.approvedClaimIds = accepted.map((claim) => claim.id);
  if (accepted.length) {
    document.subtitle = "A technical-beginner path shaped by learner-approved context";
    document.regions[0]?.content.push({
      type: "key_points",
      items: accepted.map(
        (claim) => `Tailoring signal: ${claim.correctedSummary ?? claim.summary}`,
      ),
    });
  }
  return document;
}

function revealRegion(regionId: string): void {
  window.setTimeout(() => {
    document.getElementById(`region-${regionId}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  }, 40);
}

function currentViewport() {
  const visibleRegionIds = Array.from(
    document.querySelectorAll<HTMLElement>("[data-canvas-region]"),
  )
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    })
    .map((element) => element.dataset.canvasRegion)
    .filter((value): value is string => Boolean(value));
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollY: Math.round(window.scrollY),
    visibleRegionIds,
  };
}

function nextActions(stage: LearningSessionStage, lessonStatus: string): string[] {
  if (stage === "ready") return ["Call learn_begin_session."];
  if (stage === "context_review") {
    return [
      "Ask for scoped consent before consulting this chat, past Codex tasks or conversations, saved-project history, Ogram, or connected sources.",
      "If history is allowed, use the host's task-listing and task-reading capabilities; do not conclude there is no context merely because this chat is short.",
      "Propose only minimized context claims, or let the learner choose the generic path.",
      "After every context choice is resolved, shape the lesson with learn_prepare_lesson start, one region call per section, then finalize.",
    ];
  }
  if (stage === "lesson_review") {
    return lessonStatus === "approved"
      ? ["Call learn_publish_lesson with this exact approved revision."]
      : ["Wait for the learner to approve the compiled lesson on the canvas."];
  }
  return [
    "Read learn_get_canvas_snapshot before changing a region.",
    "Patch the focused region, inject a bounded widget directly on this canvas, or attach sourced research.",
    "Keep generated visuals out of the conversation; the WebMCP canvas is the only visual output surface for this learning session.",
  ];
}

function readOnlyAnnotations() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
}

function writeAnnotations(openWorldHint = false) {
  return {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint,
  };
}

export function createLearnTools(actions: CanvasActions): WebMcpToolDefinition[] {
  const begin: WebMcpToolDefinition = {
    name: "learn_begin_session",
    description:
      "Required first call. Start or resume a learning session, create a progressive canvas skeleton, and return the guide plus context-discovery and canvas-only visual-output policies you must follow.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["topic"],
      properties: {
        topic: { type: "string", minLength: 3, maxLength: 240 },
        goal: { type: "string", minLength: 3, maxLength: 500 },
      },
    },
    annotations: writeAnnotations(),
    execute(input) {
      const object = objectInput(input);
      return {
        ...actions.beginSession({
        topic: stringValue(object, "topic", 3, 240),
        goal: optionalString(object, "goal", 500),
        }),
        contextDiscoveryPolicy,
        visualOutputPolicy: canvasVisualOutputPolicy,
      };
    },
  };

  const getContext: WebMcpToolDefinition = {
    name: "learn_get_context",
    description:
      "Read minimized context claims, their provenance, scoped consent coverage, learner review status, and the available current-chat, history, project, Ogram, and connector discovery routes. Never infer approval from proposal alone.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce"],
      properties: { nonce: nonceSchema },
    },
    annotations: readOnlyAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const state = actions.getState();
      return {
        revision: state.revision,
        personalization: state.session.personalization,
        consent: state.session.contextConsent,
        discoveryPolicy: contextDiscoveryPolicy,
        claims: state.contextClaims,
        acceptedClaimIds: state.contextClaims
          .filter((claim) => claim.review === "accepted" || claim.review === "corrected")
          .map((claim) => claim.id),
      };
    },
  };

  const proposeContext: WebMcpToolDefinition = {
    name: "learn_propose_context",
    description:
      "After explicit scoped consent, add privacy-minimized learner context from this chat, past Codex tasks/conversations, saved-project history, Ogram, or connected MCP sources. Retrieve host history agent-side; claims remain unusable until individually approved on the canvas.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce", "baseRevision", "idempotencyKey", "consent", "claims"],
      properties: {
        nonce: nonceSchema,
        baseRevision: { type: "integer", minimum: 0 },
        idempotencyKey: idempotencySchema,
        consent: {
          type: "object",
          additionalProperties: false,
          required: ["obtainedAt", "scope", "providerIds", "sourceScopes"],
          properties: {
            obtainedAt: { type: "string", minLength: 8, maxLength: 80 },
            scope: { type: "string", minLength: 8, maxLength: 400 },
            providerIds: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: { type: "string", minLength: 1, maxLength: 120 },
            },
            sourceScopes: {
              type: "array",
              minItems: 1,
              maxItems: 5,
              description:
                "Exact source families the learner allowed Codex to inspect before minimizing claims.",
              items: {
                type: "string",
                enum: [
                  "current_conversation",
                  "codex_history",
                  "project_history",
                  "ogram_profile",
                  "connected_sources",
                ],
              },
            },
          },
        },
        claims: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "id",
              "kind",
              "summary",
              "source",
              "sensitivity",
              "allowedPurposes",
              "evidenceRef",
            ],
            properties: {
              id: { type: "string", minLength: 2, maxLength: 120 },
              kind: {
                type: "string",
                enum: [
                  "stated_goal",
                  "prior_knowledge",
                  "current_project",
                  "preference",
                  "accessibility",
                  "business_constraint",
                ],
              },
              summary: { type: "string", minLength: 3, maxLength: 240 },
              source: {
                type: "object",
                additionalProperties: false,
                required: ["route", "providerId", "providerLabel", "resourceType"],
                properties: {
                  route: {
                    type: "string",
                    enum: [
                      "learner",
                      "conversation",
                      "codex_history",
                      "project_history",
                      "ogram",
                      "connected_mcp",
                    ],
                  },
                  providerId: { type: "string", minLength: 1, maxLength: 120 },
                  providerLabel: { type: "string", minLength: 1, maxLength: 120 },
                  resourceType: { type: "string", minLength: 1, maxLength: 120 },
                },
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              sensitivity: { type: "string", enum: ["low", "personal", "restricted"] },
              allowedPurposes: {
                type: "array",
                minItems: 1,
                maxItems: 8,
                items: { type: "string", minLength: 2, maxLength: 160 },
              },
              evidenceRef: { type: "string", minLength: 2, maxLength: 300 },
            },
          },
        },
      },
    },
    annotations: writeAnnotations(true),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const consentObject = objectInput(object.consent, "Consent attestation");
      if (!Array.isArray(object.claims) || !object.claims.length || object.claims.length > 8) {
        throw new Error("claims must contain one to eight minimized claims.");
      }
      const observedAt = new Date().toISOString();
      const claims: LearnerContextClaim[] = object.claims.map((value) => {
        const claim = objectInput(value, "Context claim");
        const sourceObject = objectInput(claim.source, "Context source");
        const source: ContextSource = {
          route: enumValue(
            sourceObject,
            "route",
            [
              "learner",
              "conversation",
              "codex_history",
              "project_history",
              "ogram",
              "connected_mcp",
            ] as const,
          ),
          providerId: stringValue(sourceObject, "providerId", 1, 120),
          providerLabel: stringValue(sourceObject, "providerLabel", 1, 120),
          resourceType: stringValue(sourceObject, "resourceType", 1, 120),
        };
        const confidence = claim.confidence;
        if (
          confidence !== undefined &&
          (typeof confidence !== "number" || confidence < 0 || confidence > 1)
        ) {
          throw new Error("confidence must be between 0 and 1.");
        }
        return {
          id: stringValue(claim, "id", 2, 120),
          kind: enumValue(
            claim,
            "kind",
            [
              "stated_goal",
              "prior_knowledge",
              "current_project",
              "preference",
              "accessibility",
              "business_constraint",
            ] as readonly ContextClaimKind[],
          ),
          summary: stringValue(claim, "summary", 3, 240),
          source,
          ...(confidence === undefined ? {} : { confidence }),
          sensitivity: enumValue(
            claim,
            "sensitivity",
            ["low", "personal", "restricted"] as const,
          ),
          allowedPurposes: stringArray(claim, "allowedPurposes", 8),
          evidenceRef: stringValue(claim, "evidenceRef", 2, 300),
          review: "pending",
          observedAt,
        };
      });
      return actions.proposeContext({
        baseRevision: integerValue(object, "baseRevision"),
        idempotencyKey: stringValue(object, "idempotencyKey", 8, 160),
        consent: {
          obtainedAt: stringValue(consentObject, "obtainedAt", 8, 80),
          scope: stringValue(consentObject, "scope", 8, 400),
          providerIds: stringArray(consentObject, "providerIds", 20),
          sourceScopes: enumArray(
            consentObject,
            "sourceScopes",
            [
              "current_conversation",
              "codex_history",
              "project_history",
              "ogram_profile",
              "connected_sources",
            ] as readonly ContextDiscoveryScope[],
            5,
          ),
        },
        claims,
      });
    },
  };

  const getSession: WebMcpToolDefinition = {
    name: "learn_get_session",
    description:
      "Read session stage, lesson approval state, progress, revisions, recent events, and the next valid actions.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce"],
      properties: { nonce: nonceSchema },
    },
    annotations: readOnlyAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const state = actions.getState();
      return {
        version: state.version,
        revision: state.revision,
        session: state.session,
        contextDiscoveryPolicy,
        visualOutputPolicy: canvasVisualOutputPolicy,
        lesson: {
          status: state.lesson.status,
          draftRevision: state.lesson.draft?.revision ?? null,
          construction: state.lesson.construction
            ? {
                draftRevision: state.lesson.construction.document.revision,
                title: state.lesson.construction.document.title,
                shapedRegions: state.lesson.construction.regions.filter(
                  (region) => region.status === "ready",
                ).length,
                totalRegions: state.lesson.construction.regions.length,
                pendingRegionIds: state.lesson.construction.regions
                  .filter((region) => region.status !== "ready")
                  .map((region) => region.id),
              }
            : null,
          approvedDraftRevision: state.lesson.approvedDraftRevision,
          publishedRevision: state.lesson.publishedRevision,
          validation: state.lesson.validation,
        },
        progress: {
          regionCount: state.regions.length,
          responseCount: state.regions.filter((region) => region.response).length,
        },
        recentEvents: state.events.slice(-8),
        nextValidActions: nextActions(state.session.stage, state.lesson.status),
      };
    },
  };

  const prepareLesson: WebMcpToolDefinition = {
    name: "learn_prepare_lesson",
    description:
      "Shape and compile a lesson draft. Prefer the progressive start → region (one call per region) → finalize phases so the learner watches the canvas take shape. Use complete, or omit phase, only for a one-shot document or the bundled transformer blueprint.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce", "baseRevision", "idempotencyKey"],
      properties: {
        nonce: nonceSchema,
        baseRevision: { type: "integer", minimum: 0 },
        idempotencyKey: idempotencySchema,
        phase: {
          type: "string",
          enum: ["start", "region", "finalize", "complete"],
          description:
            "Progressive authoring phase. Each call uses the latest canvas revision returned by the previous call.",
        },
        draftRevision: { type: "integer", minimum: 1 },
        template: { type: "string", enum: ["transformer_technical_beginner"] },
        regionId: {
          type: "string",
          minLength: 2,
          maxLength: 120,
          description:
            "For a progressive bundled template region call, the stable region id returned by phase=start.",
        },
        outline: {
          type: "object",
          description:
            "For phase=start: lesson metadata plus 4–12 stable region stubs (id, order, label, title, objective, kind).",
        },
        region: {
          type: "object",
          description:
            "For phase=region: one complete trusted-content region matching a stub from the active outline.",
        },
        document: {
          type: "object",
          description:
            "LessonDocumentV3 with 4–12 stable regions, trusted content specs, and at least one learner interaction.",
        },
      },
    },
    annotations: writeAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const phase =
        object.phase === undefined
          ? "complete"
          : enumValue(
              object,
              "phase",
              ["start", "region", "finalize", "complete"] as const,
            );
      const common = {
        baseRevision: integerValue(object, "baseRevision"),
        idempotencyKey: stringValue(object, "idempotencyKey", 8, 160),
      };
      if (phase === "start") {
        const parsed = object.outline
          ? parseLessonOutline(object.outline)
          : object.template === "transformer_technical_beginner"
            ? (() => {
                const document = defaultTransformerLesson(actions);
                return {
                  document: {
                    id: document.id,
                    revision: document.revision,
                    topic: document.topic,
                    title: document.title,
                    subtitle: document.subtitle,
                    audience: document.audience,
                    estimatedMinutes: document.estimatedMinutes,
                    objective: document.objective,
                    approvedClaimIds: document.approvedClaimIds,
                  },
                  regions: document.regions.map((region) => ({
                    id: region.id,
                    order: region.order,
                    label: region.label,
                    title: region.title,
                    objective: region.objective,
                    kind: region.kind,
                  })),
                };
              })()
            : (() => {
                throw new Error("phase=start requires an outline or the bundled transformer template.");
              })();
        return actions.startLessonConstruction({
          ...common,
          document: parsed.document,
          outline: parsed.regions,
        });
      }
      if (phase === "region") {
        const region = object.region
          ? parseLessonRegion(object.region)
          : object.template === "transformer_technical_beginner"
            ? defaultTransformerLesson(actions).regions.find(
                (candidate) =>
                  candidate.id === stringValue(object, "regionId", 2, 120),
              )
            : undefined;
        if (!region) {
          throw new Error("phase=region requires a complete region or a valid bundled template regionId.");
        }
        return actions.shapeLessonRegion({
          ...common,
          draftRevision: integerValue(object, "draftRevision", 1),
          region,
        });
      }
      if (phase === "finalize") {
        return actions.finalizeLessonConstruction({
          ...common,
          draftRevision: integerValue(object, "draftRevision", 1),
        });
      }
      const current = actions.getState();
      const useTemplate =
        object.document === undefined &&
        (object.template === "transformer_technical_beginner" ||
          /transformer/i.test(current.session.topic ?? ""));
      if (object.document === undefined && !useTemplate) {
        throw new Error("A lesson document is required for topics without a bundled template.");
      }
      return actions.prepareLesson({
        ...common,
        document: useTemplate
          ? defaultTransformerLesson(actions)
          : parseLessonDocument(object.document),
      });
    },
  };

  const publishLesson: WebMcpToolDefinition = {
    name: "learn_publish_lesson",
    description:
      "Publish the exact compiled lesson revision only after the learner approved it on the canvas.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce", "baseRevision", "draftRevision", "idempotencyKey"],
      properties: {
        nonce: nonceSchema,
        baseRevision: { type: "integer", minimum: 0 },
        draftRevision: { type: "integer", minimum: 1 },
        idempotencyKey: idempotencySchema,
      },
    },
    annotations: writeAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      return actions.publishLesson({
        baseRevision: integerValue(object, "baseRevision"),
        draftRevision: integerValue(object, "draftRevision", 1),
        idempotencyKey: stringValue(object, "idempotencyKey", 8, 160),
      });
    },
  };

  const getSnapshot: WebMcpToolDefinition = {
    name: "learn_get_canvas_snapshot",
    description:
      "Read the semantic learning canvas before helping: stable regions, focus, selected text, interaction evidence, revisions, visible viewport, and renderer capabilities.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce"],
      properties: { nonce: nonceSchema },
    },
    annotations: readOnlyAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const state = actions.getState();
      const visibleRegions = state.lesson.construction?.regions ?? state.regions;
      return {
        canvasRevision: state.revision,
        topic: state.session.topic,
        stage: state.session.stage,
        focusedRegionId: state.focus.regionId,
        selectedText: state.focus.selectedText,
        viewport: currentViewport(),
        regions: visibleRegions.map((region) => ({
          id: region.id,
          order: region.order,
          label: region.label,
          title: region.title,
          objective: region.objective,
          kind: region.kind,
          revision: region.revision,
          status: region.status,
          content: region.content,
          interaction: region.interaction
            ? {
                type: region.interaction.type,
                prompt: region.interaction.prompt,
                completed: Boolean(region.response),
                response: region.response ?? null,
              }
            : null,
          attribution: region.provenance.at(-1) ?? null,
          latestUndoToken: region.history.at(-1)?.undoToken ?? null,
        })),
        rendererCapabilities: {
          trusted: [
            "prose",
            "key_points",
            "token_sequence",
            "attention_map",
            "transformer_stack",
            "comparison",
            "source_cards",
          ],
          sandboxWidget: {
            supported: true,
            htmlBytes: 12_288,
            cssBytes: 12_288,
            javascriptBytes: 24_576,
            network: false,
          },
        },
        visualOutputPolicy: canvasVisualOutputPolicy,
      };
    },
  };

  const patchRegion: WebMcpToolDefinition = {
    name: "learn_patch_region",
    description:
      "Immediately and reversibly replace, append, annotate, or mark one stable region using trusted learning content. Never changes learner responses.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "nonce",
        "regionId",
        "baseRegionRevision",
        "idempotencyKey",
        "operation",
        "rationale",
      ],
      properties: {
        nonce: nonceSchema,
        regionId: { type: "string", minLength: 2, maxLength: 120 },
        baseRegionRevision: { type: "integer", minimum: 0 },
        idempotencyKey: idempotencySchema,
        operation: {
          type: "string",
          enum: ["replace", "append", "annotate", "set_status"],
        },
        content: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: trustedContentSchema,
        },
        status: { type: "string", enum: ["ready", "agent_working", "updated"] },
        rationale: { type: "string", minLength: 4, maxLength: 500 },
        sourceRefs: {
          type: "array",
          maxItems: 20,
          items: { type: "string", minLength: 2, maxLength: 1000 },
        },
      },
    },
    annotations: writeAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const operation = enumValue(
        object,
        "operation",
        ["replace", "append", "annotate", "set_status"] as const,
      );
      const content = Array.isArray(object.content)
        ? object.content.map(parseTrustedContent)
        : undefined;
      const status =
        object.status === undefined
          ? undefined
          : enumValue(
              object,
              "status",
              ["ready", "agent_working", "updated"] as readonly CanvasRegionStatus[],
            );
      const result = actions.patchRegion({
        regionId: stringValue(object, "regionId", 2, 120),
        baseRegionRevision: integerValue(object, "baseRegionRevision"),
        idempotencyKey: stringValue(object, "idempotencyKey", 8, 160),
        operation,
        content,
        status,
        rationale: stringValue(object, "rationale", 4, 500),
        sourceRefs: Array.isArray(object.sourceRefs)
          ? stringArray(object, "sourceRefs", 20)
          : [],
      });
      revealRegion(result.regionId);
      return result;
    },
  };

  const injectWidget: WebMcpToolDefinition = {
    name: "learn_inject_widget",
    description:
      "Author a bounded HTML/CSS/JS interaction directly inside one learning-canvas region. This is the only surface for generated widgets: never create an inline conversation visualization first. Supply a responsive body fragment only; canvas chrome provides the title, Reset, Stop, and text alternative. The widget runs in a no-origin, no-network sandbox and remains undoable.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "nonce",
        "regionId",
        "baseRegionRevision",
        "idempotencyKey",
        "title",
        "html",
        "css",
        "javascript",
        "accessibleSummary",
        "height",
        "rationale",
      ],
      properties: {
        nonce: nonceSchema,
        regionId: { type: "string", minLength: 2, maxLength: 120 },
        baseRegionRevision: { type: "integer", minimum: 0 },
        idempotencyKey: idempotencySchema,
        widgetId: { type: "string", minLength: 2, maxLength: 120 },
        title: { type: "string", minLength: 3, maxLength: 160 },
        html: {
          type: "string",
          maxLength: 12288,
          description:
            "Responsive body fragment only; omit html/head/body, a duplicate title, Reset/Stop controls, and wrapper chrome.",
        },
        css: {
          type: "string",
          maxLength: 12288,
          description:
            "Mobile-first CSS that remains usable at 320px without horizontal overflow.",
        },
        javascript: { type: "string", maxLength: 24576 },
        accessibleSummary: { type: "string", minLength: 8, maxLength: 1200 },
        height: { type: "integer", minimum: 180, maximum: 720 },
        rationale: { type: "string", minLength: 4, maxLength: 500 },
      },
    },
    annotations: writeAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const idempotencyKey = stringValue(object, "idempotencyKey", 8, 160);
      const result = actions.injectWidget({
        regionId: stringValue(object, "regionId", 2, 120),
        baseRegionRevision: integerValue(object, "baseRegionRevision"),
        idempotencyKey,
        widget: {
          type: "sandbox_widget",
          widgetId:
            optionalString(object, "widgetId", 120) ??
            `widget-${idempotencyKey.replace(/[^a-z0-9-]/gi, "-")}`,
          title: stringValue(object, "title", 3, 160),
          html: typeof object.html === "string" ? object.html : "",
          css: typeof object.css === "string" ? object.css : "",
          javascript:
            typeof object.javascript === "string" ? object.javascript : "",
          accessibleSummary: stringValue(object, "accessibleSummary", 8, 1200),
          height: integerValue(object, "height", 180, 720),
        },
        rationale: stringValue(object, "rationale", 4, 500),
      });
      revealRegion(result.regionId);
      return result;
    },
  };

  const attachResearch: WebMcpToolDefinition = {
    name: "learn_attach_research",
    description:
      "Attach a bounded synthesis and canonical citation cards produced by agent-side research to one region. Connector credentials and raw source content never enter the page.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "nonce",
        "regionId",
        "baseRegionRevision",
        "idempotencyKey",
        "summary",
        "sources",
      ],
      properties: {
        nonce: nonceSchema,
        regionId: { type: "string", minLength: 2, maxLength: 120 },
        baseRegionRevision: { type: "integer", minimum: 0 },
        idempotencyKey: idempotencySchema,
        summary: { type: "string", minLength: 12, maxLength: 1800 },
        sources: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: researchReferenceSchema,
        },
      },
    },
    annotations: writeAnnotations(true),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      if (!Array.isArray(object.sources)) throw new Error("sources must be an array.");
      const result = actions.attachResearch({
        regionId: stringValue(object, "regionId", 2, 120),
        baseRegionRevision: integerValue(object, "baseRegionRevision"),
        idempotencyKey: stringValue(object, "idempotencyKey", 8, 160),
        summary: stringValue(object, "summary", 12, 1800),
        sources: object.sources.map(parseReference),
      });
      revealRegion(result.regionId);
      return result;
    },
  };

  const revertRegion: WebMcpToolDefinition = {
    name: "learn_revert_region",
    description:
      "Restore a prior agent-owned version of one region with its undo token. Learner answers and evidence are never reverted.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "nonce",
        "regionId",
        "baseRegionRevision",
        "idempotencyKey",
        "undoToken",
      ],
      properties: {
        nonce: nonceSchema,
        regionId: { type: "string", minLength: 2, maxLength: 120 },
        baseRegionRevision: { type: "integer", minimum: 0 },
        idempotencyKey: idempotencySchema,
        undoToken: { type: "string", minLength: 8, maxLength: 200 },
      },
    },
    annotations: writeAnnotations(),
    execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const result = actions.revertRegion({
        regionId: stringValue(object, "regionId", 2, 120),
        baseRegionRevision: integerValue(object, "baseRegionRevision"),
        idempotencyKey: stringValue(object, "idempotencyKey", 8, 160),
        undoToken: stringValue(object, "undoToken", 8, 200),
        actor: "agent",
      });
      revealRegion(result.regionId);
      return result;
    },
  };

  return [
    begin,
    getContext,
    proposeContext,
    getSession,
    prepareLesson,
    publishLesson,
    getSnapshot,
    patchRegion,
    injectWidget,
    attachResearch,
    revertRegion,
  ];
}

export const v3ToolNames = [
  "learn_begin_session",
  "learn_get_context",
  "learn_propose_context",
  "learn_get_session",
  "learn_prepare_lesson",
  "learn_publish_lesson",
  "learn_get_canvas_snapshot",
  "learn_patch_region",
  "learn_inject_widget",
  "learn_attach_research",
  "learn_revert_region",
] as const;

export function activeToolNames(
  stage: LearningSessionStage,
  hasNonce: boolean,
): string[] {
  if (!hasNonce || stage === "ready") return ["learn_begin_session"];
  const contextTools = [
    "learn_begin_session",
    "learn_get_session",
    "learn_get_context",
    "learn_propose_context",
    "learn_get_canvas_snapshot",
    "learn_prepare_lesson",
  ];
  if (stage === "context_review") return contextTools;
  if (stage === "lesson_review") {
    return [...contextTools, "learn_publish_lesson"];
  }
  return [...v3ToolNames];
}

export async function registerLearnTools(
  actions: CanvasActions,
  stage: LearningSessionStage,
  hasNonce: boolean,
): Promise<WebMcpRegistration> {
  const allTools = createLearnTools(actions);
  const allRegistry = Object.fromEntries(allTools.map((tool) => [tool.name, tool]));
  window.__OGRAM_WEBMCP_TOOLS__ = allRegistry;

  const names = activeToolNames(stage, hasNonce);
  const active = allTools.filter((tool) => names.includes(tool.name));
  const controller = new AbortController();
  const supported = typeof document.modelContext?.registerTool === "function";
  if (supported) {
    try {
      for (const tool of active) {
        await document.modelContext!.registerTool(tool, { signal: controller.signal });
      }
    } catch (error) {
      controller.abort();
      throw error;
    }
  }

  return {
    supported,
    toolCount: active.length,
    toolNames: active.map((tool) => tool.name),
    cleanup: () => {
      controller.abort();
      if (window.__OGRAM_WEBMCP_TOOLS__ === allRegistry) {
        delete window.__OGRAM_WEBMCP_TOOLS__;
      }
    },
  };
}
