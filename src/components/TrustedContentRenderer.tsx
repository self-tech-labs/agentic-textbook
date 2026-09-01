import { useId, useMemo, useState, type ReactNode } from "react";
import { defineCatalog, type Spec } from "@json-render/core";
import {
  defineRegistry,
  JSONUIProvider,
  Renderer,
  schema,
} from "@json-render/react";
import { z } from "zod";
import type { RegionContent } from "../domain/agentCanvas";
import { SandboxedWidget } from "./SandboxedWidget";

const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  publisher: z.string(),
  publishedAt: z.string().optional(),
  claim: z.string(),
});

/**
 * The bounded vocabulary Codex is allowed to turn into visible lesson UI.
 * RegionContent remains the public WebMCP contract; this catalog is the
 * concrete json-render bridge that validates and renders that JSON.
 */
export const learningContentCatalog = defineCatalog(schema, {
  components: {
    ContentStack: {
      props: z.object({ mode: z.enum(["full", "preview"]) }),
      slots: ["default"],
      description: "A region-level stack of trusted learning components.",
    },
    Prose: {
      props: z.object({
        heading: z.string().optional(),
        text: z.string(),
        emphasis: z.string().optional(),
      }),
      description: "Editorial explanation with an optional heading and emphasis.",
    },
    KeyPoints: {
      props: z.object({ items: z.array(z.string()) }),
      description: "A concise grid of key points.",
    },
    TokenSequence: {
      props: z.object({
        tokens: z.array(z.string()),
        caption: z.string(),
        highlightedIndex: z.number().int().optional(),
      }),
      description: "An inspectable token sequence.",
    },
    AttentionMap: {
      props: z.object({
        tokens: z.array(z.string()),
        focusIndex: z.number().int(),
        weights: z.array(z.number()),
        explanation: z.string(),
      }),
      description: "An accessible attention-weight diagram.",
    },
    TransformerStack: {
      props: z.object({
        stages: z.array(z.object({ label: z.string(), detail: z.string() })),
        caption: z.string(),
      }),
      description: "An inspectable sequence of transformer-block stages.",
    },
    Comparison: {
      props: z.object({
        leftLabel: z.string(),
        rightLabel: z.string(),
        rows: z.array(
          z.object({
            label: z.string(),
            left: z.string(),
            right: z.string(),
          }),
        ),
      }),
      description: "A compact comparison table.",
    },
    SourceCards: {
      props: z.object({
        summary: z.string(),
        sources: z.array(sourceSchema),
      }),
      description: "A research synthesis with canonical sources.",
    },
    SandboxedWidget: {
      props: z.object({
        widgetId: z.string(),
        title: z.string(),
        html: z.string(),
        css: z.string(),
        javascript: z.string(),
        accessibleSummary: z.string(),
        height: z.number(),
      }),
      description: "A bounded no-origin, no-network interactive widget.",
    },
  },
  actions: {},
});

function TokenSequence({
  block,
}: {
  block: Extract<RegionContent, { type: "token_sequence" }>;
}) {
  const [activeIndex, setActiveIndex] = useState(block.highlightedIndex ?? 0);
  const activeToken = block.tokens[activeIndex] ?? block.tokens[0] ?? "token";
  return (
    <figure className="token-figure">
      <div className="token-row" aria-label={`Token sequence: ${block.tokens.join(", ")}`}>
        {block.tokens.map((token, index) => (
          <button
            type="button"
            key={`${token}-${index}`}
            className={activeIndex === index ? "is-highlighted" : ""}
            aria-pressed={activeIndex === index}
            aria-label={`Inspect token ${token} at position ${index + 1}`}
            onClick={() => setActiveIndex(index)}
          >
            <small>{String(index + 1).padStart(2, "0")}</small>
            {token}
          </button>
        ))}
      </div>
      <div className="diagram-inspector" aria-live="polite">
        <span>Selected token · position {activeIndex + 1}</span>
        <p>
          <strong>“{activeToken}”</strong> starts with a learned vector. Its position is added before
          attention makes that representation context-sensitive.
        </p>
      </div>
      <figcaption>{block.caption} Select any token to inspect it.</figcaption>
    </figure>
  );
}

