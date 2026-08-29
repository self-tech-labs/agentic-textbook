import type { LearningCapsule } from "../domain/types";

interface PracticeCanvasProps {
  capsule: LearningCapsule;
  onChoose: (choiceId: string) => void;
  onComplete: () => void;
  completing: boolean;
}

export function PracticeCanvas({
  capsule,
  onChoose,
  onComplete,
  completing,
}: PracticeCanvasProps) {
  const selected = capsule.choices.find(
    (choice) => choice.id === capsule.selectedChoiceId,
  );
  const complete = capsule.status === "completed";

  return (
    <article className="practice-canvas" id="todays-practice">
      <header className="practice-hero">
        <div className="practice-hero-copy">
          <p className="practice-eyebrow">{capsule.eyebrow}</p>
          <h1>{capsule.title}</h1>
          <p className="practice-principle">{capsule.principle}</p>
        </div>
        <div className="lesson-duration" aria-label={`${capsule.durationMinutes} minutes`}>
          <span>{capsule.durationMinutes}</span>
          <small>min</small>
        </div>
      </header>

      <div className="checkpoint-row" aria-label="Capsule progress">
        {capsule.checkpoints.map((checkpoint, index) => (
          <div className={`checkpoint is-${checkpoint.status}`} key={checkpoint.id}>
            <span>{checkpoint.status === "done" ? "✓" : index + 1}</span>
            <div>
              <strong>{checkpoint.label}</strong>
              <small>{checkpoint.detail}</small>
            </div>
          </div>
        ))}
      </div>

      <section className="why-card">
        <div className="source-chip source-codex">
          <span aria-hidden="true">◆</span> codex observations
        </div>
        <div>
          <p className="muted-label">Why this, today</p>
          <p>{capsule.whyToday}</p>
        </div>
      </section>

      <section className="scenario-section" id="practice-scenario">
        <div className="scenario-header">
          <div>
            <p className="muted-label">A familiar moment</p>
            <h2>Choose before momentum chooses for you.</h2>
          </div>
          <span className="scenario-number">01 / 01</span>
        </div>

        <blockquote>{capsule.personalizedScenario}</blockquote>
        <p className="challenge-prompt">{capsule.challengePrompt}</p>

        <div className="choice-grid" role="group" aria-label="Scenario choices">
          {capsule.choices.map((choice, index) => {
            const isSelected = choice.id === capsule.selectedChoiceId;
            return (
              <button
                className={`choice-card ${isSelected ? "is-selected" : ""} ${
                  selected && choice.correct ? "is-correct" : ""
                }`}
                type="button"
                key={choice.id}
                onClick={() => onChoose(choice.id)}
                aria-pressed={isSelected}
                disabled={complete}
              >
                <span className="choice-letter" aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="choice-copy">
                  <small>{choice.shorthand}</small>
                  <strong>{choice.label}</strong>
                  <span>{choice.description}</span>
                </span>
                <span className="choice-arrow" aria-hidden="true">
                  {isSelected ? "●" : "→"}
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
            <span aria-hidden="true">{selected.correct ? "✓" : "↺"}</span>
            <div>
              <strong>{selected.correct ? "Good call." : "Worth another look."}</strong>
              <p>{selected.feedback}</p>
            </div>
          </div>
        ) : (
          <p className="choice-hint">Pick the move you would actually make.</p>
        )}
      </section>

      <section className="practice-contract">
        <div className="contract-title">
          <p className="muted-label">Your next-work contract</p>
          <h2>One cue. One response. One proof.</h2>
        </div>
        <div className="contract-grid">
          <div>
            <span>When you notice</span>
            <p>{capsule.practiceContract.cue}</p>
          </div>
          <div>
            <span>Do this</span>
            <p>{capsule.practiceContract.response}</p>
          </div>
          <div>
            <span>Ogram looks for</span>
            <p>{capsule.practiceContract.proof}</p>
          </div>
        </div>
        <div className="coach-note">
          <span aria-hidden="true">“</span>
          <p>{capsule.coachNote}</p>
          <small>Codex · tailored from Ogram context</small>
        </div>
      </section>

      <footer className={`capsule-footer ${complete ? "is-complete" : ""}`}>
        {complete ? (
          <div className="completion-stamp">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Practice captured</strong>
              <p>The desktop loop is watching for proof in real work.</p>
            </div>
          </div>
        ) : (
          <>
            <p>
              Completion records the commitment—not private conversation content.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={onComplete}
              disabled={!selected || completing}
            >
              {completing ? "Closing the loop…" : "Commit this practice"}
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
