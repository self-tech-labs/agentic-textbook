import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ThinkingOrb } from "thinking-orbs";
import type {
  AgentLearningCanvasState,
  CanvasRegion,
  LearnerContextClaim,
  LessonRegion,
  RegionContent,
} from "../domain/agentCanvas";
import { resolveLessonPath } from "../domain/agentCanvas";
import {
  LESSON_STARTERS,
  briefFromStarter,
  type LessonBriefV1,
  type PreferredLearningMode,
} from "../domain/lessonCatalog";
import type { CanvasActions } from "../hooks/useLearningCanvas";
import {
  loadLessonBrief,
  saveLessonBrief,
} from "../lib/lessonBriefPersistence";

const LazyCodeLab = lazy(() => import("./rich/CodeLab"));
const LazyTrustedContentRenderer = lazy(() =>
  import("./TrustedContentRenderer").then((module) => ({
    default: module.TrustedContentSurface,
  })),
);

const CODEX_LEARN_URL = `codex://browser?url=${encodeURIComponent(
  "https://learn.ogram.ch",
)}`;

function DeferredTrustedContent({
  blocks,
  mode = "full",
}: {
  blocks: RegionContent[];
  mode?: "full" | "preview";
}) {
  return (
    <Suspense fallback={<div className="rich-placeholder">Preparing content…</div>}>
      <LazyTrustedContentRenderer blocks={blocks} mode={mode} />
    </Suspense>
  );
}

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

