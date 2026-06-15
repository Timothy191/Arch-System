#!/usr/bin/env node
/**
 * Standalone LLM Wiki Viewer Generator
 * Reads /home/timothy/Project/Arch-Mk2/wiki and emits a single self-contained HTML file.
 * Zero dependencies. Zero impact on the main project.
 */

const fs = require("fs");
const path = require("path");

const WIKI_ROOT = "/home/timothy/Project/Arch-Mk2/wiki";
const OUT_FILE = "/home/timothy/Project/Arch-Mk2/tools/wiki-viewer/viewer.html";

/* ────────────── helpers ────────────── */

function readFile(p) {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const raw = m[1];
  const body = m[2];
  const meta = {};
  for (const line of raw.split("\n")) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    let [, k, v] = kv;
    v = v.trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      try {
        meta[k] = JSON.parse(v.replace(/'/g, '"'));
        continue;
      } catch {}
      meta[k] = v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      continue;
    }
    if (v === "true") {
      meta[k] = true;
      continue;
    }
    if (v === "false") {
      meta[k] = false;
      continue;
    }
    meta[k] = v;
  }
  return { meta, body };
}

function mdToHtml(md, slugMap) {
  let html = md;

  // Escape HTML in code blocks first, then restore later
  const codeBlocks = [];
  html = html.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang, code: escapeHtml(code) });
      return `\x00CODEBLOCK${idx}\x00`;
    },
  );

  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(escapeHtml(code));
    return `\x00INLINECODE${idx}\x00`;
  });

  // Wikilinks
  html = html.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target, display) => {
      const t = target.trim().replace(/\s+/g, "-").toLowerCase();
      const d = (display || target).trim();
      if (slugMap.has(t)) {
        return `<a class="wiki-link" href="#page=${t}">${escapeHtml(d)}</a>`;
      }
      return `<span class="wiki-link missing" title="Missing page: ${escapeHtml(t)}">${escapeHtml(d)}</span>`;
    },
  );

  // Headings
  html = html.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // Horizontal rule
  html = html.replace(/^---\s*$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "<br>");

  // Tables (simple parser)
  html = html.replace(
    /(\|.*\|[ \t]*\n)(\|[-:\| \t]+\|[ \t]*\n)((?:\|.*\|[ \t]*\n)+)/g,
    (match) => {
      const lines = match.trim().split("\n");
      if (lines.length < 3) return match;
      let out = "<table><thead><tr>";
      const headers = lines[0]
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const h of headers) out += `<th>${h}</th>`;
      out += "</tr></thead><tbody>";
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i]
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!cells.length) continue;
        out += "<tr>";
        for (const c of cells) out += `<td>${c}</td>`;
        out += "</tr>";
      }
      out += "</tbody></table>";
      return out;
    },
  );

  // Lists
  html = html.replace(/(^|\n)((?:\s*[-*+] .+\n?)+)/g, (_, pre, block) => {
    const items = block.trim().split(/\n(?=\s*[-*+] )/);
    let out = pre + "<ul>";
    for (const item of items) {
      const content = item.replace(/^\s*[-*+]\s+/, "").trim();
      if (content) out += `<li>${content}</li>`;
    }
    out += "</ul>";
    return out;
  });

  html = html.replace(/(^|\n)((?:\s*\d+\. .+\n?)+)/g, (_, pre, block) => {
    const items = block.trim().split(/\n(?=\s*\d+\. )/);
    let out = pre + "<ol>";
    for (const item of items) {
      const content = item.replace(/^\s*\d+\.\s+/, "").trim();
      if (content) out += `<li>${content}</li>`;
    }
    out += "</ol>";
    return out;
  });

  // External links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );

  // Bold / italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<b><i>$1</i></b>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  html = html.replace(/\*([^*]+)\*/g, "<i>$1</i>");

  // Restore inline code
  html = html.replace(
    /\x00INLINECODE(\d+)\x00/g,
    (_, idx) => `<code>${inlineCodes[+idx]}</code>`,
  );

  // Restore code blocks
  html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => {
    const { lang, code } = codeBlocks[+idx];
    return `<pre class="code-block${lang ? " language-" + lang : ""}"><code>${code}</code></pre>`;
  });

  // Paragraphs
  const blocks = html.split(/\n\n+/);
  html = blocks
    .map((blk) => {
      const t = blk.trim();
      if (!t) return "";
      if (/^<(h[1-6]|ul|ol|pre|table|hr|blockquote)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ────────────── collect pages ────────────── */

const pages = [];
const slugMap = new Map();

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.startsWith(".")) continue;
      walk(p);
    } else if (ent.name.endsWith(".md")) {
      const raw = readFile(p);
      if (raw == null) continue;
      const rel = path.relative(WIKI_ROOT, p).replace(/\\/g, "/");
      const slug = rel.replace(/\.md$/, "").replace(/\//g, "-");
      const { meta, body } = parseFrontmatter(raw);
      const page = {
        slug,
        rel,
        title: meta.title || ent.name.replace(/\.md$/, ""),
        type: meta.type || "page",
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        sources: Array.isArray(meta.sources) ? meta.sources : [],
        confidence: meta.confidence || "",
        contested: meta.contested || false,
        contradictions: Array.isArray(meta.contradictions)
          ? meta.contradictions
          : [],
        created: meta.created || "",
        updated: meta.updated || "",
        source_url: meta.source_url || "",
        ingested: meta.ingested || "",
        sha256: meta.sha256 || "",
        body,
      };
      pages.push(page);
      slugMap.set(slug, page);
      // Also register simpler slugs for wikilink resolution
      const simple = path.basename(ent.name, ".md");
      if (!slugMap.has(simple)) slugMap.set(simple, page);
    }
  }
}

