#!/usr/bin/env node
process.stdin.setEncoding("utf8");
let data = "";
process.stdin.on("data", (chunk) => {
  data += chunk;
});
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.file_path || input.path || "";

    const importantPatterns = [
      /package\.json$/,
      /tsconfig.*\.json$/,
      /\/\.env$|^\.env$/,
      /Dockerfile/,
      /docker-compose/,
      /\.github\/workflows\//,
      /CLAUDE\.md$/,
      /\.claude\//,
      /Cargo\.toml$/,
      /pyproject\.toml$/,
      /go\.mod$/,
      /Makefile$/,
    ];

    const isImportant = importantPatterns.some((p) => p.test(filePath));

    // Reactive wiki seed enqueue: edits inside a docs/wiki/ tree spawn a verify seed.
    const wikiMatch =
      filePath.match(/(?:^|\/)\.claude\/wikis\/([^/]+)\/wiki\/.+\.md$/) ||
      filePath.match(/(?:^|\/)\.pro-workflow\/wikis\/([^/]+)\/wiki\/.+\.md$/);
    if (wikiMatch) {
      try {
        const path2 = require("path");
        const fs2 = require("fs");
        const distPath = path2.join(__dirname, "..", "dist", "db", "store.js");
        if (fs2.existsSync(distPath)) {
          const { createStore } = require(distPath);
          const store = createStore();
          try {
            const slug = wikiMatch[1];
            const w = store.getWiki(slug);
            if (w) {
              const rel = path2.relative(w.root_path, filePath);
              store.enqueueSeed({
                wiki_slug: slug,
                query: `verify edits in ${rel}`,
                depth: 0,
              });
              console.error(`[ProWorkflow] enqueued verify seed for ${slug}/${rel}`);
            }
          } finally {
            store.close();
          }
        }
      } catch (e) {
        /* never break the hook */
      }
    }

    if (isImportant) {
      let hint = "";
      if (/package\.json$/.test(filePath)) hint = " (Run: pnpm install)";
      else if (/\/\.env$|^\.env$/.test(filePath)) hint = " (CAUTION: verify no secrets committed)";
      else if (/tsconfig.*\.json$/.test(filePath)) hint = " (Run: pnpm type-check)";
      else if (/Dockerfile|docker-compose/.test(filePath)) hint = " (Rebuild containers if needed)";
      else if (/\.github\/workflows\//.test(filePath)) hint = " (Verify CI pipeline)";
      else if (/CLAUDE\.md$/.test(filePath)) hint = " (Instructions updated)";
      else if (/Cargo\.toml$/.test(filePath)) hint = " (Run: cargo check)";
      else if (/pyproject\.toml$/.test(filePath)) hint = " (Run: pip install -e .)";
      else if (/go\.mod$/.test(filePath)) hint = " (Run: go mod tidy)";
      else if (/\.claude\//.test(filePath)) hint = " (Config/rules modified)";
      else if (/Makefile$/.test(filePath)) hint = " (Verify build targets)";

      console.error(`[ConfigChanged] ${filePath}${hint}`);
    }

    console.log(data);
  } catch (err) {
    console.error("[ProWorkflow] JSON parse error:", err.message);
    console.log(data || "{}");
  }
});