function getLessonCompletion(state: AgentLearningCanvasState) {
  if (state.session.stage !== "learning" || !state.lesson.draft) {
    return { complete: false, evidenceSaved: 0, evidenceTotal: 0, sectionTotal: 0 };
  }
  const path = resolveLessonPath(state.lesson.draft, state.regions);
  const visibleSet = new Set(path.visibleRegionIds);
  const visibleRegions = state.regions.filter((region) => visibleSet.has(region.id));
  const evidenceRegions = visibleRegions.filter((region) => region.interaction);
  const evidenceSaved = evidenceRegions.filter((region) => region.response).length;
  return {
    complete:
      evidenceRegions.length > 0 &&
      evidenceSaved === evidenceRegions.length &&
      path.lockedRegionIds.length === 0,
    evidenceSaved,
    evidenceTotal: evidenceRegions.length,
    sectionTotal: visibleRegions.length,
  };
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
  const lessonComplete = getLessonCompletion(state).complete;
  const stageLabel =
    state.session.stage === "ready"
      ? "Personal learning canvas"
      : state.session.stage === "context_review"
        ? "Choose what shapes the lesson"
        : state.session.stage === "lesson_review"
          ? "Review your lesson"
          : lessonComplete
            ? "Lesson complete"
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

type LessonPath = "catalog" | "custom";
type UpdateBrief = (patch: Partial<LessonBriefV1>) => void;

function AgentEntry({ registration }: { registration: NotebookRegistration }) {
  const status = registration.registering
    ? "Checking WebMCP"
    : registration.supported
      ? "WebMCP connected"
      : "Open with a WebMCP agent";

  return (
    <section
      className={`agent-entry ${registration.supported ? "agent-entry--connected" : ""}`}
      aria-label="Agent connection"
    >
      <div className="agent-entry__body">
        <span className="agent-entry__status" aria-live="polite">
          <i aria-hidden="true" />
          {status}
        </span>
        {!registration.registering && !registration.supported ? (
          <a className="codex-launch-badge" href={CODEX_LEARN_URL}>
            <strong>Open in Codex</strong>
            <i aria-hidden="true">↗</i>
          </a>
        ) : null}
      </div>
      {!registration.registering && !registration.supported ? (
        <details className="agent-steps">
          <summary>
            <span>How it works</span>
            <i aria-hidden="true">+</i>
          </summary>
          <ol>
            <li>
              <span>1</span>
              <p>Open this page in your agent</p>
            </li>
            <li>
              <span>2</span>
              <p>Choose a lesson</p>
            </li>
            <li>
              <span>3</span>
              <p>Ask it to begin</p>
            </li>
          </ol>
        </details>
      ) : null}
    </section>
  );
}

function BriefCoreFields({
  brief,
  updateBrief,
  clearStarterOnTopicChange,
}: {
  brief: LessonBriefV1;
  updateBrief: UpdateBrief;
  clearStarterOnTopicChange: boolean;
}) {
  return (
    <>
      <label className="lesson-brief__wide">
        <span>Topic</span>
        <input
          value={brief.topic}
          placeholder="What would you like to understand?"
          required
          onChange={(event) =>
            updateBrief({
              topic: event.target.value,
              ...(clearStarterOnTopicChange
                ? { starterId: null, blueprintId: "open_topic_v1" }
                : {}),
            })
          }
        />
      </label>
      <label className="lesson-brief__wide">
        <span>Goal</span>
        <textarea
          rows={2}
          value={brief.desiredOutcome}
          placeholder="By the end, I want to be able to…"
          required
          onChange={(event) => updateBrief({ desiredOutcome: event.target.value })}
        />
      </label>
    </>
  );
}

function BriefPreferenceFields({
  brief,
  updateBrief,
  toggleMode,
}: {
  brief: LessonBriefV1;
  updateBrief: UpdateBrief;
  toggleMode: (mode: PreferredLearningMode) => void;
}) {
  return (
    <>
      <label>
        <span>Level</span>
        <select
          value={brief.currentLevel}
          onChange={(event) =>
            updateBrief({
              currentLevel: event.target.value as LessonBriefV1["currentLevel"],
            })
          }
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>
      <label>
        <span>Time</span>
        <div className="lesson-time-field">
          <input
            type="number"
            min={5}
            max={90}
            step={1}
            value={brief.availableMinutes}
            onChange={(event) =>
              updateBrief({
                availableMinutes: Math.min(
                  90,
                  Math.max(5, Number(event.target.value) || 5),
                ),
              })
            }
          />
          <span>minutes</span>
        </div>
      </label>
      <fieldset className="lesson-brief__wide mode-picker">
        <legend>Format</legend>
        <div>
          {(
            [
              ["visual", "Visual"],
              ["quantitative", "Quantitative"],
              ["code", "Code"],
              ["scenario", "Scenario"],
              ["reading", "Reading"],
            ] as const
          ).map(([mode, label]) => (
            <label key={mode}>
              <input
                type="checkbox"
                checked={brief.preferredModes.includes(mode)}
                onChange={() => toggleMode(mode)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="lesson-brief__wide">
        <span>
          Accessibility <small>optional</small>
        </span>
        <input
          value={brief.accessibilityNotes}
          placeholder="For example: avoid colour-only cues"
          onChange={(event) => updateBrief({ accessibilityNotes: event.target.value })}
        />
      </label>
    </>
  );
}

function PersonalizationSwitch({
  brief,
  updateBrief,
}: {
  brief: LessonBriefV1;
  updateBrief: UpdateBrief;
}) {
  return (
    <label className="personalization-switch">
      <input
        type="checkbox"
        checked={brief.personalizeFromRecentTasks}
        onChange={(event) =>
          updateBrief({ personalizeFromRecentTasks: event.target.checked })
        }
      />
      <span aria-hidden="true">
        <i />
      </span>
      <div>
        <strong>Use recent Codex tasks</strong>
        <small>You approve every signal.</small>
      </div>
    </label>
  );
}

function ReadyFooter() {
  return (
    <footer className="ready-footer">
      <details className="ready-footer__how">
        <summary>
          <span>Under the hood</span>
          <i aria-hidden="true">+</i>
        </summary>
        <div>
          <p>
            This page exposes WebMCP tools to your agent, which builds the lesson and
            updates the canvas you review.
          </p>
          <p>
            <code>codex://</code> opens the page directly in Codex.
          </p>
          <a
            href="https://learn.chatgpt.com/docs/webmcp"
            target="_blank"
            rel="noreferrer"
          >
            WebMCP docs ↗
          </a>
        </div>
      </details>
      <nav aria-label="Ogram links">
        <a href="https://ogram.ch" target="_blank" rel="noreferrer">
          ogram.ch ↗
        </a>
        <a href="https://parsing.swiss" target="_blank" rel="noreferrer">
          parsing.swiss ↗
        </a>
      </nav>
    </footer>
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
  const initialBriefRef = useRef<LessonBriefV1 | null>(null);
  if (initialBriefRef.current === null) {
    initialBriefRef.current = loadLessonBrief();
  }
  const initialBrief = initialBriefRef.current;
  const [brief, setBrief] = useState<LessonBriefV1>(initialBrief);
  const [lessonPath, setLessonPath] = useState<LessonPath | null>(() =>
    initialBrief.starterId
      ? "catalog"
      : initialBrief.topic.trim() || initialBrief.desiredOutcome.trim()
        ? "custom"
        : null,
  );
  const starter = "Use the lesson brief I prepared on this page.";
  const selectedStarter = LESSON_STARTERS.find(
    (candidate) => candidate.id === brief.starterId,
  );

  useEffect(() => {
    saveLessonBrief(brief);
  }, [brief]);

  const updateBrief = (patch: Partial<LessonBriefV1>) => {
    setBrief((current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  };

  const toggleMode = (mode: PreferredLearningMode) => {
    setBrief((current) => {
      const selected = current.preferredModes.includes(mode);
      const preferredModes = selected
        ? current.preferredModes.filter((candidate) => candidate !== mode)
        : [...current.preferredModes, mode];
      return {
        ...current,
        preferredModes: preferredModes.length ? preferredModes : [mode],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(starter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const chooseCustomPath = () => {
    setLessonPath("custom");
    setBrief((current) =>
      current.starterId
        ? {
            ...current,
            topic: "",
            desiredOutcome: "",
            currentLevel: "beginner",
            availableMinutes: 15,
            preferredModes: ["visual"],
            accessibilityNotes: "",
            starterId: null,
            blueprintId: "open_topic_v1",
            updatedAt: new Date().toISOString(),
          }
        : current,
    );
  };

  const briefIsReady =
    (lessonPath === "catalog" && selectedStarter !== undefined) ||
    (lessonPath === "custom" &&
      brief.topic.trim().length > 0 &&
      brief.desiredOutcome.trim().length > 0);

  return (
    <main id="main-canvas" className="ready-canvas">
      <section className="ready-hero" aria-labelledby="ready-title">
        <h1 id="ready-title">
          What do you want <em>to learn?</em>
        </h1>

        <AgentEntry registration={registration} />

        <section className="lesson-paths" aria-labelledby="lesson-paths-title">
          <h2 id="lesson-paths-title">Start a lesson</h2>
          <div className="lesson-path-picker">
            <button
              type="button"
              className={lessonPath === "catalog" ? "is-selected" : ""}
              aria-pressed={lessonPath === "catalog"}
              onClick={() => setLessonPath("catalog")}
            >
              <i aria-hidden="true">≡</i>
              <strong>Choose a course</strong>
              <b aria-hidden="true">→</b>
            </button>
            <button
              type="button"
              className={lessonPath === "custom" ? "is-selected" : ""}
              aria-pressed={lessonPath === "custom"}
              onClick={chooseCustomPath}
            >
              <i aria-hidden="true">+</i>
              <strong>Use my own topic</strong>
              <b aria-hidden="true">→</b>
            </button>
          </div>
        </section>

        {lessonPath ? (
          <form
            className="lesson-brief lesson-builder"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="lesson-brief__heading">
              <strong>{lessonPath === "catalog" ? "Courses" : "Your lesson"}</strong>
            </div>

            {lessonPath === "catalog" ? (
              <>
                <div className="starter-registry" aria-label="Ready-made courses">
                  {LESSON_STARTERS.map((lessonStarter) => {
                    const selected = brief.starterId === lessonStarter.id;
                    return (
                      <button
                        key={lessonStarter.id}
                        type="button"
                        className={selected ? "starter-card is-selected" : "starter-card"}
                        aria-pressed={selected}
                        onClick={() => setBrief(briefFromStarter(lessonStarter))}
                      >
                        <strong>{lessonStarter.title}</strong>
                        <i aria-hidden="true">{selected ? "✓" : "↗"}</i>
                      </button>
                    );
                  })}
                </div>
                {selectedStarter ? (
                  <details className="brief-options">
                    <summary>
                      <strong>Customize</strong>
                      <i aria-hidden="true">+</i>
                    </summary>
                    <div className="lesson-brief__grid">
                      <BriefCoreFields
                        brief={brief}
                        updateBrief={updateBrief}
                        clearStarterOnTopicChange={false}
                      />
                      <BriefPreferenceFields
                        brief={brief}
                        updateBrief={updateBrief}
                        toggleMode={toggleMode}
                      />
                    </div>
                    <PersonalizationSwitch brief={brief} updateBrief={updateBrief} />
                  </details>
                ) : null}
              </>
            ) : (
              <>
                <div className="lesson-brief__grid lesson-brief__grid--core">
                  <BriefCoreFields
                    brief={brief}
                    updateBrief={updateBrief}
                    clearStarterOnTopicChange
                  />
                </div>
                <details className="brief-options brief-options--custom">
                  <summary>
                    <strong>Preferences</strong>
                    <i aria-hidden="true">+</i>
                  </summary>
                  <div className="lesson-brief__grid">
                    <BriefPreferenceFields
                      brief={brief}
                      updateBrief={updateBrief}
                      toggleMode={toggleMode}
                    />
                  </div>
                  <PersonalizationSwitch brief={brief} updateBrief={updateBrief} />
                </details>
              </>
            )}
          </form>
        ) : null}

        {briefIsReady ? (
          <div
            className="starter-prompt starter-prompt--revealed"
            aria-label="Ask your agent"
          >
            <p>{starter}</p>
            <button type="button" className="primary-button" onClick={copy}>
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
        ) : null}

        {registrationError ? <p className="inline-error">{registrationError}</p> : null}
      </section>
      <ReadyFooter />
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
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState(claim.summary);

  const review = (
    decision: "accepted" | "corrected" | "rejected",
    correctedSummary?: string,
  ) => {
    try {
      setError(null);
      actions.reviewContextClaim({
        claimId: claim.id,
        decision,
        ...(correctedSummary ? { correctedSummary } : {}),
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
        correcting ? (
          <div className="context-card__correction">
            <label>
              <span>Correct this learning signal</span>
              <textarea
                rows={3}
                maxLength={280}
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
              />
              <small>{correction.trim().length} / 280 characters</small>
            </label>
            <div className="context-card__correction-actions">
              <button
                type="button"
                className="primary-button"
                disabled={correction.trim().length < 3}
                onClick={() => review("corrected", correction)}
              >
                Save correction + use
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCorrection(claim.summary);
                  setCorrecting(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="context-card__actions" aria-label="Choose whether this context may shape the lesson">
            <button type="button" className="primary-button" onClick={() => review("accepted")}>
              Use this
            </button>
            <button type="button" className="secondary-button" onClick={() => review("rejected")}>
              Don’t use
            </button>
            <button
              type="button"
              className="text-button context-card__correct"
              onClick={() => setCorrecting(true)}
            >
              Correct before using
            </button>
          </div>
        )
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
              <DeferredTrustedContent blocks={region.content} mode="preview" />
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

function FoldedNotebookPreview({
  title,
  regions,
  activelyShaping,
}: {
  title: string;
  regions: CanvasRegion[];
  activelyShaping: boolean;
}) {
  const shaped = regions.filter((region) => region.status !== "skeleton").length;
  const activeRegion =
    regions.find((region) => region.status === "skeleton") ?? regions.at(-1);
  const complete = regions.length > 0 && shaped === regions.length;

  return (
    <section className="folded-notebook" aria-label="Folded notebook preview">
      <i className="folded-notebook__page folded-notebook__page--back" aria-hidden="true" />
      <i className="folded-notebook__page folded-notebook__page--middle" aria-hidden="true" />
      <div className="folded-notebook__cover">
        <div className="folded-notebook__topline">
          <span>Notebook preview · folded</span>
          <span>{String(regions.length).padStart(2, "0")} sections</span>
        </div>
        <div className="folded-notebook__title">
          <span aria-hidden="true">{complete ? "✓" : "↗"}</span>
          <div>
            <strong>{title}</strong>
            <p>
              {complete
                ? "Every section is ready for your review."
                : activelyShaping
                  ? `Now shaping ${activeRegion?.title ?? "the next section"}.`
                  : "The section plan will appear here without opening the notebook."}
            </p>
          </div>
        </div>
        <ol className="folded-notebook__sections" aria-label="Section readiness">
          {regions.map((region) => (
            <li
              key={region.id}
              className={
                region.status !== "skeleton"
                  ? "is-ready"
                  : region.id === activeRegion?.id && activelyShaping
                    ? "is-active"
                    : ""
              }
              title={region.title}
            >
              <span>{String(region.order).padStart(2, "0")}</span>
              <span className="sr-only">
                {region.title} · {region.status !== "skeleton" ? "ready" : "waiting"}
              </span>
            </li>
          ))}
        </ol>
        <div className="folded-notebook__progress">
          <span>{shaped} of {regions.length} ready</span>
          <span aria-hidden="true"><i style={{ width: `${regions.length ? (shaped / regions.length) * 100 : 0}%` }} /></span>
        </div>
      </div>
    </section>
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
  const currentClaim = pending[0];
  const accepted = reviewed.filter(
    (claim) => claim.review === "accepted" || claim.review === "corrected",
  ).length;
  const rejected = reviewed.filter((claim) => claim.review === "rejected").length;
  const construction = state.lesson.construction;
  const previewRegions = construction?.regions ?? state.regions;
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
          <div className="context-decision">
            <div className="context-decision__progress">
              <div>
                <span>Context review</span>
                <strong>
                  {currentClaim
                    ? `Proposal ${reviewed.length + 1} of ${state.contextClaims.length}`
                    : "All proposals decided"}
                </strong>
              </div>
              <ol aria-label="Context proposal progress">
                {state.contextClaims.map((claim, index) => (
                  <li
                    key={claim.id}
                    className={
                      claim.review === "pending"
                        ? claim.id === currentClaim?.id
                          ? "is-current"
                          : ""
                        : claim.review === "rejected"
                          ? "is-rejected"
                          : "is-approved"
                    }
                  >
                    <span className="sr-only">
                      Proposal {index + 1}: {claim.review === "pending" ? "waiting" : claim.review}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            {currentClaim ? (
              <div className="context-decision__card" key={currentClaim.id}>
                <ContextCard claim={currentClaim} actions={actions} />
              </div>
            ) : (
              <div className="context-decision__summary" role="status">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Your context choices are complete.</strong>
                  <p>
                    {accepted} approved · {rejected} left out. The lesson will only use the
                    signals you approved.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="consent-empty">
            <span className="consent-empty__glyph" aria-hidden="true">◎</span>
            <div>
              <strong>No personal context is being used.</strong>
              <p>
                Choose whether relevant current or past work may shape this lesson, or continue
                with the brief-only path.
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
          <span>Notebook preview</span>
          <span>{state.session.topic}</span>
        </div>
        <ConstructionActivity
          regions={previewRegions}
          constructionStarted={Boolean(construction)}
          contextReady={pending.length === 0 && state.session.personalization !== "undecided"}
        />
        <FoldedNotebookPreview
          title={construction?.document.title ?? state.session.topic ?? "Your lesson"}
          regions={previewRegions}
          activelyShaping={Boolean(construction)}
        />
      </aside>
    </main>
  );
}

function LessonReviewPager({ regions }: { regions: LessonRegion[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(0, regions.length - 1));
  const activeRegion = regions[safeIndex];

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, regions.length - 1)));
  }, [regions.length]);

  if (!activeRegion) return null;

  return (
    <div className="lesson-review-pager">
      <nav className="lesson-review-pager__steps" aria-label="Lesson sections">
        {regions.map((region, index) => (
          <button
            key={region.id}
            type="button"
            className={index === safeIndex ? "is-active" : ""}
            aria-current={index === safeIndex ? "step" : undefined}
            aria-label={`Review section ${index + 1}: ${region.title}`}
            onClick={() => setActiveIndex(index)}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
        ))}
      </nav>
      <article className="lesson-review-pager__card" key={activeRegion.id}>
        <div>
          <span>{activeRegion.label}</span>
          <span>{activeRegion.kind}</span>
        </div>
        <h2>{activeRegion.title}</h2>
        <p>{activeRegion.objective}</p>
        <dl>
          <div>
            <dt>Screen</dt>
            <dd>{safeIndex + 1} of {regions.length}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{activeRegion.content.length} learning scene{activeRegion.content.length === 1 ? "" : "s"}{activeRegion.interaction ? " + practice" : ""}</dd>
          </div>
        </dl>
      </article>
      <div className="lesson-review-pager__controls">
        <button
          type="button"
          className="secondary-button"
          disabled={safeIndex === 0}
          onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
        >
          ← Previous
        </button>
        <span>{String(safeIndex + 1).padStart(2, "0")} / {String(regions.length).padStart(2, "0")}</span>
        <button
          type="button"
          className="secondary-button"
          disabled={safeIndex === regions.length - 1}
          onClick={() => setActiveIndex((current) => Math.min(regions.length - 1, current + 1))}
        >
          Next →
        </button>
      </div>
    </div>
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
        <LessonReviewPager regions={draft.regions} />
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
    const feedback =
      interaction.type === "choice"
        ? selected?.feedback
        : interaction.type === "reflection"
          ? interaction.feedback
          : interaction.type === "numeric"
            ? region.response.correct
              ? interaction.correctFeedback
              : interaction.incorrectFeedback
            : region.response.execution
              ? String(region.response.execution.passedTests) +
                " of " +
                String(region.response.execution.totalTests) +
                " tests passed."
              : "Code evidence saved.";
    return (
      <div className="saved-evidence">
        <span className="saved-evidence__label">Your evidence · saved</span>
        <p>{interaction.type === "choice" ? selected?.label : region.response.value}</p>
        <div className={region.response.correct === false ? "feedback feedback--retry" : "feedback"}>
          {feedback}
        </div>
      </div>
    );
  }

  if (interaction.type === "code_lab") {
    return (
      <div className="learner-interaction learner-interaction--code">
        <span className="eyebrow">Executable lab</span>
        <h3>{interaction.prompt}</h3>
        <Suspense fallback={<div className="rich-placeholder">Loading code editor…</div>}>
          <LazyCodeLab
            interaction={interaction}
            onSubmit={(source, evidence) => {
              try {
                setError(null);
                actions.submitLearnerResponse(region.id, source, evidence);
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Your code evidence could not be saved.",
                );
              }
            }}
          />
        </Suspense>
        {error ? <p className="inline-error">{error}</p> : null}
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
      ) : interaction.type === "numeric" ? (
        <label className="numeric-field">
          <span>Your numeric answer{interaction.unit ? ` (${interaction.unit})` : ""}</span>
          <div>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder={interaction.placeholder ?? "Enter a number"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            {interaction.unit ? <span>{interaction.unit}</span> : null}
          </div>
          <small>
            Answers within ±{interaction.tolerance} are accepted.
          </small>
        </label>
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
  formula: "Formula",
  diagram: "Diagram",
  code_example: "Code",
  media: "Media",
  interaction: "Practice",
};

interface LessonSceneSeed {
  id: string;
  label: string;
  type: LessonSceneType;
  block: RegionContent;
}

function splitTextForScreens(text: string, characterBudget = 480): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const parts: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + word.length + 1 <= characterBudget) {
      current += ` ${word}`;
      continue;
    }
    parts.push(current);
    current = word;
  }
  if (current) parts.push(current);
  return parts;
}

function chunkForScreens<Value>(
  values: Value[],
  maximumItems: number,
  characterBudget: number,
  weight: (value: Value) => number,
): Value[][] {
  const chunks: Value[][] = [];
  let current: Value[] = [];
  let currentWeight = 0;

  for (const value of values) {
    const valueWeight = weight(value);
    if (
      current.length &&
      (current.length >= maximumItems || currentWeight + valueWeight > characterBudget)
    ) {
      chunks.push(current);
      current = [];
      currentWeight = 0;
    }
    current.push(value);
    currentWeight += valueWeight;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function sceneSeedsForBlock(block: RegionContent, blockIndex: number): LessonSceneSeed[] {
  const id = `${block.type}-${blockIndex}`;

  if (block.type === "prose") {
    const textParts = splitTextForScreens(block.text);
    const emphasisParts = block.emphasis
      ? splitTextForScreens(block.emphasis, 300)
      : [];
    const textSeeds = textParts.map((text, index) => ({
      id: `${id}-text-${index}`,
      label: textParts.length > 1 ? `Concept ${index + 1}` : "Concept",
      type: "prose" as const,
      block: {
        type: "prose" as const,
        text,
        ...(index === 0 && block.heading ? { heading: block.heading } : {}),
        ...(index === textParts.length - 1 && emphasisParts.length === 1
          ? { emphasis: emphasisParts[0] }
          : {}),
      },
    }));
    const emphasisSeeds = emphasisParts.length > 1
      ? emphasisParts.map((emphasis, index) => ({
          id: `${id}-takeaway-${index}`,
          label: emphasisParts.length > 1 ? `Takeaway ${index + 1}` : "Takeaway",
          type: "prose" as const,
          block: {
            type: "prose" as const,
            text: "",
            ...(index === 0 ? { heading: "Key takeaway" } : {}),
            emphasis,
          },
        }))
      : [];
    return [...textSeeds, ...emphasisSeeds];
  }

  if (block.type === "key_points") {
    const chunks = chunkForScreens(block.items, 3, 360, (item) => item.length);
    return chunks.map((items, index) => ({
      id: `${id}-${index}`,
      label: chunks.length > 1 ? `Essentials ${index + 1}` : "Essentials",
      type: block.type,
      block: { ...block, items },
    }));
  }

  if (block.type === "token_sequence") {
    const chunks = chunkForScreens(block.tokens, 8, 120, (token) => token.length);
    let tokenOffset = 0;
    return chunks.map((tokens, index) => {
      const highlightedIndex =
        block.highlightedIndex !== undefined &&
        block.highlightedIndex >= tokenOffset &&
        block.highlightedIndex < tokenOffset + tokens.length
          ? block.highlightedIndex - tokenOffset
          : undefined;
      tokenOffset += tokens.length;
      return {
        id: `${id}-${index}`,
        label: chunks.length > 1 ? `Tokens ${index + 1}` : "Tokens",
        type: block.type,
        block: {
          ...block,
          tokens,
          highlightedIndex,
          caption: chunks.length > 1
            ? `${block.caption} · part ${index + 1} of ${chunks.length}`
            : block.caption,
        },
      };
    });
  }

  if (block.type === "transformer_stack") {
    const chunks = chunkForScreens(
      block.stages,
      4,
      420,
      (stage) => stage.label.length + stage.detail.length,
    );
    return chunks.map((stages, index) => ({
      id: `${id}-${index}`,
      label: chunks.length > 1 ? `Block ${index + 1}` : "Block",
      type: block.type,
      block: {
        ...block,
        stages,
        caption: chunks.length > 1
          ? `${block.caption} · part ${index + 1} of ${chunks.length}`
          : block.caption,
      },
    }));
  }

  if (block.type === "comparison") {
    const chunks = chunkForScreens(
      block.rows,
      2,
      520,
      (row) => row.label.length + row.left.length + row.right.length,
    );
    return chunks.map((rows, index) => ({
      id: `${id}-${index}`,
      label: chunks.length > 1 ? `Compare ${index + 1}` : "Compare",
      type: block.type,
      block: { ...block, rows },
    }));
  }

  if (block.type === "source_cards") {
    const overviewParts = splitTextForScreens(block.summary);
    const overview: LessonSceneSeed[] = overviewParts.map((text, index) => ({
      id: `${id}-overview-${index}`,
      label: overviewParts.length > 1 ? `Research ${index + 1}` : "Research",
      type: "prose",
      block: {
        type: "prose",
        ...(index === 0 ? { heading: "Research synthesis" } : {}),
        text,
      },
    }));
    const sources: LessonSceneSeed[] = block.sources.map((source, index) => ({
      id: `${id}-source-${index}`,
      label: `Source ${index + 1}`,
      type: block.type,
      block: {
        ...block,
        summary: `Reference ${index + 1} of ${block.sources.length}`,
        sources: [source],
      },
    }));
    return [...overview, ...sources];
  }

  if (block.type === "code_example") {
    const lines = block.code.split("\n");
    const chunks = chunkForScreens(lines, 12, 1_800, (line) => line.length);
    let lineOffset = 0;
    return chunks.map((codeLines, index) => {
      const startLine = lineOffset + 1;
      const endLine = lineOffset + codeLines.length;
      const highlightedLines = block.highlightedLines
        ?.filter((line) => line >= startLine && line <= endLine)
        .map((line) => line - lineOffset);
      lineOffset = endLine;
      return {
        id: `${id}-${index}`,
        label: chunks.length > 1 ? `Code ${index + 1}` : "Code",
        type: block.type,
        block: {
          ...block,
          code: codeLines.join("\n"),
          highlightedLines,
          caption: chunks.length > 1
            ? `${block.caption} · lines ${startLine}–${endLine}`
            : block.caption,
        },
      };
    });
  }

  return [{ id, label: lessonSceneLabels[block.type], type: block.type, block }];
}

function buildLessonScenes(region: CanvasRegion): LessonScene[] {
  const seeds = region.content.flatMap((block, index) => sceneSeedsForBlock(block, index));
  const labelTotals = seeds.reduce<Record<string, number>>((totals, seed) => {
    totals[seed.label] = (totals[seed.label] ?? 0) + 1;
    return totals;
  }, {});
  const labelOccurrences: Record<string, number> = {};
  const contentScenes = seeds.map((seed) => {
    const baseLabel = seed.label;
    labelOccurrences[baseLabel] = (labelOccurrences[baseLabel] ?? 0) + 1;
    const label =
      labelTotals[baseLabel]! > 1
        ? `${baseLabel} ${labelOccurrences[baseLabel]}`
        : baseLabel;
    return {
      id: `${region.id}-${seed.id}`,
      label,
      type: seed.type,
      blocks: [seed.block],
      interaction: false,
    };
  });
  const interactionScene: LessonScene[] = region.interaction
    ? [
        {
          id: `${region.id}-interaction`,
          label:
            region.interaction.type === "reflection"
              ? "Reflect"
              : region.interaction.type === "code_lab"
                ? "Code lab"
                : "Practice",
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
          <div className={`lesson-scene-nav__steps ${scenes.length > 4 ? "is-condensed" : ""}`}>
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
              <DeferredTrustedContent blocks={scene.blocks} />
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
  const safeActiveScene =
    Number.isInteger(activeScene) && activeScene >= 0 && activeScene < scenes.length
      ? activeScene
      : 0;
  const panelMode =
    scenes[safeActiveScene]?.type === "sandbox_widget" ? "flow" : "screen";
  const previousSceneCountRef = useRef(scenes.length);

  useEffect(() => {
    setActiveScene((current) =>
      Number.isInteger(current) && current >= 0
        ? Math.min(current, Math.max(0, scenes.length - 1))
        : 0,
    );
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
    const widgetScene = scenes.length - 1;
    // Reveal newly injected work immediately; scrolling can wait for layout.
    setActiveScene(widgetScene);
    const frame = window.requestAnimationFrame(() => selectScene(widgetScene));
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
      const parsedStickyTop = Number.parseFloat(
        getComputedStyle(slot).getPropertyValue("--lesson-sticky-top"),
      );
      const stickyTop = Number.isFinite(parsedStickyTop) ? parsedStickyTop : 0;
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
    const parsedStickyTop = Number.parseFloat(
      getComputedStyle(slot).getPropertyValue("--lesson-sticky-top"),
    );
    const stickyTop = Number.isFinite(parsedStickyTop) ? parsedStickyTop : 0;
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
      className={`lesson-slot lesson-slot--${panelMode} ${focused ? "lesson-slot--focused" : ""}`}
      data-canvas-region={region.id}
      data-panel-mode={panelMode}
      data-active-scene={safeActiveScene}
      style={{ "--lesson-active-scene": safeActiveScene } as CSSProperties}
    >
      {scenes.map((scene, index) => (
        <span
          key={scene.id}
          className="lesson-scene-marker"
          data-scene-marker={index}
          style={{ "--scene-index": index, scrollSnapStop: "normal" } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      <div className="lesson-panel">
        <RegionSection
          region={region}
          focused={focused}
          actions={actions}
          scenes={scenes}
          activeScene={safeActiveScene}
          onSceneSelect={selectScene}
        />
      </div>
    </div>
  );
}

function LessonCompletionSlot({
  title,
  sectionTotal,
  evidenceTotal,
  actions,
  onReview,
}: {
  title: string;
  sectionTotal: number;
  evidenceTotal: number;
  actions: CanvasActions;
  onReview: () => void;
}) {
  return (
    <div
      id="lesson-complete"
      className="lesson-slot lesson-completion-slot"
      data-panel-mode="completion"
    >
      <div className="lesson-panel lesson-completion-panel">
        <section className="lesson-completion" aria-labelledby="lesson-completion-title">
          <div className="lesson-completion__mark" aria-hidden="true">
            <span>✓</span>
            <i />
          </div>
          <p className="eyebrow">Lesson complete · evidence saved</p>
          <h2 id="lesson-completion-title">You finished the lesson.</h2>
          <p className="lesson-completion__lede">
            “{title}” is complete. Your decisions and answers remain in this notebook until
            you choose to begin another lesson.
          </p>
          <dl className="lesson-completion__facts">
            <div><dt>Sections</dt><dd>{sectionTotal}</dd></div>
            <div><dt>Evidence saved</dt><dd>{evidenceTotal}</dd></div>
            <div><dt>Progress</dt><dd>100%</dd></div>
          </dl>
          <div className="lesson-completion__actions">
            <button type="button" className="primary-button" onClick={actions.reset}>
              Start a new lesson
            </button>
            <button type="button" className="secondary-button" onClick={onReview}>
              Review this lesson
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function LivingNotebook({ state, actions }: { state: AgentLearningCanvasState; actions: CanvasActions }) {
  const notebookRef = useRef<HTMLDivElement>(null);
  const conceptMapRef = useRef<HTMLElement>(null);
  const lessonDeckRef = useRef<HTMLDivElement>(null);
  const [chromeCollapsed, setChromeCollapsed] = useState(false);
  const resolvedPath = useMemo(
    () =>
      state.lesson.draft
        ? resolveLessonPath(state.lesson.draft, state.regions)
        : {
            visibleRegionIds: state.regions.map((region) => region.id),
            lockedRegionIds: [],
            hiddenRegionIds: [],
            selectedEdgeIds: [],
            currentRegionId: state.regions[0]?.id ?? null,
          },
    [state.lesson.draft, state.regions],
  );
  const visibleRegionSet = useMemo(
    () => new Set(resolvedPath.visibleRegionIds),
    [resolvedPath.visibleRegionIds],
  );
  const lockedRegionSet = useMemo(
    () => new Set(resolvedPath.lockedRegionIds),
    [resolvedPath.lockedRegionIds],
  );
  const hiddenRegionSet = useMemo(
    () => new Set(resolvedPath.hiddenRegionIds),
    [resolvedPath.hiddenRegionIds],
  );
  const visibleRegions = state.regions.filter((region) =>
    visibleRegionSet.has(region.id),
  );
  const evidenceRegions = visibleRegions.filter((region) => region.interaction);
  const answered = evidenceRegions.filter((region) => region.response).length;
  const progress = evidenceRegions.length
    ? Math.round((answered / evidenceRegions.length) * 100)
    : 0;
  const completion = useMemo(
    () => getLessonCompletion(state),
    [state.lesson.draft, state.regions, state.session.stage],
  );
  const completionWasRevealed = useRef(false);

  useEffect(() => {
    if (
      state.focus.regionId &&
      lockedRegionSet.has(state.focus.regionId) &&
      resolvedPath.currentRegionId
    ) {
      actions.focusRegion(resolvedPath.currentRegionId);
    }
  }, [
    actions,
    lockedRegionSet,
    resolvedPath.currentRegionId,
    state.focus.regionId,
  ]);

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

  useEffect(() => {
    if (!completion.complete) {
      completionWasRevealed.current = false;
      return;
    }
    if (completionWasRevealed.current) return;
    completionWasRevealed.current = true;
    const frame = window.requestAnimationFrame(() => {
      const slot = document.getElementById("lesson-complete");
      if (!slot) return;
      const mapRect = conceptMapRef.current?.getBoundingClientRect();
      const compactMapHeight = mapRect && mapRect.height <= 120 ? mapRect.height : 0;
      window.scrollTo({
        top: window.scrollY + slot.getBoundingClientRect().top - compactMapHeight - PANEL_TOP_GAP,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [completion.complete]);

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

  const navigateCompletion = () => {
    const slot = document.getElementById("lesson-complete");
    if (!slot) return;
    const mapRect = conceptMapRef.current?.getBoundingClientRect();
    const compactMapHeight = mapRect && mapRect.height <= 120 ? mapRect.height : 0;
    window.scrollTo({
      top: window.scrollY + slot.getBoundingClientRect().top - compactMapHeight - PANEL_TOP_GAP,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const reviewLesson = () => {
    const firstRegion = visibleRegions[0];
    if (firstRegion) navigate(firstRegion.id);
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
            {state.regions
              .filter((region) => !hiddenRegionSet.has(region.id))
              .map((region) => (
              <li
                key={region.id}
                data-map-region={region.id}
                className={
                  lockedRegionSet.has(region.id)
                    ? "is-locked"
                    : state.focus.regionId === region.id
                      ? "is-active"
                      : region.response
                        ? "is-complete"
                        : ""
                }
              >
                <button
                  type="button"
                  onClick={() => navigate(region.id)}
                  disabled={lockedRegionSet.has(region.id)}
                  aria-label={`${region.title}${
                    lockedRegionSet.has(region.id)
                      ? " · locked until you complete the current decision"
                      : region.response
                        ? " · completed"
                        : ""
                  }`}
                >
                  <span>{String(region.order).padStart(2, "0")}</span>
                  <span>{region.title}</span>
                  {region.response ? (
                    <i aria-label="Completed">✓</i>
                  ) : lockedRegionSet.has(region.id) ? (
                    <i aria-label="Locked">◇</i>
                  ) : null}
                </button>
              </li>
            ))}
            {completion.complete ? (
              <li className="is-complete lesson-completion-nav">
                <button type="button" onClick={navigateCompletion} aria-label="Lesson complete">
                  <span>✓</span>
                  <span>Lesson complete</span>
                </button>
              </li>
            ) : null}
          </ol>
        </nav>
        <div className="concept-map__progress">
          <div><span>Evidence saved</span><strong>{answered}/{evidenceRegions.length}</strong></div>
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
          {visibleRegions.map((region) => (
            <LessonSlot
              key={region.id}
              region={region}
              focused={state.focus.regionId === region.id}
              actions={actions}
              chromeCollapsed={chromeCollapsed}
            />
          ))}
          {completion.complete ? (
            <LessonCompletionSlot
              title={state.lesson.draft?.title ?? state.session.topic ?? "Your lesson"}
              sectionTotal={completion.sectionTotal}
              evidenceTotal={completion.evidenceTotal}
              actions={actions}
              onReview={reviewLesson}
            />
          ) : null}
        </div>
        {!completion.complete ? (
          <footer className="notebook-end">
            <span>End of notebook</span>
            <p>Keep the conversation open. A natural question can reshape any focused region without restarting your learning path.</p>
          </footer>
        ) : null}
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
    <div className="app-shell">
      <AppHeader state={state} registration={registration} actions={actions} />
      {state.session.stage === "ready" ? null : (
        <AgentBridge
          registration={registration}
          working={working}
          constructionProgress={constructionProgress}
        />
      )}
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
