import { useId } from "react";
import type { SignalId } from "../domain/types";

interface FigureOption {
  id: string;
  situation: string;
  move: string;
}

const figureRecipes: Record<
  SignalId,
  { prompt: string; options: [FigureOption, FigureOption, FigureOption] }
> = {
  thread_hygiene: {
    prompt: "Change the situation and watch the right boundary move.",
    options: [
      { id: "near", situation: "Same goal", move: "Keep going" },
      { id: "middle", situation: "New deliverable", move: "Fork" },
      { id: "far", situation: "Unrelated goal", move: "Start fresh" },
    ],
  },
  workspace_hygiene: {
    prompt: "The clearer the boundary, the safer the work becomes.",
    options: [
      { id: "near", situation: "No folder", move: "Pause" },
      { id: "middle", situation: "Dedicated project", move: "Ready" },
      { id: "far", situation: "Broad folder", move: "Too open" },
    ],
  },
  effort_fit: {
    prompt: "Let the shape of the task choose the amount of reasoning.",
    options: [
      { id: "near", situation: "Narrow + easy to check", move: "Light" },
      { id: "middle", situation: "Some ambiguity", move: "Medium" },
      { id: "far", situation: "Connected + hard to verify", move: "Deep" },
    ],
  },
  task_shaping: {
    prompt: "A useful brief becomes clearer as its finish line takes shape.",
    options: [
      { id: "near", situation: "Vague adjective", move: "Unclear" },
      { id: "middle", situation: "Outcome + boundaries", move: "Shaped" },
      { id: "far", situation: "Every tiny step", move: "Over-specified" },
    ],
  },
};

export function ConceptFigure({ focus }: { focus: SignalId }) {
  const name = useId();
  const recipe = figureRecipes[focus];

  return (
    <figure className="concept-figure">
      <svg viewBox="0 0 600 520" role="img" aria-labelledby={`${name}-title`}>
        <title id={`${name}-title`}>A changing boundary for today’s lesson</title>
        <g className="orbit orbit-far">
          <ellipse cx="300" cy="260" rx="236" ry="188" />
        </g>
        <g className="orbit orbit-middle">
          <ellipse cx="300" cy="260" rx="164" ry="126" />
        </g>
        <g className="orbit orbit-near">
          <ellipse cx="300" cy="260" rx="86" ry="66" />
        </g>
        <path
          className="figure-thread"
          d="M76 286 C154 144 244 405 320 244 C380 118 458 175 524 91"
        />
        <circle className="figure-point" cx="320" cy="244" r="7" />
      </svg>

      <figcaption>
        <p>{recipe.prompt}</p>
        <fieldset className="figure-controls">
          <legend className="visually-hidden">Explore the decision rule</legend>
          {recipe.options.map((option, index) => (
            <label key={option.id}>
              <input
                type="radio"
                name={`figure-${name}`}
                value={option.id}
                defaultChecked={index === 1}
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
