import type {
  ContextClaim,
  LearningBrief,
  LearningExperienceDocument,
} from "./experience";

export const fixtureContextSnapshotId = "context-snapshot-demo-01";

export const fixtureContextClaims: ContextClaim[] = [
  {
    id: "claim-goal-portable-context",
    kind: "stated_goal",
    summary:
      "I want to move from research to production in Codex without carrying irrelevant context forward.",
    source: "learner",
    sensitivity: "low",
    evidenceRefs: ["learner-onboarding:goal-1"],
    allowedPurposes: ["lesson_personalization", "transfer_prompt"],
    observedAt: "2026-08-29T08:00:00.000Z",
    review: "accepted",
  },
  {
    id: "claim-pattern-phase-change",
    kind: "behaviour_pattern",
    summary:
      "In six of eight authorized recent tasks, exploration and production remained in one thread after the deliverable changed.",
    source: "codex_observation",
    confidence: 0.92,
    sensitivity: "personal",
    evidenceRefs: ["codex-review:privacy-minimized-counts"],
    allowedPurposes: ["lesson_personalization"],
    observedAt: "2026-08-29T08:04:00.000Z",
    expiresAt: "2026-09-05T08:04:00.000Z",
    review: "accepted",
  },
  {
    id: "claim-business-client-followup",
    kind: "business_constraint",
    summary:
      "The learner regularly turns approved workshop decisions into concise client follow-ups.",
    source: "ogram_profile",
    sensitivity: "personal",
    evidenceRefs: ["ogram-workshop:mock-profile"],
    allowedPurposes: ["lesson_personalization", "example_selection"],
    observedAt: "2026-08-28T15:00:00.000Z",
    review: "accepted",
  },
  {
    id: "claim-preference-short-practice",
    kind: "preference",
    summary:
      "The learner prefers one concrete practice under ten minutes with a visible definition of done.",
    source: "ogram_profile",
    sensitivity: "low",
    evidenceRefs: ["ogram-workshop:mock-preference"],
    allowedPurposes: ["lesson_duration", "interaction_density"],
    observedAt: "2026-08-28T15:00:00.000Z",
    review: "accepted",
  },
];

export const fixtureLearningBrief: LearningBrief = {
  id: "brief-portable-context-01",
  version: 1,
  desiredCapability:
    "Recognize a change in deliverable and choose whether to continue, fork, or start fresh.",
  whyNow:
    "A repeated phase-change pattern is adding irrelevant history precisely when execution should become clearer.",
  transferContext:
    "The next time research, strategy, or exploration becomes a separate production deliverable in Codex.",
  estimatedMinutes: 8,
  locale: "en-CH",
  approvedClaimIds: fixtureContextClaims.map((claim) => claim.id),
  prohibitedUses: [
    "Do not reconstruct raw task content.",
    "Do not infer sensitive traits.",
    "Do not certify workplace performance from lesson completion.",
  ],
  createdAt: "2026-08-29T08:06:00.000Z",
};

const sharedAdaptation = {
  mode: "learner_reviewed",
  maxRevisionsPerSession: 3,
  preserveCompletedEvidence: true,
} as const;

const sharedProvenance = [
  {
    id: "prov-pedagogy-retrieval",
    lane: "pedagogy",
    label: "Retrieval before explanation, explanatory feedback, and transfer cue",
    sourceRef: "ogram-policy:2026.1",
  },
  {
    id: "prov-personalization-goal",
    lane: "personalization",
    label: "Learner-approved goal",
    sourceRef: "claim-goal-portable-context",
  },
  {
    id: "prov-personalization-pattern",
    lane: "personalization",
    label: "Learner-approved behavioral hypothesis",
    sourceRef: "claim-pattern-phase-change",
  },
  {
    id: "prov-generation",
    lane: "generation",
    label: "Composed through the Ogram canvas contract",
    sourceRef: "webmcp:design-transaction",
  },
] satisfies LearningExperienceDocument["provenance"];

