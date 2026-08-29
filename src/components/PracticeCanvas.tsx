import { useEffect, useRef, useState } from "react";
import type {
  JourneyEntry,
  LearningCapsule,
  OgramInjectedContext,
  PracticeSignal,
} from "../domain/types";
import { ConceptFigure } from "./ConceptFigure";
import { LearningModules } from "./LearningModules";

interface PracticeCanvasProps {
  capsule: LearningCapsule;
  context: OgramInjectedContext;
  focusSignal?: PracticeSignal;
  journey: JourneyEntry[];
  desktopBridge: {
    status: "ready" | "queued" | "synced";
    detail: string;
  };
  onChoose: (choiceId: string) => void;
  onComplete: (reminderEnabled: boolean) => void;
  completing: boolean;
}

type LessonStep = 0 | 1 | 2;

const lessonSteps = ["Notice", "Choose", "Apply"] as const;

function storedStep(capsule: LearningCapsule): LessonStep {
  try {
    const value = Number(
      window.localStorage.getItem(`ogram:lesson-step:${capsule.id}`),
    );
    if (value === 1 || value === 2) return value;
  } catch {
    // The lesson still works when browser storage is unavailable.
  }
  return 0;
}

export function PracticeCanvas({
  capsule,
  context,
  focusSignal,
  journey,
  desktopBridge,
  onChoose,
  onComplete,
  completing,
}: PracticeCanvasProps) {
  const [step, setStep] = useState<LessonStep>(() => storedStep(capsule));
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
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
  const completedPractices = journey.filter(
    (entry) => entry.status === "completed",
  ).length;
  const currentStep = step === 2 && !selected?.correct ? 1 : step;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `ogram:lesson-step:${capsule.id}`,
        String(currentStep),
      );
    } catch {
      // The lesson still works when browser storage is unavailable.
    }

    if (mounted.current) {
      window.requestAnimationFrame(() =>
        headingRef.current?.focus({ preventScroll: true }),
      );
    } else {
      mounted.current = true;
    }
  }, [capsule.id, currentStep]);

  useEffect(() => {
    if (complete) {
      window.scrollTo({ top: 0, behavior: "auto" });
      window.requestAnimationFrame(() =>
        headingRef.current?.focus({ preventScroll: true }),
      );
    }
  }, [complete]);

  const moveTo = (nextStep: LessonStep) => {
    if (nextStep === 2 && !selected?.correct) return;
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (complete) {
    const reminderCopy =
      desktopBridge.status === "ready"
        ? "No reminder was scheduled."
        : "We’ll remind you in Ogram when a similar moment comes up.";

    return (
      <article className="completion-view" id="todays-practice">
        <div className="completion-mark" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">3 of 3 complete</p>
        <h1 ref={headingRef} tabIndex={-1}>
          You’re done for today, {firstName}.
        </h1>
        <p className="completion-lede">
          You practised one decision you can use in your next Codex task.
        </p>

        <section className="completion-cue" id="learning-journey">
          <span>Your rule of thumb</span>
          <p>{capsule.practiceContract.response}</p>
        </section>

        <div className="completion-meta">
          <p>
            {completedPractices} of {journey.length} practices complete
          </p>
          <span aria-hidden="true">·</span>
          <p>About {capsule.durationMinutes} minutes today</p>
        </div>

        <div className="desktop-status" id="desktop-loop" role="status">
          <span
            className={`status-light is-${desktopBridge.status}`}
            aria-hidden="true"
          />
          <div>
            <strong>
              {desktopBridge.status === "ready"
                ? "Lesson finished"
                : "Reminder saved"}
            </strong>
            <p>{reminderCopy}</p>
          </div>
        </div>

        <details className="completion-details">
          <summary>Why you saw this lesson</summary>
          <p>{capsule.whyToday}</p>
        </details>
      </article>
    );
  }

  return (
    <article className="practice-canvas" id="todays-practice">
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
          </header>

          <section className="principle-card" aria-labelledby="principle-title">
            <p className="eyebrow">The simple rule</p>
            <h2 id="principle-title">{capsule.principle}</h2>
          </section>

          <details className="lesson-source" id="evidence-signals">
            <summary>
              <span>
                Why you’re seeing this
                <small>
                  Based on work patterns and goals you shared with Ogram
                </small>
              </span>
              <span className="summary-mark" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="source-detail">
              <div className="source-item">
                <span>Pattern we noticed</span>
                <p>{capsule.whyToday}</p>
              </div>
              <div className="source-item">
                <span>What you told Ogram</span>
                <p>{context.workshopNotes[0]}</p>
              </div>
              <div className="source-item privacy-source">
                <span>What we did not use</span>
                <p>Your task messages, files, titles, people, or client names.</p>
              </div>
              {context.requiredTraining ? (
                <div className="source-item assigned-source">
                  <span>Assigned by your organisation</span>
                  <p>
                    {context.requiredTraining.title} ·{" "}
                    {context.requiredTraining.dueLabel}
                  </p>
                </div>
              ) : null}
              <p className="privacy-note">
                {taskCount > 0
                  ? `This lesson uses a behavioural summary from ${taskCount} recent task${taskCount === 1 ? "" : "s"}.`
                  : "This lesson uses behavioural summaries from recent Codex work."}
              </p>
            </div>
          </details>

          <LearningModules modules={capsule.learningModules ?? []} />

          <footer className="screen-actions">
            <p>One short example, then one reminder to take back to work.</p>
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
          className="lesson-screen choose-screen"
          id="practice-scenario"
          aria-labelledby="choose-title"
        >
          <header className="screen-heading">
            <p className="eyebrow">Try it</p>
            <h1 id="choose-title" ref={headingRef} tabIndex={-1}>
              What would you do next?
            </h1>
          </header>

          <div className="scenario-card">
            <span>Imagine this</span>
            <p>{scenario}</p>
          </div>

          <fieldset className="choice-fieldset">
            <legend>{capsule.challengePrompt}</legend>
            <div className="choice-list">
              {capsule.choices.map((choice, index) => {
                const isSelected = choice.id === capsule.selectedChoiceId;
                const isCorrectSelection = isSelected && choice.correct;
                return (
                  <label
                    className={`choice-row ${isSelected ? "is-selected" : ""} ${isCorrectSelection ? "is-correct" : ""}`}
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
                      {isCorrectSelection ? "✓" : isSelected ? "•" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {selected ? (
            <div
              className={`answer-feedback ${selected.correct ? "is-correct" : "is-rethink"}`}
              aria-live="polite"
            >
              <strong>
                {selected.correct ? "That’s the best fit." : "Try another answer."}
              </strong>
              <p>{selected.feedback}</p>
            </div>
          ) : (
            <p className="choice-hint">
              Choose the move you would make in this situation.
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
          className="lesson-screen apply-screen"
          aria-labelledby="apply-title"
        >
          <header className="screen-heading">
            <p className="eyebrow">Try this next time</p>
            <h1 id="apply-title" ref={headingRef} tabIndex={-1}>
              Make the good choice easy to remember.
            </h1>
            <p>Use one clear cue, one response, and one sign that it worked.</p>
          </header>

          <div className="habit-card">
            <div className="habit-line">
              <span>When you notice…</span>
              <p>{capsule.practiceContract.cue}</p>
            </div>
            <div className="habit-line">
              <span>Do this…</span>
              <p>{capsule.practiceContract.response}</p>
            </div>
            <div className="habit-line">
              <span>You’ll know it worked when…</span>
              <p>{capsule.practiceContract.proof}</p>
            </div>
          </div>

          <p className="coach-note">{capsule.coachNote}</p>

          <label className="reminder-choice">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(event) => setReminderEnabled(event.target.checked)}
            />
            <span>
              <strong>
                Remind me in Ogram when a similar moment comes up
              </strong>
              <small>
                Ogram saves this reminder, not your task messages or files.
              </small>
            </span>
          </label>

          <footer className="screen-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => moveTo(1)}
            >
              ← Review my answer
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => onComplete(reminderEnabled)}
              disabled={completing}
            >
              {completing
                ? "Finishing…"
                : reminderEnabled
                  ? "Save reminder and finish"
                  : "Finish for today"}
              <span aria-hidden="true">→</span>
            </button>
          </footer>
        </section>
      ) : null}
    </article>
  );
}
