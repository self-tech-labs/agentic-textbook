import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";
import type { DiagramBlock } from "../../domain/agentCanvas";
import { LESSON_LIMITS } from "../../domain/lessonRegistry";

let initialized = false;

function initializeMermaid() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    maxTextSize: LESSON_LIMITS.diagramBytes,
    theme: "base",
    themeVariables: {
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      primaryColor: "#f3ede3",
      primaryTextColor: "#211f1b",
      primaryBorderColor: "#343129",
      lineColor: "#695f52",
      secondaryColor: "#d7e1d2",
      tertiaryColor: "#eef0e9",
    },
    flowchart: {
      htmlLabels: false,
      curve: "basis",
    },
  });
  initialized = true;
}

function isSafeSource(source: string) {
  return (
    new TextEncoder().encode(source).byteLength <= LESSON_LIMITS.diagramBytes &&
    !/(click\s|href\s*=|<a\b|javascript:)/i.test(source)
  );
}

export default function MermaidDiagram({
  block,
}: {
  block: DiagramBlock;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSvg(null);
    setFailed(false);
    if (!isSafeSource(block.source)) {
      setFailed(true);
      return () => {
        active = false;
      };
    }

    initializeMermaid();
    void mermaid
      .render("lesson-diagram-" + reactId, block.source)
      .then((result) => {
        if (!active) return;
        if (/<a\b|javascript:/i.test(result.svg)) {
          setFailed(true);
          return;
        }
        setSvg(result.svg);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [block.source, reactId]);

  if (failed) {
    return (
      <aside className="rich-fallback" role="note">
        <strong>{block.title}</strong>
        <p>{block.description}</p>
        <pre>{block.source}</pre>
      </aside>
    );
  }

  return (
    <figure className="mermaid-block" aria-label={block.title}>
      {svg ? (
        <div
          className="mermaid-block__canvas"
          role="img"
          aria-label={block.description}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="rich-placeholder" role="status">
          Drawing diagram…
        </div>
      )}
      <figcaption>
        <strong>{block.title}</strong>
        <span>{block.description}</span>
      </figcaption>
    </figure>
  );
}
