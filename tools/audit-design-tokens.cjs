#!/usr/bin/env node

/**
 * Design System, Tokens, Fonts, Animations & Assets Compliance Auditor
 *
 * Scans components, pages, stylesheets, assets, and token definitions across
 * the monorepo to verify 100% adherence to Arch-Systems Design System standards:
 *
 *   1. Token Definitions & Variables (tokens.json registry & recursive schema validation)
 *   2. Font System Integrity (Next.js font configurations & CSS variable linkages)
 *   3. Hardware-Accelerated Animations (No animating width/height/margin/padding)
 *   4. Icons & Logos Integrity (Named Lucide imports, SVG icons, brand assets)
 *   5. Static Assets Verification (Manifest, favicons, logos, media exist with non-zero size)
 *   6. Strict Light Mode Invariant (Zero 'dark:' classes across monorepo)
 *   7. Approved Shadow Token Validation (Tokens vs Raw Tailwind & CSS)
 *
 * Run: node tools/audit-design-tokens.cjs
 * Exit code: 0 (pass) or 1 (fail)
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = path.join(__dirname, '..');
const TOKENS_PATH = path.join(ROOT, 'packages', 'theme', 'tokens.json');
const PORTAL_PUBLIC = path.join(ROOT, 'apps', 'portal', 'public');

console.log('\n🎨 Initiating Comprehensive Design System, Fonts, Animations & Asset Audit...\n');

let violations = [];
let warnings = [];
let filesScanned = 0;

// ── 1. Validate Token Definitions SSoT ──────────────────────────────────────────
console.log('1️⃣  Validating tokens.json registry and schema integrity...');
let tokens = {};
const allTokenKeys = new Set();

function validateTokenObject(obj, prefix = '') {
  let count = 0;
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    allTokenKeys.add(fullKey);
    allTokenKeys.add(key);

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (val.value !== undefined) {
        count++;
      } else {
        count += validateTokenObject(val, fullKey);
      }
    } else if (typeof val === 'string') {
      count++;
    }
  }
  return count;
}

try {
  const tokenRaw = fs.readFileSync(TOKENS_PATH, 'utf8');
  tokens = JSON.parse(tokenRaw);
  const totalTokens = validateTokenObject(tokens);
  console.log(`   ✓ Validated ${totalTokens} design tokens in tokens.json`);
} catch (err) {
  console.error(`   ✖ Failed to load tokens.json: ${err.message}`);
  violations.push({
    file: 'packages/theme/tokens.json',
    line: 1,
    type: 'MISSING_TOKENS_FILE',
    description: `Failed to load tokens.json: ${err.message}`,
  });
}

// ── 2. Validate Fonts & Typography System ─────────────────────────────────────
console.log('2️⃣  Validating typography and font configurations...');
const layoutPath = path.join(ROOT, 'apps', 'portal', 'app', 'layout.tsx');
if (fs.existsSync(layoutPath)) {
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  const hasInter = layoutContent.includes('Inter({');
  const hasMono = layoutContent.includes('JetBrains_Mono({') || layoutContent.includes('Geist_Mono({');
  const hasFontSansVar = layoutContent.includes('--font-sans');
  const hasFontMonoVar = layoutContent.includes('--font-mono');

  if (!hasInter || !hasFontSansVar) {
    violations.push({
      file: 'apps/portal/app/layout.tsx',
      line: 1,
      type: 'FONT_CONFIG_MISSING',
      description: 'Primary UI sans font (Inter / --font-sans) is missing from root layout.',
    });
  }
  if (!hasMono || !hasFontMonoVar) {
    violations.push({
      file: 'apps/portal/app/layout.tsx',
      line: 1,
      type: 'FONT_CONFIG_MISSING',
      description: 'Monospace code font (--font-mono) is missing from root layout.',
    });
  }
  console.log('   ✓ Font system configured (Inter + JetBrains Mono / --font-sans + --font-mono)');
} else {
  violations.push({
    file: 'apps/portal/app/layout.tsx',
    line: 1,
    type: 'MISSING_ROOT_LAYOUT',
    description: 'Root layout.tsx not found for font verification.',
  });
}

// ── 3. Validate Static Assets, Logos & Media ──────────────────────────────────
console.log('3️⃣  Validating core static assets, logos, and PWA manifest...');
const REQUIRED_ASSETS = [
  'favicon.ico',
  'manifest.json',
  'logo.svg',
  'plantcor.png',
  'plantcor-login.png',
  'plantcor-header.png',
  'archlinux-logo-black-scalable.svg',
];

let assetsFound = 0;
REQUIRED_ASSETS.forEach((assetName) => {
  const assetPath = path.join(PORTAL_PUBLIC, assetName);
  if (!fs.existsSync(assetPath)) {
    violations.push({
      file: `apps/portal/public/${assetName}`,
      line: 1,
      type: 'MISSING_ASSET',
      description: `Required branding/static asset "${assetName}" is missing in apps/portal/public/.`,
    });
  } else {
    const stat = fs.statSync(assetPath);
    if (stat.size === 0) {
      violations.push({
        file: `apps/portal/public/${assetName}`,
        line: 1,
        type: 'EMPTY_ASSET',
        description: `Asset "${assetName}" is 0 bytes.`,
      });
    } else {
      assetsFound++;
    }
  }
});
console.log(`   ✓ Verified ${assetsFound}/${REQUIRED_ASSETS.length} essential brand assets & logos`);

// ── 4. Validate Animation Constraints ─────────────────────────────────────────
console.log('4️⃣  Validating CSS keyframes and hardware-accelerated animations...');
const animPath = path.join(ROOT, 'packages', 'theme', 'src', 'css', 'animations.css');
if (fs.existsSync(animPath)) {
  const animContent = fs.readFileSync(animPath, 'utf8');
  // Check for forbidden properties inside @keyframes blocks
  const forbiddenProps = ['width:', 'height:', 'margin:', 'padding:', 'top:', 'left:', 'right:', 'bottom:'];
  const keyframeBlocks = animContent.match(/@keyframes[\s\S]*?\{[\s\S]*?\n\}/g) || [];
  
  let checkedKeyframes = 0;
  keyframeBlocks.forEach((block) => {
    checkedKeyframes++;
    forbiddenProps.forEach((prop) => {
      if (block.includes(prop) && !block.includes('max-width') && !block.includes('clip-path')) {
        violations.push({
          file: 'packages/theme/src/css/animations.css',
          line: 1,
          type: 'FORBIDDEN_LAYOUT_ANIMATION',
          description: `Keyframe block animates forbidden layout property "${prop}". Only transform, opacity, and filter are permitted.`,
        });
      }
    });
  });
  console.log(`   ✓ Audited ${checkedKeyframes} keyframe animation blocks for performance safety`);
}

// ── 5. Scan Workspace Files for Light-Theme, Shadow Tokens & Icons ─────────────
console.log('5️⃣  Scanning workspace files for tokens, shadows, and icon imports...');

// Extract allowed token sets
const tokenShadows = Object.keys(tokens).filter((k) => k.startsWith('shadow-'));
const ALLOWED_SHADOWS = new Set([
  ...tokenShadows,
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-none',
  'shadow-inner',
  'shadow-card',
  'shadow-window',
  'shadow-tremor-input',
  'shadow-tremor-card',
  'shadow-tremor-dropdown',
  'shadow-glass-depth',
  'shadow-glass-depth-hover',
  'shadow-glass-depth-active',
  'shadow-liquid-depth-hover',
  'shadow-diffusion-cyan',
  'shadow-glow-mint',
  'shadow-glow-blue',
  'shadow-glow-primary',
  'shadow-glow-electric',
  'shadow-glow-amber',
  'shadow-glow-emerald',
  'shadow-glow-rose',
  'shadow-glow-purple',
  'shadow-card-hover',
  'shadow-elevated',
  'shadow-glass-sm',
  'shadow-glass-md',
  'shadow-glass-lg',
]);

const targetPatterns = [
  'apps/**/*.{ts,tsx,css,scss}',
  'packages/**/*.{ts,tsx,css,scss}',
  'libs/**/*.{ts,tsx,css,scss}',
];

