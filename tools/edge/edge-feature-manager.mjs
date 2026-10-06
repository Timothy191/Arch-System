#!/usr/bin/env node

/**
 * Autonomous Edge Feature Manager for Supabase Edge Functions
 * Allows agents and swarms to autonomously scaffold, inspect, test, and deploy edge features.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARCH_SYSTEM_ROOT = path.resolve(__dirname, '../../');
const FUNCTIONS_DIR = path.resolve(ARCH_SYSTEM_ROOT, 'packages/database/supabase/functions');

// Ensure functions directory exists
if (!fs.existsSync(FUNCTIONS_DIR)) {
  fs.mkdirSync(FUNCTIONS_DIR, { recursive: true });
}

export function listEdgeFeatures() {
  if (!fs.existsSync(FUNCTIONS_DIR)) return [];
  const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  const functions = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fnPath = path.join(FUNCTIONS_DIR, entry.name, 'index.ts');
      const exists = fs.existsSync(fnPath);
      let lines = 0;
      if (exists) {
        lines = fs.readFileSync(fnPath, 'utf8').split('\n').length;
      }
      functions.push({
        name: entry.name,
        path: fnPath,
        entryExists: exists,
        lineCount: lines,
        endpoint: `/functions/v1/${entry.name}`,
      });
    }
  }

  return functions;
}

export function createEdgeFeature(name, description = '', customCode = null) {
  const sanitizedName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-');
  const targetDir = path.join(FUNCTIONS_DIR, sanitizedName);
  const targetFile = path.join(targetDir, 'index.ts');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const defaultCode = `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Edge Feature: ${sanitizedName}
 * ${description ? `Description: ${description}` : ''}
 * Created autonomously by Agent Swarm
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    
    const responsePayload = {
      feature: "${sanitizedName}",
      status: "success",
      received: body,
      timestamp: new Date().toISOString(),
      agentManaged: true,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process edge feature request" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
`;

  const codeToWrite = customCode || defaultCode;
  fs.writeFileSync(targetFile, codeToWrite, 'utf8');

  return {
    success: true,
    name: sanitizedName,
    path: targetFile,
    endpoint: `/functions/v1/${sanitizedName}`,
  };
}

export async function testEdgeFeature(name, options = {}) {
  const {
    baseUrl = 'https://mrwhtxbhrzyttlsyuofc.supabase.co',
    apiKey = '',
    payload = {},
  } = options;
  const endpoint = `${baseUrl}/functions/v1/${name}`;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['apikey'] = apiKey;
  }

  const startTime = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const durationMs = Date.now() - startTime;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}

    return {
      status: res.status,
      ok: res.ok,
      durationMs,
      response: json || text,
    };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      durationMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const [, , cmd, ...args] = process.argv;

  switch (cmd) {
    case 'list': {
      const fns = listEdgeFeatures();
      console.log(JSON.stringify(fns, null, 2));
      break;
    }
    case 'create': {
      const [name, desc] = args;
      if (!name) {
        console.error('Usage: edge-feature-manager.mjs create <name> [description]');
        process.exit(1);
      }
      const res = createEdgeFeature(name, desc);
      console.log(`✅ Created edge feature '${res.name}' at ${res.path}`);
      break;
    }
    case 'test': {
      const [name] = args;
      if (!name) {
        console.error('Usage: edge-feature-manager.mjs test <name>');
        process.exit(1);
      }
      testEdgeFeature(name, {
        apiKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_xusUcCYxZKn7zosSmoW6iQ_5qVl03XT',
        payload: { name: 'Functions' },
      }).then((res) => {
        console.log(JSON.stringify(res, null, 2));
      });
      break;
    }
    default:
      console.log('Autonomous Edge Feature Manager');
      console.log('Commands: list, create <name> [description], test <name>');
      break;
  }
}