function AttentionMap({
  block,
}: {
  block: Extract<RegionContent, { type: "attention_map" }>;
}) {
  const width = 720;
  const height = 250;
  const gap = width / (block.tokens.length + 1);
  const safeFocusIndex = Math.min(block.focusIndex, Math.max(0, block.tokens.length - 1));
  const targetX = gap * (safeFocusIndex + 1);
  const descriptionId = useId();
  const [activeSource, setActiveSource] = useState(safeFocusIndex);
  const focusToken = block.tokens[safeFocusIndex] ?? "token";
  const sourceToken = block.tokens[activeSource] ?? focusToken;
  const sourceWeight = block.weights[activeSource] ?? 0;
  return (
    <figure className="attention-figure">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={descriptionId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={descriptionId}>
          Attention into {focusToken}: {block.tokens.map((token, index) => `${token} ${Math.round((block.weights[index] ?? 0) * 100)} percent`).join(", ")}.
        </title>
        <text x="24" y="25" className="svg-kicker">KEYS + VALUES</text>
        {block.tokens.map((token, index) => {
          const x = gap * (index + 1);
          const weight = block.weights[index] ?? 0;
          return (
            <path
              key={`path-${token}-${index}`}
              d={`M ${x} 76 C ${x} 138, ${targetX} 128, ${targetX} 184`}
              className={activeSource === index ? "attention-path is-active" : "attention-path"}
              style={{ strokeWidth: 1.5 + weight * 14, opacity: 0.18 + weight * 0.82 }}
            />
          );
        })}
        {block.tokens.map((token, index) => {
          const x = gap * (index + 1);
          const weight = block.weights[index] ?? 0;
          return (
            <g
              key={`${token}-${index}`}
              className={activeSource === index ? "attention-source is-active" : "attention-source"}
              role="button"
              tabIndex={0}
              aria-pressed={activeSource === index}
              aria-label={`Inspect ${token}, ${Math.round(weight * 100)} percent attention contribution`}
              onClick={() => setActiveSource(index)}
              onFocus={() => setActiveSource(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveSource(index);
                }
              }}
            >
              <rect x={x - 46} y="46" width="92" height="42" rx="21" className="attention-token" />
              <text x={x} y="72" textAnchor="middle" className="attention-token-label">{token}</text>
              <text x={x} y="111" textAnchor="middle" className="attention-weight">{Math.round(weight * 100)}%</text>
            </g>
          );
        })}
        <rect x={targetX - 64} y="181" width="128" height="48" rx="4" className="attention-target" />
        <text x={targetX} y="211" textAnchor="middle" className="attention-target-label">
          query: {focusToken}
        </text>
      </svg>
      <div className="diagram-inspector" aria-live="polite">
        <span>Contribution into “{focusToken}”</span>
        <p>
          <strong>“{sourceToken}” contributes {Math.round(sourceWeight * 100)}%.</strong>{" "}
          Thicker paths mean more of that token’s value vector enters this illustrative attention head.
        </p>
      </div>
      <figcaption>{block.explanation} Select a source token to inspect its weight.</figcaption>
    </figure>
  );
}

