import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

const expectedZones = {
  "Approved outcome": "Carry",
  "Approved decision": "Carry",
  "Active constraint": "Carry",
  "Definition of done": "Carry",
  "Named open question": "Carry",
  "Rejected direction": "Leave",
  "Full conversation": "Leave",
  "Secrets and personal data": "Leave",
} as const;

function placeCard(label: keyof typeof expectedZones, zone = expectedZones[label]) {
  const card = screen.getByText(label).closest<HTMLElement>("[data-card-id]");
  if (!card) throw new Error(`Could not find the ${label} practice card.`);
  fireEvent.click(
    within(card).getByRole("button", {
      name: new RegExp(`^${zone} ${label}$`, "i"),
    }),
  );
}

function placeExpectedPack() {
  (Object.keys(expectedZones) as Array<keyof typeof expectedZones>).forEach(
    (label) => placeCard(label),
  );
}

async function shareCurrentRevision(revision: number) {
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /let codex inspect this frozen revision’s 8 structural cards/i,
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`share as r${revision}`, "i") }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", {
        name: new RegExp(`r${revision} is open to codex`, "i"),
      }),
    ).toBeInTheDocument(),
  );
}

async function runWebMcpToolTurn() {
  await waitFor(() =>
    expect(
      window.__OGRAM_WEBMCP_TOOLS__?.ogram_inspect_practice_attempt,
    ).toBeDefined(),
  );
  const instrument = screen.getByRole("region", {
    name: /pack the next task, not the whole conversation/i,
  });
  const capsuleId = instrument.getAttribute("data-capsule-id");
  if (!capsuleId) throw new Error("The active practice capsule is unavailable.");
  const tools = window.__OGRAM_WEBMCP_TOOLS__!;
  let inspection: {
    attemptRevision?: number;
    rubric?: Record<string, boolean>;
  } = {};
  inspection = (await tools.ogram_inspect_practice_attempt!.execute({
    capsuleId,
  })) as { attemptRevision?: number; rubric?: Record<string, boolean> };
  if (!inspection.attemptRevision) {
    throw new Error("The shared attempt revision is unavailable.");
  }
  const ready =
    inspection.rubric !== undefined &&
    Object.values(inspection.rubric).every(Boolean);
  const coachingPromise = Promise.resolve(
    tools.ogram_record_coaching_move!.execute(
      ready
        ? {
            capsuleId,
            attemptRevision: inspection.attemptRevision,
            move: "confirm_ready",
          }
        : {
            capsuleId,
            attemptRevision: inspection.attemptRevision,
            move: "reconsider_card",
            cardId: "done_when",
          },
    ),
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await coachingPromise;
}

describe("Ogram Learn", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("opens as a calm, privacy-clear learning experience", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Know when to move to a new task" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/what we did not use/i)).toBeInTheDocument();
    expect(screen.getByText(/your task messages, files, titles/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open the shared practice/i })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /run the live build/i }),
    ).not.toBeInTheDocument();
  });

  it("supports learner → Codex → learner revision turns before completion", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open the shared practice/i }));
    expect(
      screen.getByRole("heading", { name: /pack a clean codex fork together/i }),
    ).toBeInTheDocument();

    placeExpectedPack();
    placeCard("Definition of done", "Leave");
    await shareCurrentRevision(1);
    expect(
      screen.getByText(/available for review: 8 structural card ids/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/will not impersonate codex locally/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /preview the codex tool turn/i }),
    ).not.toBeInTheDocument();

    await runWebMcpToolTurn();
    expect(screen.getByText(/codex · note on r1/i)).toBeInTheDocument();
    expect(screen.getByText(/target · definition of done/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /use this note/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /share as r2/i })).toBeInTheDocument(),
    );
    await shareCurrentRevision(2);
    await runWebMcpToolTurn();

    expect(
      screen.getByRole("heading", { name: /ready to fork/i }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: /r1 → r2/i })).getByText(
        /codex moved 0 cards/i,
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /carry the habit forward/i }),
    );

    expect(
      screen.getByRole("heading", { name: /make the good choice easy/i }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /bring this rule back/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /save practice and finish/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/you’re done for today/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/reminder request is awaiting delivery to ogram/i),
    ).toBeInTheDocument();
  });

  it("respects a learner who declines the future reminder", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /open the shared practice/i }));
    placeExpectedPack();
    await shareCurrentRevision(1);
    await runWebMcpToolTurn();
    fireEvent.click(
      screen.getByRole("button", { name: /carry the habit forward/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /save practice and finish/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/you’re done for today/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/reminder request/i)).not.toBeInTheDocument();
  });

  it("reconstructs an accepted Codex note into the private draft after reload", async () => {
    const firstRender = render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /open the shared practice/i }),
    );
    placeExpectedPack();
    placeCard("Definition of done", "Leave");
    await shareCurrentRevision(1);
    await runWebMcpToolTurn();
    fireEvent.click(screen.getByRole("button", { name: /use this note/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /share as r2/i })).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        window.localStorage.getItem("ogram-learning-ledger:v4"),
      ).toContain("practice_review_resolved"),
    );

    firstRender.unmount();
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /open the shared practice/i }),
    );
    const restoredCard = screen
      .getByText("Definition of done")
      .closest<HTMLElement>("[data-card-id]");
    if (!restoredCard) throw new Error("The restored practice card is unavailable.");
    expect(
      within(restoredCard).getByRole("button", {
        name: /carry definition of done/i,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /share as r2/i })).toBeInTheDocument();
  });
});
