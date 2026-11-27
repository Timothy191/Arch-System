import { render, screen } from '@testing-library/react';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders nothing for fewer than two points', () => {
    const { container } = render(<Sparkline data={[4]} />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes an accessible image with baseline and high/low markers using currentColor', () => {
    render(
      <Sparkline
        data={[10, 20, 5, 30, 25]}
        ariaLabel="Drilling trend"
        className="text-accent-gold"
      />
    );
    const chart = screen.getByRole('img', { name: 'Drilling trend' });
    expect(chart).toHaveClass('text-accent-gold');
    expect(screen.getByTestId('sparkline-baseline')).toBeInTheDocument();
    expect(screen.getByTestId('sparkline-high-marker')).toHaveAttribute('stroke', 'currentColor');
    expect(screen.getByTestId('sparkline-low-marker')).toBeInTheDocument();
    expect(chart.innerHTML).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });

  it('is hidden from assistive tech without a label and skips the low marker on flat data', () => {
    render(<Sparkline data={[3, 3, 3]} />);
    const chart = screen.getByTestId('sparkline-svg');
    expect(chart).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTestId('sparkline-low-marker')).not.toBeInTheDocument();
  });
});
