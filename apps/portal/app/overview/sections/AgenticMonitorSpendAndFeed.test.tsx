import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AgenticMonitorSpendAndFeed } from './AgenticMonitorSpendAndFeed';

describe('AgenticMonitorSpendAndFeed', () => {
  it('renders pricing cards, milestone spend table, and filtered feed with en-US token counts', () => {
    render(
      <AgenticMonitorSpendAndFeed
        selectedAgent="all"
        filteredFeed={[
          {
            id: 'TASK-01',
            agent: 'Antigravity',
            role: 'Verifier',
            timestamp: '2026-11-19 10:00',
            tokensUsed: 12450,
            zarCost: 42.5,
            status: 'COMPLETED',
            action: 'Verified 13 departments',
            details: 'All 13 department suites green',
          },
        ]}
      />
    );

    expect(screen.getByText(/12,450 tokens/i)).toBeInTheDocument();
    expect(screen.getByText('Verified 13 departments')).toBeInTheDocument();
    expect(screen.getByText('TOTAL (11 Weeks)')).toBeInTheDocument();
  });
});
