interface HeaderProps {
  webMcpSupported: boolean;
  toolCount: number;
  registering: boolean;
  composing: boolean;
  onCompose: () => void;
}

export function Header({
  webMcpSupported,
  toolCount,
  registering,
  composing,
  onCompose,
}: HeaderProps) {
  const status = registering
    ? "Connecting canvas"
    : webMcpSupported
      ? `WebMCP live · ${toolCount}`
      : `WebMCP contract · ${toolCount}`;

  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Ogram Learning Canvas home">
        <span>ogram</span>
        <i>learning canvas</i>
      </a>

      <div className="header-thesis" aria-hidden="true">
        <span>agent authors</span>
        <b>→</b>
        <span>ogram governs</span>
        <b>→</b>
        <span>learner acts</span>
      </div>

      <div className="header-actions">
        <div className={`tool-status ${webMcpSupported ? "is-native" : ""}`} role="status">
          <span className="status-light" aria-hidden="true" />
          <span>{status}</span>
        </div>
        <button
          className="compose-button"
          type="button"
          onClick={onCompose}
          disabled={composing}
        >
          <span className="compose-spark" aria-hidden="true">✦</span>
          {composing ? "Codex is composing…" : "Compose another experience"}
        </button>
      </div>
    </header>
  );
}
