# Sticky lesson deck — UX and implementation plan

> **Status — shipped 2026-09-01.** The measured slot/panel structure, fit-versus-flow sizing, proximity snapping, reading-line focus, compact sidecar container queries, reduced-motion fallback, and no-nested-scroll guarantee are implemented. Compiler diagnostics and an optional long-section progress cue remain future refinements, not requirements for the shipped interaction.

## The interaction in one sentence

Turn the published notebook into a **sticky section deck**: one normal document scroll, no scrollable text boxes, and one constrained lesson panel that holds its position until the following section cleanly takes over.

This pattern is also described as pinned scrollytelling with proximity snapping. “Deck” is the useful product term because it communicates that sections feel discrete without turning the lesson into a modal slide show.

## Product constraints

- The primary viewport is a narrow Codex sidecar, usually 320–720 px wide and 600–1,200 px tall.
- The browser page remains the only scroll owner. A lesson section, widget iframe, concept index, or text block must not create a second vertical reading scrollbar.
- Every section stays addressable through its stable region ID, keyboard navigation, WebMCP focus, and browser history/anchors.
- Content that is taller than the available viewport must remain reachable. It may extend the document-flow slot; it must never be clipped merely to preserve the deck illusion.
- Reduced-motion, 200% zoom, short viewports, mobile browser chrome, and keyboard focus must not strand content between snap points.

## Shipped DOM model

The current sticky candidate is also the semantic region. That becomes ambiguous once multiple sticky sections overlap. Split each region into two layers:

```text
lesson-deck                         one document scroll owner
└── lesson-slot[data-region]        owns scroll distance, anchor, visibility, focus
    ├── slot-sentinel               IntersectionObserver target
    └── lesson-panel                sticky, constrained visual object
        ├── region header
        ├── trusted content
        ├── learner interaction
        └── attribution / undo
```

The slot is never sticky. Its sentinel determines the active section and semantic snapshot. The panel uses `position: sticky` below the app header and, in the narrow layout, below the compact concept index. Later panels paint above earlier panels, creating the requested handoff without making focus depend on overlapping intersection ratios.

## Panel sizing modes

Use a `ResizeObserver` on each panel and compare its natural block size with the available space (`100svh - sticky chrome - safe gaps`). Derive one of two modes during layout; do not store it as lesson data.

### Fit mode

- The natural section fits in the available viewport.
- The slot is at least one available viewport tall.
- The panel sticks for the slot’s duration.
- The slot uses `scroll-snap-align: start` and `scroll-snap-stop: always`.
- The following panel crosses the threshold and covers/pushes the current panel in a short, restrained handoff.

### Flow mode

- The section is taller than the available viewport, including at 200% zoom.
- The panel stays in normal document flow or uses bottom-aware sticky positioning while the slot expands to its full height.
- No nested `overflow-y: auto` is introduced.
- Snapping is `proximity`, never mandatory, so the learner can reach every line before the next section takes over.
- A small “long section” progress cue may show current subsection position, but it cannot hide content.

This two-mode rule is the key safeguard. A CSS-only `position: sticky` on every existing section would look correct for short content but produce incorrect focus, overlap, and unreachable text for tall interactions.

## Responsive behavior

Use a container query on the learning canvas rather than relying only on the desktop window width. Codex split-pane widths can be narrow even on a large monitor.

### Compact sidecar: 320–479 px

- 58 px app header + 52 px horizontal section index.
- One-column panel with 18–22 px inline padding.
- Type scales by container width and viewport height; titles clamp to a readable minimum rather than dominating the first screen.
- Key-point previews use fitted columns with line clamps; no partially visible final card.
- Comparisons render as stacked labeled cards.
- Diagrams switch to compact native renderers; no forced wide SVG or table.
- Widget payloads receive canvas theme variables, auto-request bounded height, and cannot own a vertical scrollbar.

### Comfortable sidecar: 480–719 px

- Horizontal section index remains, but labels may appear for the active and adjacent sections.
- Two-column micro-layouts are allowed inside a panel only when both columns retain a 20-character reading measure.
- Fit-mode panels use more negative space; flow-mode panels retain compact spacing.

### Wide canvas: 720 px and above

- The concept map becomes a left rail.
- The panel measure stays capped; extra width becomes breathing room, not longer prose lines.
- Sticky top reserves only the app header because the rail is beside the panel.

