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
    source: "ogram_pixel",
    sourceDetail: {
      providerId: "ogram-pixel",
      providerLabel: "Ogram Pixel",
      connector: "first_party",
      resourceType: "authorized workshop interaction summary",
    },
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
    "Recent tasks have often kept exploration and production in one conversation, even after the required deliverable changed.",
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
    title: "When to continue, fork, or start fresh",
    locale: "en-CH",
    estimatedMinutes: 8,
    rationale:
      "This session uses short work examples to help the learner choose where a new piece of work should begin.",
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
        heading: "Choose where your next piece of work should begin",
        body:
          "In Codex, you can continue in the current task, fork it, or start a new task. This lesson helps you choose based on whether the goal, the deliverable, and the useful decisions have changed.",
        successCriteria: [
          "Decide whether the goal or deliverable has changed",
          "Keep approved decisions without carrying rejected exploration into the next task",
        ],
        relevance:
          "Your recent tasks have often moved from exploration to production inside one long conversation. Practising this choice can make the next production task easier to brief.",
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
          "You used one Codex task to explore workshop formats and approve a final strategy. The conversation also contains rejected ideas and several research detours. You now need to write a client follow-up.",
        prompt:
          "Where should you create the client follow-up?",
        askConfidence: true,
        options: [
          {
            id: "continue",
            label: "Continue in the current task",
            description: "Use the full exploration conversation for the production work.",
            correct: false,
            feedback:
              "The approved strategy is useful, but the rejected ideas and research detours are not. Because the deliverable has changed, a separate task will be easier to work with.",
          },
          {
            id: "fork",
            label: "Fork the current task",
            description: "Create a related task that begins with the approved decisions.",
            correct: true,
            feedback:
              "A fork keeps the approved strategy available while separating the client follow-up from the earlier exploration.",
          },
          {
            id: "fresh",
            label: "Start an unrelated new task",
            description: "Begin without carrying any information from the exploration.",
            correct: false,
            feedback:
              "A completely new task would remove the rejected ideas, but it would also lose the approved strategy that the follow-up needs.",
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
        title: "How to choose between the three options",
        body:
          "Continue in the current task when the goal and deliverable are still the same. Fork when the new work is related and should keep approved decisions, but it needs a different deliverable. Start a new task when the goal is unrelated or the earlier information would be misleading.",
        keyPoint:
          "Use the current task for the same deliverable, fork for a related new deliverable, and start fresh for an unrelated goal.",
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
          "You explored three workshop formats, rejected two, and approved one. You now need to create a polished follow-up page for the selected format.",
        prompt: "What should you do before creating the follow-up page?",
        askConfidence: true,
        options: [
          {
            id: "continue",
            label: "Continue in the exploration task",
            description: "Create the page in the same conversation as the research.",
            correct: false,
            feedback:
              "The approved format is there, but the task also contains rejected formats and outdated constraints. A fork would keep the useful decision while separating the new deliverable.",
          },
          {
            id: "fork",
            label: "Fork from the exploration task",
            description: "Begin the page with a short handoff of approved decisions.",
            correct: true,
            feedback:
              "This is the right choice because the new page uses the approved strategy, but it is a different deliverable from the exploration work.",
          },
          {
            id: "fresh",
            label: "Start a completely new task",
            description: "Re-enter the relevant information from memory.",
            correct: false,
            feedback:
              "This would make you re-enter information and could omit an approved decision that the page needs.",
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
        title: "Use three questions to decide",
        scenario:
          "A researcher finishes comparing vendors and now needs to write the procurement recommendation.",
        steps: [
          { label: "1 · Is the goal related?", detail: "Yes. The recommendation uses the vendor research." },
          { label: "2 · Has the deliverable changed?", detail: "Yes. The comparison work is becoming a decision document." },
          { label: "3 · What should remain?", detail: "Keep the approved evidence and requirements. Leave abandoned searches behind." },
        ],
        takeaway: "Fork the task when the goal is related, the deliverable has changed, and approved decisions should remain available.",
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
        prompt: "Where should you write the board memo?",
        options: [
          {
            id: "continue",
            label: "Continue",
            correct: false,
            feedback: "The memo would be written alongside discarded assumptions and analysis notes that no longer apply.",
          },
          {
            id: "fork",
            label: "Fork",
            correct: true,
            feedback: "The memo needs the approved assumptions, but it does not need the full analysis conversation. A fork gives it the right starting point.",
          },
          {
            id: "fresh",
            label: "Fresh",
            correct: false,
            feedback: "A completely new task would discard the approved pricing assumptions that the memo needs.",
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
          "In your own words, when would you fork a task, and when would you start a new one?",
        sentenceStarter: "I would fork a task when…",
        minimumCharacters: 36,
        feedback:
          "A fork is useful when the new work is related and still depends on approved decisions. A new task is better when the goal is unrelated or earlier information would be misleading.",
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
          "Think of a task moving into production. When will you fork it, and which approved decisions will you include?",
        cue: "You are about to create a different deliverable from completed research or exploration.",
        proof: "The fork starts with a short handoff that names the outcome, approved decisions, constraints, and final check.",
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
    title: "What to include in a task handoff",
    locale: "en-CH",
    estimatedMinutes: 9,
    rationale:
      "This session helps the learner decide which information a related new task needs and which working notes can stay behind.",
    theme: "systems-map",
  },
  objectives: [
    {
      id: "objective-context-filter",
      statement: "Choose which information to include when handing work to a related new task.",
      successCriteria: ["Includes approved decisions, requirements, and source references", "Leaves abandoned options and irrelevant conversation history behind"],
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
        heading: "Prepare a useful handoff for a related new task",
        body: "A fork should begin with the information needed to produce the next deliverable. It does not need the full history of how every decision was reached.",
        successCriteria: ["Identify information that can affect the next output", "Leave out notes that no longer influence the work"],
        relevance: "A focused handoff makes it easier for Codex to use approved decisions without being distracted by rejected directions.",
      },
    },
    {
      id: "map-prediction",
      primitiveId: "diagnose.prediction",
      primitiveVersion: "1",
      learningRole: "activate",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Which item should usually be included in a task handoff?",
        askConfidence: true,
        options: [
          { id: "decision", label: "The approved audience and desired decision", correct: true, feedback: "The audience and desired decision directly affect what the next deliverable should say and do." },
          { id: "debate", label: "Every argument from the earlier discussion", correct: false, feedback: "The discussion explains how the team reached a decision, but most of it does not affect the next deliverable." },
          { id: "drafts", label: "All rejected draft directions", correct: false, feedback: "Rejected drafts are usually unnecessary. Include one only when it defines an important limit for the new work." },
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
        title: "Include information that can affect the next output",
        body: "Include facts, approved decisions, requirements, and source references that can change the next deliverable. Mention a rejected option only when it defines an important limit. Leave out the chronological conversation unless it is needed to understand a decision.",
        keyPoint: "For each item, ask whether the next deliverable could be wrong or incomplete without it.",
      },
    },
    {
      id: "map-sort",
      primitiveId: "practice.sort",
      primitiveVersion: "1",
      learningRole: "practice",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Decide which items the new production task needs.",
        buckets: [
          { id: "carry", label: "Include in the handoff", description: "This can affect the correct output" },
          { id: "leave", label: "Leave out", description: "This is working history that no longer affects the output" },
        ],
        items: [
          { id: "audience", label: "Approved audience and desired decision", correctBucketId: "carry" },
          { id: "constraint", label: "Final word-count and language constraints", correctBucketId: "carry" },
          { id: "discarded", label: "Three discarded opening paragraphs", correctBucketId: "leave" },
          { id: "debate", label: "A long debate about a rejected format", correctBucketId: "leave" },
        ],
        feedback: "Include decisions and requirements that can change the output. Leave out discarded drafts and discussion that no longer affects the work.",
      },
    },
    {
      id: "map-model",
      primitiveId: "model.worked_example",
      primitiveVersion: "1",
      learningRole: "model",
      objectiveIds: ["objective-context-filter"],
      props: {
        title: "Example: a short handoff for a client follow-up",
        scenario: "The exploration task approved a bilingual follow-up for workshop attendees.",
        steps: [
          { label: "Outcome", detail: "Draft a bilingual follow-up that secures the next decision." },
          { label: "Keep", detail: "Audience, decision, approved offer, language, and deadline." },
          { label: "Boundary", detail: "Do not revive the discarded event format." },
          { label: "Check", detail: "Both language versions ask for the same decision." },
        ],
        takeaway: "A useful handoff explains what to produce, which approved information to use, what to avoid, and how to check the result.",
      },
    },
    {
      id: "map-retry",
      primitiveId: "practice.sort",
      primitiveVersion: "1",
      learningRole: "retrieve",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Which of these two items should the handoff include?",
        buckets: [
          { id: "carry", label: "Include in the handoff" },
          { id: "leave", label: "Leave out" },
        ],
        items: [
          { id: "approved-metric", label: "The approved success metric", correctBucketId: "carry" },
          { id: "old-search", label: "An obsolete search query", correctBucketId: "leave" },
        ],
        feedback: "The success metric is still needed to evaluate the output. The obsolete search query no longer affects the work.",
      },
    },
    {
      id: "map-reflection",
      primitiveId: "consolidate.reflection",
      primitiveVersion: "1",
      learningRole: "reflect",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "Write one question you can use to decide whether an item belongs in a task handoff.",
        sentenceStarter: "I will include an item when…",
        minimumCharacters: 34,
        feedback: "A useful question checks whether leaving the item out could make the next deliverable wrong or incomplete.",
      },
    },
    {
      id: "map-transfer",
      primitiveId: "transfer.commitment",
      primitiveVersion: "1",
      learningRole: "transfer",
      objectiveIds: ["objective-context-filter"],
      props: {
        prompt: "For a fork you may create soon, name one item to include in the handoff and one item to leave out.",
        cue: "You are creating a related task for a new deliverable.",
        proof: "The handoff states the outcome, approved decisions, important requirements, and a way to check the result.",
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
    title: "Write a clear definition of done",
    locale: "en-CH",
    estimatedMinutes: 7,
    rationale:
      "This session shows the learner how to replace a vague request with a clear outcome, necessary limits, and a practical final check.",
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
        heading: "Give Codex a result it can verify",
        body: "Requests such as ‘make this better’ or ‘make this more professional’ do not explain what success looks like. A stronger request names the intended result, the limits that matter, and how to check the finished work.",
        successCriteria: ["Describe an observable result", "State the limits that matter", "Include a relevant final check"],
        relevance: "This structure is useful whenever you brief Codex for a new production task.",
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
        prompt: "Which request gives Codex a clear result without prescribing every edit?",
        askConfidence: true,
        options: [
          { id: "vague", label: "Make this more professional", correct: false, feedback: "The word ‘professional’ describes an impression, but it does not tell Codex what the proposal needs to achieve." },
          { id: "shaped", label: "Make the decision clear, preserve pricing, flag unsupported claims, and finish with a send-or-revise recommendation", correct: true, feedback: "This request explains the result, protects important information, and defines a final check while leaving room for editorial judgment." },
          { id: "recipe", label: "Follow these 27 exact sentence edits", correct: false, feedback: "This may produce the requested edits, but it gives Codex no room to identify a better way to reach the result." },
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
        title: "Example: improve a workshop follow-up",
        scenario: "‘Make the workshop follow-up better.’",
        steps: [
          { label: "Outcome", detail: "Recipients understand the agreed next decision." },
          { label: "Context", detail: "Use the approved agenda and offer already supplied." },
          { label: "Boundaries", detail: "Keep names private and do not invent commitments." },
          { label: "Check", detail: "Every paragraph supports the next decision; unsupported claims are flagged." },
        ],
        takeaway: "Describe the result and how to check it, then let Codex choose the best way to produce it.",
      },
    },
    {
      id: "notes-explain",
      primitiveId: "consolidate.reflection",
      primitiveVersion: "1",
      learningRole: "reflect",
      objectiveIds: ["objective-visible-done"],
      props: {
        prompt: "Why does a final check help Codex without telling it exactly how to work?",
        sentenceStarter: "A final check describes…",
        minimumCharacters: 38,
        feedback: "A final check describes the evidence of success. Codex can still choose the most effective method for producing that result.",
      },
    },
    {
      id: "notes-practice",
      primitiveId: "practice.choice",
      primitiveVersion: "1",
      learningRole: "assess",
      objectiveIds: ["objective-visible-done"],
      props: {
        prompt: "A bilingual follow-up should secure one scheduling decision. Which final check is most useful?",
        options: [
          { id: "tone", label: "It sounds polished", correct: false, feedback: "Tone matters, but this check does not confirm that both versions ask for the intended decision." },
          { id: "decision", label: "Both versions ask for the same scheduling decision and contain no invented commitment", correct: true, feedback: "This can be checked directly and covers both the intended result and an important limit." },
          { id: "length", label: "It has exactly six paragraphs", correct: false, feedback: "A paragraph count is only useful when the structure matters to the result. Here, six paragraphs is arbitrary." },
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
        prompt: "Rewrite one vague request for this week. Include the intended result, the important limits, and a final check.",
        cue: "Your request depends on a broad word such as ‘better’, ‘clear’, or ‘professional’.",
        proof: "The revised request explains what success looks like and how the finished work will be checked.",
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
