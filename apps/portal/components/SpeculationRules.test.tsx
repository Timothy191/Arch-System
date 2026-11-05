import { render } from '@testing-library/react';
import {
  SPECULATION_RULES_JSON,
  SPECULATION_RULES_PAYLOAD,
  SpeculationRules,
} from './SpeculationRules';

describe('SpeculationRules', () => {
  it('renders a <script type="speculationrules"> tag with moderate eagerness for department routes', () => {
    const { container } = render(<SpeculationRules />);
    const scriptEl = container.querySelector('script[type="speculationrules"]');
    expect(scriptEl).not.toBeNull();
    expect(scriptEl?.innerHTML).toBe(SPECULATION_RULES_JSON);

    const parsed = JSON.parse(scriptEl?.innerHTML ?? '{}');
    expect(parsed.prerender[0].eagerness).toBe('moderate');
    expect(parsed.prefetch[0].eagerness).toBe('moderate');
    expect(SPECULATION_RULES_PAYLOAD.prerender[0].where.and[0].href_matches).toContain(
      '/control-room/*'
    );
    expect(SPECULATION_RULES_PAYLOAD.prerender[0].where.and[1].not.href_matches).toContain(
      '/login*'
    );
  });

  it('forwards an optional CSP nonce attribute to the speculationrules script tag', () => {
    const { container } = render(<SpeculationRules nonce="arch-nonce-123" />);
    const scriptEl = container.querySelector('script[type="speculationrules"]');
    expect(scriptEl).not.toBeNull();
    expect(scriptEl?.getAttribute('nonce')).toBe('arch-nonce-123');
  });
});
