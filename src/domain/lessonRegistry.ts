export const LESSON_LIMITS = {
  minimumRegions: 3,
  maximumRegions: 20,
  maximumOutgoingEdges: 3,
  maximumConditionalDecisions: 4,
  formulaBytes: 4 * 1024,
  diagramBytes: 16 * 1024,
  codeBytes: 32 * 1024,
  codeTimeoutMs: 5_000,
  codeOutputBytes: 64 * 1024,
  runsPerWindow: 20,
  runWindowMinutes: 10,
  maximumAssets: 8,
  maximumAssetBytes: 80 * 1024 * 1024,
  imageBytes: 8 * 1024 * 1024,
  audioBytes: 20 * 1024 * 1024,
  videoBytes: 40 * 1024 * 1024,
} as const;

export const CONTENT_REGISTRY = {
  prose: {
    label: "Prose",
    renderer: "Prose",
    lazy: false,
    accessibility: "Semantic heading and paragraph text",
  },
  key_points: {
    label: "Key points",
    renderer: "KeyPoints",
    lazy: false,
    accessibility: "Semantic unordered list",
  },
  token_sequence: {
    label: "Token sequence",
    renderer: "TokenSequence",
    lazy: false,
    accessibility: "Captioned token list",
  },
  attention_map: {
    label: "Attention map",
    renderer: "AttentionMap",
    lazy: false,
    accessibility: "Text explanation and numeric weights",
  },
  transformer_stack: {
    label: "Transformer stack",
    renderer: "TransformerStack",
    lazy: false,
    accessibility: "Ordered architecture stages",
  },
  comparison: {
    label: "Comparison",
    renderer: "Comparison",
    lazy: false,
    accessibility: "Semantic comparison table",
  },
  source_cards: {
    label: "Sources",
    renderer: "SourceCards",
    lazy: false,
    accessibility: "Linked source citations with claim summaries",
  },
  sandbox_widget: {
    label: "Sandboxed widget",
    renderer: "SandboxedWidget",
    lazy: true,
    accessibility: "Required textual summary",
  },
  formula: {
    label: "Formula",
    renderer: "Formula",
    lazy: true,
    engine: "KaTeX",
    accessibility: "HTML and MathML plus an authored explanation",
  },
  diagram: {
    label: "Diagram",
    renderer: "Diagram",
    lazy: true,
    engine: "Mermaid",
    accessibility: "Required title and long description",
  },
  code_example: {
    label: "Code example",
    renderer: "CodeExample",
    lazy: false,
    accessibility: "Escaped semantic code, caption, and line highlights",
  },
  media: {
    label: "Governed media",
    renderer: "Media",
    lazy: true,
    accessibility: "Alt text or transcript; video also requires VTT captions",
  },
} as const;

export const EXERCISE_REGISTRY = {
  choice: {
    label: "Single choice",
    executable: false,
    evidence: "Selected option and correctness",
  },
  reflection: {
    label: "Reflection",
    executable: false,
    evidence: "Learner-authored response",
  },
  numeric: {
    label: "Numeric answer",
    executable: false,
    evidence: "Numeric value, tolerance result, and optional unit",
  },
  code_lab: {
    label: "Code lab",
    executable: true,
    languages: ["javascript", "typescript", "python"],
    evidence: "Local source, source hash, result summary, and timestamp",
  },
} as const;

export const BLUEPRINT_REGISTRY = {
  open_topic_v1: {
    label: "Open topic",
    modes: ["conceptual", "quantitative", "code", "scenario", "mixed"],
    sourcePolicy: "evergreen",
  },
  codex_current_personalized_v1: {
    label: "Personalized Codex learning path",
    modes: ["mixed"],
    sourcePolicy: "current",
  },
  algebra_functions_v1: {
    label: "Algebra and functions",
    modes: ["quantitative"],
    sourcePolicy: "evergreen",
  },
  code_debugging_v1: {
    label: "JavaScript, TypeScript, or Python debugging",
    modes: ["code"],
    sourcePolicy: "evergreen",
  },
  transformer_technical_beginner: {
    label: "Transformer technical beginner",
    modes: ["conceptual"],
    sourcePolicy: "evergreen",
    deprecatedAlias: true,
  },
} as const;

export const LESSON_REGISTRY = {
  schemaVersion: 4,
  content: CONTENT_REGISTRY,
  exercises: EXERCISE_REGISTRY,
  blueprints: BLUEPRINT_REGISTRY,
  limits: LESSON_LIMITS,
  sourceRequirements: {
    evergreen: "Citations are optional unless the lesson makes externally verifiable claims.",
    current:
      "Product behavior requires an official source. Community-only signals must be labeled as exploration.",
  },
} as const;

export type RegisteredContentType = keyof typeof CONTENT_REGISTRY;
export type RegisteredExerciseType = keyof typeof EXERCISE_REGISTRY;
export type RegisteredBlueprintId = keyof typeof BLUEPRINT_REGISTRY;