walk(WIKI_ROOT);

// Build links
const links = [];
for (const p of pages) {
  const re = /\[\[([^\]|]+)/g;
  let m;
  while ((m = re.exec(p.body))) {
    const t = m[1].trim().replace(/\s+/g, "-").toLowerCase();
    if (slugMap.has(t) && t !== p.slug) {
      links.push({ source: p.slug, target: t });
    }
  }
}

/* ────────────── HTML template ────────────── */

const pageData = pages.map((p) => ({
  slug: p.slug,
  rel: p.rel,
  title: p.title,
  type: p.type,
  tags: p.tags,
  sources: p.sources,
  confidence: p.confidence,
  contested: p.contested,
  contradictions: p.contradictions,
  created: p.created,
  updated: p.updated,
  source_url: p.source_url,
  ingested: p.ingested,
  sha256: p.sha256,
  html: mdToHtml(p.body, slugMap),
}));

const groups = {
  index: pageData.filter((p) => p.slug === "index"),
  schema: pageData.filter((p) => p.slug === "SCHEMA"),
  log: pageData.filter((p) => p.slug === "log"),
  entity: pageData.filter((p) => p.type === "entity"),
  concept: pageData.filter((p) => p.type === "concept"),
  comparison: pageData.filter((p) => p.type === "comparison"),
  query: pageData.filter((p) => p.type === "query"),
  raw: pageData.filter(
    (p) => p.slug.startsWith("raw-") || p.rel.startsWith("raw/"),
  ),
  other: pageData.filter(
    (p) =>
      ![
        "index",
        "SCHEMA",
        "log",
        "entity",
        "concept",
        "comparison",
        "query",
      ].includes(p.type) &&
      !(p.slug.startsWith("raw-") || p.rel.startsWith("raw/")),
  ),
};

function groupHtml(key, label, arr) {
  if (!arr.length) return "";
  const lis = arr
    .map(
      (p) =>
        `<li data-slug="${escapeHtml(p.slug)}"><a href="#page=${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></li>`,
    )
    .join("");
  return `<details open><summary>${label} <span class="count">${arr.length}</span></summary><ul>${lis}</ul></details>`;
}

const sidebarGroups = [
  groupHtml("index", "Index", groups.index),
  groupHtml("schema", "Schema", groups.schema),
  groupHtml("log", "Log", groups.log),
  groupHtml("entity", "Entities", groups.entity),
  groupHtml("concept", "Concepts", groups.concept),
  groupHtml("comparison", "Comparisons", groups.comparison),
  groupHtml("query", "Queries", groups.query),
  groupHtml("raw", "Raw Sources", groups.raw),
  groupHtml("other", "Other", groups.other),
]
  .filter(Boolean)
  .join("");

const allTags = [...new Set(pageData.flatMap((p) => p.tags))].sort();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Arch-Systems Wiki Viewer</title>
<style>
:root {
  --bg: #0b0c10;
  --surface: #14161d;
  --surface-2: #1c1f2a;
  --border: #2a2e3b;
  --text: #c9d1d9;
  --text-dim: #8b949e;
  --text-faint: #484f58;
  --accent: #f78166;
  --accent-2: #58a6ff;
  --accent-3: #3fb950;
  --warn: #d29922;
  --danger: #f85149;
  --code-bg: #161b22;
  --sidebar-width: 280px;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  display: flex;
  overflow: hidden;
}
a { color: var(--accent-2); text-decoration: none; }
a:hover { text-decoration: underline; }

/* Sidebar */
#sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
}
#sidebar header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
#sidebar header h1 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--accent);
}
#sidebar header input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
}
#sidebar header input::placeholder { color: var(--text-faint); }
#sidebar nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}
#sidebar nav details { margin-bottom: 6px; }
#sidebar nav summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  padding: 4px 0;
  list-style: none;
}
#sidebar nav summary::-webkit-details-marker { display: none; }
#sidebar nav ul {
  list-style: none;
  margin: 4px 0 8px 8px;
  padding: 0;
}
#sidebar nav li { margin: 2px 0; }
#sidebar nav li a {
  display: block;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text);
}
#sidebar nav li a:hover { background: var(--surface-2); text-decoration: none; }
#sidebar nav li.active a { background: var(--surface-2); color: var(--accent-2); font-weight: 600; }
#sidebar nav .count {
  font-size: 11px;
  color: var(--text-faint);
  margin-left: 4px;
}
#sidebar footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-faint);
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
#sidebar footer button {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}
#sidebar footer button:hover { color: var(--text); border-color: var(--text-dim); }

