import { render, screen } from '@testing-library/react';
import { getSiteCalendarEmbedUrl } from '~/lib/google-workspace';
import { DOCUMENTS_ACTIONS, GoogleWorkspacePanel, SCHEDULE_ACTIONS } from './GoogleWorkspacePanel';

const TEST_SITE_CALENDAR_SRC = 'site-shift-calendar@group.calendar.google.com';

describe('GoogleWorkspacePanel', () => {
  describe('Given the Documents tab', () => {
    it('When rendered, Then lists the Google hand-off actions and never embeds', () => {
      render(<GoogleWorkspacePanel service="docs" actions={DOCUMENTS_ACTIONS} embedUrl={null} />);

      expect(screen.getByText('Google Docs Workspace')).toBeInTheDocument();
      for (const actionLabel of DOCUMENTS_ACTIONS.map((action) => action.label)) {
        expect(screen.getByText(actionLabel)).toBeInTheDocument();
      }
      expect(document.querySelector('a[href*="docs.google.com"]')).toBeTruthy();
      expect(document.querySelector('a[href*="drive.google.com"]')).toBeTruthy();
      expect(document.querySelector('iframe')).toBeNull();
      // Hand-off explainer stays visible when nothing is frameable
      expect(screen.getByText('How Google Docs Integration Works')).toBeInTheDocument();
    });
  });

  describe('Given the Schedule tab without a published site calendar', () => {
    it('When rendered, Then only the hand-off explainer appears', () => {
      render(
        <GoogleWorkspacePanel service="calendar" actions={SCHEDULE_ACTIONS} embedUrl={null} />
      );

      expect(screen.getByText('Google Calendar & Shift Schedule')).toBeInTheDocument();
      for (const actionLabel of SCHEDULE_ACTIONS.map((action) => action.label)) {
        expect(screen.getByText(actionLabel)).toBeInTheDocument();
      }
      expect(document.querySelector('iframe')).toBeNull();
    });
  });

  describe('Given the Schedule tab with a published site calendar', () => {
    it('When rendered, Then the frameable embed is shown instead of the explainer', () => {
      const embedUrl = getSiteCalendarEmbedUrl(TEST_SITE_CALENDAR_SRC);
      render(
        <GoogleWorkspacePanel service="calendar" actions={SCHEDULE_ACTIONS} embedUrl={embedUrl} />
      );

      const embedFrame = screen.getByTitle('Published site calendar');
      expect(embedFrame).toHaveAttribute(
        'src',
        expect.stringContaining('calendar.google.com/calendar/embed')
      );
      expect(screen.queryByText('How Google Calendar Integration Works')).toBeNull();
    });
  });
});
