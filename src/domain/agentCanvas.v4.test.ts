import { describe, expect, it } from "vitest";
import type {
  CanvasRegion,
  LessonDocumentV4,
  LessonRegion,
} from "./agentCanvas";
import {
  resolveLessonPath,
  validateLessonDocument,
} from "./agentCanvas";
import { transformerLessonFixture } from "./transformerFixture";
import {
  algebraLessonFixture,
  codeLessonFixture,
  createPersonalizedCodexLesson,
} from "./v4Fixtures";

function asCanvasRegions(document: LessonDocumentV4): CanvasRegion[] {
  return document.regions.map((region) => ({
    ...structuredClone(region),
    revision: 1,
    status: "ready" as const,
    history: [],
  }));
}

function explanations(document: LessonDocumentV4) {
  return validateLessonDocument(document, document.approvedClaimIds)
    .diagnostics.map((diagnostic) => diagnostic.explanation)
    .join(" ");
}

function decisionDepthFixture(): LessonDocumentV4 {
  const provenance = [
    {
      actor: "ogram" as const,
      label: "Graph depth fixture",
      sourceRefs: [],
      at: "2026-09-01T00:00:00.000Z",
    },
  ];
  const decision = (index: number): LessonRegion => ({
    id: `decision-${index}`,
    order: index + 1,
    label: `Decision ${index + 1}`,
    title: `Decision point ${index + 1}`,
    objective: "Choose one bounded response and record evidence.",
    kind: "practice",
    content: [{ type: "prose", text: "Choose the best next step." }],
    interaction: {
      type: "choice",
      prompt: "Continue along the diagnostic path?",
      options: [
        { id: "yes", label: "Yes", correct: true, feedback: "Continue." },
        { id: "no", label: "No", correct: false, feedback: "Stop here." },
      ],
    },
    provenance,
  });
  const fallback = (index: number): LessonRegion => ({
    id: `fallback-${index}`,
    order: index + 7,
    label: `Fallback ${index + 1}`,
    title: `Fallback outcome ${index + 1}`,
    objective: "Review the consequence of this branch.",
    kind: "explain",
    content: [{ type: "prose", text: "This path ends after recorded evidence." }],
    provenance,
  });
  const regions: LessonRegion[] = [
    ...Array.from({ length: 5 }, (_, index) => decision(index)),
    ...Array.from({ length: 5 }, (_, index) => fallback(index)),
    {
      id: "finish",
      order: 11,
      label: "Finish",
      title: "Transfer the result",
      objective: "State how the decision applies next time.",
      kind: "reflect",
      content: [{ type: "prose", text: "Turn the path into a reusable rule." }],
      provenance,
    },
  ];
  return {
    schemaVersion: 4,
    id: "decision-depth-fixture",
    revision: 1,
    blueprintId: "test_decisions",
    pedagogicalMode: "scenario",
    sourcePolicy: "evergreen",
    topic: "Decision depth",
    title: "A deliberately deep decision path",
    subtitle: "Graph validation fixture",
    audience: "Test learner",
    estimatedMinutes: 10,
    objective: "Recognize when a branching lesson asks for too many consecutive decisions.",
    approvedClaimIds: [],
    regions,
    flow: {
      entryRegionId: "decision-0",
      edges: Array.from({ length: 5 }, (_, index) => {
        const next = index === 4 ? "finish" : `decision-${index + 1}`;
        return [
          {
            id: `continue-${index}`,
            from: `decision-${index}`,
            to: next,
            priority: 0,
            condition: { type: "response_correct" as const, value: true },
          },
          {
            id: `fallback-edge-${index}`,
            from: `decision-${index}`,
            to: `fallback-${index}`,
            priority: 1,
            condition: { type: "always" as const },
          },
        ];
      }).flat(),
    },
    assetRefs: [],
  };
}

