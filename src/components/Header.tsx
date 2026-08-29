interface HeaderProps {
  webMcpSupported: boolean;
  toolCount: number;
  registering: boolean;
  simulationRunning: boolean;
  onReplay: () => void;
}

export function Header({
  webMcpSupported,
  toolCount,
  registering,
  simulationRunning,
  onReplay,
}: HeaderProps) {
  const status = registering ? "Connecting" : `${toolCount} tools ready`;

  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Ogram Practice home">
        ogram
      </a>

      <div className="header-actions">
        <div
          className={`tool-status ${registering ? "is-preview" : "is-live"}`}
          role="status"
          aria-live="polite"
          title={
            webMcpSupported
              ? "Registered through document.modelContext"
              : "Tool definitions are ready. Use ChatGPT’s built-in browser or Chrome with WebMCP enabled to invoke them."
          }
        >
          <span className="status-light" aria-hidden="true" />
          <span>{status}</span>
        </div>
        <button
          className="rebuild-button"
          type="button"
          onClick={onReplay}
          disabled={simulationRunning}
        >
          {simulationRunning ? "Codex is composing…" : "Rebuild with Codex"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </header>
  );
}
