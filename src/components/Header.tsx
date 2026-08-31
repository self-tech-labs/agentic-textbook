interface HeaderProps {
  title: string;
  detailsOpen: boolean;
  onOpenDetails: () => void;
}

export function Header({ title, detailsOpen, onOpenDetails }: HeaderProps) {
  return (
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Ogram Learning Canvas home">
        ogram
      </a>
      <p className="header-session-title">{title}</p>
      <button
        className="header-details-link"
        id="session-details-trigger"
        type="button"
        aria-expanded={detailsOpen}
        aria-controls="session-details"
        onClick={onOpenDetails}
      >
        About this session
      </button>
    </header>
  );
}
