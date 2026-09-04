# Agentic Textbook — Devpost demo video script

> **Superseded by the capture-matched edit.** The recorded take differs from this pre-recording plan: the second context proposal is corrected rather than rejected, the scenario is clarified through Codex before the correct answer is saved, and the transfer task reaches the completion screen. Use [`video/NARRATION.md`](../video/NARRATION.md) and [`video/EDIT_PLAN.md`](../video/EDIT_PLAN.md) for the current 2:29.9 cut.

Target: **2:20–2:40**, English narration, `1920×1080`, 30 fps.

The final video opens on the working lesson, then rewinds to show how it was made. Record the workflow in its natural order and capture the cold-open pickup after publication.

## One-sentence story

Agentic Textbook lets a learner's own agent turn a saved goal into a structured, adaptive lesson through WebMCP, while the learner retains authority over personal context, publication, and evidence.

## Final cut

| Time | Screen action | Narration |
|---|---|---|
| `0:00–0:12` | **Cold open.** Start on the real published lesson inside Codex Desktop, with the Codex conversation and learning canvas both visible. Open the diagram scene, then move to the scenario. Do not submit an answer yet. | “This is Agentic Textbook. My own agent built this interactive lesson inside Codex—from a saved goal, through WebMCP, into a lesson I can inspect and control. Here’s how.” |
| `0:12–0:29` | Jump cut to the fresh landing page. Click **Build a better Codex workflow**. Let the populated brief, time, modes, and enabled personalization control remain visible for a beat. | “It starts with a brief saved in the page: the topic, my goal, available time, learning modes, and whether recent work may personalize the result.” |
| `0:29–0:50` | In the adjacent Codex conversation, paste and send Prompt 1 below. Cut out typing and waiting. Briefly show `learn_get_start_brief`, `learn_get_authoring_capabilities`, and `learn_begin_session`; keep the app visible beside the trace. | “I send one instruction in Codex. Through WebMCP, the page exposes typed, stage-aware tools. Codex reads the saved brief, discovers the authoring contract, and begins a session without copying the form into chat.” |
| `0:50–1:13` | On **Context stays proposed until you say yes**, click **Use this** on one synthetic claim and **Don’t use** on the other. Hold on the learner-approved summary. | “Personalization is a proposal, not permission. Codex provides short, synthetic learning signals—never raw prompts, transcripts, code, or task IDs. I accept one and reject another. The agent cannot make these choices for me.” |
| `1:13–1:34` | Paste and send Prompt 2. Show the real section-by-section construction. Compress only the waiting/build portion to roughly `4×–8×`; return to real time when the draft becomes ready. | “Now Codex builds a validated lesson section by section: a foundation, visual model, current sources, practice, and a branch. Slow generation is sped up here; every page you see is from the real deployed product.” |
| `1:34–1:58` | Show the review facts and tap through two section previews. Click **Approve this lesson** yourself. Paste and send Prompt 3, then show the successful `learn_publish_lesson` call. | “Before publication, I review the goal, audience, timing, and each section. Then I approve this exact revision in the human interface. Codex can publish only that revision; stale or changed drafts are rejected.” |
| `1:58–2:23` | In the published lesson, show the diagram and sources. In the scenario, choose **Ask for implementation and accept the first result**, then click **Save my answer**. Show **Your evidence · saved** and the remediation section becoming part of the visible path. | “The published result is more than a chat answer: it has an accessible diagram, source-backed content, and learner-owned interactions. Answers and selected branches become immutable evidence, while explanations can still be improved.” |
| `2:23–2:38` | Return to a calm full view of Codex and the canvas together. End on a two-second text card: **YOUR AGENT. YOUR CONTEXT. YOUR LESSON.** | “That is why WebMCP matters: Codex and the learner share one inspectable state, while I retain authority over context, structure, and evidence. A conversation becomes a lesson I can control.” |

The narration is about 255 words. Read it conversationally at approximately 120–130 words per minute, leaving short pauses around visible clicks.

## Paste-ready Codex prompts

### Prompt 1 — begin safely

> Use the lesson brief I prepared on this page. This is a public demo: do not inspect real task history. Propose exactly these two synthetic learning signals for my review: I repeat repository setup work; I want stronger verification habits. Use official sources for current Codex behavior, and stop before authoring until I review both.

### Prompt 2 — author after human review

> I have reviewed both context proposals. Build the concise personalized Codex lesson section by section. Stop when the exact draft is ready for my review; do not publish it.

### Prompt 3 — publish after human approval

