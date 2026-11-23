import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ServicesDropdown } from './ServicesDropdown';

jest.mock('@repo/ui/components/ui/dropdown-menu', () => {
  const React = require('react');
  return {
    DropdownMenu: ({ children, open, onOpenChange }: any) => {
      return (
        <div data-testid="dropdown-menu">
          {React.Children.map(children, (child: any) => {
            if (!child) return null;
            return React.cloneElement(child, {
              isOpen: open,
              onOpenChange,
            });
          })}
        </div>
      );
    },
    DropdownMenuTrigger: ({ children, asChild, onClick, isOpen, onOpenChange }: any) => {
      const handleClick = (e: any) => {
        if (onClick) onClick(e);
        if (onOpenChange) onOpenChange(!isOpen);
      };
      if (asChild) {
        return React.cloneElement(children, {
          onClick: handleClick,
          'aria-expanded': isOpen ? 'true' : 'false',
        });
      }
      return <button onClick={handleClick}>{children}</button>;
    },
    DropdownMenuContent: ({ children, className, isOpen }: any) => {
      if (!isOpen) return null;
      return (
        <div className={className} role="menu">
          {children}
        </div>
      );
    },
    DropdownMenuItem: ({ children, onSelect, className, asChild }: any) => {
      const handleClick = (e: any) => {
        if (onSelect) onSelect(e);
      };
      if (asChild) {
        return React.cloneElement(children, {
          onClick: (e: any) => {
            handleClick(e);
            if (children.props.onClick) children.props.onClick(e);
          },
        });
      }
      return (
        <div onClick={handleClick} className={className} role="menuitem">
          {children}
        </div>
      );
    },
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
    DropdownMenuSubTrigger: ({ children, className }: any) => (
      <div className={className} role="button">
        {children}
      </div>
    ),
    DropdownMenuSubContent: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    DropdownMenuPortal: ({ children }: any) => <>{children}</>,
  };
});

jest.mock('@/lib/weather-api', () => ({
  fetchWeather: jest.fn(() =>
    Promise.resolve({
      temperature: 24,
      feelsLike: 26,
      humidity: 62,
      windSpeed: 14,
      windDirection: 135,
      weatherCode: 2,
      description: 'Partly cloudy',
      icon: '⛅',
      timestamp: new Date().toISOString(),
      location: { lat: -26.35914, lon: 28.79267, name: 'Delmas, Mpumalanga' },
      daily: [
        {
          date: '2026-11-20',
          maxTemp: 27,
          minTemp: 14,
          weatherCode: 1,
          description: 'Mainly clear',
          icon: '🌤️',
          precipitation: 0,
        },
      ],
      hourly: [
        {
          time: '2026-11-20T08:00',
          hourLabel: '08:00',
          temperature: 21,
          weatherCode: 1,
          description: 'Mainly clear',
          icon: '🌤️',
          windSpeed: 12,
          precipitationProbability: 10,
          isDay: true,
        },
        {
          time: '2026-11-20T14:00',
          hourLabel: '14:00',
          temperature: 27,
          weatherCode: 2,
          description: 'Partly cloudy',
          icon: '⛅',
          windSpeed: 16,
          precipitationProbability: 25,
          isDay: true,
        },
      ],
    })
  ),
  getWindDirection: jest.fn((deg: number) => {
    const dirs = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16] ?? 'N';
  }),
}));

jest.mock('~/app/actions', () => ({
  logout: jest.fn(),
}));

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'bd-1',
            reason: 'Excavator hydraulic leak',
            status: 'open',
            created_at: new Date().toISOString(),
          },
          {
            id: 'bd-2',
            reason: 'Crusher belt alignment',
            status: 'in_progress',
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      }),
    })),
  })),
}));

describe('ServicesDropdown', () => {
  beforeEach(() => {
    window.localStorage.removeItem('arch-services-pos');
  });

  afterEach(() => {
    window.localStorage.removeItem('arch-services-pos');
  });

  it('renders system tray trigger icon', () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole('button', { name: /system tray/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles dropdown on click', async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole('button', { name: /system tray/i });

    // Open
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    // Close
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('renders environmental and operations status when open', async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole('button', { name: /system tray/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      // Weather
      expect(screen.getByText('24°C')).toBeInTheDocument();
      expect(screen.getByText('Partly cloudy')).toBeInTheDocument();

      // Shift
      expect(screen.getByText(/Shift$/)).toBeInTheDocument(); // Day or Night Shift
      expect(screen.getByText(/\d+h remaining/)).toBeInTheDocument();

      // Wind
      expect(screen.getByText('14 km/h')).toBeInTheDocument();
      expect(screen.getByText('Visibility OK')).toBeInTheDocument();

      // Safety alerts
      expect(screen.getByText(/2 active alerts/)).toBeInTheDocument();
    });
  });

  it('renders session options when open', async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole('button', { name: /system tray/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Log Out')).toBeInTheDocument();
      expect(screen.getByText('Restart…')).toBeInTheDocument();
    });
  });

  it('contains logout form', async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole('button', { name: /system tray/i });
    fireEvent.click(trigger);

    const logoutButton = screen.getByText('Log Out');
    expect(logoutButton.closest('form')).toBeInTheDocument();
  });

  it('renders View and Safety submenus and their contents', async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole('button', { name: /system tray/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('View')).toBeInTheDocument();
      expect(screen.getByText('Safety & Emergency')).toBeInTheDocument();
      expect(screen.getByText('Reload')).toBeInTheDocument();
      expect(screen.getByText('Toggle Fullscreen')).toBeInTheDocument();
      expect(screen.getByText('Control Room Telemetry')).toBeInTheDocument();
      expect(screen.getByText('Control Room Dashboard')).toBeInTheDocument();
    });
  });

  it('toggles dropdown on Alt+S keyboard shortcut', async () => {
    render(<ServicesDropdown />);
    const trigger = screen.getByRole('button', { name: /system tray/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Open
    fireEvent.keyDown(window, { key: 's', altKey: true });
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    // Close
    fireEvent.keyDown(window, { key: 's', altKey: true });
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('opens the 7-day weather forecast panel by default and displays the rain production loss engine', async () => {
    render(<ServicesDropdown />);
    fireEvent.click(screen.getByRole('button', { name: /system tray/i }));

    const weatherToggle = await screen.findByTestId('weather-panel-toggle');
    expect(screen.getByTestId('weekly-weather-forecast-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7-Day' })).toBeInTheDocument();
    expect(screen.getByText('27°')).toBeInTheDocument();
    expect(screen.getByTestId('rain-production-loss-engine')).toBeInTheDocument();

    fireEvent.click(weatherToggle);
    expect(screen.queryByTestId('weekly-weather-forecast-panel')).not.toBeInTheDocument();

    fireEvent.click(weatherToggle);
    expect(screen.getByTestId('weekly-weather-forecast-panel')).toBeInTheDocument();
  });

  it('switches to the full hourly weather forecast breakdown when the shift card is clicked', async () => {
    render(<ServicesDropdown />);
    fireEvent.click(screen.getByRole('button', { name: /system tray/i }));

    const shiftToggle = await screen.findByTestId('shift-hourly-forecast-toggle');
    expect(screen.queryByTestId('hourly-weather-forecast-panel')).not.toBeInTheDocument();

    fireEvent.click(shiftToggle);
    expect(screen.getByTestId('hourly-weather-forecast-panel')).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('27°C')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    fireEvent.keyDown(shiftToggle, { key: 'Enter' });
    expect(screen.queryByTestId('hourly-weather-forecast-panel')).not.toBeInTheDocument();
  });
});
