import { useCallback, useEffect, useState } from "react";
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
    const draft = actions.getState().design.draft;
    if (!draft || publishing) return;
    setPublishing(true);
    setAppNotice(null);
    try {
      actions.approveDraft(draft.draftRevision);
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
  const reviewReady =
    state.design.status === "awaiting_review" &&
    state.design.draft &&
    state.design.validation?.valid;

  return (
    <div className="app" id="top">
      <a className="skip-link" href="#learning-stage">
        Skip to the learning experience
      </a>
      <Header
        webMcpSupported={registration.supported}
        toolCount={registration.toolCount}
        registering={registration.registering}
        composing={composing}
        onCompose={composeAnother}
      />

      {appNotice ? (
        <div className="app-notice" role="alert">
          <span>Canvas notice</span>
          <p>{appNotice}</p>
          <button type="button" onClick={() => setAppNotice(null)} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      ) : null}

      {reviewReady && state.design.draft && state.design.validation ? (
        <DraftReview
          draft={state.design.draft}
          validation={state.design.validation}
          publishing={publishing}
          onApprove={approveAndPublish}
        />
      ) : null}

      <main className="canvas-shell">
        <ContextDock
          claims={state.contextClaims}
          brief={state.learningBrief}
          onReview={actions.reviewContextClaim}
        />
        <LearningCanvas
          experience={state.activeExperience}
          runtime={state.runtime}
          learnerFeedback={learnerFeedback}
          onRespond={actions.submitLearnerResponse}
          onAdvance={actions.advance}
          onFeedback={(level) => actions.submitLearnerFeedback(level)}
        />
        <CanvasInspector
          state={state}
          toolCount={registration.toolCount}
          webMcpSupported={registration.supported}
        />
      </main>

      <footer className="site-footer">
        <p>
          <strong>Ogram Learning Canvas</strong>
          Codex authors a declarative learning application. Ogram compiles,
          runs, remembers, and governs it.
        </p>
        <div className="footer-contract">
          <span>spec 1.0</span>
          <span>registry v1</span>
          <span>policy 2026.1</span>
        </div>
        <button type="button" onClick={actions.reset}>
          Reset local journey
        </button>
      </footer>
    </div>
  );
}
