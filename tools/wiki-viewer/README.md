# LLM Wiki Viewer (Standalone)

Self-contained HTML viewer for the Arch-Systems LLM Wiki at `../../wiki/`.

## Usage

```bash
# Generate and open in browser
cd tools/wiki-viewer
./view.sh

# Or just regenerate
node generate.js
# Then open viewer.html in any browser
```

## Features

- **Zero dependencies** — pure Node.js built-ins, no npm install needed
- **Zero project impact** — lives entirely in `tools/wiki-viewer/`
- **Single self-contained HTML** — no CDN, no external assets
- **Sidebar navigation** — grouped by page type (entities, concepts, comparisons, queries, raw sources)
- **In-browser search** — `Ctrl+K` to search titles, tags, and content
- **Wikilink resolution** — `[[slug]]` and `[[slug|text]]` links navigate internally; missing pages are highlighted
- **Frontmatter panel** — YAML metadata rendered as a table above each page
- **Link graph** — SVG force-layout of page relationships, with the current page highlighted
- **Dark theme** — matches the portal's aesthetic
- **Print-friendly** — sidebars collapse when printing

## How it works

1. `generate.js` recursively reads all `.md` files from `../../wiki/`
2. Parses YAML frontmatter and converts Markdown to HTML
3. Resolves wikilinks against the page index
4. Embeds everything (pages, links, CSS, JS) into a single `viewer.html`
5. `view.sh` runs the generator and opens the file

## Files

| File          | Purpose                             |
| ------------- | ----------------------------------- |
| `generate.js` | Generator script (Node.js, no deps) |
| `view.sh`     | Launcher: regenerate + open browser |
| `viewer.html` | Generated output (ignored from git) |
| `README.md`   | This file                           |
