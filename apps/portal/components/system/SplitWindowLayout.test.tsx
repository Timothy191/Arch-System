import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSplitWindow } from '@/hooks/useSplitWindow';
import { SplitWindowLayout } from './SplitWindowLayout';

describe('SplitWindowLayout', () => {
  beforeEach(() => {
    // Reset store state before each test
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
          detail: { service: 'whatsapp' },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
      expect(screen.getByTestId('whatsapp-live-web-iframe')).toHaveAttribute(
        'src',
        'https://web.whatsapp.com/'
      );
    });
  });

  it('opens multiple tabs for different services', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent('open-split-view', { detail: { service: 'github' } }));
      window.dispatchEvent(new CustomEvent('open-split-view', { detail: { service: 'whatsapp' } }));
    });

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });
  });

  it('focuses existing tab instead of duplicating when same service is opened', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent('open-split-view', { detail: { service: 'whatsapp' } }));
      window.dispatchEvent(new CustomEvent('open-split-view', { detail: { service: 'whatsapp' } }));
    });

    await waitFor(() => {
      const whatsAppTabs = screen.getAllByText('WhatsApp');
      expect(whatsAppTabs).toHaveLength(1);
    });
  });

  it('closes a tab when close button is clicked', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent('open-split-view', { detail: { service: 'whatsapp' } }));
    });

    const closeButton = await waitFor(() => screen.getByTestId('close-tab-whatsapp'));

    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
    });
  });

  it('closes all tabs when global close button is clicked', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent('open-split-view', { detail: { service: 'github' } }));
      window.dispatchEvent(new CustomEvent('open-split-view', { detail: { service: 'whatsapp' } }));
    });

    const closeAllButton = await waitFor(() => screen.getByLabelText('Close all tabs'));

    await act(async () => {
      fireEvent.click(closeAllButton);
    });

    await waitFor(() => {
      expect(screen.queryByText('GitHub')).not.toBeInTheDocument();
      expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
    });
  });

  it('opens Google Docs tab and renders scratchpad and templates', async () => {
    render(
      <SplitWindowLayout>
        <div>Main</div>
      </SplitWindowLayout>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('open-split-view', {
          detail: { service: 'google-docs' },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Google Docs')).toBeInTheDocument();
      expect(screen.getByText('Google Docs Workspace')).toBeInTheDocument();
      expect(screen.getByText('Live Scratchpad & Editor')).toBeInTheDocument();
      expect(screen.getByText('Mining Templates')).toBeInTheDocument();
    });
  });

  it('opens Google Calendar tab and renders live shift schedule controls', async () => {
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
      expect(screen.getByText('Live Site Calendar')).toBeInTheDocument();
      expect(screen.getByText('Quick Shift Event')).toBeInTheDocument();
    });
  });
});
