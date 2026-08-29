import { useCallback, useMemo, useState } from "react";
import { CompilationTrace } from "./components/CompilationTrace";
import { Header } from "./components/Header";
import { PracticeCanvas } from "./components/PracticeCanvas";
import {
  WebMcpBridge,
  type WebMcpBridgeStatus,
} from "./components/WebMcpBridge";
import type { PracticeContract } from "./domain/types";
import { useLearningStore } from "./hooks/useLearningStore";
import { createOgramLearningTools } from "./lib/webmcp";
import "./styles.css";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export default function App() {
  const { state, actions } = useLearningStore();
  const [registration, setRegistration] = useState<WebMcpBridgeStatus>({
    supported: false,
    ready: false,
    toolCount: 6,
    registeredCount: 0,
    toolNames: [],
    error: null,
  });
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [completing, setCompleting] = useState(false);

  const stableActions = useMemo(
    () => actions,
    [
      actions.addLearningModule,
      actions.awaitRevision,
      actions.completeCapsule,
      actions.getState,
      actions.publishCapsule,
      actions.queueDesktopFollowUp,
      actions.recordChoice,
      actions.reset,
      actions.retryJourneySync,
      actions.submitSignals,
    ],
  );
  const webMcpTools = useMemo(
    () => createOgramLearningTools(stableActions),
    [stableActions],
  );

  const replayAgentBuild = useCallback(async () => {
    if (simulationRunning) return;
    setSimulationRunning(true);
    try {
      const execute = async (name: string, input: unknown) => {
        const tool = webMcpTools.find((candidate) => candidate.name === name);
        if (!tool) throw new Error(`Missing site tool: ${name}`);
        return tool.execute(input);
      };

      await execute("ogram_get_learning_mission", {});
      await execute("ogram_get_injected_context", {});
      await wait(260);
      await execute("ogram_submit_practice_signals", {
        signals: [
          {
            id: "thread_hygiene",
            level: "priority",
            confidence: 0.94,
            occurrences: 6,
            sampleSize: 8,
          },
          {
            id: "effort_fit",
            level: "practice",
            confidence: 0.86,
            occurrences: 2,
            sampleSize: 5,
          },
          {
            id: "workspace_hygiene",
            level: "watch",
            confidence: 0.78,
            occurrences: 2,
            sampleSize: 4,
          },
        ],
      });
      await wait(340);
      const published = (await execute("ogram_publish_daily_capsule", {
        focus: "thread_hygiene",
        difficulty: "stretch",
        practiceMode: "rehearsal",
        proofMode: "observed_habit",
      })) as { capsuleId?: string };
      const capsuleId =
        published.capsuleId ?? stableActions.getState().activeCapsule.id;
      await wait(340);
      await execute("ogram_add_learning_module", {
        capsuleId,
        templateId: "context_packing",
      });
      document
        .getElementById("todays-practice")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setSimulationRunning(false);
    }
  }, [simulationRunning, stableActions, webMcpTools]);

  const choose = useCallback(
    (choiceId: string) => {
      stableActions.recordChoice(state.activeCapsule.id, choiceId);
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
        simulationRunning={simulationRunning}
        onReplay={replayAgentBuild}
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
          onChoose={choose}
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
