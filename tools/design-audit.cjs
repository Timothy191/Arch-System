#!/usr/bin/env node

/**
 * @fileoverview Audits design system compliance across the codebase (e.g., verifying OKLCH tokens and shadow usage).
 * Usage: node tools/design-audit.cjs
 */
/**
 * Static Design System Compliance Auditor
 * Checks the codebase (apps/portal, packages/ui, packages/theme) for visual style compliance.
 *
 * Checks:
 *   1. Forced Light-Theme compliance (no 'dark:' Tailwind classes or selectors)
 *   2. Shadow token enforcement (no raw CSS 'box-shadow' or unapproved Tailwind shadow-* utilities)
 *   3. Named Lucide icon imports (no wildcard 'import * as Icons' from 'lucide-react')
 *   4. Safe animations constraint (no animating layout properties: width, height, top, bottom, left, right, margin, padding)
 *
 * Usage: node tools/design-audit.cjs
 * Output: documentation/03-audit-reports/design-report.md
 * Exit Code: 0 on clean run, 1 if critical violations found (CI gate).
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = process.env.AUDIT_DIR || path.join(ROOT, "documentation", "03-audit-reports");
const REPORT_PATH = path.join(REPORT_DIR, "design-report.md");

const TARGET_DIRS = [
  path.join(ROOT, "apps", "portal"),
  path.join(ROOT, "packages", "ui"),
  path.join(ROOT, "packages", "theme"),
];

const EXCLUDE_DIRS = [
  ".next",
  "dist",
  "node_modules",
  ".nx",
  "build",
  "out",
  ".git",
  "public",
  "__snapshots__",
  "coverage",
];

// Load tokens to dynamically get allowed shadows
let ALLOWED_SHADOWS;
try {
  const tokensPath = path.join(ROOT, "packages", "theme", "tokens.json");
  const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8"));

  // Extract all keys starting with 'shadow-' from tokens.json
  const tokenShadows = Object.keys(tokens).filter((k) => k.startsWith("shadow-"));

  // Combine with standard allowed Tailwind/Tremor shadows that aren't explicit tokens
  ALLOWED_SHADOWS = new Set([
    ...tokenShadows,
    "shadow-sm",
    "shadow-md",
    "shadow-lg",
    "shadow-none",
    "shadow-inner",
    "shadow-tremor-input",
    "shadow-tremor-card",
    "shadow-tremor-dropdown",
    "shadow-glass-depth",
    "shadow-glass-depth-hover",
    "shadow-glass-depth-active",
    "shadow-liquid-depth-hover",
    "shadow-diffusion-cyan",
    "shadow-glow-mint",
  ]);
} catch (e) {
  console.error("Failed to parse tokens.json for shadow validation", e);
  process.exit(1);
}

// Track violations: { file, line, type, content, severity, description }
const violations = [];
let filesScanned = 0;

/**
 * Recursively walks a directory and invokes a callback on matching source/style files.
 *
 * @param {string} dir - The directory path to walk.
 * @param {function(string): void} callback - The callback function to invoke on matching files.
 * @returns {void}
 */
function walkDir(dir, callback) {
  let list;
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return;
  }
  for (const entry of list) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      walkDir(res, callback);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if ([".ts", ".tsx", ".js", ".jsx", ".css"].includes(ext)) {
        if (
          entry.name.includes(".stories.") ||
          entry.name.includes(".test.") ||
          entry.name.includes(".spec.")
        ) {
          continue;
        }
        callback(res);
      }
    }
  }
}

/**
 * Audits a single file against the design system guidelines.
 *
 * @param {string} filePath - The absolute path of the file to audit.
 * @returns {void}
 */
