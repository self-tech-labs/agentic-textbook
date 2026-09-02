import { beforeEach, describe, expect, it } from "vitest";
import { createInitialCanvasState } from "../hooks/useLearningCanvas";
import type { CanvasRegion } from "../domain/agentCanvas";
import { transformerLessonFixture } from "../domain/transformerFixture";
import {
  canvasStorageKeyV3,
  canvasStorageKeyV4,
  loadCanvasState,
  saveCanvasState,
} from "./canvasPersistence";

describe("v4 canvas persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("ignores the obsolete v2 key without deleting it", () => {
    window.localStorage.setItem(
      "learn-ogram-canvas:v2",
      JSON.stringify({ version: 2, activeExperience: { title: "Obsolete lesson" } }),
    );
    expect(loadCanvasState()).toBeNull();
    expect(window.localStorage.getItem("learn-ogram-canvas:v2")).not.toBeNull();
  });

  it("restores v4 domain state but clears transient selected text", () => {
    const state = createInitialCanvasState();
    state.session = {
      id: "learning-session-persisted",
      briefId: null,
      blueprintId: "transformer_technical_beginner",
      topic: "How transformers work",
      goal: null,
      stage: "learning",
      startedAt: "2026-08-31T14:00:00.000Z",
      contextConsent: null,
      personalization: "skipped",
      hostCapabilities: [],
    };
    state.focus = { regionId: "self-attention", selectedText: "temporary selection" };
    saveCanvasState(state);

    expect(loadCanvasState()).toMatchObject({
      version: 4,
      session: { stage: "learning", topic: "How transformers work" },
      focus: { regionId: "self-attention", selectedText: null },
    });
  });

  it("migrates a raw v3 session only after validation and retains rollback data", () => {
    const {
      schemaVersion: _schemaVersion,
      blueprintId: _blueprintId,
      pedagogicalMode: _pedagogicalMode,
      sourcePolicy: _sourcePolicy,
      flow: _flow,
      assetRefs: _assetRefs,
      ...legacyDraft
    } = structuredClone(transformerLessonFixture);
    const liveRegions: CanvasRegion[] = transformerLessonFixture.regions.map((region) => ({
      ...structuredClone(region),
      revision: 3,
      status: "updated" as const,
      history: [],
    }));
    const evidenceRegion = liveRegions.find(
      (region) => region.id === "next-token-practice",
    )!;
    evidenceRegion.response = {
      value: "next-token",
      correct: true,
      submittedAt: "2026-08-31T15:00:00.000Z",
    };
    evidenceRegion.history = [
      {
        undoToken: "legacy-undo-token",
        revision: 2,
        status: "ready",
        content: structuredClone(evidenceRegion.content),
        provenance: structuredClone(evidenceRegion.provenance),
      },
    ];
    const legacyState = {
      version: 3,
      revision: 12,
      session: {
        id: "legacy-session",
        topic: "How transformers work",
        goal: "Explain the attention mechanism.",
        stage: "learning",
        startedAt: "2026-08-31T14:00:00.000Z",
        contextConsent: null,
        personalization: "skipped",
      },
      contextClaims: [],
      lesson: {
        status: "published",
        draft: legacyDraft,
        construction: null,
        validation: null,
        approvedDraftRevision: legacyDraft.revision,
        publishedRevision: legacyDraft.revision,
      },
      regions: liveRegions,
      focus: {
        regionId: "next-token-practice",
        selectedText: "transient selection",
      },
      events: [
        {
          id: "legacy-event",
          sequence: 1,
          type: "learner.response.submitted",
          actor: "learner",
          at: "2026-08-31T15:00:00.000Z",
          summary: "Legacy response saved.",
        },
      ],
      commandReceipts: [],
    };
    const serialized = JSON.stringify(legacyState);
    window.localStorage.setItem(canvasStorageKeyV3, serialized);

    const migrated = loadCanvasState();
    expect(migrated).toMatchObject({
      version: 4,
      migratedFrom: 3,
      session: {
        blueprintId: "transformer_technical_beginner",
        hostCapabilities: [],
      },
      focus: {
        regionId: "next-token-practice",
        selectedText: null,
      },
    });
    expect(migrated?.lesson.draft?.schemaVersion).toBe(4);
    expect(migrated?.lesson.draft?.flow.edges).toHaveLength(
      legacyDraft.regions.length - 1,
    );
    expect(
      migrated?.regions.find((region) => region.id === "next-token-practice"),
    ).toMatchObject({
      response: { value: "next-token", correct: true },
      history: [{ undoToken: "legacy-undo-token" }],
      provenance: evidenceRegion.provenance,
    });
    expect(window.localStorage.getItem(canvasStorageKeyV3)).toBe(serialized);
    expect(window.localStorage.getItem(canvasStorageKeyV4)).not.toBeNull();
  });
});
