/**
 * Contract validation test for /api/health endpoint
 *
 * This script calls the /api/health endpoint and validates the response
 * against the Zod schema derived from the OpenAPI specification.
 *
 * Usage:
 *   node scripts/test-contract-health.js
 *
 * Environment variables:
 *   API_URL: The base URL of the API (default: http://localhost:3000)
 */

const { healthResponseSchema } = require("../src/generated/health-response-schema");

const API_URL = process.env.API_URL || "http://localhost:3000";

async function testHealthEndpoint() {
  console.log(`Testing GET ${API_URL}/api/health`);

  try {
    const response = await fetch(`${API_URL}/api/health`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const body = await response.json();

    console.log("Response received:", JSON.stringify(body, null, 2));

    // Validate against Zod schema
    const result = healthResponseSchema.safeParse(body);

    if (!result.success) {
      console.error("❌ Contract validation failed!");
      console.error("Zod errors:", result.error.errors);
      process.exit(1);
    }

    console.log("✅ Contract validation passed!");
    console.log("Response matches the OpenAPI specification.");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

testHealthEndpoint();
