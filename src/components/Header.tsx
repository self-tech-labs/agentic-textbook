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
  const status = registering
    ? "Connecting the learning tools…"
    : webMcpSupported
      ? `${toolCount} WebMCP tools connected`
      : `${toolCount} WebMCP tools available in a supported browser`;

  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Ogram Learn home">
        ogram
      </a>
      <span className="product-name">Daily practice</span>

      <details className="demo-controls">
        <summary>About this demo</summary>
        <div className="demo-panel">
          <div className="demo-status" role="status" aria-live="polite">
            <span
              className={`status-light ${webMcpSupported ? "is-synced" : "is-ready"}`}
              aria-hidden="true"
            />
            <span>{status}</span>
          </div>
          <p>
            Codex can shape this lesson through a small set of page-owned tools.
            The learner’s answers and completion stay in the page.
          </p>
          <button
            className="rebuild-button"
            type="button"
            onClick={onReplay}
            disabled={simulationRunning}
          >
            {simulationRunning ? "Creating an example…" : "Create a fresh example"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </details>
    </header>
  );
}