/* Main */
#main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100vh;
}
#topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  gap: 12px;
}
#topbar h2 { margin: 0; font-size: 16px; font-weight: 600; }
#topbar .meta { font-size: 12px; color: var(--text-dim); display: flex; gap: 12px; flex-wrap: wrap; }
#topbar .tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--surface-2);
  font-size: 11px;
  color: var(--text-dim);
  border: 1px solid var(--border);
}
#topbar .tag.confidence-high { color: var(--accent-3); border-color: rgba(63,185,80,0.3); }
#topbar .tag.confidence-medium { color: var(--warn); border-color: rgba(210,153,34,0.3); }
#topbar .tag.confidence-low { color: var(--danger); border-color: rgba(248,81,73,0.3); }
#topbar .tag.contested { color: var(--danger); border-color: rgba(248,81,73,0.3); }
#content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  max-width: 900px;
}

/* Markdown content */
#content h1 { font-size: 28px; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-top: 0; }
#content h2 { font-size: 22px; margin-top: 28px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
#content h3 { font-size: 18px; margin-top: 24px; }
#content h4 { font-size: 15px; margin-top: 20px; }
#content p { line-height: 1.7; margin: 12px 0; }
#content ul, #content ol { margin: 12px 0; padding-left: 24px; }
#content li { margin: 4px 0; }
#content blockquote {
  margin: 12px 0;
  padding: 8px 14px;
  border-left: 3px solid var(--accent);
  background: var(--surface);
  border-radius: 0 6px 6px 0;
  color: var(--text-dim);
}
#content hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
#content table {
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 13px;
  width: 100%;
}
#content th, #content td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}
#content th { background: var(--surface-2); font-weight: 600; }
#content tr:nth-child(even) { background: rgba(255,255,255,0.02); }
#content code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  background: var(--code-bg);
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 12px;
}
#content pre.code-block {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}
#content pre.code-block code { background: none; padding: 0; }
#content a.wiki-link { color: var(--accent-2); }
#content a.wiki-link.missing { color: var(--danger); text-decoration: underline dashed; cursor: help; }

