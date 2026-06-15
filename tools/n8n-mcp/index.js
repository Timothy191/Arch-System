#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_EMAIL = process.env.N8N_EMAIL;
const N8N_PASSWORD = process.env.N8N_PASSWORD;
const N8N_FETCH_TIMEOUT = parseInt(process.env.N8N_FETCH_TIMEOUT || "30000", 10);
const COOKIE_MARGIN_MS = 5 * 60 * 1000;

if (!N8N_EMAIL || !N8N_PASSWORD) {
  console.error("Fatal: N8N_EMAIL and N8N_PASSWORD environment variables are required");
  process.exit(1);
}

let n8nCookie = null;
let cookieExpiry = 0;

function sanitizePathSegment(segment) {
  if (typeof segment !== "string" || !segment) return "";
  if (segment.includes("..") || segment.includes("/") || segment.includes("\\")) {
    throw new Error("Invalid path segment: must not contain '..', '/', or '\\'");
  }
  if (/[^a-zA-Z0-9_.-]/.test(segment)) {
    throw new Error("Invalid path segment: only alphanumeric, _, ., and - allowed");
  }
  return segment;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = N8N_FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureLogin() {
  if (n8nCookie && Date.now() < cookieExpiry) return;
  const res = await fetchWithTimeout(`${N8N_URL}/rest/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailOrLdapLoginId: N8N_EMAIL, password: N8N_PASSWORD }),
    redirect: "manual",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`n8n login failed (${res.status}): ${text}`);
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("n8n login failed: no session cookie returned");
  n8nCookie = setCookie.split(";")[0];
  cookieExpiry = Date.now() + 50 * 60 * 1000 - COOKIE_MARGIN_MS;
}

async function n8nFetch(path, options = {}, retries = 1) {
  await ensureLogin();
  const url = `${N8N_URL}/rest${path}`;
  const { headers: optionsHeaders, ...restOptions } = options;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      Cookie: n8nCookie,
      ...optionsHeaders,
    },
  });
  if (res.status === 401 && retries > 0) {
    n8nCookie = null;
    await ensureLogin();
    return n8nFetch(path, options, retries - 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`n8n API ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new Server(
  { name: "n8n-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "n8n_list_workflows",
      description: "List all workflows with IDs, names, active status, and tags.",
      inputSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Optional name filter" },
          tag: { type: "string", description: "Filter by tag name (server-side)" },
        },
      },
    },
    {
      name: "n8n_get_workflow",
      description: "Get full details of a specific workflow by ID",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "n8n_execute_workflow",
      description: "Execute a workflow via its webhook trigger. Returns the workflow response.",
      inputSchema: {
        type: "object",
        properties: {
          webhook_path: {
            type: "string",
            description: "Webhook path (e.g. 'tool-batcher', 'skills-loader')",
          },
          data: {
            type: "object",
            description: "Payload to send to the workflow",
          },
        },
        required: ["webhook_path"],
      },
    },
    {
      name: "n8n_check_execution",
      description: "Check the result of a workflow execution by execution ID",
      inputSchema: {
        type: "object",
        properties: {
          execution_id: { type: "string", description: "Execution ID to check" },
        },
        required: ["execution_id"],
      },
    },
    {
      name: "n8n_import_workflow",
      description: "Import a workflow JSON into n8n.",
      inputSchema: {
        type: "object",
        properties: {
          workflow_json: {
            type: "object",
            description: "Valid n8n workflow JSON object",
          },
          activate: {
            type: "boolean",
            description: "Activate after import",
            default: false,
          },
        },
        required: ["workflow_json"],
      },
    },
    {
      name: "n8n_activate_workflow",
      description: "Activate a workflow so it can receive webhook calls",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "n8n_deactivate_workflow",
      description: "Deactivate a workflow",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Workflow ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "n8n_search_workflows_by_tag",
      description: "Search workflows by tag name using server-side filtering",
      inputSchema: {
        type: "object",
        properties: {
          tag: { type: "string", description: "Tag name to search for" },
        },
        required: ["tag"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "n8n_list_workflows": {
      let endpoint = "/workflows";
      if (args?.tag && typeof args.tag === "string") {
        endpoint += `?tags=${encodeURIComponent(args.tag)}`;
      }
      const data = await n8nFetch(endpoint);
      let workflows = data.data || [];
      if (args?.search && typeof args.search === "string") {
        const q = args.search.toLowerCase();
        workflows = workflows.filter((w) => w.name?.toLowerCase().includes(q));
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              workflows.map((w) => ({
                id: w.id,
                name: w.name,
                active: w.active,
                tags: w.tags?.map((t) => t.name) || [],
              })),
              null, 2
            ),
          },
        ],
      };
    }

    case "n8n_get_workflow": {
      const safeId = sanitizePathSegment(args.id);
      const data = await n8nFetch(`/workflows/${safeId}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data.data, null, 2) }],
      };
    }

    case "n8n_execute_workflow": {
      const safePath = sanitizePathSegment(args.webhook_path);
      const res = await fetchWithTimeout(`${N8N_URL}/webhook/${safePath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args.data || {}),
      });
      const body = await res.text();
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `Error ${res.status}: ${body}` }],
        };
      }
      let parsed = body;
      try { parsed = JSON.parse(body); } catch {}
      return {
        content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
      };
    }

    case "n8n_check_execution": {
      const safeId = sanitizePathSegment(args.execution_id);
      const data = await n8nFetch(`/executions/${safeId}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data.data, null, 2) }],
      };
    }

    case "n8n_import_workflow": {
      if (!args.workflow_json || typeof args.workflow_json !== "object") {
        throw new Error("workflow_json must be a valid JSON object");
      }
      const data = await n8nFetch("/workflows", {
        method: "POST",
        body: JSON.stringify(args.workflow_json),
      });
      if (args.activate && data.data?.id) {
        const actData = await n8nFetch(`/workflows/${data.data.id}/activate`, {
          method: "POST",
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { id: data.data.id, name: data.data.name, active: actData.data?.active ?? true },
                null, 2
              ),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { id: data.data?.id, name: data.data?.name, active: data.data?.active ?? false },
              null, 2
            ),
          },
        ],
      };
    }

    case "n8n_activate_workflow": {
      const safeId = sanitizePathSegment(args.id);
      const data = await n8nFetch(`/workflows/${safeId}/activate`, { method: "POST" });
      return {
        content: [
          { type: "text", text: JSON.stringify({ id: safeId, active: data.data?.active ?? true }, null, 2) },
        ],
      };
    }

    case "n8n_deactivate_workflow": {
      const safeId = sanitizePathSegment(args.id);
      const data = await n8nFetch(`/workflows/${safeId}/deactivate`, { method: "POST" });
      return {
        content: [
          { type: "text", text: JSON.stringify({ id: safeId, active: data.data?.active ?? false }, null, 2) },
        ],
      };
    }

    case "n8n_search_workflows_by_tag": {
      if (typeof args.tag !== "string" || !args.tag) {
        throw new Error("tag must be a non-empty string");
      }
      const safeTag = encodeURIComponent(args.tag);
      const data = await n8nFetch(`/workflows?tags=${safeTag}`);
      const workflows = (data.data || []).map((w) => ({
        id: w.id,
        name: w.name,
        active: w.active,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(workflows, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("n8n MCP server running on stdio");

  const shutdown = async () => {
    console.error("Shutting down n8n MCP server...");
    await server.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
