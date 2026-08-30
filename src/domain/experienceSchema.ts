import { primitiveIds } from "./experience";

export type JsonSchema = Record<string, unknown>;

export const learningExperienceInputSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "specVersion",
    "registryVersion",
    "pedagogyPolicyVersion",
    "experienceId",
    "draftRevision",
    "contextSnapshotId",
    "learningBriefId",
    "metadata",
    "objectives",
    "nodes",
    "edges",
    "entryNodeId",
    "completion",
    "adaptation",
    "assets",
    "provenance",
  ],
  properties: {
    specVersion: { const: "1.0" },
    registryVersion: { const: "ogram.learning.v1" },
    pedagogyPolicyVersion: { const: "2026.1" },
    experienceId: { type: "string", minLength: 4, maxLength: 120 },
    draftRevision: { type: "integer", minimum: 1 },
    contextSnapshotId: { type: "string", minLength: 4, maxLength: 160 },
    learningBriefId: { type: "string", minLength: 4, maxLength: 160 },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["title", "locale", "estimatedMinutes", "rationale", "theme"],
      properties: {
        title: { type: "string", minLength: 4, maxLength: 140 },
        locale: { type: "string", minLength: 2, maxLength: 20 },
        estimatedMinutes: { type: "integer", minimum: 1, maximum: 90 },
        rationale: { type: "string", minLength: 16, maxLength: 600 },
        theme: {
          type: "string",
          enum: ["field-notes", "decision-lab", "systems-map"],
        },
      },
    },
    objectives: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "statement", "successCriteria"],
        properties: {
          id: { type: "string", minLength: 3, maxLength: 100 },
          statement: { type: "string", minLength: 12, maxLength: 320 },
          successCriteria: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: { type: "string", minLength: 5, maxLength: 220 },
          },
        },
      },
    },
    nodes: {
      type: "array",
      minItems: 3,
      maxItems: 30,
      items: {
        type: "object",
        required: [
          "id",
          "primitiveId",
          "primitiveVersion",
          "learningRole",
          "objectiveIds",
          "props",
        ],
        properties: {
          id: { type: "string", minLength: 3, maxLength: 100 },
          primitiveId: { type: "string", enum: primitiveIds },
          primitiveVersion: { const: "1" },
          learningRole: {
            type: "string",
            enum: [
              "activate",
              "explain",
              "model",
              "practice",
              "retrieve",
              "assess",
              "reflect",
              "transfer",
            ],
          },
          objectiveIds: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          props: {
            type: "object",
            description:
              "Primitive-specific props governed by the matching primitive contract.",
          },
        },
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        required: ["id", "from", "to", "condition"],
        properties: {
          id: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          condition: {
            type: "object",
            description:
              "A bounded condition: always, answer_equals, or response_correct. No executable expressions.",
          },
        },
        additionalProperties: false,
      },
    },
    entryNodeId: { type: "string" },
    completion: { type: "object" },
    adaptation: { type: "object" },
    assets: { type: "array", maxItems: 8 },
    provenance: { type: "array", minItems: 1, maxItems: 30 },
  },
};
