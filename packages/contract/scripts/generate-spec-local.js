/* eslint-disable no-console */
import { createSwaggerSpec } from "next-swagger-doc";
import { writeFileSync } from "fs";
import { join } from "path";

// Read the actual API routes to generate spec
const apiFolder = join(__dirname, "../../../apps/portal/app/api");

const spec = createSwaggerSpec({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Arch-Systems Portal API",
      version: "1.0.0",
      description:
        "API for industrial operations portal - control room, drilling, engineering, and production management",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase JWT authentication token",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apiFolder: apiFolder,
});

// Write spec to a temporary file
const outputPath = join(__dirname, "../openapi-spec.json");
writeFileSync(outputPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec generated at: ${outputPath}`);
console.log(`Total paths: ${Object.keys(spec.paths).length}`);
console.log(`Total tags: ${spec.tags?.length || 0}`);
