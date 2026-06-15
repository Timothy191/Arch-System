#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const MCP_CONFIG = path.join(PROJ, '.mcp.json');
const REGISTRY_FILE = path.join(PROJ, '.kiro', 'mcp', 'registry.json');
const MCP_RUNTIME = path.join(PROJ, '.kiro', 'mcp', 'runtime.json');

const BUILTIN_SERVERS = {
  'mcp-github': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github@latest'],
    description: 'GitHub API: issues, PRs, repos, search'
  },
  'mcp-filesystem': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem@latest', PROJ],
    description: 'Advanced filesystem operations with permission control'
  },
  'mcp-browser': {
    command: 'npx',
    args: ['-y', '@playwright/mcp-server@latest'],
    description: 'Headless browser automation, screenshots, DOM inspection'
  },
  'mcp-search': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search@latest'],
    description: 'Web search via Brave search API'
  },
  'mcp-database': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite@latest', path.join(PROJ, 'ltm', 'store', 'traces.db')],
    description: 'SQLite database queries and management'
  },
  'mcp-slack': {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack@latest'],
    description: 'Slack messaging, threads, notifications'
  }
};

function loadMcpConfig() {
  try { return JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8')); }
  catch { return { mcpServers: {} }; }
}

function saveMcpConfig(config) {
  fs.writeFileSync(MCP_CONFIG, JSON.stringify(config, null, 2));
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

function loadRuntime() {
  try { return JSON.parse(fs.readFileSync(MCP_RUNTIME, 'utf8')); }
  catch { return { processes: {} }; }
}

function saveRuntime(data) {
  const dir = path.dirname(MCP_RUNTIME);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MCP_RUNTIME, JSON.stringify(data, null, 2));
}

function addServer(name, config) {
  const mcpConfig = loadMcpConfig();
  mcpConfig.mcpServers[name] = config;
  saveMcpConfig(mcpConfig);

  const registry = loadRegistry();
  registry.servers[name] = { status: 'registered', tool_count: 0, description: config.description || '' };
  saveRegistry(registry);

  return { status: 'ok', server: name };
}

function removeServer(name) {
  const mcpConfig = loadMcpConfig();
  delete mcpConfig.mcpServers[name];
  saveMcpConfig(mcpConfig);

  const registry = loadRegistry();
  delete registry.servers[name];
  Object.keys(registry.tools).forEach(t => {
    if (registry.tools[t].server === name) delete registry.tools[t];
  });
  saveRegistry(registry);

  return { status: 'ok', server: name };
}

function listServers() {
  const mcpConfig = loadMcpConfig();
  const registry = loadRegistry();
  const runtime = loadRuntime();

  return Object.entries(mcpConfig.mcpServers || {}).map(([name, config]) => ({
    name,
    command: config.command,
    args: (config.args || []).slice(0, 3).join(' '),
    description: registry.servers[name]?.description || config.description || '',
    status: registry.servers[name]?.status || 'unknown',
    tool_count: registry.servers[name]?.tool_count || 0,
    running: !!runtime.processes[name]
  }));
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
        } catch {}
        proc.kill();
      }
    });

    proc.on('error', () => {
      resolve({ server: serverName, tools: [], error: 'Process error' });
    });

    timeout = setTimeout(() => {
      proc.kill();
      resolve({ server: serverName, tools: [], error: 'Timeout' });
    }, 8000);

    proc.stdin.write(request);
    proc.stdin.end();
  });
}

async function startServer(name) {
  const mcpConfig = loadMcpConfig();
  const config = mcpConfig.mcpServers[name];
  if (!config) return { status: 'error', error: `Unknown server: ${name}` };

  const runtime = loadRuntime();
  if (runtime.processes[name]) return { status: 'ok', message: `Already running: ${name}` };

  const proc = spawn(config.command, config.args || [], {
    env: { ...process.env, ...(config.env || {}) },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  });

  runtime.processes[name] = {
    pid: proc.pid,
    started_at: Date.now(),
    command: config.command
  };
  saveRuntime(runtime);

  proc.on('exit', code => {
    const r = loadRuntime();
    delete r.processes[name];
    saveRuntime(r);
  });

  const result = await discoverTools(name, config);
  const registry = loadRegistry();
  registry.servers[name] = {
    status: result.error ? 'error' : 'ok',
    error: result.error,
    tool_count: result.tools.length,
    description: config.description || ''
  };
  for (const tool of result.tools) {
    registry.tools[tool.name] = { server: name, description: tool.description, inputSchema: tool.inputSchema };
  }
  saveRegistry(registry);

  return {
    status: 'ok',
    server: name,
    pid: proc.pid,
    tools_found: result.tools.length,
    error: result.error
  };
}

