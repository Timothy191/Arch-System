#!/usr/bin/env node
/**
 * @file tools/scripts/mcp-onboard.cjs
 * @description Master Agent MCP Server Onboarding & Verification Engine.
 * Ensures every incoming AI agent runtime registers and discovers all required
 * MCP servers (Context7, Codemap, Chrome DevTools; Supabase for remote DB work).
 */

const fs = require('fs');
const path = require('path');
const HOME = process.env.HOME || '/home/tim';
const REGISTRY_PATH = path.join(__dirname, '../mcp/mcp-registry.json');
const MCP_ENV_PATH = path.join(HOME, '.config/mcp-env');

// Parse flags
const args = process.argv.slice(2);
const isCheckOnly = args.includes('--check');
const isVerbose = args.includes('--verbose') || args.includes('-v');

// Load environment variables from ~/.config/mcp-env if present
if (fs.existsSync(MCP_ENV_PATH)) {
  const envContent = fs.readFileSync(MCP_ENV_PATH, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('export ') && trimmed.includes('=')) {
      const match = trimmed.match(/^export\s+([A-Za-z0-9_]+)=["']?(.*?)["']?$/);
      if (match) {
        const [, key, val] = match;
        // Strip shell default substitutions like ${KEY:-default_val}
        const cleanVal = val.replace(/\$\{[A-Za-z0-9_]+:-(.*?)\}/, '$1');
        if (!process.env[key] && cleanVal) {
          process.env[key] = cleanVal;
        }
      }
    }
  }
}

// Load Registry
if (!fs.existsSync(REGISTRY_PATH)) {
  console.error(`❌ [MCP Onboarding] Registry file not found: ${REGISTRY_PATH}`);
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const requiredServers = registry.requiredServers || [];
const servers = registry.servers || {};

console.log('========================================================');
console.log('🤖 [MCP ONBOARDING] Master Multi-Agent MCP Registry Gate');
console.log('========================================================');

const clientConfigs = [
  {
    name: 'Antigravity CLI (mcp.json)',
    path: path.join(HOME, '.gemini/antigravity-cli/mcp/mcp.json'),
    type: 'antigravity',
  },
  {
    name: 'Standard MCP Bundle (mcp-zero-auth.json)',
    path: path.join(HOME, '.config/mcp-zero-auth.json'),
    type: 'standard',
  },
  {
    name: 'Claude Code (~/.claude.json)',
    path: path.join(HOME, '.claude.json'),
    type: 'claude',
  },
  {
    name: 'OpenCode (opencode.json)',
    path: path.join(HOME, '.config/opencode/opencode.json'),
    type: 'opencode',
  },
  {
    name: 'Cursor (~/.cursor/mcp.json)',
    path: path.join(HOME, '.cursor/mcp.json'),
    type: 'cursor',
  },
  {
    name: 'VS Code (~/.config/Code/User/mcp.json)',
    path: path.join(HOME, '.config/Code/User/mcp.json'),
    type: 'vscode',
  },
  {
    name: 'Arch-System Local MCP (.agents/mcp_config.json)',
    path: path.join(__dirname, '../../.agents/mcp_config.json'),
    type: 'standard',
  },
  {
    name: 'Arch-System Root MCP (.mcp.json)',
    path: path.join(__dirname, '../../.mcp.json'),
    type: 'standard',
  },
];

let totalIssues = 0;

for (const client of clientConfigs) {
  process.stdout.write(`⚙️  Auditing ${client.name}... `);

  if (!fs.existsSync(client.path)) {
    if (isCheckOnly) {
      console.log('⚠️  NOT FOUND (Skipped in check mode)');
      continue;
    }
    // Create directory and empty config
    fs.mkdirSync(path.dirname(client.path), { recursive: true });
    fs.writeFileSync(client.path, JSON.stringify({ mcpServers: {} }, null, 2));
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(client.path, 'utf8'));
  } catch (err) {
    console.log(`❌ ERROR: Invalid JSON: ${err.message}`);
    totalIssues++;
    continue;
  }

  let modified = false;

  // Determine server container field (opencode uses config.mcp, others use config.mcpServers)
  const containerKey = client.type === 'opencode' ? 'mcp' : 'mcpServers';
  config[containerKey] = config[containerKey] || {};

  const missingServers = [];

  // Verify and register Core Tools
  // Trimmed 2026-10-27: duplicates of built-in agent tools (ripgrep/git/fetch/
  // filesystem/memory) and supabase-covered (postgres) were removed from live
  // configs; registry keeps their definitions as an optional catalog.
  const coreStdio = [
    'context7',
    'codemap',
    'chrome-devtools',
  ];
  for (const toolName of coreStdio) {
    if (!config[containerKey][toolName] && servers[toolName]) {
      missingServers.push(toolName);
      if (isCheckOnly) {
        totalIssues++;
      } else {
        const sDef = servers[toolName];
        if (client.type === 'opencode') {
          config[containerKey][toolName] = {
            type: 'local',
            command: [sDef.command, ...(sDef.args || [])],
            ...(sDef.env ? { env: sDef.env } : {}),
          };
        } else if (client.type === 'claude') {
          config[containerKey][toolName] = {
            command: sDef.command,
            args: sDef.args || [],
            ...(sDef.env ? { env: sDef.env } : {}),
          };
        } else {
          config[containerKey][toolName] = {
            command: sDef.command,
            args: sDef.args || [],
            description: sDef.description,
            type: sDef.type || 'stdio',
            ...(sDef.env ? { env: sDef.env } : {}),
          };
        }
        modified = true;
      }
    }
  }

  if (isCheckOnly) {
    if (missingServers.length > 0) {
      console.log(`❌ MISSING (${missingServers.join(', ')})`);
    } else {
      console.log('✅ PASS (Fully Registered)');
    }
  } else if (modified) {
    fs.writeFileSync(client.path, JSON.stringify(config, null, 2));
    console.log(`✅ SYNCHRONIZED (Added: ${missingServers.join(', ')})`);
  } else {
    console.log('✅ PASS (Fully Registered)');
  }
}

console.log('========================================================');
if (totalIssues > 0 && isCheckOnly) {
  console.log(
    `❌ [MCP ONBOARDING] Found ${totalIssues} missing registrations. Run 'pnpm mcp:onboard' to register.`
  );
  process.exit(1);
} else {
  console.log('✅ [MCP ONBOARDING] 100% PASS. All MCP servers registered for all agents.');
  console.log('========================================================');
  process.exit(0);
}
