import type {
  CanvasRegionStatus,
  ContextClaimKind,
  ContextDiscoveryScope,
  ContextSource,
  EdgeCondition,
  LearnerContextClaim,
  LearnerInteraction,
  LessonContextPackV1,
  LessonDocumentV3,
  LessonEdgeV4,
  LessonRegion,
  LearningSessionStage,
  PedagogicalMode,
  RegionContent,
  ResearchReference,
  TrustedPatchContent,
} from "../domain/agentCanvas";
import { createLinearLessonFlow } from "../domain/agentCanvas";
import {
  getAuthoringCapabilities,
  pedagogicalModeForBrief,
} from "../domain/lessonCatalog";
import { LESSON_LIMITS } from "../domain/lessonRegistry";
import {
  algebraLessonFixture,
  codeLessonFixture,
  createPersonalizedCodexLesson,
} from "../domain/v4Fixtures";
import { transformerLessonFixture } from "../domain/transformerFixture";
import { loadLessonBrief } from "./lessonBriefPersistence";
import {
  registerAsset as registerGovernedAsset,
  registerCodeExercise as registerSandboxExercise,
  validateLessonReferences,
} from "./learningService";
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

const registeredAssetIds = new Set<string>();
const registeredCodeExerciseIds = new Set<string>([
  "fixture-js-sum-v1",
  "fixture-ts-display-name-v1",
  "fixture-python-positives-v1",
]);

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

