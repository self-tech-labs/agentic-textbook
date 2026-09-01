import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ThinkingOrb } from "thinking-orbs";
import type {
  AgentLearningCanvasState,
  CanvasRegion,
  LearnerContextClaim,
  LessonRegion,
  RegionContent,
} from "../domain/agentCanvas";
import type { CanvasActions } from "../hooks/useLearningCanvas";
import {
  TrustedContentProvider,
  TrustedContentRenderer,
} from "./TrustedContentRenderer";

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
  constructionProgress,
}: {
  registration: NotebookRegistration;
  working: boolean;
  constructionProgress: { shaped: number; total: number } | null;
}) {
  const status = registration.registering
    ? "Preparing your lesson space"
    : registration.supported
      ? constructionProgress
        ? constructionProgress.shaped === constructionProgress.total
          ? "Lesson ready to review"
          : `Preparing sections · ${constructionProgress.shaped}/${constructionProgress.total}`
        : working
          ? "Updating this section"
          : "Ready"
      : "Open the lesson workspace";
  return (
    <div className={`agent-bridge ${working ? "agent-bridge--working" : ""}`} aria-label={status}>
      <span className="agent-bridge__signal" aria-hidden="true">
        {working ? <ThinkingOrb state="shaping" size={20} theme="light" /> : <i />}
      </span>
      <span className="agent-bridge__label">{status}</span>
    </div>
  );
}

function SessionControls({ actions }: { actions: CanvasActions }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  return (
    <details className="session-menu" ref={detailsRef}>
      <summary>Session</summary>
      <div className="session-menu__popover" role="dialog" aria-label="Start a new topic">
        <span className="session-menu__eyebrow">Your lesson</span>
        <strong>Start a new topic?</strong>
        <p>This removes the current notebook and its saved answers from this browser.</p>
        <div className="session-menu__actions">
          <button
            type="button"
            className="text-button"
            onClick={() => detailsRef.current?.removeAttribute("open")}
          >
            Keep it
          </button>
          <button type="button" className="danger-button" onClick={actions.reset}>
            Clear notebook
          </button>
        </div>
      </div>
    </details>
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
      ? "Personal learning canvas"
      : state.session.stage === "context_review"
        ? "Choose what shapes the lesson"
        : state.session.stage === "lesson_review"
          ? "Review your lesson"
          : "Your lesson";
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
          {registration.registering
            ? "Preparing…"
            : registration.supported
              ? "Ready"
              : "Preview"}
        </span>
        {state.session.id ? <SessionControls actions={actions} /> : null}
      </div>
    </header>
  );
}

const readyLoopSteps = [
  {
    number: "01",
    label: "Name the goal",
    description: "Name the topic and the finish line in the conversation beside this page.",
    canvasLabel: "Goal captured",
  },
  {
    number: "02",
    label: "Choose context",
    description: "You can allow relevant context from this chat, past work, projects, or connected sources—then review every claim here.",
    canvasLabel: "Context reviewed",
  },
  {
    number: "03",
    label: "Watch it form",
    description: "Sections arrive one by one while the learning path takes shape.",
    canvasLabel: "3 of 6 sections",
  },
  {
    number: "04",
    label: "Focus + adjust",
    description: "Select a section, ask naturally, and only that part changes.",
    canvasLabel: "Section in focus",
  },
] as const;

