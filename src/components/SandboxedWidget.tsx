import { useEffect, useMemo, useRef, useState } from "react";
import type { RegionContent } from "../domain/agentCanvas";

type WidgetContent = Extract<RegionContent, { type: "sandbox_widget" }>;

function escapeMarkup(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createSource(widget: WidgetContent): string {
  const css = widget.css.replaceAll("</style", "<\\/style");
  const javascript = widget.javascript.replaceAll("</script", "<\\/script");
  const widgetId = JSON.stringify(widget.widgetId);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; media-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; form-action 'none'; navigate-to 'none'; base-uri 'none';" />
    <title>${escapeMarkup(widget.title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, sans-serif;
        --canvas-ink: #171914;
        --canvas-muted: #6c6e65;
        --canvas-paper: #fbfaf5;
        --canvas-green: #174b38;
        --canvas-lime: #b7f313;
      }
      * { box-sizing: border-box; }
      html, body { width: 100%; height: auto; min-height: 0; margin: 0; overflow: hidden; }
      body { color: var(--canvas-ink); background: var(--canvas-paper); }
      img, svg, canvas, video { display: block; max-width: 100%; }
      button, input, select { font: inherit; }
      :focus-visible { outline: 3px solid #28624d; outline-offset: 3px; }
      ${css}
    </style>
  </head>
  <body>
    ${widget.html}
    <script>
      (() => {
        const widgetId = ${widgetId};
        const send = (type, payload = {}) => parent.postMessage({
          channel: 'learn-ogram-widget-v3', widgetId, type, ...payload
        }, '*');
        window.learnOgram = Object.freeze({
          emit: (name, value) => send('interaction', { name: String(name), value }),
          resize: (height) => send('resize', { height: Number(height) })
        });
        window.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') send('escape');
        });
        document.addEventListener('click', (event) => {
          if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
        }, true);
        document.addEventListener('submit', (event) => event.preventDefault(), true);
        const reportHeight = () => send('resize', {
          height: Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
        });
        if ('ResizeObserver' in window) {
          const resizeObserver = new ResizeObserver(reportHeight);
          resizeObserver.observe(document.body);
        }
        try {
          ${javascript}
          requestAnimationFrame(reportHeight);
          send('ready');
        } catch (error) {
          send('error', { message: error instanceof Error ? error.message : 'Widget failed to start.' });
        }
      })();
    </script>
  </body>
</html>`;
}

export function SandboxedWidget({ widget }: { widget: WidgetContent }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed" | "stopped">(
    "loading",
  );
  const [height, setHeight] = useState(widget.height);
  const [announcement, setAnnouncement] = useState("");
  const source = useMemo(() => createSource(widget), [widget]);

  useEffect(() => {
    if (status === "stopped") return;
    setStatus("loading");
    const timeout = window.setTimeout(() => setStatus("failed"), 2_000);
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        data.channel !== "learn-ogram-widget-v3" ||
        data.widgetId !== widget.widgetId
      ) {
        return;
      }
      if (data.type === "ready") {
        window.clearTimeout(timeout);
        setStatus("ready");
      } else if (data.type === "error") {
        window.clearTimeout(timeout);
        setStatus("failed");
      } else if (data.type === "resize" && Number.isFinite(data.height)) {
        setHeight(Math.min(720, Math.max(180, Math.round(data.height))));
      } else if (data.type === "interaction" && typeof data.name === "string") {
        setAnnouncement(`Interaction updated: ${data.name}.`);
      } else if (data.type === "escape") {
        stopRef.current?.focus();
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [reloadKey, status === "stopped", widget.widgetId]);

  const reset = () => {
    setHeight(widget.height);
    setStatus("loading");
    setReloadKey((value) => value + 1);
  };

  return (
    <section className="sandbox-card" aria-labelledby={`${widget.widgetId}-title`}>
      <header className="sandbox-card__header">
        <div>
          <span className="eyebrow">Interactive model · sandboxed</span>
          <h4 id={`${widget.widgetId}-title`}>{widget.title}</h4>
        </div>
        <div className="sandbox-card__controls">
          <button type="button" className="text-button" onClick={reset}>
            Reset
          </button>
          <button
            ref={stopRef}
            type="button"
            className="text-button"
            onClick={() => setStatus("stopped")}
          >
            Stop
          </button>
        </div>
      </header>

      {status === "failed" || status === "stopped" ? (
        <div className="sandbox-fallback" role="status">
          <strong>{status === "failed" ? "The interaction did not start." : "Interaction stopped."}</strong>
          <p>{widget.accessibleSummary}</p>
          <button type="button" className="secondary-button" onClick={reset}>
            Start again
          </button>
        </div>
      ) : (
        <div className="sandbox-frame-wrap" aria-busy={status === "loading"}>
          {status === "loading" ? (
            <span className="sandbox-loading" role="status">
              Preparing interaction…
            </span>
          ) : null}
          <iframe
            key={reloadKey}
            ref={iframeRef}
            className="sandbox-frame"
            title={widget.title}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={source}
            style={{ height }}
          />
        </div>
      )}
      <details className="text-alternative">
        <summary>Text alternative</summary>
        <p>{widget.accessibleSummary}</p>
      </details>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
