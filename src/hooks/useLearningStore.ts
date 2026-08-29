import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addLearningModuleTransition,
  completeCapsuleTransition,
  createInitialLearningState,
  publishCapsuleTransition,
  queueDesktopFollowUpTransition,
  recordChoiceTransition,
  resetLearningSession,
  restoreLearningState,
  retryJourneySyncTransition,
  submitSignalsTransition,
  systemLearningSessionDependencies,
} from "../domain/learningSession";
import type {
  LearningTransition,
  RevisionResult,
} from "../domain/learningSession";
import type {
  CapsuleDraftInput,
  LearningModuleInput,
  LearningState,
  PracticeContract,
  PracticeSignal,
} from "../domain/types";
import {
  enqueueLearningEvent,
  flushLearningEventOutbox,
  getJourneyOutbox,
  retryLearningEventOutbox,
  toLearningEventEnvelope,
} from "../lib/journeyTransport";
import type { JourneyDeliveryMode } from "../lib/journeyTransport";
import {
  clearLearningState,
  loadLearningState,
  saveLearningState,
} from "../lib/persistence";

interface RevisionWaiter {
  revision: number;
  eventId?: string;
  resolve: (state: LearningState) => void;
  reject: (reason: Error) => void;
}

export interface LearningActions {
  getState: () => LearningState;
  awaitRevision: (
    revision: number,
    eventId?: string,
  ) => Promise<LearningState>;
  reset: () => RevisionResult & { sessionId: string };
  retryJourneySync: () => RevisionResult;
  submitSignals: (signals: PracticeSignal[]) =>
    RevisionResult & { eventId: string };
  publishCapsule: (
    input: CapsuleDraftInput,
  ) => RevisionResult & { capsuleId: string; eventId: string };
  addLearningModule: (
    capsuleId: string,
    module: LearningModuleInput,
  ) => RevisionResult & { moduleId: string; eventId: string };
  recordChoice: (
    capsuleId: string,
    choiceId: string,
  ) => RevisionResult & {
    correct: boolean;
    feedback: string;
    eventId: string;
  };
  completeCapsule: (
    capsuleId: string,
    editedContract?: PracticeContract,
  ) => RevisionResult & { completedAt: string; eventId: string };
  queueDesktopFollowUp: (
    capsuleId: string,
    reason: string,
  ) => Promise<
    RevisionResult & {
      eventId: string;
      mode: JourneyDeliveryMode;
      detail: string;
    }
  >;
}

export function createInitialState(now = new Date()): LearningState {
  return createInitialLearningState({
    ...systemLearningSessionDependencies,
    now: () => now,
  });
}

function loadCachedState(): LearningState {
  const restored = restoreLearningState(
    loadLearningState(),
    systemLearningSessionDependencies,
  );
  try {
    restored.events.forEach((event) =>
      toLearningEventEnvelope(event, { learningSessionId: event.sessionId }),
    );
    return restored;
  } catch {
    return createInitialLearningState(systemLearningSessionDependencies);
  }
}

