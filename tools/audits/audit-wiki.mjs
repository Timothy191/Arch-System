#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const WIKI_ROOT = path.resolve(process.cwd(), 'docs/wiki');
const INDEX_PATH = path.join(WIKI_ROOT, 'index.md');
const REQUIRED_FRONTMATTER_KEYS = ['title:', 'created:', 'updated:', 'type:', 'tags:'];
const GOVERNED_SUBDIRS = ['entities', 'concepts', 'comparisons', 'queries'];
const MARKDOWN_EXT = '.md';
const HTML_EXT = '.html';
const FRONTMATTER_DELIMITER = '---\n';
const FRONTMATTER_CLOSE_OFFSET = 4;

function collectWikiFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return collectWikiFiles(fullPath);
    }
    const isWikiDoc = entry.name.endsWith(MARKDOWN_EXT) || entry.name.endsWith(HTML_EXT);
    return isWikiDoc ? [fullPath] : [];
  });
}

function buildKnownSlugSet(allFilePaths) {
  const slugSet = new Set();
  for (const filePath of allFilePaths) {
    const relativeSlug = path
      .relative(WIKI_ROOT, filePath)
      .replace(/\.(md|html)$/, '')
      .toLowerCase();
    const baseSlug = path
      .basename(filePath)
      .replace(/\.(md|html)$/, '')
      .toLowerCase();
    slugSet.add(relativeSlug);
    slugSet.add(baseSlug);
  }
  return slugSet;
}

function extractWikilinks(markdownText) {
  const withoutCodeBlocks = markdownText.replace(/```[\s\S]*?```/g, '');
  const wikilinkPattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  const targets = [];
  for (const match of withoutCodeBlocks.matchAll(wikilinkPattern)) {
    const rawTarget = match[1]?.trim().replace(/\\$/, '').toLowerCase();
    if (rawTarget) {
      targets.push(rawTarget);
    }
  }
  return targets;
}

function validateFrontmatter(filePath, content) {
  const relativeFile = path.relative(process.cwd(), filePath);
  if (!content.startsWith(FRONTMATTER_DELIMITER)) {
    return [`${relativeFile}: missing YAML frontmatter block`];
  }
  const closingIndex = content.indexOf(`\n${FRONTMATTER_DELIMITER}`, FRONTMATTER_CLOSE_OFFSET);
  if (closingIndex === -1) {
    return [`${relativeFile}: unclosed YAML frontmatter block`];
  }
  const frontmatterBlock = content.slice(FRONTMATTER_CLOSE_OFFSET, closingIndex);
  return REQUIRED_FRONTMATTER_KEYS.filter(
    (requiredKey) => !frontmatterBlock.includes(requiredKey)
  ).map((missingKey) => `${relativeFile}: frontmatter missing required field "${missingKey}"`);
}

function runWikiAudit() {
  const allWikiFiles = collectWikiFiles(WIKI_ROOT);
  const knownSlugs = buildKnownSlugSet(allWikiFiles);
  const governedFiles = GOVERNED_SUBDIRS.flatMap((subdir) =>
    collectWikiFiles(path.join(WIKI_ROOT, subdir)).filter((filePath) =>
      filePath.endsWith(MARKDOWN_EXT)
    )
  );

  const indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
  const indexedSlugs = new Set(extractWikilinks(indexContent));
  const auditErrors = [];

  for (const linkTarget of extractWikilinks(indexContent)) {
    if (!knownSlugs.has(linkTarget)) {
      auditErrors.push(`docs/wiki/index.md: broken wikilink [[${linkTarget}]]`);
    }
  }

  for (const filePath of governedFiles) {
    const relativeFile = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    auditErrors.push(...validateFrontmatter(filePath, content));

    for (const linkTarget of extractWikilinks(content)) {
      if (!knownSlugs.has(linkTarget)) {
        auditErrors.push(`${relativeFile}: broken wikilink [[${linkTarget}]]`);
      }
    }

    const relativeSlug = path.relative(WIKI_ROOT, filePath).replace(/\.md$/, '').toLowerCase();
    const baseSlug = path.basename(filePath).replace(/\.md$/, '').toLowerCase();
    if (!indexedSlugs.has(relativeSlug) && !indexedSlugs.has(baseSlug)) {
      auditErrors.push(`${relativeFile}: page is not listed in docs/wiki/index.md`);
    }
  }

  if (auditErrors.length > 0) {
    console.error(`❌ [WIKI AUDIT] Found ${auditErrors.length} issue(s):`);
    for (const errLine of auditErrors) {
      console.error(`  - ${errLine}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ [WIKI AUDIT] Passed (${governedFiles.length} governed wiki pages verified, 0 broken wikilinks, 0 unindexed pages).`
  );
}

runWikiAudit();