describe("LessonDocumentV4", () => {
  it("accepts the algebra, code, Codex, and transformer regression fixtures", () => {
    for (const document of [
      algebraLessonFixture,
      codeLessonFixture,
      createPersonalizedCodexLesson(),
      transformerLessonFixture,
    ]) {
      expect(
        validateLessonDocument(document, document.approvedClaimIds),
        document.blueprintId,
      ).toMatchObject({ valid: true });
    }
  });

  it("selects and locks the algebra remediation branch from immutable evidence", () => {
    const unanswered = asCanvasRegions(algebraLessonFixture);
    expect(resolveLessonPath(algebraLessonFixture, unanswered)).toMatchObject({
      visibleRegionIds: [
        "algebra-orientation",
        "algebra-formula",
        "algebra-practice",
      ],
      currentRegionId: "algebra-practice",
    });

    const incorrect = structuredClone(unanswered);
    incorrect.find((region) => region.id === "algebra-practice")!.response = {
      value: "1",
      correct: false,
      submittedAt: "2026-09-01T12:00:00.000Z",
    };
    expect(resolveLessonPath(algebraLessonFixture, incorrect)).toMatchObject({
      visibleRegionIds: [
        "algebra-orientation",
        "algebra-formula",
        "algebra-practice",
        "algebra-remediation",
        "algebra-transfer",
      ],
      selectedEdgeIds: expect.arrayContaining(["algebra-edge-remediate"]),
    });

    const correct = structuredClone(unanswered);
    correct.find((region) => region.id === "algebra-practice")!.response = {
      value: "2",
      correct: true,
      submittedAt: "2026-09-01T12:00:00.000Z",
    };
    const path = resolveLessonPath(algebraLessonFixture, correct);
    expect(path.visibleRegionIds).not.toContain("algebra-remediation");
    expect(path.hiddenRegionIds).toContain("algebra-remediation");
    expect(path.lockedRegionIds).not.toContain("algebra-remediation");
    expect(path.selectedEdgeIds).toContain("algebra-edge-correct");
  });

  it("rejects cycles, unreachable regions, and paths without evidence", () => {
    const cyclic = structuredClone(algebraLessonFixture);
    cyclic.flow.edges.push({
      id: "cycle",
      from: "algebra-transfer",
      to: "algebra-orientation",
      priority: 0,
      condition: { type: "always" },
    });
    expect(explanations(cyclic)).toMatch(/acyclic/i);

    const unreachable = structuredClone(algebraLessonFixture);
    unreachable.regions.push({
      ...structuredClone(unreachable.regions[3]!),
      id: "unreachable-remediation",
      order: 6,
      title: "An unreachable explanation",
    });
    expect(explanations(unreachable)).toMatch(/every lesson region must be reachable/i);

    const noEvidence = structuredClone(algebraLessonFixture);
    noEvidence.regions.forEach((region) => delete region.interaction);
    expect(explanations(noEvidence)).toMatch(/learner-owned practice|terminal lesson path/i);
  });

  it("rejects missing or ambiguous fallbacks and more than four decisions", () => {
    const missingFallback = structuredClone(algebraLessonFixture);
    missingFallback.flow.edges = missingFallback.flow.edges.filter(
      (edge) => edge.id !== "algebra-edge-remediate",
    );
    expect(explanations(missingFallback)).toMatch(/unconditional fallback/i);

    const ambiguous = structuredClone(algebraLessonFixture);
    ambiguous.flow.edges.splice(4, 0, {
      id: "ambiguous-answer",
      from: "algebra-practice",
      to: "algebra-remediation",
      priority: 1,
      condition: { type: "answer_equals", value: "2" },
    });
    ambiguous.flow.edges.find(
      (edge) => edge.id === "algebra-edge-remediate",
    )!.priority = 2;
    expect(explanations(ambiguous)).toMatch(/cannot mix answer and correctness/i);

    const duplicateFallback = structuredClone(algebraLessonFixture);
    duplicateFallback.flow.edges.push({
      id: "second-always-edge",
      from: "algebra-orientation",
      to: "algebra-practice",
      priority: 1,
      condition: { type: "always" },
    });
    expect(explanations(duplicateFallback)).toMatch(
      /only one unconditional edge/i,
    );

    expect(explanations(decisionDepthFixture())).toMatch(/at most four conditional decisions/i);
  });

  it("requires official provenance for current lessons and validates rich limits", () => {
    const current = createPersonalizedCodexLesson();
    for (const region of current.regions) {
      for (const content of region.content) {
        if (content.type === "source_cards") {
          content.sources.forEach((source) => {
            source.sourceType = "community";
          });
        }
      }
    }
    expect(explanations(current)).toMatch(/official source reference/i);

    const unanchored = createPersonalizedCodexLesson();
    unanchored.regions[2]!.provenance.forEach((entry) => {
      entry.sourceRefs = [];
    });
    expect(explanations(unanchored)).toMatch(/official OpenAI provenance/i);

    const missingRetrievalDate = createPersonalizedCodexLesson();
    const officialCards = missingRetrievalDate.regions
      .flatMap((region) => region.content)
      .find((content) => content.type === "source_cards");
    if (!officialCards || officialCards.type !== "source_cards") {
      throw new Error("Expected current lesson source cards.");
    }
    delete officialCards.sources[0]!.retrievedAt;
    expect(explanations(missingRetrievalDate)).toMatch(/visible retrieval date/i);

    const unsafe = structuredClone(algebraLessonFixture);
    unsafe.regions[0]!.content.push({
      type: "diagram",
      syntax: "mermaid",
      source: "flowchart LR\n A --> B\n click A https://example.com",
      title: "Unsafe link",
      description: "A diagram that tries to enable an outbound link.",
    });
    unsafe.regions[1]!.content.push({
      type: "formula",
      latex: "x".repeat(4097),
      accessibleLabel: "An oversized formula",
    });
    expect(explanations(unsafe)).toMatch(/links and html are not allowed/i);
    expect(explanations(unsafe)).toMatch(/cannot exceed 4 kb/i);
  });

  it("builds current Codex modules from ranked radar data", () => {
    const document = createPersonalizedCodexLesson([], [
      {
        id: "radar-browser-work",
        topic: "Browser verification",
        summary: "Use current browser workflows to verify a visible result.",
        officialUrl: "https://learn.chatgpt.com/docs/app",
        officialPublishedAt: "2026-08-28T12:00:00.000Z",
        communitySources: [
          {
            url: "https://example.com/codex-browser-work",
            publishedAt: "2026-08-30T12:00:00.000Z",
          },
        ],
        retrievedAt: "2026-09-01T12:00:00.000Z",
        availability: "Codex desktop; check current plan availability.",
        learnerRelevance: 1,
        officialRecency: 0.8,
        communityCorroboration: 0.4,
        score: 0.82,
        authority: "official",
      },
      {
        id: "radar-community-idea",
        topic: "Review rituals",
        summary: "A community pattern worth exploring without treating it as product behavior.",
        communitySources: [
          {
            url: "https://example.com/codex-review-ritual",
            publishedAt: "2026-08-29T12:00:00.000Z",
          },
        ],
        retrievedAt: "2026-09-01T12:00:00.000Z",
        learnerRelevance: 0.7,
        officialRecency: 0,
        communityCorroboration: 0.5,
        score: 0.45,
        authority: "community_exploration",
      },
    ]);
    const moduleRegion = document.regions.find(
      (region) => region.id === "codex-modules",
    )!;
    expect(moduleRegion.title).toContain("Browser verification");
    expect(moduleRegion.title).toContain("Exploration · Review rituals");
    expect(JSON.stringify(moduleRegion.content)).toContain("Community source");
    expect(JSON.stringify(moduleRegion.content)).toContain(
      "2026-08-29T12:00:00.000Z",
    );
    expect(validateLessonDocument(document, [])).toMatchObject({ valid: true });
  });
});
