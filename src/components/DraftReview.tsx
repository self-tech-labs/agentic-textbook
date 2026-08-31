import type {
  LearningExperienceDocument,
} from "../domain/experience";

interface DraftReviewProps {
  draft: LearningExperienceDocument;
  publishing: boolean;
  retrying: boolean;
  onApprove: () => void;
}

export function DraftReview({
  draft,
  publishing,
  retrying,
  onApprove,
}: DraftReviewProps) {
  const outcomes = draft.objectives.flatMap((objective) =>
    objective.successCriteria.slice(0, 2),
  );

  return (
    <section
      className="draft-review"
      id="draft-review"
      aria-labelledby="draft-review-title"
      tabIndex={-1}
    >
      <div className="proposal-mark" aria-hidden="true">
        <span />
      </div>
      <div className="review-copy">
        <p className="eyebrow">Your next session is ready</p>
        <h1 id="draft-review-title">{draft.metadata.title}</h1>
        <p className="proposal-rationale">{draft.metadata.rationale}</p>
        <p className="proposal-meta">
          <span>{draft.metadata.estimatedMinutes} minutes</span>
          <span>Tailored to your reviewed context</span>
        </p>

        {outcomes.length ? (
          <details className="proposal-outline">
            <summary>What you will practise</summary>
            <ul>
              {outcomes.map((outcome) => (
                <li key={outcome}>{outcome}</li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="review-consent">
          <button type="button" onClick={onApprove} disabled={publishing}>
            {publishing
              ? "Starting your session…"
              : retrying
                ? "Try starting again"
                : "Start this session"}
          <span aria-hidden="true">→</span>
          </button>
          <p>
            When you start, you approve this version of the session. If you
            want to change the topic, examples, or level, ask Codex before you
            begin.
          </p>
        </div>
      </div>
    </section>
  );
}