function stopServer(name) {
  const runtime = loadRuntime();
  const procInfo = runtime.processes[name];
  if (!procInfo) return { status: 'error', error: `Not running: ${name}` };

  try {
    process.kill(procInfo.pid, 'SIGTERM');
    setTimeout(() => {
      try { process.kill(procInfo.pid, 'SIGKILL'); } catch {}
    }, 3000);
  } catch {}

  delete runtime.processes[name];
  saveRuntime(runtime);

  return { status: 'ok', server: name, pid: procInfo.pid };
}

function getMcpToolNode(serverName, toolName) {
  const registry = loadRegistry();
  const tool = registry.tools[toolName];
  if (!tool) return null;

  return {
    server: tool.server || serverName,
    name: toolName,
    description: tool.description || '',
    inputSchema: tool.inputSchema || {}
  };
}

async function main() {
  const cmd = process.argv[2] || 'list';

  switch (cmd) {
    case 'add': {
      const name = process.argv[3];
      const command = process.argv[4];
      const args = process.argv.slice(5);
      if (!name || !command) {
        console.error('Usage: mcp-ecosystem add <name> <command> [args...]');
        process.exit(1);
      }
      const result = addServer(name, { command, args });
      console.log(JSON.stringify(result));
      break;
    }

    case 'add-builtin': {
      const name = process.argv[3];
      if (!name || !BUILTIN_SERVERS[name]) {
        console.error(`Available builtins: ${Object.keys(BUILTIN_SERVERS).join(', ')}`);
        process.exit(1);
      }
      const config = BUILTIN_SERVERS[name];
      const result = addServer(name, config);
      console.log(JSON.stringify({ ...result, description: config.description }));
      break;
    }

    case 'remove': {
      const name = process.argv[3];
      if (!name) { console.error('Usage: mcp-ecosystem remove <name>'); process.exit(1); }
      console.log(JSON.stringify(removeServer(name)));
      break;
    }

    case 'list': {
      const servers = listServers();
      console.log(JSON.stringify({ servers, count: servers.length }, null, 2));
      break;
    }

    case 'start': {
      const name = process.argv[3];
      if (!name) { console.error('Usage: mcp-ecosystem start <name>'); process.exit(1); }
      const result = await startServer(name);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'stop': {
      const name = process.argv[3];
      if (!name) { console.error('Usage: mcp-ecosystem stop <name>'); process.exit(1); }
      console.log(JSON.stringify(stopServer(name)));
      break;
    }

    case 'discover': {
      const servers = listServers();
      const results = [];
      for (const s of servers) {
        const mcpConfig = loadMcpConfig();
        const config = mcpConfig.mcpServers[s.name];
        if (config) {
          const result = await discoverTools(s.name, config);
          results.push(result);
        }
      }
      console.log(JSON.stringify({ discovered: results.length, servers: results }, null, 2));
      break;
    }

    case 'tool': {
      const toolName = process.argv[3];
      if (!toolName) { console.error('Usage: mcp-ecosystem tool <name>'); process.exit(1); }
      const tool = getMcpToolNode(null, toolName);
      console.log(JSON.stringify(tool || { found: false, name: toolName }));
      break;
    }

    case 'status': {
      const servers = listServers();
      const runtime = loadRuntime();
      console.log(JSON.stringify({
        configured: servers.length,
        running: Object.keys(runtime.processes).length,
        servers: servers
      }, null, 2));
      break;
    }

    default:
      console.log('Commands: add | add-builtin | remove | list | start | stop | discover | tool | status');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}

module.exports = { addServer, removeServer, listServers, startServer, stopServer, getMcpToolNode, BUILTIN_SERVERS };
