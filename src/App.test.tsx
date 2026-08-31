import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { compileExperience } from "./domain/compiler";
import {
  cloneExperienceFixture,
  experienceFixtures,
} from "./domain/fixtures";
import { createInitialCanvasState } from "./hooks/useLearningCanvas";

function createReviewState(status: "awaiting_review" | "approved") {
  const savedState = createInitialCanvasState();
  const fixture = experienceFixtures[1];
  if (!fixture) throw new Error("Expected the review fixture.");
  const draft = cloneExperienceFixture(
    fixture,
    savedState.activeExperience.draftRevision + 1,
    savedState.contextSnapshotId,
    savedState.learningBrief.id,
  );
  const approvedClaimIds = savedState.contextClaims
    .filter((claim) => claim.review === "accepted" || claim.review === "corrected")
    .map((claim) => claim.id);
  const validation = compileExperience(draft, approvedClaimIds);
  if (!validation.valid) throw new Error("Expected the review fixture to compile.");
  savedState.design = {
    status,
    draft,
    validation,
    approvedDraftRevision: status === "approved" ? draft.draftRevision : null,
    reviewRequestedAt: new Date().toISOString(),
  };
  return { savedState, draft };
}

describe("Ogram Learning Canvas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("runs an agent-authored experience through learner-owned evidence", async () => {
    render(<App />);
    expect(
      screen.getByRole("heading", {
        name: "Choose where your next piece of work should begin",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ogram compiler/i)).not.toBeVisible();
    expect(
      screen.queryByText(/Ogram sees the journey\. Codex makes it tangible/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: /fork the current task/i }));
    fireEvent.click(screen.getByRole("button", { name: /check my answer/i }));
    expect(screen.getByText(/fork keeps the approved strategy available/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    fireEvent.click(screen.getByRole("button", { name: /continue to practice/i }));
    fireEvent.click(screen.getByRole("button", { name: /fork from the exploration task/i }));
    fireEvent.click(screen.getByRole("button", { name: /check my answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    const reflection = screen.getByRole("textbox", {
      name: /your explanation/i,
    });
    fireEvent.change(reflection, {
      target: {
        value:
          "A fork keeps approved decisions for a related new deliverable while fresh starts an unrelated goal.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save my answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    const commitment = screen.getByRole("textbox", {
      name: /your plan/i,
    });
    fireEvent.change(commitment, {
      target: {
        value:
          "When my next deliverable changes, I will fork with a brief of approved decisions.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save my plan/i }));
    fireEvent.click(screen.getByRole("button", { name: /^finish/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /finished today’s session/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/judge whether it helped when you use it in real work/i)).toBeInTheDocument();
  });

  it("replays the real WebMCP design transaction and requires human publication", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /about this session/i }),
    );
    fireEvent.click(screen.getByText("Session options"));
    fireEvent.click(
      screen.getByRole("button", { name: /preview another session/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "What to include in a task handoff",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("heading", {
        name: "Choose where your next piece of work should begin",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/you approve this version of the session/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start this session/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Prepare a useful handoff for a related new task",
        }),
      ).toBeInTheDocument(),
    );
  });

  it("keeps secondary session information in an accessible in-frame drawer", async () => {
    render(<App />);
    const trigger = screen.getByRole("button", { name: /about this session/i });

    fireEvent.click(trigger);

    const drawer = screen.getByRole("dialog", { name: /about this session/i });
    expect(drawer).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /close session details/i }),
      ).toHaveFocus(),
    );

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByText("Session options").closest("summary")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: /close session details/i }),
    ).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(drawer).not.toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("preserves a saved journey from the newer Codex experiment without crashing", () => {
    const savedState = createInitialCanvasState();
    savedState.activeExperience.nodes[0] = {
      ...savedState.activeExperience.nodes[0],
      primitiveId: "practice.codex_task",
    } as unknown as (typeof savedState.activeExperience.nodes)[number];
    window.localStorage.setItem(
      "ogram-learning-canvas:v2",
      JSON.stringify(savedState),
    );

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /This step needs a newer version of Ogram/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/already completed is still here/i)).toBeInTheDocument();
  });

  it("refreshes legacy bundled copy without clearing saved progress", () => {
    const savedState = createInitialCanvasState();
    savedState.activeExperience.metadata.title = "The three doors";
    const objective = savedState.activeExperience.nodes.find(
      (node) => node.id === "door-objective",
    );
    if (!objective || objective.primitiveId !== "orient.objective") {
      throw new Error("Expected the bundled objective node.");
    }
    objective.props.heading = "Know when the work has changed rooms";
    savedState.runtime.visitedNodeIds = ["door-objective"];
    savedState.publishedRevisions[0] = structuredClone(
      savedState.activeExperience,
    );
    window.localStorage.setItem(
      "ogram-learning-canvas:v2",
      JSON.stringify(savedState),
    );

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Choose where your next piece of work should begin",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Know when the work has changed rooms",
      }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem("ogram-learning-canvas:v2") ?? "{}",
      ).runtime.visitedNodeIds,
    ).toEqual(["door-objective"]);
  });

  it("surfaces and focuses one context choice at a time before returning to the session", async () => {
    const savedState = createInitialCanvasState();
    const firstClaim = savedState.contextClaims[0];
    const secondClaim = savedState.contextClaims[1];
    if (!firstClaim || !secondClaim) throw new Error("Expected two fixture context claims.");
    savedState.contextClaims[0] = {
      ...firstClaim,
      review: "pending",
    };
    savedState.contextClaims[1] = {
      ...secondClaim,
      review: "pending",
    };
    window.localStorage.setItem(
      "ogram-learning-canvas:v2",
      JSON.stringify(savedState),
    );

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /can i use this/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Choose where your next piece of work should begin",
      }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(firstClaim.summary)).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: /use this/i }));

    await waitFor(() => expect(screen.getByText(secondClaim.summary)).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: /leave this out/i }));

    expect(
      screen.getByRole("heading", {
        name: "Choose where your next piece of work should begin",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("article", {
          name: "When to continue, fork, or start fresh",
        }),
      ).toHaveFocus(),
    );
  });

  it("keeps context review ahead of a ready session proposal", async () => {
    const { savedState } = createReviewState("awaiting_review");
    const firstClaim = savedState.contextClaims[0];
    if (!firstClaim) throw new Error("Expected the fixture context claim.");
    savedState.contextClaims[0] = { ...firstClaim, review: "pending" };
    window.localStorage.setItem(
      "ogram-learning-canvas:v2",
      JSON.stringify(savedState),
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: /can i use this/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start this session/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /use this/i }));

    expect(
      screen.getByRole("button", { name: /start this session/i }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.getElementById("draft-review")).toHaveFocus());
  });

  it("retries publication from an already approved proposal", async () => {
    const { savedState } = createReviewState("approved");
    window.localStorage.setItem(
      "ogram-learning-canvas:v2",
      JSON.stringify(savedState),
    );

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /try starting again/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Prepare a useful handoff for a related new task",
        }),
      ).toBeInTheDocument(),
    );
  });

  it("keeps an unfinished response mounted while a new proposal awaits review", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /start lesson/i }));
    fireEvent.click(screen.getByRole("button", { name: /fork the current task/i }));
    fireEvent.click(screen.getByRole("button", { name: /check my answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to practice/i }));
    fireEvent.click(screen.getByRole("button", { name: /fork from the exploration task/i }));
    fireEvent.click(screen.getByRole("button", { name: /check my answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    const reflection = screen.getByRole("textbox", {
      name: /your explanation/i,
    });
    const unfinished = "This unfinished explanation must survive the proposal gate.";
    fireEvent.change(reflection, { target: { value: unfinished } });

    await waitFor(() => expect(window.__OGRAM_WEBMCP_TOOLS__).toBeDefined());
    const fixture = experienceFixtures[1];
    if (!fixture) throw new Error("Expected the proposal fixture.");
    const draft = cloneExperienceFixture(fixture, 2);
    const create = window.__OGRAM_WEBMCP_TOOLS__?.ogram_create_experience_draft;
    const validate = window.__OGRAM_WEBMCP_TOOLS__?.ogram_validate_experience;
    const requestReview = window.__OGRAM_WEBMCP_TOOLS__?.ogram_request_learner_review;
    if (!create || !validate || !requestReview) {
      throw new Error("Expected the WebMCP design tools.");
    }

    await act(async () => {
      await create.execute({
        basePublishedRevision: 1,
        idempotencyKey: "mounted-draft-create",
        document: draft,
      });
      await validate.execute({
        draftRevision: 2,
        idempotencyKey: "mounted-draft-validate",
      });
      await requestReview.execute({
        draftRevision: 2,
        idempotencyKey: "mounted-draft-review",
      });
    });

    expect(screen.getByRole("button", { name: /start this session/i })).toBeInTheDocument();
    const hiddenReflection = document.querySelector("textarea");
    expect(hiddenReflection).toHaveValue(unfinished);
    expect(hiddenReflection?.closest("[hidden]")).not.toBeNull();
  });
});
