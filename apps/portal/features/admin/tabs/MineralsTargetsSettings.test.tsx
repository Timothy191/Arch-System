import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { externalContentIndexing } from '../../../actions/external-content-indexing';
import {
  deleteCardTemplate,
  getPortalSettings,
  listCardTemplates,
  savePortalSettings,
  setDefaultCardTemplate,
  uploadCardTemplate,
} from '../actions/card-templates';
import { adminSaveMineralRegistry, getMineralRegistry } from '../actions/minerals';
import { adminSaveOperationalTargets, getOperationalTargets } from '../actions/targets';
import { ExternalContentTab } from './ExternalContentTab';
import { MineralsTab } from './MineralsTab';
import { SettingsTab } from './SettingsTab';
import { OPERATIONAL_TARGETS_STORAGE_KEY, TargetsTab } from './TargetsTab';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../actions/minerals', () => ({
  getMineralRegistry: jest.fn(),
  adminSaveMineralRegistry: jest.fn(),
}));

jest.mock('../actions/targets', () => ({
  getOperationalTargets: jest.fn(),
  adminSaveOperationalTargets: jest.fn(),
}));

jest.mock('../actions/card-templates', () => ({
  listCardTemplates: jest.fn(),
  uploadCardTemplate: jest.fn(),
  setDefaultCardTemplate: jest.fn(),
  deleteCardTemplate: jest.fn(),
  getPortalSettings: jest.fn(),
  savePortalSettings: jest.fn(),
}));

jest.mock('../../../actions/external-content-indexing', () => ({
  externalContentIndexing: jest.fn(),
}));