export const decisionLabExperience: LearningExperienceDocument = {
  specVersion: "1.0",
  registryVersion: "ogram.learning.v1",
  pedagogyPolicyVersion: "2026.1",
  experienceId: "experience-three-doors",
  draftRevision: 1,
  contextSnapshotId: fixtureContextSnapshotId,
  learningBriefId: fixtureLearningBrief.id,
  metadata: {
    title: "The three doors",
    locale: "en-CH",
    estimatedMinutes: 8,
    rationale:
      "A branching decision lab turns a repeated working pattern into one choice the learner can recognize and transfer today.",
    theme: "decision-lab",
  },
  objectives: [
    {
      id: "objective-boundary-choice",
      statement:
        "Choose continue, fork, or fresh when a Codex task changes deliverable.",
      successCriteria: [
        "Names whether the goal or only the next step changed",
        "Preserves useful decisions without carrying rejected exploration",
      ],
    },
  ],
  nodes: [
    {
      id: "door-objective",
      primitiveId: "orient.objective",
      primitiveVersion: "1",
      learningRole: "activate",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        heading: "Know when the work has changed rooms",
        body:
          "The goal is not to keep threads short. It is to carry the right memory across a real change in work.",
        successCriteria: [
          "Spot the deliverable boundary",
          "Choose the smallest context transition that preserves useful decisions",
        ],
        relevance:
          "Your approved context points to phase changes—not lack of context—as today’s friction.",
      },
    },
    {
      id: "door-prediction",
      primitiveId: "diagnose.prediction",
      primitiveVersion: "1",
      learningRole: "activate",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        context:
          "A long task contains the approved workshop strategy, abandoned alternatives, and several exploratory detours. The strategy is now final.",
        prompt:
          "Before seeing the rule: where should the standalone client follow-up begin?",
        askConfidence: true,
        options: [
          {
            id: "continue",
            label: "Continue here",
            description: "Keep every turn and switch directly into production.",
            correct: false,
            feedback:
              "Continuing keeps useful decisions, but it also keeps the exploration that no longer serves the new deliverable.",
          },
          {
            id: "fork",
            label: "Fork the task",
            description: "Inherit the useful decisions in a clean execution branch.",
            correct: true,
            feedback:
              "A fork preserves the approved decisions while giving the new deliverable a clean working surface.",
          },
          {
            id: "fresh",
            label: "Start fresh",
            description: "Open an unrelated task with no inherited context.",
            correct: false,
            feedback:
              "Fresh removes the debris, but also discards approved decisions that the follow-up genuinely needs.",
          },
        ],
      },
    },
    {
      id: "door-rule",
      primitiveId: "explain.concept",
      primitiveVersion: "1",
      learningRole: "explain",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        title: "Let the goal choose the door",
        body:
          "Continue when the goal and deliverable are still the same. Fork when useful decisions should survive but the deliverable changes. Start fresh when the new goal is unrelated or inherited context would mislead.",
        keyPoint:
          "Context is valuable by relevance, not by volume: preserve decisions, release debris.",
        sourceLabel: "Ogram policy · context portability",
      },
    },
    {
      id: "door-scenario",
      primitiveId: "practice.choice",
      primitiveVersion: "1",
      learningRole: "practice",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        context:
          "You explored three workshop formats, rejected two, and approved one. The next job is a polished follow-up page for the selected format.",
        prompt: "Which move preserves signal without preserving debris?",
        askConfidence: true,
        options: [
          {
            id: "continue",
            label: "Continue in the exploration task",
            description: "The approved answer is already there.",
            correct: false,
            feedback:
              "The answer is there, but so are competing formats and obsolete constraints. The deliverable has changed.",
          },
          {
            id: "fork",
            label: "Fork from the approved strategy",
            description: "Carry a short handoff and build in a clean branch.",
            correct: true,
            feedback:
              "Exactly. The goal is related, the deliverable is new, and the approved decisions are worth inheriting.",
          },
          {
            id: "fresh",
            label: "Start with an empty task",
            description: "Recreate the facts from memory.",
            correct: false,
            feedback:
              "That creates avoidable recall work and risks losing the decisions the new artifact must respect.",
          },
        ],
      },
    },
    {
      id: "door-remediation",
      primitiveId: "model.worked_example",
      primitiveVersion: "1",
      learningRole: "model",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        title: "A boundary test in three questions",
        scenario:
          "A researcher finishes comparing vendors and now needs to write the procurement recommendation.",
        steps: [
          { label: "1 · Goal", detail: "Related: the recommendation uses the research." },
          { label: "2 · Deliverable", detail: "Changed: comparison work becomes a decision document." },
          { label: "3 · Memory", detail: "Selective: approved evidence matters; abandoned searches do not." },
        ],
        takeaway: "Related goal + new deliverable + useful decisions = fork.",
      },
    },
    {
      id: "door-retry",
      primitiveId: "practice.choice",
      primitiveVersion: "1",
      learningRole: "retrieve",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        context:
          "A pricing analysis is finished. You now need a short board memo using only the approved assumptions.",
        prompt: "Choose again on a parallel case.",
        options: [
          {
            id: "continue",
            label: "Continue",
            correct: false,
            feedback: "The new artifact would still inherit discarded assumptions and analysis chatter.",
          },
          {
            id: "fork",
            label: "Fork",
            correct: true,
            feedback: "Yes. The related decision context should survive; the working debris should not.",
          },
          {
            id: "fresh",
            label: "Fresh",
            correct: false,
            feedback: "A clean slate would unnecessarily discard approved pricing assumptions.",
          },
        ],
      },
    },
    {
      id: "door-explain-back",
      primitiveId: "consolidate.reflection",
      primitiveVersion: "1",
      learningRole: "reflect",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        prompt:
          "Explain the difference between a fork and a fresh task without using the words ‘more context’ or ‘less context’.",
        sentenceStarter: "A fork is appropriate when…",
        minimumCharacters: 36,
        feedback:
          "Good: the durable distinction is whether approved decisions still belong to the next goal.",
      },
    },
    {
      id: "door-transfer",
      primitiveId: "transfer.commitment",
      primitiveVersion: "1",
      learningRole: "transfer",
      objectiveIds: ["objective-boundary-choice"],
      props: {
        prompt:
          "Name the real deliverable boundary you will watch for next, and what you will carry into the new task.",
        cue: "The noun describing the deliverable changes.",
        proof: "A new production task begins with a short handoff of approved decisions.",
        minimumCharacters: 32,
      },
    },
  ],
  edges: [
    { id: "door-e1", from: "door-objective", to: "door-prediction", condition: { op: "always" } },
    { id: "door-e2", from: "door-prediction", to: "door-rule", condition: { op: "always" } },
    { id: "door-e3", from: "door-rule", to: "door-scenario", condition: { op: "always" } },
    { id: "door-e4", from: "door-scenario", to: "door-explain-back", condition: { op: "answer_equals", nodeId: "door-scenario", value: "fork" } },
    { id: "door-e5", from: "door-scenario", to: "door-remediation", condition: { op: "always" } },
    { id: "door-e6", from: "door-remediation", to: "door-retry", condition: { op: "always" } },
    { id: "door-e7", from: "door-retry", to: "door-explain-back", condition: { op: "always" } },
    { id: "door-e8", from: "door-explain-back", to: "door-transfer", condition: { op: "always" } },
  ],
  entryNodeId: "door-objective",
  completion: {
    requiredObjectiveIds: ["objective-boundary-choice"],
    requiredNodeIds: ["door-explain-back", "door-transfer"],
    minimumUnassistedAttempts: 3,
    requireTransfer: true,
  },
  adaptation: sharedAdaptation,
  assets: [],
  provenance: sharedProvenance,
};

