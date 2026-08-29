import { describe, expect, it } from "vitest";
import {
  compileContextPackReview,
  createContextPackingInstrument,
  evaluateContextPack,
  normalizeContextPackPlacements,
} from "./practiceEngine";
import type { ContextPackPlacement } from "./types";

function expectedPlacements(): ContextPackPlacement[] {
  return createContextPackingInstrument().cards.map((card) => ({
    cardId: card.id,
    zone: card.expectedZone,
  }));
}

describe("practiceEngine", () => {
  it("builds one bounded instrument with unique page-owned cards", () => {
    const instrument = createContextPackingInstrument();
    expect(instrument.cards).toHaveLength(8);
    expect(new Set(instrument.cards.map((card) => card.id))).toHaveLength(8);
    expect(
      instrument.cards.every(
        (card) => card.label.length > 0 && card.description.length > 0,
      ),
    ).toBe(true);
  });

  it("normalizes exact placements and rejects missing, duplicate, or extra fields", () => {
    const instrument = createContextPackingInstrument();
    const placements = expectedPlacements().reverse();
    expect(normalizeContextPackPlacements(instrument, placements).map((item) => item.cardId))
      .toEqual(instrument.cards.map((card) => card.id));
    expect(() => normalizeContextPackPlacements(instrument, placements.slice(1))).toThrow(
      "Place all 8",
    );
    expect(() =>
      normalizeContextPackPlacements(instrument, [
        ...placements.slice(0, -1),
        placements[0]!,
      ]),
    ).toThrow(/more than once|unplaced/);
    expect(() =>
      normalizeContextPackPlacements(instrument, [
        ...placements.slice(0, -1),
        { ...placements.at(-1)!, prose: "not allowed" } as ContextPackPlacement,
      ]),
    ).toThrow("unsupported fields");
  });

  it("evaluates structural sufficiency, leanness, and privacy without changing input", () => {
    const instrument = createContextPackingInstrument();
    const placements = expectedPlacements();
    const ready = evaluateContextPack(instrument, placements);
    expect(ready).toEqual({
      isReady: true,
      misplacedCardIds: [],
      indicators: { sufficient: true, lean: true, private: true },
    });
    const imperfect = placements.map((placement) =>
      placement.cardId === "done_when"
        ? { ...placement, zone: "leave" as const }
        : placement,
    );
    expect(evaluateContextPack(instrument, imperfect)).toMatchObject({
      isReady: false,
      misplacedCardIds: ["done_when"],
      indicators: { sufficient: false, lean: true, private: true },
    });
    const unnamedUncertainty = placements.map((placement) =>
      placement.cardId === "open_question"
        ? { ...placement, zone: "leave" as const }
        : placement,
    );
    expect(evaluateContextPack(instrument, unnamedUncertainty)).toMatchObject({
      isReady: false,
      misplacedCardIds: ["open_question"],
      indicators: { sufficient: false, lean: true, private: true },
    });
    expect(placements.find((item) => item.cardId === "done_when")?.zone).toBe(
      "carry",
    );
  });

  it("compiles bounded Socratic marginalia and refuses misleading moves", () => {
    const instrument = createContextPackingInstrument();
    const placements = expectedPlacements().map((placement) =>
      placement.cardId === "full_conversation"
        ? { ...placement, zone: "carry" as const }
        : placement,
    );
    const snapshot = {
      attemptRevision: 1,
      sharedAt: "2026-08-29T10:00:00.000Z",
      placements,
    };
    const review = compileContextPackReview(
      instrument,
      snapshot,
      "reconsider_card",
      "full_conversation",
      "review-12345678",
      "2026-08-29T10:01:00.000Z",
    );
    expect(review).toMatchObject({
      move: "reconsider_card",
      cardId: "full_conversation",
      resolution: "pending",
    });
    expect(review.message.length).toBeLessThan(240);
    expect(() =>
      compileContextPackReview(
        instrument,
        snapshot,
        "reconsider_card",
        "outcome",
        "review-23456789",
        "2026-08-29T10:01:00.000Z",
      ),
    ).toThrow("must target a card that is misplaced");
    expect(() =>
      compileContextPackReview(
        instrument,
        snapshot,
        "confirm_ready",
        null,
        "review-34567890",
        "2026-08-29T10:01:00.000Z",
      ),
    ).toThrow("still contains a misplaced");
  });
});
