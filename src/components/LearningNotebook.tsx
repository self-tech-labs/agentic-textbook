import { useEffect, useId, useRef, useState } from "react";
import type {
  AgentLearningCanvasState,
  CanvasRegion,
  LearnerContextClaim,
  RegionContent,
} from "../domain/agentCanvas";
import type { CanvasActions } from "../hooks/useLearningCanvas";
import { SandboxedWidget } from "./SandboxedWidget";

export interface NotebookRegistration {
  supported: boolean;
  registering: boolean;
  toolCount: number;
  toolNames: string[];
}

interface LearningNotebookProps {
  state: AgentLearningCanvasState;
  actions: CanvasActions;
  registration: NotebookRegistration;
  registrationError: string | null;
}

function AgentBridge({
  registration,
  working,
}: {
  registration: NotebookRegistration;
  working: boolean;
}) {
  const status = registration.registering
    ? "Connecting"
    : registration.supported
      ? working
        ? "Codex is shaping the focused region"
        : `${registration.toolCount} site tool${registration.toolCount === 1 ? "" : "s"} available`
      : "Open in Codex Desktop";
  return (
    <div className={`agent-bridge ${working ? "agent-bridge--working" : ""}`} aria-label={status}>
      <span className="agent-bridge__signal" aria-hidden="true" />
      <span className="agent-bridge__label">{status}</span>
    </div>
  );
}

function AppHeader({
  state,
  registration,
  actions,
}: {
  state: AgentLearningCanvasState;
  registration: NotebookRegistration;
  actions: CanvasActions;
}) {
  const stageLabel =
    state.session.stage === "ready"
      ? "Agent-native learning canvas"
      : state.session.stage === "context_review"
        ? "Context handshake"
        : state.session.stage === "lesson_review"
          ? "Lesson review"
          : "Living notebook";
  return (
    <header className="app-header">
      <a className="wordmark" href="#main-canvas" aria-label="learn.ogram — skip to canvas">
        <span>ogram</span>
        <span className="wordmark__mode">learn</span>
      </a>
      <div className="app-header__stage">
        <span className="status-dot" aria-hidden="true" />
        {stageLabel}
      </div>
      <div className="app-header__right">
        <span className="app-header__meta">
          {registration.registering ? "Registering…" : `${registration.toolCount} tools · v3`}
        </span>
        {state.session.id ? (
          <details className="session-menu">
            <summary>Session</summary>
            <div>
              <strong>Start a different topic?</strong>
              <p>This clears the local v3 notebook, including its saved learner evidence.</p>
              <button type="button" className="secondary-button" onClick={actions.reset}>
                Start a new topic
              </button>
            </div>
          </details>
        ) : null}
      </div>
    </header>
  );
}

