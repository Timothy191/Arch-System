import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { CommandBar } from './CommandBar';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('~/app/actions', () => ({
  logout: jest.fn().mockResolvedValue(undefined),
}));

describe('CommandBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing initially when modal is closed', () => {
    render(<CommandBar />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens command palette when Cmd+K or Ctrl+K is pressed', () => {
    render(<CommandBar />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search departments/i)).toBeInTheDocument();
  });

  it('closes command palette when Escape is pressed', () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('filters command list based on search query', () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/Search departments/i);
    fireEvent.change(input, { target: { value: 'Drilling' } });

    expect(screen.getByText('Drilling Operations')).toBeInTheDocument();
    expect(screen.queryByText('Production')).not.toBeInTheDocument();
  });

  it('displays empty state when no commands match search query', () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/Search departments/i);
    fireEvent.change(input, { target: { value: 'nonexistent-query-xyz' } });

    expect(screen.getByText(/No results found for "nonexistent-query-xyz"/i)).toBeInTheDocument();
  });

  it('navigates through items with ArrowDown and ArrowUp and selects on Enter', () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    // Press ArrowDown to navigate to second item
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    // Press Enter to select
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(mockPush).toHaveBeenCalledWith('/drilling');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('selects command item when clicked directly', () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const productionBtn = screen.getByText('Production');
    fireEvent.click(productionBtn);

    expect(mockPush).toHaveBeenCalledWith('/production');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes modal when backdrop is clicked', () => {
    render(<CommandBar />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.firstElementChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
