# Design principles

## North star

Build the most adaptable web-based learning experience possible from a learner’s consented context. Every architectural and visual choice must help a person understand, practise, or carry a useful habit into real work.

The page is a living lesson document. It is not a dashboard, a prompt transcript, a generic course player, or a place for an agent to generate arbitrary code.

## The web platform is the design material

Use a native element when its meaning and behaviour already fit:

- `nav`, an ordered list, and `progress` for the lesson path;
- `figure` and inline SVG for a concept that benefits from spatial manipulation;
- `fieldset`, `legend`, radio buttons, and labels for a choice;
- `details` and `summary` for optional rationale and technical context;
- a checkbox for explicit reminder consent;
- a normal external link for a third-party video;
- headings and regions that remain coherent without styling.

CSS expresses layout, state, and restrained motion. In particular, `:has()` lets the concept figure respond to a native radio group without adding another JavaScript state machine.

React has three jobs only:

1. keep the lesson and journey state consistent;
2. choose an Ogram-owned component from validated structured data;
3. connect the top-level WebMCP adapter and desktop event bridge.

No component library, client router, animation library, iframe tool, or agent-authored HTML/CSS/JavaScript is needed.

## Lesson compiler

Codex does not design a page pixel by pixel. It sends a small intermediate representation:

- one of four behavioural focus enums;
- aggregate counts, confidence, and a redacted observation;
- optionally, a validated YouTube video id, 2–6 walkthrough steps, or a known mini-game template id.

Ogram compiles that input with role goals, workshop context, pedagogy, tone, accessibility rules, and visual recipes. The result can change every day while the experience remains coherent and safe.

## Human boundary

The agent may review authorized tasks, summarize behaviour, select a focus, publish a lesson, and add an optional learning aid. It cannot answer the exercise or mark the lesson complete. Those actions exist only as visible native page controls.

The page accepts no raw task text, task title, file path, person, organisation, client name, transcript, screenshot, recording, HTML, CSS, or JavaScript through WebMCP.

## Experience rhythm

The daily lesson has three movements:

1. **Notice** — see the rule, manipulate one visual idea, and understand why it matters.
2. **Choose** — make one decision in a role-relevant situation and receive formative feedback.
3. **Apply** — save one cue, one response, and one observable sign of transfer.

The numbered rail, split editorial composition, warm paper palette, and generative line figure take directional inspiration from [The Way of Code](https://www.thewayofcode.com/) without copying its content or interaction model.

## Extension boundary

- **YouTube:** a host with web search may find a public resource, then pass only a validated video id. Ogram renders a plain link opened by the learner.
- **Computer Use:** can demonstrate Codex only as a separate, explicitly authorized host capability. WebMCP cannot start it.
- **Record & Replay:** can later produce an approved tutorial asset on supported macOS setups. WebMCP cannot silently record a screen or another app.
- **Visualize:** remains an optional sidecar selected by the user; a page tool cannot invoke the plugin.
- **Mini-games:** use page-owned templates and deterministic rubrics. The agent chooses a template, never supplies executable code.

These boundaries follow the current [OpenAI Site tools documentation](https://learn.chatgpt.com/docs/webmcp): the shared top-level page is the canonical canvas, and its tools remain narrow, visible, and verifiable.
