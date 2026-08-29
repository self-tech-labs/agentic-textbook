import { useState } from "react";
import type {
  LearningModule,
  MiniGameLearningModule,
} from "../domain/types";

interface LearningModulesProps {
  modules: LearningModule[];
}

function VideoModule({ module }: { module: Extract<LearningModule, { kind: "video" }> }) {
  return (
    <article className="learning-module video-module">
      <div className="module-type">Watch · {module.provider}</div>
      <h3>{module.title}</h3>
      <p>{module.description}</p>
      <a href={module.url} target="_blank" rel="noopener noreferrer">
        <span className="play-mark" aria-hidden="true">▶</span>
        Open video in a new tab
      </a>
    </article>
  );
}

function WalkthroughModule({
  module,
}: {
  module: Extract<LearningModule, { kind: "walkthrough" }>;
}) {
  return (
    <article className="learning-module walkthrough-module">
      <div className="module-type">Quick walkthrough</div>
      <h3>{module.title}</h3>
      <p>{module.description}</p>
      <ol>
        {module.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </article>
  );
}

function MiniGame({ module }: { module: MiniGameLearningModule }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = module.options.find((option) => option.id === selectedId);

  return (
    <article className="learning-module mini-game-module">
      <div className="module-type">30-second practice</div>
      <h3>{module.title}</h3>
      <p>{module.description}</p>
      <fieldset>
        <legend>{module.prompt}</legend>
        <div className="mini-game-options">
          {module.options.map((option) => (
            <label
              className={`mini-game-option ${selectedId === option.id ? "is-selected" : ""}`}
              key={option.id}
            >
              <input
                type="radio"
                name={`mini-game-${module.id}`}
                value={option.id}
                checked={selectedId === option.id}
                onChange={() => setSelectedId(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {selected ? (
        <div className={`module-feedback ${selected.correct ? "is-correct" : "is-retry"}`} aria-live="polite">
          <strong>{selected.correct ? "That’s the useful set." : "Try a different set."}</strong>
          <p>{selected.feedback}</p>
        </div>
      ) : null}
    </article>
  );
}

export function LearningModules({ modules }: LearningModulesProps) {
  if (modules.length === 0) return null;

  return (
    <section className="learning-modules" id="learning-modules" aria-labelledby="learning-modules-title">
      <header>
        <p className="eyebrow">Optional</p>
        <h2 id="learning-modules-title">Another way to learn this</h2>
      </header>
      <div className="module-stack">
        {modules.map((module) => {
          if (module.kind === "video") {
            return <VideoModule module={module} key={module.id} />;
          }
          if (module.kind === "walkthrough") {
            return <WalkthroughModule module={module} key={module.id} />;
          }
          return <MiniGame module={module} key={module.id} />;
        })}
      </div>
    </section>
  );
}
