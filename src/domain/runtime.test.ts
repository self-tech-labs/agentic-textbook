import { describe, expect, it } from "vitest";
import { decisionLabExperience } from "./fixtures";
import {
  advanceRuntime,
  createRuntimeState,
  submitRuntimeResponse,
} from "./runtime";

describe("learning canvas runtime", () => {
  it("executes a learner-owned branch and completes only with required evidence", () => {
    let runtime = createRuntimeState(
      decisionLabExperience,
      new Date("2026-08-29T10:00:00.000Z"),
    );
    runtime = advanceRuntime(decisionLabExperience, runtime);
    expect(runtime.currentNodeId).toBe("door-prediction");

    runtime = submitRuntimeResponse(
      decisionLabExperience,
      runtime,
      "door-prediction",
      "fork",
      0.7,
    ).runtime;
    runtime = advanceRuntime(decisionLabExperience, runtime);
    runtime = advanceRuntime(decisionLabExperience, runtime);
    expect(runtime.currentNodeId).toBe("door-scenario");

    runtime = submitRuntimeResponse(
      decisionLabExperience,
      runtime,
      "door-scenario",
      "fork",
      0.8,
    ).runtime;
    runtime = advanceRuntime(decisionLabExperience, runtime);
    expect(runtime.currentNodeId).toBe("door-explain-back");
    expect(runtime.visitedNodeIds).not.toContain("door-remediation");

    runtime = submitRuntimeResponse(
      decisionLabExperience,
      runtime,
      "door-explain-back",
      "A fork preserves approved decisions when the next deliverable changes.",
      undefined,
    ).runtime;
    runtime = advanceRuntime(decisionLabExperience, runtime);
    runtime = submitRuntimeResponse(
      decisionLabExperience,
      runtime,
      "door-transfer",
      "When my deliverable changes, I will fork with a short approved handoff.",
      undefined,
    ).runtime;
    runtime = advanceRuntime(decisionLabExperience, runtime);

    expect(runtime.status).toBe("completed");
    expect(runtime.currentNodeId).toBeNull();
    expect(Object.keys(runtime.responses)).toHaveLength(4);
  });

  it("takes the remediation branch after an incorrect response", () => {
    let runtime = createRuntimeState(decisionLabExperience);
    runtime = advanceRuntime(decisionLabExperience, runtime);
    runtime = submitRuntimeResponse(
      decisionLabExperience,
      runtime,
      "door-prediction",
      "continue",
      0.9,
    ).runtime;
    runtime = advanceRuntime(decisionLabExperience, runtime);
    runtime = advanceRuntime(decisionLabExperience, runtime);
    runtime = submitRuntimeResponse(
      decisionLabExperience,
      runtime,
      "door-scenario",
      "continue",
      0.9,
    ).runtime;
    runtime = advanceRuntime(decisionLabExperience, runtime);
    expect(runtime.currentNodeId).toBe("door-remediation");
  });

  it("will not let a passive agent advance through a learner prompt", () => {
    let runtime = createRuntimeState(decisionLabExperience);
    runtime = advanceRuntime(decisionLabExperience, runtime);
    expect(() => advanceRuntime(decisionLabExperience, runtime)).toThrow(
      /Respond to the visible learning prompt/,
    );
  });
});