/* Frontmatter panel */
.frontmatter {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 20px;
  font-size: 12px;
}
.frontmatter table { width: 100%; margin: 0; font-size: 12px; }
.frontmatter td { padding: 3px 8px; border: none; }
.frontmatter td:first-child { width: 100px; color: var(--text-dim); font-weight: 500; white-space: nowrap; }

/* Graph panel */
#graph-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 320px;
  height: 220px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  display: none;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
}
#graph-panel.visible { display: flex; }
#graph-panel header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#graph-panel header button {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
#graph-panel svg { flex: 1; width: 100%; }
#graph-panel circle { cursor: pointer; }
#graph-panel circle:hover { stroke: var(--accent); stroke-width: 2; }

/* System map panel */
#sysmap-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 520px;
  height: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  display: none;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
}
#sysmap-panel.visible { display: flex; }
#sysmap-panel header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#sysmap-panel header button {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
#sysmap-panel svg { flex: 1; width: 100%; background: var(--bg); }
#sysmap-panel .node-box { cursor: pointer; }
#sysmap-panel .node-box:hover rect { stroke: var(--accent); stroke-width: 2; }
#sysmap-panel .node-label { pointer-events: none; font-size: 10px; fill: var(--text); }
#sysmap-panel .node-sublabel { pointer-events: none; font-size: 8px; fill: var(--text-dim); }
#sysmap-panel .edge { stroke: var(--border); stroke-width: 1.5; }
#sysmap-panel .edge.highlight { stroke: var(--accent); stroke-width: 2; }
#sysmap-panel .legend {
  display: flex; gap: 10px; padding: 6px 12px; font-size: 10px; color: var(--text-dim);
  border-top: 1px solid var(--border); flex-wrap: wrap;
}
#sysmap-panel .legend span { display: flex; align-items: center; gap: 4px; }
#sysmap-panel .legend i {
  display: inline-block; width: 10px; height: 10px; border-radius: 2px;
}

/* Search results overlay */
#search-overlay {
  position: fixed;
  top: 0; left: var(--sidebar-width); right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: none;
  z-index: 20;
}
#search-overlay.visible { display: block; }
#search-modal {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;
  max-width: 90%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  overflow: hidden;
}
#search-modal input {
  width: 100%;
  padding: 14px 18px;
  background: var(--bg);
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-size: 15px;
  outline: none;
}
#search-results {
  max-height: 400px;
  overflow-y: auto;
}
.search-result {
  padding: 10px 18px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
}
.search-result:hover { background: var(--surface-2); }
.search-result .title { font-weight: 600; font-size: 14px; }
.search-result .snippet { font-size: 12px; color: var(--text-dim); margin-top: 3px; }
.search-result .meta { font-size: 11px; color: var(--text-faint); margin-top: 3px; }
#search-empty { padding: 20px; text-align: center; color: var(--text-dim); font-size: 13px; }

/* Responsive */
@media (max-width: 860px) {
  #sidebar { position: fixed; left: -100%; transition: left 0.2s; z-index: 30; height: 100vh; }
  #sidebar.open { left: 0; }
  #content { padding: 16px; }
  #search-overlay { left: 0; }
}
@media print {
  #sidebar, #graph-panel, #topbar { display: none !important; }
  #main { height: auto; }
  #content { overflow: visible; max-width: none; padding: 0; }
}
</style>
</head>
<body>

<aside id="sidebar">
  <header>
    <h1>Arch-Systems Wiki</h1>
    <input id="nav-search" type="text" placeholder="Filter pages...">
  </header>
  <nav id="nav">${sidebarGroups}</nav>
  <footer>
    <span>${pages.length} pages</span>
    <button id="btn-graph" title="Toggle link graph">Graph</button>
    <button id="btn-sysmap" title="Toggle system map">Map</button>
    <button id="btn-search" title="Search (Ctrl+K)">Search</button>
  </footer>
</aside>

<div id="main">
  <div id="topbar">
    <h2 id="page-title">Select a page</h2>
    <div class="meta" id="page-meta"></div>
  </div>
  <div id="content">
    <p style="color:var(--text-dim)">Select a page from the sidebar, press <kbd>Ctrl+K</kbd> to search, or view the <a href="#page=index">Index</a>.</p>
  </div>
