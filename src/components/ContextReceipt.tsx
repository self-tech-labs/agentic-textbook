import { useId } from "react";
import type {
  ContextReceipt as ContextReceiptRecord,
  ContextSource,
} from "../domain/types";

interface ContextReceiptProps {
  receipt: ContextReceiptRecord;
  compact?: boolean;
}

interface SourceView {
  source: ContextSource;
  label: string;
  used: string;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function ContextReceipt({
  receipt,
  compact = false,
}: ContextReceiptProps) {
  const headingId = useId();
  const completedJourneyEntries = receipt.learningJourney.filter(
    (entry) => entry.status === "completed",
  ).length;
  const assignedTraining = receipt.ogramContext.requiredTraining
    ? "1 assigned training"
    : "no assigned training";
  const sourceViews: SourceView[] = [
    {
      source: receipt.provenance.ogramContext,
      label: "Ogram context",
      used: `${receipt.ogramContext.roleGoals.length} role goal${receipt.ogramContext.roleGoals.length === 1 ? "" : "s"}, ${receipt.ogramContext.preferences.length} learning preference${receipt.ogramContext.preferences.length === 1 ? "" : "s"}, and ${assignedTraining}`,
    },
    {
      source: receipt.provenance.practiceSignals,
      label: "Codex review",
      used: `${receipt.practiceSignals.length} sanitized behavioural signal${receipt.practiceSignals.length === 1 ? "" : "s"}`,
    },
    {
      source: receipt.provenance.learningJourney,
      label: "Learning journey",
      used: `${receipt.learningJourney.length} journey entr${receipt.learningJourney.length === 1 ? "y" : "ies"}, including ${completedJourneyEntries} completed`,
    },
  ];
  const environmentLabel =
    receipt.environment === "production"
      ? "Production context"
      : "Synthetic demonstration";

  return (
    <section
      className={`context-receipt is-${receipt.environment} ${compact ? "is-compact" : ""}`}
      aria-labelledby={headingId}
    >
      <header className="context-receipt__ribbon">
        <div className="context-receipt__heading">
          <p className="context-receipt__eyebrow">Context receipt</p>
          <h2 id={headingId}>What shaped this capsule</h2>
        </div>
        <span
          className={`context-receipt__environment is-${receipt.environment}`}
        >
          {environmentLabel}
        </span>
      </header>

      <div className="context-receipt__source-ribbon" aria-label="Context sources">
        {sourceViews.map(({ source, label }, index) => (
          <span className="context-receipt__source-mark" key={source.kind}>
            <span className="context-receipt__source-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{label}</span>
          </span>
        ))}
      </div>

      <details className="context-receipt__details">
        <summary>Inspect context provenance</summary>

        <dl className="context-receipt__metadata">
          <div>
            <dt>Receipt</dt>
            <dd>
              <code>{receipt.receiptId}</code>
            </dd>
          </div>
          <div>
            <dt>Schema</dt>
            <dd>v{receipt.schemaVersion}</dd>
          </div>
          <div>
            <dt>Assembled</dt>
            <dd>
              <time dateTime={receipt.assembledAt}>
                {formatTimestamp(receipt.assembledAt)}
              </time>
            </dd>
          </div>
        </dl>

        <ol className="context-receipt__sources">
          {sourceViews.map(({ source, label, used }, index) => (
            <li className="context-source" key={source.kind}>
              <span className="context-source__index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="context-source__body">
                <h3>{label}</h3>
                <p className="context-source__used">Used: {used}.</p>
                <dl className="context-source__metadata">
                  <div>
                    <dt>Captured</dt>
                    <dd>
                      <time dateTime={source.capturedAt}>
                        {formatTimestamp(source.capturedAt)}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>
                      <code>{source.version}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Provenance ID</dt>
                    <dd>
                      <code>{source.provenanceId}</code>
                    </dd>
                  </div>
                </dl>
              </div>
            </li>
          ))}
        </ol>

        <div className="context-receipt__boundary">
          <div className="context-receipt__used-summary">
            <h3>Used</h3>
            <p>
              Role and learning preferences, sanitized behavioural patterns,
              assigned training, and prior learning progress.
            </p>
          </div>
          <div className="context-receipt__excluded-summary">
            <h3>Excluded</h3>
            <p>
              Raw Codex prompts and responses, task titles, file contents,
              file paths, credentials, and client content.
            </p>
          </div>
        </div>

        <div className="context-receipt__privacy-boundary">
          <h3>Privacy boundary</h3>
          <p>{receipt.ogramContext.privacyBoundary}</p>
        </div>
      </details>
    </section>
  );
}
