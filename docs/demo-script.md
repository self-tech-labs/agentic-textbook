# Jury demo script — 3 minutes

The demo should prove one claim: **Chat can explain a habit; WebMCP lets the agent and learner perform, refine, and verify it together on the live site.** Keep the browser, visible page state, and site-tool receipts in the same recording.

## 0:00–0:20 — Start with the interaction thesis

Show the header, synthetic-context badge, and the live learning canvas.

Voiceover:

> Ogram teaches people to use Codex better, one working habit at a time. This is not a chatbot beside a course. The page is a shared instrument: I manipulate the learning object, Codex inspects only the revision I authorize, and we iterate in public view.

Open **Inspect system** just long enough to show that all seven top-level WebMCP tools are registered. Point out that the instrument uses semantic web controls, while the recorded agent turns run through ChatGPT Work’s native site-tool surface.

## 0:20–0:42 — Establish provenance and the privacy boundary

Open **Inspect context provenance**. Show the three declared sources, opaque IDs, versions, timestamps, and the Used/Excluded summary.

Voiceover:

> Codex can review only tasks I authorize through its own capabilities. The page receives bounded counts and enums, never prompts, responses, task titles, files, paths, people, credentials, or client content. The live exercise uses eight page-owned structural cards, not my raw work.

## 0:42–1:02 — Build through the real action protocol

Ask ChatGPT Work:

> Read this page’s learning mission, context, and journey. Review only the Codex work I authorized, submit the bounded thread-hygiene signals, and publish the flagship practice through the page’s native site tools.

Keep the native tool-call cards visible as ChatGPT Work traverses:

```text
get mission → get context → submit bounded signals → publish capsule
```

Voiceover:

> Codex selects a bounded focus and modes. Ogram’s versioned recipe compiles the lesson and waits for the exact state revision before reporting success. The agent cannot inject markup, code, URLs, or teaching prose.

If a host retry is visible, point out that an identical signal or publication write returns the existing durable event receipt with `replayed: true` instead of creating another mutation.

Open the Practice step using the visible page control.

## 1:02–1:30 — Compose and explicitly share r1

Rapidly place the eight cards into **Carry into fork** or **Leave in source**, but put **Definition of done** in the wrong zone. Point to **Private by default** while moving cards.

Tick:

> Let Codex inspect this frozen revision’s 8 structural cards, zones, and three rubric indicators for one review cycle.

Click **Share as r1**.

Voiceover:

> None of those movements were visible to the agent. Sharing freezes an immutable r1 and opens one review cycle scoped to that revision. Codex can inspect r1, but the cycle closes when it records its single coaching move. I can withdraw access before coaching, and a reload revokes the grant.

## 1:30–2:02 — Let Codex annotate, never manipulate

Ask ChatGPT Work:

> Inspect my shared Ogram attempt and leave one coaching move.

Show the two WebMCP calls and their receipts:

```text
ogram_inspect_practice_attempt({ capsuleId })
ogram_record_coaching_move({
  capsuleId,
  attemptRevision: 1,
  move: "reconsider_card",
  cardId: "done_when"
})
```

Point to the visible **Codex note** pinned to **Definition of done** and the collaboration trace.

Voiceover:

> The read is tied to r1 and excludes expected answers, private edits, and raw task content. The write accepts a card ID, not prose; Ogram owns the coaching language and rejects stale or misleading moves. The receipt says `agentMovedCards: 0`, and this revision’s review cycle is now consumed. An identical coaching retry returns this same durable event receipt; a conflicting move is rejected.

## 2:02–2:31 — Learner revision, new consent, verified r2

Click **Use this note**. Show that the learner action changes the private draft. Tick the consent box again and click **Share as r2**.

Ask Codex to inspect the new revision. The agent calls:

```text
ogram_inspect_practice_attempt({ capsuleId })
ogram_record_coaching_move({
  capsuleId,
  attemptRevision: 2,
  move: "confirm_ready"
})
```

Show **Ready to fork**, the `r1 → r2` comparison, and the learner/Codex turn trace.

Voiceover:

> This is repeated co-manipulation with asymmetric authority. Codex changes the margin; I change the pack. A stale r1 call now fails, a second review of r2 fails, and the lesson cannot advance until the exact shared revision passes the page-owned rubric.

## 2:31–3:00 — Carry the habit into work and show durable truth

Click **Carry the habit forward**. Edit one line in the cue → response → proof contract and save it. Show the Learning Ledger and journey status.

Voiceover:

> The final commitment is still mine. State v4 preserves immutable attempts and append-only learner and Codex events. Delivery enters an ordered, idempotent outbox first, so the public demo says queued unless a configured backend or desktop bridge actually acknowledges it. WebMCP supplied the live collaboration; progressive web primitives, exact revisions, and fail-closed permissions make it trustworthy.

End card:

> Ogram Learn — the learner owns the work; WebMCP makes the learning turn shared.

## Recording checks

- Keep the synthetic badge visible whenever discussing context.
- Show the seven-tool registration state and at least one native WebMCP receipt.
- Keep `r1`, its single Codex note, the learner’s `r2`, and the ready confirmation legible.
- Show that Codex moved zero cards and that `r2` required a new revision-scoped review grant.
- Record the challenge demo in ChatGPT Work with the native site-tool call cards visible; do not substitute an in-page simulation.
- Do not call a local queue “synced” or “recorded by Ogram.”
- Keep browser developer overlays, personal tabs, task titles, and client data out of frame.
