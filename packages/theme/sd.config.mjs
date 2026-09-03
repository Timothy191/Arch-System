/* eslint-disable no-console */
import StyleDictionary from "style-dictionary";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import prettier from "prettier";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use built-in web transforms
const sd = new StyleDictionary({
  source: ["tokens.json"],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: "src/css/",
      files: [
        {
          destination: "variables-generated.css",
          format: "css/variables",
          options: {
            outputReferences: true,
            showFileHeader: true,
          },
        },
      ],
    },
    ts: {
      transformGroup: "js",
      buildPath: "src/tokens/",
      files: [
        {
          destination: "generated-sd.ts",
          format: "javascript/module",
        },
      ],
    },
    json: {
      buildPath: "src/tokens/",
      files: [
        {
          destination: "tokens-hsl.json",
          format: "json/nested",
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();

// AGENT-TRACE: Format generated outputs with Prettier to guarantee 0-drift and canonical repo formatting.
const generatedFiles = [
  resolve(__dirname, "src/css/variables-generated.css"),
  resolve(__dirname, "src/tokens/generated-sd.ts"),
  resolve(__dirname, "src/tokens/tokens-hsl.json"),
];

for (const filePath of generatedFiles) {
  try {
    const raw = readFileSync(filePath, "utf8");
    const config = (await prettier.resolveConfig(filePath)) || {};
    const formatted = await prettier.format(raw, {
      ...config,
      filepath: filePath,
    });
    writeFileSync(filePath, formatted, "utf8");
  } catch (err) {
    console.warn(`⚠️ Warning: Could not format ${filePath} with Prettier:`, err);
  }
}

console.log("✅ Style Dictionary build and formatting complete!");
