import { useCallback, useEffect, useRef, useState } from "react";
import { CanvasInspector } from "./components/CanvasInspector";
import { ContextDock } from "./components/ContextDock";
import { DraftReview } from "./components/DraftReview";
import { Header } from "./components/Header";
import { LearningCanvas } from "./components/LearningCanvas";
import {
  cloneExperienceFixture,
  experienceFixtures,
} from "./domain/fixtures";
import { useLearningCanvas } from "./hooks/useLearningCanvas";
import {
  createOgramLearningTools,
  registerOgramLearningTools,
  type WebMcpRegistration,
} from "./lib/webmcp";
import "./styles.css";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

function toolByName(
  tools: ReturnType<typeof createOgramLearningTools>,
  name: string,
) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing WebMCP tool: ${name}.`);
  return tool;
}

export default function App() {
  const { state, actions } = useLearningCanvas();
  const [registration, setRegistration] = useState<
    Omit<WebMcpRegistration, "cleanup"> & { registering: boolean }
  >({ supported: false, toolCount: 11, toolNames: [], registering: true });
  const [composing, setComposing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsDrawerRef = useRef<HTMLElement>(null);
  const detailsCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    let cleanup: () => void = () => undefined;
    registerOgramLearningTools(actions)
      .then((result) => {
        cleanup = result.cleanup;
        if (active) {
          setRegistration({
            supported: result.supported,
            toolCount: result.toolCount,
            toolNames: result.toolNames,
            registering: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRegistration((current) => ({ ...current, registering: false }));
          setAppNotice(error instanceof Error ? error.message : "WebMCP registration failed.");
        }
      });
    return () => {
      active = false;
      cleanup();
    };
  }, [actions]);

  const composeAnother = useCallback(async () => {
    if (composing) return;
    setComposing(true);
    setAppNotice(null);
    try {
      const snapshot = actions.getState();
      const activeIndex = experienceFixtures.findIndex(
        (fixture) => fixture.experienceId === snapshot.activeExperience.experienceId,
      );
      const nextFixture =
        experienceFixtures[(activeIndex + 1 + experienceFixtures.length) % experienceFixtures.length] ??
        experienceFixtures[0];
      if (!nextFixture) throw new Error("No experience fixture is available.");
      const draftRevision = snapshot.activeExperience.draftRevision + 1;
      const document = cloneExperienceFixture(
        nextFixture,
        draftRevision,
        snapshot.contextSnapshotId,
        snapshot.learningBrief.id,
      );
      const transactionId = `replay-${Date.now()}`;
      const tools = createOgramLearningTools(actions);

      await toolByName(tools, "ogram_create_experience_draft").execute({
        basePublishedRevision: snapshot.activeExperience.draftRevision,
        idempotencyKey: `${transactionId}-create`,
        document,
      });
      await wait(180);
      const validation = (await toolByName(
        tools,
        "ogram_validate_experience",
      ).execute({
        draftRevision,
        idempotencyKey: `${transactionId}-validate`,
      })) as { ok?: boolean };
      if (!validation.ok) {
        throw new Error("The demonstration draft failed the Ogram compiler.");
      }
      await wait(180);
      await toolByName(tools, "ogram_request_learner_review").execute({
        draftRevision,
        idempotencyKey: `${transactionId}-review`,
      });
    } catch (error) {
      setAppNotice(
        error instanceof Error ? error.message : "The agent composition did not finish.",
      );
    } finally {
      setComposing(false);
    }
  }, [actions, composing]);

  const approveAndPublish = useCallback(async () => {
    const snapshot = actions.getState();
    const draft = snapshot.design.draft;
    if (!draft || publishing) return;
    setPublishing(true);
    setAppNotice(null);
    try {
      if (snapshot.design.status === "awaiting_review") {
        actions.approveDraft(draft.draftRevision);
      } else if (snapshot.design.status !== "approved") {
        throw new Error("This session is not ready for your approval yet.");
      }
      const tools = createOgramLearningTools(actions);
      await toolByName(tools, "ogram_publish_experience").execute({
        draftRevision: draft.draftRevision,
        idempotencyKey: `human-publish-${draft.experienceId}-${draft.draftRevision}`,
      });
    } catch (error) {
      setAppNotice(error instanceof Error ? error.message : "Publication failed.");
    } finally {
      setPublishing(false);
    }
  }, [actions, publishing]);

  const learnerFeedback = state.learnerFeedback?.level ?? null;
  const pendingContext = state.contextClaims.some(
    (claim) => claim.review === "pending",
  );
  const reviewReady =
    (state.design.status === "awaiting_review" ||
      state.design.status === "approved") &&
    state.design.draft &&
    state.design.validation?.valid;
  const activeGate = pendingContext
    ? "context-dock"
    : reviewReady
      ? "draft-review"
      : "learning-stage";
  const visibleTitle =
    reviewReady && state.design.draft
      ? state.design.draft.metadata.title
      : state.activeExperience.metadata.title;
  const previousGate = useRef(activeGate);

  const closeDetails = useCallback(() => {
    setDetailsOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("session-details-trigger")?.focus({
        preventScroll: true,
      });
    });
  }, []);

  useEffect(() => {
    if (!detailsOpen) return;

    detailsCloseRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        detailsDrawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => {
        let ancestor = element.parentElement;
        while (ancestor && detailsDrawerRef.current?.contains(ancestor)) {
          if (
            ancestor.matches("details:not([open])") &&
            !(element.tagName === "SUMMARY" && element.parentElement === ancestor)
          ) {
            return false;
          }
          ancestor = ancestor.parentElement;
        }
        return true;
      });
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDetails, detailsOpen]);

  useEffect(() => {
    if (previousGate.current !== activeGate) {
      setDetailsOpen(false);
      if (activeGate !== "context-dock") {
        document.getElementById(activeGate)?.focus({ preventScroll: true });
      }
      previousGate.current = activeGate;
    }
  }, [activeGate]);

  return (
    <div className="app" id="top">
      <a className="skip-link" href={`#${activeGate}`}>
        Skip to today&apos;s learning
      </a>
      <Header
        title={visibleTitle}
        detailsOpen={detailsOpen}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      {appNotice ? (
        <div className="app-notice" role="alert">
          <p>{appNotice}</p>
          <button type="button" onClick={() => setAppNotice(null)} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      ) : null}

      <main className="experience-shell">
        {pendingContext ? (
          <ContextDock
            claims={state.contextClaims}
            brief={state.learningBrief}
            onReview={actions.reviewContextClaim}
          />
        ) : null}

        {!pendingContext && reviewReady && state.design.draft ? (
          <DraftReview
            draft={state.design.draft}
            publishing={publishing}
            retrying={state.design.status === "approved"}
            onApprove={approveAndPublish}
          />
        ) : null}

        <div className="session-runtime" hidden={pendingContext || Boolean(reviewReady)}>
          <LearningCanvas
            experience={state.activeExperience}
            runtime={state.runtime}
            learnerFeedback={learnerFeedback}
            onRespond={actions.submitLearnerResponse}
            onAdvance={actions.advance}
            onFeedback={(level) => actions.submitLearnerFeedback(level)}
          />
        </div>
      </main>

      <div className="drawer-layer" hidden={!detailsOpen}>
        <button
          className="drawer-backdrop"
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeDetails}
        />
        <aside
          className="session-drawer"
          id="session-details"
          ref={detailsDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-details-title"
        >
          <header className="drawer-header">
            <div>
              <p className="eyebrow">Today&apos;s lesson</p>
              <h2 id="session-details-title">About this session</h2>
            </div>
            <button
              className="drawer-close"
              ref={detailsCloseRef}
              type="button"
              aria-label="Close session details"
              onClick={closeDetails}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div className="drawer-content">
            <div className="disclosure-stack">
              {!pendingContext ? (
                <ContextDock
                  claims={state.contextClaims}
                  brief={state.learningBrief}
                  onReview={actions.reviewContextClaim}
                />
              ) : null}
              <details className="session-disclosure session-options">
                <summary>
                  <span>Change or restart</span>
                  <small>Session options</small>
                  <span className="disclosure-icon" aria-hidden="true">
                    <span>+</span>
                    <span>−</span>
                  </span>
                </summary>
                <div className="disclosure-body option-actions">
                  <div>
                    <h2>Want a different session?</h2>
                    <p>
                      Ask Codex to prepare a lesson for your current goal, or
                      preview another example session here.
                    </p>
                  </div>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={composeAnother}
                    disabled={composing}
                  >
                    {composing ? "Preparing a new session…" : "Preview another session"}
                  </button>
                  <button className="quiet-action" type="button" onClick={actions.reset}>
                    Reset local progress
                  </button>
                  <CanvasInspector
                    state={state}
                    toolCount={registration.toolCount}
                    webMcpSupported={registration.supported}
                  />
                </div>
              </details>
            </div>
            <p className="footer-mark">ogram</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