</div>

<div id="graph-panel">
  <header>Link Graph <button id="close-graph">&times;</button></header>
  <svg id="graph-svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet"></svg>
</div>

<div id="sysmap-panel">
  <header>System Architecture <button id="close-sysmap">&times;</button></header>
  <svg id="sysmap-svg" viewBox="0 0 520 320" preserveAspectRatio="xMidYMid meet"></svg>
  <div class="legend">
    <span><i style="background:#58a6ff"></i> App</span>
    <span><i style="background:#a371f7"></i> Package</span>
    <span><i style="background:#3fb950"></i> Backend</span>
    <span><i style="background:#d29922"></i> External</span>
    <span><i style="background:#f78166"></i> Data</span>
  </div>
</div>

<div id="search-overlay">
  <div id="search-modal">
    <input id="global-search" type="text" placeholder="Search pages, tags, content..." autocomplete="off">
    <div id="search-results"></div>
  </div>
</div>

<script>
const pages = ${JSON.stringify(pageData)};
const links = ${JSON.stringify(links)};
const slugMap = Object.fromEntries(pages.map(p => [p.slug, p]));

let currentSlug = null;

function $(sel) { return document.querySelector(sel); }

function renderPage(slug) {
  const p = slugMap[slug];
  if (!p) return;
  currentSlug = slug;
  history.replaceState(null, "", "#page=" + slug);

  // Title
  $("#page-title").textContent = p.title;

  // Meta tags
  const metaEl = $("#page-meta");
  const tags = [];
  if (p.type) tags.push('<span class="tag">' + p.type + '</span>');
  if (p.confidence) tags.push('<span class="tag confidence-' + p.confidence + '">' + p.confidence + '</span>');
  if (p.contested) tags.push('<span class="tag contested">contested</span>');
  if (p.updated) tags.push('<span>Updated ' + p.updated + '</span>');
  metaEl.innerHTML = tags.join('');

  // Frontmatter
  let fm = '';
  const rows = [];
  if (p.created) rows.push(['Created', p.created]);
  if (p.updated) rows.push(['Updated', p.updated]);
  if (p.tags.length) rows.push(['Tags', p.tags.join(', ')]);
  if (p.sources.length) rows.push(['Sources', p.sources.join(', ')]);
  if (p.confidence) rows.push(['Confidence', p.confidence]);
  if (p.contested) rows.push(['Contested', 'true']);
  if (p.source_url) rows.push(['Source URL', '<a href="' + p.source_url + '" target="_blank">' + p.source_url + '</a>']);
  if (p.ingested) rows.push(['Ingested', p.ingested]);
  if (p.sha256) rows.push(['SHA256', p.sha256.slice(0, 16) + '...']);
  if (rows.length) {
    fm = '<div class="frontmatter"><table>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table></div>';
  }

  // Content
  $("#content").innerHTML = fm + p.html;

  // Active sidebar
  document.querySelectorAll('#sidebar nav li').forEach(li => li.classList.toggle('active', li.dataset.slug === slug));

  // Scroll top
  $("#content").scrollTop = 0;

  // Update graph highlight
  drawGraph();
}

