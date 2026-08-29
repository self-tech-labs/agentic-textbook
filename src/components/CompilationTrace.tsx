interface CompilationTraceProps {
  sourceCount: number;
  signalCount: number;
  capsuleReady: boolean;
  eventCount: number;
  deliveryStatus: "ready" | "queued" | "syncing" | "synced" | "error";
}

const statusLabel = {
  ready: "Recorder ready",
  queued: "Queued for Ogram",
  syncing: "Writing to Ogram",
  synced: "Recorded by Ogram",
  error: "Retry required",
} as const;

export function CompilationTrace({
  sourceCount,
  signalCount,
  capsuleReady,
  eventCount,
  deliveryStatus,
}: CompilationTraceProps) {
  return (
    <nav className="compilation-trace" aria-label="Learning capsule pipeline">
      <ol>
        <li className="trace-stage is-complete">
          <span className="trace-index">01</span>
          <span className="trace-copy">
            <strong>Gather context</strong>
            <small>{sourceCount} declared sources</small>
          </span>
          <span className="trace-status" aria-hidden="true">●</span>
        </li>
        <li className={`trace-stage ${capsuleReady ? "is-complete" : "is-active"}`}>
          <span className="trace-index">02</span>
          <span className="trace-copy">
            <strong>Compile practice</strong>
            <small>
              {signalCount > 0
                ? `${signalCount} pattern${signalCount === 1 ? "" : "s"} → one capsule`
                : "Waiting for a pattern review"}
            </small>
          </span>
          <span className="trace-status" aria-hidden="true">●</span>
        </li>
        <li className={`trace-stage is-${deliveryStatus}`}>
          <span className="trace-index">03</span>
          <span className="trace-copy">
            <strong>Record proof</strong>
            <small>{eventCount} ledger events · {statusLabel[deliveryStatus]}</small>
          </span>
          <span className="trace-status" aria-hidden="true">●</span>
        </li>
      </ol>
    </nav>
  );
}
