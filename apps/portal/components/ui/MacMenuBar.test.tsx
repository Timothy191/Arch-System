import { MacMenuBar } from '@repo/ui/MacMenuBar';
import { fireEvent, render, screen } from '@testing-library/react';

describe('MacMenuBar 3D taskbar', () => {
  it('keeps the glass branding classes and existing landmarks', () => {
    render(<MacMenuBar menuItems={['File']} rightSlot={<span>System tray</span>} />);
    const bar = screen.getByTestId('mac-menu-bar');
    expect(bar).toHaveClass(
      'liquid-glass-light',
      'gold-steel-border',
      'gold-steel-border-slim',
      'border',
      'border-white/25',
      'bg-[var(--material-ultra-thin)]',
      'shadow-diffusion-sm',
      'backdrop-blur-md',
      'fixed',
      'inset-x-3'
    );
    expect(screen.getByRole('navigation', { name: 'Main Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByText('System tray')).toBeInTheDocument();
  });

  it('renders decorative depth layers and separators hidden from assistive tech', () => {
    render(<MacMenuBar menuItems={['File']} />);
    const separators = screen.getAllByTestId('menubar-separator');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('applies the hover-lift and gold underline to menu buttons', () => {
    render(<MacMenuBar menuItems={['File']} />);
    const button = screen.getByRole('button', { name: 'File' });
    expect(button).toHaveClass('hover:-translate-y-px', 'after:bg-accent-gold', 'min-h-11');
    expect(button).not.toHaveClass('transition-colors');
  });

  it('tolerates pointer events without a fine pointer (touch / jsdom)', () => {
    render(<MacMenuBar menuItems={['File']} />);
    const bar = screen.getByTestId('mac-menu-bar');
    expect(() => {
      fireEvent.pointerEnter(bar, { pointerType: 'touch', clientX: 10, clientY: 10 });
      fireEvent.pointerMove(bar, { pointerType: 'mouse', clientX: 40, clientY: 12 });
      fireEvent.pointerLeave(bar);
    }).not.toThrow();
    expect(bar).toBeInTheDocument();
  });
});
