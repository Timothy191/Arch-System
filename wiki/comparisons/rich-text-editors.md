---
title: Rich Text Editor Comparison
created: 2026-05-15
updated: 2026-05-15
type: comparison
tags: [ui, components, decision]
sources: [apps/portal/package.json, CLAUDE.md]
confidence: medium
---

# Rich Text Editor Comparison: Novel vs Tiptap vs Slate.js vs Lexical

## What is Being Compared

Selection of a Notion-style block-based rich text editor for engineering notes, shift handoff documentation, and operational reports.

## Dimensions of Comparison

| Dimension              | Novel                       | Tiptap                        | Slate.js                       | Lexical (Meta)         |
| ---------------------- | --------------------------- | ----------------------------- | ------------------------------ | ---------------------- |
| **Base Framework**     | Tiptap + ProseMirror        | ProseMirror                   | Custom                         | Custom                 |
| **Notion-style**       | Yes (built-in)              | Requires configuration        | Requires heavy customization   | Requires configuration |
| **React Integration**  | Excellent                   | Excellent                     | Good                           | Good (Facebook origin) |
| **TypeScript**         | Full support                | Full support                  | Good                           | Good                   |
| **Bundle Size**        | Larger (batteries included) | Moderate (modular)            | Moderate                       | Moderate               |
| **Extensibility**      | Via Tiptap extensions       | Extensive extension ecosystem | Plugin-based                   | Plugin-based           |
| **Mobile Support**     | Good                        | Good                          | Manual                         | Good                   |
| **Collaboration**      | Via Tiptap Cloud/Y-partykit | Hocuspocus/Tiptap Cloud       | Manual (Operational Transform) | Manual                 |
| **Markdown Export**    | Built-in                    | Via extension                 | Manual                         | Via plugins            |
| **Active Maintenance** | Active (Vercel ecosystem)   | Very active                   | Stable, slower                 | Active (Meta-backed)   |

## Project Implementation

The portal uses **Novel** for:

- Engineering notes (control room tab)
- Shift handoff documentation
- Equipment manual annotations

```typescript
import { Editor } from 'novel'

<Editor
  defaultValue={content}
  onUpdate={handleUpdate}
  disableLocalStorage={true} // Server-persisted only
/>
```

## Why Novel Was Chosen

1. **Zero-config Notion experience** — Block menu, slash commands, AI autocomplete out of the box
2. **Vercel ecosystem alignment** — Maintained by Vercel team, Next.js-optimized
3. **Built on Tiptap** — Can drop down to Tiptap extensions when needed
4. **AI integration** — Built-in AI completion hooks (`useCompletion`)
5. **Appearance** — Matches the portal's dark theme with minimal CSS override

## Why Not Tiptap Directly

Tiptap would require building:

- Block menu UI
- Slash command palette
- AI completion integration
- Theme matching

Novel packages these pre-built for a mining operations team's usability needs.

## Why Not Slate.js

Slate's API is powerful but requires significant boilerplate for:

- Block-based editing
- Collaborative features
- Mobile touch handling

Time-to-implement favored Novel for this operational tool.

## Why Not Lexical

Lexical is Meta's framework (used in Facebook). While excellent:

- Smaller ecosystem than Tiptap/ProseMirror
- Requires more custom UI component building
- Novel already solved the use case

## Verdict

**Novel is the correct choice** for rapid implementation of a Notion-style editor in a Next.js 15 application. Tiptap would be reconsidered for a custom editing experience requiring deep ProseMirror control.

## Related

- [[portal-app-architecture]] — Where Novel components are used
- [[ai-service]] — AI completion integration with Novel
