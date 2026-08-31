import { useEffect, useRef } from "react";
import type { ContextClaim, LearningBrief } from "../domain/experience";

interface ContextDockProps {
  claims: ContextClaim[];
  brief: LearningBrief;
  onReview: (claimId: string, decision: "accepted" | "rejected") => void;
}

const sourceLabels: Record<ContextClaim["source"], string> = {
  learner: "What you shared",
  codex_observation: "A pattern Codex noticed",
  ogram_profile: "Your Ogram preferences",
  ogram_pixel: "Your learning activity",
  ogram_journey: "A previous session",
};

const purposeLabels: Record<string, string> = {
  lesson_personalization: "tailor the lesson",
  transfer_prompt: "shape a real-work follow-through",
  example_selection: "choose relevant examples",
  lesson_duration: "set the session length",
  interaction_density: "set the amount of practice",
};

const sensitivityLabels: Record<ContextClaim["sensitivity"], string> = {
  low: "General context",
  personal: "Personal context",
  restricted: "Restricted context — include it only if you want it used here",
};

function describePurposes(claim: ContextClaim): string {
  const purposes = claim.allowedPurposes.map(
    (purpose) => purposeLabels[purpose] ?? purpose.replaceAll("_", " "),
  );
  if (purposes.length < 2) return purposes[0] ?? "shape this session";
  return `${purposes.slice(0, -1).join(", ")} and ${purposes.at(-1)}`;
}

export function ContextDock({ claims, brief, onReview }: ContextDockProps) {
  const pending = claims.filter((claim) => claim.review === "pending");
  const included = claims.filter(
    (claim) => claim.review === "accepted" || claim.review === "corrected",
  );
  const excluded = claims.filter((claim) => claim.review === "rejected");
  const currentClaim = pending[0];
  const claimRef = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    if (currentClaim) claimRef.current?.focus({ preventScroll: true });
  }, [currentClaim?.id]);

  if (currentClaim) {
    return (
      <section
        className="context-gate"
        id="context-dock"
        aria-labelledby="context-review-title"
        tabIndex={-1}
      >
        <div className="context-gate-copy">
          <p className="eyebrow">Before we prepare today&apos;s lesson</p>
          <h1 id="context-review-title">Can I use this information?</h1>
          <p className="context-intro">
            Review one detail at a time. Your choice changes what the session
            may use, and you can leave anything out.
          </p>

          <article className="pending-claim">
            <p className="claim-origin">{sourceLabels[currentClaim.source]}</p>
            <blockquote ref={claimRef} tabIndex={-1}>{currentClaim.summary}</blockquote>
            <div className="claim-permission">
              <p><strong>How it will be used</strong> To {describePurposes(currentClaim)}.</p>
              <p>{sensitivityLabels[currentClaim.sensitivity]}</p>
            </div>
            <div className="claim-actions" aria-label={`Review ${currentClaim.summary}`}>
              <button
                className="primary-action"
                type="button"
                onClick={() => onReview(currentClaim.id, "accepted")}
              >
                Use this
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="quiet-action"
                type="button"
                onClick={() => onReview(currentClaim.id, "rejected")}
              >
                Leave this out
              </button>
            </div>
          </article>

          <p className="review-progress" aria-live="polite">
            {pending.length === 1
              ? "Last detail to review"
              : `${pending.length} details left to review`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <details className="session-disclosure context-disclosure" id="context-dock">
      <summary>
        <span>Why this session</span>
        <small>{brief.estimatedMinutes} minutes, based on your reviewed context</small>
        <span className="disclosure-icon" aria-hidden="true">
          <span>+</span>
          <span>−</span>
        </span>
      </summary>
      <div className="disclosure-body">
        <div className="brief-sheet">
          <p className="eyebrow">Today&apos;s focus</p>
          <h2>{brief.desiredCapability}</h2>
          <p>{brief.whyNow}</p>
        </div>

        {included.length ? (
          <section className="reviewed-context" aria-labelledby="included-context-title">
            <h3 id="included-context-title">Information used for this session</h3>
            <ul>
              {included.map((claim) => (
                <li key={claim.id}>
                  <span>{sourceLabels[claim.source]}</span>
                  <div>
                    <p>{claim.summary}</p>
                    <small>
                      Used to {describePurposes(claim)} · {sensitivityLabels[claim.sensitivity]}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <details className="privacy-boundary">
          <summary>Privacy and learner control</summary>
          <p>
            Ogram uses only the details you reviewed and opaque source references.
            It does not pass raw conversations, files, prompts, or client material
            unless you separately select a source.
          </p>
          {excluded.length ? (
            <p>
              {excluded.length} {excluded.length === 1 ? "detail was" : "details were"}
              {" "}left out of this session.
            </p>
          ) : null}
        </details>
      </div>
    </details>
  );
}
