import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState, useLearningStore } from "./useLearningStore";
import type { LearningActions } from "./useLearningStore";
import type { LearningState } from "../domain/types";

let current: { state: LearningState; actions: LearningActions } | null = null;

function Harness() {
  current = useLearningStore();
  return null;
}

describe("useLearningStore commit receipts", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.ogramDesktop;
    current = null;
  });

  it("rejects an exact event waiter when reset supersedes its pending write", async () => {
    render(<Harness />);
    await waitFor(() => expect(current).not.toBeNull());
    const actions = current!.actions;
    const before = actions.getState();
    let outcome!: Promise<string>;

    act(() => {
      const mutation = actions.submitSignals(before.signals);
      expect(actions.getState().revision).toBe(before.revision);
      outcome = actions
        .awaitRevision(mutation.revision, mutation.eventId)
        .then(
          () => "resolved",
          (error: Error) => error.message,
        );
      actions.reset();
    });

    await expect(outcome).resolves.toMatch(/superseded before it committed/);
    expect(actions.getState().sessionId).not.toBe(before.sessionId);
    expect(
      actions
        .getState()
        .events.some((event) => event.id === before.events.at(-1)?.id),
    ).toBe(false);
  });

  it("rejects a structurally plausible cache whose event violates the public contract", async () => {
    const cached = createInitialState(new Date("2026-08-29T08:00:00.000Z"));
    const tampered = JSON.parse(JSON.stringify(cached)) as LearningState;
    const signalsEvent = tampered.events.find(
      (event) => event.type === "coaching_signals_submitted",
    )!;
    signalsEvent.payload = {
      ...signalsEvent.payload,
      contextReceiptId: "receipt-that-does-not-belong-here",
    };
    window.localStorage.setItem(
      "ogram-learning-ledger:v3",
      JSON.stringify(tampered),
    );

    render(<Harness />);
    await waitFor(() => expect(current).not.toBeNull());

    expect(current!.state.sessionId).not.toBe(cached.sessionId);
  });
});
