# learn.ogram contracts

This directory holds transport-facing contracts for a future canonical service. The running prototype keeps its authoritative TypeScript model in `src/domain/agentCanvas.ts` and persists a local v3 projection.

## `learning-event.schema.json`

The v3 event contract covers:

- session bootstrap;
- context proposal, learner review, and generic-path selection;
- lesson preparation, exact-revision approval, and publication;
- scoped region patching, widget injection, research attachment, and reversion;
- immutable learner evidence submission.

Events are sequenced and privacy-minimized. Payloads may carry IDs, revisions, digests, counts, content-type labels, provider identifiers, and bounded summaries. They must not carry connector credentials, raw mail/calendar/file content, full conversations, arbitrary prompts, local paths, or free-text learner answers.

The browser prototype stores events inside `learn-ogram-canvas:v3`. Production should add authenticated tenant/session identifiers, server-side idempotency constraints, immutable storage, purpose-bound retention, and an ordered delivery envelope without weakening the payload rules.
