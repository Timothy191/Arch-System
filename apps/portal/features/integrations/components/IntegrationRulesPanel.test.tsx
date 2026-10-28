import { fireEvent, render, screen } from '@testing-library/react';
import {
  buildRulesPayloadFromForm,
  DEFAULT_RULES_FORM_STATE,
  INTEGRATION_RULE_PRESETS,
  IntegrationRuleSummaryBadges,
  IntegrationRulesFields,
  rulesFormFromConfig,
  simulateIntegrationRulesDryRun,
} from './IntegrationRulesPanel';

describe('IntegrationRulesPanel (4-Pillar Policy & Governance Rules UI)', () => {
  it('builds a clean IntegrationRules payload from form state and round-trips via rulesFormFromConfig', () => {
    const customForm = {
      ...DEFAULT_RULES_FORM_STATE,
      allowedRoles: ['admin', 'control_room_operator'] as const,
      activeShift: 'day' as const,
      rateLimitPerMin: '45',
      requireHumanApproval: true,
      triggerEvents: ['breakdown.created', 'vercel.firewall.attack'],
      thresholdMetric: 'cycloneRd',
      thresholdOperator: 'gt' as const,
      thresholdValue: '1.52',
      blockedArgKeys: 'raw_sql, password',
      redactFields: 'api_token, ssn',
      maxPayloadBytes: '32768',
      writeToolOverrides: 'drop_table, update_config',
      egressDomainAllowlist: 'mcp.sentry.dev, mcp.vercel.com',
      circuitBreakerThreshold: '3',
    };

    const payload = buildRulesPayloadFromForm({
      ...customForm,
      allowedRoles: [...customForm.allowedRoles],
    });

    expect(payload).toEqual({
      allowed_roles: ['admin', 'control_room_operator'],
      active_shift: 'day',
      rate_limit_per_min: 45,
      require_human_approval: true,
      trigger_events: ['breakdown.created', 'vercel.firewall.attack'],
      threshold_metric: 'cycloneRd',
      threshold_operator: 'gt',
      threshold_value: 1.52,
      blocked_arg_keys: ['raw_sql', 'password'],
      redact_fields: ['api_token', 'ssn'],
      max_payload_bytes: 32768,
      write_tool_overrides: ['drop_table', 'update_config'],
      egress_domain_allowlist: ['mcp.sentry.dev', 'mcp.vercel.com'],
      circuit_breaker_threshold: 3,
    });

    const roundTrip = rulesFormFromConfig({ rules: payload });
    expect(roundTrip.activeShift).toBe('day');
    expect(roundTrip.rateLimitPerMin).toBe('45');
    expect(roundTrip.blockedArgKeys).toBe('raw_sql, password');
    expect(roundTrip.egressDomainAllowlist).toBe('mcp.sentry.dev, mcp.vercel.com');
  });

  it('renders all 4 rule pillars and invokes onChange and onSave callbacks', () => {
    const handleChange = jest.fn();
    const handleSave = jest.fn();

    render(
      <IntegrationRulesFields
        idPrefix="test"
        rulesForm={DEFAULT_RULES_FORM_STATE}
        onChange={handleChange}
        onSave={handleSave}
      />
    );

    expect(screen.getByText(/1\. Access & Governance Rules/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Event & Threshold Trigger Rules/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Tool & Payload Policy Rules/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Network & Egress Rules/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Control Room' }));
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedRoles: ['admin', 'supervisor', 'control_room_operator'],
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Save Policy Rules/i }));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('renders summary badges when rules are configured on an installation', () => {
    render(
      <IntegrationRuleSummaryBadges
        config={{
          rules: {
            active_shift: 'night',
            rate_limit_per_min: 60,
            allowed_roles: ['admin'],
            trigger_events: ['breakdown.created', 'shift.closeout'],
            circuit_breaker_threshold: 4,
          },
        }}
      />
    );

    expect(screen.getByText('Shift: night')).toBeInTheDocument();
    expect(screen.getByText('Rate: 60/min')).toBeInTheDocument();
    expect(screen.getByText('Roles: 1')).toBeInTheDocument();
    expect(screen.getByText('Triggers: 2')).toBeInTheDocument();
    expect(screen.getByText('CB: 4 err')).toBeInTheDocument();
  });

  it('applies one-click rule presets and evaluates policy dry-run simulations accurately', () => {
    const handleChange = jest.fn();
    render(
      <IntegrationRulesFields
        idPrefix="sim"
        rulesForm={DEFAULT_RULES_FORM_STATE}
        onChange={handleChange}
      />
    );

    // Click LSP & Schema Intelligence preset
    fireEvent.click(screen.getByRole('button', { name: 'LSP & Schema Intelligence' }));
    const lspPreset = INTEGRATION_RULE_PRESETS.find((p) => p.id === 'lsp-code-intelligence');
    expect(handleChange).toHaveBeenCalledWith(lspPreset?.state);

    // Open interactive Dry-Run simulator and evaluate
    fireEvent.click(screen.getByRole('button', { name: /Policy Dry-Run/i }));
    fireEvent.click(screen.getByRole('button', { name: /Evaluate Policy Now/i }));
    expect(screen.getByText(/Verdict: ALLOW/i)).toBeInTheDocument();

    // Direct unit check on simulateIntegrationRulesDryRun for DENY & field redaction
    const highSecPreset = INTEGRATION_RULE_PRESETS.find((p) => p.id === 'high-security-write')!;
    const denyResult = simulateIntegrationRulesDryRun(highSecPreset.state, {
      role: 'operator',
      hourOfDay: 14,
      isApproved: false,
      endpointHost: 'untrusted.example.com',
      eventName: 'breakdown.created',
      samplePayloadJson: '{"raw_sql":"DROP TABLE x","password":"secret-value"}',
    });
    expect(denyResult.verdict).toBe('DENY');
    expect(denyResult.sanitizedPayload.password).toBe('[REDACTED]');
    expect(denyResult.reasons.some((r) => r.includes('not in allowed_roles'))).toBe(true);
    expect(denyResult.reasons.some((r) => r.includes('blocked by blocked_arg_keys'))).toBe(true);
  });
});
