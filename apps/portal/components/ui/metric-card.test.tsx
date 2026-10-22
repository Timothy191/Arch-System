import { MetricCard } from '@repo/ui/components/ui/metric-card';
import { render, screen } from '@testing-library/react';
import React from 'react';

describe('MetricCard', () => {
  it('renders metric title and numeric value', () => {
    render(<MetricCard title="Total Production" value="12,450" unit="tonnes" />);
    expect(screen.getByText('Total Production')).toBeInTheDocument();
    expect(screen.getByText('12,450')).toBeInTheDocument();
    expect(screen.getByText('tonnes')).toBeInTheDocument();
  });

  it('renders positive change percentage with upward trend', () => {
    render(<MetricCard title="Drill Rate" value={142} change={5.2} changeLabel="vs last shift" />);
    expect(screen.getByText('5.2%')).toBeInTheDocument();
    expect(screen.getByText('vs last shift')).toBeInTheDocument();
  });
});
