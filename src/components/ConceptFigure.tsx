import { useId, type ReactNode } from "react";
import type { SignalId } from "../domain/types";

type FigureOptionId = "near" | "middle" | "far";

interface FigureOption {
  id: FigureOptionId;
  situation: string;
  move: string;
}

interface FigureRecipe {
  instrument: string;
  title: string;
  description: string;
  prompt: string;
  options: [FigureOption, FigureOption, FigureOption];
  renderVisual: () => ReactNode;
}

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  vectorEffect: "non-scaling-stroke" as const,
};

const quietLine = {
  ...line,
  opacity: 0.24,
};

const label = {
  fill: "currentColor",
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
};

function ThreadBoundaryMap() {
  return (
    <g
      className="figure-visual figure-visual--thread-boundary"
      data-instrument="thread-boundary-map"
      aria-hidden="true"
    >
      <path
        className="figure-boundary"
        d="M300 72 V448"
        {...quietLine}
        strokeDasharray="3 8"
      />
      <text className="figure-axis-label" x="286" y="62" textAnchor="end" {...label}>
        ONE TASK
      </text>
      <text className="figure-axis-label" x="314" y="62" {...label}>
        NEXT MOVE
      </text>

      <path
        className="figure-thread figure-thread--incoming"
        d="M62 270 C126 210 186 324 248 264 C270 244 286 246 300 260"
      />
      <path
        className="figure-route figure-route--continue"
        d="M300 260 C348 238 385 158 486 130"
        {...line}
      />
      <path
        className="figure-route figure-route--fork"
        d="M300 260 C356 260 416 260 502 260"
        {...line}
      />
      <path
        className="figure-route figure-route--fresh"
        d="M300 260 C354 284 390 366 486 398"
        {...line}
      />

      <circle className="figure-point figure-point--decision" cx="300" cy="260" r="7" />
      <circle className="figure-origin" cx="62" cy="270" r="4" fill="currentColor" opacity="0.42" />

      <g className="figure-state figure-state--near orbit orbit-near" data-state="near">
        <ellipse cx="500" cy="126" rx="42" ry="31" />
        <text className="figure-state-label" x="500" y="130" textAnchor="middle" {...label}>
          CONTINUE
        </text>
      </g>
      <g
        className="figure-state figure-state--middle orbit orbit-middle"
        data-state="middle"
      >
        <ellipse cx="514" cy="260" rx="42" ry="31" />
        <text className="figure-state-label" x="514" y="264" textAnchor="middle" {...label}>
          FORK
        </text>
      </g>
      <g className="figure-state figure-state--far orbit orbit-far" data-state="far">
        <ellipse cx="500" cy="402" rx="42" ry="31" />
        <text className="figure-state-label" x="500" y="406" textAnchor="middle" {...label}>
          FRESH
        </text>
      </g>
    </g>
  );
}

function WorkspaceContainmentDiagram() {
  return (
    <g
      className="figure-visual figure-visual--workspace-containment"
      data-instrument="workspace-containment-diagram"
      aria-hidden="true"
    >
      <rect
        className="workspace-scope workspace-scope--broad"
        x="48"
        y="62"
        width="504"
        height="396"
        rx="4"
        {...quietLine}
        strokeDasharray="5 8"
      />
      <text className="figure-axis-label" x="62" y="86" {...label} opacity="0.52">
        BROAD WORKSPACE
      </text>

      <rect
        className="workspace-scope workspace-scope--project"
        x="176"
        y="112"
        width="314"
        height="300"
        rx="3"
        {...line}
      />
      <path
        className="workspace-tab"
        d="M176 145 H280 L298 124 H382"
        {...line}
      />
      <text className="figure-state-label" x="198" y="140" {...label}>
        PROJECT
      </text>

      <rect
        className="workspace-cell workspace-cell--source"
        x="206"
        y="182"
        width="114"
        height="82"
        {...quietLine}
      />
      <rect
        className="workspace-cell workspace-cell--work"
        x="344"
        y="182"
        width="114"
        height="82"
        {...quietLine}
      />
      <rect
        className="workspace-cell workspace-cell--output"
        x="206"
        y="294"
        width="252"
        height="82"
        {...quietLine}
      />
      <text className="workspace-cell-label" x="222" y="208" {...label} opacity="0.62">
        SOURCE
      </text>
      <text className="workspace-cell-label" x="360" y="208" {...label} opacity="0.62">
        WORK
      </text>
      <text className="workspace-cell-label" x="222" y="320" {...label} opacity="0.62">
        OUTPUT
      </text>
      <path
        className="workspace-cell-line"
        d="M222 232 H294 M360 232 H432 M222 344 H416"
        {...quietLine}
      />

      <g className="workspace-loose-files">
        <path d="M82 170 h46 v58 H82 z M112 170 v16 h16" {...quietLine} />
        <path d="M96 286 h46 v58 H96 z M126 286 v16 h16" {...quietLine} />
      </g>
      <path
        className="figure-thread figure-thread--intake"
        d="M116 256 C146 246 155 246 176 246"
      />
      <circle className="figure-point figure-point--project-entry" cx="176" cy="246" r="6" />

      <g className="figure-state figure-state--near orbit orbit-near" data-state="near">
        <ellipse cx="110" cy="256" rx="56" ry="118" />
      </g>
      <g
        className="figure-state figure-state--middle orbit orbit-middle"
        data-state="middle"
      >
        <ellipse cx="333" cy="262" rx="166" ry="158" />
      </g>
      <g className="figure-state figure-state--far orbit orbit-far" data-state="far">
        <ellipse cx="300" cy="260" rx="246" ry="198" />
      </g>
    </g>
  );
}

