#!/usr/bin/env node

/**
 * Next.js Image Optimization & Layout Stability Auditor
 *
 * Enforces Next.js 16 Image Optimization standards across apps/portal:
 *   1. Raw <img> Prevention: All UI/content images must use Next.js <Image /> (next/image)
 *      (except isolated error boundaries documented with bundle isolation traces).
 *   2. CLS Elimination: Every <Image /> from 'next/image' must specify either (width + height) OR fill.
 *   3. Accessibility: Every <Image /> must specify an alt attribute.
 *   4. Configuration Parity: apps/portal/next.config.mjs must declare modern formats,
 *      cache TTL, and restricted remotePatterns.
 *
 * Run: node tools/audits/audit-image-optimization.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..', '..');
const PORTAL_APP = path.join(ROOT, 'apps', 'portal');
const NEXT_CONFIG = path.join(PORTAL_APP, 'next.config.mjs');

console.log('\n🖼️  Initiating Next.js Image Optimization & Layout Stability Audit...\n');

const violations = [];
const warnings = [];
let filesScanned = 0;
let imagesValidated = 0;

// ── 1. Validate next.config.mjs Image Configuration ─────────────────────────
console.log('1️⃣  Validating Next.js image configuration in next.config.mjs...');
if (!fs.existsSync(NEXT_CONFIG)) {
  violations.push('apps/portal/next.config.mjs does not exist');
} else {
  const configContent = fs.readFileSync(NEXT_CONFIG, 'utf8');
  if (!configContent.includes('formats:')) {
    violations.push('next.config.mjs is missing images.formats configuration');
  } else {
    if (!configContent.includes('image/avif') || !configContent.includes('image/webp')) {
      violations.push('next.config.mjs images.formats must include both avif and webp');
    }
  }

  if (!configContent.includes('remotePatterns:')) {
    violations.push('next.config.mjs is missing images.remotePatterns configuration');
  }

  if (!configContent.includes('minimumCacheTTL:')) {
    warnings.push('next.config.mjs should specify minimumCacheTTL for production efficiency');
  }
}

// ── 2. Scan for Raw <img> and Validate <Image /> Usage ────────────────────────
console.log('2️⃣  Scanning application components for image optimization compliance...');

// Files allowed to use raw img (e.g., error boundary for bundle isolation)
const ALLOWED_RAW_IMG_FILES = new Set([
  path.join(PORTAL_APP, 'app', 'error.tsx'),
  path.join(PORTAL_APP, 'components', 'RouteBackground.tsx'), // Uses raw img as zero-JS fallback poster
]);

const files = glob.sync('**/*.{tsx,jsx}', {
  cwd: PORTAL_APP,
  ignore: [
    'node_modules/**',
    '.next/**',
    'out/**',
    'dist/**',
    '**/*.test.{tsx,jsx}',
    '**/*.spec.{tsx,jsx}',
  ],
  absolute: true,
});

filesScanned = files.length;

function stripComments(source) {
  // Strip block comments /* ... */ and JSX comments {/* ... */}
  let cleaned = source.replace(/{\/\*[\s\S]*?\*\/}/g, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  return cleaned;
}

for (const file of files) {
  const relPath = path.relative(ROOT, file);
  const rawContent = fs.readFileSync(file, 'utf8');
  const content = stripComments(rawContent);
  const lines = rawContent.split('\n');

  // Check 2a: Unoptimized <img tags
  if (!ALLOWED_RAW_IMG_FILES.has(file)) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match raw <img tags but avoid motion.img or comments
      if (
        /<img\b[^>]*>/i.test(line) &&
        !line.includes('//') &&
        !line.includes('/*') &&
        !line.includes('{/*')
      ) {
        violations.push(
          `${relPath}:${i + 1} - Raw <img> tag detected. Use Next.js <Image /> from 'next/image' for automatic optimization and CLS elimination.`
        );
      }
    }
  }

  // Check 2b: Validate <Image properties ONLY if imported from 'next/image'
  const importsNextImage = /import\s+(?:Image|{[^}]*Image[^}]*})\s+from\s+['"]next\/image['"]/.test(
    rawContent
  );

  if (importsNextImage) {
    const imageRegex = /<Image\b([^>]*?)(\/?>)/gs;
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
      imagesValidated++;
      const attrs = match[1];
      const matchIndex = match.index;
      const lineNumber = rawContent.substring(0, matchIndex).split('\n').length;

      // Check for alt attribute
      const hasAlt = /\balt\s*=\s*({[^}]+}|"[^"]*"|'[^']*')/i.test(attrs);
      if (!hasAlt) {
        violations.push(
          `${relPath}:${lineNumber} - <Image /> is missing required 'alt' attribute.`
        );
      }

      // Check for dimension stability: either fill or (width and height)
      const hasFill = /\bfill\b/i.test(attrs);
      const hasWidth = /\bwidth\s*=\s*/i.test(attrs);
      const hasHeight = /\bheight\s*=\s*/i.test(attrs);

      // If it uses statically imported image object, width and height can be inferred automatically
      const hasStaticSrc = /\bsrc\s*=\s*{[A-Z][a-zA-Z0-9_]*}/.test(attrs);

      if (!hasFill && !(hasWidth && hasHeight) && !hasStaticSrc) {
        violations.push(
          `${relPath}:${lineNumber} - <Image /> must specify either 'fill' or explicit 'width' and 'height' to eliminate Cumulative Layout Shift (CLS).`
        );
      }

      // Check sizes attribute when fill is used
      if (hasFill && !/\bsizes\s*=\s*/i.test(attrs)) {
        warnings.push(
          `${relPath}:${lineNumber} - <Image fill /> should include a 'sizes' attribute to prevent loading unnecessarily large responsive images.`
        );
      }
    }
  }
}

// ── Summary Report ──────────────────────────────────────────────────────────
console.log('\n📊 Image Optimization Audit Summary:');
console.log(`   • Scanned Files: ${filesScanned}`);
console.log(`   • Validated <Image /> Elements: ${imagesValidated}`);
console.log(`   • Violations: ${violations.length}`);
console.log(`   • Warnings: ${warnings.length}\n`);

if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  for (const w of warnings) {
    console.log(`   ${w}`);
  }
  console.log('');
}

if (violations.length > 0) {
  console.error('❌ Audit Failed with Violations:');
  for (const v of violations) {
    console.error(`   • ${v}`);
  }
  console.log('');
  process.exit(1);
}

console.log('✅ Image Optimization Audit Passed: 100% adherence to Next.js 16 standards!\n');
process.exit(0);