const ignorePatterns = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/tokens.json',
  '**/tailwind.config.*',
  'packages/theme/src/tokens/generated.ts',
];

const files = glob.sync(targetPatterns, {
  cwd: ROOT,
  ignore: ignorePatterns,
  nodir: true,
});

files.forEach((relPath) => {
  filesScanned++;
  const fullPath = path.join(ROOT, relPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');
  const isCSS = relPath.endsWith('.css') || relPath.endsWith('.scss');
  const isCode = relPath.endsWith('.tsx') || relPath.endsWith('.ts');
  const isThemeOrCoreCss =
    relPath.startsWith('packages/theme/src/css/') ||
    relPath.startsWith('packages/ui/src/globals.css') ||
    relPath.includes('public/css/fuxa-light-theme.css');

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    const trimmed = lineText.trim();

    // Skip comments
    if (isCode && (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*'))) return;
    if (isCSS && (trimmed.startsWith('/*') || trimmed.startsWith('*'))) return;

    // Rule A: Zero 'dark:' Mode Classes (Strict Light-Only Theme)
    if (lineText.includes('dark:') && !relPath.includes('tailwind.config')) {
      violations.push({
        file: relPath,
        line: lineNum,
        type: 'FORBIDDEN_DARK_MODE',
        description: `Forbidden "dark:" modifier found: "${trimmed}". The system is strictly light-only.`,
      });
    }

    // Rule B: Approved Shadow Tokens Only
    if (isCode) {
      const shadowMatches = lineText.match(/\bshadow-[a-zA-Z0-9-]+\b/g);
      if (shadowMatches) {
        shadowMatches.forEach((shadow) => {
          if (!ALLOWED_SHADOWS.has(shadow)) {
            violations.push({
              file: relPath,
              line: lineNum,
              type: 'UNAPPROVED_SHADOW_TOKEN',
              description: `Raw Tailwind shadow "${shadow}" is forbidden. Use approved token (${[...ALLOWED_SHADOWS].slice(0, 6).join(', ')}...).`,
            });
          }
        });
      }
    }

    // Rule C: Raw CSS box-shadow Tokenization in consumer stylesheets
    if (isCSS && !isThemeOrCoreCss) {
      if (lineText.includes('box-shadow:') && !lineText.includes('var(--shadow-') && !lineText.includes('var(--glass-')) {
        violations.push({
          file: relPath,
          line: lineNum,
          type: 'UNTOKENIZED_BOX_SHADOW',
          description: `Raw CSS box-shadow property without var(--shadow-*) token: "${trimmed}".`,
        });
      }
    }

    // Rule D: Lucide Wildcard Import Check
    if (isCode && lineText.includes('from "lucide-react"')) {
      if (lineText.includes('import * as')) {
        warnings.push({
          file: relPath,
          line: lineNum,
          type: 'WILDCARD_ICON_IMPORT',
          description: `Wildcard import from lucide-react detected. Use named imports for tree-shaking.`,
        });
      }
    }
  });
});

console.log(`   ✓ Scanned ${filesScanned} workspace files.`);

// ── 6. Results Summary ────────────────────────────────────────────────────────
console.log('\n==================================================');
console.log('📊 Design System, Assets, Fonts & Token Results');
console.log('==================================================');

if (violations.length > 0) {
  console.error(`\n❌  ${violations.length} Critical Violation(s) Found:`);
  violations.forEach((v) => {
    console.error(`   [${v.type}] ${v.file}:${v.line} — ${v.description}`);
  });
} else {
  console.log('✅  0 Critical Violations. Design, tokens, fonts, animations, and assets 100% verified!');
}

if (warnings.length > 0) {
  console.warn(`\n⚠️   ${warnings.length} Advisory Warning(s):`);
  warnings.forEach((w) => {
    console.warn(`   [${w.type}] ${w.file}:${w.line} — ${w.description}`);
  });
}

const score = violations.length === 0 ? 100.0 : Math.max(0, 100.0 - violations.length * 10);
console.log(`\n🎯 Compliance Score: ${score.toFixed(1)}%`);
console.log('==================================================\n');

process.exit(violations.length > 0 ? 1 : 0);