function ReasoningCostDial() {
  return (
    <g
      className="figure-visual figure-visual--reasoning-cost"
      data-instrument="reasoning-cost-dial"
      aria-hidden="true"
    >
      <path
        className="dial-arc dial-arc--outer"
        d="M88 370 A224 224 0 0 1 512 370"
        {...quietLine}
      />
      <path
        className="dial-arc dial-arc--inner"
        d="M126 370 A184 184 0 0 1 474 370"
        {...quietLine}
      />
      <path className="dial-baseline" d="M72 370 H528" {...line} />

      {[
        [112, 370, 112, 350],
        [160, 252, 176, 264],
        [300, 146, 300, 168],
        [440, 252, 424, 264],
        [488, 370, 488, 350],
      ].map(([x1, y1, x2, y2], index) => (
        <line
          className="dial-tick"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          key={index}
          {...line}
        />
      ))}

      <path
        className="dial-needle dial-needle--middle"
        d="M300 370 L300 172"
        {...line}
        strokeWidth="2"
      />
      <circle className="figure-point figure-point--dial-pivot" cx="300" cy="370" r="8" />
      <circle className="dial-pivot-ring" cx="300" cy="370" r="20" {...quietLine} />

      <text className="figure-axis-label" x="72" y="418" {...label} opacity="0.58">
        FAST TO VERIFY
      </text>
      <text
        className="figure-axis-label"
        x="528"
        y="418"
        textAnchor="end"
        {...label}
        opacity="0.58"
      >
        COSTLY TO VERIFY
      </text>
      <text className="dial-caption" x="300" y="462" textAnchor="middle" {...label}>
        REASONING SHOULD MATCH VERIFICATION RISK
      </text>

      <g className="figure-state figure-state--near orbit orbit-near" data-state="near">
        <ellipse cx="150" cy="316" rx="42" ry="31" />
        <text className="figure-state-label" x="150" y="320" textAnchor="middle" {...label}>
          LIGHT
        </text>
      </g>
      <g
        className="figure-state figure-state--middle orbit orbit-middle"
        data-state="middle"
      >
        <ellipse cx="300" cy="132" rx="48" ry="31" />
        <text className="figure-state-label" x="300" y="136" textAnchor="middle" {...label}>
          MEDIUM
        </text>
      </g>
      <g className="figure-state figure-state--far orbit orbit-far" data-state="far">
        <ellipse cx="450" cy="316" rx="42" ry="31" />
        <text className="figure-state-label" x="450" y="320" textAnchor="middle" {...label}>
          DEEP
        </text>
      </g>
    </g>
  );
}

function BriefCompletenessInstrument() {
  return (
    <g
      className="figure-visual figure-visual--brief-completeness"
      data-instrument="brief-completeness-instrument"
      aria-hidden="true"
    >
      <path className="brief-axis" d="M54 424 H546" {...quietLine} />
      <text className="figure-axis-label" x="54" y="454" {...label} opacity="0.56">
        TOO LITTLE
      </text>
      <text
        className="figure-axis-label"
        x="300"
        y="454"
        textAnchor="middle"
        {...label}
        opacity="0.56"
      >
        USEFUL SHAPE
      </text>
      <text
        className="figure-axis-label"
        x="546"
        y="454"
        textAnchor="end"
        {...label}
        opacity="0.56"
      >
        TOO MUCH
      </text>

      <g className="brief-card brief-card--vague">
        <rect x="46" y="116" width="138" height="260" rx="3" {...quietLine} />
        <path d="M68 154 H142 M68 184 H118" {...quietLine} />
        <text className="brief-card-label" x="68" y="338" {...label} opacity="0.62">
          “MAKE IT BETTER”
        </text>
      </g>

      <g className="brief-card brief-card--shaped">
        <rect x="216" y="76" width="168" height="340" rx="3" {...line} />
        <text className="brief-card-kicker" x="238" y="108" {...label}>
          BRIEF / 03
        </text>
        <path d="M238 130 H362" {...quietLine} />
        <text className="brief-field-label" x="238" y="164" {...label} opacity="0.58">
          OUTCOME
        </text>
        <path d="M238 182 H348 M238 198 H324" {...line} />
        <text className="brief-field-label" x="238" y="244" {...label} opacity="0.58">
          BOUNDARIES
        </text>
        <path d="M238 262 H354 M238 278 H336" {...line} />
        <text className="brief-field-label" x="238" y="324" {...label} opacity="0.58">
          DONE WHEN
        </text>
        <path d="M238 342 H350 M238 358 H314" {...line} />
        <circle className="figure-point figure-point--brief-ready" cx="362" cy="398" r="6" />
      </g>

      <g className="brief-card brief-card--overspecified">
        <rect x="416" y="116" width="138" height="260" rx="3" {...quietLine} />
        {Array.from({ length: 9 }, (_, index) => (
          <path
            className="brief-dense-line"
            d={`M438 ${148 + index * 22} H${index % 3 === 0 ? 510 : 532}`}
            key={index}
            {...quietLine}
          />
        ))}
      </g>

      <path
        className="figure-thread figure-thread--brief-signal"
        d="M74 400 C170 374 186 450 284 416 C370 386 438 428 526 396"
      />

      <g className="figure-state figure-state--near orbit orbit-near" data-state="near">
        <ellipse cx="115" cy="246" rx="76" ry="142" />
      </g>
      <g
        className="figure-state figure-state--middle orbit orbit-middle"
        data-state="middle"
      >
        <ellipse cx="300" cy="246" rx="94" ry="180" />
      </g>
      <g className="figure-state figure-state--far orbit orbit-far" data-state="far">
        <ellipse cx="485" cy="246" rx="76" ry="142" />
      </g>
    </g>
  );
}

