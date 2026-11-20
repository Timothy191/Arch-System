/* cspell:ignore mttr */

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { EngineeringReportsPayload } from './engineering-reports-model';

const styles = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 22,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#d4af37',
    paddingBottom: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brandLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2,
  },
  headerRight: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#334155',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 6,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  kpiLabel: {
    fontSize: 6.5,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  kpiValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
  },
  section: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectionBanner: {
    backgroundColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  sectionMeta: {
    fontSize: 7,
    color: '#cbd5e1',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  cell: {
    fontSize: 7.2,
    color: '#0f172a',
    paddingRight: 4,
  },
  colWide: { width: '24%' },
  colMed: { width: '16%' },
  colNarrow: { width: '12%' },
  colReason: { width: '32%' },
  emptyRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 7.5,
    color: '#64748b',
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 22,
    right: 22,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#64748b',
  },
});

export interface EngineeringPdfDocumentProps {
  readonly payload: EngineeringReportsPayload;
}

export function EngineeringPdfDocument({ payload }: EngineeringPdfDocumentProps) {
  const { summary } = payload;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandLabel}>ARCH OS · PLANTCOR ENGINEERING</Text>
            <Text style={styles.title}>Engineering Executive &amp; Fleet Report</Text>
            <Text style={styles.subtitle}>
              Department: {payload.departmentName} · Window: {payload.fromDateStr} to{' '}
              {payload.toDateStr} ({payload.rangeLabel})
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text>Report Date: {payload.todayStr}</Text>
            <Text>REF: ARCH-ENG-{payload.todayStr.replace(/-/g, '')}</Text>
            <Text>Fleet Units: {summary.activeMachinesCount} Active</Text>
          </View>
        </View>

        {/* Executive KPIs */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Fleet Availability</Text>
            <Text style={styles.kpiValue}>{summary.fleetAvailabilityPct.toFixed(1)}%</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Active / Resolved Breakdowns</Text>
            <Text style={styles.kpiValue}>
              {summary.activeBreakdowns} / {summary.resolvedBreakdowns}
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Downtime / MTTR</Text>
            <Text style={styles.kpiValue}>
              {summary.totalDowntimeHours.toFixed(1)}h / {summary.mttrHours.toFixed(1)}h
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Machine Hours Worked</Text>
            <Text style={styles.kpiValue}>{summary.totalHoursWorked.toLocaleString('en-US')}h</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Tire Fleet (Installed / Crit)</Text>
            <Text style={styles.kpiValue}>
              {summary.installedTires} / {summary.criticalTires} Crit
            </Text>
          </View>
        </View>

        {/* Breakdowns Table */}
        <View style={styles.section}>
          <View style={styles.sectionBanner}>
            <Text style={styles.sectionTitle}>Active &amp; Resolved Breakdowns</Text>
            <Text style={styles.sectionMeta}>{payload.breakdowns.length} Records</Text>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.colMed]}>Machine / Fleet</Text>
            <Text style={[styles.headerCell, styles.colMed]}>Type</Text>
            <Text style={[styles.headerCell, styles.colReason]}>Fault / Reason</Text>
            <Text style={[styles.headerCell, styles.colNarrow]}>Status</Text>
            <Text style={[styles.headerCell, styles.colMed]}>Logged Date</Text>
            <Text style={[styles.headerCell, styles.colNarrow]}>Downtime</Text>
          </View>
          {payload.breakdowns.length === 0 ? (
            <Text style={styles.emptyRow}>No breakdowns logged in selected window.</Text>
          ) : (
            payload.breakdowns.slice(0, 10).map((bd) => (
              <View key={bd.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colMed]}>{bd.machineName}</Text>
                <Text style={[styles.cell, styles.colMed]}>{bd.machineType}</Text>
                <Text style={[styles.cell, styles.colReason]}>{bd.reason}</Text>
                <Text style={[styles.cell, styles.colNarrow]}>{bd.status.toUpperCase()}</Text>
                <Text style={[styles.cell, styles.colMed]}>{bd.dateIn}</Text>
                <Text style={[styles.cell, styles.colNarrow]}>
                  {bd.durationHours > 0 ? `${bd.durationHours.toFixed(1)}h` : 'Ongoing'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Tire Health & Replacement Summary */}
        <View style={styles.section}>
          <View style={styles.sectionBanner}>
            <Text style={styles.sectionTitle}>Tire Health &amp; Replacement Activity</Text>
            <Text style={styles.sectionMeta}>
              Removals: {summary.tireRemovalsCount} · Replacements: {summary.tireReplacementsCount}
            </Text>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.colMed]}>Serial</Text>
            <Text style={[styles.headerCell, styles.colMed]}>Machine / Position</Text>
            <Text style={[styles.headerCell, styles.colNarrow]}>Activity</Text>
            <Text style={[styles.headerCell, styles.colNarrow]}>Tread / PSI</Text>
            <Text style={[styles.headerCell, styles.colNarrow]}>Condition</Text>
            <Text style={[styles.headerCell, styles.colReason]}>Notes</Text>
          </View>
          {payload.recentTireActivities.length === 0 ? (
            <Text style={styles.emptyRow}>No tire activities logged in selected window.</Text>
          ) : (
            payload.recentTireActivities.slice(0, 8).map((act) => (
              <View key={act.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colMed]}>{act.serialNumber}</Text>
                <Text style={[styles.cell, styles.colMed]}>
                  {act.machineName} ({act.position})
                </Text>
                <Text style={[styles.cell, styles.colNarrow]}>
                  {act.activityKind.toUpperCase()}
                </Text>
                <Text style={[styles.cell, styles.colNarrow]}>
                  {act.treadDepthMm}mm / {act.pressurePsi}
                </Text>
                <Text style={[styles.cell, styles.colNarrow]}>
                  {act.conditionStatus.toUpperCase()}
                </Text>
                <Text style={[styles.cell, styles.colReason]}>{act.notes || '—'}</Text>
              </View>
            ))
          )}
        </View>

        {/* Machine Hours Summary */}
        <View style={styles.section}>
          <View style={styles.sectionBanner}>
            <Text style={styles.sectionTitle}>Top Machine Hours &amp; Reliability</Text>
            <Text style={styles.sectionMeta}>{payload.topMachinesByHours.length} Units</Text>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.colWide]}>Machine</Text>
            <Text style={[styles.headerCell, styles.colWide]}>Type</Text>
            <Text style={[styles.headerCell, styles.colMed]}>Hours Worked</Text>
            <Text style={[styles.headerCell, styles.colMed]}>Breakdowns</Text>
            <Text style={[styles.headerCell, styles.colMed]}>Downtime</Text>
          </View>
          {payload.topMachinesByHours.length === 0 ? (
            <Text style={styles.emptyRow}>No machine hours recorded in selected window.</Text>
          ) : (
            payload.topMachinesByHours.slice(0, 6).map((m) => (
              <View key={m.machineId} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colWide]}>{m.machineName}</Text>
                <Text style={[styles.cell, styles.colWide]}>{m.machineType}</Text>
                <Text style={[styles.cell, styles.colMed]}>{m.hoursWorked.toFixed(1)}h</Text>
                <Text style={[styles.cell, styles.colMed]}>{m.breakdownCount}</Text>
                <Text style={[styles.cell, styles.colMed]}>{m.downtimeHours.toFixed(1)}h</Text>
              </View>
            ))
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Arch-Systems · Plantcor Engineering Document Control (ISO 9001:2015)</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
