# Third-party notices

learn.ogram is project code released under the repository's MIT license. It uses third-party packages through npm; those packages remain under their own licenses.

## Direct production and build dependencies

| Package | Version audited | License | Notice |
|---|---:|---|---|
| `@cloudflare/sandbox` | 0.12.9 | Apache-2.0 | Cloudflare |
| `@codemirror/lang-javascript`, `@codemirror/lang-python`, `@codemirror/state`, `@codemirror/view` | 6.x | MIT | Copyright © 2018–2021 Marijn Haverbeke and others |
| `@json-render/core`, `@json-render/react` | 0.20.0 | Apache-2.0 | Vercel Labs contributors |
| `@vitejs/plugin-react` | 6.1.1 | MIT | Copyright © 2019–present Yuxi (Evan) You and Vite contributors |
| `katex` | 0.18.5 | MIT | Copyright © 2013–2020 Khan Academy and other contributors |
| `mermaid` | 11.17.2 | MIT | Copyright © 2014–2022 Knut Sveidqvist |
| `react`, `react-dom` | 19.2.8 | MIT | Copyright © Meta Platforms, Inc. and affiliates |
| `thinking-orbs` | 0.3.1 | MIT | Copyright © 2026 Jakub Antalik |
| `typescript` (container runtime) | 7.0.2 | Apache-2.0 | Microsoft and contributors |
| `tsx` (container runtime) | 4.23.13 | MIT | Privatenumber and contributors |
| `vite` | 8.2.2 | MIT | Copyright © 2019–present VoidZero Inc. and Vite contributors |
| `zod` | 4.5.4 | MIT | Copyright © 2025 Colin McDonnell |

`khroma` 2.1.0 is a Mermaid transitive dependency. Its package metadata omits the SPDX field, but its distributed license file is MIT: copyright © 2019–present Fabio Spampinato and Andrew Maney.

The exact dependency graph and resolved versions are recorded in `package-lock.json`. The deployed build carries this notice at `/third-party-notices.txt`, the complete generated production dependency corpus at `/third-party-licenses.txt`, and canonical MIT and Apache-2.0 texts under `/licenses/`.

## Project media

- `public/favicon.svg` is an original Ogram-authored geometric vector made from circles and a rounded rectangle; it contains no third-party logo or font.
- `docs/submission-assets/devpost-thumbnail-lessons-not-chatlogs-final.png` was generated for this project with OpenAI's built-in image tool from a project-specific prompt, without an input image or moodboard, then cropped to 3:2. It contains no readable text or recognizable logo. OpenAI's current European terms state that, as between the user and OpenAI and to the extent permitted by law, the user owns output; they also warn that output may not be unique. The submitting owner remains responsible for approving its use.
- No audio, music, stock footage, downloaded font, or third-party logo is shipped in the repository.

## Trademarks

OpenAI, ChatGPT, Codex, Cloudflare, Chrome, Google, Devpost, GitHub, Vercel, Netlify, Render, Shopify, and other names are the property of their respective owners. References in this project are descriptive and do not imply sponsorship or endorsement. No third-party brand logo is bundled.

## License texts

- [MIT](public/licenses/MIT.txt)
- [Apache License 2.0](public/licenses/Apache-2.0.txt)
- [Complete production dependency corpus](public/third-party-licenses.txt)
