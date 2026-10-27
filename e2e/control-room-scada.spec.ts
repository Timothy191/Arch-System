import { expect, test } from '@playwright/test';
import { AUTH_FILE } from './helpers/auth';

const PAGE_LOAD_TIMEOUT_MS = 15000;

test.describe('Control Room SCADA Telemetry Panel E2E (TASK-10.8)', () => {
  test.use({ storageState: AUTH_FILE });

  test('renders SCADA telemetry panel and toggles Split, Excavators, and Machines views', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/control-room');
    await expect(page.getByRole('heading', { name: 'Control Room Dashboard' })).toBeVisible({
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Verify SCADA Dashboard sub-tab is active
    const scadaSubTab = page.getByRole('link', { name: /SCADA Dashboard/i });
    await expect(scadaSubTab).toBeVisible();
    await expect(scadaSubTab).toHaveAttribute('aria-current', 'page');

    // Verify SCADA telemetry panel and KPI strip render
    const scadaPanel = page.getByTestId('scada-excavator-machines-panel');
    await expect(scadaPanel).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT_MS });
    await expect(
      scadaPanel.getByRole('heading', { name: /Excavator Activity & Registered Fleet Loads/i })
    ).toBeVisible();

    await expect(scadaPanel.getByText('Active Excavators')).toBeVisible();
    await expect(scadaPanel.getByText('Registered Fleet')).toBeVisible();
    await expect(scadaPanel.getByText('Loaded Loads').first()).toBeVisible();
    await expect(scadaPanel.getByText('Loaded Volume')).toBeVisible();

    // Test view toggle interaction (Split View -> Excavators -> Machines -> Split View)
    const viewTablist = scadaPanel.getByRole('tablist', {
      name: /Excavator and Registered Machine views/i,
    });
    const splitViewTab = viewTablist.getByRole('tab', { name: /Split View/i });
    const excavatorsTab = viewTablist.getByRole('tab', { name: /Excavators/i });
    const machinesTab = viewTablist.getByRole('tab', { name: /Machines/i });

    await expect(splitViewTab).toHaveAttribute('aria-selected', 'true');
    await expect(scadaPanel.getByText(/Excavator Activity \(Active Dig Faces\)/i)).toBeVisible();
    await expect(scadaPanel.getByText(/Registered Machines with Loaded Loads/i)).toBeVisible();

    // Switch to Excavators-only view
    await excavatorsTab.click();
    await expect(excavatorsTab).toHaveAttribute('aria-selected', 'true');
    await expect(scadaPanel.getByText(/Excavator Activity \(Active Dig Faces\)/i)).toBeVisible();
    await expect(scadaPanel.getByText(/Registered Machines with Loaded Loads/i)).toHaveCount(0);

    // Switch to Machines-only view
    await machinesTab.click();
    await expect(machinesTab).toHaveAttribute('aria-selected', 'true');
    await expect(scadaPanel.getByText(/Registered Machines with Loaded Loads/i)).toBeVisible();
    await expect(scadaPanel.getByText(/Excavator Activity \(Active Dig Faces\)/i)).toHaveCount(0);

    // Return to Split View and trigger telemetry refresh
    await splitViewTab.click();
    await expect(splitViewTab).toHaveAttribute('aria-selected', 'true');

    const refreshButton = scadaPanel.getByRole('button', { name: /Refresh SCADA Telemetry/i });
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    expect(pageErrors).toEqual([]);
  });
});
