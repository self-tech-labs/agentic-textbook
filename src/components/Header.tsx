interface HeaderProps {
  webMcpSupported: boolean;
  toolCount: number;
  registering: boolean;
  simulationRunning: boolean;
  onReplay: () => void;
  onReset: () => void;
}

export function Header({
  webMcpSupported,
  toolCount,
  registering,
  simulationRunning,
  onReplay,
  onReset,
}: HeaderProps) {
  const status = registering
    ? "Registering tools"
    : `${toolCount} site tools ready`;

  return (
    <header className="topbar">
      <a className="wordmark" href="#top" aria-label="Ogram Practice Desk home">
        <span className="wordmark-mark" aria-hidden="true">
          O
        </span>
        <span>
          <strong>ogram</strong>
          <small>practice desk / local prototype</small>
        </span>
      </a>

      <div className="topbar-actions">
        <div
          className={`tool-status ${registering ? "is-preview" : "is-live"}`}
          title={
            webMcpSupported
              ? "Registered through document.modelContext"
              : "Tool definitions are ready. Use ChatGPT’s built-in browser or Chrome with WebMCP enabled to invoke them."
          }
        >
          <span className="status-light" aria-hidden="true" />
          {status}
        </div>
        <button className="text-button" type="button" onClick={onReset}>
          Reset
        </button>
        <button
          className="primary-button compact"
          type="button"
          onClick={onReplay}
          disabled={simulationRunning}
        >
          <span aria-hidden="true">↗</span>
          {simulationRunning ? "Codex is composing…" : "Replay agent build"}
        </button>
      </div>
    </header>
  );
}
