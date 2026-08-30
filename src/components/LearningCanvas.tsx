import {
  Component,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type {
  ChoiceNode,
  LearningExperienceDocument,
  LearningNode,
  LearningRuntimeState,
  PredictionNode,
} from "../domain/experience";
import { isPrimitiveId } from "../domain/primitiveRegistry";
import { runtimeProgress } from "../domain/runtime";

interface LearningCanvasProps {
  experience: LearningExperienceDocument;
  runtime: LearningRuntimeState;
  learnerFeedback: "too_easy" | "right_level" | "too_hard" | null;
  onRespond: (nodeId: string, value: unknown, confidence?: number) => void;
  onAdvance: () => void;
  onFeedback: (level: "too_easy" | "right_level" | "too_hard") => void;
}

interface PrimitiveProps {
  node: LearningNode;
  experience: LearningExperienceDocument;
  response: LearningRuntimeState["responses"][string] | undefined;
  onRespond: (value: unknown, confidence?: number) => void;
  onAdvance: () => void;
}

class PrimitiveErrorBoundary extends Component<
  { children: ReactNode; nodeId: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The runtime ledger can receive this through a production telemetry adapter.
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="primitive-error" role="alert">
          <p className="overline">Safe renderer fallback</p>
          <h2>This learning block could not be displayed.</h2>
          <p>
            Node <code>{this.props.nodeId}</code> was isolated; the rest of the
            canvas and journey remain intact.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ContinueButton({
  onAdvance,
  label = "Continue",
}: {
  onAdvance: () => void;
  label?: string;
}) {
  return (
    <button className="stage-action" type="button" onClick={onAdvance}>
      {label}
      <span aria-hidden="true">→</span>
    </button>
  );
}

function ChoicePrimitive({
  node,
  response,
  onRespond,
  onAdvance,
}: PrimitiveProps & { node: ChoiceNode | PredictionNode }) {
  const storedValue = typeof response?.value === "string" ? response.value : "";
  const [selected, setSelected] = useState(storedValue);
  const [confidence, setConfidence] = useState(
    Math.round((response?.confidence ?? 0.6) * 100),
  );
  const selectedOption = node.props.options.find(
    (option) => option.id === (storedValue || selected),
  );
  const askConfidence = Boolean(node.props.askConfidence);

  return (
    <div className="primitive-body choice-primitive">
      {node.props.context ? <p className="scenario-context">{node.props.context}</p> : null}
      <h2>{node.props.prompt}</h2>
      <div className="canvas-choices" role="group" aria-label="Response options">
        {node.props.options.map((option, index) => {
          const isSelected = (storedValue || selected) === option.id;
          return (
            <button
              type="button"
              className={`canvas-choice ${isSelected ? "is-selected" : ""}`}
              key={option.id}
              onClick={() => setSelected(option.id)}
              disabled={Boolean(response)}
              aria-pressed={isSelected}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              <i aria-hidden="true">{isSelected ? "●" : "○"}</i>
            </button>
          );
        })}
      </div>

      {askConfidence && !response ? (
        <label className="confidence-control">
          <span>
            Confidence <strong>{confidence}%</strong>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
          />
        </label>
      ) : null}

      {response && selectedOption ? (
        <div className={`inline-feedback ${response.correct ? "is-correct" : "is-rethink"}`} role="status">
          <p className="feedback-label">
            {response.correct ? "Your reasoning holds" : "A useful mismatch"}
          </p>
          <p>{selectedOption.feedback}</p>
        </div>
      ) : null}

      <div className="stage-action-row">
        {response ? (
          <ContinueButton onAdvance={onAdvance} label="Use this feedback" />
        ) : (
          <button
            className="stage-action"
            type="button"
            disabled={!selected}
            onClick={() => onRespond(selected, askConfidence ? confidence / 100 : undefined)}
          >
            Commit answer
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}

function SortPrimitive({
  node,
  response,
  onRespond,
  onAdvance,
}: PrimitiveProps & { node: Extract<LearningNode, { primitiveId: "practice.sort" }> }) {
  const stored =
    response?.value && typeof response.value === "object" && !Array.isArray(response.value)
      ? (response.value as Record<string, string>)
      : {};
  const [assignments, setAssignments] = useState<Record<string, string>>(stored);
  const ready = node.props.items.every((item) => Boolean(assignments[item.id]));

  return (
    <div className="primitive-body sort-primitive">
      <h2>{node.props.prompt}</h2>
      <div className="bucket-legend">
        {node.props.buckets.map((bucket) => (
          <div key={bucket.id}>
            <strong>{bucket.label}</strong>
            {bucket.description ? <span>{bucket.description}</span> : null}
          </div>
        ))}
      </div>
      <div className="sort-list">
        {node.props.items.map((item, index) => (
          <label key={item.id}>
            <span className="sort-index">{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.label}</strong>
            <select
              value={assignments[item.id] ?? ""}
              disabled={Boolean(response)}
              onChange={(event) =>
                setAssignments((current) => ({
                  ...current,
                  [item.id]: event.target.value,
                }))
              }
              aria-label={`Category for ${item.label}`}
            >
              <option value="">Choose…</option>
              {node.props.buckets.map((bucket) => (
                <option value={bucket.id} key={bucket.id}>
                  {bucket.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {response ? (
        <div className={`inline-feedback ${response.correct ? "is-correct" : "is-rethink"}`} role="status">
          <p className="feedback-label">{response.correct ? "Clean classification" : "Inspect the rule"}</p>
          <p>{node.props.feedback}</p>
        </div>
      ) : null}
      <div className="stage-action-row">
        {response ? (
          <ContinueButton onAdvance={onAdvance} />
        ) : (
          <button
            className="stage-action"
            type="button"
            disabled={!ready}
            onClick={() => onRespond(assignments)}
          >
            Check the map
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TextPrimitive({
  node,
  response,
  onRespond,
  onAdvance,
}: PrimitiveProps & {
  node: Extract<
    LearningNode,
    { primitiveId: "consolidate.reflection" | "transfer.commitment" }
  >;
}) {
  const storedValue = typeof response?.value === "string" ? response.value : "";
  const [value, setValue] = useState(storedValue);
  const minimum = node.props.minimumCharacters;
  const isTransfer = node.primitiveId === "transfer.commitment";

  return (
    <div className={`primitive-body text-primitive ${isTransfer ? "is-transfer" : ""}`}>
      <p className="text-primitive-mark" aria-hidden="true">
        {isTransfer ? "↗" : "“"}
      </p>
      <h2>{node.props.prompt}</h2>
      {isTransfer ? (
        <div className="transfer-contract">
          <div><span>When</span><p>{node.props.cue}</p></div>
          <div><span>Proof</span><p>{node.props.proof}</p></div>
        </div>
      ) : null}
      <label>
        <span>{isTransfer ? "Your real-work commitment" : "Explain it in your own words"}</span>
        <textarea
          value={value}
          disabled={Boolean(response)}
          placeholder={
            node.primitiveId === "consolidate.reflection"
              ? node.props.sentenceStarter
              : "In my next task, I will…"
          }
          onChange={(event) => setValue(event.target.value)}
          rows={5}
        />
        <small className={value.trim().length >= minimum ? "is-ready" : ""}>
          {value.trim().length}/{minimum} minimum characters
        </small>
      </label>
      {response && node.primitiveId === "consolidate.reflection" ? (
        <div className="inline-feedback is-correct" role="status">
          <p className="feedback-label">Your explanation is now evidence</p>
          <p>{node.props.feedback}</p>
        </div>
      ) : null}
      <div className="stage-action-row">
        {response ? (
          <ContinueButton
            onAdvance={onAdvance}
            label={isTransfer ? "Complete experience" : "Continue"}
          />
        ) : (
          <button
            className="stage-action"
            type="button"
            disabled={value.trim().length < minimum}
            onClick={() => onRespond(value.trim())}
          >
            {isTransfer ? "Set this cue" : "Save explanation"}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}

function PassivePrimitive({ node, experience, onAdvance }: PrimitiveProps) {
  if (node.primitiveId === "orient.objective") {
    return (
      <div className="primitive-body objective-primitive">
        <p className="objective-number">Objective {experience.objectives.findIndex((item) => item.id === node.objectiveIds[0]) + 1}</p>
        <h1>{node.props.heading}</h1>
        <p className="objective-body">{node.props.body}</p>
        <div className="criteria-list">
          <p>By the end, you can</p>
          {node.props.successCriteria.map((criterion, index) => (
            <div key={criterion}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{criterion}</p>
            </div>
          ))}
        </div>
        <p className="relevance-note"><span>Why now</span>{node.props.relevance}</p>
        <div className="stage-action-row"><ContinueButton onAdvance={onAdvance} label="Enter the experience" /></div>
      </div>
    );
  }

  if (node.primitiveId === "explain.concept") {
    return (
      <div className="primitive-body concept-primitive">
        <p className="chapter-mark">A principle, not a recipe</p>
        <h2>{node.props.title}</h2>
        <p className="concept-copy">{node.props.body}</p>
        <blockquote>{node.props.keyPoint}</blockquote>
        {node.props.sourceLabel ? <p className="source-label">{node.props.sourceLabel}</p> : null}
        <div className="stage-action-row"><ContinueButton onAdvance={onAdvance} label="Try the principle" /></div>
      </div>
    );
  }

  if (node.primitiveId === "model.worked_example") {
    return (
      <div className="primitive-body worked-primitive">
        <p className="chapter-mark">Worked example</p>
        <h2>{node.props.title}</h2>
        <p className="worked-scenario">{node.props.scenario}</p>
        <ol>
          {node.props.steps.map((step) => (
            <li key={`${step.label}-${step.detail}`}>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
        <p className="worked-takeaway"><span>Pattern</span>{node.props.takeaway}</p>
        <div className="stage-action-row"><ContinueButton onAdvance={onAdvance} label="Use this model" /></div>
      </div>
    );
  }

  if (node.primitiveId === "media.explainer") {
    const asset = experience.assets.find((candidate) => candidate.id === node.props.assetId);
    return (
      <div className="primitive-body media-primitive">
        <p className="chapter-mark">Governed media</p>
        <h2>{node.props.title}</h2>
        {node.props.body ? <p className="concept-copy">{node.props.body}</p> : null}
        {asset?.kind === "image" ? <img src={asset.uri} alt={asset.alt} /> : null}
        {asset?.kind === "audio" ? <audio src={asset.uri} controls aria-label={asset.alt} /> : null}
        {asset?.kind === "video" ? <video src={asset.uri} controls aria-label={asset.alt} /> : null}
        {asset ? <p className="media-caption">{asset.caption ?? asset.alt}</p> : <p role="alert">The governed asset is unavailable.</p>}
        <div className="stage-action-row"><ContinueButton onAdvance={onAdvance} /></div>
      </div>
    );
  }

  return null;
}

function PrimitiveRenderer(props: PrimitiveProps) {
  if (
    props.node.primitiveId === "diagnose.prediction" ||
    props.node.primitiveId === "practice.choice"
  ) {
    return <ChoicePrimitive {...props} node={props.node} />;
  }
  if (props.node.primitiveId === "practice.sort") {
    return <SortPrimitive {...props} node={props.node} />;
  }
  if (
    props.node.primitiveId === "consolidate.reflection" ||
    props.node.primitiveId === "transfer.commitment"
  ) {
    return <TextPrimitive {...props} node={props.node} />;
  }
  return <PassivePrimitive {...props} />;
}

function CompletionView({
  experience,
  learnerFeedback,
  onFeedback,
}: Pick<LearningCanvasProps, "experience" | "learnerFeedback" | "onFeedback">) {
  const transfer = experience.nodes.find(
    (node) => node.primitiveId === "transfer.commitment",
  );
  return (
    <article className="completion-stage" id="learning-stage">
      <div className="completion-orbit" aria-hidden="true"><span>✓</span></div>
      <p className="overline">Experience complete · evidence captured</p>
      <h1>You finished the run.<br />The learning is not finished.</h1>
      <p className="completion-copy">
        Ogram recorded completion, unassisted attempts, and your transfer cue as
        separate evidence. It has not claimed mastery; that needs later,
        unassisted performance in changed conditions.
      </p>
      {transfer?.primitiveId === "transfer.commitment" ? (
        <div className="next-work-cue">
          <span>Watch for</span>
          <p>{transfer.props.cue}</p>
          <span>Later proof</span>
          <p>{transfer.props.proof}</p>
        </div>
      ) : null}
      <section className="feedback-strip" aria-label="Experience difficulty">
        <p>How did this fit you?</p>
        <div>
          {([
            ["too_easy", "Too easy"],
            ["right_level", "Right level"],
            ["too_hard", "Too hard"],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={learnerFeedback === value ? "is-selected" : ""}
              onClick={() => onFeedback(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {learnerFeedback ? <small>Feedback is now available for a reviewed adaptation.</small> : null}
      </section>
    </article>
  );
}

export function LearningCanvas({
  experience,
  runtime,
  learnerFeedback,
  onRespond,
  onAdvance,
  onFeedback,
}: LearningCanvasProps) {
  const node = useMemo(
    () => experience.nodes.find((candidate) => candidate.id === runtime.currentNodeId),
    [experience.nodes, runtime.currentNodeId],
  );
  const progress = runtimeProgress(experience, runtime);

  if (runtime.status === "completed") {
    return (
      <CompletionView
        experience={experience}
        learnerFeedback={learnerFeedback}
        onFeedback={onFeedback}
      />
    );
  }

  if (!node) {
    return <div className="primitive-error" role="alert">The active learning node is missing.</div>;
  }

  return (
    <article
      className={`learning-stage theme-${experience.metadata.theme}`}
      id="learning-stage"
      aria-labelledby="experience-title"
    >
      <header className="stage-header">
        <div>
          <p className="overline">02 · Live generative canvas</p>
          <h2 id="experience-title">{experience.metadata.title}</h2>
        </div>
        <div className="stage-revision">
          <span>rev {experience.draftRevision}</span>
          <span>{experience.metadata.estimatedMinutes} min</span>
        </div>
      </header>
      <div className="progress-track" aria-label={`${progress.percent}% of authored nodes visited`}>
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="node-meta">
        <span>{node.learningRole}</span>
        <code>{node.primitiveId}</code>
        <span>{runtime.visitedNodeIds.length}/{experience.nodes.length}</span>
      </div>
      <PrimitiveErrorBoundary key={node.id} nodeId={node.id}>
        {isPrimitiveId(node.primitiveId) ? (
          <PrimitiveRenderer
            key={node.id}
            node={node}
            experience={experience}
            response={runtime.responses[node.id]}
            onRespond={(value, confidence) => onRespond(node.id, value, confidence)}
            onAdvance={onAdvance}
          />
        ) : (
          <div className="primitive-error" role="alert">
            <p className="overline">Saved journey preserved</p>
            <h2>This step belongs to the newer Codex experiment.</h2>
            <p>
              The restored canvas cannot render <code>{node.primitiveId}</code>,
              but your saved journey remains intact.
            </p>
          </div>
        )}
      </PrimitiveErrorBoundary>
      <footer className="stage-footer">
        <span>Authored by agent</span>
        <span>Rendered by Ogram</span>
        <span>Actions owned by learner</span>
      </footer>
    </article>
  );
}