function auditFile(filePath) {
  const relPath = path.relative(ROOT, filePath);
  if (relPath.includes("packages/theme") || relPath === "packages/ui/src/globals.css") {
    return;
  }
  filesScanned++;
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const isCSS = filePath.endsWith(".css");
  const isCode = !isCSS;

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Skip comment lines
    const trimmed = lineText.trim();
    if (isCode && (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")))
      return;
    if (isCSS && (trimmed.startsWith("/*") || trimmed.startsWith("*"))) return;

    // Check 1: Dark Mode / 'dark:' classes (Critical)
    // Avoid false positives in config files, scripts, or comments (like "data-theme='light'")
    if (lineText.includes("dark:") && !relPath.includes("tailwind.config")) {
      violations.push({
        file: relPath,
        line: lineNum,
        type: "DARK_MODE",
        content: trimmed,
        severity: "CRITICAL",
        description: "Use of 'dark:' responsive class is forbidden. Theme is strictly light-only.",
      });
    }

    // Check 2: Forbidden Shadows (Critical)
    if (isCode) {
      // Find all shadow-[a-zA-Z0-9-]+ occurrences in the line
      const shadowMatches = lineText.match(/\bshadow-[a-zA-Z0-9-]+\b/g);
      if (shadowMatches) {
        shadowMatches.forEach((shadow) => {
          if (!ALLOWED_SHADOWS.has(shadow)) {
            violations.push({
              file: relPath,
              line: lineNum,
              type: "FORBIDDEN_SHADOW",
              content: shadow,
              severity: "CRITICAL",
              description: `Raw Tailwind shadow class '${shadow}' is forbidden. Use only approved tokens (shadow-sm, shadow-md, shadow-lg, shadow-card, shadow-window, shadow-diffusion-*).`,
            });
          }
        });
      }
    }

    if (isCSS) {
      if (lineText.includes("box-shadow:") && !lineText.includes("var(--shadow-")) {
        violations.push({
          file: relPath,
          line: lineNum,
          type: "FORBIDDEN_SHADOW",
          content: trimmed,
          severity: "CRITICAL",
          description:
            "Raw CSS 'box-shadow' property is forbidden. Use token variables like var(--shadow-sm), var(--shadow-md), etc.",
        });
      }
    }

    // Check 3: Wildcard Lucide Imports (Warning)
    if (isCode && lineText.includes('from "lucide-react"')) {
      if (lineText.includes("import * as")) {
        violations.push({
          file: relPath,
          line: lineNum,
          type: "WILDCARD_ICON",
          content: trimmed,
          severity: "WARNING",
          description:
            "Wildcard import from 'lucide-react' causes bundle bloat. Use named imports instead (e.g. import { Drill } from 'lucide-react').",
        });
      }
    }

    // Check 4: Unsafe Animations (Critical/Warning)
    // Framer motion properties animation checking
    if (isCode && (lineText.includes("animate={{") || lineText.includes("transition={{"))) {
      const unsafeProps = [
        "width",
        "height",
        "top",
        "bottom",
        "left",
        "right",
        "margin",
        "padding",
      ];
      unsafeProps.forEach((prop) => {
        const regex = new RegExp(`\\b${prop}\\s*:`, "i");
        if (regex.test(lineText)) {
          violations.push({
            file: relPath,
            line: lineNum,
            type: "UNSAFE_ANIMATION",
            content: `${prop} in motion declaration`,
            severity: "CRITICAL",
            description: `Animating layout-inducing property '${prop}' causes reflow and lag. Animate opacity, transform, or colors instead.`,
          });
        }
      });
    }

    if (isCSS && (lineText.includes("transition:") || lineText.includes("transition-property:"))) {
      const unsafeProps = [
        "width",
        "height",
        "top",
        "bottom",
        "left",
        "right",
        "margin",
        "padding",
      ];
      unsafeProps.forEach((prop) => {
        const regex = new RegExp(`\\b${prop}\\b`, "i");
        if (regex.test(lineText)) {
          violations.push({
            file: relPath,
            line: lineNum,
            type: "UNSAFE_ANIMATION",
            content: trimmed,
            severity: "CRITICAL",
            description: `CSS transition includes layout property '${prop}', which triggers layout recalculations on every frame. Transition opacity or transform instead.`,
          });
        }
      });
    }
  });
}

/**
 * Compiles design system violations and formats a Markdown report.
 *
 * @returns {string} The formatted Markdown report.
 */
function generateReport() {
  const critical = violations.filter((v) => v.severity === "CRITICAL");
  const warnings = violations.filter((v) => v.severity === "WARNING");

  const lines = [];
  lines.push("# Design System Compliance Audit Report");
  lines.push("");
  lines.push(`Generated by \`tools/design-audit.cjs\` on ${new Date().toISOString()}.`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Files Scanned**: ${filesScanned}`);
  lines.push(`- **Critical Violations**: ${critical.length} 🛑`);
  lines.push(`- **Warnings**: ${warnings.length} ⚠️`);
  lines.push("");

  if (critical.length > 0) {
    lines.push("## 🛑 CRITICAL VIOLATIONS (Must Fix)");
    lines.push("");
    lines.push("| File | Line | Type | Violation | Description |");
    lines.push("| --- | --- | --- | --- | --- |");
    critical.forEach((v) => {
      lines.push(
        `| [${path.basename(v.file)}](file://${path.resolve(ROOT, v.file)}#L${v.line}) | ${v.line} | \`${v.type}\` | \`${v.content}\` | ${v.description} |`,
      );
    });
    lines.push("");
  } else {
    lines.push("## 🟢 Critical Violations");
    lines.push("");
    lines.push("_None! The codebase conforms to the primary visual rules of the design system._");
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("## ⚠️ WARNINGS (Review Recommended)");
    lines.push("");
    lines.push("| File | Line | Type | Snippet | Description |");
    lines.push("| --- | --- | --- | --- | --- |");
    warnings.forEach((v) => {
      lines.push(
        `| [${path.basename(v.file)}](file://${path.resolve(ROOT, v.file)}#L${v.line}) | ${v.line} | \`${v.type}\` | \`${v.content}\` | ${v.description} |`,
      );
    });
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Main entry point of the design auditor.
 * Resolves project directories, scans files, prints summary, writes report, and exits.
 *
 * @returns {void}
 */
function main() {
  console.log("Initiating Design System Compliance Audit...");

  TARGET_DIRS.forEach((dir) => {
    if (fs.existsSync(dir)) {
      walkDir(dir, auditFile);
    }
  });

  const report = generateReport();

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, report);

  console.log(`Scan Complete. Scanned ${filesScanned} files.`);
  console.log(
    `Found ${violations.filter((v) => v.severity === "CRITICAL").length} critical violations and ${violations.filter((v) => v.severity === "WARNING").length} warnings.`,
  );
  console.log(`Report written to: ${path.relative(ROOT, REPORT_PATH)}`);

  const criticalCount = violations.filter((v) => v.severity === "CRITICAL").length;
  if (criticalCount > 0) {
    console.error(`\n❌ Audit failed: ${criticalCount} design compliance violation(s) found.`);
    process.exit(1);
  }

  console.log("\n✅ Design compliance check passed successfully!");
  process.exit(0);
}

main();
