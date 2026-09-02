import { useEffect, useRef, useState } from "react";
import type {
  CodeExecutionEvidence,
  CodeLabExerciseRef,
} from "../../domain/agentCanvas";
import { LESSON_LIMITS } from "../../domain/lessonRegistry";
import { runCodeExercise, type CodeRunResult } from "../../lib/learningService";

export default function CodeLab({
  interaction,
  onSubmit,
}: {
  interaction: CodeLabExerciseRef;
  onSubmit: (source: string, evidence: CodeExecutionEvidence) => void;
}) {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(interaction.starterCode);
  const [source, setSource] = useState(interaction.starterCode);
  const [editorFailed, setEditorFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodeRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const host = editorHostRef.current;
    if (!host) return;
    let active = true;
    let destroy = () => {};

    void Promise.all([
      import("@codemirror/state"),
      import("@codemirror/view"),
      interaction.language === "python"
        ? import("@codemirror/lang-python")
        : import("@codemirror/lang-javascript"),
    ])
      .then(([stateModule, viewModule, languageModule]) => {
        if (!active) return;
        const language =
          interaction.language === "python"
            ? (languageModule as typeof import("@codemirror/lang-python")).python()
            : (languageModule as typeof import("@codemirror/lang-javascript")).javascript({
                typescript: interaction.language === "typescript",
              });
        const editorState = stateModule.EditorState.create({
          doc: sourceRef.current,
          extensions: [
            language,
            viewModule.EditorView.lineWrapping,
            viewModule.EditorView.theme({
              "&": {
                minHeight: "260px",
                backgroundColor: "#171815",
                color: "#f4efe6",
                fontSize: "14px",
              },
              ".cm-content": {
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                padding: "18px 0",
              },
              ".cm-gutters": {
                backgroundColor: "#171815",
                color: "#80796d",
                border: "none",
              },
              ".cm-activeLine, .cm-activeLineGutter": {
                backgroundColor: "#24251f",
              },
              "&.cm-focused": { outline: "2px solid #b7c9a9" },
            }),
            viewModule.EditorView.updateListener.of((update) => {
              if (!update.docChanged) return;
              const nextSource = update.state.doc.toString();
              sourceRef.current = nextSource;
              setSource(nextSource);
              setResult(null);
              setError(null);
            }),
          ],
        });
        const editor = new viewModule.EditorView({ state: editorState, parent: host });
        destroy = () => editor.destroy();
      })
      .catch(() => {
        if (active) setEditorFailed(true);
      });

    return () => {
      active = false;
      destroy();
    };
  }, [interaction.language]);

  const run = async () => {
    const byteLength = new TextEncoder().encode(sourceRef.current).byteLength;
    if (byteLength > LESSON_LIMITS.codeBytes) {
      setError("Source cannot exceed 32 KB.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await runCodeExercise({
          exerciseId: interaction.exerciseId,
          language: interaction.language,
          source: sourceRef.current,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The isolated code runner is unavailable.",
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="code-lab">
      <div className="code-lab__meta">
        <span>{interaction.language}</span>
        <span>
          {new TextEncoder().encode(source).byteLength.toLocaleString()} /{" "}
          {LESSON_LIMITS.codeBytes.toLocaleString()} bytes
        </span>
      </div>
      {editorFailed ? (
        <label className="reflection-field">
          <span>Code editor fallback</span>
          <textarea
            rows={12}
            spellCheck={false}
            value={source}
            onChange={(event) => {
              sourceRef.current = event.target.value;
              setSource(event.target.value);
              setResult(null);
            }}
          />
        </label>
      ) : (
        <div
          ref={editorHostRef}
          className="code-lab__editor"
          aria-label={interaction.language + " code editor"}
        />
      )}
      <details>
        <summary>Visible tests</summary>
        <ul>
          {interaction.visibleTests.map((test) => (
            <li key={test}>
              <code>{test}</code>
            </li>
          ))}
        </ul>
      </details>
      <div className="code-lab__actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => void run()}
          disabled={running || !source.trim()}
        >
          {running ? "Running securely…" : "Run tests"}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!result}
          onClick={() => {
            if (result) onSubmit(sourceRef.current, result.evidence);
          }}
        >
          Submit test evidence
        </button>
      </div>
      {result ? (
        <div
          className={
            result.evidence.status === "passed"
              ? "code-result code-result--passed"
              : "code-result"
          }
          role="status"
        >
          <strong>
            {result.evidence.passedTests} of {result.evidence.totalTests} tests passed
          </strong>
          <span>
            {result.durationMs} ms · {result.sandboxState} sandbox
          </span>
          {result.stdout ? <pre>{result.stdout}</pre> : null}
          {result.stderr ? <pre>{result.stderr}</pre> : null}
        </div>
      ) : null}
      {error ? (
        <div className="rich-fallback" role="alert">
          <p>{error}</p>
          <small>{interaction.fallbackPrompt}</small>
        </div>
      ) : null}
    </div>
  );
}
