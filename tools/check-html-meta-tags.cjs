/**
 * HTML Meta Tag Performance Gate
 *
 * Validates that all Next.js app layouts have required meta tags for optimal
 * browser rendering performance. Catches issues before they reach production:
 *
 * 1. Character encoding (<meta charset="UTF-8">) - Must be in first 1024 bytes
 *    to prevent browser re-parsing. See: https://web.dev/articles/character-encoding
 *
 * 2. Viewport declaration - Required for responsive design and mobile performance
 *
 * 3. Language attribute (lang="en") - Accessibility and SEO requirement
 *
 * Usage: node tools/check-html-meta-tags.cjs
 */
const fs = require("fs");
const path = require("path");
const { globSync } = require("glob");

const ROOT = path.join(__dirname, "..");
const layoutFiles = globSync("apps/*/app/layout.{tsx,jsx}", { cwd: ROOT });

const REQUIRED_PATTERNS = {
  charset: /<meta\s+charset\s*=\s*["']?UTF-8["']?\s*\/?>/i,
  viewport: /<meta\s+name\s*=\s*["']?viewport["']?\s+content\s*=/i,
  lang: /<html\s+lang\s*=\s*["'][a-z]{2}["']/i,
};

let failures = 0;
let checked = 0;

console.log("🔍 Checking HTML meta tags in layout files...\n");

for (const layoutPath of layoutFiles) {
  const absPath = path.join(ROOT, layoutPath);
  const content = fs.readFileSync(absPath, "utf8");
  const issues = [];

  checked += 1;

  // Check charset
  if (!REQUIRED_PATTERNS.charset.test(content)) {
    issues.push("Missing <meta charset=\"UTF-8\"> in <head>");
  }

  // Check viewport (either meta tag or Next.js viewport export)
  const hasViewportMeta = REQUIRED_PATTERNS.viewport.test(content);
  const hasViewportExport = /export\s+(?:const|let|var)\s+viewport\s*[:=]/i.test(content);
  if (!hasViewportMeta && !hasViewportExport) {
    issues.push("Missing viewport declaration (meta tag or viewport export)");
  }

  // Check lang attribute
  if (!REQUIRED_PATTERNS.lang.test(content)) {
    issues.push("Missing lang attribute on <html> element");
  }

  // Check if charset is early in the file (within first 1024 bytes of rendered HTML)
  const charsetMatch = content.match(/<head>[\s\S]*?<meta\s+charset/i);
  if (charsetMatch) {
    const charsetIndex = content.indexOf(charsetMatch[0]);
    const headIndex = content.indexOf("<head>");
    const bytesFromHead = charsetIndex - headIndex;
    
    // Conservative check: ensure charset appears early in the head section
    if (bytesFromHead > 800) {
      issues.push(`Charset declaration is ${bytesFromHead} bytes into <head> (should be <1024 bytes from start)`);
    }
  }

  if (issues.length > 0) {
    failures += 1;
    console.error(`✖ ${layoutPath}`);
    issues.forEach((issue) => console.error(`    • ${issue}`));
    console.error("");
  } else {
    console.log(`✓ ${layoutPath}`);
  }
}

console.log(`\nChecked ${checked} file(s).`);

if (failures > 0) {
  console.error(`✖ HTML meta tag check failed: ${failures} file(s) missing required tags.`);
  console.error("\nFix by adding to your layout.tsx <head> section:");
  console.error('  <head>');
  console.error('    <meta charSet="UTF-8" />');
  console.error('    <meta name="viewport" content="width=device-width, initial-scale=1" />');
  console.error('  </head>');
  console.error('And ensure <html> has lang attribute: <html lang="en">');
  process.exit(1);
}

console.log("✓ All layout files have required HTML meta tags.");
