import { useCallback, useEffect, useRef, useState } from "react";
import { chooseFocus, createCapsule } from "../domain/lessonEngine";
import { mockOgramContext, mockPracticeSignals } from "../domain/mockData";
import type {
  CapsuleDraftInput,
  LearningEvent,
  LearningState,
  PracticeSignal,
} from "../domain/types";
import { publishLearningEvent } from "../lib/desktopBridge";
import {
  clearLearningState,
  loadLearningState,
  saveLearningState,
} from "../lib/persistence";

function makeId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function createEvent(
  type: LearningEvent["type"],
  actor: LearningEvent["actor"],
  summary: string,
  payload?: Record<string, unknown>,
): LearningEvent {
  return {
    id: makeId("event"),
    type,
    at: new Date().toISOString(),
    actor,
    summary,
    payload,
  };
}

export function createInitialState(now = new Date()): LearningState {
  const focus = chooseFocus(mockPracticeSignals);
  const activeCapsule = createCapsule(
    {
      focus,
      personalizedScenario: "",
      coachNote:
        "Your work often changes mode halfway through. Today, practise noticing that boundary before the context becomes a burden.",
      sourceTaskCount: 8,
    },
    mockOgramContext,
    mockPracticeSignals,
    now,
  );

  return {
    version: 1,
    context: mockOgramContext,
    signals: mockPracticeSignals,
    activeCapsule,
    journey: [
      {
        id: "journey-01",
        dateLabel: "Wed",
        title: "Make context portable",
        focus: "task_shaping",
        status: "completed",
        proof: "Created a one-paragraph handoff brief.",
      },
      {
        id: "journey-02",
        dateLabel: "Thu",
        title: "Give files a home",
        focus: "workspace_hygiene",
        status: "completed",
        proof: "Started work inside a dedicated project.",
      },
      {
        id: "journey-today",
        dateLabel: "Today",
        title: activeCapsule.title,
        focus: activeCapsule.focus,
        status: "today",
      },
      {
        id: "journey-next",
        dateLabel: "Next",
        title: "Let evidence choose the next practice",
        focus: "effort_fit",
        status: "queued",
      },
    ],
    events: [
      createEvent(
        "context_loaded",
        "ogram",
        "Synthetic workshop and role context loaded.",
      ),
      createEvent(
        "coaching_signals_submitted",
        "codex",
        "Three privacy-preserving practice signals prepared from mock task metadata.",
        { signalCount: 3, rawTaskContentShared: false },
      ),
      createEvent(
        "capsule_published",
        "codex",
        "Today’s seven-minute practice was published to the shared canvas.",
        { capsuleId: activeCapsule.id },
      ),
    ],
    desktopBridge: {
      status: "ready",
      detail: "Prototype bridge ready; no learning event queued yet.",
    },
  };
}

export interface LearningActions {
  getState: () => LearningState;
  reset: () => void;
  submitSignals: (signals: PracticeSignal[]) => { eventId: string };
  publishCapsule: (input: CapsuleDraftInput) => {
    capsuleId: string;
    eventId: string;
  };
  recordChoice: (
    capsuleId: string,
    choiceId: string,
  ) => { correct: boolean; feedback: string; eventId: string };
  completeCapsule: (capsuleId: string) => {
    completedAt: string;
    eventId: string;
  };
  queueDesktopFollowUp: (
    capsuleId: string,
    reason: string,
  ) => Promise<{ eventId: string; mode: string; detail: string }>;
}

