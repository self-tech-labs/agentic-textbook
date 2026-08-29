import { learningDeepLink } from "../lib/desktopBridge";
import type {
  LearningEvent,
  LearningState,
  OgramInjectedContext,
} from "../domain/types";

interface ContextRailProps {
  context: OgramInjectedContext;
  events: LearningEvent[];
  desktopBridge: LearningState["desktopBridge"];
  capsuleId: string;
  webMcpSupported: boolean;
}

function actorLabel(actor: LearningEvent["actor"]): string {
  if (actor === "codex") return "C";
  if (actor === "learner") return "L";
  return "O";
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ContextRail({
  context,
  events,
  desktopBridge,
  capsuleId,
  webMcpSupported,
}: ContextRailProps) {
  const recentEvents = events.slice(-5).reverse();

  return (
    <aside className="right-rail" aria-label="Context and activity">
      <section className="context-card">
        <div className="context-card-heading">
          <div className="source-chip source-ogram">
            <span aria-hidden="true">◎</span> {context.sourceLabel}
          </div>
          <span className="mock-badge">synthetic</span>
        </div>
        <h2>Context the task history can’t know.</h2>
        <ul className="goal-list">
          {context.roleGoals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
        <details>
          <summary>Workshop notes</summary>
          <ul>
            {context.workshopNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="privacy-card">
        <div className="privacy-icon" aria-hidden="true">
          ◉
        </div>
        <div>
          <p className="muted-label">Consent boundary</p>
          <p>{context.privacyBoundary}</p>
        </div>
      </section>

      <section className="desktop-card" id="desktop-loop">
        <div className="section-heading compact-heading">
          <p className="muted-label">Ogram desktop loop</p>
          <span className={`bridge-state is-${desktopBridge.status}`}>
            {desktopBridge.status}
          </span>
        </div>
        <div className="loop-graphic" aria-hidden="true">
          <span>notice</span>
          <i>→</i>
          <span>practice</span>
          <i>→</i>
          <span>prove</span>
        </div>
        <p>{desktopBridge.detail}</p>
        <a className="deep-link" href={learningDeepLink(capsuleId)}>
          Open this capsule in Ogram <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="trace-card">
        <div className="section-heading compact-heading">
          <p className="muted-label">Live collaboration trace</p>
          <span className={webMcpSupported ? "trace-live" : "trace-ready"}>
            {webMcpSupported ? "WebMCP" : "site tools"}
          </span>
        </div>
        <ol className="event-list">
          {recentEvents.map((event) => (
            <li key={event.id}>
              <span className={`actor actor-${event.actor}`} aria-hidden="true">
                {actorLabel(event.actor)}
              </span>
              <div>
                <p>{event.summary}</p>
                <time dateTime={event.at}>{timeLabel(event.at)}</time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
