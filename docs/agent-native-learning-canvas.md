# Product note — an agent-native learning canvas

learn.ogram treats a lesson as a shared construction rather than static courseware. The learner talks to Codex in the host conversation. The page provides the durable, inspectable surface where context, explanations, visual models, practice, evidence, and research live together.

## Interaction principles

1. **One conversation.** The learning page never imitates Codex or asks the learner to manage a second chat.
2. **Addressable meaning.** Every notebook region has a stable ID, objective, revision, focus state, and semantic content; help can land where confusion occurs.
3. **Consent before personalization.** Codex may gather context broadly, but only minimized claims enter the canvas and every claim remains a hypothesis until the learner reviews it.
4. **Different authority for different changes.** Reversible explanatory edits happen immediately. Personal context and structural lesson changes require learner approval.
5. **Learner evidence is not agent material.** Answers and completed interactions cannot be patched, replaced, or reverted by agent tools.
6. **Visual form follows the learning problem.** Prefer trusted accessible renderers; add a sandboxed interaction only when manipulation materially improves understanding.
7. **The notebook stays alive.** Research can run in one marked region while the learner continues elsewhere. A new explanation augments the existing path instead of forcing a restart.

## Why transformers is the hero example

Transformers expose several complementary representation problems in a short path: discrete tokens, vector representations, weighted relationships, a repeated architecture, a probability objective, and teach-back. The demo can therefore show why a writable canvas matters without locking the engine to one subject.

The six shipped regions form a coherent beginner model while remaining independently addressable. “Show me softmax with three tokens” can resolve to self-attention, add an interaction there, preserve the rest of the notebook, and remain reversible.

## Extending the canvas

Future trusted renderers can wrap D3 for data-driven diagrams, Three.js for spatial models, or specialized math/diagram libraries behind the same region-content registry. The public tools should continue to describe learning intent and bounded content rather than expose arbitrary page internals. Heavy renderers should load dynamically so the technical-beginner notebook remains fast.

Agent-side tools can also generate images, videos, demos, or deep research. The page should receive a governed artifact reference, text alternative, and provenance—not connector secrets or an unrestricted execution environment.
