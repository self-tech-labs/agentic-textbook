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
  >({ supported: false, toolCount: 7, toolNames: [], registering: true });
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [completing, setCompleting] = useState(false);

  const stableActions = useMemo(
    () => actions,
    [
      actions.completeCapsule,
      actions.addLearningModule,
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
      const { capsuleId } = actions.publishCapsule({
        focus: "thread_hygiene",
        personalizedScenario:
          "You have used one Codex task to explore, reject, and finally approve a workshop plan. The next job is to turn those approved decisions into a standalone follow-up.",
        coachNote:
          "Bring the decisions the next task needs—not the whole path you took to reach them.",
        sourceTaskCount: 8,
      });
      actions.addLearningModule(capsuleId, {
        kind: "mini_game",
        title: "Pack the context worth keeping",
        description:
          "A quick extra practice for deciding what should cross into a fork.",
        prompt:
          "You are forking an approved plan into a new production task. What should you bring across?",
        options: [
          {
            id: "everything",
            label: "The full conversation, including rejected ideas",
            feedback:
              "That brings the clutter with you. Carry only the decisions the next task needs.",
            correct: false,
          },
          {
            id: "decision_pack",
            label: "Approved decisions, constraints, and the definition of done",
            feedback:
              "That is the useful context pack: enough to work well, without the whole exploration.",
            correct: true,
          },
          {
            id: "headline_only",
            label: "Only the name of the new deliverable",
            feedback:
              "That is clean, but too thin. The new task still needs the agreed boundaries.",
            correct: false,
          },
        ],
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

  const complete = useCallback(async (reminderEnabled: boolean) => {
    if (completing) return;
    setCompleting(true);
    try {
      actions.completeCapsule(state.activeCapsule.id);
      if (reminderEnabled) {
        await actions.queueDesktopFollowUp(
          state.activeCapsule.id,
          "Remind the learner when the same decision comes up again.",
        );
      }
    } finally {
      setCompleting(false);
    }
  }, [actions, completing, state.activeCapsule.id]);

  const focusSignal = state.signals.find(
    (signal) => signal.id === state.activeCapsule.focus,
  );

  const resetLesson = useCallback(() => {
    actions.reset();
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [actions.reset]);

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
          key={state.activeCapsule.id}
          capsule={state.activeCapsule}
          context={state.context}
          focusSignal={focusSignal}
          journey={state.journey}
          desktopBridge={state.desktopBridge}
          onChoose={choose}
          onComplete={complete}
          completing={completing}
        />
      </main>

      <footer className="site-footer">
        <span>ogram · Lausanne</span>
        <span className="footer-note">
          We use task-level patterns, never your messages or files.
        </span>
        <button className="footer-reset" type="button" onClick={resetLesson}>
          Start this lesson again
        </button>
      </footer>
    </div>
  );
}