export function useLearningStore(): {
  state: LearningState;
  actions: LearningActions;
} {
  const [state, setState] = useState<LearningState>(
    () => loadLearningState() ?? createInitialState(),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    saveLearningState(state);
  }, [state]);

  const getState = useCallback(() => stateRef.current, []);

  const reset = useCallback(() => {
    clearLearningState();
    setState(createInitialState());
  }, []);

  const submitSignals = useCallback((signals: PracticeSignal[]) => {
    const event = createEvent(
      "coaching_signals_submitted",
      "codex",
      `${signals.length} reviewed practice signal${signals.length === 1 ? "" : "s"} added without raw task content.`,
      { signalCount: signals.length, rawTaskContentShared: false },
    );
    setState((current) => ({
      ...current,
      signals,
      events: [...current.events, event],
    }));
    return { eventId: event.id };
  }, []);

  const publishCapsule = useCallback((input: CapsuleDraftInput) => {
    const current = stateRef.current;
    const capsule = createCapsule(
      input,
      current.context,
      current.signals,
      new Date(),
    );
    const event = createEvent(
      "capsule_published",
      "codex",
      `Published “${capsule.title}” to the shared learning canvas.`,
      { capsuleId: capsule.id, focus: capsule.focus },
    );

    setState((previous) => ({
      ...previous,
      activeCapsule: capsule,
      journey: previous.journey.map((entry) =>
        entry.id === "journey-today"
          ? {
              ...entry,
              title: capsule.title,
              focus: capsule.focus,
              status: "today",
              proof: undefined,
            }
          : entry,
      ),
      desktopBridge: {
        status: "ready",
        detail: "A new capsule is active; no desktop follow-up is queued yet.",
      },
      events: [...previous.events, event],
    }));
    return { capsuleId: capsule.id, eventId: event.id };
  }, []);

  const recordChoice = useCallback((capsuleId: string, choiceId: string) => {
    const capsule = stateRef.current.activeCapsule;
    if (capsule.id !== capsuleId) {
      throw new Error("That capsule is no longer active.");
    }
    const choice = capsule.choices.find((candidate) => candidate.id === choiceId);
    if (!choice) throw new Error("Unknown scenario choice.");

    const event = createEvent(
      "choice_recorded",
      "learner",
      `Scenario response recorded: ${choice.label}.`,
      { capsuleId, choiceId, correct: choice.correct },
    );

    setState((current) => ({
      ...current,
      activeCapsule: {
        ...current.activeCapsule,
        selectedChoiceId: choiceId,
        checkpoints: current.activeCapsule.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          status:
            checkpoint.id === "apply"
              ? "current"
              : checkpoint.id === "notice" || checkpoint.id === "choose"
                ? "done"
                : checkpoint.status,
        })),
      },
      events: [...current.events, event],
    }));

    return {
      correct: choice.correct,
      feedback: choice.feedback,
      eventId: event.id,
    };
  }, []);

  const completeCapsule = useCallback((capsuleId: string) => {
    const capsule = stateRef.current.activeCapsule;
    if (capsule.id !== capsuleId) {
      throw new Error("That capsule is no longer active.");
    }
    if (!capsule.selectedChoiceId) {
      throw new Error("Complete the scenario before finishing the capsule.");
    }

    const completedAt = new Date().toISOString();
    const event = createEvent(
      "training_completed",
      "learner",
      `Completed “${capsule.title}” and committed a real-work practice cue.`,
      { capsuleId, proof: capsule.practiceContract.proof },
    );

    setState((current) => ({
      ...current,
      activeCapsule: {
        ...current.activeCapsule,
        status: "completed",
        checkpoints: current.activeCapsule.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          status: "done",
        })),
      },
      journey: current.journey.map((entry) =>
        entry.id === "journey-today"
          ? {
              ...entry,
              status: "completed",
              proof: current.activeCapsule.practiceContract.proof,
            }
          : entry,
      ),
      events: [...current.events, event],
    }));

    return { completedAt, eventId: event.id };
  }, []);

  const queueDesktopFollowUp = useCallback(
    async (capsuleId: string, reason: string) => {
      const capsule = stateRef.current.activeCapsule;
      if (capsule.id !== capsuleId) {
        throw new Error("That capsule is no longer active.");
      }
      const event = createEvent(
        "desktop_follow_up_queued",
        "ogram",
        `Desktop follow-up queued: ${reason}`,
        {
          capsuleId,
          cue: capsule.practiceContract.cue,
          proof: capsule.practiceContract.proof,
        },
      );

      setState((current) => ({
        ...current,
        desktopBridge: {
          status: "queued",
          detail: "Sending the practice contract to the desktop journey…",
        },
        events: [...current.events, event],
      }));

      const result = await publishLearningEvent(event);
      setState((current) => ({
        ...current,
        desktopBridge: {
          status: result.mode === "local-queue" ? "queued" : "synced",
          detail: result.detail,
        },
      }));
      return { eventId: result.eventId, mode: result.mode, detail: result.detail };
    },
    [],
  );

  return {
    state,
    actions: {
      getState,
      reset,
      submitSignals,
      publishCapsule,
      recordChoice,
      completeCapsule,
      queueDesktopFollowUp,
    },
  };
}
