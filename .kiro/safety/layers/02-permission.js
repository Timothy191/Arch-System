#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';

function loadLocalSettings() {
  try {
    const raw = fs.readFileSync(path.join(PROJ, '.kiro', 'settings.local.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return { permissions: { allow: [], deny: [] } }; }
}

function patternToRegex(pattern) {
  let escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  escaped = escaped.replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function getToolInputStr(tool, input) {
  if (typeof input === 'string') return input;
  if (!input || typeof input !== 'object') return String(input || '');
  if (input.command) return input.command;
  if (input.file_path) return input.file_path;
  if (input.filePath) return input.filePath;
  if (input.content) return input.content;
  if (input.new_string) return input.new_string;
  if (input.old_string) return input.old_string;
  return JSON.stringify(input);
}

function matchPattern(tool, input, pattern) {
  const colonIdx = pattern.indexOf('(');
  if (colonIdx === -1) {
    return pattern === tool || pattern === '*';
  }
  const patternTool = pattern.slice(0, colonIdx);
  const patternArg = pattern.slice(colonIdx);
  if (patternTool !== tool && patternTool !== '*') return false;

  if (patternArg === '(*)' || patternArg === '(**)') return true;

  const argContent = patternArg.slice(1, -1);
  const inputStr = getToolInputStr(tool, input);
  const re = patternToRegex(argContent);
  return re.test(inputStr);
}

module.exports = function permissionLayer(toolCall, context) {
  const policy = context.policy;
  const settings = loadLocalSettings();
  const allowRules = settings.permissions?.allow || [];
  const denyRules = settings.permissions?.deny || [];

  const tool = toolCall.tool;
  const input = toolCall.input;

  if (policy.permission.deny_by_default) {
    for (const rule of allowRules) {
      if (matchPattern(tool, input, rule)) {
        return { allow: true, reason: `Explicitly allowed by rule: ${rule}`, severity: 'info', layer: '02-permission' };
      }
    }
    return { allow: false, reason: `Deny-by-default: no allow rule matches ${tool}`, severity: 'block', layer: '02-permission' };
  }

  for (const rule of denyRules) {
    if (matchPattern(tool, input, rule)) {
      return { allow: false, reason: `Denied by rule: ${rule}`, severity: 'block', layer: '02-permission' };
    }
  }

  const requireApproval = policy.permission.require_approval_for || [];
  for (const rule of requireApproval) {
    if (matchPattern(tool, input, rule)) {
      return { allow: false, reason: `Requires approval: ${rule}`, severity: 'warn', layer: '02-permission' };
    }
  }

  return { allow: true, reason: `No deny rule matches ${tool}`, severity: 'info', layer: '02-permission' };
};
