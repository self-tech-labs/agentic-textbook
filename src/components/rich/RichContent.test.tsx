import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  contentRendererNameByType,
  TrustedContentProvider,
  TrustedContentRenderer,
} from "../TrustedContentRenderer";
import { CONTENT_REGISTRY } from "../../domain/lessonRegistry";
import FormulaBlock from "./FormulaBlock";
import GovernedMedia from "./GovernedMedia";
import MermaidDiagram from "./MermaidDiagram";

describe("V4 rich learning content", () => {
  it("derives renderer dispatch from the authoring registry", () => {
    expect(contentRendererNameByType).toEqual(
      Object.fromEntries(
        Object.entries(CONTENT_REGISTRY).map(([type, definition]) => [
          type,
          definition.renderer,
        ]),
      ),
    );
    expect(contentRendererNameByType).toEqual({
      prose: "Prose",
      key_points: "KeyPoints",
      token_sequence: "TokenSequence",
      attention_map: "AttentionMap",
      transformer_stack: "TransformerStack",
      comparison: "Comparison",
      source_cards: "SourceCards",
      sandbox_widget: "SandboxedWidget",
      formula: "Formula",
      diagram: "Diagram",
      code_example: "CodeExample",
      media: "Media",
    });
  });

  it("renders KaTeX with MathML and falls back textually for malformed input", () => {
    const { container, rerender } = render(
      <FormulaBlock
        block={{
          type: "formula",
          latex: "m=\\frac{y_2-y_1}{x_2-x_1}",
          accessibleLabel: "Slope equals change in y divided by change in x.",
          explanation: "Keep the point order consistent.",
        }}
      />,
    );
    expect(container.querySelector("math")).not.toBeNull();
    expect(screen.getByText(/keep the point order consistent/i)).toBeInTheDocument();

    rerender(
      <FormulaBlock
        block={{
          type: "formula",
          latex: "\\definitelyUnknownCommand{",
          accessibleLabel: "A malformed formula remains understandable.",
        }}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      /a malformed formula remains understandable/i,
    );
  });

  it("suppresses Mermaid links and exposes the authored long description", async () => {
    render(
      <MermaidDiagram
        block={{
          type: "diagram",
          syntax: "mermaid",
          source: "flowchart LR\n A[Start] --> B[Finish]\n click A https://example.com",
          title: "A blocked linked diagram",
          description: "Start points to finish; outbound links are not interactive.",
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("note")).toHaveTextContent(/start points to finish/i),
    );
    expect(document.querySelector("a")).toBeNull();
  });

  it("uses native media controls, metadata preload, captions, and transcripts", () => {
    const { container, rerender } = render(
      <GovernedMedia
        block={{
          type: "media",
          asset: {
            id: "audio-fixture",
            kind: "audio",
            status: "ready",
            url: "/media/audio-fixture",
            caption: "A narrated explanation",
            attribution: "Ogram fixture",
            transcript: "The narrated explanation in text.",
          },
        }}
      />,
    );
    const audio = container.querySelector("audio");
    expect(audio).toHaveAttribute("controls");
    expect(audio).toHaveAttribute("preload", "metadata");
    expect(audio).not.toHaveAttribute("autoplay");
    expect(screen.getByText(/narrated explanation in text/i)).toBeInTheDocument();

    rerender(
      <GovernedMedia
        block={{
          type: "media",
          asset: {
            id: "video-fixture",
            kind: "video",
            status: "ready",
            url: "/media/video-fixture",
            caption: "A captioned demonstration",
            attribution: "Ogram fixture",
            transcript: "The full demonstration transcript.",
            captionsVtt: "/media/video-fixture/captions",
          },
        }}
      />,
    );
    const video = container.querySelector("video");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).not.toHaveAttribute("autoplay");
    expect(container.querySelector('track[kind="captions"]')).toHaveAttribute(
      "src",
      "/media/video-fixture/captions",
    );
  });

  it("renders agent-authored code as escaped semantic text", () => {
    const source = '<script>window.compromised = true</script>\nconst safe = "text";';
    const { container } = render(
      <TrustedContentProvider>
        <TrustedContentRenderer
          blocks={[
            {
              type: "code_example",
              language: "javascript",
              code: source,
              caption: "Markup stays inert inside the code example.",
              highlightedLines: [1],
            },
          ]}
        />
      </TrustedContentProvider>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("pre code")).toHaveTextContent("<script>");
    expect(container.querySelector("pre code > .is-highlighted")).toBeInTheDocument();
  });
});
