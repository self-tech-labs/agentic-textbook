import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

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
    expect(screen.getByRole("button", { name: /see today’s decision/i })).toBeEnabled();
  });

  it("guides the learner through notice, choose, apply, and completion", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /see today’s decision/i }));
    expect(
      screen.getByRole("heading", { name: /what would you do next/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /keep going here/i }));
    expect(screen.getByText("Try another answer.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /turn this into a reminder/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /fork the task/i }));
    expect(screen.getByText("That’s the best fit.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /turn this into a reminder/i }),
    );

    expect(
      screen.getByRole("heading", { name: /make the good choice easy/i }),
    ).toBeInTheDocument();
    const finish = screen.getByRole("button", {
      name: /save reminder and finish/i,
    });
    fireEvent.click(finish);

    await waitFor(() =>
      expect(screen.getByText(/you’re done for today/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/we’ll remind you in ogram/i)).toBeInTheDocument();
  });
});
