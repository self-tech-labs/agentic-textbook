import type { JourneyEntry } from "../domain/types";

interface JourneyLedgerProps {
  entries: JourneyEntry[];
  compact?: boolean;
}

function statusCopy(entry: JourneyEntry): string {
  if (entry.status === "today") return "In practice";
  if (entry.status === "queued") return "Next signal";
  if (entry.proofStatus === "awaiting") return "Awaiting observation";
  if (entry.proofStatus === "observed") return "Habit observed";
  return "Proof confirmed";
}

export function JourneyLedger({ entries, compact = false }: JourneyLedgerProps) {
  return (
    <section
      className={`journey-ledger ${compact ? "is-compact" : ""}`}
      id="learning-journey"
      aria-labelledby="journey-ledger-title"
    >
      <header className="ledger-heading">
        <p className="eyebrow">The learning thread</p>
        <h2 id="journey-ledger-title">Practice becomes evidence.</h2>
        <p>
          Every capsule leaves a small, inspectable record. Ogram uses proof—not
          course completion—to choose what comes next.
        </p>
      </header>

      <ol className="ledger-list">
        {entries.map((entry, index) => (
          <li className={`ledger-entry is-${entry.status}`} key={entry.id}>
            <div className="ledger-node" aria-hidden="true">
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="ledger-entry-copy">
              <span className="ledger-date">{entry.dateLabel}</span>
              <strong>{entry.title}</strong>
              <small>{entry.proof ?? statusCopy(entry)}</small>
            </div>
            <span className="ledger-state">{statusCopy(entry)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
