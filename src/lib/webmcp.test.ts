import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decisionLabExperience,
  fixtureLearningBrief,
} from "../domain/fixtures";
import {
  createInitialCanvasState,
  type CanvasActions,
} from "../hooks/useLearningCanvas";
import { createOgramLearningTools, registerOgramLearningTools } from "./webmcp";

function mockActions(): CanvasActions {
  const state = createInitialCanvasState(
    new Date("2026-08-29T10:00:00.000Z"),
  );
  return {
    getState: () => state,
    reset: vi.fn(),
    proposeLearningNeeds: vi.fn(() => ({
      revision: 4,
      eventId: "event-needs",
      proposedClaimIds: ["claim-new"],
    })),
    reviewContextClaim: vi.fn(() => ({
      eventId: "event-review",
      claimId: "claim-new",
      decision: "accepted",
    })),
    createDraft: vi.fn(() => ({
      eventId: "event-draft",
      experienceId: "experience-new",
      draftRevision: 2,
    })),
    patchDraft: vi.fn(() => ({
      eventId: "event-patch",
      draftRevision: 3,
      operationCount: 1,
    })),
    validateDraft: vi.fn(() => ({
      eventId: "event-validate",
      draftRevision: 2,
      valid: true,
      digest: "lx-valid000",
      diagnostics: [],
    })),
    requestDraftReview: vi.fn(() => ({
      eventId: "event-review-request",
      draftRevision: 2,
      status: "awaiting_review" as const,
    })),
    approveDraft: vi.fn(() => ({
      eventId: "event-approve",
      receiptId: "consent-approved",
      draftRevision: 2,
    })),
    publishDraft: vi.fn(() => ({
      eventId: "event-publish",
      experienceId: "experience-new",
      publishedRevision: 2,
      digest: "lx-valid000",
    })),
    registerDraftAsset: vi.fn(() => ({
      eventId: "event-asset",
      assetId: "asset-01",
      draftRevision: 3,
    })),
    proposeAdaptation: vi.fn(() => ({
      eventId: "event-adapt",
      draftRevision: 2,
      valid: true,
      status: "awaiting_review" as const,
    })),
    submitLearnerResponse: vi.fn(() => ({ eventId: "event-response" })),
    advance: vi.fn(() => ({
      eventId: "event-advance",
      status: "active",
      currentNodeId: "next",
    })),
    submitLearnerFeedback: vi.fn(() => ({ eventId: "event-feedback" })),
  };
}

describe("Ogram generative WebMCP surface", () => {
  beforeEach(() => {
    delete window.__OGRAM_WEBMCP_TOOLS__;
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("advertises a universal primitive contract and human-only actions", () => {
    const tools = createOgramLearningTools(mockActions());
    expect(tools).toHaveLength(11);
    const contract = tools.find(
      (tool) => tool.name === "ogram_get_canvas_contract",
    )!.execute({}) as Record<string, unknown>;
    expect(contract.authoringModel).toMatch(/agent authors a declarative/i);
    expect(contract.humanOnlyActions).toContain("answer learning interactions");
    expect((contract.primitives as unknown[]).length).toBe(9);
    expect(tools.some((tool) => tool.name.includes("record_choice"))).toBe(false);
  });

  it("accepts a complete agent-authored document rather than a recipe id", () => {
    const actions = mockActions();
    const tool = createOgramLearningTools(actions).find(
      (candidate) => candidate.name === "ogram_create_experience_draft",
    )!;
    const document = {
      ...structuredClone(decisionLabExperience),
      draftRevision: 2,
      learningBriefId: fixtureLearningBrief.id,
    };
    tool.execute({
      basePublishedRevision: 1,
      idempotencyKey: "draft-command-01",
      document,
    });
    expect(actions.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        basePublishedRevision: 1,
        document: expect.objectContaining({ nodes: expect.any(Array) }),
      }),
    );
  });

  it("fails publication when the learner approval gate fails", () => {
    const actions = mockActions();
    vi.mocked(actions.publishDraft).mockImplementation(() => {
      throw new Error("Learner approval for this exact revision is required.");
    });
    const tool = createOgramLearningTools(actions).find(
      (candidate) => candidate.name === "ogram_publish_experience",
    )!;
    expect(() =>
      tool.execute({
        draftRevision: 2,
        idempotencyKey: "publish-command-01",
      }),
    ).toThrow(/Learner approval/);
  });

  it("keeps a test and replay registry when native WebMCP is unavailable", async () => {
    const registration = await registerOgramLearningTools(mockActions());
    expect(registration.supported).toBe(false);
    expect(registration.toolCount).toBe(11);
    expect(
      window.__OGRAM_WEBMCP_TOOLS__?.ogram_create_experience_draft,
    ).toBeDefined();
    registration.cleanup();
    expect(window.__OGRAM_WEBMCP_TOOLS__).toBeUndefined();
  });
});
