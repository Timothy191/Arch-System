#!/usr/bin/env node

module.exports = function isolationLayer(toolCall, context) {
  const policy = context.policy;
  if (toolCall.tool !== 'Bash') {
    return { allow: true, reason: `No isolation check for ${toolCall.tool}`, severity: 'info', layer: '03-isolation' };
  }

  const cmd = (toolCall.input?.command || toolCall.input || '').toString().trim();
  if (!cmd) {
    return { allow: true, reason: 'Empty command', severity: 'info', layer: '03-isolation' };
  }

  const dangerous = policy.isolation.dangerous_commands || [];
  for (const pattern of dangerous) {
    if (cmd.toLowerCase().includes(pattern.toLowerCase())) {
      return { allow: false, reason: `Dangerous command pattern detected: ${pattern}`, severity: 'block', layer: '03-isolation' };
    }
  }

  const allowedPrefixes = policy.isolation.allowed_shell_prefixes || [];
  if (allowedPrefixes.length > 0) {
    const matchesAny = allowedPrefixes.some(prefix => cmd.startsWith(prefix));
    if (!matchesAny) {
      return { allow: false, reason: `Command not in allowed prefixes: ${cmd.split(' ')[0]}`, severity: 'block', layer: '03-isolation' };
    }
  }

  const maxOutput = policy.isolation.max_output_bytes || 102400;
  const maxTime = policy.isolation.max_execution_seconds || 30;

  return {
    allow: true,
    reason: `Isolation OK (max ${maxOutput} bytes, ${maxTime}s)`,
    severity: 'info',
    layer: '03-isolation',
    constraints: { maxOutputBytes: maxOutput, maxExecutionSeconds: maxTime }
  };
};
