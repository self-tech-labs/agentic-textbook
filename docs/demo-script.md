# Acceptance demo — learn transformers with Codex

This walkthrough exercises the real WebMCP flow in one uninterrupted Codex Desktop session. Keep the Codex conversation on the left and the built-in browser on the right.

## Before the demo

Run the app:

```bash
npm run dev
```

For a completely fresh run, clear the `learn-ogram-canvas:v3` local-storage entry or use a fresh browser profile. Do not delete the v2 key; the v3 loader deliberately ignores it.

## 1. Start through the conversation

Open the page in Codex Desktop’s built-in browser. The ready view should show the scientific cream/green notebook cover, one available tool, and no embedded chat control.

Say to Codex:

> Teach me how transformers work. Use the learn.ogram site tools on the page. Start with the required bootstrap call and guide me through the choices.

Codex calls `learn_begin_session` with the topic and relays the returned guide:

1. Tell me what you want to understand and why.
2. Choose whether I may use this chat, relevant past Codex/project history, Ogram, or connected-source context.
3. Review each proposed context card on the right: Use this or Don’t use.
4. Approve the notebook, then work through it at your pace.
5. Ask me naturally whenever a focused region needs another explanation, interaction, or research.

The page immediately becomes the six-region transformer skeleton.

## 2. Demonstrate two-stage context consent

Tell Codex:

> You may use relevant information from this conversation and my calendar availability, but only for this lesson. Show me the minimized claims before using them.

For the demo, Codex should propose two claims resembling:

- the learner writes JavaScript but is new to machine-learning mathematics;
- the learner has a twenty-minute study window.

Codex consults approved Codex history and any installed connector agent-side. It passes only the two summaries, provenance, sensitivity, purposes, source scopes, and opaque evidence references to `learn_propose_context`.

On the canvas, choose **Use this** for both cards. Point out that proposal did not equal approval: the lesson could not use either claim until this visible review.

If no connector is available, use a learner-provided second claim instead. The context mechanic remains real.

## 3. Watch the lesson form, then approve it

Ask Codex to prepare the transformer lesson visibly. It calls `learn_prepare_lesson` with `phase: start` and the bundled `transformer_technical_beginner` template, then makes one `phase: region` call for each returned region id. A shaping orb and commit meter stay active while each row changes from a skeleton into a compact render from the real json-render catalog. A final `phase: finalize` call runs the compiler and opens review without changing the row geometry.

The canvas shows:

- the objective and technical-beginner baseline;
- the working time;
- the number of learner-approved context signals;
- six stable notebook regions.

Click **Approve this lesson**. Codex then calls `learn_publish_lesson` with the exact approved revision. A different or unapproved revision fails.

## 4. Learn in the living notebook

Scroll through the published page and briefly identify:

1. learning goal;
2. tokens and embeddings;
3. query, key, value, softmax, and self-attention;
4. multi-head attention, residual paths, normalization, and feed-forward layers;
5. next-token prediction practice;
6. teach-back.

The sticky concept map tracks the focused region. Select a short phrase inside self-attention to show that selected text also enters the semantic snapshot.

Answer the next-token choice and save it. This creates learner-owned evidence that later agent writes cannot change.

## 5. Inject the softmax playground

Focus the self-attention region, then say in the Codex conversation:

> I don’t understand softmax. Show it with three tokens and let me change one score.

Codex should:

1. call `learn_get_canvas_snapshot`;
2. resolve `self-attention` from focus rather than guessing from the whole lesson;
3. call `learn_inject_widget` directly with a small three-token interaction. Do not invoke a host visualization skill or create an inline conversation artifact first.

The interaction appears inside the existing self-attention section. It does not replace the notebook or open a second assistant. Show:

- the **Interactive model · sandboxed** label;
- reset, stop, and text-alternative controls;
- **Updated by Codex · Undo** attribution;
- the unchanged learner answer in the practice region.

Click **Undo** if time permits, then ask Codex to add the interaction again with a fresh snapshot/revision. This makes reversibility and concurrency visible.

## 6. Attach research without blocking progress

Say:

> Research the original scaled dot-product attention formulation and attach one authoritative source here. Keep the rest of the notebook usable.

Codex can first mark the self-attention region `agent_working`. The learner can continue elsewhere. After agent-side research, Codex calls `learn_attach_research` with a short synthesis and canonical reference, for example the original *Attention Is All You Need* paper.

The source card appears in the requested region with publisher, date, URL, claim, and agent attribution. No raw search response or connector credential enters the page.

## What the demo proves

- WebMCP makes the website and Codex conversation one shared working surface.
- Context can arrive from arbitrary agent-accessible sources without surrendering learner consent.
- Codex authors the lesson and later changes only the region that needs help.
- Trusted visual specifications and a strict widget sandbox support different explanatory forms.
- The learner retains structural approval, answer ownership, evidence history, and undo.
- The architecture is generic even though transformers is the polished demonstration.
