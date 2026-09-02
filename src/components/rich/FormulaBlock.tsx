import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import type { FormulaBlock as FormulaBlockType } from "../../domain/agentCanvas";
import { LESSON_LIMITS } from "../../domain/lessonRegistry";

export default function FormulaBlock({
  block,
}: {
  block: FormulaBlockType;
}) {
  const rendered = useMemo(() => {
    if (new TextEncoder().encode(block.latex).byteLength > LESSON_LIMITS.formulaBytes) {
      return null;
    }
    try {
      return katex.renderToString(block.latex, {
        displayMode: block.display ?? true,
        output: "htmlAndMathml",
        trust: false,
        throwOnError: true,
        strict: "error",
        macros: {},
      });
    } catch {
      return null;
    }
  }, [block.display, block.latex]);

  if (!rendered) {
    return (
      <aside className="rich-fallback" role="note">
        <strong>Formula</strong>
        <p>{block.accessibleLabel}</p>
        <code>{block.latex}</code>
      </aside>
    );
  }

  return (
    <figure className="formula-block">
      <div
        className="formula-block__math"
        aria-label={block.accessibleLabel}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
      <figcaption>
        <strong>{block.accessibleLabel}</strong>
        {block.explanation ? <span>{block.explanation}</span> : null}
      </figcaption>
    </figure>
  );
}