function ReadyCanvas({
  registration,
  registrationError,
}: {
  registration: NotebookRegistration;
  registrationError: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const starter =
    "Teach me how transformers work. Start by calling learn_begin_session on this page, relay its short guide, and ask before using any personal context.";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(starter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <main id="main-canvas" className="ready-canvas">
      <div className="ready-canvas__index" aria-hidden="true">
        <span>01</span>
        <span>topic</span>
        <span>02</span>
        <span>context</span>
        <span>03</span>
        <span>construct</span>
        <span>04</span>
        <span>learn + reshape</span>
      </div>
      <section className="ready-hero" aria-labelledby="ready-title">
        <p className="eyebrow">A shared surface for human + agent learning</p>
        <h1 id="ready-title">
          Learn a difficult idea.
          <br />
          <em>Shape it as you go.</em>
        </h1>
        <p className="ready-hero__lede">
          This page is not a course player. It is a semantic notebook that Codex can read,
          construct, and revise beside your conversation—without taking ownership of your work.
        </p>

        {!registration.registering && !registration.supported ? (
          <div className="browser-notice" role="status">
            <span className="browser-notice__mark" aria-hidden="true">↗</span>
            <div>
              <strong>Open this page in Codex Desktop’s built-in browser.</strong>
              <p>Site tools are not available in this browser. The notebook remains read-only here.</p>
            </div>
          </div>
        ) : null}

        <div className="starter-prompt" aria-label="Starter prompt for the adjacent Codex conversation">
          <div className="starter-prompt__topline">
            <span>Start in the conversation on the left</span>
            <button type="button" className="text-button" onClick={copy}>
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <p>{starter}</p>
        </div>

        {registrationError ? <p className="inline-error">{registrationError}</p> : null}
      </section>
      <aside className="ready-specimen" aria-label="How the shared learning loop works">
        <div className="specimen-orbit" aria-hidden="true">
          <span className="specimen-orbit__core">you</span>
          <span className="specimen-orbit__agent">C</span>
          <span className="specimen-orbit__path" />
        </div>
        <ol>
          <li><span>01</span> Name the concept and your reason.</li>
          <li><span>02</span> Approve only the context that helps.</li>
          <li><span>03</span> Let Codex construct the first notebook.</li>
          <li><span>04</span> Focus anything and ask naturally on the left.</li>
        </ol>
      </aside>
    </main>
  );
}

function ContextCard({
  claim,
  actions,
}: {
  claim: LearnerContextClaim;
  actions: CanvasActions;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState(claim.summary);
  const [error, setError] = useState<string | null>(null);

  const review = (decision: "accepted" | "corrected" | "rejected") => {
    try {
      setError(null);
      actions.reviewContextClaim({
        claimId: claim.id,
        decision,
        correctedSummary: decision === "corrected" ? correction : undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The claim could not be reviewed.");
    }
  };

  return (
    <article className={`context-card context-card--${claim.review}`}>
      <header>
        <span className="context-card__kind">{claim.kind.replaceAll("_", " ")}</span>
        <span className="context-card__source">from {claim.source.providerLabel}</span>
      </header>
      <p>{claim.correctedSummary ?? claim.summary}</p>
      <div className="context-card__provenance">
        <span>{claim.source.resourceType}</span>
        <span>{claim.sensitivity} sensitivity</span>
        <span>for {claim.allowedPurposes.join(", ")}</span>
      </div>
      {claim.review === "pending" ? (
        <>
          {correcting ? (
            <label className="correction-field">
              Your correction
              <textarea
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
                maxLength={240}
                rows={3}
              />
            </label>
          ) : null}
          <div className="context-card__actions">
            <button type="button" className="primary-button" onClick={() => review("accepted")}>
              Use this
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => (correcting ? review("corrected") : setCorrecting(true))}
            >
              {correcting ? "Save correction" : "Correct"}
            </button>
            <button type="button" className="text-button" onClick={() => review("rejected")}>
              Don’t use
            </button>
          </div>
        </>
      ) : (
        <span className="review-stamp">
          {claim.review === "accepted"
            ? "Approved by learner"
            : claim.review === "corrected"
              ? "Corrected + approved"
              : "Not used"}
        </span>
      )}
      {error ? <p className="inline-error">{error}</p> : null}
    </article>
  );
}

function NotebookSkeleton({ regions }: { regions: CanvasRegion[] }) {
  return (
    <div className="notebook-skeleton" aria-label="Lesson structure being prepared" aria-busy="true">
      {regions.map((region) => (
        <section key={region.id} className="skeleton-region">
          <span>{region.label}</span>
          <div>
            <h3>{region.title}</h3>
            <p>{region.objective}</p>
            <i />
            <i />
          </div>
        </section>
      ))}
    </div>
  );
}

function ContextReview({ state, actions }: { state: AgentLearningCanvasState; actions: CanvasActions }) {
  const [error, setError] = useState<string | null>(null);
  const pending = state.contextClaims.filter((claim) => claim.review === "pending");
  const reviewed = state.contextClaims.filter((claim) => claim.review !== "pending");
  const skip = () => {
    try {
      setError(null);
      actions.skipContext();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Context could not be skipped.");
    }
  };
  return (
    <main id="main-canvas" className="preparation-layout">
      <section className="context-review" aria-labelledby="context-title">
        <p className="eyebrow">First: decide what may shape this lesson</p>
        <h1 id="context-title">Context stays proposed until you say yes.</h1>
        <p className="context-review__lede">
          Codex may bring a small claim from your conversation or a connected source, but the
          canvas receives no raw mail, calendar data, or credentials. Review each claim here.
        </p>

        {state.contextClaims.length ? (
          <div className="context-list">
            {[...pending, ...reviewed].map((claim) => (
              <ContextCard key={claim.id} claim={claim} actions={actions} />
            ))}
          </div>
        ) : (
          <div className="consent-empty">
            <span className="consent-empty__glyph" aria-hidden="true">◎</span>
            <div>
              <strong>No learner context has entered the canvas.</strong>
              <p>
                Tell Codex in the conversation whether it may propose relevant context, or continue
                with the generic technical-beginner path.
              </p>
            </div>
          </div>
        )}

        {pending.length === 0 && state.session.personalization !== "undecided" ? (
          <div className="gate-ready" role="status">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>Context choice complete.</strong> Codex can now compile the notebook for your
              review.
            </p>
          </div>
        ) : null}

        {state.session.personalization === "undecided" || pending.length > 0 ? (
          <button type="button" className="text-link-button" onClick={skip}>
            Continue without personal context →
          </button>
        ) : null}
        {error ? <p className="inline-error">{error}</p> : null}
      </section>
      <aside className="preparation-preview">
        <div className="preview-heading">
          <span>Notebook preview</span>
          <span>{state.session.topic}</span>
        </div>
        <NotebookSkeleton regions={state.regions} />
      </aside>
    </main>
  );
}

function LessonReview({ state, actions }: { state: AgentLearningCanvasState; actions: CanvasActions }) {
  const draft = state.lesson.draft;
  const [error, setError] = useState<string | null>(null);
  if (!draft) return null;
  const approved = state.lesson.status === "approved";
  const approve = () => {
    try {
      setError(null);
      actions.approveLesson(draft.revision);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The lesson could not be approved.");
    }
  };
  return (
    <main id="main-canvas" className="lesson-review">
      <section className="lesson-review__intro">
        <p className="eyebrow">Compiled lesson · revision {draft.revision}</p>
        <h1>{draft.title}</h1>
        <p>{draft.subtitle}</p>
        <dl className="lesson-facts">
          <div><dt>Goal</dt><dd>{draft.objective}</dd></div>
          <div><dt>Baseline</dt><dd>{draft.audience}</dd></div>
          <div><dt>Working time</dt><dd>about {draft.estimatedMinutes} minutes</dd></div>
          <div>
            <dt>Personalization</dt>
            <dd>
              {draft.approvedClaimIds.length
                ? `${draft.approvedClaimIds.length} learner-approved context signal${draft.approvedClaimIds.length === 1 ? "" : "s"}`
                : "Generic path · no personal context"}
            </dd>
          </div>
        </dl>
        {approved ? (
          <div className="approval-complete" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Exact revision approved</strong>
              <p>Codex can now publish this compiled notebook. Later explanatory edits remain reversible.</p>
            </div>
          </div>
        ) : (
          <button type="button" className="primary-button primary-button--large" onClick={approve}>
            Approve this lesson
          </button>
        )}
        {error ? <p className="inline-error">{error}</p> : null}
      </section>
      <section className="lesson-review__map" aria-labelledby="outline-title">
        <div className="preview-heading">
          <span id="outline-title">Notebook structure</span>
          <span>{draft.regions.length} stable regions</span>
        </div>
        <ol>
          {draft.regions.map((region) => (
            <li key={region.id}>
              <span>{String(region.order).padStart(2, "0")}</span>
              <div>
                <strong>{region.title}</strong>
                <p>{region.objective}</p>
              </div>
              <small>{region.kind}</small>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function AttentionMap({ block }: { block: Extract<RegionContent, { type: "attention_map" }> }) {
  const width = 720;
  const height = 250;
  const gap = width / (block.tokens.length + 1);
  const targetX = gap * (block.focusIndex + 1);
  const descriptionId = useId();
  return (
    <figure className="attention-figure">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={descriptionId}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={descriptionId}>
          Attention into {block.tokens[block.focusIndex]}: {block.tokens.map((token, index) => `${token} ${Math.round(block.weights[index]! * 100)} percent`).join(", ")}.
        </title>
        <text x="24" y="25" className="svg-kicker">KEYS + VALUES</text>
        {block.tokens.map((token, index) => {
          const x = gap * (index + 1);
          const weight = block.weights[index]!;
          return (
            <g key={`${token}-${index}`}>
              <path
                d={`M ${x} 76 C ${x} 138, ${targetX} 128, ${targetX} 184`}
                className="attention-path"
                style={{ strokeWidth: 1.5 + weight * 14, opacity: 0.18 + weight * 0.82 }}
              />
              <rect x={x - 46} y="46" width="92" height="42" rx="21" className="attention-token" />
              <text x={x} y="72" textAnchor="middle" className="attention-token-label">{token}</text>
              <text x={x} y="111" textAnchor="middle" className="attention-weight">{Math.round(weight * 100)}%</text>
            </g>
          );
        })}
        <rect x={targetX - 64} y="181" width="128" height="48" rx="4" className="attention-target" />
        <text x={targetX} y="211" textAnchor="middle" className="attention-target-label">
          query: {block.tokens[block.focusIndex]}
        </text>
      </svg>
      <figcaption>{block.explanation}</figcaption>
    </figure>
  );
}

function ContentBlock({ block }: { block: RegionContent }) {
  if (block.type === "prose") {
    return (
      <div className="prose-block">
        {block.heading ? <h3>{block.heading}</h3> : null}
        <p>{block.text}</p>
        {block.emphasis ? <blockquote>{block.emphasis}</blockquote> : null}
      </div>
    );
  }
  if (block.type === "key_points") {
    return <ul className="key-points">{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
  }
  if (block.type === "token_sequence") {
    return (
      <figure className="token-figure">
        <div className="token-row" aria-label={`Token sequence: ${block.tokens.join(", ")}`}>
          {block.tokens.map((token, index) => (
            <span key={`${token}-${index}`} className={block.highlightedIndex === index ? "is-highlighted" : ""}>
              <small>{index + 1}</small>{token}
            </span>
          ))}
        </div>
        <figcaption>{block.caption}</figcaption>
      </figure>
    );
  }
  if (block.type === "attention_map") return <AttentionMap block={block} />;
  if (block.type === "transformer_stack") {
    return (
      <figure className="stack-figure">
        <ol>
          {block.stages.map((stage, index) => (
            <li key={`${stage.label}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{stage.label}</strong><p>{stage.detail}</p></div>
            </li>
          ))}
        </ol>
        <figcaption>{block.caption}</figcaption>
      </figure>
    );
  }
  if (block.type === "comparison") {
    return (
      <div className="comparison-wrap">
        <table>
          <thead><tr><th>Signal</th><th>{block.leftLabel}</th><th>{block.rightLabel}</th></tr></thead>
          <tbody>{block.rows.map((row) => <tr key={row.label}><th>{row.label}</th><td>{row.left}</td><td>{row.right}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (block.type === "source_cards") {
    return (
      <aside className="research-block">
        <div className="research-block__heading"><span aria-hidden="true">↗</span><strong>Research attached by Codex</strong></div>
        <p>{block.summary}</p>
        <ul>
          {block.sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              <span>{source.publisher}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</span>
              <p>{source.claim}</p>
            </li>
          ))}
        </ul>
      </aside>
    );
  }
  return <SandboxedWidget widget={block} />;
}

function LearnerInteraction({
  region,
  actions,
}: {
  region: CanvasRegion;
  actions: CanvasActions;
}) {
  const interaction = region.interaction;
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!interaction) return null;

  const submit = () => {
    try {
      setError(null);
      actions.submitLearnerResponse(region.id, value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your answer could not be saved.");
    }
  };

  if (region.response) {
    const selected =
      interaction.type === "choice"
        ? interaction.options.find((option) => option.id === region.response?.value)
        : null;
    return (
      <div className="saved-evidence">
        <span className="saved-evidence__label">Your evidence · saved</span>
        <p>{interaction.type === "choice" ? selected?.label : region.response.value}</p>
        <div className={region.response.correct === false ? "feedback feedback--retry" : "feedback"}>
          {interaction.type === "choice" ? selected?.feedback : interaction.feedback}
        </div>
      </div>
    );
  }

  return (
    <div className="learner-interaction">
      <span className="eyebrow">Your turn</span>
      <h3>{interaction.prompt}</h3>
      {interaction.type === "choice" ? (
        <div className="choice-list">
          {interaction.options.map((option) => (
            <label key={option.id} className={value === option.id ? "is-selected" : ""}>
              <input
                type="radio"
                name={`choice-${region.id}`}
                value={option.id}
                checked={value === option.id}
                onChange={() => setValue(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <label className="reflection-field">
          <span className="sr-only">Your explanation</span>
          <textarea
            rows={6}
            placeholder={interaction.placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <small>{value.length} / {interaction.minimumCharacters} minimum characters</small>
        </label>
      )}
      <button type="button" className="primary-button" onClick={submit} disabled={!value.trim()}>
        Save my answer
      </button>
      {error ? <p className="inline-error">{error}</p> : null}
    </div>
  );
}

function RegionSection({
  region,
  focused,
  actions,
}: {
  region: CanvasRegion;
  focused: boolean;
  actions: CanvasActions;
}) {
  const [error, setError] = useState<string | null>(null);
  const latestUndo = region.history.at(-1)?.undoToken;
  const captureSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || null;
    actions.focusRegion(region.id, text);
  };
  const undo = () => {
    if (!latestUndo) return;
    try {
      setError(null);
      actions.revertRegion({
        regionId: region.id,
        baseRegionRevision: region.revision,
        undoToken: latestUndo,
        idempotencyKey: `learner-undo-${latestUndo}`,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The region could not be restored.");
    }
  };
  return (
    <section
      id={`region-${region.id}`}
      className={`notebook-region ${focused ? "notebook-region--focused" : ""} notebook-region--${region.status}`}
      data-canvas-region={region.id}
      aria-labelledby={`${region.id}-title`}
      onPointerDown={() => actions.focusRegion(region.id)}
      onMouseUp={captureSelection}
      onKeyUp={captureSelection}
    >
      <header className="region-header">
        <div>
          <span className="region-index">{region.label}</span>
          <h2 id={`${region.id}-title`}>{region.title}</h2>
          <p>{region.objective}</p>
        </div>
        {focused ? <span className="focus-badge">In focus</span> : null}
      </header>

      {region.status === "agent_working" ? (
        <div className="agent-working" role="status">
          <span aria-hidden="true"><i /><i /><i /></span>
          <p><strong>Codex is working in this region.</strong> The rest of the notebook stays usable.</p>
        </div>
      ) : null}

      <div className="region-content">
        {region.content.map((block, index) => (
          <ContentBlock key={`${block.type}-${index}`} block={block} />
        ))}
      </div>

      <LearnerInteraction region={region} actions={actions} />

      {region.status === "updated" ? (
        <footer className="region-attribution">
          <span><i aria-hidden="true" /> Updated by Codex</span>
          {region.updateRationale ? <span>{region.updateRationale}</span> : null}
          {latestUndo ? <button type="button" className="text-button" onClick={undo}>Undo</button> : null}
        </footer>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}

function LivingNotebook({ state, actions }: { state: AgentLearningCanvasState; actions: CanvasActions }) {
  const notebookRef = useRef<HTMLDivElement>(null);
  const answered = state.regions.filter((region) => region.response).length;
  const progress = state.regions.length ? Math.round((answered / state.regions.length) * 100) : 0;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.canvasRegion;
          if (id) ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        const best = [...ratios.entries()].sort((left, right) => right[1] - left[1])[0];
        if (best && best[1] >= 0.28 && best[0] !== actions.getState().focus.regionId) {
          actions.focusRegion(best[0]);
        }
      },
      { rootMargin: "-18% 0px -48% 0px", threshold: [0.28, 0.5, 0.75] },
    );
    notebookRef.current
      ?.querySelectorAll<HTMLElement>("[data-canvas-region]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [actions, state.regions.length]);

  const navigate = (regionId: string) => {
    actions.focusRegion(regionId);
    document.getElementById(`region-${regionId}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <main id="main-canvas" className="learning-layout">
      <aside className="concept-map" aria-label="Notebook concept map">
        <div className="concept-map__topic">
          <span>Learning thread</span>
          <strong>{state.session.topic}</strong>
        </div>
        <nav>
          <ol>
            {state.regions.map((region) => (
              <li key={region.id} className={state.focus.regionId === region.id ? "is-active" : ""}>
                <button type="button" onClick={() => navigate(region.id)}>
                  <span>{String(region.order).padStart(2, "0")}</span>
                  <span>{region.title}</span>
                  {region.response ? <i aria-label="Completed">✓</i> : null}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="concept-map__progress">
          <div><span>Evidence saved</span><strong>{answered}/{state.regions.length}</strong></div>
          <progress value={progress} max="100">{progress}%</progress>
        </div>
      </aside>

      <div className="notebook" ref={notebookRef}>
        <header className="notebook-cover">
          <p className="eyebrow">Living notebook · {state.lesson.draft?.estimatedMinutes ?? 14} min path</p>
          <h1>{state.lesson.draft?.title ?? state.session.topic}</h1>
          <p>{state.lesson.draft?.subtitle}</p>
          <div className="notebook-cover__legend">
            <span><i className="legend-focus" /> Focus tells Codex where you are</span>
            <span><i className="legend-agent" /> Agent edits are scoped + undoable</span>
            <span><i className="legend-you" /> Your answers remain yours</span>
          </div>
        </header>
        {state.regions.map((region) => (
          <RegionSection
            key={region.id}
            region={region}
            focused={state.focus.regionId === region.id}
            actions={actions}
          />
        ))}
        <footer className="notebook-end">
          <span>End of notebook</span>
          <p>Keep the conversation open. A natural question can reshape any focused region without restarting your learning path.</p>
        </footer>
      </div>
    </main>
  );
}

export function LearningNotebook({
  state,
  actions,
  registration,
  registrationError,
}: LearningNotebookProps) {
  const working = state.regions.some((region) => region.status === "agent_working");
  return (
    <div className="app-shell">
      <AppHeader state={state} registration={registration} actions={actions} />
      <AgentBridge registration={registration} working={working} />
      {state.session.stage === "ready" ? (
        <ReadyCanvas registration={registration} registrationError={registrationError} />
      ) : state.session.stage === "context_review" ? (
        <ContextReview state={state} actions={actions} />
      ) : state.session.stage === "lesson_review" ? (
        <LessonReview state={state} actions={actions} />
      ) : (
        <LivingNotebook state={state} actions={actions} />
      )}
    </div>
  );
}
