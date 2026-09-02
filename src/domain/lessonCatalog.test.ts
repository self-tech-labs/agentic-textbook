import { describe, expect, it } from "vitest";
import {
  briefFromStarter,
  LESSON_STARTERS,
  pedagogicalModeForBrief,
} from "./lessonCatalog";

describe("lesson brief pedagogy selection", () => {
  it("keeps visual algebra quantitative", () => {
    const brief = briefFromStarter(LESSON_STARTERS[1]!);
    expect(brief.preferredModes).toEqual(["visual", "quantitative"]);
    expect(pedagogicalModeForBrief(brief)).toBe("quantitative");
  });

  it("keeps the debugging starter in code mode", () => {
    const brief = briefFromStarter(LESSON_STARTERS[2]!);
    expect(pedagogicalModeForBrief(brief)).toBe("code");
  });

  it("uses mixed mode for an open topic with competing pedagogies", () => {
    expect(
      pedagogicalModeForBrief({
        blueprintId: "open_topic_v1",
        preferredModes: ["quantitative", "scenario", "visual"],
      }),
    ).toBe("mixed");
  });
});
