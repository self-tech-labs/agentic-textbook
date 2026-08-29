import { useEffect, useRef, useState } from "react";
import type {
  ContextReceipt as ContextReceiptRecord,
  JourneyEntry,
  LearningCapsule,
  LearningState,
  PracticeContract,
} from "../domain/types";
import { ConceptFigure } from "./ConceptFigure";
import { ContextReceipt } from "./ContextReceipt";
import { JourneyLedger } from "./JourneyLedger";
import { LearningModules } from "./LearningModules";
import { PracticeContractEditor } from "./PracticeContractEditor";

interface PracticeCanvasProps {
  capsule: LearningCapsule;
  contextReceipt: ContextReceiptRecord;
  journey: JourneyEntry[];
  journeySync: LearningState["journeySync"];
  followUpRequested: boolean;
  onChoose: (choiceId: string) => void;
  onComplete: (
    reminderEnabled: boolean,
    contract: PracticeContract,
  ) => void | Promise<void>;
  completing: boolean;
}

type LessonStep = 0 | 1 | 2;

const lessonSteps = ["Notice", "Choose", "Apply"] as const;

const syncLabels: Record<LearningState["journeySync"]["status"], string> = {
  idle: "Journey ready",
  queued: "Practice queued",
  syncing: "Saving the learning thread",
  synced: "Journey synced",
  error: "Journey needs attention",
};

