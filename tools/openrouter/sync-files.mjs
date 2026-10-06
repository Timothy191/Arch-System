#!/usr/bin/env node

/**
 * OpenRouter Files API Synchronizer & Manager
 * Manages uploading, listing, inspecting, and deleting workspace documents on OpenRouter.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FORK_ROOT = path.resolve(__dirname, '../../../');
const ARCH_SYSTEM_ROOT = path.resolve(FORK_ROOT, 'Arch-System');

const API_BASE = 'https://openrouter.ai/api/v1/files';

function getApiKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  // Try reading from .env files
  const envPaths = [path.join(FORK_ROOT, '.env'), path.join(ARCH_SYSTEM_ROOT, '.env.local')];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/OPENROUTER_API_KEY=([^\r\n]+)/);
      if (match && match[1]) return match[1].trim();
    }
  }
  return '';
}

export async function uploadFile(filePath, customFilename = null) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const filename = customFilename || path.basename(resolvedPath);
  const blob = await fs.openAsBlob(resolvedPath);
  const formData = new FormData();
  formData.append('file', blob, filename);

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function listFiles(limit = 50) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${API_BASE}?limit=${limit}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`List files failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function getFileMetadata(fileId) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${API_BASE}/${fileId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Get file metadata failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function deleteFile(fileId) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const res = await fetch(`${API_BASE}/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Delete file failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export const WORKSPACE_FILES_CATALOG = [
  {
    path: path.join(FORK_ROOT, 'AGENTS.md'),
    filename: 'fork-federation-agents.md',
    description: 'Workspace-wide federation architecture and governance invariants',
  },
  {
    path: path.join(ARCH_SYSTEM_ROOT, 'AGENTS.md'),
    filename: 'arch-system-agents.md',
    description: 'Arch-System mining portal architecture SSoT',
  },
  {
    path: path.join(ARCH_SYSTEM_ROOT, '.agents/GUIDE.md'),
    filename: 'arch-system-guide.md',
    description: 'Permanent agent engineering guidelines and rules',
  },
  {
    path: path.join(ARCH_SYSTEM_ROOT, 'packages/contract/openapi.generated.json'),
    filename: 'arch-system-openapi.json',
    description: 'Generated OpenAPI contract for all portal APIs',
  },
  {
    path: path.join(ARCH_SYSTEM_ROOT, 'version.json'),
    filename: 'arch-system-version.json',
    description: 'Current workspace version manifest',
  },
  {
    path: path.join(ARCH_SYSTEM_ROOT, 'infra/terraform/openrouter.tf'),
    filename: 'openrouter-terraform.tf',
    description: 'OpenRouter official Terraform provider specification',
  },
  {
    path: path.join(ARCH_SYSTEM_ROOT, 'packages/database/supabase/functions/hello-world/index.ts'),
    filename: 'supabase-edge-hello-world.ts',
    description: 'Supabase Edge Function hello-world implementation',
  },
];

export async function populateWorkspaceFiles() {
  console.log('🔄 Checking existing files in OpenRouter workspace...');
  const existingRes = await listFiles(100);
  const existingFiles = existingRes.data || [];
  const existingByName = new Map(existingFiles.map((f) => [f.filename, f]));

  console.log(`Found ${existingFiles.length} file(s) already in OpenRouter Files API.`);

  const results = [];
  for (const item of WORKSPACE_FILES_CATALOG) {
    if (!fs.existsSync(item.path)) {
      console.log(`⚠️ Skipping ${item.filename} (file does not exist locally: ${item.path})`);
      continue;
    }

    if (existingByName.has(item.filename)) {
      const existing = existingByName.get(item.filename);
      console.log(
        `ℹ️ [Exists] ${item.filename} (${existing.id}) — replacing with latest version...`
      );
      try {
        await deleteFile(existing.id);
      } catch (err) {
        console.warn(`   Warning: Could not delete old file: ${err.message}`);
      }
    }

    process.stdout.write(`📤 Uploading ${item.filename}... `);
    try {
      const uploaded = await uploadFile(item.path, item.filename);
      console.log(`✅ OK (${uploaded.id}, ${uploaded.size_bytes} bytes)`);
      results.push({ ...item, status: 'uploaded', fileId: uploaded.id, size: uploaded.size_bytes });
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      results.push({ ...item, status: 'failed', error: err.message });
    }
  }

  return results;
}

// CLI handler
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const [, , cmd, ...args] = process.argv;

  switch (cmd) {
    case 'list': {
      listFiles()
        .then((res) => console.log(JSON.stringify(res, null, 2)))
        .catch(console.error);
      break;
    }
    case 'upload': {
      const [filePath, customName] = args;
      if (!filePath) {
        console.error('Usage: sync-files.mjs upload <filePath> [customName]');
        process.exit(1);
      }
      uploadFile(filePath, customName)
        .then((res) => console.log(JSON.stringify(res, null, 2)))
        .catch(console.error);
      break;
    }
    case 'delete': {
      const [fileId] = args;
      if (!fileId) {
        console.error('Usage: sync-files.mjs delete <fileId>');
        process.exit(1);
      }
      deleteFile(fileId)
        .then((res) => console.log(JSON.stringify(res, null, 2)))
        .catch(console.error);
      break;
    }
    case 'populate': {
      populateWorkspaceFiles()
        .then((res) => {
          console.log('\n================================================================');
          console.log(
            `🎉 Populated ${res.filter((r) => r.status === 'uploaded').length} workspace files to OpenRouter`
          );
          console.log('================================================================');
        })
        .catch(console.error);
      break;
    }
    default:
      console.log('OpenRouter Files API Manager');
      console.log('Commands: list, upload <path> [name], delete <id>, populate');
      break;
  }
}