## Scrolling and handoff

- Use `scroll-snap-type: y proximity` on the document only while the published lesson deck is mounted.
- Snap the slot, never the sticky panel.
- Programmatic concept-map navigation scrolls the slot with an offset equal to all sticky chrome.
- The active section is the last sentinel to cross a reading threshold around 30% from the top. It is not whichever overlapping panel has the largest intersection ratio.
- On `scrollend`, a fit-mode slot may settle to its start if it is already within the proximity threshold. Do not hijack wheel/touch events.
- The handoff animation is limited to roughly 160–220 ms of opacity/translate and border emphasis. With reduced motion, it becomes an immediate state change.

## Content-authoring guardrails

The deck works best when sections are intentionally bounded. Add non-blocking compiler diagnostics for:

- more than three trusted blocks plus an interaction in one region;
- prose above a configurable reading-length budget;
- widgets that request the 720 px maximum in a compact sidecar;
- comparison rows that should become two regions;
- a section title and objective whose combined length will consume most of a short viewport.

Diagnostics should recommend splitting a conceptual section, not truncating it. Existing stable region IDs and learner evidence remain protected.

## Accessibility and semantics

- Keep each panel a native `<section>` with its existing heading relationship.
- The slot sentinel is `aria-hidden` and never focusable.
- Keyboard focus moving into another region updates canvas focus even without scrolling.
- Page Up/Down, Space, Shift+Space, Home, End, find-in-page, text selection, and anchor links keep browser-native behavior.
- Sticky chrome never covers a focused control; `scroll-margin-block-start` includes header, index, and focus outline space.
- A screen reader encounters ordinary document order. No carousel roles or live announcements are added for passive scrolling.
- At 200% zoom, any fit panel may automatically become flow mode.

## Delivery phases

### Phase 1 — structural foundation

- Add `LessonSlot` around `RegionSection` in `LearningNotebook.tsx`.
- Move `data-canvas-region` and anchor ownership to the slot.
- Observe slot sentinels for active focus and update `currentViewport()` to report slots.
- Add shared sticky-chrome CSS variables and container-query foundation.
- Ship behind a local feature flag until the semantic snapshot tests pass.

### Phase 2 — adaptive panels

- Add natural-height measurement and fit/flow data attributes.
- Implement sticky fit panels and normal-flow tall panels.
- Enable proximity snapping only for fit slots.
- Keep programmatic navigation and browser focus aligned with the slot offset.

### Phase 3 — responsive content catalog

- Add compact attention and transformer-stack renderers.
- Complete comparison-to-card and preview-fit behavior across all trusted components.
- Add widget height telemetry and authoring diagnostics.
- Test arbitrary agent-authored content, not only the transformer fixture.

### Phase 4 — handoff polish and rollout

- Add the panel takeover transition and active-index centering.
- Tune thresholds using trackpad, mouse wheel, keyboard, and touch.
- Remove the feature flag only after the full viewport/zoom matrix passes.

## Acceptance matrix

Test at minimum:

| Viewport | Required outcome |
|---|---|
| 320 × 568 | All controls reachable; tall panels enter flow mode; no horizontal page overflow |
| 390 × 844 | Fit panels pin and hand off; index never covers a title |
| 480 × 720 | Short-height pressure correctly changes oversized panels to flow mode |
| 640 × 900 | Sidecar layout remains single-scroll and visually constrained |
| 900 × 900 | Left concept rail and sticky panels coordinate without overlap |
| Any at 200% zoom | No clipped prose, interaction, focus ring, or forced snap trap |

For every viewport, verify:

- exactly one semantic region is active after a settled handoff;
- concept-map selection and focused WebMCP region agree;
- no descendant of a lesson panel has `overflow-y: auto` or `scroll`;
- headings land below sticky chrome after click, tool-driven reveal, and direct anchor navigation;
- inline trusted visuals and sandbox widgets fit the canvas without a conversation-side duplicate;
- reduced-motion removes smooth scrolling and transition movement;
- console and framework overlays remain clean.

## Success signal

The interaction is successful when a learner can move through the notebook with one continuous gesture, perceive each section as a stable object, stop naturally at section boundaries, and still reach every line of an unusually long section without discovering or managing another scrollbar.
