import type {
  ContextPackCard,
  ContextPackCardId,
  ContextPackCoachingMove,
  ContextPackPlacement,
  ContextPackReview,
  ContextPackingInstrument,
  PracticeCollaboration,
  SharedContextPackSnapshot,
} from "./types";

const cards: readonly ContextPackCard[] = [
  {
    id: "outcome",
    label: "Approved outcome",
    description: "What the new Codex task must produce.",
    expectedZone: "carry",
  },
  {
    id: "approved_decision",
    label: "Approved decision",
    description: "The direction already chosen and worth preserving.",
    expectedZone: "carry",
  },
  {
    id: "constraint",
    label: "Active constraint",
    description: "A boundary the next task must continue to respect.",
    expectedZone: "carry",
  },
  {
    id: "done_when",
    label: "Definition of done",
    description: "How the learner will recognize a finished result.",
    expectedZone: "carry",
  },
  {
    id: "open_question",
    label: "Named open question",
    description: "A remaining uncertainty, clearly labelled as unresolved.",
    expectedZone: "carry",
  },
  {
    id: "rejected_direction",
    label: "Rejected direction",
    description: "An explored route that the team has already ruled out.",
    expectedZone: "leave",
  },
  {
    id: "full_conversation",
    label: "Full conversation",
    description: "Every turn, detour, and intermediate draft from exploration.",
    expectedZone: "leave",
  },
  {
    id: "sensitive_material",
    label: "Secrets and personal data",
    description: "Credentials, personal details, and unrelated private material.",
    expectedZone: "leave",
  },
];

const carryPrompts: Record<ContextPackCardId, string> = {
  outcome:
    "The new task still needs a precise destination. Would carrying the approved outcome reduce guesswork?",
  approved_decision:
    "This is settled reasoning, not exploration. Would the next task benefit from keeping the decision?",
  constraint:
    "A clean fork can still drift without its active boundary. Would you carry this constraint across?",
  done_when:
    "The pack explains the work, but not when to stop. Would a definition of done make the handoff testable?",
  open_question:
    "Uncertainty is useful context when it is named honestly. Would you carry this as an open question?",
  rejected_direction: "",
  full_conversation: "",
  sensitive_material: "",
};

const leavePrompts: Record<ContextPackCardId, string> = {
  outcome: "",
  approved_decision: "",
  constraint: "",
  done_when: "",
  open_question: "",
  rejected_direction:
    "The decision is already settled. Would leaving the rejected route behind make the fork easier to steer?",
  full_conversation:
    "The useful decisions can travel without every detour. Would you leave the full conversation in the source task?",
  sensitive_material:
    "This category crosses the privacy boundary. Would you leave it out of the new task entirely?",
};

export interface ContextPackEvaluation {
  isReady: boolean;
  misplacedCardIds: ContextPackCardId[];
  indicators: {
    sufficient: boolean;
    lean: boolean;
    private: boolean;
  };
}

export function createContextPackingInstrument(): ContextPackingInstrument {
  return {
    kind: "context_packing",
    title: "Pack the next task, not the whole conversation",
    prompt:
      "Decide what a clean Codex fork needs to act well—and what should remain in the source task.",
    cards: cards.map((card) => ({ ...card })),
  };
}

export function createPracticeCollaboration(): PracticeCollaboration {
  return {
    phase: "drafting",
    consent: "private",
    attemptRevision: 0,
    snapshots: [],
    reviews: [],
  };
}

export function normalizeContextPackPlacements(
  instrument: ContextPackingInstrument,
  placements: readonly ContextPackPlacement[],
): ContextPackPlacement[] {
  if (!Array.isArray(placements) || placements.length !== instrument.cards.length) {
    throw new Error(
      `Place all ${instrument.cards.length} context cards before sharing this attempt.`,
    );
  }
  const supplied = new Map<ContextPackCardId, ContextPackPlacement>();
  for (const [index, placement] of placements.entries()) {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) {
      throw new Error(`placements[${index}] must be a card placement.`);
    }
    const keys = Object.keys(placement);
    if (keys.some((key) => key !== "cardId" && key !== "zone")) {
      throw new Error(`placements[${index}] contains unsupported fields.`);
    }
    if (placement.zone !== "carry" && placement.zone !== "leave") {
      throw new Error(`placements[${index}].zone must be carry or leave.`);
    }
    if (!instrument.cards.some((card) => card.id === placement.cardId)) {
      throw new Error(`placements[${index}].cardId is not part of this instrument.`);
    }
    if (supplied.has(placement.cardId)) {
      throw new Error(`Context card ${placement.cardId} was placed more than once.`);
    }
    supplied.set(placement.cardId, { cardId: placement.cardId, zone: placement.zone });
  }
  return instrument.cards.map((card) => {
    const placement = supplied.get(card.id);
    if (!placement) throw new Error(`Context card ${card.id} is unplaced.`);
    return placement;
  });
}

export function evaluateContextPack(
  instrument: ContextPackingInstrument,
  placements: readonly ContextPackPlacement[],
): ContextPackEvaluation {
  const normalized = normalizeContextPackPlacements(instrument, placements);
  const zones = new Map(normalized.map((placement) => [placement.cardId, placement.zone]));
  const misplacedCardIds = instrument.cards
    .filter((card) => zones.get(card.id) !== card.expectedZone)
    .map((card) => card.id);
  const inExpectedZone = (cardId: ContextPackCardId) => {
    const card = instrument.cards.find((candidate) => candidate.id === cardId);
    return card !== undefined && zones.get(cardId) === card.expectedZone;
  };
  return {
    isReady: misplacedCardIds.length === 0,
    misplacedCardIds,
    indicators: {
      sufficient: [
        "outcome",
        "approved_decision",
        "constraint",
        "done_when",
        "open_question",
      ].every((cardId) => inExpectedZone(cardId as ContextPackCardId)),
      lean: ["rejected_direction", "full_conversation"].every((cardId) =>
        inExpectedZone(cardId as ContextPackCardId),
      ),
      private: inExpectedZone("sensitive_material"),
    },
  };
}

export function compileContextPackReview(
  instrument: ContextPackingInstrument,
  snapshot: SharedContextPackSnapshot,
  move: ContextPackCoachingMove,
  cardId: ContextPackCardId | null,
  id: string,
  at: string,
): ContextPackReview {
  const evaluation = evaluateContextPack(instrument, snapshot.placements);
  if (move === "confirm_ready") {
    if (cardId !== null) {
      throw new Error("A ready confirmation cannot target a context card.");
    }
    if (!evaluation.isReady) {
      throw new Error("This attempt still contains a misplaced context card.");
    }
    return {
      id,
      attemptRevision: snapshot.attemptRevision,
      at,
      move,
      cardId: null,
      message:
        "This revision is sufficient, lean, and privacy-safe. The learner can now carry the habit into a real Codex fork.",
      resolution: "accepted",
    };
  }

  if (cardId === null || !evaluation.misplacedCardIds.includes(cardId)) {
    throw new Error(
      "A reconsideration note must target a card that is misplaced in this exact revision.",
    );
  }
  const card = instrument.cards.find((candidate) => candidate.id === cardId)!;
  const message =
    card.expectedZone === "carry" ? carryPrompts[cardId] : leavePrompts[cardId];
  return {
    id,
    attemptRevision: snapshot.attemptRevision,
    at,
    move,
    cardId,
    message,
    resolution: "pending",
  };
}
