import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { PracticeCanvas } from "./components/PracticeCanvas";
import { mockPracticeSignals } from "./domain/mockData";
import { useLearningStore } from "./hooks/useLearningStore";
import {
  registerOgramLearningTools,
  type WebMcpRegistration,
} from "./lib/webmcp";
import "./styles.css";

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export default function App() {
  const { state, actions } = useLearningStore();
  const [registration, setRegistration] = useState<
    Omit<WebMcpRegistration, "cleanup"> & { registering: boolean }
  >({ supported: false, toolCount: 8, toolNames: [], registering: true });
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [completing, setCompleting] = useState(false);

  const stableActions = useMemo(
    () => actions,
    [
      actions.completeCapsule,
      actions.getState,
      actions.publishCapsule,
      actions.queueDesktopFollowUp,
      actions.recordChoice,
      actions.reset,
      actions.submitSignals,
    ],
  );

  useEffect(() => {
    let active = true;
    let cleanup: () => void = () => {};
    registerOgramLearningTools(stableActions)
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
      .catch(() => {
        if (active) {
          setRegistration((current) => ({ ...current, registering: false }));
        }
      });
    return () => {
      active = false;
      cleanup();
    };
  }, [stableActions]);

  const replayAgentBuild = useCallback(async () => {
    if (simulationRunning) return;
    setSimulationRunning(true);
    try {
      actions.submitSignals(mockPracticeSignals);
      const evidence = document.getElementById("evidence-signals");
      if (evidence instanceof HTMLDetailsElement) evidence.open = true;
      evidence?.scrollIntoView({ behavior: "smooth", block: "center" });
      await wait(700);
      actions.publishCapsule({
        focus: "thread_hygiene",
        personalizedScenario:
          "A client-success lead has used one Codex task to explore, reject, and finally approve a workshop plan. The next job is to turn those approved decisions into a standalone client follow-up.",
        coachNote:
          "You do not need less context. You need the right context to cross the boundary with you.",
        sourceTaskCount: 8,
      });
      document
        .getElementById("todays-practice")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setSimulationRunning(false);
    }
  }, [actions, simulationRunning]);

  const choose = useCallback(
    (choiceId: string) => {
      actions.recordChoice(state.activeCapsule.id, choiceId);
    },
    [actions, state.activeCapsule.id],
  );

  const complete = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    try {
      actions.completeCapsule(state.activeCapsule.id);
      await actions.queueDesktopFollowUp(
        state.activeCapsule.id,
        "Watch for the next matching decision point and capture proof of application.",
      );
    } finally {
      setCompleting(false);
    }
  }, [actions, completing, state.activeCapsule.id]);

  const focusSignal = state.signals.find(
    (signal) => signal.id === state.activeCapsule.focus,
  );

  return (
    <div className="app" id="top">
      <a className="skip-link" href="#todays-practice">
        Skip to today’s practice
      </a>
      <Header
        webMcpSupported={registration.supported}
        toolCount={registration.toolCount}
        registering={registration.registering}
        simulationRunning={simulationRunning}
        onReplay={replayAgentBuild}
      />

      <main className="lesson-page">
        <PracticeCanvas
          capsule={state.activeCapsule}
          context={state.context}
          focusSignal={focusSignal}
          desktopBridge={state.desktopBridge}
          onChoose={choose}
          onComplete={complete}
          completing={completing}
        />
      </main>

      <footer className="site-footer">
        <span>ogram · Lausanne</span>
        <span className="footer-note">Private practice, shaped from behaviour—not content.</span>
        <button className="footer-reset" type="button" onClick={actions.reset}>
          Reset lesson
        </button>
      </footer>
    </div>
  );
}
