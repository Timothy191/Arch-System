import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type {
  CombinedDelayGroupSummary,
  ProductionDailyPerformanceRow,
  ProductionMonthlyPerformanceRow,
  ProductionPdfScope,
  ProductionPerformanceData,
} from './production-types';

export interface ProductionForemanPdfDocumentProps {
  performance: ProductionPerformanceData;
  scope?: ProductionPdfScope;
}

const INK = '#0f172a';
const MUTED = '#64748b';
const RULE = '#cbd5e1';
const HAIRLINE = '#e2e8f0';
const PANEL = '#f8fafc';
const BRAND = '#b8941f';
const ACCENT = '#1d4ed8';
const POSITIVE = '#15803d';
const WARN = '#b45309';

const SCOPE_LABELS: Record<ProductionPdfScope, string> = {
  full: 'Full Foreman, Daily & Monthly Report',
  'foreman-delays': 'Foreman Summary & Combined Delays',
  'daily-monthly': 'Daily & Monthly Production vs Delays',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 36,
    paddingHorizontal: 26,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: INK,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brandLabel: { fontSize: 7, fontWeight: 'bold', color: BRAND, letterSpacing: 0.8 },
  title: { fontSize: 15, fontWeight: 'bold', color: INK, marginTop: 2 },
  subtitle: { fontSize: 7.5, color: MUTED, marginTop: 1.5 },
  metaBlock: { textAlign: 'right', fontSize: 7, color: '#334155' },
  kpiRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  kpiBox: {
    flex: 1,
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  kpiLabel: { fontSize: 6, color: MUTED, fontWeight: 'bold', textTransform: 'uppercase' },
  kpiValue: { fontSize: 10.5, fontWeight: 'bold', color: INK, marginTop: 1.5 },
  kpiHint: { fontSize: 6, color: MUTED, marginTop: 1 },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: INK,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 2,
    marginBottom: 4,
  },
  summaryBox: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 3,
    padding: 6,
    marginBottom: 8,
  },
  summaryLine: { fontSize: 7.2, color: '#1e293b', marginBottom: 2 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingVertical: 2.5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tableRowMuted: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
    backgroundColor: '#fafafa',
    paddingVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  thText: { fontSize: 6.2, fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' },
  cellText: { fontSize: 6.8, color: '#1e293b' },
  cellMuted: { fontSize: 6.8, color: MUTED },
  cellStrong: { fontSize: 6.8, fontWeight: 'bold', color: INK },
  colWide: { width: '28%', paddingRight: 4 },
  colDate: { width: '14%', paddingRight: 4 },
  colNum: { width: '12%', textAlign: 'right', paddingRight: 4 },
  colSmallNum: { width: '10%', textAlign: 'right', paddingRight: 4 },
  signOffRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  signOffBox: { flex: 1, borderTopWidth: 1, borderTopColor: INK, paddingTop: 3 },
  signOffLabel: { fontSize: 6.5, color: MUTED, textTransform: 'uppercase' },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 26,
    right: 26,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 6.5, color: MUTED },
});

function PdfKpiCard({ label, metric, hint }: { label: string; metric: string; hint: string }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{metric}</Text>
      <Text style={styles.kpiHint}>{hint}</Text>
    </View>
  );
}

function DelayBreakdownTable({
  delayGroups,
}: {
  delayGroups: readonly CombinedDelayGroupSummary[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Production vs Combined Delays Breakdown</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colWide]}>Delay Group</Text>
        <Text style={[styles.thText, styles.colNum]}>Delay Hours</Text>
        <Text style={[styles.thText, styles.colNum]}>Delay Minutes</Text>
        <Text style={[styles.thText, styles.colNum]}>Share %</Text>
        <Text style={[styles.thText, styles.colNum]}>Events</Text>
        <Text style={[styles.thText, styles.colNum]}>Est. Pit BCM Impact</Text>
      </View>
      {delayGroups.map((group) => (
        <View key={group.key} style={styles.tableRow} wrap={false}>
          <Text style={[styles.cellStrong, styles.colWide]}>{group.label}</Text>
          <Text style={[styles.cellText, styles.colNum]}>{group.delayHours.toFixed(1)} h</Text>
          <Text style={[styles.cellText, styles.colNum]}>{group.delayMinutes}</Text>
          <Text style={[styles.cellText, styles.colNum]}>{group.sharePct.toFixed(1)}%</Text>
          <Text style={[styles.cellText, styles.colNum]}>{group.eventCount}</Text>
          <Text style={[styles.cellText, styles.colNum, { color: WARN }]}>
            {group.estimatedPitBcmImpact.toLocaleString('en-US')} BCM
          </Text>
        </View>
      ))}
    </View>
  );
}