> I approved the exact lesson revision in the canvas. Publish it, then show me the first lesson section.

Paste these prompts instead of typing them during the take. The first prompt deliberately uses synthetic signals so no private task title, identifier, prompt, transcript, code, or customer context can appear in the public recording.

## Recording order

Recording order is different from edit order because publication and learner evidence are state changes.

1. Record the brief, WebMCP bootstrap, context review, progressive authoring, approval, and publication in sequence.
2. Once the lesson is published, record the non-mutating cold open: full Codex view, diagram, then scenario before answering.
3. Record the incorrect scenario answer, evidence confirmation, and remediation branch.
4. Record five seconds of the final full Codex-plus-canvas view for the closing hold.
5. Record the narration separately in short paragraph-sized clips.

Use a new recording file for each numbered beat. Leave two seconds of stillness before and after every clip so cuts and zooms have handles.

## Recommended free recorder

Use **[OBS Studio](https://obsproject.com/)** for the screen footage. It is free and open source, supports native macOS screen/window capture, and can capture application audio on macOS 13 or later. Record the microphone as a scratch/reference track if useful, but use the separately recorded narration in the final edit.

For the simplest fallback, macOS **[Screenshot / QuickTime Player](https://support.apple.com/en-us/102618)** can record the full screen, a window or selected area, and a chosen microphone. It is sufficient when the final narration will be recorded separately.

Avoid Zoom for the master unless there is no time to configure another recorder. Its local recording is available on free accounts, but its [meeting-oriented shared-screen layouts](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0076922) give less control over a clean product-only frame. Loom's free plan currently limits recordings to [720p and five minutes](https://www.loom.com/pricing); the duration is adequate, but small UI text will be less legible than a native-resolution capture.

## Capture setup

- Use the deployed production URL: `https://ogram-learning-canvas.ervaucher.workers.dev`.
- Capture the full Codex Desktop surface at the display's native resolution and 30 fps; the final edit can inset and reframe it at `1920×1080`.
- Keep the Codex conversation and right-side canvas visible together whenever possible. Zoom in only for the context decision, exact approval, and saved evidence.
- Hide notifications, unrelated tasks, bookmarks, desktop files, account details, and secrets. Turn on macOS Focus.
- Use synthetic context only. Start already logged in and with the production page loaded.
- Keep the cursor visible and move it deliberately. Do not add a webcam bubble unless it demonstrably improves the opening.
- Record narration separately from the screen. This makes jump cuts and sped-up waiting sections invisible in the audio.
- Do not add music unless its public promotional license is recorded. Voice, restrained interface sounds, and room tone are enough.

## Remotion edit brief

- Create the video as a separate `video/` package so Remotion does not enter the deployed app bundle.
- Master at `1920×1080`, 30 fps, with the native screen capture inset over a restrained cream/deep-forest background and the existing acid-lime accent.
- Use hard or very short eased cuts. No decorative intro before the product proof.
- Cut all typing, pointer hunting, repeated speech, loading, and dead air.
- Speed up only wait/build footage. Keep clicks, human decisions, tool names, approval, and evidence at normal speed.
- Use a full-surface establishing frame around `0.80×`, then brief eased pushes around `1.08–1.15×` for context review, approval, and evidence. Hold 8–12 frames at zoom endpoints.
- Preserve the real UI. Reframe it; never recreate, replace, or animate fake product states.
- Use the narration script as the caption source, burn readable English captions into the master, and export a matching `.srt`.
- Deliver H.264 MP4 plus a thumbnail, contact sheet, duration check, full-decode check, caption check, and privacy-review checklist.

## Truth and privacy guardrails

Show these claims visually rather than adding unsupported metrics:

- Codex reads the saved brief and stage-valid capabilities through WebMCP.
- Personal context remains proposed until the learner accepts, corrects, or rejects it.
- The learner—not the agent—approves the exact structural revision.
- Publication is bound to the approved revision.
- Learner answers and the selected branch are preserved as evidence.

Do not claim user counts, learning-outcome improvements, enterprise administration, universal browser support, or an embedded OpenAI API integration.

## Final review

- Product works in the first 15 seconds.
- Runtime is below 3:00; aim for 2:38 or less.
- WebMCP tool names are legible at least once.
- Human-only context and approval actions are unmistakable.
- No private task names, customer data, credentials, raw prompts, or unrelated desktop content are visible.
- Captions match the final narration, and narration remains intelligible at normal playback speed.
- The video ends on the product value, not on a loading state or terminal window.
