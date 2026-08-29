import type {
  LearningCapsule,
  OgramInjectedContext,
  PracticeSignal,
} from "../domain/types";

interface PracticeCanvasProps {
  capsule: LearningCapsule;
  context: OgramInjectedContext;
  focusSignal?: PracticeSignal;
  desktopBridge: {
    status: "ready" | "queued" | "synced";
    detail: string;
  };
  onChoose: (choiceId: string) => void;
  onComplete: () => void;
  completing: boolean;
}

export function PracticeCanvas({
  capsule,
  context,
  focusSignal,
  desktopBridge,
  onChoose,
  onComplete,
  completing,
}: PracticeCanvasProps) {
  const selected = capsule.choices.find(
    (choice) => choice.id === capsule.selectedChoiceId,
  );
  const complete = capsule.status === "completed";
  const firstName = context.learner.displayName.split(" ")[0];
  const taskCount = focusSignal?.sourceTaskCount ?? 0;
  const scenario = capsule.personalizedScenario.replace(
    /\s+· Tailored for .*$/,
    "",
  );
  const desktopDetail = desktopBridge.detail.startsWith("Queued locally")
    ? "Queued locally in prototype mode. Ready for the Ogram desktop journey."
    : desktopBridge.detail;

  if (complete) {
    return (
      <article className="completion-view" id="todays-practice">
        <div className="completion-mark" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Today’s practice</p>
        <h1>Practice captured</h1>
        <p className="completion-lede">
          Your next-work cue is ready. Ogram will keep it close without keeping
          your conversation.
        </p>

        <section className="completion-cue" id="learning-journey">
          <span>Remember</span>
          <p>{capsule.practiceContract.response}</p>
        </section>

        <div className="desktop-status" id="desktop-loop" role="status">
          <span
            className={`status-light is-${desktopBridge.status}`}
            aria-hidden="true"
          />
          <div>
            <strong>Ogram desktop</strong>
            <p>{desktopDetail}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="practice-canvas" id="todays-practice">
      <header className="lesson-hero">
        <div className="lesson-meta">
          <p className="eyebrow">
            <span aria-hidden="true" /> Daily practice
          </p>
          <p>{capsule.durationMinutes} minutes</p>
        </div>
        <p className="greeting">Good morning, {firstName}.</p>
        <h1>{capsule.title}</h1>
        <p className="lesson-principle">{capsule.principle}</p>
      </header>

      <section className="scenario-section" id="practice-scenario">
        <blockquote>{scenario}</blockquote>
        <h2>{capsule.challengePrompt}</h2>

        <div className="choice-list" role="group" aria-label="Scenario choices">
          {capsule.choices.map((choice, index) => {
            const isSelected = choice.id === capsule.selectedChoiceId;
            const revealCorrect = Boolean(selected && choice.correct);
            return (
              <button
                className={`choice-row ${isSelected ? "is-selected" : ""} ${
                  revealCorrect ? "is-correct" : ""
                }`}
                type="button"
                key={choice.id}
                onClick={() => onChoose(choice.id)}
                aria-pressed={isSelected}
              >
                <span className="choice-index" aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="choice-copy">
                  <strong>{choice.label}</strong>
                  <span>{choice.description}</span>
                </span>
                <span className="choice-marker" aria-hidden="true">
                  {revealCorrect ? "✓" : isSelected ? "•" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {selected ? (
          <div
            className={`answer-feedback ${selected.correct ? "is-correct" : "is-rethink"}`}
            role="status"
          >
            <strong>{selected.correct ? "Good call." : "Worth another look."}</strong>
            <p>{selected.feedback}</p>
          </div>
        ) : (
          <p className="choice-hint">Choose the move you would actually make.</p>
        )}
      </section>

      <section className={`practice-commitment ${selected ? "is-visible" : ""}`}>
        {selected ? (
          <>
            <p className="eyebrow">Take it into your next task</p>
            <div className="commitment-line">
              <span>When</span>
              <p>{capsule.practiceContract.cue}</p>
            </div>
            <div className="commitment-line">
              <span>Then</span>
              <p>{capsule.practiceContract.response}</p>
            </div>
            <p className="coach-note">“{capsule.coachNote}”</p>
          </>
        ) : null}

        <div className="commit-row">
          <p>
            {selected
              ? "Save one cue—never the conversation behind it."
              : "One choice. One habit to carry into real work."}
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={onComplete}
            disabled={!selected || completing}
          >
            {completing ? "Saving…" : "Commit this practice"}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <details className="lesson-source" id="evidence-signals">
        <summary>
          <span>
            Why this lesson
            <small>
              {taskCount > 0 ? `${taskCount} recent tasks` : "Recent Codex work"} +
              Ogram context
            </small>
          </span>
          <span className="summary-mark" aria-hidden="true">
            +
          </span>
        </summary>
        <div className="source-detail">
          <div className="source-item">
            <span>Codex activity</span>
            <p>{capsule.whyToday}</p>
          </div>
          <div className="source-item">
            <span>ogram-injected-context</span>
            <p>
              {context.learner.role}. {context.workshopNotes[0]}
            </p>
          </div>
          <p className="privacy-note">
            Behavioural summaries only · no task text stored.
          </p>
        </div>
      </details>
    </article>
  );
}
