/* eslint-disable no-console */
/**
 * Generate TypeScript types from the OpenAPI specification
 *
 * This script fetches the OpenAPI spec from the /api/doc endpoint and generates
 * TypeScript types using openapi-typescript. The generated types can be used to
 * validate that API routes match the contract definitions.
 *
 * Usage:
 *   pnpm --filter @repo/contract openapi:generate
 *
 * Environment variables:
 *   API_URL: The base URL of the API (default: http://localhost:3000)
 *   SPEC_FILE: Path to a local OpenAPI spec JSON file (optional, skips API fetch)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const API_URL = process.env.API_URL || "http://localhost:3000";
const SPEC_FILE = process.env.SPEC_FILE;
const OUTPUT_DIR = path.join(__dirname, "..", "src", "generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "openapi.types.ts");

async function fetchOpenAPISpec() {
  if (SPEC_FILE) {
    console.log(`Reading OpenAPI spec from local file: ${SPEC_FILE}`);
    const specContent = fs.readFileSync(SPEC_FILE, "utf-8");
    return JSON.parse(specContent);
  }

  console.log(`Fetching OpenAPI spec from ${API_URL}/api/doc...`);
  try {
    const response = await fetch(`${API_URL}/api/doc`);
    if (!response.ok) {
      throw new Error(`Failed to fetch spec: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching OpenAPI spec:", error.message);
    console.error(
      "\nMake sure the dev server is running or provide a SPEC_FILE environment variable.",
    );
    console.error(
      `Example: SPEC_FILE=./openapi-spec.json pnpm --filter @repo/contract openapi:generate`,
    );
    process.exit(1);
  }
}

async function generateTypes(spec) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write spec to temporary file
  const tempSpecFile = path.join(__dirname, "temp-openapi.json");
  fs.writeFileSync(tempSpecFile, JSON.stringify(spec, null, 2));

  try {
    console.log("Generating TypeScript types from OpenAPI spec...");
    // Use openapi-typescript CLI
    execSync(`npx openapi-typescript ${tempSpecFile} -o ${OUTPUT_FILE}`, { stdio: "inherit" });
    console.log(`✓ Generated types saved to ${OUTPUT_FILE}`);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempSpecFile)) {
      fs.unlinkSync(tempSpecFile);
    }
  }
}

async function main() {
  const spec = await fetchOpenAPISpec();
  await generateTypes(spec);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
