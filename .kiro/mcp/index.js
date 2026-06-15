#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const MCP_CONFIG = path.join(PROJ, '.mcp.json');
const REGISTRY_FILE = path.join(PROJ, '.kiro', 'mcp', 'registry.json');

function loadMcpConfig() {
  try { return JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8')).mcpServers || {}; }
  catch { return {}; }
}

function loadRegistry() {
  try { return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')); }
  catch { return { version: 2, servers: {}, tools: {}, updated_at: null }; }
}

function saveRegistry(data) {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
}

function discoverTools(serverName, config) {
  return new Promise(resolve => {
    const proc = spawn(config.command, config.args || [], {
      env: { ...process.env, ...(config.env || {}) },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const request = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n';
    let response = '';
    let timeout;

    proc.stdout.on('data', d => {
      response += d.toString();
      if (response.includes('}')) {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(response);
          resolve({ server: serverName, tools: parsed.result?.tools || [] });
        } catch { /* continue collecting */ }
        proc.kill();
      }
    });

    proc.on('error', () => {
      resolve({ server: serverName, tools: [], error: 'Process error' });
    });

    timeout = setTimeout(() => {
      proc.kill();
      resolve({ server: serverName, tools: [], error: 'Timeout' });
    }, 5000);

    proc.stdin.write(request);
    proc.stdin.end();
  });
}

async function cmdDiscover() {
  const config = loadMcpConfig();
  const serverNames = Object.keys(config);

  if (serverNames.length === 0) {
    console.log(JSON.stringify({ status: 'ok', servers: 0, tools: 0, message: 'No MCP servers configured' }));
    return;
  }

  const registry = loadRegistry();
  registry.updated_at = new Date().toISOString();

  for (const name of serverNames) {
    if (name === 'n8n') continue; // Skip n8n MCP — we manage it separately
    const result = await discoverTools(name, config[name]);
    registry.servers[name] = { status: result.error ? 'error' : 'ok', error: result.error, tool_count: result.tools.length };
    for (const tool of result.tools) {
      registry.tools[tool.name] = { server: name, description: tool.description, inputSchema: tool.inputSchema };
    }
  }

  // Add n8n tools
  const n8nConfig = config['n8n'];
  if (n8nConfig) {
    registry.servers['n8n'] = { status: 'registered', tool_count: 8 };
    const n8nTools = ['n8n_list_workflows', 'n8n_get_workflow', 'n8n_execute_workflow', 'n8n_check_execution', 'n8n_import_workflow', 'n8n_activate_workflow', 'n8n_deactivate_workflow', 'n8n_search_workflows_by_tag'];
    for (const t of n8nTools) {
      registry.tools[t] = { server: 'n8n', description: `n8n workflow tool: ${t}` };
    }
  }

  saveRegistry(registry);

  const toolCount = Object.keys(registry.tools).length;
  console.log(JSON.stringify({
    status: 'ok',
    servers: serverNames.length,
    tools: toolCount,
    errors: Object.entries(registry.servers).filter(([,s]) => s.status === 'error').length
  }));
}

function cmdStatus() {
  const registry = loadRegistry();
  const serverCount = Object.keys(registry.servers).length;
  const toolCount = Object.keys(registry.tools).length;

  if (serverCount === 0) {
    console.log(JSON.stringify({ status: 'empty', servers: 0, tools: 0, message: 'Run discover first' }));
    return;
  }

  const byServer = {};
  for (const [toolName, info] of Object.entries(registry.tools)) {
    const server = info.server || 'unknown';
    if (!byServer[server]) byServer[server] = [];
    byServer[server].push(toolName);
  }

  console.log(JSON.stringify({
    status: 'ok',
    updated_at: registry.updated_at,
    servers: serverCount,
    tools: toolCount,
    by_server: Object.fromEntries(
      Object.entries(byServer).map(([s, tools]) => [s, { count: tools.length, tools }])
    )
  }));
}

function cmdFind(toolName) {
  const registry = loadRegistry();
  const tool = registry.tools[toolName];
  if (tool) {
    console.log(JSON.stringify({ found: true, server: tool.server, description: tool.description }));
  } else {
    // Fuzzy search
    const matches = Object.entries(registry.tools)
      .filter(([name]) => name.includes(toolName) || (typeof name === 'string' && name.toLowerCase().includes(toolName.toLowerCase())))
      .map(([name, info]) => ({ name, server: info.server }));
    console.log(JSON.stringify({ found: matches.length > 0, matches }));
  }
}

if (require.main === module) {
  const cmd = process.argv[2] || 'status';
  switch (cmd) {
    case 'discover':
      cmdDiscover().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'status':
      cmdStatus();
      break;
    case 'find':
      cmdFind(process.argv[3] || '');
      break;
    default:
      console.log(JSON.stringify({ error: `Unknown command: ${cmd}`, usage: 'discover|status|find <name>' }));
  }
}
