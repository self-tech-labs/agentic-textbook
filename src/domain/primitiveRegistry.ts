import { primitiveIds } from "./experience";
import type { LearningRole, PrimitiveId } from "./experience";

export interface PrimitiveDefinition {
  id: PrimitiveId;
  version: "1";
  mechanism: string;
  evidenceTier: "replicated" | "promising" | "experimental";
  supportedRoles: LearningRole[];
  emits: string[];
  accessibilityContract: string[];
  complexityCost: number;
  requires: string[];
  forbids: string[];
  researchReferences: string[];
}

export const primitiveRegistry: Record<PrimitiveId, PrimitiveDefinition> = {
  "orient.objective": {
    id: "orient.objective",
    version: "1",
    mechanism: "Makes the desired capability and observable finish line explicit.",
    evidenceTier: "promising",
    supportedRoles: ["activate", "explain"],
    emits: ["runtime.node.entered"],
    accessibilityContract: ["Semantic heading", "Success criteria remain visible"],
    complexityCost: 1,
    requires: ["At least one success criterion"],
    forbids: ["Completion evidence"],
    researchReferences: ["Goal-setting and self-regulated learning"],
  },
  "diagnose.prediction": {
    id: "diagnose.prediction",
    version: "1",
    mechanism: "Activates prior knowledge before explanation and captures calibration.",
    evidenceTier: "replicated",
    supportedRoles: ["activate", "retrieve", "assess"],
    emits: ["runtime.response.submitted", "runtime.feedback.presented"],
    accessibilityContract: ["Keyboard-selectable options", "No time limit", "Text feedback"],
    complexityCost: 2,
    requires: ["Corrective feedback for every option"],
    forbids: ["Hidden solution before an attempt"],
    researchReferences: ["Pretesting effect", "Metacognitive calibration"],
  },
  "explain.concept": {
    id: "explain.concept",
    version: "1",
    mechanism: "Offers a bounded explanation tied to the active objective.",
    evidenceTier: "replicated",
    supportedRoles: ["explain"],
    emits: ["runtime.node.entered"],
    accessibilityContract: ["Plain text representation", "Readable line length"],
    complexityCost: 1,
    requires: ["One concise key point"],
    forbids: ["Passive completion claim"],
    researchReferences: ["Cognitive load theory", "Coherence principle"],
  },
  "model.worked_example": {
    id: "model.worked_example",
    version: "1",
    mechanism: "Models a solution path before a parallel learner attempt.",
    evidenceTier: "replicated",
    supportedRoles: ["model", "explain"],
    emits: ["runtime.node.entered"],
    accessibilityContract: ["Ordered textual steps", "No animation dependency"],
    complexityCost: 2,
    requires: ["A later practice or transfer opportunity"],
    forbids: ["Revealing the answer to the same scored item"],
    researchReferences: ["Worked-example effect", "Guidance fading"],
  },
  "practice.choice": {
    id: "practice.choice",
    version: "1",
    mechanism: "Requires a consequential decision and delivers explanatory feedback.",
    evidenceTier: "replicated",
    supportedRoles: ["practice", "retrieve", "assess"],
    emits: ["runtime.response.submitted", "runtime.feedback.presented"],
    accessibilityContract: ["Native buttons", "Keyboard operation", "Visible selected state"],
    complexityCost: 2,
    requires: ["At least two options", "Feedback for every distractor"],
    forbids: ["Agent-submitted learner answer"],
    researchReferences: ["Retrieval practice", "Explanatory feedback"],
  },
  "practice.sort": {
    id: "practice.sort",
    version: "1",
    mechanism: "Makes the learner discriminate and organize examples by a rule.",
    evidenceTier: "promising",
    supportedRoles: ["practice", "retrieve", "assess"],
    emits: ["runtime.response.submitted", "runtime.feedback.presented"],
    accessibilityContract: ["Select-menu fallback", "No drag-only interaction"],
    complexityCost: 3,
    requires: ["Two or more buckets", "Corrective feedback"],
    forbids: ["Drag-only completion"],
    researchReferences: ["Comparison and category learning"],
  },
  "consolidate.reflection": {
    id: "consolidate.reflection",
    version: "1",
    mechanism: "Asks the learner to explain a principle in their own words.",
    evidenceTier: "promising",
    supportedRoles: ["reflect", "retrieve", "assess"],
    emits: ["runtime.response.submitted"],
    accessibilityContract: ["Labeled text area", "No stylistic scoring"],
    complexityCost: 2,
    requires: ["A meaningful prompt"],
    forbids: ["Automatic mastery from text length alone"],
    researchReferences: ["Self-explanation effect"],
  },
  "transfer.commitment": {
    id: "transfer.commitment",
    version: "1",
    mechanism: "Connects the new capability to a real cue and observable proof.",
    evidenceTier: "promising",
    supportedRoles: ["transfer", "assess"],
    emits: ["runtime.response.submitted", "runtime.completed"],
    accessibilityContract: ["Labeled text area", "Cue and proof shown in text"],
    complexityCost: 2,
    requires: ["A specific future cue", "Observable proof"],
    forbids: ["Claiming delayed transfer at lesson completion"],
    researchReferences: ["Implementation intentions", "Transfer-appropriate processing"],
  },
  "media.explainer": {
    id: "media.explainer",
    version: "1",
    mechanism: "Adds objective-linked visual, audio, or video explanation through a governed asset.",
    evidenceTier: "replicated",
    supportedRoles: ["explain", "model"],
    emits: ["runtime.node.entered"],
    accessibilityContract: ["Alt text", "Caption", "Transcript for time-based media"],
    complexityCost: 3,
    requires: ["Registered asset handle", "Text alternative"],
    forbids: ["Decorative media counted as evidence", "Unchecked embed code"],
    researchReferences: ["Multimedia learning principles"],
  },
};

