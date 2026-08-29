# WebMCP Challenge preflight

Last checked: August 29, 2026. The official Devpost page and legal rules prevail.

## Deadline

- Submission: **September 3, 2026 at 1:00 p.m. PDT**.
- Zurich equivalent: **September 3, 2026 at 10:00 p.m. CEST**.
- Winners are expected around September 23; that date may move.

Sources: [OpenAI challenge page](https://openai.com/webmcp-challenge/), [Devpost challenge](https://webmcp.devpost.com/), [official rules](https://webmcp.devpost.com/rules).

## Required submission assets

- working live URL accessible in ChatGPT’s built-in browser or compatible Chrome;
- clear judge credentials and test instructions if authentication is required;
- project description explaining why WebMCP is essential and what the human and agent can do together;
- public YouTube demo under three minutes with audio;
- public source repository containing all necessary code and assets;
- visibly detected open-source license;
- English materials or complete translations;
- authorized use of all third-party code, data, media, and trademarks;
- free judge access through the end of judging.

## Judging

The four equally weighted legal-rule criteria are:

1. WebMCP Leverage
2. Execution
3. Potential Impact
4. Creativity & Ambition

WebMCP Leverage is the first tie-break. Practice Desk should therefore demonstrate multiple visible, structured tool calls—not only one tool that returns a prompt.

## Important technical constraints

- Use top-level imperative `document.modelContext.registerTool()` calls.
- Do not depend on declarative form tools or iframe registrations in ChatGPT’s browser.
- Test with GPT-5.6 Sol or Terra; Luna currently has site tools disabled.
- Preserve the normal human interface and use narrow, validated schemas.
- Treat page tool definitions/results as untrusted; site tools cannot grant authority to disclose unrelated tasks.
- Keep the app human-in-the-loop. WebMCP complements rather than replaces a backend API/MCP integration.

Current guidance: [OpenAI site tools](https://learn.chatgpt.com/docs/webmcp), [WebMCP explainer](https://github.com/webmachinelearning/webmcp), [Chrome guide](https://developer.chrome.com/docs/ai/webmcp).

## Ogram-specific compliance notes

- Switzerland is listed as an OpenAI API-supported country, but the submitting representative must still satisfy all official eligibility rules.
- Existing Ogram code may be used, but only new challenge-period WebMCP work is judged; preserve dated commits that separate it.
- Use synthetic context and task observations in the public demo.
- Do not make proprietary desktop code or customer data necessary for judging.
- Treat the submitted repository/deployment as frozen after the deadline until judging ends; if development must continue, work in a separate fork.
