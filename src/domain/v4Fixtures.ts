import type {
  LearnerContextClaim,
  LessonDocumentV4,
  LessonRegion,
  RegionProvenance,
  TopicRadarSignalV1,
} from "./agentCanvas";
import { createLinearLessonFlow } from "./agentCanvas";

function provenance(label: string, sourceRefs: string[] = []): RegionProvenance[] {
  return [
    {
      actor: "ogram",
      label,
      sourceRefs,
      at: "2026-09-01T00:00:00.000Z",
    },
  ];
}

const algebraProvenance = provenance("Bundled V4 algebra regression path");

const algebraRegions: LessonRegion[] = [
  {
    id: "algebra-orientation",
    order: 1,
    label: "01 · orientation",
    title: "Slope measures change",
    objective: "Connect a line on a graph to a rate of change.",
    kind: "orient",
    content: [
      {
        type: "prose",
        heading: "A ratio with a direction",
        text:
          "Slope compares the vertical change in a line with its horizontal change. A positive result rises from left to right; a negative result falls.",
        emphasis: "Read slope as change in y for each one-unit change in x.",
      },
      {
        type: "diagram",
        syntax: "mermaid",
        title: "Two points define a change",
        description:
          "A flow from the first point to vertical change, horizontal change, and their ratio.",
        source:
          "flowchart LR\n  A[Point one] --> B[Vertical change: y two minus y one]\n  A --> C[Horizontal change: x two minus x one]\n  B --> D[Slope]\n  C --> D",
      },
    ],
    provenance: algebraProvenance,
  },
  {
    id: "algebra-formula",
    order: 2,
    label: "02 · formula",
    title: "Build the slope formula",
    objective: "Identify each term and preserve the subtraction order.",
    kind: "model",
    content: [
      {
        type: "formula",
        latex: "m=\\frac{y_2-y_1}{x_2-x_1}",
        display: true,
        accessibleLabel:
          "Slope m equals y two minus y one divided by x two minus x one.",
        explanation:
          "Use the same point order in the numerator and denominator. Reversing both still produces the same ratio.",
      },
      {
        type: "key_points",
        items: [
          "The numerator is the vertical change.",
          "The denominator is the horizontal change.",
          "A zero denominator describes a vertical line, whose slope is undefined.",
        ],
      },
    ],
    provenance: algebraProvenance,
  },
  {
    id: "algebra-practice",
    order: 3,
    label: "03 · numeric practice",
    title: "Calculate from two points",
    objective: "Calculate slope and submit a tolerance-aware numeric answer.",
    kind: "practice",
    content: [
      {
        type: "prose",
        text:
          "A line passes through (2, 3) and (6, 11). Substitute the two points, simplify the numerator and denominator, then divide.",
      },
    ],
    interaction: {
      type: "numeric",
      prompt: "What is the slope of the line through (2, 3) and (6, 11)?",
      correctAnswer: 2,
      tolerance: 0.001,
      correctFeedback: "Correct: (11 − 3) ÷ (6 − 2) = 8 ÷ 4 = 2.",
      incorrectFeedback:
        "Recheck that you used the same point order above and below the fraction.",
      placeholder: "Enter a number",
    },
    provenance: algebraProvenance,
  },
  {
    id: "algebra-remediation",
    order: 4,
    label: "04 · remediation",
    title: "Separate the two changes",
    objective: "Repair the calculation by handling each axis separately.",
    kind: "explain",
    content: [
      {
        type: "formula",
        latex: "\\Delta y=11-3=8\\qquad\\Delta x=6-2=4\\qquad m=8/4=2",
        display: true,
        accessibleLabel:
          "The change in y is eight, the change in x is four, and eight divided by four is two.",
        explanation:
          "Write the two differences on separate lines before forming the ratio. This removes the most common sign and order mistakes.",
      },
    ],
    provenance: algebraProvenance,
  },
  {
    id: "algebra-transfer",
    order: 5,
    label: "05 · transfer",
    title: "Turn the number into meaning",
    objective: "Explain a numeric slope as a rate in context.",
    kind: "reflect",
    content: [
      {
        type: "prose",
        text:
          "A result of 2 means y increases by two units whenever x increases by one unit. The unit is always y-units per x-unit.",
      },
    ],
    interaction: {
      type: "reflection",
      prompt:
        "If x is hours and y is distance in kilometres, explain what a slope of 2 means.",
      placeholder: "For each additional hour…",
      minimumCharacters: 30,
      feedback:
        "Your explanation now connects the ratio to its units: kilometres per hour.",
    },
    provenance: algebraProvenance,
  },
];

