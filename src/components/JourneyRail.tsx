import type { JourneyEntry, OgramInjectedContext } from "../domain/types";

interface JourneyRailProps {
  learner: OgramInjectedContext["learner"];
  journey: JourneyEntry[];
  assignedTraining: OgramInjectedContext["requiredTraining"];
}

function statusLabel(status: JourneyEntry["status"]): string {
  if (status === "completed") return "done";
  if (status === "today") return "now";
  return "next";
}

export function JourneyRail({
  learner,
  journey,
  assignedTraining,
}: JourneyRailProps) {
  return (
    <aside className="left-rail" aria-label="Learning journey">
      <section className="learner-card">
        <p className="muted-label">Learning profile · mock</p>
        <div className="avatar" aria-hidden="true">
          LM
        </div>
        <h2>{learner.displayName}</h2>
        <p>{learner.role}</p>
        <small>{learner.organisation}</small>
      </section>

      <section className="journey-section" id="learning-journey">
        <div className="section-heading compact-heading">
          <p className="muted-label">Your learning trace</p>
          <span>{journey.filter((item) => item.status === "completed").length}/4</span>
        </div>
        <ol className="journey-list">
          {journey.map((item, index) => (
            <li className={`journey-item is-${item.status}`} key={item.id}>
              <div className="journey-marker" aria-hidden="true">
                {item.status === "completed" ? "✓" : index + 1}
              </div>
              <div>
                <div className="journey-meta">
                  <span>{item.dateLabel}</span>
                  <span>{statusLabel(item.status)}</span>
                </div>
                <strong>{item.title}</strong>
                {item.proof ? <p>{item.proof}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {assignedTraining ? (
        <section className="assigned-card">
          <div className="assigned-icon" aria-hidden="true">
            !
          </div>
          <div>
            <p className="muted-label">Firm-assigned</p>
            <strong>{assignedTraining.title}</strong>
            <span>{assignedTraining.dueLabel}</span>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
