# Design principles

## North star: a Learning Ledger

The product is not a course player and not an agent transcript. It is a living ledger that shows how declared context became a practice, what the learner decided, and what evidence should exist next.

Every important claim needs a visible receipt:

- **Why this?** Show the context sources and behavioural pattern.
- **Why this shape?** Show the compiler recipe and bounded modes.
- **Who decided?** Separate agent actions from learner choices.
- **Was it recorded?** Distinguish queued, syncing, synced, and error.
- **Did it work?** Ask for observable proof, not a completion badge.

If the interface cannot answer those questions, it is decoration rather than learning infrastructure.

## One continuous thread

The experience is organized as one causal line:

```text
declared source → observed pattern → live capsule → learner decision → proof
```

The visual system reinforces that line. A chartreuse thread and numbered nodes carry the eye across context, compilation, practice, and journey. Warm paper gives the work the seriousness of an annotated document; dark ink makes it readable; sharp orange/cobalt accents mark decisions and system state rather than decorating empty space.

The composition should feel editorial and asymmetric, with generous breathing room and decisive typographic scale. Newsreader carries ideas and principles, Instrument Sans carries interface language, and IBM Plex Mono marks receipts, IDs, and machine state. The fonts are self-hosted so the learning page does not depend on a third-party font request.

## Provenance is part of the interface

Context is never a mysterious “personalization” sparkle. The source ribbon names Ogram context, Codex review, and prior journey before the learner sees the lesson. An expandable receipt exposes:

- synthetic or production environment;
- receipt and provenance IDs;
- schema/source versions and timestamps;
- a plain-language summary of what was used;
- a plain-language list of what was excluded.

Provenance should remain near the capsule, not buried in settings. A learner must be able to inspect why the lesson exists without reading code or trusting an agent’s narration.

## The web platform is the design material

Use native semantics whenever they already express the interaction:

- `nav`, an ordered list, and `progress` for the learning path;
- `article`, `section`, `header`, `footer`, and `aside` for a coherent document outline;
- `figure` and inline SVG for focus-specific concept instruments;
- `fieldset`, `legend`, radio inputs, and labels for consequential choices;
- labelled text areas for the editable practice contract;
- a checkbox for explicit reminder preference;
- `details` and `summary` for provenance and rationale;
- a normal external link for a third-party video.

CSS owns layout, hierarchy, focus, and restrained motion. React owns state consistency, safe component selection, and adapter lifecycle. No router, component library, animation framework, or arbitrary agent-rendered markup is needed for this product.

## Codex selects; Ogram compiles

The most adaptive experience is not the one with the largest prompt. It is the one with the smallest useful intermediate representation and the strongest renderer.

Codex may provide:

- structured behavioural counts for one to four known focus IDs;
- one capsule focus;
- bounded difficulty, practice, and proof modes;
- one Ogram-owned module template ID.

Ogram owns:

- evidence and recommendation language;
- lesson principles and cognitive load;
- scenarios, choices, and feedback;
- visual instruments and component composition;
- default cue → response → proof contracts;
- accessibility and motion rules;
- recipe identity and versioning.

The resulting capsule can adapt every day without becoming visually incoherent, unsafe, or impossible to reproduce.

## Make context transformation visible

The compilation trace has three verbs, not a dashboard full of metrics:

1. **Gather context** — three declared sources form one immutable receipt.
2. **Compile practice** — one or more structured patterns select one versioned capsule.
3. **Record proof** — learner events enter the ordered journey ledger.

Counts are used only when they clarify state: source count, pattern count, event count, pending deliveries, and completed practices. Avoid vanity scores, generic streaks, fabricated intelligence indicators, or progress that confuses page completion with learned behaviour.

## Teach through consequence

The lesson rhythm is deliberately short:

1. **Notice** — understand one rule and its relevance.
2. **Choose** — compare the downstream cost of plausible actions.
3. **Apply** — rewrite the practice in language the learner will recognize at work.

Each focus gets its own explanatory instrument rather than a generic illustration:

- thread hygiene maps continuity, forking, and fresh starts;
- workspace hygiene shows boundaries and containment;
- effort fit exposes a reasoning-gear dial;
- task shaping measures brief completeness.

The visual should teach a relationship, not fill a card.

## The practice contract belongs to the learner

The generated cue, response, and proof are a draft. All three must be readable and editable before completion. The learner can also decline the future reminder.

The editor should make the contract concrete:

```text
When [recognizable cue], I will [specific response], and we can see it worked when [observable proof].
```

Completion records the chosen contract. It does not retroactively prove the habit. Later Ogram or desktop evidence can mark the proof as observed or confirmed.

## System truth is a visual requirement

Never use reassuring copy to hide uncertain infrastructure state.

- **Queued** means the event exists only in the recoverable browser outbox.
- **Syncing** means delivery is in progress.
- **Synced** means a configured Ogram channel acknowledged the event.
- **Error** means the event remains retryable and requires attention.

The local-only public demo should look complete as an experience while remaining explicit that no production server is configured.

## Hard human and safety boundaries

The agent may gather authorized context, submit structured patterns, select bounded compiler modes, and add an Ogram-owned module template. It cannot answer the scenario, edit the learner’s contract, mark the capsule complete, or request a follow-up.

The practice-signal tool accepts no free-text evidence and no reviewed-task identifiers. The site-tool contract prohibits raw task content, task titles, file paths, credentials, task-derived names or organizations, client data, transcripts, arbitrary HTML/CSS/JavaScript, screenshots, and recordings. Separately authorized Ogram profile context may include the learner’s own name and organization.

Video, Computer Use, Record & Replay, and visualization capabilities remain separate, explicitly authorized extensions. A web tool must not masquerade as permission to browse private work, record another application, or execute generated page code.

These boundaries follow the current [OpenAI site-tools documentation](https://learn.chatgpt.com/docs/webmcp): top-level tools should be narrow, visible, and verifiable.

## Accessibility is structural

- Keep the DOM reading order meaningful before applying the asymmetric grid.
- Preserve native inputs rather than replacing them with clickable `div`s.
- Move focus to the new step heading after a stage change.
- Announce choice feedback, contract saving, and delivery status through appropriate live regions.
- Meet contrast requirements for text, focus rings, and status indicators; never encode state by color alone.
- Respect reduced-motion preferences and keep animation subordinate to comprehension.
- Make receipt IDs and long status copy wrap rather than overflow.

The standard is not “technically keyboard reachable.” The learner should understand where they are, what changed, and what only they can do.