function formatSyncTime(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PracticeCanvas({
  capsule,
  contextReceipt,
  journey,
  journeySync,
  followUpRequested,
  onChoose,
  onComplete,
  completing,
}: PracticeCanvasProps) {
  const [step, setStep] = useState<LessonStep>(0);
  const [committedContract, setCommittedContract] =
    useState<PracticeContract>(capsule.practiceContract);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocusKey = useRef<string | null>(null);
  const context = contextReceipt.ogramContext;
  const selected = capsule.choices.find(
    (choice) => choice.id === capsule.selectedChoiceId,
  );
  const complete = capsule.status === "completed";
  const firstName = context.learner.displayName.split(" ")[0];
  const focusSignal = contextReceipt.practiceSignals.find(
    (signal) => signal.id === capsule.focus,
  );
  const taskCount = focusSignal?.sourceTaskCount ?? 0;
  const scenario = capsule.personalizedScenario.replace(
    /\s+· Tailored for .*$/,
    "",
  );
  const completedPractices = journey.filter(
    (entry) => entry.status === "completed",
  ).length;
  const currentStep = step === 2 && !selected?.correct ? 1 : step;
  const sourceCount = Object.keys(contextReceipt.provenance).length;

  useEffect(() => {
    setStep(0);
    setCommittedContract(capsule.practiceContract);
  }, [
    capsule.id,
    capsule.practiceContract.cue,
    capsule.practiceContract.response,
    capsule.practiceContract.proof,
  ]);

  useEffect(() => {
    const focusKey = `${capsule.id}:${currentStep}`;
    if (previousFocusKey.current === null) {
      previousFocusKey.current = focusKey;
      return;
    }
    if (previousFocusKey.current === focusKey) return;
    previousFocusKey.current = focusKey;
    const frame = window.requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [capsule.id, currentStep]);

  useEffect(() => {
    if (!complete) return;
    window.scrollTo({ top: 0, behavior: "auto" });
    const frame = window.requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [complete]);

  const moveTo = (nextStep: LessonStep) => {
    if (nextStep === 2 && !selected?.correct) return;
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const submitContract = async (
    reminderEnabled: boolean,
    contract: PracticeContract,
  ) => {
    setCommittedContract(contract);
    await onComplete(reminderEnabled, contract);
  };

  if (complete) {
  const lastSynced = formatSyncTime(journeySync.lastSyncedAt);
  const followUpStatus =
    journeySync.status === "synced"
      ? "The reminder request is recorded in Ogram."
      : journeySync.status === "error"
        ? "The reminder request is saved locally; delivery must succeed before Ogram can act on it."
        : "The reminder request is awaiting delivery to Ogram.";

    return (
      <article
        className="completion-view learning-ledger-completion"
        id="todays-practice"
      >
        <header className="completion-heading">
          <div className="completion-mark" aria-hidden="true">
            ✓
          </div>
          <p className="eyebrow">3 of 3 complete</p>
          <h1 ref={headingRef} tabIndex={-1}>
            You’re done for today, {firstName}.
          </h1>
          <p className="completion-lede">
            One useful decision is now part of your learning thread—not just a
            lesson you finished.
          </p>
        </header>

        <section
          className="completion-cue committed-practice-summary"
          aria-labelledby="committed-practice-title"
        >
          <span id="committed-practice-title">Your rule of thumb</span>
          <p>{committedContract.response}</p>
        </section>

        <section
          className="proof-ledger"
          aria-labelledby="proof-ledger-title"
        >
          <header className="proof-ledger-heading">
            <p className="eyebrow">The proof contract</p>
            <h2 id="proof-ledger-title">What Ogram will look for next.</h2>
          </header>
          <dl className="proof-ledger-lines">
            <div className="proof-ledger-line is-cue">
              <dt>When</dt>
              <dd>{committedContract.cue}</dd>
            </div>
            <div className="proof-ledger-line is-response">
              <dt>Do</dt>
              <dd>{committedContract.response}</dd>
            </div>
            <div className="proof-ledger-line is-proof">
              <dt>Proof</dt>
              <dd>{committedContract.proof}</dd>
            </div>
          </dl>
        </section>

        <div className="completion-meta">
          <p>
            {completedPractices} of {journey.length} practices complete
          </p>
          <span aria-hidden="true">·</span>
          <p>About {capsule.durationMinutes} minutes today</p>
          <span aria-hidden="true">·</span>
          <p>{capsule.compiler.proofMode.replace("_", " ")} proof</p>
        </div>

        <section
          className={`journey-sync-status is-${journeySync.status}`}
          id="journey-sync"
          aria-labelledby="journey-sync-title"
          aria-live="polite"
        >
          <span
            className={`status-light is-${journeySync.status}`}
            aria-hidden="true"
          />
          <div>
            <strong id="journey-sync-title">
              {syncLabels[journeySync.status]}
            </strong>
            <p>
              {followUpRequested
                ? followUpStatus
                : journeySync.detail}
            </p>
            {journeySync.pendingCount > 0 || lastSynced ? (
              <small>
                {journeySync.pendingCount > 0
                  ? `${journeySync.pendingCount} event${journeySync.pendingCount === 1 ? "" : "s"} awaiting delivery`
                  : `Last synced at ${lastSynced}`}
              </small>
            ) : null}
          </div>
        </section>

        <JourneyLedger entries={journey} />

        <div className="completion-context-receipt">
          <ContextReceipt receipt={contextReceipt} compact />
        </div>

        <details className="completion-details">
          <summary>Why you saw this lesson</summary>
          <p>{capsule.whyToday}</p>
        </details>
      </article>
    );
  }

  return (
    <article
      className="practice-canvas learning-ledger-canvas"
      id="todays-practice"
      data-capsule-id={capsule.id}
      data-context-receipt-id={contextReceipt.receiptId}
    >
      <nav className="lesson-progress" aria-label="Lesson progress">
        <div className="progress-copy">
          <span>Step {currentStep + 1} of 3</span>
          <strong>{lessonSteps[currentStep]}</strong>
        </div>
        <progress value={currentStep + 1} max={3}>
          Step {currentStep + 1} of 3
        </progress>
        <ol>
          {lessonSteps.map((label, index) => (
            <li
              className={
                index < currentStep
                  ? "is-done"
                  : index === currentStep
                    ? "is-current"
                    : ""
              }
              aria-current={index === currentStep ? "step" : undefined}
              key={label}
            >
              {index < currentStep ? (
                <button
                  type="button"
                  aria-label={`Review ${label}`}
                  onClick={() => moveTo(index as LessonStep)}
                >
                  {String(index + 1).padStart(2, "0")}
                </button>
              ) : (
                <span aria-label={label}>
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {currentStep === 0 ? (
        <section
          className="lesson-screen notice-screen"
          aria-labelledby="notice-title"
        >
          <ConceptFigure focus={capsule.focus} />

          <header className="lesson-hero">
            <div className="lesson-meta">
              <p className="eyebrow">Daily practice</p>
              <p>{capsule.durationMinutes} minutes</p>
            </div>
            <p className="greeting">Hi, {firstName}.</p>
            <h1 id="notice-title" ref={headingRef} tabIndex={-1}>
              {capsule.title}
            </h1>
            <p className="learning-objective">
              By the end, you’ll be able to{" "}
              {capsule.learningObjective.charAt(0).toLowerCase() +
                capsule.learningObjective.slice(1)}
            </p>

            <div className="capsule-provenance-stamp">
              <span>
                Compiled from {sourceCount} declared context sources
              </span>
              <code>{contextReceipt.receiptId}</code>
            </div>
          </header>

          <section className="principle-card" aria-labelledby="principle-title">
            <p className="eyebrow">The simple rule</p>
            <h2 id="principle-title">{capsule.principle}</h2>
          </section>

          <aside
            className="lesson-source capsule-provenance"
            id="evidence-signals"
            aria-label="Capsule provenance"
          >
            <ContextReceipt receipt={contextReceipt} compact />

            <div className="capsule-evidence-summary">
              <div className="source-item">
                <span>Pattern used</span>
                <p>{capsule.whyToday}</p>
              </div>
              <div className="source-item">
                <span>Ogram context used</span>
                <p>{context.workshopNotes[0]}</p>
              </div>
              <div className="source-item privacy-source">
                <span>What we did not use</span>
                <p>Your task messages, files, titles, people, or client names.</p>
              </div>
              <p className="privacy-note">
                {taskCount > 0
                  ? `This capsule uses a sanitized behavioural summary from ${taskCount} recent task${taskCount === 1 ? "" : "s"}.`
                  : "This capsule uses sanitized behavioural summaries from recent Codex work."}
              </p>
            </div>
          </aside>

          <LearningModules modules={capsule.learningModules ?? []} />

          <footer className="screen-actions">
            <p>One decision, its consequence, then a rule to carry into work.</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => moveTo(1)}
            >
              See today’s decision <span aria-hidden="true">→</span>
            </button>
          </footer>
        </section>
      ) : null}

      {currentStep === 1 ? (
        <section
          className="lesson-screen choose-screen consequence-screen"
          id="practice-scenario"
          aria-labelledby="choose-title"
        >
          <header className="screen-heading">
            <p className="eyebrow">Compare the consequence</p>
            <h1 id="choose-title" ref={headingRef} tabIndex={-1}>
              What would you do next?
            </h1>
          </header>

          <div className="scenario-card">
            <span>The working moment</span>
            <p>{scenario}</p>
          </div>

          <fieldset className="choice-fieldset consequence-fieldset">
            <legend>{capsule.challengePrompt}</legend>
            <div className="choice-list">
              {capsule.choices.map((choice, index) => {
                const isSelected = choice.id === capsule.selectedChoiceId;
                const isRecommended = isSelected && choice.correct;
                return (
                  <label
                    className={`choice-row ${isSelected ? "is-selected" : ""} ${isRecommended ? "is-correct is-recommended" : ""}`}
                    data-consequence={choice.correct ? "recommended" : "tradeoff"}
                    key={choice.id}
                  >
                    <input
                      type="radio"
                      name={`lesson-choice-${capsule.id}`}
                      value={choice.id}
                      checked={isSelected}
                      onChange={() => onChoose(choice.id)}
                    />
                    <span className="choice-index" aria-hidden="true">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="choice-copy">
                      <strong>{choice.label}</strong>
                      <span>{choice.description}</span>
                    </span>
                    <span className="choice-marker" aria-hidden="true">
                      {isRecommended ? "→" : isSelected ? "•" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selected ? (
            <div
              className={`answer-feedback consequence-comparison ${selected.correct ? "is-correct is-recommended" : "is-rethink is-tradeoff"}`}
              aria-live="polite"
            >
              <strong>
                {selected.correct
                  ? "Why this route fits"
                  : "What this route would cost"}
              </strong>
              <div>
                <p>{selected.feedback}</p>
                {!selected.correct ? (
                  <small>
                    Compare that consequence with the other routes before you
                    commit.
                  </small>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="choice-hint">
              Choose a route to reveal what it would change downstream.
            </p>
          )}

          <footer className="screen-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => moveTo(0)}
            >
              ← Review the rule
            </button>
            {selected?.correct ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => moveTo(2)}
              >
                Turn this into a reminder <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </footer>
        </section>
      ) : null}

      {currentStep === 2 ? (
        <section
          className="lesson-screen apply-screen contract-screen"
          aria-labelledby="apply-title"
        >
          <header className="screen-heading">
            <p className="eyebrow">Carry it into work</p>
            <h1 id="apply-title" ref={headingRef} tabIndex={-1}>
              Make the good choice easy to remember.
            </h1>
            <p>
              Inspect the generated cue, response, and proof. Change them until
              they sound like something you would actually use.
            </p>
          </header>

          <div
            className="habit-card editable-practice-contract"
            aria-busy={completing}
          >
            <PracticeContractEditor
              capsuleId={capsule.id}
              contract={capsule.practiceContract}
              defaultReminderEnabled={false}
              submitLabel="Save practice and finish"
              onSubmit={({ contract, reminderEnabled }) =>
                submitContract(reminderEnabled, contract)
              }
            />
            {completing ? (
              <p className="contract-save-status" role="status">
                Saving this practice to your learning thread…
              </p>
            ) : null}
          </div>

          <p className="coach-note">{capsule.coachNote}</p>

          <footer className="screen-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => moveTo(1)}
            >
              ← Review my answer
            </button>
          </footer>
        </section>
      ) : null}
    </article>
  );
}
