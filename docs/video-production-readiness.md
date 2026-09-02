# Devpost video production readiness

Verified September 2, 2026. This is a production-method record, not a finished
video. The staging release is technically ready for the final rehearsal and recording.

## Verdict

The Codex Merch Devpost workflow is reusable for Ogram Learn, including a truthful
full-app recording with Codex visible and Ogram Learn in the right panel. A live
one-second capture probe succeeded at the Mac display's native `3024×1964`, 30 fps,
and H.264. A separate single-frame review showed the complete Codex shell and the
embedded Ogram Learn panel rather than a macOS privacy shield. The private whole-
display probe was moved to Trash after review; it is not committed.

The local Ogram Learn panel also passed a browser readiness check at
`http://127.0.0.1:5173/`: correct page identity, meaningful lesson content, no
framework overlay, no console warnings or errors, and a successful skip-link state
change to `#main-canvas`. This validates the capture surface, not the staging runtime.

The deployed staging URL now passes its full Sandbox, media, security, and browser
smoke matrix. The Codex Merch technique is ready to reuse: record the truthful full
Codex surface with Ogram Learn visible in the right panel, then place that real capture
over the standard restrained abstract-colour background and use eased zoom/pan beats.
The video must continue to show deployed proof rather than substitute local fixtures.

## Method recovered from Codex Merch

The source package in `codex-merch/video/` used a reproducible evidence pipeline:

1. Rehearse the real application with safe public or synthetic data.
2. Capture the real surface at 30 fps; reject privacy-shield, credential, private-tab,
   customer-data, or unrelated-desktop takes.
3. Preserve a capture manifest with source resolution, crop, scale, accepted take,
   retained segments, and privacy-review result.
4. Compose the edit in pinned Remotion code with deterministic scenes, transitions,
   timing, callouts, and gentle image motion.
5. Generate narration in bounded segments, verify transcript similarity and pacing,
   then assemble a single narration track.
6. Burn captions into the master and ship the same English cues as SRT.
7. Normalize delivery audio and fail the package unless dimensions, codec, duration,
   loudness, true peak, full decode, thumbnail, captions, and privacy review pass.
8. Keep a contact sheet and machine-readable QA report beside the final master.

The important creative rule is the same one used by the desktop-demo workflow: the
product surface is a real external capture. Any authored or generated background,
intro, bridge, or outro frames around it must not recreate or mutate the UI.

## Ogram Learn treatment

Use a `1920×1080`, 30 fps Remotion master with the real Codex capture inset over a
restrained abstract colour field. The background can use two or three large blurred
gradient forms, a quiet grid or grain layer, and the Ogram acid-lime accent; it must
remain visually subordinate to the app.

The app frame should retain the Codex task, conversation, and right-side Ogram Learn
panel. Record at native display resolution so the edit has overscan for movement.
Use eased scale and position keyframes for the familiar contemporary demo rhythm:

- begin around `0.78–0.84×` to establish the complete Codex + panel surface;
- push to roughly `1.05–1.18×` for the reviewed context, progressive sections,
  exact-revision approval, and adaptive-evidence details;
- pan by changing the transform origin rather than cropping the UI into a fake state;
- return to the full surface between proof beats so the relationship between agent
  conversation and human canvas stays legible;
- leave 8–12 frame settles at zoom endpoints and avoid continuous seasick motion.

The strongest sub-three-minute story remains:

`saved brief → capability discovery → reviewed context → progressive draft → exact revision approval → publication → adaptive evidence`

Use synthetic task summaries, keep secrets and unrelated task titles out of frame,
and show only claims that can be verified against the deployed build. If generated
presenter or set footage is later requested, create and approve its visual bible
first, keep clips atomic, and surround—never replace—the real product recording.

## Production checklist

- [x] Codex Merch source methodology, manifests, Remotion composition, narration,
  captions, and QA gates inspected.
- [x] Native full-display recording device detected and one-second capture encoded.
- [x] Whole-display frame visually confirmed Codex + embedded Ogram Learn with no
  privacy shield.
- [x] Ogram Learn right-panel page identity, content, console, screenshot, and one
  interaction verified locally.
- [x] Workers Paid/Containers entitlement enabled.
- [x] Docker engine responds for the Cloudflare container image build.
- [x] Staging deployed and health, CSRF, media, three-language cold/warm, and
  adversarial checks pass.
- [ ] Fresh, sanitized staging walkthrough rehearsed in the final window layout.
- [ ] Narration, captions, contact sheets, loudness, full decode, and privacy QA pass.
