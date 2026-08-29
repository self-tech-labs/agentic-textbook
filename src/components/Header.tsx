import type { LearningState } from "../domain/types";

interface HeaderProps {
  webMcpSupported: boolean;
  toolCount: number;
  registeredCount: number;
  registering: boolean;
  webMcpError: string | null;
  contextEnvironment: "synthetic" | "production";
  journeySync: LearningState["journeySync"];
  simulationRunning: boolean;
  onReplay: () => void;
  onRetrySync: () => void;
}

export function Header({
  webMcpSupported,
  toolCount,
  registeredCount,
  registering,
  webMcpError,
  contextEnvironment,
  journeySync,
  simulationRunning,
  onReplay,
  onRetrySync,
}: HeaderProps) {
  const toolStatus = !webMcpSupported
    ? "API unavailable"
    : registering
      ? `Connecting ${registeredCount}/${toolCount}`
      : `${registeredCount}/${toolCount} live`;
  const recorderStatus =
    journeySync.status === "synced"
      ? "Synced"
      : journeySync.status === "syncing"
        ? "Writing"
        : journeySync.status === "error"
          ? "Needs retry"
          : journeySync.pendingCount > 0
            ? `${journeySync.pendingCount} queued`
            : "Ready";

  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Ogram Learning Ledger home">
        <span>ogram</span>
        <small>learning ledger</small>
      </a>

      <div className="system-status" aria-label="System status">
        <span className="system-status__item">
          <small>Context</small>
          <strong>{contextEnvironment}</strong>
        </span>
        <span className="system-status__item">
          <small>WebMCP</small>
          <strong>{toolStatus}</strong>
        </span>
        <span className={`system-status__item is-${journeySync.status}`}>
          <small>Journey</small>
          <strong>{recorderStatus}</strong>
        </span>
      </div>

      <details className="system-inspector">
        <summary>Inspect system</summary>
        <div className="system-inspector__panel">
          <div className="inspector-kicker">
            <span className="status-light is-synced" aria-hidden="true" />
            <span>Context → capsule → proof</span>
          </div>
          <h2>The page is the instrument. Ogram is the memory.</h2>
          <p>
            Codex can compile this visible practice through {toolCount} bounded
            site tools. Learner decisions remain human-only. Every state change
            enters the append-only journey outbox.
          </p>
          <dl className="inspector-facts">
            <div>
              <dt>Site tools</dt>
              <dd>{webMcpError ?? toolStatus}</dd>
            </div>
            <div>
              <dt>Recorder</dt>
              <dd>{journeySync.detail}</dd>
            </div>
          </dl>
          <div className="inspector-actions">
            <button
              className="rebuild-button"
              type="button"
              onClick={onReplay}
              disabled={simulationRunning}
            >
              {simulationRunning ? "Compiling live…" : "Run the live build"}
              <span aria-hidden="true">↗</span>
            </button>
            {journeySync.status === "error" || journeySync.pendingCount > 0 ? (
              <button className="text-button" type="button" onClick={onRetrySync}>
                Retry ledger sync
              </button>
            ) : null}
          </div>
        </div>
      </details>
    </header>
  );
}
