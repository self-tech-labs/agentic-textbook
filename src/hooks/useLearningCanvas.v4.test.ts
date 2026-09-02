import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { algebraLessonFixture, codeLessonFixture } from "../domain/v4Fixtures";
import { useLearningCanvas } from "./useLearningCanvas";

describe("V4 learner evidence", () => {
  beforeEach(() => window.localStorage.clear());

  it("makes a submitted response and its selected branch immutable", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    act(() => {
      actions.beginSession({
        topic: algebraLessonFixture.topic,
        blueprintId: algebraLessonFixture.blueprintId,
        pedagogicalMode: "quantitative",
      });
      actions.skipContext();
    });
    act(() => {
      actions.prepareLesson({
        baseRevision: actions.getState().revision,
        idempotencyKey: "prepare-algebra-v4-01",
        document: structuredClone(algebraLessonFixture),
      });
    });
    act(() => {
      actions.approveLesson(algebraLessonFixture.revision);
      actions.publishLesson({
        baseRevision: actions.getState().revision,
        draftRevision: algebraLessonFixture.revision,
        idempotencyKey: "publish-algebra-v4-01",
      });
      actions.submitLearnerResponse("algebra-practice", "1");
    });
    expect(() =>
      actions.submitLearnerResponse("algebra-practice", "2"),
    ).toThrow(/immutable/i);

    const staleRevision = structuredClone(algebraLessonFixture);
    let stalePrepared!: ReturnType<typeof actions.prepareLesson>;
    act(() => {
      stalePrepared = actions.prepareLesson({
        baseRevision: actions.getState().revision,
        idempotencyKey: "restructure-algebra-stale-v4-01",
        document: staleRevision,
      });
    });
    expect(stalePrepared.valid).toBe(false);
    expect(stalePrepared.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          explanation: expect.stringMatching(/new draft revision/i),
        }),
      ]),
    );

    const replacement = structuredClone(algebraLessonFixture);
    replacement.revision = 2;
    replacement.flow.edges.find(
      (edge) => edge.id === "algebra-edge-remediate",
    )!.id = "renamed-selected-edge";
    let prepared!: ReturnType<typeof actions.prepareLesson>;
    act(() => {
      prepared = actions.prepareLesson({
        baseRevision: actions.getState().revision,
        idempotencyKey: "restructure-algebra-v4-02",
        document: replacement,
      });
    });
    expect(prepared.valid).toBe(false);
    expect(prepared.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          explanation: expect.stringMatching(/selected branch.*immutable/i),
        }),
      ]),
    );
    expect(
      actions.getState().regions.find((region) => region.id === "algebra-practice")
        ?.response,
    ).toMatchObject({ value: "1", correct: false });
  });

  it("stores code source and a result summary locally without changing it later", () => {
    const { result } = renderHook(() => useLearningCanvas());
    const actions = result.current.actions;
    act(() => {
      actions.beginSession({
        topic: codeLessonFixture.topic,
        blueprintId: codeLessonFixture.blueprintId,
        pedagogicalMode: "code",
      });
      actions.skipContext();
      actions.prepareLesson({
        baseRevision: actions.getState().revision,
        idempotencyKey: "prepare-code-v4-01",
        document: structuredClone(codeLessonFixture),
      });
      actions.approveLesson(codeLessonFixture.revision);
      actions.publishLesson({
        baseRevision: actions.getState().revision,
        draftRevision: codeLessonFixture.revision,
        idempotencyKey: "publish-code-v4-01",
      });
      actions.submitLearnerResponse(
        "javascript-lab",
        "export function sum(values) { return values.reduce((a, b) => a + b, 0); }",
        {
          status: "passed",
          sourceHash: "sha256-local-source",
          passedTests: 3,
          totalTests: 3,
        },
      );
    });
    const response = actions
      .getState()
      .regions.find((region) => region.id === "javascript-lab")?.response;
    expect(response).toMatchObject({
      value: expect.stringContaining("values.reduce"),
      execution: {
        status: "passed",
        sourceHash: "sha256-local-source",
        passedTests: 3,
        totalTests: 3,
      },
      submittedAt: expect.any(String),
    });
  });
});
