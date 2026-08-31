import {
  Component,
  useEffect,
  useMemo,
  useRef,
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
          <p className="eyebrow">Your progress is safe</p>
          <h2>Something interrupted this step.</h2>
          <p>
            Ask Codex to repair this session, then return here to continue.
          </p>
          <details>
            <summary>Technical detail</summary>
            <code>{this.props.nodeId}</code>
          </details>
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
  const feedbackRef = useRef<HTMLDivElement>(null);
  const selectedOption = node.props.options.find(
    (option) => option.id === (storedValue || selected),
  );
  const askConfidence = Boolean(node.props.askConfidence);

  useEffect(() => {
    if (!response) return;

    const keepFeedbackVisible = () => {
      const step = feedbackRef.current?.closest<HTMLElement>(".lesson-step");
      if (!step) return;
      if (typeof step.scrollTo === "function") {
        step.scrollTo({ top: step.scrollHeight, behavior: "auto" });
      } else {
        step.scrollTop = step.scrollHeight;
      }
    };
    const animationFrame = window.requestAnimationFrame(keepFeedbackVisible);
    const step = feedbackRef.current?.closest<HTMLElement>(".lesson-step");
    const resizeObserver =
      step && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(keepFeedbackVisible)
        : null;
    if (step && resizeObserver) resizeObserver.observe(step);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
    };
  }, [response]);

  return (
    <div
      className={`primitive-body choice-primitive ${response ? "has-response" : ""}`}
    >
      <p className="activity-label">
        {node.primitiveId === "diagnose.prediction" ? "Quick check" : "Practice"}
      </p>
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
        <div
          className={`inline-feedback ${response.correct ? "is-correct" : "is-rethink"}`}
          ref={feedbackRef}
          role="status"
        >
          <p className="feedback-label">
            {response.correct ? "That’s right" : "Take another look"}
          </p>
          <p>{selectedOption.feedback}</p>
        </div>
      ) : null}

      <div className="stage-action-row">
        {response ? (
          <ContinueButton onAdvance={onAdvance} />
        ) : (
          <button
            className="stage-action"
            type="button"
            disabled={!selected}
            onClick={() => onRespond(selected, askConfidence ? confidence / 100 : undefined)}
          >
            Check my answer
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
      <p className="activity-label">Practice</p>
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
          <p className="feedback-label">{response.correct ? "That’s right" : "Review the rule"}</p>
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
            Check my answer
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
  const currentLength = value.trim().length;
  const remaining = Math.max(0, minimum - currentLength);
  const guidanceId = `${node.id}-response-guidance`;
  const progressId = `${node.id}-response-progress`;

  return (
    <div className={`primitive-body text-primitive ${isTransfer ? "is-transfer" : ""}`}>
      <p className="activity-label">
        {isTransfer ? "Apply this to your work" : "Explain the idea"}
      </p>
      <h2>{node.props.prompt}</h2>
      {isTransfer ? (
        <div className="transfer-contract">
          <div><span>Use this when</span><p>{node.props.cue}</p></div>
          <div><span>You’ll know it worked when</span><p>{node.props.proof}</p></div>
        </div>
      ) : null}
      <label>
        <span>{isTransfer ? "Your plan" : "Your explanation"}</span>
        <small className="text-guidance" id={guidanceId}>
          {isTransfer
            ? "Describe a real situation and the action you will take."
            : "Use a complete sentence. A concrete example can help."}
        </small>
        <textarea
          value={value}
          disabled={Boolean(response)}
          aria-describedby={`${guidanceId} ${progressId}`}
          placeholder={
            node.primitiveId === "consolidate.reflection"
              ? node.props.sentenceStarter
              : "In my next task, I will…"
          }
          onChange={(event) => setValue(event.target.value)}
          rows={4}
        />
        <small
          className={`response-progress ${remaining === 0 ? "is-ready" : ""}`}
          id={progressId}
          aria-live="polite"
        >
          {currentLength === 0
            ? "A short answer is enough."
            : remaining > 0
              ? `Add ${remaining} more ${remaining === 1 ? "character" : "characters"} so your answer includes enough detail.`
              : "Ready to save."}
        </small>
      </label>
      {response && node.primitiveId === "consolidate.reflection" ? (
        <div className="inline-feedback is-correct" role="status">
          <p className="feedback-label">Answer saved</p>
          <p>{node.props.feedback}</p>
        </div>
      ) : null}
      <div className="stage-action-row">
        {response ? (
          <ContinueButton
            onAdvance={onAdvance}
            label={isTransfer ? "Finish" : "Continue"}
          />
        ) : (
          <button
            className="stage-action"
            type="button"
            disabled={value.trim().length < minimum}
            onClick={() => onRespond(value.trim())}
          >
            {isTransfer ? "Save my plan" : "Save my answer"}
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
        <p className="objective-number">Today&apos;s lesson</p>
        <h2>{node.props.heading}</h2>
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
        <div className="stage-action-row"><ContinueButton onAdvance={onAdvance} label="Start lesson" /></div>
      </div>
    );
  }

  if (node.primitiveId === "explain.concept") {
    return (
      <div className="primitive-body concept-primitive">
        <p className="chapter-mark">Explanation</p>
        <h2>{node.props.title}</h2>
        <p className="concept-copy">{node.props.body}</p>
        <blockquote>{node.props.keyPoint}</blockquote>
        {node.props.sourceLabel ? <p className="source-label">{node.props.sourceLabel}</p> : null}
        <div className="stage-action-row"><ContinueButton onAdvance={onAdvance} label="Continue to practice" /></div>
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
        <p className="worked-takeaway"><span>What this shows</span>{node.props.takeaway}</p>
        <div className="stage-action-row"><ContinueButton onAdvance={onAdvance} /></div>
      </div>
    );
  }

  if (node.primitiveId === "media.explainer") {
    const asset = experience.assets.find((candidate) => candidate.id === node.props.assetId);
    return (
      <div className="primitive-body media-primitive">
        <p className="chapter-mark">Supporting material</p>
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
    <article className="completion-stage" id="learning-stage" tabIndex={-1}>
      <div className="completion-orbit" aria-hidden="true"><span>✓</span></div>
      <p className="eyebrow">Session complete</p>
      <h1>You’ve finished today’s session.</h1>
      <p className="completion-copy">
        You now have a situation to look out for and a practical action to try.
        You will be able to judge whether it helped when you use it in real work.
      </p>
      {transfer?.primitiveId === "transfer.commitment" ? (
        <div className="next-work-cue">
          <span>Use this when</span>
          <p>{transfer.props.cue}</p>
          <span>You’ll know it worked when</span>
          <p>{transfer.props.proof}</p>
        </div>
      ) : null}
      <section className="feedback-strip" aria-label="Experience difficulty">
        <p>How well did this session fit your current level?</p>
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
              aria-pressed={learnerFeedback === value}
              onClick={() => onFeedback(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {learnerFeedback ? <small>Thank you. This will help tune the next session.</small> : null}
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
  const stepRef = useRef<HTMLDivElement>(null);
  const previousNodeId = useRef(runtime.currentNodeId);

  useEffect(() => {
    if (
      previousNodeId.current &&
      node?.id &&
      previousNodeId.current !== node.id
    ) {
      stepRef.current?.focus({ preventScroll: true });
    }
    previousNodeId.current = node?.id ?? null;
  }, [node?.id]);

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
      tabIndex={-1}
    >
      <header className="stage-header">
        <h1 id="experience-title">{experience.metadata.title}</h1>
        <p className="stage-position">
          <span>Step {runtime.visitedNodeIds.length}</span>
          <span>{experience.metadata.estimatedMinutes} min</span>
        </p>
      </header>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <span style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="lesson-step" ref={stepRef} tabIndex={-1}>
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
              <p className="eyebrow">Your progress is safe</p>
              <h2>This step needs a newer version of Ogram.</h2>
              <p>
                Ask Codex to update or repair the session. Everything you have
                already completed is still here.
              </p>
              <details>
                <summary>Technical detail</summary>
                <code>{node.primitiveId}</code>
              </details>
            </div>
          )}
        </PrimitiveErrorBoundary>
      </div>
    </article>
  );
}
