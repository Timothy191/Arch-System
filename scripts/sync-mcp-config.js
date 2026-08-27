#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Helper to parse simple ENV files
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    // remove quotes if any
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function resolvePath(p) {
  // Replace /home/tim with the current user's HOME
  const home = process.env.HOME || process.env.USERPROFILE || '/home/tim';
  let resolved = p.replace(/\/home\/tim/g, home);
  // Replace $REPO_ROOT with actual repo root
  resolved = resolved.replace(/\$REPO_ROOT/g, REPO_ROOT);
  return resolved;
}

function main() {
  console.log('Syncing MCP configurations...');

  const mcpJsonPath = path.join(REPO_ROOT, 'config/tools/mcp.json');
  if (!fs.existsSync(mcpJsonPath)) {
    console.error(`Base MCP config not found at ${mcpJsonPath}`);
    process.exit(1);
  }

  let baseConfig;
  try {
    baseConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
  } catch (err) {
    console.error(`Error parsing base MCP config: ${err.message}`);
    process.exit(1);
  }

  const mcpServers = baseConfig.mcpServers || {};


  const portalEnv = parseEnvFile(path.join(REPO_ROOT, 'apps/portal/.env'));
  const rootEnv = parseEnvFile(path.join(REPO_ROOT, '.env'));
  const mergedEnv = { ...rootEnv, ...portalEnv, ...process.env };

  const dbUrl = mergedEnv.DATABASE_URL || mergedEnv.SUPABASE_POOLER_URL || mergedEnv.SUPABASE_DB_URL;
  const dbPassword = mergedEnv.SUPABASE_DB_PASSWORD || mergedEnv.DB_PASSWORD;
  const dbRegion = mergedEnv.SUPABASE_REGION || mergedEnv.AWS_REGION || 'us-east-1';

  // Resolve all paths in mcpServers
  const resolvedServers = {};
  for (const [name, server] of Object.entries(mcpServers)) {
    const resolvedServer = { ...server };
    if (resolvedServer.command) {
      resolvedServer.command = resolvePath(resolvedServer.command);
    }
    if (resolvedServer.args) {
      resolvedServer.args = resolvedServer.args.map(arg => {
        if (typeof arg !== 'string') return arg;
        let resolved = resolvePath(arg);
        if (name === 'postgres' && resolved.includes('pooler.supabase.com')) {
          if (dbUrl && !dbUrl.includes('[PASSWORD]')) {
            resolved = dbUrl;
          } else if (dbPassword) {
            resolved = resolved
              .replace('[PASSWORD]', encodeURIComponent(dbPassword))
              .replace('[REGION]', dbRegion);
          }
        }
        return resolved;
      });
    }
    if (resolvedServer.url) {
      resolvedServer.url = resolvePath(resolvedServer.url);
    }
    resolvedServers[name] = resolvedServer;
  }

  // 1. Write .mcp.json (repo root)
  const rootMcpPath = path.join(REPO_ROOT, '.mcp.json');
  fs.writeFileSync(rootMcpPath, JSON.stringify({ mcpServers: resolvedServers }, null, 2));
  console.log(`Generated ${rootMcpPath}`);

  // 2. Write .agents/mcp_config.json (map url to serverUrl for HTTP servers)
  const agentsMcpPath = path.join(REPO_ROOT, '.agents/mcp_config.json');
  if (!fs.existsSync(path.dirname(agentsMcpPath))) {
    fs.mkdirSync(path.dirname(agentsMcpPath), { recursive: true });
  }
  
  const agentsServers = {};
  for (const [name, server] of Object.entries(resolvedServers)) {
    const s = { ...server };
    if (s.type === 'http' || (s.url && s.url.startsWith('http'))) {
      s.serverUrl = s.url;
    }
    agentsServers[name] = s;
  }
  fs.writeFileSync(agentsMcpPath, JSON.stringify({ mcpServers: agentsServers }, null, 2));
  console.log(`Generated ${agentsMcpPath}`);

  // 3. Write .vscode/mcp.json (uses "servers" key instead of "mcpServers")
  const vscodeMcpPath = path.join(REPO_ROOT, '.vscode/mcp.json');
  if (!fs.existsSync(path.dirname(vscodeMcpPath))) {
    fs.mkdirSync(path.dirname(vscodeMcpPath), { recursive: true });
  }
  fs.writeFileSync(vscodeMcpPath, JSON.stringify({ servers: resolvedServers }, null, 2));
  console.log(`Generated ${vscodeMcpPath}`);
}

main();
