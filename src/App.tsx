import { useCallback, useMemo, useState } from "react";
import { CompilationTrace } from "./components/CompilationTrace";
import { Header } from "./components/Header";
import { PracticeCanvas } from "./components/PracticeCanvas";
import {
  WebMcpBridge,
  type WebMcpBridgeStatus,
} from "./components/WebMcpBridge";
import type { ContextPackPlacement, PracticeContract } from "./domain/types";
import { useLearningStore } from "./hooks/useLearningStore";
import { createOgramLearningTools } from "./lib/webmcp";
import "./styles.css";

export default function App() {
  const { state, actions } = useLearningStore();
  const [registration, setRegistration] = useState<WebMcpBridgeStatus>({
    supported: false,
    ready: false,
    toolCount: 7,
    registeredCount: 0,
    toolNames: [],
    error: null,
  });
  const [completing, setCompleting] = useState(false);

  const stableActions = useMemo(
    () => actions,
    [
      actions.awaitRevision,
      actions.completeCapsule,
      actions.getState,
      actions.publishCapsule,
      actions.queueDesktopFollowUp,
      actions.recordChoice,
      actions.recordPracticeCoaching,
      actions.reset,
      actions.resolvePracticeReview,
      actions.retryJourneySync,
      actions.sharePracticeAttempt,
      actions.submitSignals,
      actions.withdrawPracticeConsent,
    ],
  );
  const webMcpTools = useMemo(
    () => createOgramLearningTools(stableActions),
    [stableActions],
  );

  const choose = useCallback(
    (choiceId: string) => {
      stableActions.recordChoice(state.activeCapsule.id, choiceId);
    },
    [stableActions, state.activeCapsule.id],
  );

  const shareAttempt = useCallback(
    (placements: ContextPackPlacement[]) => {
      stableActions.sharePracticeAttempt(state.activeCapsule.id, placements);
    },
    [stableActions, state.activeCapsule.id],
  );

  const withdrawAttempt = useCallback(() => {
    stableActions.withdrawPracticeConsent(state.activeCapsule.id);
  }, [stableActions, state.activeCapsule.id]);

  const resolveReview = useCallback(
    (reviewId: string, resolution: "accepted" | "dismissed") => {
      stableActions.resolvePracticeReview(
        state.activeCapsule.id,
        reviewId,
        resolution,
      );
    },
    [stableActions, state.activeCapsule.id],
  );

  const complete = useCallback(
    async (reminderEnabled: boolean, contract: PracticeContract) => {
      if (completing) return;
      setCompleting(true);
      try {
        const result = stableActions.completeCapsule(
          state.activeCapsule.id,
          contract,
        );
        await stableActions.awaitRevision(result.revision, result.eventId);
        if (reminderEnabled) {
          await stableActions.queueDesktopFollowUp(
            state.activeCapsule.id,
            "Watch for the same decision boundary in a future Codex task.",
          );
        }
      } finally {
        setCompleting(false);
      }
    },
    [completing, stableActions, state.activeCapsule.id],
  );

  const resetLesson = useCallback(() => {
    stableActions.reset();
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [stableActions]);

  const retrySync = useCallback(() => {
    void stableActions.retryJourneySync();
  }, [stableActions]);

  const deliveryStatus =
    state.journeySync.status === "idle"
      ? "ready"
      : state.journeySync.status;
  const followUpRequested = state.events.some(
    (event) =>
      event.type === "desktop_follow_up_queued" &&
      event.payload?.capsuleId === state.activeCapsule.id,
  );

  return (
    <div className="app" id="top">
      <a className="skip-link" href="#todays-practice">
        Skip to today’s practice
      </a>

      <WebMcpBridge tools={webMcpTools} onStatusChange={setRegistration} />

      <Header
        webMcpSupported={registration.supported}
        toolCount={registration.toolCount}
        registeredCount={registration.registeredCount}
        registering={!registration.ready}
        webMcpError={registration.error}
        contextEnvironment={state.contextReceipt.environment}
        journeySync={state.journeySync}
        onRetrySync={retrySync}
      />

      <CompilationTrace
        sourceCount={Object.keys(state.contextReceipt.provenance).length}
        signalCount={state.signals.length}
        capsuleReady={state.activeCapsule.status !== "draft"}
        eventCount={state.events.length}
        deliveryStatus={deliveryStatus}
      />

      <main className="lesson-page">
        <PracticeCanvas
          key={state.activeCapsule.id}
          capsule={state.activeCapsule}
          contextReceipt={state.contextReceipt}
          journey={state.journey}
          journeySync={state.journeySync}
          followUpRequested={followUpRequested}
          webMcpReady={registration.ready}
          onChoose={choose}
          onShareAttempt={shareAttempt}
          onWithdrawAttempt={withdrawAttempt}
          onResolveReview={resolveReview}
          onComplete={complete}
          completing={completing}
        />
      </main>

      <footer className="site-footer">
        <span>ogram · learning ledger · Lausanne</span>
        <span className="footer-note">
          Declared context in. Bounded practice out. Durable proof forward.
        </span>
        <button className="footer-reset" type="button" onClick={resetLesson}>
          Rebuild this learning session
        </button>
      </footer>
    </div>
  );
}
