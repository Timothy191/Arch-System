import '@testing-library/jest-dom';
import { ArchSeparator } from '@repo/ui/Separator';
import { render, screen } from '@testing-library/react';

describe('ArchSeparator', () => {
  it('renders a neutral hairline with separator semantics by default', () => {
    render(<ArchSeparator testId="hairline" />);
    const rule = screen.getByTestId('hairline');
    expect(rule).toHaveClass('separator-arch-line');
    expect(rule).toHaveAttribute('role', 'separator');
    expect(rule).toHaveAttribute('aria-orientation', 'horizontal');
    expect(rule).not.toHaveAttribute('aria-hidden');
  });

  it('can hide an ornamental rule from assistive tech', () => {
    render(<ArchSeparator decorative testId="ornament" />);
    const rule = screen.getByTestId('ornament');
    expect(rule).toHaveAttribute('aria-hidden', 'true');
    expect(rule).not.toHaveAttribute('role');
  });

  it('renders the branded gold rule with diamond marks and optional glow', () => {
    const { container } = render(<ArchSeparator variant="gold" glow testId="gold" />);
    expect(screen.getByTestId('gold')).toHaveClass('separator-arch');
    expect(container.querySelectorAll('.separator-arch-mark')).toHaveLength(2);
    expect(container.querySelector('.separator-arch-glow')).toBeInTheDocument();
  });

  it('embeds the Arch mark for gold-emblem and exposes separator semantics when non-decorative', () => {
    const { container } = render(<ArchSeparator variant="gold-emblem" decorative={false} />);
    const rule = screen.getByRole('separator');
    expect(rule).toHaveClass('separator-arch');
    expect(rule).toHaveAttribute('aria-orientation', 'horizontal');
    expect(container.querySelector('[data-testid]')).toBeNull();
    expect(rule.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the taskbar pipe as a decorative gold glyph', () => {
    render(<ArchSeparator variant="pipe" testId="pipe" />);
    const pipe = screen.getByTestId('pipe');
    expect(pipe).toHaveClass('separator-arch-pipe', 'text-accent-gold');
    expect(pipe).toHaveAttribute('aria-hidden', 'true');
  });

  it('supports vertical hairline orientation', () => {
    render(<ArchSeparator orientation="vertical" decorative={false} testId="rule-v" />);
    const rule = screen.getByTestId('rule-v');
    expect(rule).toHaveClass('separator-arch-line-v');
    expect(rule).toHaveAttribute('role', 'separator');
    expect(rule).toHaveAttribute('aria-orientation', 'vertical');
  });
});
