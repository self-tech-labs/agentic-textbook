import type { PracticeSignal } from "../domain/types";

interface SignalBoardProps {
  signals: PracticeSignal[];
}

const signalGlyph: Record<PracticeSignal["id"], string> = {
  thread_hygiene: "⑂",
  workspace_hygiene: "⌂",
  effort_fit: "↯",
  task_shaping: "◇",
};

export function SignalBoard({ signals }: SignalBoardProps) {
  return (
    <section className="signal-board" id="evidence-signals">
      <div className="section-heading">
        <div>
          <p className="muted-label">Evidence signals</p>
          <h2>What the agent noticed</h2>
        </div>
        <p className="section-note">
          Behaviour only · no task text stored
          <span className="privacy-dot" aria-hidden="true" />
        </p>
      </div>

      <div className="signal-grid">
        {signals.map((signal, index) => (
          <article className={`signal-card level-${signal.level}`} key={signal.id}>
            <div className="signal-card-top">
              <span className="signal-index">0{index + 1}</span>
              <span className="signal-glyph" aria-hidden="true">
                {signalGlyph[signal.id]}
              </span>
              <span className="signal-level">{signal.level}</span>
            </div>
            <h3>{signal.label}</h3>
            <p>{signal.evidence}</p>
            <div className="confidence-row">
              <span>confidence</span>
              <div className="confidence-track" aria-hidden="true">
                <i style={{ width: `${Math.round(signal.confidence * 100)}%` }} />
              </div>
              <strong>{Math.round(signal.confidence * 100)}%</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