function ReadyLoop() {
  const [activeStep, setActiveStep] = useState(2);
  const active = readyLoopSteps[activeStep]!;
  return (
    <aside className="ready-specimen" aria-labelledby="learning-loop-title">
      <div className="ready-specimen__heading">
        <span>Click through the loop</span>
        <strong id="learning-loop-title">One lesson, two roles</strong>
      </div>
      <div className={`loop-model loop-model--${activeStep + 1}`} aria-live="polite">
        <div className="loop-model__actors" aria-hidden="true">
          <span>You decide</span>
          <i>↔</i>
          <span>Lesson adapts</span>
        </div>
        <div className="loop-model__canvas">
          <header>
            <span>Learning canvas</span>
            <i>{active.number}</i>
          </header>
          <strong>{active.canvasLabel}</strong>
          <div className="loop-model__lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          {activeStep === 1 ? <span className="loop-model__approval">✓ learner approved</span> : null}
          {activeStep === 2 ? <span className="loop-model__building">taking shape</span> : null}
          {activeStep === 3 ? <span className="loop-model__focus">focused</span> : null}
        </div>
        <p>{active.description}</p>
      </div>
      <ol className="loop-steps">
        {readyLoopSteps.map((step, index) => (
          <li key={step.number} className={activeStep === index ? "is-active" : ""}>
            <button
              type="button"
              aria-current={activeStep === index ? "step" : undefined}
              onClick={() => setActiveStep(index)}
            >
              <span>{step.number}</span>
              <span>{step.label}</span>
              <i aria-hidden="true">{activeStep === index ? "—" : "+"}</i>
            </button>
          </li>
        ))}
      </ol>
    </aside>
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
    "Teach me how transformers work. Begin by calling learn_begin_session on this page, share its short guide, ask which current or past context you may inspect, then build the lesson here one section at a time. Keep every visual on the lesson canvas.";
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
        <span>build</span>
        <span>04</span>
        <span>learn + reshape</span>
      </div>
      <section className="ready-hero" aria-labelledby="ready-title">
        <p className="eyebrow">A lesson that takes shape around you</p>
        <h1 id="ready-title">
          Learn a difficult idea.
          <br />
          <em>Shape it as you go.</em>
        </h1>
        <p className="ready-hero__lede">
          This is not a fixed course. It becomes a focused lesson around what you want to
          understand, and you decide what may shape it.
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

        <div className="starter-prompt" aria-label="Starter prompt for the adjacent conversation">
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
      <ReadyLoop />
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
  const [error, setError] = useState<string | null>(null);

  const review = (decision: "accepted" | "rejected") => {
    try {
      setError(null);
      actions.reviewContextClaim({
        claimId: claim.id,
        decision,
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
        <div className="context-card__actions" aria-label="Choose whether this context may shape the lesson">
          <button type="button" className="primary-button" onClick={() => review("accepted")}>
            Use this
          </button>
          <button type="button" className="secondary-button" onClick={() => review("rejected")}>
            Don’t use
          </button>
        </div>
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

type OutlineRegion = CanvasRegion | LessonRegion;

function sectionLabel(region: OutlineRegion): string {
  const [, descriptor] = region.label.split(" · ", 2);
  return descriptor ?? region.kind;
}

function NotebookOutline({
  regions,
  mode,
  activelyShaping = false,
}: {
  regions: OutlineRegion[];
  mode: "shaping" | "review";
  activelyShaping?: boolean;
}) {
  const firstQueuedIndex = regions.findIndex(
    (region) => "status" in region && region.status === "skeleton",
  );
  const complete = mode === "review" || firstQueuedIndex === -1;
  return (
    <ol
      className={`notebook-outline notebook-outline--${mode}`}
      aria-label={mode === "shaping" ? "Lesson outline in progress" : "Lesson structure"}
      aria-busy={mode === "shaping" && activelyShaping && !complete}
    >
      {regions.map((region, index) => {
        const status = "status" in region ? region.status : "ready";
        const shaped = status !== "skeleton";
        const active = mode === "shaping" && activelyShaping && !shaped && index === firstQueuedIndex;
        return (
        <li
          key={region.id}
          id={`construction-region-${region.id}`}
          className={`notebook-outline__row notebook-outline__row--${shaped ? "ready" : active ? "active" : "queued"}`}
        >
          <span className="notebook-outline__index">
            {String(region.order).padStart(2, "0")}
          </span>
          <span className="notebook-outline__label">{sectionLabel(region)}</span>
          <span className="notebook-outline__mark">
            {shaped ? (
              <i aria-label="Ready">✓</i>
            ) : active ? (
              <ThinkingOrb
                state="shaping"
                size={20}
                theme="light"
                aria-label={`Preparing ${region.title}`}
              />
            ) : (
              <i className="is-queued" aria-label="Queued" />
            )}
          </span>
          <div className="notebook-outline__content">
            <h3>{region.title}</h3>
            {mode === "review" ? (
              <p className="notebook-outline__objective">{region.objective}</p>
            ) : shaped ? (
              <TrustedContentRenderer blocks={region.content} mode="preview" />
            ) : (
              <div className="skeleton-lines" aria-hidden="true"><i /><i /></div>
            )}
          </div>
          <small className="notebook-outline__meta">
            {mode === "review"
              ? region.kind
              : shaped
                ? "Ready"
                : active
                  ? "Next"
                  : "Waiting"}
          </small>
        </li>
        );
      })}
    </ol>
  );
}

function ConstructionActivity({
  regions,
  constructionStarted,
  contextReady,
}: {
  regions: CanvasRegion[];
  constructionStarted: boolean;
  contextReady: boolean;
}) {
  const shaped = regions.filter((region) => region.status !== "skeleton").length;
  const complete = shaped === regions.length && regions.length > 0;
  const activeRegion = regions.find((region) => region.status === "skeleton");
  const status = complete
    ? "Your lesson is ready"
    : constructionStarted
      ? `Preparing ${activeRegion?.title ?? "the next section"}`
      : contextReady
        ? "Ready to build your lesson"
        : "Your lesson outline is ready";
  const description = complete
    ? "Review the sections, then approve the lesson when the path feels right."
    : constructionStarted
      ? "New sections will appear here one by one."
      : contextReady
        ? "Keep this page open while your lesson takes shape."
        : "Choose what context may shape your lesson.";
  return (
    <div className={`construction-activity ${constructionStarted ? "is-active" : ""}`} role="status" aria-live="polite">
      <ThinkingOrb
        state={complete ? "solving" : constructionStarted ? "shaping" : contextReady ? "connecting" : "breathing"}
        size={64}
        theme="light"
        aria-label={status}
      />
      <div className="construction-activity__copy">
        <span>Lesson progress</span>
        <strong>{status}</strong>
        <p>{description}</p>
        <div className="construction-activity__meta">
          <span>{shaped} of {regions.length} sections ready</span>
        </div>
      </div>
      <div className="construction-activity__meter" aria-hidden="true">
        <i style={{ width: `${regions.length ? (shaped / regions.length) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function ContextReview({ state, actions }: { state: AgentLearningCanvasState; actions: CanvasActions }) {
  const [error, setError] = useState<string | null>(null);
  const pending = state.contextClaims.filter((claim) => claim.review === "pending");
  const reviewed = state.contextClaims.filter((claim) => claim.review !== "pending");
  const construction = state.lesson.construction;
  const previewRegions = construction?.regions ?? state.regions;
  const shapedRegions = previewRegions.filter((region) => region.status !== "skeleton").length;
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
          With your permission, this lesson may draw on this chat, relevant past tasks and project
          conversations, Ogram, or a connected source. Only brief summaries are used—never
          raw messages, files, calendar data, or credentials. Use it or leave it out.
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
              <strong>No personal context is being used.</strong>
              <p>
                Choose whether relevant current or past work may shape this lesson, or continue
                with the generic technical-beginner path.
              </p>
            </div>
          </div>
        )}

        {pending.length === 0 && state.session.personalization !== "undecided" ? (
          <div className="gate-ready" role="status">
            <span aria-hidden="true">✓</span>
            <p>
              <strong>Context choice complete.</strong>{" "}
              {construction
                ? "Keep this canvas open—the lesson is taking shape section by section."
                : "Your lesson can now take shape section by section."}
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
          <span>{construction?.document.title ?? "Notebook preview"}</span>
          <span>
            {construction
              ? `${shapedRegions}/${previewRegions.length} sections ready`
              : state.session.topic}
          </span>
        </div>
        <ConstructionActivity
          regions={previewRegions}
          constructionStarted={Boolean(construction)}
          contextReady={pending.length === 0 && state.session.personalization !== "undecided"}
        />
        <NotebookOutline
          regions={previewRegions}
          mode="shaping"
          activelyShaping={Boolean(construction)}
        />
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
        <p className="eyebrow">Lesson ready for review</p>
        <h1>{draft.title}</h1>
        <p>{draft.subtitle}</p>
        <dl className="lesson-facts">
          <div><dt>Goal</dt><dd>{draft.objective}</dd></div>
          <div><dt>Designed for</dt><dd>{draft.audience}</dd></div>
          <div><dt>Working time</dt><dd>about {draft.estimatedMinutes} minutes</dd></div>
          <div>
            <dt>Shaped with</dt>
            <dd>
              {draft.approvedClaimIds.length
                ? `${draft.approvedClaimIds.length} context choice${draft.approvedClaimIds.length === 1 ? "" : "s"} you approved`
                : "No personal context"}
            </dd>
          </div>
        </dl>
        {approved ? (
          <div className="approval-complete" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Lesson approved</strong>
              <p>Your lesson is approved and ready to begin. Explanations can still be changed later.</p>
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
          <span id="outline-title">Lesson structure</span>
          <span>{draft.regions.length} sections</span>
        </div>
        <NotebookOutline regions={draft.regions} mode="review" />
      </section>
    </main>
  );
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

type LessonSceneType = RegionContent["type"] | "interaction";

interface LessonScene {
  id: string;
  label: string;
  type: LessonSceneType;
  blocks: RegionContent[];
  interaction: boolean;
}

const lessonSceneLabels: Record<LessonSceneType, string> = {
  prose: "Concept",
  key_points: "Essentials",
  token_sequence: "Tokens",
  attention_map: "Model",
  transformer_stack: "Block",
  comparison: "Compare",
  source_cards: "Sources",
  sandbox_widget: "Lab",
  interaction: "Practice",
};

function buildLessonScenes(region: CanvasRegion): LessonScene[] {
  const labelTotals = region.content.reduce<Record<string, number>>((totals, block) => {
    const label = lessonSceneLabels[block.type];
    totals[label] = (totals[label] ?? 0) + 1;
    return totals;
  }, {});
  const labelOccurrences: Record<string, number> = {};
  const contentScenes = region.content.map((block, index) => {
    const baseLabel = lessonSceneLabels[block.type];
    labelOccurrences[baseLabel] = (labelOccurrences[baseLabel] ?? 0) + 1;
    const label =
      labelTotals[baseLabel]! > 1
        ? `${baseLabel} ${labelOccurrences[baseLabel]}`
        : baseLabel;
    return {
      id: `${region.id}-${block.type}-${index}`,
      label,
      type: block.type,
      blocks: [block],
      interaction: false,
    };
  });
  const interactionScene: LessonScene[] = region.interaction
    ? [
        {
          id: `${region.id}-interaction`,
          label: region.interaction.type === "reflection" ? "Reflect" : "Practice",
          type: "interaction",
          blocks: [],
          interaction: true,
        },
      ]
    : [];

  return [...contentScenes, ...interactionScene];
}

function RegionSection({
  region,
  focused,
  actions,
  scenes,
  activeScene,
  onSceneSelect,
}: {
  region: CanvasRegion;
  focused: boolean;
  actions: CanvasActions;
  scenes: LessonScene[];
  activeScene: number;
  onSceneSelect: (index: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const latestUndo = region.history.at(-1)?.undoToken;
  const scene = scenes[activeScene] ?? scenes[0];
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
      className={`notebook-region ${focused ? "notebook-region--focused" : ""} notebook-region--${region.status}`}
      aria-labelledby={`${region.id}-title`}
      aria-describedby={`${region.id}-objective`}
      onPointerDown={() => actions.focusRegion(region.id)}
      onMouseUp={captureSelection}
      onKeyUp={captureSelection}
    >
      <div className="region-stage-header">
        <header className="region-header">
          <div>
            <span className="region-index">{region.label}</span>
            <h2 id={`${region.id}-title`}>{region.title}</h2>
            <p id={`${region.id}-objective`} className="sr-only">{region.objective}</p>
          </div>
          {focused ? <span className="focus-badge">In focus</span> : null}
        </header>

        {region.status === "agent_working" ? (
          <div className="agent-working" role="status">
            <ThinkingOrb
              state="working"
              size={20}
              theme="light"
              aria-label={`Updating ${region.title}`}
            />
            <p><strong>This section is being updated.</strong> The rest of the lesson stays usable.</p>
          </div>
        ) : null}

        <nav className="lesson-scene-nav" aria-label={`${region.title} section scenes`}>
          <span className="lesson-scene-nav__status" aria-live="polite">
            <strong>{String(activeScene + 1).padStart(2, "0")}</strong>
            <span>{scene?.label ?? "Section"}</span>
            <span>of {String(scenes.length).padStart(2, "0")}</span>
          </span>
          <div className="lesson-scene-nav__steps">
            {scenes.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === activeScene ? "is-active" : ""}
                aria-current={index === activeScene ? "step" : undefined}
                aria-label={`Show ${item.label} scene ${index + 1} of ${scenes.length}`}
                onClick={() => onSceneSelect(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {scene ? (
        <div
          key={scene.id}
          className={`region-scene region-scene--${scene.type}`}
          data-lesson-scene={scene.type}
        >
          {scene.blocks.length ? (
            <div className="region-content">
              <TrustedContentRenderer blocks={scene.blocks} />
            </div>
          ) : null}
          {scene.interaction ? <LearnerInteraction region={region} actions={actions} /> : null}
        </div>
      ) : null}

      {region.status === "updated" ? (
        <footer className="region-attribution">
          <span><i aria-hidden="true" /> Updated</span>
          {region.updateRationale ? (
            <details>
              <summary>Why this changed</summary>
              <span>{region.updateRationale}</span>
            </details>
          ) : null}
          {latestUndo ? <button type="button" className="text-button" onClick={undo}>Undo</button> : null}
        </footer>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}

const PANEL_TOP_GAP = 12;
const PANEL_BOTTOM_GAP = 14;

function LessonSlot({
  region,
  focused,
  actions,
  chromeCollapsed,
}: {
  region: CanvasRegion;
  focused: boolean;
  actions: CanvasActions;
  chromeCollapsed: boolean;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const scenes = useMemo(() => buildLessonScenes(region), [region]);
  const [activeScene, setActiveScene] = useState(0);
  const previousSceneCountRef = useRef(scenes.length);

  useEffect(() => {
    setActiveScene((current) => Math.min(current, Math.max(0, scenes.length - 1)));
  }, [region.id, scenes.length]);

  useEffect(() => {
    const previousSceneCount = previousSceneCountRef.current;
    previousSceneCountRef.current = scenes.length;
    if (
      scenes.length <= previousSceneCount ||
      scenes.at(-1)?.type !== "sandbox_widget"
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => selectScene(scenes.length - 1));
    return () => window.cancelAnimationFrame(frame);
  }, [scenes.length]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    let frame = 0;
    let mounted = true;
    const measure = () => {
      frame = 0;
      if (!mounted) return;
      const headerBottom = Math.max(
        0,
        document.querySelector<HTMLElement>(".app-header")?.getBoundingClientRect()
          .bottom ?? 0,
      );
      const mapRect = document
        .querySelector<HTMLElement>(".concept-map")
        ?.getBoundingClientRect();
      const chromeBottom =
        mapRect && mapRect.height <= 120 ? mapRect.bottom : headerBottom;
      const stickyTop = Math.max(0, Math.round(chromeBottom + PANEL_TOP_GAP));
      const availableHeight = Math.max(
        240,
        Math.floor(window.innerHeight - stickyTop - PANEL_BOTTOM_GAP),
      );
      const sceneStep = availableHeight;

      slot.style.setProperty("--lesson-sticky-top", `${stickyTop}px`);
      slot.style.setProperty("--lesson-available-height", `${availableHeight}px`);
      slot.style.setProperty("--lesson-scene-step", `${sceneStep}px`);
      slot.style.setProperty("--lesson-scene-count", String(Math.max(1, scenes.length)));
      slot.dataset.panelAvailableHeight = String(availableHeight);
    };
    const scheduleMeasure = () => {
      if (!mounted) return;
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    let resizeTimer = 0;
    const scheduleResizeMeasure = () => {
      scheduleMeasure();
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(scheduleMeasure, 320);
    };
    window.addEventListener("resize", scheduleResizeMeasure, { passive: true });
    scheduleMeasure();
    const transitionTimer = window.setTimeout(scheduleMeasure, 320);
    void document.fonts?.ready.then(scheduleMeasure);

    return () => {
      mounted = false;
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(transitionTimer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", scheduleResizeMeasure);
    };
  }, [chromeCollapsed, scenes.length]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !scenes.length) return;
    let frame = 0;
    const updateSceneFromScroll = () => {
      frame = 0;
      const markers = Array.from(
        slot.querySelectorAll<HTMLElement>(".lesson-scene-marker"),
      );
      const computedStep =
        markers.length > 1
          ? markers[1]!.offsetTop - markers[0]!.offsetTop
          : Number.parseFloat(getComputedStyle(slot).getPropertyValue("--lesson-scene-step"));
      if (!Number.isFinite(computedStep) || computedStep <= 0) return;
      const stickyTop = Number.parseFloat(
        getComputedStyle(slot).getPropertyValue("--lesson-sticky-top"),
      );
      const travelled = Math.max(0, stickyTop - slot.getBoundingClientRect().top);
      const nextScene = Math.min(
        scenes.length - 1,
        Math.max(0, Math.floor((travelled + computedStep * 0.3) / computedStep)),
      );
      setActiveScene((current) => (current === nextScene ? current : nextScene));
    };
    const scheduleSceneUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateSceneFromScroll);
    };

    updateSceneFromScroll();
    window.addEventListener("scroll", scheduleSceneUpdate, { passive: true });
    window.addEventListener("resize", scheduleSceneUpdate, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleSceneUpdate);
      window.removeEventListener("resize", scheduleSceneUpdate);
    };
  }, [scenes.length]);

  function selectScene(index: number) {
    const slot = slotRef.current;
    const marker = slot?.querySelector<HTMLElement>(`[data-scene-marker="${index}"]`);
    if (!slot || !marker) return;
    setActiveScene(index);
    const stickyTop = Number.parseFloat(
      getComputedStyle(slot).getPropertyValue("--lesson-sticky-top"),
    );
    const top = window.scrollY + marker.getBoundingClientRect().top - stickyTop;
    window.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <div
      ref={slotRef}
      id={`region-${region.id}`}
      className={`lesson-slot lesson-slot--screen ${focused ? "lesson-slot--focused" : ""}`}
      data-canvas-region={region.id}
      data-panel-mode="screen"
      data-active-scene={activeScene}
    >
      {scenes.map((scene, index) => (
        <span
          key={scene.id}
          className="lesson-scene-marker"
          data-scene-marker={index}
          style={{ "--scene-index": index } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      <div className="lesson-panel">
        <RegionSection
          region={region}
          focused={focused}
          actions={actions}
          scenes={scenes}
          activeScene={activeScene}
          onSceneSelect={selectScene}
        />
      </div>
    </div>
  );
}

function LivingNotebook({ state, actions }: { state: AgentLearningCanvasState; actions: CanvasActions }) {
  const notebookRef = useRef<HTMLDivElement>(null);
  const conceptMapRef = useRef<HTMLElement>(null);
  const lessonDeckRef = useRef<HTMLDivElement>(null);
  const [chromeCollapsed, setChromeCollapsed] = useState(false);
  const answered = state.regions.filter((region) => region.response).length;
  const progress = state.regions.length ? Math.round((answered / state.regions.length) * 100) : 0;

  useEffect(() => {
    document.documentElement.classList.add("has-lesson-deck");
    return () => {
      document.documentElement.classList.remove("has-lesson-deck", "lesson-chrome-collapsed");
      const header = document.querySelector<HTMLElement>(".app-header");
      header?.removeAttribute("inert");
      header?.removeAttribute("aria-hidden");
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateChrome = () => {
      frame = 0;
      const deck = lessonDeckRef.current;
      const header = document.querySelector<HTMLElement>(".app-header");
      if (!deck || !header) return;
      const firstSlot = deck.querySelector<HTMLElement>(".lesson-slot");
      const firstSlotTop =
        window.scrollY + (firstSlot?.getBoundingClientRect().top ?? deck.getBoundingClientRect().top);
      const mapRect = conceptMapRef.current?.getBoundingClientRect();
      const compactMapHeight = mapRect && mapRect.height <= 120 ? mapRect.height : 0;
      const collapseAt =
        firstSlotTop - header.offsetHeight - compactMapHeight - PANEL_TOP_GAP;
      const shouldCollapse = window.scrollY >= collapseAt;
      const wasCollapsed = document.documentElement.classList.contains(
        "lesson-chrome-collapsed",
      );
      document.documentElement.classList.toggle("lesson-chrome-collapsed", shouldCollapse);
      header.toggleAttribute("inert", shouldCollapse);
      if (shouldCollapse) header.setAttribute("aria-hidden", "true");
      else header.removeAttribute("aria-hidden");
      setChromeCollapsed((current) => (current === shouldCollapse ? current : shouldCollapse));
      if (shouldCollapse && !wasCollapsed) {
        window.scrollTo({ top: window.scrollY + header.offsetHeight, behavior: "auto" });
      }
    };
    const scheduleChromeUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateChrome);
    };

    updateChrome();
    window.addEventListener("scroll", scheduleChromeUpdate, { passive: true });
    window.addEventListener("resize", scheduleChromeUpdate, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleChromeUpdate);
      window.removeEventListener("resize", scheduleChromeUpdate);
    };
  }, []);

  useEffect(() => {
    const regions = Array.from(
      notebookRef.current?.querySelectorAll<HTMLElement>("[data-canvas-region]") ?? [],
    );
    if (!regions.length) return;
    let frame = 0;
    const updateFocusFromReadingLine = () => {
      frame = 0;
      const headerBottom =
        document.querySelector<HTMLElement>(".app-header")?.getBoundingClientRect()
          .bottom ?? 0;
      const mapRect = conceptMapRef.current?.getBoundingClientRect();
      const chromeBottom =
        mapRect && mapRect.height <= 120 ? mapRect.bottom : headerBottom;
      const readingLine =
        chromeBottom + Math.max(72, (window.innerHeight - chromeBottom) * 0.24);
      const measurements = regions.map((region) => ({
        region,
        rect: region.getBoundingClientRect(),
      }));
      if (!measurements.some(({ rect }) => rect.height > 0)) return;
      const active =
        measurements.filter(({ rect }) => {
          return rect.top <= readingLine && rect.bottom > readingLine;
        }).at(-1)?.region ??
        measurements.find(({ rect }) => rect.top > readingLine)?.region ??
        measurements.at(-1)?.region;
      const id = active?.dataset.canvasRegion;
      if (id && id !== actions.getState().focus.regionId) {
        actions.focusRegion(id);
      }
    };
    const scheduleFocusUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateFocusFromReadingLine);
    };
    updateFocusFromReadingLine();
    window.addEventListener("scroll", scheduleFocusUpdate, { passive: true });
    window.addEventListener("resize", scheduleFocusUpdate, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleFocusUpdate);
      window.removeEventListener("resize", scheduleFocusUpdate);
    };
  }, [actions, chromeCollapsed, state.regions.length]);

  useEffect(() => {
    if (!state.focus.regionId) return;
    const activeItem = Array.from(
      conceptMapRef.current?.querySelectorAll<HTMLElement>("[data-map-region]") ?? [],
    ).find((item) => item.dataset.mapRegion === state.focus.regionId);
    const map = conceptMapRef.current;
    if (!activeItem || !map || typeof map.scrollTo !== "function") return;
    map.scrollTo({
        left: activeItem.offsetLeft - (map.clientWidth - activeItem.offsetWidth) / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
    });
  }, [state.focus.regionId]);

  const navigate = (regionId: string) => {
    actions.focusRegion(regionId);
    const slot = document.getElementById(`region-${regionId}`);
    if (!slot) return;
    const mapRect = conceptMapRef.current?.getBoundingClientRect();
    const compactMapHeight = mapRect && mapRect.height <= 120 ? mapRect.height : 0;
    window.scrollTo({
      top: window.scrollY + slot.getBoundingClientRect().top - compactMapHeight - PANEL_TOP_GAP,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <main id="main-canvas" className="learning-layout">
      <aside ref={conceptMapRef} className="concept-map" aria-label="Notebook concept map">
        <div className="concept-map__topic">
          <span>Learning thread</span>
          <strong>{state.session.topic}</strong>
        </div>
        <nav>
          <ol>
            {state.regions.map((region) => (
              <li
                key={region.id}
                data-map-region={region.id}
                className={state.focus.regionId === region.id ? "is-active" : ""}
              >
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
          <p className="eyebrow">Your lesson · {state.lesson.draft?.estimatedMinutes ?? 14} min path</p>
          <h1>{state.lesson.draft?.title ?? state.session.topic}</h1>
          <p>{state.lesson.draft?.subtitle}</p>
          <div className="notebook-cover__legend">
            <span><i className="legend-focus" /> This is your current section</span>
            <span><i className="legend-agent" /> Changes can be undone</span>
            <span><i className="legend-you" /> Your answers remain yours</span>
          </div>
        </header>
        <div className="lesson-deck" ref={lessonDeckRef}>
          {state.regions.map((region) => (
            <LessonSlot
              key={region.id}
              region={region}
              focused={state.focus.regionId === region.id}
              actions={actions}
              chromeCollapsed={chromeCollapsed}
            />
          ))}
        </div>
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
  const constructionProgress = state.lesson.construction
    ? {
        shaped: state.lesson.construction.regions.filter(
          (region) => region.status === "ready",
        ).length,
        total: state.lesson.construction.regions.length,
      }
    : null;
  const working =
    Boolean(constructionProgress) ||
    state.regions.some((region) => region.status === "agent_working");
  return (
    <TrustedContentProvider>
      <div className="app-shell">
        <AppHeader state={state} registration={registration} actions={actions} />
        <AgentBridge
          registration={registration}
          working={working}
          constructionProgress={constructionProgress}
        />
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
    </TrustedContentProvider>
  );
}
