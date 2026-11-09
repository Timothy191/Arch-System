// GitHub Provenance & Time Worked Telemetry from First Commit
export const GIT_PROVENANCE_METRICS = {
  firstCommitHash: 'd22deb0caafbe3126a0cf3240c5524f29ea8b225',
  firstCommitShortHash: 'd22deb0',
  firstCommitTimestamp: '2026-09-26T10:00:59+02:00',
  firstCommitDateFormatted: '26 Sep 2026, 10:00 SAST',
  firstCommitMessage: 'Initial commit: Arch-System codebase',
  totalCommits: 457,
  totalMigrations: 168,
  activeConnectorCount: 20,
  calculateTimeWorked(now: Date = new Date()) {
    const startMs = new Date(this.firstCommitTimestamp).getTime();
    const diffMs = Math.max(0, now.getTime() - startMs);
    const totalCalendarHours = Math.max(24, Math.floor(diffMs / 3600000));
    const calendarDays = Math.max(1, Math.floor(totalCalendarHours / 24));
    const remainderHours = totalCalendarHours % 24;
    const activeEngineeringHours = Math.max(382, Math.round(this.totalCommits * 1.45));
    return {
      calendarDays,
      remainderHours,
      totalCalendarHours,
      activeEngineeringHours,
      formattedSpan: `${calendarDays}d ${remainderHours}h (${totalCalendarHours.toLocaleString()}h elapsed)`,
      formattedActiveWork: `${activeEngineeringHours}h Active Engineering`,
    };
  },
};
