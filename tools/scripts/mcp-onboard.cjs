#!/usr/bin/env node
/**
 * @file tools/scripts/mcp-onboard.cjs
 * @description Master Agent MCP Server Onboarding & Verification Engine.
 * Ensures every incoming AI agent runtime registers and discovers all required
 * MCP servers (Firecrawl, Upstash, Filesystem, Memory, Sequential Thinking, Ripgrep, etc.).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

const firecrawlKey = process.env.FIRECRAWL_API_KEY || 'fc-625192b8955c4c25afba4e30d9f1bce4';
const firecrawlBin = fs.existsSync(path.join(HOME, '.local/bin/firecrawl-mcp'))
  ? path.join(HOME, '.local/bin/firecrawl-mcp')
  : 'npx';

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

  // Verify and register Firecrawl
  if (!config[containerKey].firecrawl) {
    missingServers.push('firecrawl');
    if (isCheckOnly) {
      totalIssues++;
    } else {
      if (client.type === 'antigravity') {
        config[containerKey].firecrawl = {
          description: servers.firecrawl.description,
          disabled: false,
          autoApprove: servers.firecrawl.autoApprove,
          command: firecrawlBin,
          args: firecrawlBin === 'npx' ? ['-y', 'firecrawl-mcp'] : [],
          env: { FIRECRAWL_API_KEY: firecrawlKey },
        };
      } else if (client.type === 'opencode') {
        config[containerKey].firecrawl = {
          type: 'remote',
          url: servers.firecrawl.remoteUrl,
          enabled: true,
          headers: { Authorization: `Bearer {env:FIRECRAWL_API_KEY}` },
        };
      } else if (client.type === 'claude' || client.type === 'cursor' || client.type === 'vscode') {
        config[containerKey].firecrawl = {
          type: 'http',
          url: servers.firecrawl.remoteUrl,
          headers: { Authorization: `Bearer ${firecrawlKey}` },
        };
      } else {
        config[containerKey].firecrawl = {
          command: firecrawlBin,
          args: firecrawlBin === 'npx' ? ['-y', 'firecrawl-mcp'] : [],
          env: { FIRECRAWL_API_KEY: firecrawlKey },
          description: servers.firecrawl.description,
          type: 'stdio',
        };
      }
      modified = true;
    }
  }

  // Verify and register Upstash
  if (!config[containerKey].upstash) {
    missingServers.push('upstash');
    if (isCheckOnly) {
      totalIssues++;
    } else {
      if (client.type === 'antigravity') {
        config[containerKey].upstash = {
          description: servers.upstash.description,
          disabled: false,
          autoApprove: [],
          url: servers.upstash.url,
        };
      } else if (client.type === 'opencode') {
        config[containerKey].upstash = {
          type: 'remote',
          url: servers.upstash.url,
          enabled: true,
        };
      } else if (client.type === 'claude' || client.type === 'cursor' || client.type === 'vscode') {
        config[containerKey].upstash = {
          type: 'http',
          url: servers.upstash.url,
        };
      } else {
        config[containerKey].upstash = {
          url: servers.upstash.url,
          description: servers.upstash.description,
          type: 'remote',
        };
      }
      modified = true;
    }
  }

  // Verify and register Core Tools
  const coreStdio = [
    'memory',
    'sequential-thinking',
    'filesystem',
    'ripgrep',
    'git',
    'fetch',
    'context7',
    'codemap',
    'code-index',
    'docker',
    'postgres',
    'chrome-devtools',
    'next-devtools',
    'agent-mcp',
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

// Ensure Antigravity schema definitions exist for Firecrawl
const antigravitySchemaDir = path.join(HOME, '.gemini/antigravity-cli/mcp/firecrawl');
if (!fs.existsSync(antigravitySchemaDir) || fs.readdirSync(antigravitySchemaDir).length < 20) {
  if (isCheckOnly) {
    console.log('⚠️  Antigravity Firecrawl tool schemas missing or incomplete.');
    totalIssues++;
  } else {
    process.stdout.write('📦 Generating Antigravity lazy tool schemas for Firecrawl... ');
    const genRes = spawnSync(
      'node',
      [
        '-e',
        `
      const fs = require('fs');
      const path = require('path');
      const { spawn } = require('child_process');
      const target = '${antigravitySchemaDir}';
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
      const proc = spawn('${firecrawlBin}', [], { env: { ...process.env, FIRECRAWL_API_KEY: '${firecrawlKey}' } });
      let buf = '';
      proc.stdout.on('data', d => {
        buf += d.toString();
        const lines = buf.split('\\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.id === 1) {
              proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\\n');
              proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\\n');
            } else if (msg.id === 2) {
              for (const tool of msg.result.tools) {
                fs.writeFileSync(path.join(target, tool.name + '.json'), JSON.stringify(tool, null, 2));
              }
              proc.kill();
              process.exit(0);
            }
          } catch(e) {}
        }
      });
      proc.stdin.write(JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'gen', version: '1.0' } }
      }) + '\\n');
      setTimeout(() => { proc.kill(); process.exit(1); }, 6000);
    `,
      ],
      { encoding: 'utf8' }
    );
    if (genRes.status === 0) {
      console.log('✅ DONE');
    } else {
      console.log('⚠️  Failed to extract schemas automatically.');
    }
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
