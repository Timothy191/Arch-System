/* cspell:ignore mttr */

import type { EngineeringReportsPayload } from './engineering-reports-model';

export interface EngineeringWhatsappSectionOptions {
  readonly includeKpis: boolean;
  readonly includeBreakdowns: boolean;
  readonly includeTireHealth: boolean;
  readonly includeMachineHours: boolean;
}

const DIVIDER = '────────────────────────────';

function buildKpiLines(payload: EngineeringReportsPayload): string[] {
  const { summary } = payload;
  return [
    '📊 *KPI OVERVIEW*',
    `• Fleet Availability: ${summary.fleetAvailabilityPct.toFixed(1)}% (${summary.activeMachinesCount} active units)`,
    `• Breakdowns: ${summary.activeBreakdowns} Active | ${summary.resolvedBreakdowns} Resolved (${summary.totalBreakdowns} total)`,
    `• Downtime / MTTR: ${summary.totalDowntimeHours.toFixed(1)}h total | ${summary.mttrHours.toFixed(1)}h MTTR`,
    `• Total Machine Hours: ${summary.totalHoursWorked.toLocaleString('en-US')}h`,
    `• Tire Fleet: ${summary.installedTires} Installed | ${summary.spareTires} Spares | ${summary.criticalTires} Critical`,
  ];
}

function buildBreakdownLines(payload: EngineeringReportsPayload): string[] {
  const activeOrRecent = payload.breakdowns.slice(0, 6);
  const rows =
    activeOrRecent.length > 0
      ? activeOrRecent.map(
          (b) =>
            `• [${b.status.toUpperCase()}] ${b.machineName} (${b.machineType}) — ${b.reason}${b.durationHours > 0 ? ` (${b.durationHours.toFixed(1)}h)` : ''}`
        )
      : ['• Zero active or logged breakdowns in this window'];

  return ['🔧 *ACTIVE & RECENT BREAKDOWNS*', ...rows];
}

function buildTireLines(payload: EngineeringReportsPayload): string[] {
  const { summary, recentTireActivities } = payload;
  const changes = recentTireActivities
    .filter(
      (a) =>
        a.activityKind === 'removal' ||
        a.activityKind === 'replacement' ||
        a.activityKind === 'installation'
    )
    .slice(0, 5);

  const eventLines =
    changes.length > 0
      ? changes.map(
          (ev) =>
            `• [${ev.activityKind.toUpperCase()}] ${ev.serialNumber} @ ${ev.machineName} (${ev.position}) — ${ev.treadDepthMm}mm / ${ev.pressurePsi} PSI`
        )
      : ['• No tire removals or replacements logged in window'];

  return [
    '🛞 *TIRE HEALTH & REMOVALS / REPLACEMENTS*',
    `• Removals: ${summary.tireRemovalsCount} | Replacements/Mounts: ${summary.tireReplacementsCount} | Critical Alerts: ${summary.criticalTires}`,
    ...eventLines,
  ];
}

function buildMachineHoursLines(payload: EngineeringReportsPayload): string[] {
  const topUnits = payload.topMachinesByHours.slice(0, 5);
  const lines =
    topUnits.length > 0
      ? topUnits.map(
          (m) =>
            `• ${m.machineName} (${m.machineType}): ${m.hoursWorked.toLocaleString('en-US')}h worked | ${m.breakdownCount} breakdowns`
        )
      : ['• No machine hours recorded in window'];

  return ['🚜 *MACHINE HOURS WORKED*', ...lines];
}

export function buildEngineeringWhatsappMessage(options: {
  readonly payload: EngineeringReportsPayload;
  readonly sections: EngineeringWhatsappSectionOptions;
}): string {
  const { payload, sections } = options;
  const blocks: string[] = [
    '⚙️ *ARCH OS — ENGINEERING SHIFT DISPATCH*',
    `📅 Window: ${payload.fromDateStr} to ${payload.toDateStr} (${payload.rangeLabel})`,
  ];

  if (sections.includeKpis) {
    blocks.push(DIVIDER, ...buildKpiLines(payload));
  }
  if (sections.includeBreakdowns) {
    blocks.push(DIVIDER, ...buildBreakdownLines(payload));
  }
  if (sections.includeTireHealth) {
    blocks.push(DIVIDER, ...buildTireLines(payload));
  }
  if (sections.includeMachineHours) {
    blocks.push(DIVIDER, ...buildMachineHoursLines(payload));
  }

  blocks.push(DIVIDER, '✅ Verified via Arch OS Engineering Telemetry');
  return blocks.join('\n');
}
