# Rights and licensing audit

Audit date: September 2, 2026. Scope: the `staging` release candidate, its npm dependency graph, deployed static bundle inputs, Worker/container inputs, repository media, externally sourced content, and trademark usage.

This is an engineering provenance audit, not a legal opinion. The submitting owner still makes the personal representations required by the official Devpost rules.

## Result

**Engineering pass, with two owner-controlled gates remaining:** make the repository public only after the secret scan passes, and approve the final demo video/thumbnail as materials the owner is authorized to publish.

No unlicensed vendored source, downloaded font, stock photo, audio, music, video, third-party logo, or copied proprietary dataset was found in the tracked tree.

## Evidence

| Area | Evidence | Result |
|---|---|---|
| Project ownership | Git history contains one committing identity, Elliot Vaucher. The repository carries an MIT license with Ogram as copyright holder. No copied third-party application source was found; third-party text is confined to the dedicated license/notice corpus. | Pass, subject to the owner confirming authority to submit on Ogram's behalf. |
| Dependency licensing | `npm query '.prod'` resolved 162 production-tree packages: 110 MIT, 5 Apache-2.0, 1 MIT/Apache-2.0, 34 ISC, 7 BSD-3-Clause, 1 MPL-2.0/Apache-2.0, 2 MPL-2.0, 1 Unlicense, and `khroma` with an installed MIT license file. No production package lacked a license after inspecting that file. | Pass. Exact versions are locked; direct notices, canonical MIT/Apache texts, and a generated corpus containing every installed production package's distributed license/notice text ship with the app. |
| Copyleft review | The only production-tree MPL entries are DOMPurify (also offered under Apache-2.0) and Lightning CSS/platform binary. They are unmodified dependencies; Lightning CSS is build tooling. LGPL `libvips` binaries appear only as optional development dependencies of Wrangler/Miniflare via Sharp and are not part of the tracked source or deployed browser application. | Pass for the audited distribution model. |
| Container | The pinned Cloudflare Sandbox image is the declared base. The Dockerfile adds TypeScript 7.0.2 (Apache-2.0) and `tsx` 4.23.13 (MIT). | Pass; notices updated. |
| Submission thumbnail | The original Codex task records generation with OpenAI's built-in image tool from a bespoke prompt, with no source image or moodboard, followed by a deterministic 3:2 crop. Visual inspection found no readable text, logo, or recognizable protected character. | Pass with owner approval. OpenAI's European terms assign OpenAI's output interest to the user to the extent permitted by law, while warning that output may not be unique. |
| Favicon and wordmark | The favicon is a repository-authored SVG made only from circles and a rounded rectangle. The `learn.ogram` wordmark is rendered as text with system font stacks. | Pass, subject to Ogram's authority over its name. |
| Fonts | The app downloads no web font. CSS uses system font stacks. KaTeX's packaged font/code assets remain under the package's MIT license and are covered by the notices. | Pass. |
| External research | Documentation links to primary/official and community resources and records short project-authored summaries. It does not bundle the linked pages, videos, transcripts, or logos. | Pass. |
| User-imported media | Before this audit, the app required attribution but not proof of permission. `learn_register_asset` now requires `rightsConfirmed: true` and a specific `rightsBasis`; the Worker enforces both, and the lesson displays the rights basis beside the media. | Fixed and covered by automated tests. |
| Trademarks | Product/vendor names are used descriptively in documentation and source. No third-party logo is bundled. A non-endorsement notice now ships with the app. | Pass. |
| Project name | A September 2 exact-phrase web and WIPO-indexed search found no obvious software product or registered mark named `Agentic Textbook`; the phrase does appear descriptively in writing about agentic learning systems. | No obvious conflict found, but this is not formal trademark clearance. Owner approval remains required before treating the name as a commercial brand. |

## Thumbnail provenance

Prompt recorded in the originating task:

> Tight editorial photograph of a cream notebook on a worn forest-green table; a graphite path forks across movable paper sections, marked by one acid-lime tab, while a partial hand adjusts one section. Soft window light, paper fibre and believable imperfections. No readable text, screens, logos, AI symbols, CGI gloss, or extraneous props.

The originating task explicitly records that no moodboard or input image was used. The generated file was cropped from 1448×1086 to the committed 1448×965 PNG.

Relevant current OpenAI language: [Europe Terms of Use](https://openai.com/policies/eu-terms-of-use/). This supports provenance between the user and OpenAI; it is not a guarantee that output is unique or incapable of resembling third-party material.

## Release controls

- Keep `LICENSE`, `THIRD_PARTY_NOTICES.md`, `public/third-party-notices.txt`, `public/third-party-licenses.txt`, and `public/licenses/` in the public repository and deployment.
- Keep dependency versions locked and run `npm run licenses:generate` after dependency or release-environment changes; `npm run licenses:check` must pass before release.
- Use only owner-created, permissively licensed, public-domain, or expressly permitted media in the demo and final Devpost gallery.
- Do not add music to the demo unless its license explicitly covers public promotional use; spoken narration over original screen capture is the lowest-risk option.
- Use product and platform names descriptively; do not add vendor logos or imply endorsement.
- Preserve the commit history that separates challenge-period WebMCP work from any earlier project work.
- After the deadline, freeze the repository and deployment used by judges until judging ends.