const figureRecipes: Record<SignalId, FigureRecipe> = {
  thread_hygiene: {
    instrument: "thread-boundary-map",
    title: "A boundary map for deciding how work should continue",
    description:
      "One task reaches a decision boundary and branches toward continuing, forking with useful context, or starting fresh.",
    prompt: "Change the situation and watch the next route become clearer.",
    options: [
      { id: "near", situation: "Same goal", move: "Keep going" },
      { id: "middle", situation: "New deliverable", move: "Fork" },
      { id: "far", situation: "Unrelated goal", move: "Start fresh" },
    ],
    renderVisual: () => <ThreadBoundaryMap />,
  },
  workspace_hygiene: {
    instrument: "workspace-containment-diagram",
    title: "A containment diagram for a safe project workspace",
    description:
      "Loose files sit outside a broad workspace while a dedicated project contains source material, active work, and output.",
    prompt: "Change the boundary and inspect what the project safely contains.",
    options: [
      { id: "near", situation: "No folder", move: "Pause" },
      { id: "middle", situation: "Dedicated project", move: "Ready" },
      { id: "far", situation: "Broad folder", move: "Too open" },
    ],
    renderVisual: () => <WorkspaceContainmentDiagram />,
  },
  effort_fit: {
    instrument: "reasoning-cost-dial",
    title: "A dial matching reasoning effort to verification cost",
    description:
      "The dial moves from light to deep reasoning as ambiguity, connected decisions, and the cost of checking the result increase.",
    prompt: "Change the task shape and match reasoning to verification risk.",
    options: [
      { id: "near", situation: "Narrow + easy to check", move: "Light" },
      { id: "middle", situation: "Some ambiguity", move: "Medium" },
      { id: "far", situation: "Connected + hard to verify", move: "Deep" },
    ],
    renderVisual: () => <ReasoningCostDial />,
  },
  task_shaping: {
    instrument: "brief-completeness-instrument",
    title: "An instrument for finding the useful shape of a brief",
    description:
      "Three briefs move from a vague request through a useful outcome, boundaries, and definition of done to excessive prescription.",
    prompt: "Change the brief and find the point where direction becomes usable.",
    options: [
      { id: "near", situation: "Vague adjective", move: "Unclear" },
      { id: "middle", situation: "Outcome + boundaries", move: "Shaped" },
      { id: "far", situation: "Every tiny step", move: "Over-specified" },
    ],
    renderVisual: () => <BriefCompletenessInstrument />,
  },
};

export function ConceptFigure({ focus }: { focus: SignalId }) {
  const name = useId();
  const recipe = figureRecipes[focus];
  const visualId = `${name}-visual`;
  const promptId = `${name}-prompt`;

  return (
    <figure
      className={`concept-figure concept-figure--${focus}`}
      data-focus={focus}
      data-instrument={recipe.instrument}
    >
      <svg
        id={visualId}
        className="concept-instrument"
        viewBox="0 0 600 520"
        role="img"
        aria-labelledby={`${name}-title`}
        aria-describedby={`${name}-description`}
        focusable="false"
      >
        <title id={`${name}-title`}>{recipe.title}</title>
        <desc id={`${name}-description`}>{recipe.description}</desc>
        {recipe.renderVisual()}
      </svg>

      <figcaption>
        <p id={promptId}>{recipe.prompt}</p>
        <fieldset className="figure-controls" aria-describedby={promptId}>
          <legend className="visually-hidden">Explore the decision rule</legend>
          {recipe.options.map((option, index) => (
            <label key={option.id} data-state={option.id}>
              <input
                type="radio"
                name={`figure-${name}`}
                value={option.id}
                defaultChecked={index === 1}
                aria-controls={visualId}
              />
              <span>
                <small>{option.situation}</small>
                <strong>{option.move}</strong>
              </span>
            </label>
          ))}
        </fieldset>
      </figcaption>
    </figure>
  );
}
