import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSplitWindow } from '@/hooks/useSplitWindow';
import { SplitWindowLayout } from './SplitWindowLayout';

describe('SplitWindowLayout', () => {
  beforeEach(() => {
    useSplitWindow.setState({
      isOpen: false,
      tabs: [],
      activeTabId: null,
    });
  });

  it('renders children in main workspace', () => {
    render(
      <SplitWindowLayout>
        <div data-testid="main-content">Main Content</div>
      </SplitWindowLayout>
    );
    expect(screen.getByTestId('main-content')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('opens a tab when open-split-view event is dispatched', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('open-split-view', {
          detail: { service: 'google-calendar' },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-google-calendar')).toBeInTheDocument();
      expect(screen.getByText('Google Calendar & Schedule')).toBeInTheDocument();
    });
  });

  it('opens multiple tabs for different services', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('open-split-view', { detail: { service: 'google-calendar' } })
      );
      window.dispatchEvent(
        new CustomEvent('open-split-view', { detail: { service: 'google-sheets' } })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-google-calendar')).toBeInTheDocument();
      expect(screen.getByTestId('tab-google-sheets')).toBeInTheDocument();
    });
  });

  it('focuses existing tab instead of duplicating when same service is opened', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('open-split-view', { detail: { service: 'google-calendar' } })
      );
      window.dispatchEvent(
        new CustomEvent('open-split-view', { detail: { service: 'google-calendar' } })
      );
    });

    await waitFor(() => {
      const calendarTabs = screen.getAllByTestId('tab-google-calendar');
      expect(calendarTabs).toHaveLength(1);
    });
  });

  it('closes a tab when close button is clicked', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('open-split-view', { detail: { service: 'google-calendar' } })
      );
    });

    const closeButton = await waitFor(() => screen.getByTestId('close-tab-google-calendar'));

    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('tab-google-calendar')).not.toBeInTheDocument();
    });
  });

  it('closes all tabs when global close button is clicked', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('open-split-view', { detail: { service: 'google-calendar' } })
      );
      window.dispatchEvent(
        new CustomEvent('open-split-view', { detail: { service: 'google-sheets' } })
      );
    });

    const closeAllButton = await waitFor(() => screen.getByLabelText('Close all tabs'));

    await act(async () => {
      fireEvent.click(closeAllButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('tab-google-calendar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab-google-sheets')).not.toBeInTheDocument();
    });
  });
});
