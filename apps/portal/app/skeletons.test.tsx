import { render, screen } from '@testing-library/react';
import React from 'react';
import LoginLoading from './(auth)/login/loading';
import DrillingLoading from './(departments)/drilling/loading';
import AdminLoading from './admin/loading';
import HubLoading from './hub/loading';

describe('Next.js Skeleton UIs (loading.tsx)', () => {
  describe('LoginLoading (/login)', () => {
    it('renders login skeleton structure matching page layout without shift', () => {
      const { container } = render(<LoginLoading />);

      const main = screen.getByRole('main', { name: /loading sign in page/i });
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('aria-busy', 'true');

      // Card container
      const card = container.querySelector('[data-testid="login-card-skeleton"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('rounded-2xl');
      expect(card?.parentElement).toHaveClass('max-w-md');

      // Form skeleton fields & submit button
      const formSkeleton = card?.querySelector('[aria-hidden="true"]');
      expect(formSkeleton).toBeInTheDocument();

      // Ambient blur decorations
      const ambientAccents = container.querySelectorAll('[aria-hidden="true"].blur-\\[50px\\]');
      expect(ambientAccents.length).toBe(2);

      // Footer
      const footer = container.querySelector('footer');
      expect(footer).toBeInTheDocument();
    });
  });

  describe('HubLoading (/hub)', () => {
    it('renders operations hub skeleton matching page layout without shift', () => {
      const { container } = render(<HubLoading />);

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('aria-busy', 'true');
      expect(root).toHaveAttribute('aria-label', 'Loading Operations Hub');

      // Hero section with 460px container and controls
      const heroSection = container.querySelector('section');
      expect(heroSection).toBeInTheDocument();
      expect(container.querySelector('.h-\\[460px\\]')).toBeInTheDocument();

      // Double marquee review cards
      const reviewCards = container.querySelectorAll('.shadow-card');
      expect(reviewCards.length).toBe(8); // 2 rows of 4 cards

      // Operational modules grid with 8 uiverse-cards
      const deptCards = container.querySelectorAll('.uiverse-card');
      expect(deptCards.length).toBe(8);
      expect(deptCards[0]).toHaveClass('h-[290px]');

      // Active metrics chart placeholder
      const metricsChart = container.querySelector('.h-40');
      expect(metricsChart).toBeInTheDocument();

      // Operational telemetry card placeholder
      const telemetryChart = container.querySelector('.h-64');
      expect(telemetryChart).toBeInTheDocument();
    });
  });

  describe('DrillingLoading (/drilling)', () => {
    it('renders drilling skeleton matching page layout without shift', () => {
      const { container } = render(<DrillingLoading />);

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('aria-busy', 'true');
      expect(root).toHaveAttribute('aria-label', 'Loading drilling operations');

      // Header row
      const header = container.querySelector('.flex.items-center.justify-between');
      expect(header).toBeInTheDocument();

      // Fading divider
      expect(screen.getByText('REAL-TIME OPERATIONS')).toBeInTheDocument();

      // 4-column KPI cards
      const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4');
      expect(grid).toBeInTheDocument();
      expect(grid?.children.length).toBe(4);
    });
  });

  describe('AdminLoading (/admin)', () => {
    it('renders admin skeleton matching page layout without shift', () => {
      const { container } = render(<AdminLoading />);

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('aria-busy', 'true');
      expect(root).toHaveAttribute('aria-label', 'Loading admin panel');

      // Admin tabs bar with active tab + 7 other tabs
      const tabsBar = container.querySelector('.overflow-x-auto');
      expect(tabsBar).toBeInTheDocument();
      expect(tabsBar?.children.length).toBe(8);

      // Search & action bar
      const searchBar = container.querySelector('.max-w-md');
      expect(searchBar).toBeInTheDocument();

      // Table skeleton with 6 columns
      const table = container.querySelector('table');
      expect(table).toBeInTheDocument();
      const headers = table?.querySelectorAll('th');
      expect(headers?.length).toBe(6);
      expect(headers?.[0]).toHaveTextContent('Name');
      expect(headers?.[1]).toHaveTextContent('Role');
      expect(headers?.[2]).toHaveTextContent('Department');
      expect(headers?.[3]).toHaveTextContent('Accessible Depts');
      expect(headers?.[4]).toHaveTextContent('Created');
      expect(headers?.[5]).toHaveTextContent('Actions');

      // 6 table skeleton rows
      const rows = table?.querySelectorAll('tbody tr');
      expect(rows?.length).toBe(6);
    });
  });
});