const contextPackSchema = {
  type: "object",
  additionalProperties: false,
  required: ["generatedAt", "lookbackDays", "inspectedTaskCount", "signals"],
  properties: {
    generatedAt: { type: "string", minLength: 8, maxLength: 80 },
    lookbackDays: { type: "integer", minimum: 1, maximum: 30 },
    inspectedTaskCount: { type: "integer", minimum: 0, maximum: 10 },
    signals: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "summary", "kind", "observedAt", "sourceLabel"],
        properties: {
          id: { type: "string", minLength: 2, maxLength: 120 },
          summary: { type: "string", minLength: 3, maxLength: 280 },
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
          confidence: { type: "number", minimum: 0, maximum: 1 },
          observedAt: { type: "string", minLength: 8, maxLength: 80 },
          sourceLabel: { type: "string", minLength: 2, maxLength: 160 },
        },
      },
    },
    topicRadar: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "topic",
          "summary",
          "retrievedAt",
          "learnerRelevance",
          "officialRecency",
          "communityCorroboration",
          "authority",
        ],
        properties: {
          id: { type: "string", minLength: 2, maxLength: 120 },
          topic: { type: "string", minLength: 2, maxLength: 200 },
          summary: { type: "string", minLength: 8, maxLength: 600 },
          officialUrl: { type: "string", minLength: 10, maxLength: 1000 },
          officialPublishedAt: { type: "string", minLength: 8, maxLength: 80 },
          retrievedAt: { type: "string", minLength: 8, maxLength: 80 },
          availability: { type: "string", maxLength: 400 },
          learnerRelevance: { type: "number", minimum: 0, maximum: 1 },
          officialRecency: { type: "number", minimum: 0, maximum: 1 },
          communityCorroboration: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          authority: {
            type: "string",
            enum: ["official", "community_exploration"],
          },
          communitySources: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["url", "publishedAt"],
              properties: {
                url: { type: "string", minLength: 10, maxLength: 1000 },
                publishedAt: { type: "string", minLength: 8, maxLength: 80 },
                publisher: { type: "string", minLength: 2, maxLength: 160 },
              },
            },
          },
        },
      },
    },
  },
} satisfies JsonSchema;

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
    retrievedAt: { type: "string", maxLength: 80 },
    claim: { type: "string", minLength: 8, maxLength: 500 },
    sourceType: {
      type: "string",
      enum: ["official", "community", "primary", "secondary"],
    },
    availability: { type: "string", maxLength: 400 },
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
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "summary", "sources"],
      properties: {
        type: { const: "source_cards" },
        summary: { type: "string", minLength: 8, maxLength: 1800 },
        sources: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: researchReferenceSchema,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "latex", "accessibleLabel"],
      properties: {
        type: { const: "formula" },
        latex: { type: "string", minLength: 1, maxLength: 4096 },
        display: { type: "boolean" },
        accessibleLabel: { type: "string", minLength: 4, maxLength: 800 },
        explanation: { type: "string", maxLength: 1200 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "syntax", "source", "title", "description"],
      properties: {
        type: { const: "diagram" },
        syntax: { const: "mermaid" },
        source: { type: "string", minLength: 4, maxLength: 16384 },
        title: { type: "string", minLength: 3, maxLength: 240 },
        description: { type: "string", minLength: 8, maxLength: 1200 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "language", "code", "caption"],
      properties: {
        type: { const: "code_example" },
        language: {
          type: "string",
          enum: ["javascript", "typescript", "python", "json", "text"],
        },
        code: { type: "string", minLength: 1, maxLength: 32768 },
        caption: { type: "string", minLength: 4, maxLength: 800 },
        highlightedLines: {
          type: "array",
          maxItems: 100,
          items: { type: "integer", minimum: 1 },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "asset"],
      properties: {
        type: { const: "media" },
        asset: {
          type: "object",
          description:
            "Immutable asset reference returned by learn_register_asset, including caption, attribution, and accessibility metadata.",
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

function finiteNumberValue(
  object: Record<string, unknown>,
  key: string,
  minimum = -Number.MAX_VALUE,
  maximum = Number.MAX_VALUE,
): number {
  const value = object[key];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      key + " must be a finite number between " + minimum + " and " + maximum + ".",
    );
  }
  return value;
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
  const retrievedAt = optionalString(item, "retrievedAt", 80);
  if (retrievedAt) result.retrievedAt = retrievedAt;
  const sourceType =
    item.sourceType === undefined
      ? undefined
      : enumValue(
          item,
          "sourceType",
          ["official", "community", "primary", "secondary"] as const,
        );
  if (sourceType) result.sourceType = sourceType;
  const availability = optionalString(item, "availability", 400);
  if (availability) result.availability = availability;
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
  if (type === "source_cards") {
    if (!Array.isArray(item.sources) || !item.sources.length || item.sources.length > 8) {
      throw new Error("source_cards needs one to eight canonical references.");
    }
    return {
      type,
      summary: stringValue(item, "summary", 8, 1800),
      sources: item.sources.map(parseReference),
    };
  }
  if (type === "formula") {
    if (typeof item.display !== "undefined" && typeof item.display !== "boolean") {
      throw new Error("formula display must be boolean.");
    }
    const explanation = optionalString(item, "explanation", 1200);
    return {
      type,
      latex: stringValue(item, "latex", 1, 4096),
      accessibleLabel: stringValue(item, "accessibleLabel", 4, 800),
      ...(typeof item.display === "boolean" ? { display: item.display } : {}),
      ...(explanation ? { explanation } : {}),
    };
  }
  if (type === "diagram") {
    return {
      type,
      syntax: enumValue(item, "syntax", ["mermaid"] as const),
      source: stringValue(item, "source", 4, 16384),
      title: stringValue(item, "title", 3, 240),
      description: stringValue(item, "description", 8, 1200),
    };
  }
  if (type === "code_example") {
    const rawLines = item.highlightedLines;
    const highlightedLines = Array.isArray(rawLines)
      ? rawLines.map((value, index) => {
          if (!Number.isInteger(value) || Number(value) < 1) {
            throw new Error("highlightedLines[" + index + "] must be a positive integer.");
          }
          return Number(value);
        })
      : undefined;
    return {
      type,
      language: enumValue(
        item,
        "language",
        ["javascript", "typescript", "python", "json", "text"] as const,
      ),
      code: stringValue(item, "code", 1, 32768),
      caption: stringValue(item, "caption", 4, 800),
      ...(highlightedLines ? { highlightedLines } : {}),
    };
  }
  if (type === "media") {
    const asset = objectInput(item.asset, "Media asset");
    const block: Extract<RegionContent, { type: "media" }> = {
      type,
      asset: {
        id: stringValue(asset, "id", 2, 200),
        kind: enumValue(asset, "kind", ["image", "audio", "video"] as const),
        status: enumValue(
          asset,
          "status",
          ["pending", "ready", "failed", "expired"] as const,
        ),
        caption: stringValue(asset, "caption", 3, 800),
        attribution: stringValue(asset, "attribution", 2, 800),
      },
    };
    const optionalKeys = [
      ["url", 1000],
      ["mimeType", 120],
      ["alt", 1200],
      ["transcript", 20000],
      ["captionsVtt", 4000],
      ["contentHash", 200],
    ] as const;
    for (const [key, maximum] of optionalKeys) {
      const value = optionalString(asset, key, maximum);
      if (value) Object.assign(block.asset, { [key]: value });
    }
    if (asset.byteLength !== undefined) {
      block.asset.byteLength = integerValue(
        asset,
        "byteLength",
        0,
        80 * 1024 * 1024,
      );
    }
    return block;
  }
  throw new Error(`Unsupported trusted content type: ${type}.`);
}

function parseInteraction(value: unknown): LearnerInteraction | undefined {
  if (value === undefined) return undefined;
  const item = objectInput(value, "Interaction");
  const type = enumValue(
    item,
    "type",
    ["choice", "reflection", "numeric", "code_lab"] as const,
  );
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
  if (type === "reflection") {
    return {
      type,
      prompt: stringValue(item, "prompt", 5, 500),
      placeholder: stringValue(item, "placeholder", 1, 300),
      minimumCharacters: integerValue(item, "minimumCharacters", 1, 1000),
      feedback: stringValue(item, "feedback", 3, 600),
    };
  }
  if (type === "numeric") {
    const unit = optionalString(item, "unit", 80);
    const placeholder = optionalString(item, "placeholder", 300);
    return {
      type,
      prompt: stringValue(item, "prompt", 5, 500),
      correctAnswer: finiteNumberValue(item, "correctAnswer"),
      tolerance: finiteNumberValue(item, "tolerance", 0),
      correctFeedback: stringValue(item, "correctFeedback", 3, 600),
      incorrectFeedback: stringValue(item, "incorrectFeedback", 3, 600),
      ...(unit ? { unit } : {}),
      ...(placeholder ? { placeholder } : {}),
    };
  }
  const starterCode =
    typeof item.starterCode === "string"
      ? item.starterCode
      : (() => {
          throw new Error("starterCode must be a string.");
        })();
  if (new TextEncoder().encode(starterCode).byteLength > LESSON_LIMITS.codeBytes) {
    throw new Error("starterCode cannot exceed 32 KB.");
  }
  return {
    type,
    exerciseId: stringValue(item, "exerciseId", 3, 200),
    prompt: stringValue(item, "prompt", 5, 500),
    language: enumValue(
      item,
      "language",
      ["javascript", "typescript", "python"] as const,
    ),
    starterCode,
    visibleTests: stringArray(item, "visibleTests", 20),
    fallbackPrompt: stringValue(item, "fallbackPrompt", 5, 800),
  };
}

function parseEdgeCondition(value: unknown): EdgeCondition {
  const condition = objectInput(value, "Edge condition");
  const type = enumValue(
    condition,
    "type",
    ["always", "answer_equals", "response_correct"] as const,
  );
  if (type === "always") return { type };
  if (type === "answer_equals") {
    return { type, value: stringValue(condition, "value", 1, 500) };
  }
  if (typeof condition.value !== "boolean") {
    throw new Error("response_correct value must be boolean.");
  }
  return { type, value: condition.value };
}

function parseLessonFlow(value: unknown) {
  const flow = objectInput(value, "Lesson flow");
  if (!Array.isArray(flow.edges)) throw new Error("Lesson flow edges must be an array.");
  return {
    entryRegionId: stringValue(flow, "entryRegionId", 2, 120),
    edges: flow.edges.map((value, index): LessonEdgeV4 => {
      const edge = objectInput(value, "Lesson edge " + (index + 1));
      const label = optionalString(edge, "label", 240);
      return {
        id: stringValue(edge, "id", 2, 160),
        from: stringValue(edge, "from", 2, 120),
        to: stringValue(edge, "to", 2, 120),
        priority: integerValue(edge, "priority", 0, 20),
        condition: parseEdgeCondition(edge.condition),
        ...(label ? { label } : {}),
      };
    }),
  };
}

function parseLessonMetadata(
  value: unknown,
): Omit<LessonDocumentV3, "regions"> {
  const document = objectInput(value, "Lesson metadata");
  if (
    document.schemaVersion !== undefined &&
    integerValue(document, "schemaVersion", 4, 4) !== 4
  ) {
    throw new Error("Only lesson schema version 4 is supported.");
  }
  return {
    schemaVersion: 4,
    id: stringValue(document, "id", 3, 160),
    revision: integerValue(document, "revision", 1),
    blueprintId:
      optionalString(document, "blueprintId", 160) ?? "open_topic_v1",
    pedagogicalMode:
      document.pedagogicalMode === undefined
        ? "mixed"
        : enumValue(
            document,
            "pedagogicalMode",
            ["conceptual", "quantitative", "code", "scenario", "mixed"] as const,
          ),
    sourcePolicy:
      document.sourcePolicy === undefined
        ? "evergreen"
        : enumValue(document, "sourcePolicy", ["evergreen", "current"] as const),
    topic: stringValue(document, "topic", 3, 240),
    title: stringValue(document, "title", 6, 240),
    subtitle: stringValue(document, "subtitle", 3, 400),
    audience: stringValue(document, "audience", 3, 400),
    estimatedMinutes: integerValue(document, "estimatedMinutes", 1, 120),
    objective: stringValue(document, "objective", 20, 700),
    approvedClaimIds: stringArray(document, "approvedClaimIds", 40),
    flow:
      document.flow === undefined
        ? { entryRegionId: "", edges: [] }
        : parseLessonFlow(document.flow),
    assetRefs: Array.isArray(document.assetRefs)
      ? stringArray(document, "assetRefs", 8)
      : [],
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
  const regions = document.regions.map((region, index) =>
    parseLessonRegion(region, `Region ${index + 1}`),
  );
  const metadata = parseLessonMetadata(document);
  return {
    ...metadata,
    flow: metadata.flow.entryRegionId
      ? metadata.flow
      : createLinearLessonFlow(regions),
    regions,
  };
}

function parseLessonOutline(value: unknown) {
  const outline = objectInput(value, "Lesson outline");
  if (!Array.isArray(outline.regions)) {
    throw new Error("Lesson outline regions must be an array.");
  }
  const regions = outline.regions.map((value, index) => {
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
    });
  const document = parseLessonMetadata(outline);
  return {
    document: {
      ...document,
      flow: document.flow.entryRegionId
        ? document.flow
        : createLinearLessonFlow(regions),
    },
    regions,
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

function documentMetadata(
  document: LessonDocumentV3,
): Omit<LessonDocumentV3, "regions"> {
  const { regions: _regions, ...metadata } = structuredClone(document);
  return metadata;
}

function defaultBlueprintLesson(
  actions: CanvasActions,
  blueprintId: string,
): LessonDocumentV3 | null {
  const state = actions.getState();
  const accepted = state.contextClaims.filter(
    (claim) => claim.review === "accepted" || claim.review === "corrected",
  );
  let document: LessonDocumentV3 | null = null;
  if (blueprintId === "transformer_technical_beginner") {
    document = defaultTransformerLesson(actions);
  } else if (blueprintId === "algebra_functions_v1") {
    document = structuredClone(algebraLessonFixture);
  } else if (blueprintId === "code_debugging_v1") {
    document = structuredClone(codeLessonFixture);
  } else if (blueprintId === "codex_current_personalized_v1") {
    document = createPersonalizedCodexLesson(state.contextClaims, state.topicRadar);
  }
  if (!document) return null;
  document.revision =
    Math.max(
      state.lesson.draft?.revision ?? 0,
      state.lesson.publishedRevision ?? 0,
    ) + 1;
  document.approvedClaimIds = accepted.map((claim) => claim.id);
  return document;
}

function parseContextPack(value: unknown): LessonContextPackV1 {
  const pack = objectInput(value, "Lesson context pack");
  const generatedAt = stringValue(pack, "generatedAt", 8, 80);
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs)) {
    throw new Error("generatedAt must be an ISO date-time.");
  }
  const lookbackDays = integerValue(pack, "lookbackDays", 1, 30);
  if (!Array.isArray(pack.signals) || pack.signals.length > 8) {
    throw new Error("A lesson context pack may contain at most eight signals.");
  }
  const signals = pack.signals.map((value, index) => {
    const signal = objectInput(value, "Context signal " + (index + 1));
    const confidence =
      signal.confidence === undefined
        ? undefined
        : finiteNumberValue(signal, "confidence", 0, 1);
    const observedAt = stringValue(signal, "observedAt", 8, 80);
    const observedAtMs = Date.parse(observedAt);
    if (
      !Number.isFinite(observedAtMs) ||
      observedAtMs < generatedAtMs - lookbackDays * 24 * 60 * 60 * 1000 ||
      observedAtMs > generatedAtMs + 5 * 60 * 1000
    ) {
      throw new Error(
        "Context signals must come from the declared recent-task lookback window.",
      );
    }
    return {
      id: stringValue(signal, "id", 2, 120),
      summary: stringValue(signal, "summary", 3, 280),
      kind: enumValue(
        signal,
        "kind",
        [
          "stated_goal",
          "prior_knowledge",
          "current_project",
          "preference",
          "accessibility",
          "business_constraint",
        ] as const,
      ),
      observedAt,
      sourceLabel: stringValue(signal, "sourceLabel", 2, 160),
      ...(confidence === undefined ? {} : { confidence }),
    };
  });

  if (Array.isArray(pack.topicRadar) && pack.topicRadar.length > 12) {
    throw new Error("A lesson context pack may contain at most twelve topic-radar signals.");
  }
  const topicRadar = Array.isArray(pack.topicRadar)
    ? pack.topicRadar.map((value, index) => {
        const signal = objectInput(value, "Topic radar signal " + (index + 1));
        const learnerRelevance = finiteNumberValue(
          signal,
          "learnerRelevance",
          0,
          1,
        );
        const officialRecency = finiteNumberValue(
          signal,
          "officialRecency",
          0,
          1,
        );
        const communityCorroboration = finiteNumberValue(
          signal,
          "communityCorroboration",
          0,
          1,
        );
        const officialUrl = optionalString(signal, "officialUrl", 1000);
        const officialPublishedAt = optionalString(
          signal,
          "officialPublishedAt",
          80,
        );
        const availability = optionalString(signal, "availability", 400);
        const retrievedAt = stringValue(signal, "retrievedAt", 8, 80);
        const retrievedAtMs = Date.parse(retrievedAt);
        if (
          !Number.isFinite(retrievedAtMs) ||
          retrievedAtMs > generatedAtMs + 5 * 60 * 1000
        ) {
          throw new Error("Topic-radar retrieval dates must be valid and not in the future.");
        }
        if (
          officialPublishedAt &&
          (!Number.isFinite(Date.parse(officialPublishedAt)) ||
            Date.parse(officialPublishedAt) > generatedAtMs + 5 * 60 * 1000)
        ) {
          throw new Error("Official topic-radar publication dates must be valid.");
        }
        const authority = enumValue(
          signal,
          "authority",
          ["official", "community_exploration"] as const,
        );
        if (
          signal.communitySources !== undefined &&
          !Array.isArray(signal.communitySources)
        ) {
          throw new Error("communitySources must be an array.");
        }
        if (
          Array.isArray(signal.communitySources) &&
          signal.communitySources.length > 5
        ) {
          throw new Error("Topic-radar signals may cite at most five community sources.");
        }
        const communitySources = Array.isArray(signal.communitySources)
          ? signal.communitySources.map((value, sourceIndex) => {
              const source = objectInput(
                value,
                `Community source ${sourceIndex + 1}`,
              );
              const url = stringValue(source, "url", 10, 1000);
              const publishedAt = stringValue(source, "publishedAt", 8, 80);
              const publishedAtMs = Date.parse(publishedAt);
              if (
                !Number.isFinite(publishedAtMs) ||
                publishedAtMs < generatedAtMs - 30 * 24 * 60 * 60 * 1000 ||
                publishedAtMs > generatedAtMs + 5 * 60 * 1000
              ) {
                throw new Error(
                  "Community topic-radar sources must be published within the previous 30 days.",
                );
              }
              return {
                url,
                publishedAt,
                ...(source.publisher === undefined
                  ? {}
                  : { publisher: stringValue(source, "publisher", 2, 160) }),
              };
            })
          : [];
        for (const source of communitySources) {
          let communityUrl: URL;
          try {
            communityUrl = new URL(source.url);
          } catch {
            throw new Error("Community topic-radar sources require valid HTTPS URLs.");
          }
          if (
            communityUrl.protocol !== "https:" ||
            communityUrl.username ||
            communityUrl.password ||
            communityUrl.hostname === "localhost" ||
            communityUrl.hostname.endsWith(".local")
          ) {
            throw new Error("Community topic-radar sources require valid HTTPS URLs.");
          }
        }
        if (officialRecency > 0 && !officialPublishedAt) {
          throw new Error(
            "Official recency points require an official publication date.",
          );
        }
        if (communityCorroboration > 0 && !communitySources.length) {
          throw new Error(
            "Community corroboration points require a dated community source.",
          );
        }
        if (authority === "official") {
          let sourceUrl: URL;
          try {
            sourceUrl = new URL(officialUrl ?? "");
          } catch {
            throw new Error("Official topic-radar signals require an OpenAI documentation URL.");
          }
          if (
            sourceUrl.protocol !== "https:" ||
            sourceUrl.username ||
            sourceUrl.password ||
            ![
              "learn.chatgpt.com",
              "developers.openai.com",
              "platform.openai.com",
              "help.openai.com",
              "openai.com",
            ].includes(sourceUrl.hostname)
          ) {
            throw new Error("Official topic-radar signals require an OpenAI documentation URL.");
          }
        } else if (!communitySources.length) {
          throw new Error(
            "Community exploration signals require at least one dated community source.",
          );
        }
        return {
          id: stringValue(signal, "id", 2, 120),
          topic: stringValue(signal, "topic", 2, 200),
          summary: stringValue(signal, "summary", 8, 600),
          retrievedAt,
          learnerRelevance,
          officialRecency,
          communityCorroboration,
          score:
            learnerRelevance * 0.5 +
            officialRecency * 0.3 +
            communityCorroboration * 0.2,
          authority,
          ...(officialUrl ? { officialUrl } : {}),
          ...(officialPublishedAt ? { officialPublishedAt } : {}),
          ...(availability ? { availability } : {}),
          ...(communitySources.length ? { communitySources } : {}),
        };
      })
    : [];

  topicRadar.sort((left, right) => right.score - left.score);

  return {
    generatedAt,
    lookbackDays,
    inspectedTaskCount: integerValue(pack, "inspectedTaskCount", 0, 10),
    signals,
    topicRadar,
  };
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
  const getStartBrief: WebMcpToolDefinition = {
    name: "learn_get_start_brief",
    description:
      "Read the learner-authored local lesson brief, personalization preference, and selected starter before a session exists.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    annotations: readOnlyAnnotations(),
    execute() {
      const brief = loadLessonBrief();
      return {
        brief,
        personalizationRequested: brief.personalizeFromRecentTasks,
        selectedStarterId: brief.starterId,
        instruction: "Use the lesson brief I prepared on this page.",
      };
    },
  };

  const getAuthoringCapabilitiesTool: WebMcpToolDefinition = {
    name: "learn_get_authoring_capabilities",
    description:
      "Read the shared V4 registry: content blocks, exercises, blueprints, limits, and source requirements.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    annotations: readOnlyAnnotations(),
    execute() {
      return getAuthoringCapabilities();
    },
  };

  const begin: WebMcpToolDefinition = {
    name: "learn_begin_session",
    description:
      "Required first call. Start or resume a learning session, create a progressive canvas skeleton, and return the guide plus context-discovery and canvas-only visual-output policies you must follow.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        topic: { type: "string", minLength: 3, maxLength: 240 },
        goal: { type: "string", minLength: 3, maxLength: 500 },
        briefId: { type: "string", minLength: 3, maxLength: 200 },
        blueprintId: { type: "string", minLength: 3, maxLength: 160 },
        pedagogicalMode: {
          type: "string",
          enum: ["conceptual", "quantitative", "code", "scenario", "mixed"],
        },
        personalizeFromRecentTasks: { type: "boolean" },
        hostCapabilities: {
          type: "array",
          maxItems: 32,
          items: { type: "string", minLength: 1, maxLength: 160 },
        },
        contextPack: {
          ...contextPackSchema,
          description:
            "Optional LessonContextPackV1 with at most eight derived signals from at most ten task summaries in the previous 30 days. Never include raw prompts, code, transcripts, or task ids.",
        },
      },
    },
    annotations: writeAnnotations(),
    execute(input) {
      const object = objectInput(input);
      const savedBrief = loadLessonBrief();
      const briefId = optionalString(object, "briefId", 200);
      if (briefId && briefId !== savedBrief.id) {
        throw new Error("The requested brief does not match the current saved landing brief.");
      }
      const useSavedBrief = Boolean(briefId) || object.topic === undefined;
      const topic =
        object.topic === undefined
          ? savedBrief.topic.trim()
          : stringValue(object, "topic", 3, 240);
      if (topic.length < 3) {
        throw new Error("Add a topic to the landing brief or provide topic explicitly.");
      }
      const goal =
        object.goal === undefined
          ? savedBrief.desiredOutcome.trim() || undefined
          : stringValue(object, "goal", 3, 500);
      if (
        object.personalizeFromRecentTasks !== undefined &&
        typeof object.personalizeFromRecentTasks !== "boolean"
      ) {
        throw new Error("personalizeFromRecentTasks must be boolean.");
      }
      const pedagogicalMode =
        object.pedagogicalMode === undefined
          ? useSavedBrief
            ? pedagogicalModeForBrief(savedBrief)
            : ("mixed" as PedagogicalMode)
          : enumValue(
              object,
              "pedagogicalMode",
              ["conceptual", "quantitative", "code", "scenario", "mixed"] as const,
            );
      return {
        ...actions.beginSession({
          topic,
          goal,
          briefId: useSavedBrief ? savedBrief.id : briefId,
          blueprintId:
            optionalString(object, "blueprintId", 160) ??
            (useSavedBrief ? savedBrief.blueprintId : "open_topic_v1"),
          pedagogicalMode,
          personalizeFromRecentTasks:
            typeof object.personalizeFromRecentTasks === "boolean"
              ? object.personalizeFromRecentTasks
              : useSavedBrief
                ? savedBrief.personalizeFromRecentTasks
                : undefined,
          contextPack:
            object.contextPack === undefined
              ? undefined
              : parseContextPack(object.contextPack),
          hostCapabilities: Array.isArray(object.hostCapabilities)
            ? stringArray(object, "hostCapabilities", 32)
            : [],
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
              summary: { type: "string", minLength: 3, maxLength: 280 },
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
          summary: stringValue(claim, "summary", 3, 280),
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
        topicRadar: state.topicRadar,
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
          schemaVersion: state.lesson.draft?.schemaVersion ?? 4,
          blueprintId:
            state.lesson.draft?.blueprintId ?? state.session.blueprintId,
          flow: state.lesson.draft?.flow ?? null,
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
      "Shape and compile a schema V4 lesson from any blueprint id. Prefer start → region → finalize so the learner watches the canvas take shape; complete accepts a full arbitrary-topic document.",
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
        schemaVersion: { type: "integer", enum: [4] },
        blueprintId: { type: "string", minLength: 3, maxLength: 160 },
        template: {
          type: "string",
          enum: ["transformer_technical_beginner"],
          description: "Deprecated V3 alias retained for one release.",
        },
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
            "For phase=start: V4 lesson metadata plus 3–20 stable region stubs and flow.",
        },
        region: {
          type: "object",
          description:
            "For phase=region: one complete trusted-content region matching a stub from the active outline.",
        },
        document: {
          type: "object",
          description:
            "LessonDocumentV4 with 3–20 regions, registered content, flow, and learner evidence.",
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
      if (
        object.schemaVersion !== undefined &&
        integerValue(object, "schemaVersion", 4, 4) !== 4
      ) {
        throw new Error("learn_prepare_lesson supports schema version 4.");
      }
      const current = actions.getState();
      const blueprintId =
        optionalString(object, "blueprintId", 160) ??
        (object.template === "transformer_technical_beginner"
          ? "transformer_technical_beginner"
          : current.session.blueprintId ?? "open_topic_v1");
      const blueprintDocument = defaultBlueprintLesson(actions, blueprintId);
      if (phase === "start") {
        const parsed = object.outline
          ? parseLessonOutline(object.outline)
          : blueprintDocument
            ? (() => {
                return {
                  document: documentMetadata(blueprintDocument),
                  regions: blueprintDocument.regions.map((region) => ({
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
                throw new Error(
                  "phase=start requires a V4 outline when the blueprint has no bundled starter.",
                );
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
          : blueprintDocument
            ? blueprintDocument.regions.find(
                (candidate) =>
                  candidate.id === stringValue(object, "regionId", 2, 120),
              )
            : undefined;
        if (!region) {
          throw new Error(
            "phase=region requires a complete region or a valid registered blueprint regionId.",
          );
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
      if (object.document === undefined && !blueprintDocument) {
        throw new Error(
          "A full V4 document is required when the blueprint is agent-authored.",
        );
      }
      return actions.prepareLesson({
        ...common,
        document:
          object.document !== undefined
            ? parseLessonDocument(object.document)
            : blueprintDocument!,
      });
    },
  };

  const registerAsset: WebMcpToolDefinition = {
    name: "learn_register_asset",
    description:
      "Validate and import one governed HTTPS image, audio, or video asset. The service rejects private destinations, spoofed MIME types, SVG, HTML, oversized files, and unsafe redirects.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce", "url", "kind", "caption", "attribution"],
      properties: {
        nonce: nonceSchema,
        url: { type: "string", minLength: 10, maxLength: 2000 },
        kind: { type: "string", enum: ["image", "audio", "video"] },
        caption: { type: "string", minLength: 3, maxLength: 800 },
        attribution: { type: "string", minLength: 2, maxLength: 800 },
        alt: { type: "string", minLength: 3, maxLength: 1200 },
        transcript: { type: "string", minLength: 3, maxLength: 20000 },
        captionsVtt: { type: "string", minLength: 3, maxLength: 4000 },
      },
    },
    annotations: writeAnnotations(true),
    async execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const kind = enumValue(object, "kind", ["image", "audio", "video"] as const);
      const alt = optionalString(object, "alt", 1200);
      const transcript = optionalString(object, "transcript", 20000);
      const captionsVtt = optionalString(object, "captionsVtt", 4000);
      if (kind === "image" && !alt) throw new Error("Images require alt text.");
      if ((kind === "audio" || kind === "video") && !transcript) {
        throw new Error("Audio and video require a transcript.");
      }
      if (kind === "video" && !captionsVtt) {
        throw new Error("Video requires a VTT captions reference.");
      }
      const result = await registerGovernedAsset({
        lessonId: actions.getState().session.id!,
        url: stringValue(object, "url", 10, 2000),
        kind,
        caption: stringValue(object, "caption", 3, 800),
        attribution: stringValue(object, "attribution", 2, 800),
        ...(alt ? { alt } : {}),
        ...(transcript ? { transcript } : {}),
        ...(captionsVtt ? { captionsVtt } : {}),
      });
      registeredAssetIds.add(result.asset.id);
      return result;
    },
  };

  const registerCodeExercise: WebMcpToolDefinition = {
    name: "learn_register_code_exercise",
    description:
      "Store an immutable server-side test manifest for one JavaScript, TypeScript, or Python code lab and return its exercise id. testManifest is JSON shaped as {entrypoint, tests:[{name,args,expected}]}; expected results never enter the lesson document.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["nonce", "language", "testManifest", "visibleTests"],
      properties: {
        nonce: nonceSchema,
        language: {
          type: "string",
          enum: ["javascript", "typescript", "python"],
        },
        testManifest: {
          type: "string",
          minLength: 4,
          maxLength: 32768,
          description:
            "JSON object with a simple exported-function entrypoint and one to twenty bounded {name,args,expected} test cases.",
        },
        visibleTests: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: { type: "string", minLength: 2, maxLength: 500 },
        },
      },
    },
    annotations: writeAnnotations(),
    async execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const result = await registerSandboxExercise({
        lessonId: actions.getState().session.id!,
        language: enumValue(
          object,
          "language",
          ["javascript", "typescript", "python"] as const,
        ),
        testManifest:
          typeof object.testManifest === "string"
            ? object.testManifest
            : (() => {
                throw new Error("testManifest must be a string.");
              })(),
        visibleTests: stringArray(object, "visibleTests", 20),
      });
      registeredCodeExerciseIds.add(result.exerciseId);
      return result;
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
    async execute(input) {
      const object = objectInput(input);
      requireNonce(object, actions);
      const draft = actions.getState().lesson.draft;
      if (draft) {
        const assetIds = draft.regions.flatMap((region) =>
          region.content
            .filter(
              (content): content is Extract<RegionContent, { type: "media" }> =>
                content.type === "media",
            )
            .map((content) => content.asset.id),
        );
        const exerciseIds = draft.regions.flatMap((region) =>
          region.interaction?.type === "code_lab"
            ? [region.interaction.exerciseId]
            : [],
        );
        const unknownAssets = assetIds.filter((id) => !registeredAssetIds.has(id));
        const unknownExercises = exerciseIds.filter(
          (id) => !registeredCodeExerciseIds.has(id),
        );
        if (unknownAssets.length || unknownExercises.length) {
          const validation = await validateLessonReferences({
            assetIds,
            exerciseIds,
          });
          if (!validation.valid) {
            throw new Error(
              "Lesson references are unresolved, failed, or expired: " +
                validation.issues.join("; "),
            );
          }
        }
      }
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
          schemaVersion: 4,
          trusted: Object.keys(getAuthoringCapabilities().content),
          exercises: Object.keys(getAuthoringCapabilities().exercises),
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
    getStartBrief,
    getAuthoringCapabilitiesTool,
    begin,
    getContext,
    proposeContext,
    getSession,
    prepareLesson,
    registerAsset,
    registerCodeExercise,
    publishLesson,
    getSnapshot,
    patchRegion,
    injectWidget,
    attachResearch,
    revertRegion,
  ];
}

export const v4ToolNames = [
  "learn_get_start_brief",
  "learn_get_authoring_capabilities",
  "learn_begin_session",
  "learn_get_context",
  "learn_propose_context",
  "learn_get_session",
  "learn_prepare_lesson",
  "learn_register_asset",
  "learn_register_code_exercise",
  "learn_publish_lesson",
  "learn_get_canvas_snapshot",
  "learn_patch_region",
  "learn_inject_widget",
  "learn_attach_research",
  "learn_revert_region",
] as const;

// Deprecated export retained for one release.
export const v3ToolNames = v4ToolNames;

export function activeToolNames(
  stage: LearningSessionStage,
  hasNonce: boolean,
): string[] {
  if (!hasNonce || stage === "ready") {
    return [
      "learn_get_start_brief",
      "learn_get_authoring_capabilities",
      "learn_begin_session",
    ];
  }
  const contextTools = [
    "learn_get_start_brief",
    "learn_get_authoring_capabilities",
    "learn_begin_session",
    "learn_get_session",
    "learn_get_context",
    "learn_propose_context",
    "learn_get_canvas_snapshot",
    "learn_prepare_lesson",
    "learn_register_asset",
    "learn_register_code_exercise",
  ];
  if (stage === "context_review") return contextTools;
  if (stage === "lesson_review") {
    return [...contextTools, "learn_publish_lesson"];
  }
  return [...v4ToolNames];
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
