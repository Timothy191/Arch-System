# Agent provider marks

<!-- cspell:ignore googlegemini githubcopilot -->

Glyph SVGs for the login "Power by" marquee, sourced from [Simple Icons](https://simpleicons.org)
(CC0 1.0). Each mark is filled with `#1e293b` so it reads on the light glass surface.

| File                | Source slug     |
| :------------------ | :-------------- |
| `anthropic.svg`     | `anthropic`     |
| `googlegemini.svg`  | `googlegemini`  |
| `githubcopilot.svg` | `githubcopilot` |
| `openai.svg`        | `openai`        |
| `cursor.svg`        | `cursor`        |
| `windsurf.svg`      | `windsurf`      |
| `cline.svg`         | `cline`         |

Providers without an official glyph (Google Antigravity, Qoder) render a monogram chip in
`AgentProviderMarquee.tsx`; missing or broken files fall back to that monogram via `onError`.
Refresh a file with `curl -o <file>.svg https://cdn.simpleicons.org/<slug>/1e293b`.
