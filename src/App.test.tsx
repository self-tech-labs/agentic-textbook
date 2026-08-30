import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { createInitialCanvasState } from "./hooks/useLearningCanvas";

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
      screen.getByRole("heading", { name: "Know when the work has changed rooms" }),
    ).toBeInTheDocument();
    expect(document.body).toHaveTextContent(
      /Codex authors a declarative learning application/i,
    );
    expect(
      screen.queryByText(/Ogram sees the journey\. Codex makes it tangible/i),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /enter the experience/i }));
    fireEvent.click(screen.getByRole("button", { name: /fork the task/i }));
    fireEvent.click(screen.getByRole("button", { name: /commit answer/i }));
    expect(screen.getByText(/fork preserves the approved decisions/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /use this feedback/i }));

    fireEvent.click(screen.getByRole("button", { name: /try the principle/i }));
    fireEvent.click(screen.getByRole("button", { name: /fork from the approved strategy/i }));
    fireEvent.click(screen.getByRole("button", { name: /commit answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /use this feedback/i }));

    const reflection = screen.getByRole("textbox", {
      name: /explain it in your own words/i,
    });
    fireEvent.change(reflection, {
      target: {
        value:
          "A fork keeps approved decisions for a related new deliverable while fresh starts an unrelated goal.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save explanation/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    const commitment = screen.getByRole("textbox", {
      name: /your real-work commitment/i,
    });
    fireEvent.change(commitment, {
      target: {
        value:
          "When my next deliverable changes, I will fork with a brief of approved decisions.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /set this cue/i }));
    fireEvent.click(screen.getByRole("button", { name: /complete experience/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /you finished the run/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/has not claimed mastery/i)).toBeInTheDocument();
  });

  it("replays the real WebMCP design transaction and requires human publication", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /compose another experience/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Signal, decision, debris" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/Codex cannot click this for you/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /approve & publish/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Build a portable context filter" }),
      ).toBeInTheDocument(),
    );
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
        name: /This step belongs to the newer Codex experiment/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/your saved journey remains intact/i)).toBeInTheDocument();
  });
});
