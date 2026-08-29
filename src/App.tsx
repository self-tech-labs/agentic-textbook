import { useCallback, useEffect, useMemo, useState } from "react";
import { ContextRail } from "./components/ContextRail";
import { Header } from "./components/Header";
import { JourneyRail } from "./components/JourneyRail";
import { PracticeCanvas } from "./components/PracticeCanvas";
import { SignalBoard } from "./components/SignalBoard";
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
      document
        .getElementById("evidence-signals")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  return (
    <div className="app" id="top">
      <Header
        webMcpSupported={registration.supported}
        toolCount={registration.toolCount}
        registering={registration.registering}
        simulationRunning={simulationRunning}
        onReplay={replayAgentBuild}
        onReset={actions.reset}
      />

      <section className="mission-strip" aria-label="How to use this prototype">
        <div className="mission-index">DAILY / 03</div>
        <p>
          <strong>Ask Codex:</strong> “Review my recent Codex work and use this page’s
          tools to build the one practice I need today.”
        </p>
        <span className="mission-note">
          The agent reasons. Ogram remembers. You stay in control.
        </span>
      </section>

      <div className="workspace-grid">
        <JourneyRail
          learner={state.context.learner}
          journey={state.journey}
          assignedTraining={state.context.requiredTraining}
        />

        <main className="main-column">
          <SignalBoard signals={state.signals} />
          <PracticeCanvas
            capsule={state.activeCapsule}
            onChoose={choose}
            onComplete={complete}
            completing={completing}
          />
        </main>

        <ContextRail
          context={state.context}
          events={state.events}
          desktopBridge={state.desktopBridge}
          capsuleId={state.activeCapsule.id}
          webMcpSupported={registration.supported}
        />
      </div>

      <footer className="site-footer">
        <span>Ogram Practice Desk · WebMCP Challenge 2026</span>
        <span>Mock data / local prototype / privacy by minimisation</span>
      </footer>
    </div>
  );
}