function handleHash() {
  const m = location.hash.match(/#page=(.+)/);
  if (m && slugMap[m[1]]) renderPage(m[1]);
}

/* Search */
const overlay = $("#search-overlay");
const gSearch = $("#global-search");
const resultsEl = $("#search-results");

function openSearch() {
  overlay.classList.add("visible");
  gSearch.value = "";
  gSearch.focus();
  renderResults("");
}
function closeSearch() { overlay.classList.remove("visible"); }

function renderResults(q) {
  q = q.trim().toLowerCase();
  if (!q) { resultsEl.innerHTML = '<div id="search-empty">Start typing to search across all pages, tags, and content.</div>'; return; }
  const scored = pages.map(p => {
    let score = 0;
    const text = (p.title + " " + p.slug + " " + p.tags.join(" ") + " " + p.html).toLowerCase();
    if (p.title.toLowerCase().includes(q)) score += 10;
    if (p.slug.includes(q)) score += 5;
    if (p.tags.some(t => t.toLowerCase().includes(q))) score += 4;
    if (text.includes(q)) score += 1;
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 20);

  if (!scored.length) { resultsEl.innerHTML = '<div id="search-empty">No results.</div>'; return; }

  resultsEl.innerHTML = scored.map(({p}) => {
    let snippet = "";
    const idx = p.html.toLowerCase().indexOf(q);
    if (idx >= 0) snippet = p.html.slice(Math.max(0, idx - 60), idx + 120).replace(/<[^>]+>/g, " ");
    return '<div class="search-result" data-slug="' + p.slug + '"><div class="title">' + escapeHtml(p.title) + '</div>' +
      (snippet ? '<div class="snippet">' + escapeHtml(snippet) + '</div>' : '') +
      '<div class="meta">' + p.type + (p.tags.length ? ' &middot; ' + p.tags.join(', ') : '') + '</div></div>';
  }).join('');
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

gSearch.addEventListener('input', e => renderResults(e.target.value));
overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
resultsEl.addEventListener('click', e => {
  const r = e.target.closest('.search-result');
  if (r) { renderPage(r.dataset.slug); closeSearch(); }
});

/* Sidebar filter */
$("#nav-search").addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#sidebar nav li').forEach(li => {
    const show = li.textContent.toLowerCase().includes(q);
    li.style.display = show ? '' : 'none';
  });
  document.querySelectorAll('#sidebar nav details').forEach(det => {
    const any = det.querySelectorAll('li[style="display: none;"]').length < det.querySelectorAll('li').length;
    det.style.display = any ? '' : 'none';
  });
});

/* Graph */
const graphPanel = $("#graph-panel");
$("#btn-graph").addEventListener('click', () => graphPanel.classList.toggle('visible'));
$("#close-graph").addEventListener('click', () => graphPanel.classList.remove('visible'));

function drawGraph() {
  const svg = $("#graph-svg");
  const w = 320, h = 180;
  const nodeMap = new Map();
  const nodes = [];
  const nodeSlugs = new Set();
  // Seed from current page + neighbors
  if (currentSlug) {
    nodeSlugs.add(currentSlug);
    links.forEach(l => {
      if (l.source === currentSlug) nodeSlugs.add(l.target);
      if (l.target === currentSlug) nodeSlugs.add(l.source);
    });
  }
  // If too few, add popular nodes
  if (nodeSlugs.size < 6) {
    const counts = new Map();
    links.forEach(l => { counts.set(l.source, (counts.get(l.source)||0)+1); counts.set(l.target, (counts.get(l.target)||0)+1); });
    [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 10).forEach(([s]) => nodeSlugs.add(s));
  }
  nodeSlugs.forEach(s => {
    const p = slugMap[s];
    if (!p) return;
    const n = { slug: s, x: Math.random()*w, y: Math.random()*h, vx:0, vy:0 };
    nodeMap.set(s, n);
    nodes.push(n);
  });
  const edges = links.filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));

  // Simple force layout
  for (let iter = 0; iter < 120; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i+1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const f = 200 / (dist * dist);
        dx /= dist; dy /= dist;
        a.vx += dx*f; a.vy += dy*f;
        b.vx -= dx*f; b.vy -= dy*f;
      }
    }
    // Attraction
    edges.forEach(e => {
      const a = nodeMap.get(e.source), b = nodeMap.get(e.target);
      let dx = b.x - a.x, dy = b.y - a.y;
      let dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const f = dist * 0.003;
      dx /= dist; dy /= dist;
      a.vx += dx*f; a.vy += dy*f;
      b.vx -= dx*f; b.vy -= dy*f;
    });
    // Center + damping
    nodes.forEach(n => {
      n.vx += (w/2 - n.x) * 0.001;
      n.vy += (h/2 - n.y) * 0.001;
      n.vx *= 0.6; n.vy *= 0.6;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(10, Math.min(w-10, n.x));
      n.y = Math.max(10, Math.min(h-10, n.y));
    });
  }

  let svgHtml = '';
  edges.forEach(e => {
    const a = nodeMap.get(e.source), b = nodeMap.get(e.target);
    svgHtml += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + (e.source===currentSlug||e.target===currentSlug ? '#f78166' : '#2a2e3b') + '" stroke-width="1" />';
  });
  nodes.forEach(n => {
    const isCurrent = n.slug === currentSlug;
    const p = slugMap[n.slug];
    svgHtml += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + (isCurrent ? 6 : 4) + '" fill="' + (isCurrent ? '#f78166' : '#58a6ff') + '" data-slug="' + n.slug + '" />';
    svgHtml += '<text x="' + (n.x+8) + '" y="' + (n.y+3) + '" fill="#8b949e" font-size="9">' + escapeHtml(p.title.slice(0, 18)) + '</text>';
  });
  svg.innerHTML = svgHtml;

  svg.querySelectorAll('circle').forEach(c => {
    c.addEventListener('click', () => renderPage(c.dataset.slug));
  });
}