export const systemsMapExperience: LearningExperienceDocument = {
  specVersion: "1.0",
  registryVersion: "ogram.learning.v1",
  pedagogyPolicyVersion: "2026.1",
  experienceId: "experience-context-signal-map",
  draftRevision: 1,
  contextSnapshotId: fixtureContextSnapshotId,
  learningBriefId: fixtureLearningBrief.id,
  metadata: {
    title: "Signal, decision, debris",
    locale: "en-CH",
    estimatedMinutes: 9,
    rationale:
      "A classification map helps the learner distinguish what deserves to cross a task boundary from what should remain behind.",
    theme: "systems-map",
  },
  objectives: [
    {
      id: "objective-context-filter",
      statement: "Classify task context by whether it should travel into a new deliverable.",
      successCriteria: ["Keeps approved decisions and constraints", "Leaves abandoned options and conversational debris behind"],
    },
  ],
  nodes: [
    {
      id: "map-objective",
      primitiveId: "orient.objective",
      primitiveVersion: "1",
      learningRole: "activate",
      objectiveIds: ["objective-context-filter"],
      props: {
        heading: "Build a portable context filter",
        body: "A clean fork is not empty. It is deliberately packed.",
        successCriteria: ["Identify durable signal", "Reject working debris"],
        relevance: "Your next production task should inherit decisions, not the whole story of reaching them.",
      },
    },
    {
      id: "map-prediction",
      primitiveId: "diagnose.prediction",
      primitiveVersion: "1",
      learningRole: "activate",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Which item is most likely to deserve a place in a fork handoff?",
        askConfidence: true,
        options: [
          { id: "decision", label: "The approved audience and decision", correct: true, feedback: "Yes. These constrain the new deliverable and remain relevant." },
          { id: "debate", label: "Every argument from the earlier debate", correct: false, feedback: "The debate explains history, but most of it no longer constrains the work." },
          { id: "drafts", label: "All rejected draft directions", correct: false, feedback: "Rejected directions usually add interference unless one is a named boundary." },
        ],
      },
    },
    {
      id: "map-rule",
      primitiveId: "explain.concept",
      primitiveVersion: "1",
      learningRole: "explain",
      objectiveIds: ["objective-context-filter"],
      props: {
        title: "Pack by causal relevance",
        body: "Carry facts, decisions, constraints, and source references that can change the next output. Summarize rejected options only when they define a boundary. Leave conversational chronology behind.",
        keyPoint: "Ask: could this item change a correct next deliverable?",
      },
    },
    {
      id: "map-sort",
      primitiveId: "practice.sort",
      primitiveVersion: "1",
      learningRole: "practice",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Pack this fork. Sort each item by what the new production task needs.",
        buckets: [
          { id: "carry", label: "Carry forward", description: "Can change the correct output" },
          { id: "leave", label: "Leave behind", description: "Working history without current force" },
        ],
        items: [
          { id: "audience", label: "Approved audience and desired decision", correctBucketId: "carry" },
          { id: "constraint", label: "Final word-count and language constraints", correctBucketId: "carry" },
          { id: "discarded", label: "Three discarded opening paragraphs", correctBucketId: "leave" },
          { id: "debate", label: "A long debate about a rejected format", correctBucketId: "leave" },
        ],
        feedback: "Carry what can alter the output; leave the chronology of how the team arrived there.",
      },
    },
    {
      id: "map-model",
      primitiveId: "model.worked_example",
      primitiveVersion: "1",
      learningRole: "model",
      objectiveIds: ["objective-context-filter"],
      props: {
        title: "A four-line handoff",
        scenario: "The exploration task approved a bilingual follow-up for workshop attendees.",
        steps: [
          { label: "Outcome", detail: "Draft a bilingual follow-up that secures the next decision." },
          { label: "Keep", detail: "Audience, decision, approved offer, language, and deadline." },
          { label: "Boundary", detail: "Do not revive the discarded event format." },
          { label: "Check", detail: "Both language versions ask for the same decision." },
        ],
        takeaway: "A handoff is a causal model of the next deliverable, not minutes of the previous task.",
      },
    },
    {
      id: "map-retry",
      primitiveId: "practice.sort",
      primitiveVersion: "1",
      learningRole: "retrieve",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Try a smaller parallel pack.",
        buckets: [
          { id: "carry", label: "Carry forward" },
          { id: "leave", label: "Leave behind" },
        ],
        items: [
          { id: "approved-metric", label: "The approved success metric", correctBucketId: "carry" },
          { id: "old-search", label: "An obsolete search query", correctBucketId: "leave" },
        ],
        feedback: "The metric can change evaluation of the output; the obsolete query cannot.",
      },
    },
    {
      id: "map-reflection",
      primitiveId: "consolidate.reflection",
      primitiveVersion: "1",
      learningRole: "reflect",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Write your one-question filter for deciding whether context should cross a task boundary.",
        sentenceStarter: "I will carry an item when…",
        minimumCharacters: 34,
        feedback: "A useful filter connects context to whether it can change a correct output.",
      },
    },
    {
      id: "map-transfer",
      primitiveId: "transfer.commitment",
      primitiveVersion: "1",
      learningRole: "transfer",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Name one item you will deliberately carry and one you will leave behind in your next fork.",
        cue: "A related goal becomes a new deliverable.",
        proof: "The handoff names outcome, durable decisions, boundaries, and a check.",
        minimumCharacters: 34,
      },
    },
  ],
  edges: [
    { id: "map-e1", from: "map-objective", to: "map-prediction", condition: { op: "always" } },
    { id: "map-e2", from: "map-prediction", to: "map-rule", condition: { op: "always" } },
    { id: "map-e3", from: "map-rule", to: "map-sort", condition: { op: "always" } },
    { id: "map-e4", from: "map-sort", to: "map-reflection", condition: { op: "response_correct", nodeId: "map-sort", value: true } },
    { id: "map-e5", from: "map-sort", to: "map-model", condition: { op: "always" } },
    { id: "map-e6", from: "map-model", to: "map-retry", condition: { op: "always" } },
    { id: "map-e7", from: "map-retry", to: "map-reflection", condition: { op: "always" } },
    { id: "map-e8", from: "map-reflection", to: "map-transfer", condition: { op: "always" } },
  ],
  entryNodeId: "map-objective",
  completion: {
    requiredObjectiveIds: ["objective-context-filter"],
    requiredNodeIds: ["map-reflection", "map-transfer"],
    minimumUnassistedAttempts: 3,
    requireTransfer: true,
  },
  adaptation: sharedAdaptation,
  assets: [],
  provenance: sharedProvenance,
};

