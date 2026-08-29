# Ogram Learn

> Declared context in. Shared practice in motion. Durable proof forward.

Ogram Learn turns patterns from authorized Codex work into one short practice for the learner’s role. Its flagship lesson is a shared context-packing instrument: the learner composes a private draft on the live page, explicitly shares immutable revision `r1`, Codex adds one bounded margin note, and the learner decides how to revise and share `r2`. Ogram then records the resulting learning journey.

This is where WebMCP is indispensable rather than decorative. Chat alone can explain thread hygiene; a static web app can provide a quiz. WebMCP lets the person, agent, and page inspect and change one visible, revisioned object over several turns without handing the agent control of the learner’s work.

This repository is a public, no-auth demonstration. Its Ogram profile, Codex observations, and prior journey are visibly synthetic. It does not require an OpenAI API key, and the practice-signal contract has no field for raw Codex conversations or free-text evidence.

## The Learning Ledger

```mermaid
flowchart LR
  A[Ogram role and workshop context] --> R[Immutable context receipt]
  B[Structured Codex pattern counts] --> R
  C[Prior learning journey] --> R
  R --> K[Versioned capsule compiler]
  K --> P[Visible five-minute practice]
  P --> D[Private learner draft]
  D -->|explicit share| R1[Immutable attempt r1]
  R1 -->|one bounded Codex note| D
  D -->|learner revises and shares| R2[Immutable attempt r2]
  R2 --> H[Learner-owned practice contract]
  H --> O[Append-only event outbox]
  O --> S[Ogram system of record]
  S -->|later observed behaviour| C
```

The page makes this pipeline inspectable:

- **Gather context:** one receipt records the three inputs, their provenance IDs, versions, timestamps, and synthetic or production environment.
- **Compile practice:** a deterministic Ogram recipe combines the receipt with a bounded focus, difficulty, practice mode, and proof mode.
- **Co-manipulate visibly:** a learner shares one frozen attempt, Codex annotates that exact revision once, and the learner alone changes the pack before sharing again.
- **Record proof:** every mutation advances one stable v4 learning session, emits an ordered event, and reports whether that event is synced, queued, or needs attention.

The browser is the interaction surface and a recoverable cache/outbox. In production, the authenticated Ogram backend is the system of record.

## Context without conversation leakage

Codex reviews only tasks the learner authorized, using capabilities outside the page. The write boundary accepts one to four observations with exactly these fields:

```text
id · level · confidence · occurrences · sampleSize
```

`id` and `level` are enums; counts are integers from 1–8; confidence is bounded from 0–1. There is no free-text evidence field. Ogram derives the visible evidence and recommendation from those counts using page-owned language.

When a capsule is published, its immutable context receipt contains only:

- learner-authorized Ogram role, workshop, preference, and assigned-training context;
- sanitized behavioural signals derived from the structured review;
- the existing learning-journey projection;
- opaque provenance IDs, source versions, capture times, and environment labels.

Raw prompts, responses, task titles, source files, paths, credentials, and names or organizations found in reviewed tasks are outside the signal contract. Learner identity and organization can appear only as separately authorized Ogram profile context.

## Seven top-level WebMCP tools

The tools are registered on the top-level page with the current promise-based WebMCP imperative API and abort cleanly across React lifecycle changes. The interface reports a tool as live only after its registration promise resolves. TypeBox schemas are the single source for runtime validation and TypeScript input types.

| Tool | Contract |
| --- | --- |
| `ogram_get_learning_mission` | Returns the review rubric, privacy boundary, safe sequence, and bounded signal IDs. |
| `ogram_get_injected_context` | Reads the current Ogram context and context-receipt ID. |
| `ogram_get_learning_journey` | Reads the active capsule, prior proof, assignment, receipt, revision, and delivery state. |
| `ogram_submit_practice_signals` | Commits only structured counts and waits until the resulting revision is visible. |
| `ogram_publish_daily_capsule` | Compiles one capsule from a committed focus and bounded compiler options. |
| `ogram_inspect_practice_attempt` | Reads the exact immutable context-pack revision the learner explicitly shared; it fails closed outside that revision’s granted review cycle. |
| `ogram_record_coaching_move` | Attaches one page-authored note to that exact revision or confirms it ready; it accepts no prose and moves zero cards. |

All mutations return an event ID and committed revision. Tool success means the page state is committed and verifiable, not merely that a callback was requested. Identical retries of signal submission, capsule publication, and a coaching write return the existing durable `eventId` and revision with `replayed: true`; they do not create a second mutation. A conflicting coaching retry against an already reviewed attempt is rejected.

`ogram_inspect_practice_attempt` exposes only eight page-owned category IDs, labels, descriptions, and their current `carry`/`leave` zones. It excludes raw task content, private draft movements, expected answers, prompts, responses, files, paths, people, and client data.

The grant opens one review cycle scoped to one frozen revision. Codex may inspect that exact snapshot and record one coaching move; recording the move consumes the grant and closes the cycle. The learner can withdraw before coaching, and reload revokes an outstanding grant. Codex cannot move a card, write arbitrary coaching copy, resolve its own note, edit the practice contract, complete the capsule, or request a reminder. Those remain visible learner actions.

The development/test registry at `window.__OGRAM_WEBMCP_TOOLS__` supports deterministic browser tests. The real path uses `document.modelContext.registerTool()`.

## A bounded capsule compiler

Codex selects; Ogram compiles. The agent cannot write the core lesson, inject markup, or improvise executable UI.

The compiler combines a context receipt with:

- one focus: `thread_hygiene`, `workspace_hygiene`, `effort_fit`, or `task_shaping`;
- `guided` or `stretch` difficulty;
- `decision` or `rehearsal` practice;
- `next_action` or `observed_habit` proof.