/* System Map */
const sysNodes = [
  { id: "portal", label: "Portal App", sub: "Next.js 15 App Router", group: "app", x: 260, y: 60, w: 90, h: 36 },
  { id: "overview", label: "Overview App", sub: "Static Next.js", group: "app", x: 80, y: 40, w: 86, h: 32 },
  { id: "cms", label: "CMS App", sub: "Payload v3", group: "app", x: 80, y: 90, w: 78, h: 32 },
  { id: "ui", label: "@repo/ui", sub: "Shared UI", group: "pkg", x: 380, y: 30, w: 74, h: 30 },
  { id: "theme", label: "@repo/theme", sub: "Design Tokens", group: "pkg", x: 460, y: 30, w: 82, h: 30 },
  { id: "supabase", label: "@repo/supabase", sub: "Client Wrappers", group: "pkg", x: 400, y: 90, w: 96, h: 30 },
  { id: "db", label: "@repo/database", sub: "Migrations", group: "pkg", x: 460, y: 130, w: 94, h: 30 },
  { id: "utils", label: "@repo/utils", sub: "Helpers", group: "pkg", x: 460, y: 170, w: 76, h: 30 },
  { id: "backend", label: "Supabase", sub: "Auth + Postgres + RLS", group: "backend", x: 260, y: 160, w: 86, h: 36 },
  { id: "edge", label: "Edge Functions", sub: "Deno Deploy", group: "backend", x: 80, y: 170, w: 92, h: 30 },
  { id: "ai", label: "AI Service", sub: "Groq / OpenRouter / Together", group: "ext", x: 100, y: 230, w: 86, h: 36 },
  { id: "n8n", label: "n8n", sub: "Workflow Automation", group: "ext", x: 220, y: 230, w: 60, h: 30 },
  { id: "flowise", label: "Flowise", sub: "AI Flow Builder", group: "ext", x: 300, y: 230, w: 68, h: 30 },
  { id: "univer", label: "Univer SDK", sub: "Spreadsheets", group: "ext", x: 390, y: 230, w: 78, h: 30 },
  { id: "monitor", label: "Monitoring API", sub: "SAR / InSAR / STAC", group: "ext", x: 80, y: 280, w: 96, h: 30 },
  { id: "weather", label: "Weather API", sub: "Open-Meteo", group: "ext", x: 200, y: 280, w: 82, h: 30 },
  { id: "postgres", label: "PostgreSQL", sub: "Row-level Security", group: "data", x: 260, y: 220, w: 86, h: 32 },
];

const sysEdges = [
  { from: "portal", to: "ui" },
  { from: "portal", to: "theme" },
  { from: "portal", to: "supabase" },
  { from: "portal", to: "utils" },
  { from: "portal", to: "hooks" },
  { from: "portal", to: "backend" },
  { from: "portal", to: "ai" },
  { from: "portal", to: "n8n" },
  { from: "portal", to: "flowise" },
  { from: "portal", to: "univer" },
  { from: "portal", to: "monitor" },
  { from: "portal", to: "weather" },
  { from: "ui", to: "theme" },
  { from: "cms", to: "backend" },
  { from: "supabase", to: "backend" },
  { from: "db", to: "backend" },
  { from: "backend", to: "postgres" },
  { from: "backend", to: "edge" },
  { from: "ai", to: "backend" },
];

