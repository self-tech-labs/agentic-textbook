# Learning event contract

`learning-event.schema.json` is the transport-neutral seam between the Practice Desk, the Ogram management backend, and a desktop companion.

Guarantees:

- append-only events;
- one stable `learningSessionId` per capsule journey;
- idempotency through a unique `(user, capsuleId, idempotencyKey)` constraint;
- no access token, prompt, response, transcript, filesystem path, or client content;
- tenant and user identity are attached by the authenticated backend, not accepted from browser input.

Recommended desktop preload surface:

```ts
interface OgramLearningBridge {
  getJourney(): Promise<LearningJourney>;
  beginHandoff(code: string): Promise<{ capsuleId: string }>;
  publishEvent(event: LearningEventEnvelope): Promise<{ eventId: string }>;
  openCapsule(capsuleId: string): Promise<void>;
}
```

The main process owns authentication. The renderer never receives management tokens.
