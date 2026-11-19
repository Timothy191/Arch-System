/* eslint-disable no-console */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import StyleDictionary from 'style-dictionary';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use built-in web transforms
const sd = new StyleDictionary({
  source: ['tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'src/css/',
      files: [
        {
          destination: 'variables-generated.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
            showFileHeader: true,
          },
        },
      ],
    },
    ts: {
      transformGroup: 'js',
      buildPath: 'src/tokens/',
      files: [
        {
          destination: 'generated-sd.ts',
          format: 'javascript/module',
        },
      ],
    },
    json: {
      buildPath: 'src/tokens/',
      files: [
        {
          destination: 'tokens-hsl.json',
          format: 'json/nested',
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();

/** Resolve Prettier module locally or via Style Dictionary's dependency tree. */
function loadPrettierModule() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire('prettier');
  } catch {
    const sdRequire = createRequire(localRequire.resolve('style-dictionary'));
    return sdRequire('prettier');
  }
}

/** Format generated CSS variables with Prettier matching the root config. */
async function formatGeneratedCss(cssFilePath, prettierConfigPath) {
  try {
    const prettier = loadPrettierModule();
    const prettierConfig = existsSync(prettierConfigPath)
      ? (await import(pathToFileURL(prettierConfigPath).href)).default
      : {};
    const rawCss = readFileSync(cssFilePath, 'utf8');
    const formattedCss = await prettier.format(rawCss, {
      ...prettierConfig,
      filepath: cssFilePath,
    });
    if (formattedCss !== rawCss) {
      writeFileSync(cssFilePath, formattedCss, 'utf8');
    }
    return;
  } catch {
    // Fallback to CLI Prettier if module resolution fails
  }

  const rootPrettierBin = resolve(__dirname, '../../node_modules/.bin/prettier');
  const prettierCmd = existsSync(rootPrettierBin) ? `"${rootPrettierBin}"` : 'pnpm exec prettier';
  try {
    execSync(`${prettierCmd} --write --config "${prettierConfigPath}" "${cssFilePath}"`, {
      stdio: 'ignore',
    });
  } catch (_err) {
    console.warn(`⚠️ Warning: Could not format ${cssFilePath} with Prettier.`);
  }
}

// AGENT-TRACE: Skip formatting generated outputs in Vercel to avoid npx biome resolution crashes.
const generatedFiles = [
  resolve(__dirname, 'src/tokens/generated-sd.ts'),
  resolve(__dirname, 'src/tokens/tokens-hsl.json'),
];
const cssOutputPath = resolve(__dirname, 'src/css/variables-generated.css');
const prettierConfigPath = resolve(__dirname, '../../prettier.config.mjs');

if (!process.env.VERCEL) {
  await formatGeneratedCss(cssOutputPath, prettierConfigPath);
  for (const filePath of generatedFiles) {
    try {
      execSync(`npx biome format --write ${filePath}`, { stdio: 'ignore' });
    } catch (_err) {
      console.warn(`⚠️ Warning: Could not format ${filePath} with Biome.`);
    }
  }
}

console.log('✅ Style Dictionary build and formatting complete!');