function TransformerStack({
  block,
}: {
  block: Extract<RegionContent, { type: "transformer_stack" }>;
}) {
  const [activeStage, setActiveStage] = useState(0);
  const selected = block.stages[activeStage] ?? block.stages[0];
  return (
    <figure className="stack-figure">
      <ol>
        {block.stages.map((stage, index) => (
          <li key={`${stage.label}-${index}`} className={activeStage === index ? "is-active" : ""}>
            <button
              type="button"
              aria-pressed={activeStage === index}
              onClick={() => setActiveStage(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{stage.label}</strong><p>{stage.detail}</p></div>
            </button>
          </li>
        ))}
      </ol>
      {selected ? (
        <div className="stack-inspector" aria-live="polite">
          <span>Step {activeStage + 1} of {block.stages.length}</span>
          <p><strong>{selected.label}</strong> — {selected.detail}</p>
        </div>
      ) : null}
      <figcaption>{block.caption} Select a stage to follow the signal through the block.</figcaption>
    </figure>
  );
}

const { registry: learningContentRegistry } = defineRegistry(learningContentCatalog, {
  components: {
    ContentStack: ({ props, children }) => (
      <div
        className={`trusted-content trusted-content--${props.mode}`}
        data-json-render="ogram.learning.v1"
      >
        {children}
      </div>
    ),
    Prose: ({ props }) => (
      <div className="prose-block">
        {props.heading ? <h3>{props.heading}</h3> : null}
        <p>{props.text}</p>
        {props.emphasis ? <blockquote>{props.emphasis}</blockquote> : null}
      </div>
    ),
    KeyPoints: ({ props }) => (
      <ul className="key-points">{props.items.map((item) => <li key={item}>{item}</li>)}</ul>
    ),
    TokenSequence: ({ props }) => <TokenSequence block={{ type: "token_sequence", ...props }} />,
    AttentionMap: ({ props }) => <AttentionMap block={{ type: "attention_map", ...props }} />,
    TransformerStack: ({ props }) => <TransformerStack block={{ type: "transformer_stack", ...props }} />,
    Comparison: ({ props }) => (
      <div className="comparison-wrap">
        <table>
          <thead><tr><th>Signal</th><th>{props.leftLabel}</th><th>{props.rightLabel}</th></tr></thead>
          <tbody>{props.rows.map((row) => <tr key={row.label}><th>{row.label}</th><td data-label={props.leftLabel}>{row.left}</td><td data-label={props.rightLabel}>{row.right}</td></tr>)}</tbody>
        </table>
      </div>
    ),
    SourceCards: ({ props }) => (
      <aside className="research-block">
        <div className="research-block__heading"><span aria-hidden="true">↗</span><strong>Research for this section</strong></div>
        <p>{props.summary}</p>
        <ul>
          {props.sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              <span>{source.publisher}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span>
              <p>{source.claim}</p>
            </li>
          ))}
        </ul>
      </aside>
    ),
    SandboxedWidget: ({ props }) => (
      <SandboxedWidget widget={{ type: "sandbox_widget", ...props }} />
    ),
  },
});

const componentNameByType: Record<RegionContent["type"], string> = {
  prose: "Prose",
  key_points: "KeyPoints",
  token_sequence: "TokenSequence",
  attention_map: "AttentionMap",
  transformer_stack: "TransformerStack",
  comparison: "Comparison",
  source_cards: "SourceCards",
  sandbox_widget: "SandboxedWidget",
};

function contentSpec(blocks: RegionContent[], mode: "full" | "preview"): Spec {
  const visibleBlocks = mode === "preview" ? blocks.slice(0, 2) : blocks;
  const childKeys = visibleBlocks.map((_, index) => `block-${index}`);
  const elements: Spec["elements"] = {
    root: {
      type: "ContentStack",
      props: { mode },
      children: childKeys,
    },
  };

  visibleBlocks.forEach((block, index) => {
    const { type, ...props } = block;
    elements[childKeys[index]!] = {
      type: componentNameByType[type],
      props,
      children: [],
    };
  });

  const spec: Spec = { root: "root", elements };
  const validated = learningContentCatalog.validate(spec);
  if (!validated.success || !validated.data) {
    throw new Error("This lesson section could not be displayed.");
  }
  return validated.data as Spec;
}

export function TrustedContentProvider({ children }: { children: ReactNode }) {
  return (
    <JSONUIProvider registry={learningContentRegistry}>
      {children}
    </JSONUIProvider>
  );
}

export function TrustedContentRenderer({
  blocks,
  mode = "full",
}: {
  blocks: RegionContent[];
  mode?: "full" | "preview";
}) {
  const spec = useMemo(() => contentSpec(blocks, mode), [blocks, mode]);
  return <Renderer spec={spec} registry={learningContentRegistry} />;
}
