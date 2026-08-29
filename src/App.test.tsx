import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("Practice Desk", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(document, "modelContext", {
      value: undefined,
      configurable: true,
    });
  });

  it("renders a complete mock daily learning canvas", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Know when the task has changed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ogram-injected-context")).toBeInTheDocument();
    expect(screen.getByText(/no task text stored/i)).toBeInTheDocument();
  });

  it("requires a learner choice, reveals feedback, and closes the desktop loop", async () => {
    render(<App />);
    const commit = screen.getByRole("button", { name: /commit this practice/i });
    expect(commit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /fork the task/i }));
    expect(screen.getByText("Good call.")).toBeInTheDocument();
    expect(commit).toBeEnabled();

    fireEvent.click(commit);
    await waitFor(() =>
      expect(screen.getByText("Practice captured")).toBeInTheDocument(),
    );
    expect(screen.getByText(/queued locally in prototype mode/i)).toBeInTheDocument();
  });
});
