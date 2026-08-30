import type {
  ContextClaim,
  LearningBrief,
} from "../domain/experience";

interface ContextDockProps {
  claims: ContextClaim[];
  brief: LearningBrief;
  onReview: (claimId: string, decision: "accepted" | "rejected") => void;
}

const sourceLabels: Record<ContextClaim["source"], string> = {
  learner: "You said",
  codex_observation: "Codex noticed",
  ogram_profile: "Ogram knows",
  ogram_pixel: "Ogram pixel",
  ogram_journey: "Journey evidence",
};

export function ContextDock({ claims, brief, onReview }: ContextDockProps) {
  const pendingCount = claims.filter((claim) => claim.review === "pending").length;

  return (
    <aside className="context-dock" id="context-dock" aria-label="Learning context">
      <header className="dock-heading">
        <p className="overline">01 · Context broker</p>
        <span className="dock-counter">{pendingCount ? `${pendingCount} to review` : "reviewed"}</span>
      </header>

      <section className="brief-sheet">
        <p className="brief-label">Desired capability</p>
        <h2>{brief.desiredCapability}</h2>
        <p className="brief-why">{brief.whyNow}</p>
        <div className="brief-meta">
          <span>{brief.estimatedMinutes} min</span>
          <span>{brief.locale}</span>
          <span>v{brief.version}</span>
        </div>
      </section>

      <div className="claim-stack">
        {claims.map((claim) => (
          <article
            className={`context-claim is-${claim.review}`}
            key={claim.id}
          >
            <div className="claim-source-row">
              <span className={`source-glyph source-${claim.source}`} aria-hidden="true" />
              <p>{sourceLabels[claim.source]}</p>
              <span className="claim-review-state">
                {claim.review === "accepted"
                  ? "included"
                  : claim.review === "rejected"
                    ? "excluded"
                    : "hypothesis"}
              </span>
            </div>
            <p className="claim-summary">{claim.summary}</p>
            {claim.confidence !== undefined ? (
              <p className="claim-confidence">
                {Math.round(claim.confidence * 100)}% confidence · expires
              </p>
            ) : null}
            {claim.review === "pending" ? (
              <div className="claim-actions" aria-label={`Review ${claim.summary}`}>
                <button type="button" onClick={() => onReview(claim.id, "accepted")}>
                  Use this
                </button>
                <button type="button" onClick={() => onReview(claim.id, "rejected")}>
                  Exclude
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <details className="privacy-boundary">
        <summary>What crosses the boundary?</summary>
        <p>
          Reviewed claims and opaque source references. Never raw conversations,
          files, prompts, or client material unless you separately select a source.
        </p>
      </details>
    </aside>
  );
}