const groupColors = {
  app: "#58a6ff",
  pkg: "#a371f7",
  backend: "#3fb950",
  ext: "#d29922",
  data: "#f78166",
};

const sysmapPanel = $("#sysmap-panel");
$("#btn-sysmap").addEventListener('click', () => sysmapPanel.classList.toggle('visible'));
$("#close-sysmap").addEventListener('click', () => sysmapPanel.classList.remove('visible'));

function drawSystemMap() {
  const svg = $("#sysmap-svg");
  const w = 520, h = 320;
  const nodeMap = Object.fromEntries(sysNodes.map(n => [n.id, n]));

  // Simple force nudge: keep nodes within bounds, slight repulsion
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < sysNodes.length; i++) {
      for (let j = i + 1; j < sysNodes.length; j++) {
        const a = sysNodes[i], b = sysNodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const minDist = (Math.max(a.w, a.h) + Math.max(b.w, b.h)) / 2 + 10;
        if (dist < minDist) {
          const f = (minDist - dist) * 0.05;
          dx /= dist; dy /= dist;
          a.x += dx * f; a.y += dy * f;
          b.x -= dx * f; b.y -= dy * f;
        }
      }
    }
    sysNodes.forEach(n => {
      n.x = Math.max(n.w/2 + 4, Math.min(w - n.w/2 - 4, n.x));
      n.y = Math.max(n.h/2 + 4, Math.min(h - n.h/2 - 4, n.y));
    });
  }

  let html = '';
  sysEdges.forEach(e => {
    const a = nodeMap[e.from], b = nodeMap[e.to];
    html += '<line class="edge" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" />';
  });
  sysNodes.forEach(n => {
    const color = groupColors[n.group] || '#8b949e';
    html += '<g class="node-box" data-id="' + n.id + '">';
    html += '<rect x="' + (n.x - n.w/2) + '" y="' + (n.y - n.h/2) + '" width="' + n.w + '" height="' + n.h + '" rx="5" fill="var(--surface-2)" stroke="' + color + '" stroke-width="1.5" />';
    html += '<text class="node-label" x="' + n.x + '" y="' + (n.y - 2) + '" text-anchor="middle" font-weight="600">' + escapeHtml(n.label) + '</text>';
    if (n.sub) html += '<text class="node-sublabel" x="' + n.x + '" y="' + (n.y + 9) + '" text-anchor="middle">' + escapeHtml(n.sub) + '</text>';
    html += '</g>';
  });
  svg.innerHTML = html;

  svg.querySelectorAll('.node-box').forEach(g => {
    g.addEventListener('click', () => {
      const id = g.dataset.id;
      const targets = { portal: 'portal-app-architecture', overview: 'turborepo-monorepo', cms: 'external-tools', ui: 'design-system', theme: 'design-system', supabase: 'supabase-local-dev', db: 'database-schema', types: 'turborepo-monorepo', utils: 'turborepo-monorepo', hooks: 'turborepo-monorepo', backend: 'auth-middleware', edge: 'external-tools', ai: 'ai-service', n8n: 'external-tools', flowise: 'external-tools', univer: 'external-tools', monitor: 'monitoring-error-tracking', weather: 'monitoring-error-tracking', postgres: 'database-schema' };
      if (targets[id] && slugMap[targets[id]]) renderPage(targets[id]);
    });
  });
}

/* Keyboard */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') { closeSearch(); graphPanel.classList.remove('visible'); sysmapPanel.classList.remove('visible'); }
});
$("#btn-search").addEventListener('click', openSearch);

/* Hash init */
window.addEventListener('hashchange', handleHash);
handleHash();
if (!currentSlug && slugMap['index']) renderPage('index');
drawSystemMap();
</script>
</body>
</html>`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, html, "utf-8");
console.log(`Wiki viewer generated: ${OUT_FILE}`);
console.log(`Pages: ${pages.length} | Links: ${links.length}`);