export const algebraLessonFixture: LessonDocumentV4 = {
  schemaVersion: 4,
  id: "lesson-algebra-functions-v4",
  revision: 1,
  blueprintId: "algebra_functions_v1",
  pedagogicalMode: "quantitative",
  sourcePolicy: "evergreen",
  topic: "Linear functions and slope",
  title: "Slope as a rate of change",
  subtitle: "Read the formula, calculate a result, and explain what it means",
  audience: "Beginner with arithmetic fluency",
  estimatedMinutes: 14,
  objective:
    "Calculate and interpret the slope of a linear function from two coordinate points.",
  approvedClaimIds: [],
  regions: algebraRegions,
  flow: {
    entryRegionId: "algebra-orientation",
    edges: [
      {
        id: "algebra-edge-1",
        from: "algebra-orientation",
        to: "algebra-formula",
        priority: 0,
        condition: { type: "always" },
      },
      {
        id: "algebra-edge-2",
        from: "algebra-formula",
        to: "algebra-practice",
        priority: 0,
        condition: { type: "always" },
      },
      {
        id: "algebra-edge-correct",
        from: "algebra-practice",
        to: "algebra-transfer",
        priority: 0,
        label: "Correct answer",
        condition: { type: "response_correct", value: true },
      },
      {
        id: "algebra-edge-remediate",
        from: "algebra-practice",
        to: "algebra-remediation",
        priority: 1,
        label: "Review the calculation",
        condition: { type: "always" },
      },
      {
        id: "algebra-edge-rejoin",
        from: "algebra-remediation",
        to: "algebra-transfer",
        priority: 0,
        condition: { type: "always" },
      },
    ],
  },
  assetRefs: [],
};

const codeProvenance = provenance("Bundled V4 executable debugging path");

const codeRegions: LessonRegion[] = [
  {
    id: "code-orientation",
    order: 1,
    label: "01 · contract",
    title: "Start with passing behavior",
    objective: "Translate the requested outcome into a small executable contract.",
    kind: "orient",
    content: [
      {
        type: "prose",
        text:
          "A useful debugging loop starts with observable behavior: reproduce the failure, narrow the cause, make one change, and rerun the same tests.",
        emphasis: "The test is the finish line; the explanation makes the fix reusable.",
      },
      {
        type: "diagram",
        syntax: "mermaid",
        title: "The debugging loop",
        description:
          "A four-stage loop from reproduce to inspect, change, and rerun.",
        source:
          "flowchart LR\n  A[Reproduce] --> B[Inspect]\n  B --> C[Change one thing]\n  C --> D[Rerun tests]\n  D -->|Still failing| B\n  D -->|Passing| E[Explain]",
      },
    ],
    provenance: codeProvenance,
  },
  {
    id: "javascript-lab",
    order: 2,
    label: "02 · JavaScript",
    title: "Repair an off-by-one loop",
    objective: "Use a failing boundary case to correct a JavaScript function.",
    kind: "practice",
    content: [
      {
        type: "code_example",
        language: "javascript",
        caption: "The loop reads one element beyond the end of the array.",
        highlightedLines: [3],
        code:
          "export function sum(values) {\n  let total = 0;\n  for (let i = 0; i <= values.length; i += 1) {\n    total += values[i];\n  }\n  return total;\n}",
      },
    ],
    interaction: {
      type: "code_lab",
      exerciseId: "fixture-js-sum-v1",
      language: "javascript",
      prompt: "Fix sum so it passes the empty, single-value, and multi-value tests.",
      starterCode:
        "export function sum(values) {\n  let total = 0;\n  for (let i = 0; i <= values.length; i += 1) {\n    total += values[i];\n  }\n  return total;\n}",
      visibleTests: ["sum([]) === 0", "sum([4]) === 4", "sum([2, 3, 5]) === 10"],
      fallbackPrompt:
        "If execution is unavailable, identify the boundary error and write the corrected loop condition.",
    },
    provenance: codeProvenance,
  },
  {
    id: "typescript-lab",
    order: 3,
    label: "03 · TypeScript",
    title: "Preserve a typed result",
    objective: "Correct a TypeScript implementation without weakening its type contract.",
    kind: "practice",
    content: [
      {
        type: "code_example",
        language: "typescript",
        caption: "The fallback reverses the intended condition.",
        highlightedLines: [2],
        code:
          "export function displayName(name: string | null): string {\n  return name ? \"Anonymous\" : name;\n}",
      },
    ],
    interaction: {
      type: "code_lab",
      exerciseId: "fixture-ts-display-name-v1",
      language: "typescript",
      prompt: "Return the supplied name, or Anonymous when the value is null.",
      starterCode:
        "export function displayName(name: string | null): string {\n  return name ? \"Anonymous\" : name;\n}",
      visibleTests: [
        "displayName(\"Ada\") === \"Ada\"",
        "displayName(null) === \"Anonymous\"",
      ],
      fallbackPrompt:
        "If execution is unavailable, explain how the conditional expression should be reordered.",
    },
    provenance: codeProvenance,
  },
  {
    id: "python-lab",
    order: 4,
    label: "04 · Python",
    title: "Return the filtered values",
    objective: "Trace data flow through a Python function and restore its return value.",
    kind: "practice",
    content: [
      {
        type: "code_example",
        language: "python",
        caption: "The filtered list is built but never returned.",
        highlightedLines: [3],
        code:
          "def positives(values):\n    result = [value for value in values if value > 0]\n    return values",
      },
    ],
    interaction: {
      type: "code_lab",
      exerciseId: "fixture-python-positives-v1",
      language: "python",
      prompt: "Return only positive values while preserving their order.",
      starterCode:
        "def positives(values):\n    result = [value for value in values if value > 0]\n    return values",
      visibleTests: [
        "positives([-2, 0, 3, 1]) == [3, 1]",
        "positives([]) == []",
      ],
      fallbackPrompt:
        "If execution is unavailable, identify which variable the final line should return.",
    },
    provenance: codeProvenance,
  },
  {
    id: "code-review",
    order: 5,
    label: "05 · debrief",
    title: "Name the reusable debugging move",
    objective: "Explain how a failing test narrowed the defect.",
    kind: "reflect",
    content: [
      {
        type: "prose",
        text:
          "Across languages, the durable move is the same: use the smallest failing behavior to distinguish the intended contract from the current implementation.",
      },
    ],
    interaction: {
      type: "reflection",
      prompt:
        "Choose one lab and explain which test exposed the root cause and why the fix is appropriately small.",
      placeholder: "The test showed…",
      minimumCharacters: 45,
      feedback: "You connected the code change to evidence instead of stopping at a passing result.",
    },
    provenance: codeProvenance,
  },
];

