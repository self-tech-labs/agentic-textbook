# Learning event contract

[`learning-event.schema.json`](learning-event.schema.json) is the transport-neutral boundary shared by the Ogram Learn page, the Ogram management backend, and a native desktop companion. It describes a privacy-minimized fact that already happened in one learning session.

The application cache is state version 4; the public envelope is independently versioned as schema version 1. Changing one does not automatically require changing the other. State v4 adds immutable context-pack attempt snapshots and fail-closed `private` / `granted` / `consumed` review consent.

## Guarantees

- Events are append-only. Corrections or later proof create new events rather than mutating history.
- One stable `learningSessionId` groups context, compilation, learner action, completion, and follow-up events for a learning run.
- Every event carries the exact state `revision` it represents.
- `eventId` is also used as the `idempotencyKey`, so retries send an identical envelope.
- `capsuleId` may be `null` for events that happen before a capsule exists.
- `data` is allowlisted per event family and rejects additional properties.
- The schema correlates each event type with its permitted actor, capsule presence, and exact data shape.
- No access token, prompt, response transcript, task title, filesystem path, file content, credential, person, company, or client content belongs in the envelope.
- Tenant and learner identity are derived from the authenticated server or desktop session, not accepted from browser event data.

## Event families

```text
learning.context.loaded
learning.signals.submitted
learning.capsule.published
learning.module.added
learning.practice_attempt.shared
learning.practice_consent.withdrawn
learning.practice_coaching.recorded
learning.practice_review.resolved
learning.choice.recorded
learning.training.completed
learning.desktop_follow_up.queued
```

Actors are equally explicit: `codex`, `learner`, or `ogram`. Attempt sharing, consent withdrawal, review resolution, scenario choices, and training completion must be learner-attributed; bounded coaching is Codex-attributed.

The four collaboration events are deliberately smaller than the browser snapshot:

- `learning.practice_attempt.shared` records `attemptRevision`, the fixed card count, `availableForAgentReview: true`, `consentGranted: true`, and `rawTaskContentShared: false`.
- `learning.practice_consent.withdrawn` records the exact attempt revision and `accessRevoked: true`.
- `learning.practice_coaching.recorded` records the exact `attemptRevision`, an allowlisted `reconsider_card` or `confirm_ready` move, an allowlisted card ID or `null`, and the resulting ready flag. The visible coaching sentence is page-owned and is not transported as model-authored prose.
- `learning.practice_review.resolved` records the exact attempt revision, the page-issued review ID, and the learner’s allowlisted `accepted` or `dismissed` resolution.

None of these payloads records card placements, expected zones, private movements, or raw source content. The immutable `r1` / `r2` snapshots remain in the recoverable application state so the page can render the comparison. The event stream records that the review cycle opened, was withdrawn or consumed, and was resolved without turning the learning artifact into telemetry.

At the site-tool boundary, an identical retry of signal submission, capsule publication, or a coaching write returns its existing durable event receipt and marks the result `replayed: true`; it does not append another event. A conflicting coaching retry is rejected. At the transport boundary, retry sends the identical envelope under the original idempotency key.

The build compiles this file into a standalone Ajv validator. The runtime transport uses that generated validator to reject an envelope before enqueue or delivery when its event family, actor, capsule presence, or payload does not match. The suite also validates a representative envelope for every event family, so application payloads and backend expectations cannot drift silently.

## Delivery semantics

The client persists an event in its local outbox before trying a channel. It then flushes events in insertion order through either:

1. `window.ogramDesktop.learning.publishEvent(envelope)`; or
2. an authenticated `POST` to `${VITE_OGRAM_MANAGEMENT_URL}/v1/learning/events`.

If neither channel exists, the envelope remains queued. That is recoverable browser state, not a server acknowledgement. A failed head event remains pending so later events cannot overtake it.

The ingestion service should:

1. authenticate the tenant and learner independently of the envelope;
2. validate the JSON Schema and all authorization rules;
3. claim a unique `(tenant_id, learner_id, idempotency_key)` constraint;
4. return success for an already accepted identical event;
5. reject reuse of an idempotency key with different content;
6. append the event transactionally before acknowledging delivery;
7. project the current journey from the append-only log.

The browser keeps a bounded recent event-ID list plus a per-session delivered-revision cursor, so pruning old IDs cannot cause the state journal to resend acknowledged history. Both are client optimizations. Server-side uniqueness is the authority that makes an uncertain acknowledgement safe to retry.

## Desktop preload surface

Keep the renderer boundary narrow:

```ts
interface OgramLearningBridge {
  publishEvent(event: LearningEventEnvelope): Promise<void>;
  openCapsule?(capsuleId: string): Promise<void>;
}
```

The Electron main process owns authentication, schema validation, origin checks, retry policy, and any capsule deep-link handling. The renderer never receives a management token and does not get a generic IPC or network tunnel.

## Data discipline

`summary`, `cue`, `proof`, and `reason` are bounded operational learning text, not a place to smuggle source material. The backend should still apply length checks, content policy, retention, and audit controls after schema validation.

Structured Codex observations are summarized before they reach this contract. The envelope may record signal count, focus, attempt revision, an allowlisted coaching move, and `rawTaskContentShared: false`; it does not record reviewed task content, card placements, private edits, or agent-authored evidence.
