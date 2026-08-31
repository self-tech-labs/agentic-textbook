import { beforeEach, describe, expect, it } from "vitest";
import { createInitialCanvasState } from "../hooks/useLearningCanvas";
import { loadCanvasState, saveCanvasState } from "./canvasPersistence";

describe("v3 canvas persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("ignores the obsolete v2 key without deleting it", () => {
    window.localStorage.setItem(
      "learn-ogram-canvas:v2",
      JSON.stringify({ version: 2, activeExperience: { title: "Obsolete lesson" } }),
    );
    expect(loadCanvasState()).toBeNull();
    expect(window.localStorage.getItem("learn-ogram-canvas:v2")).not.toBeNull();
  });

  it("restores v3 domain state but clears transient selected text", () => {
    const state = createInitialCanvasState();
    state.session = {
      id: "learning-session-persisted",
      topic: "How transformers work",
      goal: null,
      stage: "learning",
      startedAt: "2026-08-31T14:00:00.000Z",
      contextConsent: null,
      personalization: "skipped",
    };
    state.focus = { regionId: "self-attention", selectedText: "temporary selection" };
    saveCanvasState(state);

    expect(loadCanvasState()).toMatchObject({
      version: 3,
      session: { stage: "learning", topic: "How transformers work" },
      focus: { regionId: "self-attention", selectedText: null },
    });
  });
});
