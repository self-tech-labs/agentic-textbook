import type {
  CompileResult,
  LearningExperienceDocument,
} from "../domain/experience";

interface DraftReviewProps {
  draft: LearningExperienceDocument;
  validation: CompileResult;
  publishing: boolean;
  onApprove: () => void;
}

export function DraftReview({
  draft,
  validation,
  publishing,
  onApprove,
}: DraftReviewProps) {
  const warnings = validation.diagnostics.filter(
    (item) => item.severity === "warning",
  ).length;
  const mechanisms = new Set(draft.nodes.map((node) => node.primitiveId));

  return (
    <section className="draft-review" id="draft-review" aria-labelledby="draft-review-title">
      <div className="review-signal" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="review-copy">
        <p className="overline">Codex composed a new experience</p>
        <h2 id="draft-review-title">{draft.metadata.title}</h2>
        <p>{draft.metadata.rationale}</p>
        <div className="review-facts">
          <span>revision {draft.draftRevision}</span>
          <span>{draft.nodes.length} nodes</span>
          <span>{mechanisms.size} mechanisms</span>
          <span>{warnings} warnings</span>
        </div>
      </div>
      <div className="review-consent">
        <p>
          Approval binds to <code>{validation.digest}</code>. Codex cannot click
          this for you.
        </p>
        <button type="button" onClick={onApprove} disabled={publishing}>
          {publishing ? "Publishing exact revision…" : "Approve & publish"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