export const codeLessonFixture: LessonDocumentV4 = {
  schemaVersion: 4,
  id: "lesson-code-debugging-v4",
  revision: 1,
  blueprintId: "code_debugging_v1",
  pedagogicalMode: "code",
  sourcePolicy: "evergreen",
  topic: "Debugging small programs",
  title: "Debug with an executable contract",
  subtitle: "JavaScript, TypeScript, and Python labs in one evidence loop",
  audience: "Intermediate learner comfortable reading small functions",
  estimatedMinutes: 18,
  objective:
    "Diagnose and repair a bounded defect, then explain the test evidence that supports the fix.",
  approvedClaimIds: [],
  regions: codeRegions,
  flow: createLinearLessonFlow(codeRegions),
  assetRefs: [],
};

type CodexModule = {
  id: string;
  title: string;
  summary: string;
  action: string;
  url: string;
  availability: string;
  authority: "official" | "community_exploration";
  retrievedAt: string;
  publishedAt?: string;
};

function selectCodexModules(
  _claims: LearnerContextClaim[],
  radar: TopicRadarSignalV1[],
): CodexModule[] {
  const selected = [...radar]
    .sort(
      (left, right) =>
        right.learnerRelevance * 0.5 +
        right.officialRecency * 0.3 +
        right.communityCorroboration * 0.2 -
        (left.learnerRelevance * 0.5 +
          left.officialRecency * 0.3 +
          left.communityCorroboration * 0.2),
    )
    .slice(0, 3)
    .map((signal) => ({
      id: signal.id,
      title:
        signal.authority === "community_exploration"
          ? "Exploration · " + signal.topic
          : signal.topic,
      summary: signal.summary,
      action:
        signal.authority === "official"
          ? "Try this in one bounded task, then inspect the result against its documented availability."
          : "Treat this as a use-case idea, not product behavior, until an official source confirms it.",
      url:
        signal.officialUrl ??
        signal.communitySources?.[0]?.url ??
        "https://learn.chatgpt.com/docs/whats-new",
      availability:
        signal.availability ??
        (signal.authority === "official"
          ? "Check the cited documentation for plan, platform, region, and preview status."
          : "Community exploration; availability is not established."),
      authority: signal.authority,
      retrievedAt: signal.retrievedAt,
      publishedAt:
        signal.officialPublishedAt ?? signal.communitySources?.[0]?.publishedAt,
    }));
  if (selected.length) return selected;
  return [
    {
      id: "desktop-verification-loop",
      title: "Inspect, test, and refine",
      summary:
        "Use the stable desktop workflow when no recent topic-radar signal is available.",
      action:
        "Complete one bounded task, inspect the diff or result, run a proportionate check, and refine from evidence.",
      url: "https://learn.chatgpt.com/docs/app",
      availability: "Codex desktop; individual capabilities vary by plan and platform.",
      authority: "official",
      retrievedAt: new Date().toISOString(),
    },
  ];
}

