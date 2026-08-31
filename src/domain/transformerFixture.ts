import type {
  CanvasRegion,
  LessonDocumentV3,
  RegionProvenance,
} from "./agentCanvas";

const createdAt = "2026-08-31T14:00:00.000Z";

const ogramProvenance: RegionProvenance[] = [
  {
    actor: "ogram",
    label: "Bundled technical-beginner transformer path",
    sourceRefs: ["ogram:transformer-path-v1"],
    at: createdAt,
  },
];

export const transformerRegionIds = [
  "transformer-goal",
  "tokens-embeddings",
  "self-attention",
  "transformer-block",
  "next-token-practice",
  "teach-back",
] as const;

export function createTransformerSkeleton(): CanvasRegion[] {
  const titles = [
    ["01 · orientation", "What a transformer learns", "Set a useful finish line."],
    ["02 · representation", "Tokens become vectors", "Connect text to model inputs."],
    ["03 · core mechanism", "Self-attention", "See how each token gathers context."],
    ["04 · architecture", "Inside one transformer block", "Connect attention to the full block."],
    ["05 · practice", "Predict the training target", "Check the next-token objective."],
    ["06 · retrieval", "Explain it back", "Consolidate the mechanism in your own words."],
  ] as const;

  return transformerRegionIds.map((id, index) => {
    const item = titles[index]!;
    return {
      id,
      order: index + 1,
      label: item[0],
      title: item[1],
      objective: item[2],
      kind:
        index === 0
          ? "orient"
          : index === 4
            ? "practice"
            : index === 5
              ? "reflect"
              : "explain",
      revision: 0,
      status: "skeleton",
      content: [],
      provenance: [],
      history: [],
    } satisfies CanvasRegion;
  });
}

export const transformerLessonFixture: LessonDocumentV3 = {
  id: "lesson-transformers-v1",
  revision: 1,
  topic: "How transformers work",
  title: "How transformers build context",
  subtitle: "From tokens to attention to a next-token prediction",
  audience: "Technical beginner with basic coding and high-school algebra",
  estimatedMinutes: 14,
  objective:
    "Explain how tokens pass through self-attention and a transformer block to support next-token prediction.",
  approvedClaimIds: [],
  regions: [
    {
      id: "transformer-goal",
      order: 1,
      label: "01 · orientation",
      title: "What a transformer learns",
      objective: "Set a useful finish line for the session.",
      kind: "orient",
      content: [
        {
          type: "prose",
          heading: "The job in one sentence",
          text:
            "A language transformer repeatedly predicts what token should come next. To do that well, it builds a context-sensitive representation of every token it has seen.",
          emphasis:
            "By the end, you should be able to trace text through tokens, attention, and a next-token prediction.",
        },
        {
          type: "key_points",
          items: [
            "Tokens are model-readable pieces of text.",
            "Attention lets one token gather useful information from others.",
            "The same block is repeated to refine those representations.",
          ],
        },
      ],
      provenance: ogramProvenance,
    },
    {
      id: "tokens-embeddings",
      order: 2,
      label: "02 · representation",
      title: "Tokens become vectors",
      objective: "Connect visible text to the vectors processed by the model.",
      kind: "explain",
      content: [
        {
          type: "prose",
          text:
            "The tokenizer splits text into a finite vocabulary of pieces. An embedding table turns each token id into a vector; positional information is added so order is not lost.",
        },
        {
          type: "token_sequence",
          tokens: ["The", "model", "learns", "context"],
          highlightedIndex: 3,
          caption:
            "Each token starts with a learned vector. Its meaning becomes more contextual as it moves through the network.",
        },
      ],
      provenance: ogramProvenance,
    },
    {
      id: "self-attention",
      order: 3,
      label: "03 · core mechanism",
      title: "Self-attention: gather the useful context",
      objective: "Explain query, key, value, and normalized attention weights.",
      kind: "model",
      content: [
        {
          type: "prose",
          heading: "Three views of every token",
          text:
            "Each token produces a query, a key, and a value. The query asks what information is useful, keys advertise what each token contains, and values carry the information that will be mixed.",
          emphasis:
            "Query–key scores are normalized with softmax; the resulting weights blend the value vectors.",
        },
        {
          type: "attention_map",
          tokens: ["The", "model", "learns", "context"],
          focusIndex: 3,
          weights: [0.08, 0.29, 0.18, 0.45],
          explanation:
            "For the token “context”, this illustrative head places more weight on “model” and on the token itself. Real weights are learned and differ by layer and head.",
        },
      ],
      provenance: ogramProvenance,
    },
    {
      id: "transformer-block",
      order: 4,
      label: "04 · architecture",
      title: "Inside one transformer block",
      objective: "Connect attention to the larger repeated computation.",
      kind: "explain",
      content: [
        {
          type: "transformer_stack",
          stages: [
            { label: "Token vectors", detail: "Current representation for every position" },
            { label: "Multi-head attention", detail: "Several learned context-gathering views" },
            { label: "Add + normalize", detail: "Preserve the earlier signal and stabilize scale" },
            { label: "Feed-forward network", detail: "Transform each position independently" },
            { label: "Add + normalize", detail: "Produce the next layer’s representations" },
          ],
          caption:
            "A model stacks many blocks. Later layers can assemble progressively more useful contextual features.",
        },
        {
          type: "prose",
          text:
            "Multiple attention heads can specialize in different relationships. Residual connections keep information flowing, while the feed-forward network adds per-token computation.",
        },
      ],
      provenance: ogramProvenance,
    },
    {
      id: "next-token-practice",
      order: 5,
      label: "05 · practice",
      title: "What is the training target?",
      objective: "Distinguish the model’s training objective from its internal mechanism.",
      kind: "practice",
      content: [
        {
          type: "prose",
          text:
            "Attention is a mechanism inside the model. The learning signal usually comes from comparing its predicted next-token distribution with the actual next token.",
        },
      ],
      interaction: {
        type: "choice",
        prompt: "After reading “The cat sat on the”, what is the model trained to produce?",
        options: [
          {
            id: "sentence-label",
            label: "A label for the entire sentence",
            correct: false,
            feedback: "That is possible in a classifier, but it is not the core language-model objective.",
          },
          {
            id: "next-token",
            label: "A probability distribution for the next token",
            correct: true,
            feedback:
              "Exactly. Training increases the probability assigned to the observed next token across many text sequences.",
          },
          {
            id: "attention-rule",
            label: "A hand-written attention rule",
            correct: false,
            feedback: "Attention patterns are learned through optimization rather than supplied as rules.",
          },
        ],
      },
      provenance: ogramProvenance,
    },
    {
      id: "teach-back",
      order: 6,
      label: "06 · retrieval",
      title: "Explain the path back",
      objective: "Retrieve the full mechanism in plain language.",
      kind: "reflect",
      content: [
        {
          type: "prose",
          text:
            "A useful explanation connects the pieces instead of listing jargon. Start with text, name what attention changes, and finish with the prediction objective.",
        },
      ],
      interaction: {
        type: "reflection",
        prompt: "In your own words, how does a transformer turn text into a next-token prediction?",
        placeholder: "Text is split into tokens. Then…",
        minimumCharacters: 60,
        feedback:
          "Good retrieval. Compare your answer with the notebook: tokens → vectors → attention-weighted context → repeated blocks → next-token distribution.",
      },
      provenance: ogramProvenance,
    },
  ],
};
