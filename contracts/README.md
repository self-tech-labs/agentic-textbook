# learn.ogram contracts

The authoritative runtime types and semantic validators live in `src/domain/agentCanvas.ts`; these JSON Schemas make the transport shapes available to non-TypeScript authoring clients.

## Current contracts

- `lesson-brief-v1.schema.json` describes the local, topic-neutral landing brief.
- `lesson-document-v4.schema.json` describes every V4 document field, registered rich block, exercise, edge condition, and accessibility-bearing media reference.
- `learning-event-v4.schema.json` describes the privacy-minimized V4 event envelope.

JSON Schema checks structure and scalar bounds. The runtime validator additionally enforces byte limits, unique IDs, registered types, graph acyclicity/reachability, branch priority/fallback rules, decision depth, evidence on every terminal path, current-source provenance, declared asset references, and preservation of submitted learner evidence.

## Retained contracts

- `learning-event.schema.json` is the V3 event contract retained for consumers during the one-release migration window.
- `learning-experience.schema.json` is an earlier graph/primitive research contract. It is not the V4 lesson transport and must not be advertised by `learn_get_authoring_capabilities`.

The browser stores a V4 local projection at `learn-ogram-canvas:v4`. A validated V3 migration does not delete or overwrite `learn-ogram-canvas:v3`.

Event payloads may contain bounded IDs, revisions, digests, counts, content-type labels, provider labels, correctness, and sanitized summaries. They must not contain connector credentials, raw mail/calendar/file content, task IDs, full conversations, arbitrary prompts, local paths, submitted source code, or free-text learner answers.
