import type { LearningCanvasState } from "../domain/experience";
import { primitiveRegistry } from "../domain/primitiveRegistry";

interface CanvasInspectorProps {
  state: LearningCanvasState;
  toolCount: number;
  webMcpSupported: boolean;
}

const actorLabels = {
  agent: "Agent",
  learner: "You",
  ogram: "Ogram",
} as const;

export function CanvasInspector({
  state,
  toolCount,
  webMcpSupported,
}: CanvasInspectorProps) {
  const validation = state.design.validation;
  const diagnostics = validation?.diagnostics ?? [];
  const errors = diagnostics.filter((item) => item.severity === "error");
  const warnings = diagnostics.filter((item) => item.severity === "warning");
  const inspected = state.design.draft ?? state.activeExperience;
  const usedPrimitives = Array.from(
    new Set(inspected.nodes.map((node) => node.primitiveId)),
  );

  return (
    <aside className="canvas-inspector" aria-label="Compiler and learning ledger">
      <section className="inspector-section" id="compiler-inspector">
        <header className="dock-heading">
          <p className="overline">03 · Ogram compiler</p>
          <span className={`compiler-light ${validation?.valid ? "is-valid" : ""}`}>
            {validation?.valid ? "passes" : state.design.status.replace("_", " ")}
          </span>
        </header>

        <div className="compile-score">
          <div>
            <strong>{errors.length}</strong>
            <span>hard errors</span>
          </div>
          <div>
            <strong>{warnings.length}</strong>
            <span>warnings</span>
          </div>
          <div>
            <strong>{inspected.nodes.length}</strong>
            <span>nodes</span>
          </div>
        </div>

        <div className="digest-line">
          <span>compiled digest</span>
          <code>{validation?.digest ?? "awaiting validation"}</code>
        </div>

        {diagnostics.length > 0 ? (
          <div className="diagnostic-list">
            {diagnostics.slice(0, 5).map((item) => (
              <article className={`diagnostic is-${item.severity}`} key={`${item.ruleId}-${item.path}`}>
                <span>{item.severity}</span>
                <p>{item.explanation}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-inspector">No compiler diagnostics for this revision.</p>
        )}

        <details className="primitive-manifest">
          <summary>{usedPrimitives.length} mechanisms in this experience</summary>
          <ul>
            {usedPrimitives.map((primitiveId) => (
              <li key={primitiveId}>
                <code>{primitiveId}</code>
                <span>
                  {primitiveRegistry[primitiveId]?.mechanism ??
                    "Legacy mechanism from a newer saved canvas revision."}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="inspector-section ledger-section" id="journey-ledger">
        <header className="dock-heading">
          <p className="overline">04 · Journey ledger</p>
          <span className="dock-counter">{state.events.length} events</span>
        </header>
        <div className="ledger-list">
          {state.events
            .slice(-8)
            .reverse()
            .map((event) => (
              <article className="ledger-event" key={event.id}>
                <span className={`ledger-actor actor-${event.actor}`}>
                  {actorLabels[event.actor]}
                </span>
                <div>
                  <p>{event.summary}</p>
                  <small>
                    #{event.sequence} · {event.type}
                  </small>
                </div>
              </article>
            ))}
        </div>
        <div className="webmcp-route">
          <span className={webMcpSupported ? "is-native" : ""} aria-hidden="true" />
          <p>
            <strong>{toolCount} WebMCP tools</strong>
            {webMcpSupported
              ? "Native page bridge active"
              : "Contract ready in local preview"}
          </p>
        </div>
      </section>
    </aside>
  );
}
