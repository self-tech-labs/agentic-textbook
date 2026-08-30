import { describe, expect, it } from "vitest";
import {
  applyExperiencePatches,
  compileExperience,
} from "./compiler";
import type { LearningExperienceDocument } from "./experience";
import {
  decisionLabExperience,
  experienceFixtures,
  fixtureLearningBrief,
} from "./fixtures";

describe("generative experience compiler", () => {
  it("compiles three structurally different agent-authored experiences", () => {
    const signatures = experienceFixtures.map((experience) => {
      const result = compileExperience(
        experience,
        fixtureLearningBrief.approvedClaimIds,
        new Date("2026-08-29T10:00:00.000Z"),
      );
      expect(result.valid, JSON.stringify(result.diagnostics, null, 2)).toBe(true);
      expect(result.program?.document.experienceId).toBe(experience.experienceId);
      return experience.nodes.map((node) => node.primitiveId).join("→");
    });

    expect(new Set(signatures).size).toBe(3);
    expect(
      experienceFixtures.some((experience) =>
        experience.edges.some((edge) => edge.condition.op !== "always"),
      ),
    ).toBe(true);
  });

  it("rejects a passive-only experience even when its graph terminates", () => {
    const objective = decisionLabExperience.nodes.find(
      (node) => node.id === "door-objective",
    )!;
    const concept = decisionLabExperience.nodes.find(
      (node) => node.id === "door-rule",
    )!;
    const example = decisionLabExperience.nodes.find(
      (node) => node.id === "door-remediation",
    )!;
    const passive: LearningExperienceDocument = {
      ...structuredClone(decisionLabExperience),
      nodes: [objective, concept, example],
      edges: [
        { id: "passive-1", from: objective.id, to: concept.id, condition: { op: "always" } },
        { id: "passive-2", from: concept.id, to: example.id, condition: { op: "always" } },
      ],
      entryNodeId: objective.id,
      completion: {
        requiredObjectiveIds: ["objective-boundary-choice"],
        requiredNodeIds: [],
        minimumUnassistedAttempts: 0,
        requireTransfer: false,
      },
    };

    const result = compileExperience(passive, fixtureLearningBrief.approvedClaimIds);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((item) => item.ruleId)).toContain(
      "pedagogy.active-generation",
    );
    expect(result.diagnostics.map((item) => item.ruleId)).toContain(
      "pedagogy.objective-evidence",
    );
  });

  it("blocks personalization that the learner has not approved", () => {
    const experience = structuredClone(decisionLabExperience);
    experience.provenance.push({
      id: "unreviewed",
      lane: "personalization",
      label: "An unreviewed hypothesis",
      sourceRef: "claim-never-approved",
    });
    const result = compileExperience(experience, fixtureLearningBrief.approvedClaimIds);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((item) => item.ruleId)).toContain(
      "privacy.approved-context",
    );
  });

  it("applies semantic patches without allowing arbitrary executable code", () => {
    const patched = applyExperiencePatches(decisionLabExperience, [
      {
        op: "replace_metadata",
        metadata: {
          ...decisionLabExperience.metadata,
          title: "A learner-specific boundary lab",
        },
      },
    ]);
    expect(patched.metadata.title).toBe("A learner-specific boundary lab");
    expect(decisionLabExperience.metadata.title).toBe("The three doors");
  });
});