Every capsule records its recipe ID, recipe version, receipt ID, and selected modes. The output is deterministic for the same inputs apart from capsule identity and creation time. The `thread_hygiene` recipe includes the shared context-packing instrument as its core practice; it is not an agent-selected mini-game. The other focus recipes retain their short consequence exercise. The challenge-facing WebMCP surface deliberately has no generic module-addition tool and never accepts lesson prose, URLs, HTML, CSS, JavaScript, iframe markup, screenshots, or recordings.

## The learner’s authority

The lesson follows three movements:

1. **Notice** the pattern, rule, provenance, and a focus-specific visual explanation.
2. **Practice** on the live canvas. In the flagship flow, the learner composes → shares → receives one Codex note → revises → shares again. Other focus recipes use a bounded consequence choice.
3. **Apply** by editing a cue → response → proof contract and optionally requesting a reminder.

Only the learner can place cards, accept or dismiss a note, edit the contract, and complete. The interface keeps a visible `r1 → r2` comparison and states that Codex moved zero cards. Completion adds the practice to the Learning Ledger; it does not pretend that transfer has already happened. A later observed or confirmed behaviour can become proof.

## Journey recording

State version 4 gives the learning run one stable session ID and a monotonic revision. It adds immutable practice snapshots, one bounded review per attempt revision, and explicit `private`, `granted`, and `consumed` consent states. Collaboration emits four privacy-minimized facts: attempt shared, consent withdrawn, coaching recorded, and review resolved. Each mutation creates an append-only event envelope containing its event ID, idempotency key, session ID, revision, actor, timestamp, optional capsule ID, and allowlisted data.

The transport always enqueues first, then flushes in order:

1. use `window.ogramDesktop.learning.publishEvent()` when a narrow native preload bridge exists;
2. otherwise post to `${VITE_OGRAM_MANAGEMENT_URL}/v1/learning/events` with the existing authenticated browser session;
3. otherwise retain the event in the local outbox and display it honestly as queued.

Every envelope is validated against the public JSON Schema before it can enter or leave the outbox. Recent event receipts plus a per-session delivered-revision cursor prevent acknowledged history from being re-enqueued after receipt pruning. A failed event stays at the head of the queue so later events cannot overtake it. Local storage is useful for refresh recovery; it is not the production record of truth.

See [the architecture](docs/architecture.md) and [the public event contract](contracts/README.md) for the full boundary.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Run the verification suite with:

```bash
npm run typecheck
npm run test:run
npm run build
```

## Test the WebMCP path

1. Open the page in ChatGPT Work with native WebMCP site tools enabled.
2. Inspect the seven registered Ogram site tools.
3. Ask ChatGPT Work: **“Review the Codex work I authorize and use this page’s native site tools to build the one practice I need today.”**
4. Open the Practice step, place all eight structural cards, deliberately leave one useful card on the wrong side, tick the per-revision consent box, and share `r1`.
5. Ask: **“Inspect my shared Ogram attempt and leave one coaching move.”** Codex must inspect `r1` and attach one page-owned note; it must not move a card.
6. Choose **Use this note** or **Keep my placement**. Revise privately, grant access again, and share `r2`.
7. Let Codex inspect `r2` and call `confirm_ready`. Then edit and save the learner-owned cue → response → proof contract.
8. Inspect the visible turn trace, `r1 → r2` comparison, recently used tools, and journey-delivery status.

Current host constraints and setup instructions belong to the official [OpenAI site-tools guide](https://learn.chatgpt.com/docs/webmcp) and [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp).

## Web primitives first

The experience is a learning document, not an LMS dashboard. It uses semantic regions, native forms, `details`, `progress`, accessible labels, focus-specific inline SVG figures, restrained CSS motion, and normal external links. React owns state consistency and safe component selection. Self-hosted fonts avoid a third-party font request.

The technology choices are deliberately small:

- React + TypeScript + Vite for the visible application;
- TypeBox for one runtime/type-level schema definition;
- the native, promise-based WebMCP registration API with abortable lifecycle cleanup;
- native browser storage for the recoverable v4 cache and delivery outbox;
- an Ajv-generated standalone validator for the public event contract at the transport boundary;
- Vitest and Testing Library for domain, adapter, transport, registration, and interaction tests.

## Project map

```text
src/domain/contextEngine.ts       Immutable context receipts and provenance validation
src/domain/signalEngine.ts        Structured counts → page-owned learning signals
src/domain/lessonEngine.ts        Deterministic, versioned capsule recipes
src/domain/practiceEngine.ts      Context-pack rubric and page-owned coaching copy
src/domain/learningSession.ts     Pure, revisioned learning-state transitions
src/hooks/useLearningStore.ts     React commit receipts, persistence, and outbox effects
src/lib/webmcpSchemas.ts          TypeBox input contracts
src/lib/webmcp.ts                 Seven tool definitions and committed-state responses
src/lib/journeyTransport.ts       Ordered idempotent outbox and delivery channels
src/generated/                    Build-generated standalone event validator
src/components/                  Shared instrument, ledger, receipt, lesson, and WebMCP bridge
contracts/                       Public backend/desktop event boundary
docs/                            Architecture, design principles, and demo script
```

## Production boundary

The public demo deliberately stops before identity, tenancy, and real Codex/Ogram data. Production still requires authenticated server context, learner preview/accept/reject controls, tenant authorization, CSRF protection, retention and deletion controls, secure desktop IPC, and a backend uniqueness constraint for idempotency. The synthetic path must remain available for public review without exposing proprietary Ogram systems or customer data.

## License

[MIT](LICENSE) © 2026 Ogram.
