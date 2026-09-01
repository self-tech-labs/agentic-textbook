import { useEffect, useState } from "react";
import {
  LearningNotebook,
  type NotebookRegistration,
} from "./components/LearningNotebook";
import { useLearningCanvas } from "./hooks/useLearningCanvas";
import { registerLearnTools, type WebMcpRegistration } from "./lib/webmcp";
import "./styles.css";

export default function App() {
  const { state, actions } = useLearningCanvas();
  const [registration, setRegistration] = useState<NotebookRegistration>({
    supported: false,
    registering: true,
    toolCount: 1,
    toolNames: ["learn_begin_session"],
  });
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const hasNonce = Boolean(actions.getNonce());

  useEffect(() => {
    let active = true;
    let cleanup: WebMcpRegistration["cleanup"] = () => undefined;
    let registrationTimer = 0;
    setRegistration((current) => ({ ...current, registering: true }));
    setRegistrationError(null);

    registrationTimer = window.setTimeout(() => {
      registerLearnTools(actions, state.session.stage, hasNonce)
        .then((result) => {
          if (!active) {
            result.cleanup();
            return;
          }
          cleanup = result.cleanup;
          setRegistration({
            supported: result.supported,
            registering: false,
            toolCount: result.toolCount,
            toolNames: result.toolNames,
          });
        })
        .catch((error: unknown) => {
          if (!active) return;
          setRegistration((current) => ({ ...current, registering: false }));
          setRegistrationError(
            error instanceof Error ? error.message : "Site-tool registration failed.",
          );
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(registrationTimer);
      cleanup();
    };
  }, [actions, hasNonce, state.session.stage]);

  useEffect(() => {
    document.title = state.session.topic
      ? `${state.session.topic} · learn.ogram`
      : "learn.ogram · Personal learning canvas";
  }, [state.session.topic]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [state.session.stage]);

  return (
    <LearningNotebook
      state={state}
      actions={actions}
      registration={registration}
      registrationError={registrationError}
    />
  );
}