export const fieldNotesExperience: LearningExperienceDocument = {
  specVersion: "1.0",
  registryVersion: "ogram.learning.v1",
  pedagogyPolicyVersion: "2026.1",
  experienceId: "experience-finish-line-field-notes",
  draftRevision: 1,
  contextSnapshotId: fixtureContextSnapshotId,
  learningBriefId: fixtureLearningBrief.id,
  metadata: {
    title: "Make done visible",
    locale: "en-CH",
    estimatedMinutes: 7,
    rationale:
      "A short sequence of prediction, model, self-explanation, and transfer turns a vague prompting instinct into an observable briefing habit.",
    theme: "field-notes",
  },
  objectives: [
    {
      id: "objective-visible-done",
      statement: "Turn an underspecified Codex request into an outcome with boundaries and a check.",
      successCriteria: ["Names the audience and decision", "States constraints and a verification step without micromanaging edits"],
    },
  ],
  nodes: [
    {
      id: "notes-objective",
      primitiveId: "orient.objective",
      primitiveVersion: "1",
      learningRole: "activate",
      objectiveIds: ["objective-visible-done"],
      props: {
        heading: "Replace adjectives with evidence",
        body: "Words such as better, polished, or professional hide the finish line. A shaped task lets Codex exercise judgment inside visible boundaries.",
        successCriteria: ["Outcome is observable", "Constraints preserve what matters", "A check closes the loop"],
        relevance: "This is the portable skill beneath every clean handoff into a new production task.",
      },
    },
    {
      id: "notes-prediction",
      primitiveId: "diagnose.prediction",
      primitiveVersion: "1",
      learningRole: "activate",
      objectiveIds: ["objective-visible-done"],
      props: {
        context: "A client proposal exists and must be reviewed before it is sent.",
        prompt: "Which request gives useful judgment room and still makes success visible?",
        askConfidence: true,
        options: [
          { id: "vague", label: "Make this more professional", correct: false, feedback: "Professional is an impression, not an observable finish line." },
          { id: "shaped", label: "Make the decision clear, preserve pricing, flag unsupported claims, and end with a send/no-send check", correct: true, feedback: "This names an outcome, boundaries, and a check while leaving room for editorial judgment." },
          { id: "recipe", label: "Follow these 27 exact sentence edits", correct: false, feedback: "A manual recipe can remove the agent judgment the task is meant to use." },
        ],
      },
    },
    {
      id: "notes-model",
      primitiveId: "model.worked_example",
      primitiveVersion: "1",
      learningRole: "model",
      objectiveIds: ["objective-visible-done"],
      props: {
        title: "From fog to finish line",
        scenario: "‘Make the workshop follow-up better.’",
        steps: [
          { label: "Outcome", detail: "Recipients understand the agreed next decision." },
          { label: "Context", detail: "Use the approved agenda and offer already supplied." },
          { label: "Boundaries", detail: "Keep names private and do not invent commitments." },
          { label: "Check", detail: "Every paragraph supports the next decision; unsupported claims are flagged." },
        ],
        takeaway: "Define the result and its test; do not dictate every keystroke.",
      },
    },
    {
      id: "notes-explain",
      primitiveId: "consolidate.reflection",
      primitiveVersion: "1",
      learningRole: "reflect",
      objectiveIds: ["objective-visible-done"],
      props: {
        prompt: "Why is a visible check different from micromanaging the method?",
        sentenceStarter: "A check defines… while the method…",
        minimumCharacters: 38,
        feedback: "Exactly: the check defines evidence of success while the agent still chooses how to produce it.",
      },
    },
    {
      id: "notes-practice",
      primitiveId: "practice.choice",
      primitiveVersion: "1",
      learningRole: "assess",
      objectiveIds: ["objective-visible-done"],
      props: {
        prompt: "A bilingual follow-up should secure one scheduling decision. Which final check is strongest?",
        options: [
          { id: "tone", label: "It sounds polished", correct: false, feedback: "Tone matters, but it does not test whether the desired decision is clear in both versions." },
          { id: "decision", label: "Both language versions ask for the same scheduling decision and contain no invented commitment", correct: true, feedback: "That check is observable and tied to the real outcome and boundary." },
          { id: "length", label: "It has exactly six paragraphs", correct: false, feedback: "Paragraph count is only useful if it causally supports the decision; here it is arbitrary." },
        ],
      },
    },
    {
      id: "notes-transfer",
      primitiveId: "transfer.commitment",
      primitiveVersion: "1",
      learningRole: "transfer",
      objectiveIds: ["objective-visible-done"],
      props: {
        prompt: "Rewrite one vague request you expect to make this week as outcome + boundaries + check.",
        cue: "My prompt relies on an adjective such as better, clear, or professional.",
        proof: "The revised prompt ends with an observable definition of done.",
        minimumCharacters: 48,
      },
    },
  ],
  edges: [
    { id: "notes-e1", from: "notes-objective", to: "notes-prediction", condition: { op: "always" } },
    { id: "notes-e2", from: "notes-prediction", to: "notes-model", condition: { op: "always" } },
    { id: "notes-e3", from: "notes-model", to: "notes-explain", condition: { op: "always" } },
    { id: "notes-e4", from: "notes-explain", to: "notes-practice", condition: { op: "always" } },
    { id: "notes-e5", from: "notes-practice", to: "notes-transfer", condition: { op: "always" } },
  ],
  entryNodeId: "notes-objective",
  completion: {
    requiredObjectiveIds: ["objective-visible-done"],
    requiredNodeIds: ["notes-explain", "notes-practice", "notes-transfer"],
    minimumUnassistedAttempts: 4,
    requireTransfer: true,
  },
  adaptation: sharedAdaptation,
  assets: [],
  provenance: sharedProvenance,
};

export const experienceFixtures = [
  decisionLabExperience,
  systemsMapExperience,
  fieldNotesExperience,
] as const;

export function cloneExperienceFixture(
  experience: LearningExperienceDocument,
  draftRevision: number,
  contextSnapshotId = fixtureContextSnapshotId,
  learningBriefId = fixtureLearningBrief.id,
): LearningExperienceDocument {
  return {
    ...structuredClone(experience),
    draftRevision,
    contextSnapshotId,
    learningBriefId,
  };
}
