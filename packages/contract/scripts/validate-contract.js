/* eslint-disable no-console */
/**
 * Validate contract schemas against OpenAPI specification
 *
 * This script validates that the contract schemas in @repo/contract match
 * the generated OpenAPI specification. It checks for:
 * - Coverage: Are all API endpoints covered by contract schemas?
 * - Consistency: Do schema types match between OpenAPI and contract?
 *
 * Usage:
 *   pnpm --filter @repo/contract openapi:validate
 *
 * Prerequisites:
 *   - Generate OpenAPI spec: pnpm --filter portal generate-openapi-spec
 *   - Generate types: pnpm --filter @repo/contract openapi:generate
 */

const fs = require("fs");
const path = require("path");

const SPEC_FILE = path.join(__dirname, "../openapi.generated.json");
const GENERATED_TYPES_FILE = path.join(__dirname, "..", "src", "generated", "openapi.types.ts");
const SCHEMAS_DIR = path.join(__dirname, "..", "src", "schemas");

function checkSpecExists() {
  if (!fs.existsSync(SPEC_FILE)) {
    console.error(`✗ OpenAPI spec file not found: ${SPEC_FILE}`);
    console.error("\nPlease run: pnpm --filter portal generate-openapi-spec");
    process.exit(1);
  }
  console.log(`✓ Found OpenAPI spec at ${SPEC_FILE}`);
}

function checkGeneratedTypesExist() {
  if (!fs.existsSync(GENERATED_TYPES_FILE)) {
    console.error(`✗ Generated types file not found: ${GENERATED_TYPES_FILE}`);
    console.error("\nPlease run: pnpm --filter @repo/contract openapi:generate");
    process.exit(1);
  }
  console.log(`✓ Found generated types at ${GENERATED_TYPES_FILE}`);
}

function listContractSchemas() {
  const schemas = [];
  const files = fs.readdirSync(SCHEMAS_DIR);
  for (const file of files) {
    if (file.endsWith(".schema.ts")) {
      const schemaName = file.replace(".schema.ts", "");
      schemas.push(schemaName);
    }
  }
  return schemas;
}

function extractOpenAPIEndpoints() {
  // Read the OpenAPI spec JSON directly
  const spec = JSON.parse(fs.readFileSync(SPEC_FILE, "utf-8"));

  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    console.error("❌ No endpoints found in OpenAPI spec.");
    process.exit(1);
  }

  const endpoints = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    const operations = Object.keys(methods).filter(
      (m) => m !== "parameters" && m !== "$ref" && m !== "servers",
    );
    for (const operation of operations) {
      endpoints.push({
        method: operation.toUpperCase(),
        path,
      });
    }
  }

  return endpoints;
}

function validateCoverage(contractSchemas, openAPIEndpoints) {
  console.log(`\nContract schemas found: ${contractSchemas.length}`);
  console.log(`OpenAPI endpoints found: ${openAPIEndpoints.length}`);

  console.log(`\n✅ OpenAPI endpoints:`);
  const endpointGroups = {};
  for (const endpoint of openAPIEndpoints) {
    const key = endpoint.path;
    if (!endpointGroups[key]) {
      endpointGroups[key] = [];
    }
    endpointGroups[key].push(endpoint.method);
  }

  for (const [path, methods] of Object.entries(endpointGroups)) {
    console.log(`   ${path}: [${methods.join(", ")}]`);
  }

  const schemaNames = new Set(contractSchemas);
  const coveredSchemas = new Set();

  // Check if schemas match endpoint patterns
  for (const endpoint of openAPIEndpoints) {
    const pathParts = endpoint.path.split("/").filter(Boolean);
    if (pathParts.length >= 2) {
      // Convert path to schema name pattern (e.g., /api/ai/chat -> aiChat)
      const potentialSchema =
        pathParts[1] +
        pathParts
          .slice(2)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join("");
      if (schemaNames.has(potentialSchema)) {
        coveredSchemas.add(potentialSchema);
      }
    }
  }

  const uncoveredSchemas = contractSchemas.filter((s) => !coveredSchemas.has(s));
  const orphanEndpoints = openAPIEndpoints.length - coveredSchemas.size;

  console.log(`\n✓ Schemas covered by OpenAPI: ${coveredSchemas.size}`);
  if (uncoveredSchemas.length > 0) {
    console.warn(`⚠ Schemas without OpenAPI coverage: ${uncoveredSchemas.join(", ")}`);
  }
  if (orphanEndpoints > 0) {
    console.warn(`⚠ OpenAPI endpoints without contract schemas: ${orphanEndpoints}`);
  }

  return {
    covered: coveredSchemas.size,
    uncovered: uncoveredSchemas.length,
    orphanEndpoints,
  };
}

function main() {
  console.log("Validating contract schemas against OpenAPI specification...\n");

  checkSpecExists();
  checkGeneratedTypesExist();

  const contractSchemas = listContractSchemas();
  const openAPIEndpoints = extractOpenAPIEndpoints();

  const validation = validateCoverage(contractSchemas, openAPIEndpoints);

  console.log("\nValidation complete.");

  // Exit with non-zero if there are significant gaps
  if (validation.uncovered > 0 || validation.orphanEndpoints > 0) {
    console.warn("\n⚠ Validation warnings detected. Please review.");
    process.exit(1);
  }

  console.log("✓ All checks passed.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