export function createPersonalizedCodexLesson(
  claims: LearnerContextClaim[] = [],
  radar: TopicRadarSignalV1[] = [],
): LessonDocumentV4 {
  const retrievedAt = new Date().toISOString();
  const modules = selectCodexModules(claims, radar);
  const approvedClaimIds = claims
    .filter((claim) => claim.review === "accepted" || claim.review === "corrected")
    .map((claim) => claim.id);
  const sourceRefs = [
    "https://learn.chatgpt.com/docs/app",
    "https://learn.chatgpt.com/docs/whats-new",
    ...modules.map((module) => module.url),
  ];
  const codexProvenance = provenance(
    "Current Codex workflow composed from reviewed signals",
    sourceRefs,
  );
  const regions: LessonRegion[] = [
    {
      id: "codex-foundation",
      order: 1,
      label: "01 · foundation",
      title: "Give Codex an observable finish line",
      objective: "Turn a broad request into a workspace-grounded outcome.",
      kind: "orient",
      content: [
        {
          type: "prose",
          heading: "The stable desktop loop",
          text:
            "Choose the workspace, state the outcome and relevant context, inspect what changed, run proportionate checks, and refine with concrete evidence.",
          emphasis:
            "Codex is most useful when the task has a visible finish line and permission boundaries.",
        },
        {
          type: "diagram",
          syntax: "mermaid",
          title: "The Codex desktop workflow",
          description:
            "A five-stage loop from workspace selection through outcome, inspection, testing, and refinement.",
          source:
            "flowchart LR\n  A[Choose workspace] --> B[State outcome and context]\n  B --> C[Inspect the result]\n  C --> D[Test]\n  D --> E[Refine]\n  E --> C",
        },
        {
          type: "source_cards",
          summary:
            "Official documentation establishes the product workflow and current feature behavior.",
          sources: [
            {
              id: "codex-app-docs",
              title: "Codex app",
              url: "https://learn.chatgpt.com/docs/app",
              publisher: "OpenAI",
              retrievedAt,
              sourceType: "official",
              availability: "Codex desktop; specific features can vary by platform and plan.",
              claim:
                "The desktop workflow centers on choosing a project, assigning work, inspecting results, and iterating.",
            },
            {
              id: "codex-whats-new",
              title: "What’s new",
              url: "https://learn.chatgpt.com/docs/whats-new",
              publisher: "OpenAI",
              retrievedAt,
              sourceType: "official",
              availability: "Dated release notes; availability is stated per feature.",
              claim: "Release notes are the recency source for current Codex capabilities.",
            },
          ],
        },
      ],
      provenance: codexProvenance,
    },
    {
      id: "codex-context",
      order: 2,
      label: "02 · context",
      title: "Use only reviewed learning signals",
      objective: "Distinguish useful personalization from raw task history.",
      kind: "explain",
      content: [
        {
          type: "key_points",
          items: approvedClaimIds.length
            ? claims
                .filter((claim) => approvedClaimIds.includes(claim.id))
                .slice(0, 8)
                .map((claim) => claim.correctedSummary || claim.summary)
            : [
                "No recent-task signal was required; the lesson falls back to this brief and conversation.",
                "Full transcripts, task identifiers, prompts, and source code stay outside the lesson.",
                "You can correct or reject every derived claim before it affects authoring.",
              ],
        },
      ],
      provenance: codexProvenance,
    },
    {
      id: "codex-modules",
      order: 3,
      label: "03 · selected modules",
      title: modules.map((module) => module.title).join(", "),
      objective: "Choose current Codex capabilities that fit the learner's next task.",
      kind: "model",
      content: [
        {
          type: "comparison",
          leftLabel: "Capability",
          rightLabel: "Use it deliberately",
          rows: modules.map((module) => ({
            label: module.title,
            left: module.summary,
            right: module.action,
          })),
        },
        {
          type: "source_cards",
          summary:
            "Official modules are anchored to OpenAI documentation. Community-only ideas remain labeled as exploration; availability stays visible.",
          sources: modules.map((module) => ({
            id: "codex-module-" + module.id,
            title: module.title,
            url: module.url,
            publisher:
              module.authority === "official" ? "OpenAI" : "Community source",
            retrievedAt: module.retrievedAt,
            ...(module.publishedAt ? { publishedAt: module.publishedAt } : {}),
            sourceType:
              module.authority === "official"
                ? ("official" as const)
                : ("community" as const),
            availability: module.availability,
            claim: module.summary,
          })),
        },
      ],
      provenance: codexProvenance,
    },
    {
      id: "codex-scenario",
      order: 4,
      label: "04 · scenario",
      title: "Choose the first move",
      objective: "Apply the workflow to a realistic repository task.",
      kind: "practice",
      content: [
        {
          type: "prose",
          text:
            "You want Codex to change an unfamiliar app. The request names the feature but provides no workspace, expected behavior, constraints, or test command.",
        },
      ],
      interaction: {
        type: "choice",
        prompt: "What should you do first?",
        options: [
          {
            id: "clarify-outcome",
            label: "Choose the workspace and define observable acceptance criteria",
            correct: true,
            feedback:
              "Exactly. This gives Codex scope, a finish line, and evidence it can verify.",
          },
          {
            id: "delegate-everything",
            label: "Immediately delegate every file to separate agents",
            correct: false,
            feedback:
              "Parallel work is useful only after the boundaries and dependencies are understood.",
          },
          {
            id: "skip-inspection",
            label: "Ask for implementation and accept the first result",
            correct: false,
            feedback:
              "The inspection and test loop is what turns generated work into controlled work.",
          },
        ],
      },
      provenance: codexProvenance,
    },
    {
      id: "codex-remediation",
      order: 5,
      label: "05 · remediation",
      title: "Shrink ambiguity before increasing autonomy",
      objective: "Repair an underspecified Codex request with a bounded brief.",
      kind: "explain",
      content: [
        {
          type: "key_points",
          items: [
            "Name the project or workspace.",
            "Describe the user-visible outcome.",
            "State constraints and protected areas.",
            "Give Codex a test or observable acceptance check.",
          ],
        },
      ],
      provenance: codexProvenance,
    },
    {
      id: "codex-transfer",
      order: 6,
      label: "06 · transfer",
      title: "Write your next Codex brief",
      objective: "Create a reusable instruction for one real task.",
      kind: "reflect",
      content: [
        {
          type: "prose",
          text:
            "A strong brief is short but operational: outcome, context, constraints, verification, and any action that needs your approval.",
        },
      ],
      interaction: {
        type: "reflection",
        prompt:
          "Write a brief for your next Codex task. Include the workspace, outcome, constraints, and how you will verify it.",
        placeholder: "In [workspace], change… Preserve… Verify by…",
        minimumCharacters: 60,
        feedback:
          "You now have a concrete brief that can start a new Codex task without hidden assumptions.",
      },
      provenance: codexProvenance,
    },
  ];

  return {
    schemaVersion: 4,
    id: "lesson-codex-personalized-v4",
    revision: 1,
    blueprintId: "codex_current_personalized_v1",
    pedagogicalMode: "mixed",
    sourcePolicy: "current",
    topic: "How to use the Codex app effectively",
    title: "A Codex workflow shaped around your work",
    subtitle: "A stable desktop loop plus the current modules most relevant to you",
    audience: "Codex learner at any level",
    estimatedMinutes: 18,
    objective:
      "Plan and complete a bounded Codex task using explicit context, inspection, testing, and refinement.",
    approvedClaimIds,
    regions,
    flow: {
      entryRegionId: "codex-foundation",
      edges: [
        {
          id: "codex-edge-1",
          from: "codex-foundation",
          to: "codex-context",
          priority: 0,
          condition: { type: "always" },
        },
        {
          id: "codex-edge-2",
          from: "codex-context",
          to: "codex-modules",
          priority: 0,
          condition: { type: "always" },
        },
        {
          id: "codex-edge-3",
          from: "codex-modules",
          to: "codex-scenario",
          priority: 0,
          condition: { type: "always" },
        },
        {
          id: "codex-edge-direct",
          from: "codex-scenario",
          to: "codex-transfer",
          priority: 0,
          condition: { type: "response_correct", value: true },
        },
        {
          id: "codex-edge-remediation",
          from: "codex-scenario",
          to: "codex-remediation",
          priority: 1,
          condition: { type: "always" },
        },
        {
          id: "codex-edge-rejoin",
          from: "codex-remediation",
          to: "codex-transfer",
          priority: 0,
          condition: { type: "always" },
        },
      ],
    },
    assetRefs: [],
  };
}