describe('Admin Minerals, Targets, Settings & ExternalContent Tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('MineralsTab adds, renames inline, and rolls back optimistic state if save fails', async () => {
    jest.mocked(getMineralRegistry).mockResolvedValueOnce({
      waste: ['Dyke', 'Overburden'],
      coal: ['2#Lower', '4#Upper'],
    });
    jest
      .mocked(adminSaveMineralRegistry)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ error: 'Database offline' });

    render(<MineralsTab />);
    await waitFor(() => {
      expect(screen.getByText('Overburden')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Dyke, Overburden/i), {
      target: { value: 'Mudstone' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Dyke, Overburden/i).closest('form')!);

    await waitFor(() => {
      expect(adminSaveMineralRegistry).toHaveBeenCalledWith({
        waste: ['Dyke', 'Overburden', 'Mudstone'],
        coal: ['2#Lower', '4#Upper'],
      });
    });
    expect(screen.getByText('Mudstone')).toBeInTheDocument();

    // Inline rename
    fireEvent.click(screen.getByLabelText('Rename Mudstone'));
    fireEvent.change(screen.getByLabelText('Rename Mudstone'), {
      target: { value: 'Shale Mudstone' },
    });
    fireEvent.click(screen.getByLabelText('Save rename for Mudstone'));
    await waitFor(() => {
      expect(adminSaveMineralRegistry).toHaveBeenCalledWith({
        waste: ['Dyke', 'Overburden', 'Shale Mudstone'],
        coal: ['2#Lower', '4#Upper'],
      });
    });

    // Now remove fails -> state rolls back cleanly and Shale Mudstone remains rendered
    fireEvent.click(screen.getByTitle('Remove Shale Mudstone'));
    await waitFor(() => {
      expect(adminSaveMineralRegistry).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText('Shale Mudstone')).toBeInTheDocument();
  });

  it('TargetsTab clamps min={1}, tracks dirty state, auto-scales from shift, and persists localStorage after save', async () => {
    const initial = {
      shift: {
        loadsTarget: 150,
        coalTonnesTarget: 4000,
        wasteTonnesTarget: 8000,
        volumeBcmTarget: 5000,
        smrHoursTarget: 90,
      },
      daily: {
        loadsTarget: 300,
        coalTonnesTarget: 8000,
        wasteTonnesTarget: 16000,
        volumeBcmTarget: 10000,
        smrHoursTarget: 180,
      },
      monthly: {
        loadsTarget: 9000,
        coalTonnesTarget: 240000,
        wasteTonnesTarget: 480000,
        volumeBcmTarget: 300000,
        smrHoursTarget: 5400,
      },
    };
    jest.mocked(getOperationalTargets).mockResolvedValueOnce(initial);
    jest.mocked(adminSaveOperationalTargets).mockResolvedValueOnce({ success: true });

    render(<TargetsTab />);
    await waitFor(() => {
      expect(screen.getByText('Shift Targets')).toBeInTheDocument();
    });

    const shiftLoadsInput = screen.getAllByLabelText('Loaded Haulage Loads')[0]!;
    fireEvent.change(shiftLoadsInput, { target: { value: '0' } });
    expect(shiftLoadsInput).toHaveValue(1);

    fireEvent.change(shiftLoadsInput, { target: { value: '200' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Auto-Scale from Shift/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save All Targets/i }));

    await waitFor(() => {
      expect(adminSaveOperationalTargets).toHaveBeenCalledWith(
        expect.objectContaining({
          shift: expect.objectContaining({ loadsTarget: 200 }),
          daily: expect.objectContaining({ loadsTarget: 400 }),
          monthly: expect.objectContaining({ loadsTarget: 12000 }),
        })
      );
    });

    const stored = JSON.parse(window.localStorage.getItem(OPERATIONAL_TARGETS_STORAGE_KEY) || '{}');
    expect(stored.daily.loadsTarget).toBe(400);
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('SettingsTab edits Global Portal & Shift settings, displays templates, sets default, and deletes via dialog', async () => {
    jest.mocked(getPortalSettings).mockResolvedValue({
      settings: {
        dayShiftStart: '06:00',
        nightShiftStart: '18:00',
        shiftDurationHours: 12,
        siteTimezone: 'Africa/Johannesburg',
        sessionIdleWarningMinutes: 30,
        operationalNoticeBanner: '',
        operationalNoticeActive: false,
      },
    });
    jest.mocked(savePortalSettings).mockResolvedValue({
      success: true,
      settings: {
        dayShiftStart: '06:00',
        nightShiftStart: '18:00',
        shiftDurationHours: 12,
        siteTimezone: 'Africa/Johannesburg',
        sessionIdleWarningMinutes: 45,
        operationalNoticeBanner: 'Blast notice',
        operationalNoticeActive: true,
      },
    });
    jest.mocked(listCardTemplates).mockResolvedValue({
      templates: [
        {
          id: 'tpl-1',
          name: 'Operator Standard',
          background: 'https://cdn.example/op.png',
          is_default: true,
          created_at: null,
        },
        {
          id: 'tpl-2',
          name: 'Visitor Temp',
          background: null,
          is_default: false,
          created_at: null,
        },
      ],
    });
    jest.mocked(setDefaultCardTemplate).mockResolvedValue({ success: true });
    jest.mocked(deleteCardTemplate).mockResolvedValue({ success: true });
    jest.mocked(uploadCardTemplate).mockResolvedValue({ success: true, template: null });

    render(<SettingsTab />);
    await waitFor(() => {
      expect(screen.getByText('Operator Standard')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^Operational Notice Banner$/i), {
      target: { value: 'Blast notice' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Portal Settings/i }));
    await waitFor(() => {
      expect(savePortalSettings).toHaveBeenCalledWith(
        expect.objectContaining({ operationalNoticeBanner: 'Blast notice' })
      );
    });

    expect(screen.getByText('Default')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set Default' }));
    await waitFor(() => {
      expect(setDefaultCardTemplate).toHaveBeenCalledWith('tpl-2');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Visitor Temp' }));
    expect(screen.getByText(/Remove Card Template/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Remove/i }));
    await waitFor(() => {
      expect(deleteCardTemplate).toHaveBeenCalledWith('tpl-2');
    });
  });

  it('ExternalContentTab indexes URL & GitHub without spoofing userId', async () => {
    jest.mocked(externalContentIndexing).mockResolvedValue({ success: true, indexedCount: 4 });

    render(<ExternalContentTab />);

    fireEvent.change(screen.getByPlaceholderText('https://example.com/docs/page'), {
      target: { value: 'https://docs.plantcor.example/manual' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Index URL/i }));

    await waitFor(() => {
      expect(externalContentIndexing).toHaveBeenCalledWith({
        source: 'url',
        sourceId: 'https://docs.plantcor.example/manual',
      });
    });

    fireEvent.change(screen.getByPlaceholderText('Owner (e.g. tim)'), {
      target: { value: 'Timothy191' },
    });
    fireEvent.change(screen.getByPlaceholderText('Repo name (e.g. Arch-System)'), {
      target: { value: 'Arch-System' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Index Repo/i }));
    await waitFor(() => {
      expect(externalContentIndexing).toHaveBeenCalledWith({
        source: 'github',
        owner: 'Timothy191',
        repo: 'Arch-System',
        path: '',
      });
    });

    fireEvent.change(screen.getByPlaceholderText('/path/to/docs/directory'), {
      target: { value: 'docs/control-room' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Index Docs/i }));
    await waitFor(() => {
      expect(externalContentIndexing).toHaveBeenCalledWith({
        source: 'local-docs',
        dirPath: 'docs/control-room',
      });
    });

    expect(screen.getByText(/Local \/ self-hosted runtime only/i)).toBeInTheDocument();
  });
});
