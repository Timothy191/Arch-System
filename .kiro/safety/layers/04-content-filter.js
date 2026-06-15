#!/usr/bin/env node

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS Secret Key', re: /\b(?:aws_)?secret(?:_access)?_key\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/i },
  { name: 'GitHub Token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Anthropic API Key', re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'OpenAI API Key', re: /\bsk-(?:proj-)?(?!ant-)[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'Slack Token', re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/ },
  { name: 'Google API Key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { name: 'Stripe Secret Key', re: /\bsk_live_[0-9a-zA-Z]{24,}\b/ },
  { name: 'Private Key Block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: 'Bearer Token', re: /\bBearer\s+[A-Za-z0-9_\-.=]{30,}/ },
  { name: 'Generic Password', re: /\b(?:password|passwd|pwd)\s*[=:]\s*["'][^"'\s]{8,}["']/i },
];

const ALLOWLIST = [
  /example|placeholder|your[_\-]?(?:api[_\-]?)?key|xxx+|\*{4,}|<[A-Z_]+>/i,
  /process\.env\./,
  /os\.getenv|os\.environ/,
];

function scanText(text) {
  if (!text || typeof text !== 'string') return null;
  for (const { name, re } of SECRET_PATTERNS) {
    const match = text.match(re);
    if (!match) continue;
    const contextLine = text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100);
    const lineNum = text.slice(0, match.index).split('\n').length;
    if (ALLOWLIST.some(a => a.test(contextLine))) continue;
    return { name, snippet: match[0].slice(0, 40), line: lineNum };
  }
  return null;
}

function inputToText(toolCall) {
  const input = toolCall.input || {};
  if (typeof input === 'string') return input;
  return JSON.stringify(input);
}

module.exports = function contentFilterLayer(toolCall, context) {
  const policy = context.policy;
  if (!policy.content_filter?.block_secrets) {
    return { allow: true, reason: 'Content filtering disabled', severity: 'info', layer: '04-content-filter' };
  }

  const text = inputToText(toolCall);
  const hit = scanText(text);
  if (hit) {
    return { allow: false, reason: `Secret detected: ${hit.name} near line ${hit.line}: ${hit.snippet}`, severity: 'block', layer: '04-content-filter' };
  }

  return { allow: true, reason: 'No secrets detected', severity: 'info', layer: '04-content-filter' };
};