export function isPrimitiveId(value: unknown): value is PrimitiveId {
  return typeof value === "string" && primitiveIds.includes(value as PrimitiveId);
}

export function getPrimitiveDefinition(
  primitiveId: PrimitiveId,
): PrimitiveDefinition {
  return primitiveRegistry[primitiveId];
}

export const canvasContract = {
  specVersion: "1.0",
  registryVersion: "ogram.learning.v1",
  pedagogyPolicyVersion: "2026.1",
  authoringModel:
    "The agent authors a declarative learning application. Ogram compiles, renders, remembers, and governs it.",
  contextSources: {
    model:
      "Every personalization claim is a reviewable hypothesis with provenance, purpose, sensitivity, and an opaque evidence reference.",
    supportedRoutes: [
      "learner input",
      "Codex observation",
      "Ogram profile, pixel, or journey",
      "any connected MCP provider through connected_mcp plus sourceDetail",
    ],
    connectedSourceRequirements: [
      "name the provider and resource type",
      "minimize the claim instead of copying source material",
      "keep raw files, messages, and credentials outside the claim",
      "wait for learner acceptance before personalization",
    ],
  },
  agentNativeCanvas: {
    model:
      "The Codex conversation reads and writes stable semantic notebook regions. The page contains no secondary chat or pinned-question workflow.",
    trustedContentTypes: [
      "prose",
      "key_points",
      "token_sequence",
      "attention_map",
      "transformer_stack",
      "comparison",
      "source_cards",
    ],
    sandboxWidget: {
      sandbox: "allow-scripts",
      network: false,
      sameOrigin: false,
      htmlBytes: 12_288,
      cssBytes: 12_288,
      javascriptBytes: 24_576,
    },
    visualGuidelines: [
      "Choose the smallest representation that makes the concept materially easier to understand.",
      "Keep one dominant visual or explanatory structure per region change.",
      "Label important values and relationships directly and preserve a text alternative.",
      "Keep controls keyboard accessible, layouts responsive, and meaning independent of color.",
      "Prefer a trusted declarative renderer; use the bounded sandbox only when interaction materially helps.",
    ],
    learnerAuthority: [
      "Only the learner submits answers and reflection.",
      "Agent edits are visibly attributed, concurrency-safe, and undoable.",
      "A region write never rewrites completed evidence, consent receipts, or publication history.",
    ],
  },
  writingGuidelines: {
    audience:
      "Write for a learner who wants to understand and practise a useful skill, not for an audience being sold an idea.",
    voice: [
      "Use calm, direct, explanatory language and complete sentences.",
      "Prefer familiar words. Define a necessary technical term the first time it appears.",
      "Explain why an answer works and what the learner should do next.",
      "Use a concrete example when an abstract rule could be misunderstood.",
    ],
    structure: [
      "Give the minimum context needed before asking the learner to act.",
      "Ask one clear question or request one clear action at a time.",
      "Keep activity headings short enough to scan; put supporting detail in body copy.",
      "Make transfer prompts name a recognisable real-world situation and a practical next step.",
    ],
    avoid: [
      "Slogan-like contrasts, parallel fragments, and sentences written to sound like punchlines.",
      "Metaphors as the main explanation of a rule or task.",
      "Artificial constraints such as banning ordinary words from an answer.",
      "Cryptic labels such as signal, debris, boundary, or proof unless the lesson first explains exactly what they mean.",
      "A heading that contains the context, the instruction, and the success criterion all at once.",
    ],
    examples: [
      {
        avoid: "Which move preserves signal without preserving debris?",
        prefer: "Which option should you use before creating the follow-up page?",
      },
      {
        avoid:
          "Explain the difference without using the words ‘more context’ or ‘less context’.",
        prefer:
          "In your own words, when would you fork a task, and when would you start a new one?",
      },
    ],
  },
  limits: {
    objectives: { min: 1, max: 3 },
    nodes: { min: 3, max: 30 },
    maxEstimatedMinutes: 45,
    maxAssets: 8,
    arbitraryHtmlCssJavascript: "sandbox_only",
    boundedCyclesOnly: true,
  },
  humanOnlyActions: [
    "review context claims",
    "approve publication",
    "answer learning interactions",
    "submit feedback",
    "certify real-world proof",
  ],
  authorableDimensions: [
    "objectives",
    "content",
    "topology",
    "branching",
    "interaction",
    "feedback",
    "scaffolding",
    "transfer",
    "governed media references",
  ],
  primitives: Object.values(primitiveRegistry),
} as const;