function DailyLedgerTable({ dailyRows }: { dailyRows: readonly ProductionDailyPerformanceRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Daily Production vs Combined Delays Ledger</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colDate]}>Date</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Pit BCM</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Loads</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Rollover</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Coal (t)</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Waste (t)</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Delays (h)</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Variance</Text>
      </View>
      {dailyRows.map((row) => (
        <View
          key={row.date}
          style={row.hasData ? styles.tableRow : styles.tableRowMuted}
          wrap={false}
        >
          <Text style={[row.hasData ? styles.cellStrong : styles.cellMuted, styles.colDate]}>
            {row.date}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.hasData ? row.pitBcm.toLocaleString('en-US') : '—'}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.hasData ? row.haulLoads.toLocaleString('en-US') : '—'}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.hasData ? row.rolloverBcm.toLocaleString('en-US') : '—'}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.hasData ? row.coalTonnes.toLocaleString('en-US') : '—'}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.hasData ? row.wasteTonnes.toLocaleString('en-US') : '—'}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.hasData ? row.combinedDelayHours.toFixed(1) : '—'}
          </Text>
          <Text
            style={[
              styles.cellText,
              styles.colSmallNum,
              { color: !row.hasData ? MUTED : row.pitBcmVariance >= 0 ? POSITIVE : WARN },
            ]}
          >
            {row.hasData
              ? `${row.pitBcmVariance >= 0 ? '+' : ''}${row.pitBcmVariance.toLocaleString('en-US')}`
              : 'No data'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MonthlySummaryTable({
  monthlyRows,
}: {
  monthlyRows: readonly ProductionMonthlyPerformanceRow[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Monthly Production vs Delays Summary</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colWide]}>Month</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Pit BCM</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Attain %</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Coal (t)</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Waste (t)</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Loads</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Rollover</Text>
        <Text style={[styles.thText, styles.colSmallNum]}>Delays (h)</Text>
      </View>
      {monthlyRows.map((row) => (
        <View key={row.month} style={styles.tableRow} wrap={false}>
          <Text style={[styles.cellStrong, styles.colWide]}>{row.monthLabel}</Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.pitBcm.toLocaleString('en-US')}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum, { color: ACCENT }]}>
            {row.pitBcmAttainmentPct}%
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.coalTonnes.toLocaleString('en-US')}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.wasteTonnes.toLocaleString('en-US')}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.haulLoads.toLocaleString('en-US')}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum]}>
            {row.rolloverBcm.toLocaleString('en-US')}
          </Text>
          <Text style={[styles.cellText, styles.colSmallNum, { color: WARN }]}>
            {row.combinedDelayHours.toFixed(1)}h
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ProductionForemanPdfDocument({
  performance,
  scope = 'full',
}: ProductionForemanPdfDocumentProps) {
  const { foremanSummary, delayGroups, dailyRows, monthlyRows } = performance;
  const showForemanAndDelays = scope === 'full' || scope === 'foreman-delays';
  const showDailyAndMonthly = scope === 'full' || scope === 'daily-monthly';

  return (
    <Document
      title={`Production Foreman & Combined Delays Report — ${performance.monthLabel}`}
      author="Arch OS"
    >
      <Page size="A4" orientation="portrait" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandLabel}>ARCH OS · PRODUCTION DEPARTMENT EXECUTIVE REPORT</Text>
            <Text style={styles.title}>Foreman Production vs Combined Delays Report</Text>
            <Text style={styles.subtitle}>
              Pit BCM Moved, ROM Coal, Overburden Waste, Rollover &amp; Delay Impact —{' '}
              {performance.monthLabel}
            </Text>
          </View>
          <View style={styles.metaBlock}>
            <Text>Report Month: {performance.selectedMonth}</Text>
            <Text>Document ID: PRD-FRM-{performance.selectedMonth}</Text>
            <Text>Scope: {SCOPE_LABELS[scope]}</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <PdfKpiCard
            label="Pit BCM Moved"
            metric={`${foremanSummary.totalPitBcm.toLocaleString('en-US')} BCM`}
            hint={`Target: ${foremanSummary.pitBcmTarget.toLocaleString('en-US')} (${foremanSummary.pitBcmAttainmentPct}%)`}
          />
          <PdfKpiCard
            label="ROM Coal / Waste"
            metric={`${foremanSummary.totalCoalTonnes.toLocaleString('en-US')} t`}
            hint={`Waste: ${foremanSummary.totalWasteTonnes.toLocaleString('en-US')} t`}
          />
          <PdfKpiCard
            label="Haul Loads"
            metric={foremanSummary.totalHaulLoads.toLocaleString('en-US')}
            hint={`Rollover: ${foremanSummary.totalRolloverBcm.toLocaleString('en-US')} BCM`}
          />
          <PdfKpiCard
            label="Combined Delays"
            metric={`${foremanSummary.totalCombinedDelayHours.toFixed(1)} hrs`}
            hint={`Efficiency: ${foremanSummary.productiveEfficiencyPct}%`}
          />
        </View>

        {showForemanAndDelays && (
          <>
            <View style={styles.summaryBox}>
              <Text style={styles.sectionTitle}>Foreman Executive Production Summary</Text>
              <Text style={styles.summaryLine}>{foremanSummary.supervisorSummary}</Text>
              <Text style={styles.summaryLine}>{foremanSummary.pitBenchProgress}</Text>
              {foremanSummary.keyVariances.map((line) => (
                <Text key={line} style={styles.summaryLine}>
                  • {line}
                </Text>
              ))}
            </View>
            <DelayBreakdownTable delayGroups={delayGroups} />
          </>
        )}

        {showDailyAndMonthly && (
          <>
            <DailyLedgerTable dailyRows={dailyRows} />
            <MonthlySummaryTable monthlyRows={monthlyRows} />
          </>
        )}

        <View style={styles.signOffRow} wrap={false}>
          {['Production Foreman', 'Mine Overseer', 'Approval Date'].map((role) => (
            <View key={role} style={styles.signOffBox}>
              <Text style={styles.signOffLabel}>{role}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Plantcor / Arch OS · Production Foreman &amp; Combined Delays Report
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
