import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const SignalIdSchema = Type.Union([
  Type.Literal("thread_hygiene"),
  Type.Literal("workspace_hygiene"),
  Type.Literal("effort_fit"),
  Type.Literal("task_shaping"),
]);

const SignalLevelSchema = Type.Union([
  Type.Literal("watch"),
  Type.Literal("practice"),
  Type.Literal("priority"),
]);

export const EmptyInputSchema = Type.Object({}, { additionalProperties: false });

export const PracticeReviewInputSchema = Type.Object(
  {
    signals: Type.Array(
      Type.Object(
        {
          id: SignalIdSchema,
          level: SignalLevelSchema,
          confidence: Type.Number({ minimum: 0, maximum: 1 }),
          occurrences: Type.Integer({ minimum: 1, maximum: 8 }),
          sampleSize: Type.Integer({ minimum: 1, maximum: 8 }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 4 },
    ),
  },
  { additionalProperties: false },
);

export const PublishCapsuleInputSchema = Type.Object(
  {
    focus: SignalIdSchema,
    difficulty: Type.Optional(
      Type.Union([Type.Literal("guided"), Type.Literal("stretch")]),
    ),
    practiceMode: Type.Optional(
      Type.Union([Type.Literal("decision"), Type.Literal("rehearsal")]),
    ),
    proofMode: Type.Optional(
      Type.Union([Type.Literal("next_action"), Type.Literal("observed_habit")]),
    ),
  },
  { additionalProperties: false },
);

export const LearningModuleInputSchema = Type.Object(
  {
    capsuleId: Type.String({ minLength: 8, maxLength: 100 }),
    templateId: Type.Union([
      Type.Literal("context_packing"),
      Type.Literal("reasoning_match"),
      Type.Literal("clean_handoff"),
      Type.Literal("effort_triage"),
    ]),
  },
  { additionalProperties: false },
);

export type PracticeReviewInput = Static<typeof PracticeReviewInputSchema>;
export type PublishCapsuleInput = Static<typeof PublishCapsuleInputSchema>;
export type LearningModuleToolInput = Static<typeof LearningModuleInputSchema>;

export function parseToolInput<T extends TSchema>(
  schema: T,
  input: unknown,
): Static<T> {
  if (Value.Check(schema, input)) return input as Static<T>;

  const first = [...Value.Errors(schema, input)][0];
  const location = first?.path || "input";
  const message = first?.message ?? "does not match the required schema";
  throw new Error(`Invalid tool input at ${location}: ${message}.`);
}
