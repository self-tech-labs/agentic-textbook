import type {
  AgentLearningCanvasState,
  ContextDiscoveryScope,
  ContextSource,
} from "../domain/agentCanvas";

const storageKey = "learn-ogram-canvas:v3";

function scopeForRoute(
  route: ContextSource["route"],
): ContextDiscoveryScope | null {
  if (route === "conversation") return "current_conversation";
  if (route === "codex_history") return "codex_history";
  if (route === "project_history") return "project_history";
  if (route === "ogram") return "ogram_profile";
  if (route === "connected_mcp") return "connected_sources";
  return null;
}

export function loadCanvasState(): AgentLearningCanvasState | null {
  if (typeof window === "undefined") return null;
  try {
    const serialized = window.localStorage.getItem(storageKey);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as Partial<AgentLearningCanvasState>;
    if (
      parsed.version !== 3 ||
      !parsed.session ||
      !parsed.lesson ||
      !Array.isArray(parsed.regions) ||
      !Array.isArray(parsed.events)
    ) {
      return null;
    }
    const state = parsed as AgentLearningCanvasState;
    const existingConsent = state.session.contextConsent;
    const inferredScopes = Array.from(
      new Set(
        (state.contextClaims ?? [])
          .map((claim) => scopeForRoute(claim.source.route))
          .filter((scope): scope is ContextDiscoveryScope => Boolean(scope)),
      ),
    );
    return {
      ...state,
      session: {
        ...state.session,
        contextConsent: existingConsent
          ? {
              ...existingConsent,
              sourceScopes:
                existingConsent.sourceScopes?.length
                  ? existingConsent.sourceScopes
                  : inferredScopes.length
                    ? inferredScopes
                    : ["current_conversation"],
            }
          : null,
      },
      lesson: {
        ...state.lesson,
        construction:
          (state.lesson as Partial<AgentLearningCanvasState["lesson"]>)
            .construction ?? null,
      },
      focus: {
        regionId: parsed.focus?.regionId ?? null,
        selectedText: null,
      },
    };
  } catch {
    return null;
  }
}

export function saveCanvasState(state: AgentLearningCanvasState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The canvas remains usable when storage is unavailable.
  }
}

export function clearCanvasState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