export function useLearningStore(): {
  state: LearningState;
  actions: LearningActions;
} {
  const [state, setState] = useState<LearningState>(loadCachedState);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const stateRef = useRef(state);
  const committedStateRef = useRef(state);
  const committedRevisionRef = useRef(state.revision);
  const revisionWaitersRef = useRef<RevisionWaiter[]>([]);

  useLayoutEffect(() => {
    stateRef.current = state;
    committedStateRef.current = state;
    committedRevisionRef.current = state.revision;
    const pending: RevisionWaiter[] = [];
    revisionWaitersRef.current.forEach((waiter) => {
      if (waiter.revision > state.revision) {
        pending.push(waiter);
        return;
      }
      const committedEvent = waiter.eventId
        ? state.events.find((event) => event.id === waiter.eventId)
        : undefined;
      if (
        waiter.eventId &&
        (!committedEvent || committedEvent.revision !== waiter.revision)
      ) {
        waiter.reject(
          new Error(
            `Learning event ${waiter.eventId} was superseded before it committed.`,
          ),
        );
        return;
      }
      waiter.resolve(state);
    });
    revisionWaitersRef.current = pending;
  }, [state]);

  useEffect(() => {
    saveLearningState(state);
  }, [state]);

  useEffect(
    () => () => {
      const error = new Error(
        "The learning store unmounted before the requested revision committed.",
      );
      revisionWaitersRef.current.forEach((waiter) => waiter.reject(error));
      revisionWaitersRef.current = [];
    },
    [],
  );

  const getState = useCallback(() => committedStateRef.current, []);

  const awaitRevision = useCallback((
    revision: number,
    eventId?: string,
  ): Promise<LearningState> => {
    if (!Number.isInteger(revision) || revision < 1) {
      return Promise.reject(new Error("revision must be a positive integer."));
    }
    const committed = committedStateRef.current;
    if (committedRevisionRef.current >= revision) {
      if (eventId) {
        const event = committed.events.find((candidate) => candidate.id === eventId);
        if (!event || event.revision !== revision) {
          return Promise.reject(
            new Error(`Learning event ${eventId} did not commit at revision ${revision}.`),
          );
        }
      }
      return Promise.resolve(committed);
    }
    return new Promise<LearningState>((resolve, reject) => {
      revisionWaitersRef.current.push({ revision, eventId, resolve, reject });
    });
  }, []);

  const commitTransition = useCallback(
    <R extends object>(
      transition: (current: LearningState) => LearningTransition<R>,
    ): R & RevisionResult => {
      const current = stateRef.current;
      const mutation = transition(current);
      if (mutation.state.revision <= current.revision) {
        throw new Error("A learning transition must advance the revision.");
      }
      stateRef.current = mutation.state;
      setState(mutation.state);
      return mutation.result;
    },
    [],
  );

  const updateJourneySync = useCallback(
    (
      sessionId: string,
      nextSync:
        | LearningState["journeySync"]
        | ((
            current: LearningState["journeySync"],
          ) => LearningState["journeySync"]),
    ) => {
      setState((current) => {
        if (current.sessionId !== sessionId) return current;
        const resolved =
          typeof nextSync === "function"
            ? nextSync(current.journeySync)
            : nextSync;
        if (
          current.journeySync.status === resolved.status &&
          current.journeySync.mode === resolved.mode &&
          current.journeySync.pendingCount === resolved.pendingCount &&
          current.journeySync.detail === resolved.detail &&
          current.journeySync.lastSyncedAt === resolved.lastSyncedAt
        ) {
          return current;
        }
        const nextState = { ...current, journeySync: resolved };
        stateRef.current = nextState;
        return nextState;
      });
    },
    [],
  );

  const eventFingerprint = useMemo(
    () => state.events.map((event) => event.id).join("|"),
    [state.events],
  );

  useEffect(() => {
    let cancelled = false;
    const sessionId = state.sessionId;
    const events = state.events;

    const synchronize = async () => {
      try {
        for (const event of events) {
          enqueueLearningEvent(event, { learningSessionId: event.sessionId });
        }
      } catch (error) {
        if (cancelled) return;
        updateJourneySync(sessionId, (current) => ({
          ...current,
          status: "error",
          mode: "local-queue",
          detail: `The learning event could not enter the durable outbox: ${error instanceof Error ? error.message : String(error)}`,
        }));
        return;
      }

      let pendingCount: number;
      try {
        pendingCount = getJourneyOutbox().items.length;
      } catch (error) {
        if (cancelled) return;
        updateJourneySync(sessionId, (current) => ({
          ...current,
          status: "error",
          mode: "local-queue",
          detail: `The durable outbox could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
        }));
        return;
      }

      if (!cancelled && pendingCount > 0) {
        updateJourneySync(sessionId, (current) => ({
          ...current,
          status: "syncing",
          mode: current.mode ?? "local-queue",
          pendingCount,
          detail: `Syncing ${pendingCount} learning event${pendingCount === 1 ? "" : "s"} from the durable outbox…`,
        }));
      }

      const result =
        syncAttempt > 0
          ? await retryLearningEventOutbox()
          : await flushLearningEventOutbox();
      if (cancelled) return;

      let finalPendingCount = result.pendingEventIds.length;
      try {
        finalPendingCount = getJourneyOutbox().items.length;
      } catch {
        // The transport result still gives a truthful lower-fidelity count.
      }
      const status: LearningState["journeySync"]["status"] =
        result.status === "synced"
          ? "synced"
          : result.status === "error"
            ? "error"
            : "queued";
      updateJourneySync(sessionId, (current) => ({
        status,
        mode: result.mode,
        pendingCount: finalPendingCount,
        detail: result.detail,
        lastSyncedAt:
          status === "synced" ? new Date().toISOString() : current.lastSyncedAt,
      }));
    };

    void synchronize();
    return () => {
      cancelled = true;
    };
  }, [eventFingerprint, state.sessionId, syncAttempt, updateJourneySync]);

  const reset = useCallback(() => {
    const result = commitTransition((current) =>
      resetLearningSession(current, systemLearningSessionDependencies),
    );
    clearLearningState();
    return result;
  }, [commitTransition]);

  const retryJourneySync = useCallback(() => {
    const result = commitTransition(retryJourneySyncTransition);
    setSyncAttempt((attempt) => attempt + 1);
    return result;
  }, [commitTransition]);

  const submitSignals = useCallback(
    (signals: PracticeSignal[]) =>
      commitTransition((current) =>
        submitSignalsTransition(
          current,
          signals,
          systemLearningSessionDependencies,
        ),
      ),
    [commitTransition],
  );

  const publishCapsule = useCallback(
    (input: CapsuleDraftInput) =>
      commitTransition((current) =>
        publishCapsuleTransition(
          current,
          input,
          systemLearningSessionDependencies,
        ),
      ),
    [commitTransition],
  );

  const addLearningModule = useCallback(
    (capsuleId: string, module: LearningModuleInput) =>
      commitTransition((current) =>
        addLearningModuleTransition(
          current,
          capsuleId,
          module,
          systemLearningSessionDependencies,
        ),
      ),
    [commitTransition],
  );

  const recordChoice = useCallback(
    (capsuleId: string, choiceId: string) =>
      commitTransition((current) =>
        recordChoiceTransition(
          current,
          capsuleId,
          choiceId,
          systemLearningSessionDependencies,
        ),
      ),
    [commitTransition],
  );

  const completeCapsule = useCallback(
    (capsuleId: string, editedContract?: PracticeContract) =>
      commitTransition((current) =>
        completeCapsuleTransition(
          current,
          capsuleId,
          editedContract,
          systemLearningSessionDependencies,
        ),
      ),
    [commitTransition],
  );

  const queueDesktopFollowUp = useCallback(
    async (capsuleId: string, reason: string) => {
      const result = commitTransition((current) =>
        queueDesktopFollowUpTransition(
          current,
          capsuleId,
          reason,
          systemLearningSessionDependencies,
        ),
      );
      return {
        ...result,
        mode: "local-queue" as const,
        detail:
          "The human-confirmed follow-up is committed and waiting for the shared journey outbox effect.",
      };
    },
    [commitTransition],
  );

  const actions = useMemo<LearningActions>(
    () => ({
      getState,
      awaitRevision,
      reset,
      retryJourneySync,
      submitSignals,
      publishCapsule,
      addLearningModule,
      recordChoice,
      completeCapsule,
      queueDesktopFollowUp,
    }),
    [
      getState,
      awaitRevision,
      reset,
      retryJourneySync,
      submitSignals,
      publishCapsule,
      addLearningModule,
      recordChoice,
      completeCapsule,
      queueDesktopFollowUp,
    ],
  );

  return { state, actions };
}
