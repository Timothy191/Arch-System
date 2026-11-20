import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type {
  CategoryHealthSummary,
  EnrichedPlantStockItem,
  EquipmentAnalyticsSummary,
  PlantHealthTone,
  PlantInventoryAnalytics,
  PlantInventoryPdfExportOptions,
} from './plant-inventory-analytics';
import { formatQty, type PlantInventoryUsageEntry } from './plant-inventory-seeds';
import type { PlantStockStatusFlag } from './stock-flags';

/** Maximum number of shift consumption entries rendered in the PDF log. */
export const MAX_PDF_CONSUMPTION_ROWS = 12;

const INK = '#0f172a';
const MUTED = '#64748b';
const RULE = '#cbd5e1';
const HAIRLINE = '#e2e8f0';
const PANEL = '#f8fafc';
const BRAND = '#b8941f';
const ALERT = '#d22118';
const HEALTHY = '#15803d';
const WATCH = '#b45309';

const STATUS_COLOR: Record<PlantStockStatusFlag, string> = {
  OUT_OF_STOCK: ALERT,
  CRITICAL: ALERT,
  REPLENISH: WATCH,
  NOMINAL: HEALTHY,
  SURPLUS: BRAND,
};

const TONE_COLOR: Record<PlantHealthTone, string> = {
  healthy: HEALTHY,
  watch: WATCH,
  critical: ALERT,
};

const TONE_LABEL: Record<PlantHealthTone, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
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
  kpiValue: { fontSize: 11, fontWeight: 'bold', color: INK, marginTop: 1.5 },
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
    marginBottom: 3,
  },
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
  thText: { fontSize: 6.3, fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' },
  cellText: { fontSize: 7, color: '#1e293b' },
  cellStrong: { fontSize: 7, fontWeight: 'bold', color: INK },
  cellSub: { fontSize: 6, color: MUTED },
  emptyState: { fontSize: 7, color: HEALTHY, paddingVertical: 4, paddingHorizontal: 4 },
  colWide: { width: '30%', paddingRight: 4 },
  colMid: { width: '18%', paddingRight: 4 },
  colNarrow: { width: '10%', textAlign: 'right', paddingRight: 4 },
  colStatus: { width: '14%', paddingLeft: 4 },
  signOffRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
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

function PdfSectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function PdfHeader({ today, scopeLabel, filterLabel }: PlantInventoryPdfExportOptions) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brandLabel}>ARCH OS · PLANT INVENTORY &amp; STOCK CONTROL</Text>
        <Text style={styles.title}>Plant Inventory Executive Report</Text>
        <Text style={styles.subtitle}>
          Stock balance, par compliance and replenishment demand for plant processing circuits
        </Text>
      </View>
      <View style={styles.metaBlock}>
        <Text>Operational Date: {today}</Text>
        <Text>Document ID: PI-RPT-{today}</Text>
        <Text>Scope: {scopeLabel}</Text>
        <Text>Filters: {filterLabel}</Text>
      </View>
    </View>
  );
}

function PdfKpiBox({ label, metric, hint }: { label: string; metric: string; hint: string }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{metric}</Text>
      <Text style={styles.kpiHint}>{hint}</Text>
    </View>
  );
}

function PdfKpiStrip({ analytics }: { analytics: PlantInventoryAnalytics }) {
  return (
    <View style={styles.kpiRow}>
      <PdfKpiBox
        label="Total Stock Lines"
        metric={String(analytics.totalLines)}
        hint={`${analytics.nominalCount} at or above par`}
      />
      <PdfKpiBox
        label="Par Compliance"
        metric={`${analytics.parCompliancePct}%`}
        hint={`${analytics.surplusCount} surplus lines`}
      />
      <PdfKpiBox
        label="Avg Coverage"
        metric={`${analytics.avgCoveragePct}%`}
        hint="Capped at 100% per line"
      />
      <PdfKpiBox
        label="Replenishment Alerts"
        metric={String(analytics.belowParCount)}
        hint={`${analytics.criticalOrOosCount} critical / out of stock`}
      />
      <PdfKpiBox
        label="Equipment Tracked"
        metric={String(analytics.trackedEquipmentCount)}
        hint={`${analytics.equipmentAtRiskCount} at risk`}
      />
    </View>
  );
}

function CategoryHealthRow({ summary }: { summary: CategoryHealthSummary }) {
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cellStrong, styles.colWide]}>{summary.category}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.totalLines}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.nominalLines}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.belowParLines}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.criticalLines}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.avgCoveragePct}%</Text>
      <Text
        style={[styles.cellStrong, styles.colStatus, { color: TONE_COLOR[summary.healthTone] }]}
      >
        {TONE_LABEL[summary.healthTone]}
      </Text>
    </View>
  );
}

function PdfCategoryHealth({ summaries }: { summaries: readonly CategoryHealthSummary[] }) {
  return (
    <View style={styles.section}>
      <PdfSectionTitle>Stock Health by Category</PdfSectionTitle>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colWide]}>Category</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Lines</Text>
        <Text style={[styles.thText, styles.colNarrow]}>At Par</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Below Par</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Critical</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Coverage</Text>
        <Text style={[styles.thText, styles.colStatus]}>Health</Text>
      </View>
      {summaries.map((summary) => (
        <CategoryHealthRow key={summary.category} summary={summary} />
      ))}
    </View>
  );
}

function StockLineRow({ stockLine }: { stockLine: EnrichedPlantStockItem }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <View style={styles.colWide}>
        <Text style={styles.cellStrong}>{stockLine.stock}</Text>
        <Text style={styles.cellSub}>{stockLine.code}</Text>
      </View>
      <Text style={[styles.cellText, styles.colMid]}>{stockLine.plantEquipment}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{formatQty(stockLine.amountRequired)}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{formatQty(stockLine.amountPresent)}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>
        {formatQty(stockLine.flags.shortfallAmount)} {stockLine.unit}
      </Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{stockLine.flags.coveragePct}%</Text>
      <Text
        style={[
          styles.cellStrong,
          styles.colStatus,
          { color: STATUS_COLOR[stockLine.flags.stockStatus] },
        ]}
      >
        {stockLine.flags.statusLabel}
      </Text>
    </View>
  );
}

function StockTableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.thText, styles.colWide]}>Stock / Code</Text>
      <Text style={[styles.thText, styles.colMid]}>Plant Equipment</Text>
      <Text style={[styles.thText, styles.colNarrow]}>Required</Text>
      <Text style={[styles.thText, styles.colNarrow]}>Present</Text>
      <Text style={[styles.thText, styles.colNarrow]}>Shortfall</Text>
      <Text style={[styles.thText, styles.colNarrow]}>Coverage</Text>
      <Text style={[styles.thText, styles.colStatus]}>Status</Text>
    </View>
  );
}

function PdfStockTable({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: readonly EnrichedPlantStockItem[];
  emptyText: string;
}) {
  return (
    <View style={styles.section}>
      <PdfSectionTitle>{title}</PdfSectionTitle>
      <StockTableHeader />
      {items.length === 0 ? <Text style={styles.emptyState}>{emptyText}</Text> : null}
      {items.map((stockLine) => (
        <StockLineRow key={stockLine.id} stockLine={stockLine} />
      ))}
    </View>
  );
}

function EquipmentRow({ summary }: { summary: EquipmentAnalyticsSummary }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cellStrong, styles.colWide]}>{summary.equipment}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.stockLines}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.belowParCount}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.avgCoveragePct}%</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{summary.usageCount}</Text>
      <Text style={[styles.cellText, styles.colMid]}>{formatQty(summary.totalDrawdown)}</Text>
    </View>
  );
}

function PdfEquipmentDrawdown({ summaries }: { summaries: readonly EquipmentAnalyticsSummary[] }) {
  return (
    <View style={styles.section}>
      <PdfSectionTitle>Equipment Drawdown</PdfSectionTitle>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colWide]}>Plant Equipment</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Lines</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Below Par</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Coverage</Text>
        <Text style={[styles.thText, styles.colNarrow]}>Draws</Text>
        <Text style={[styles.thText, styles.colMid]}>Total Drawdown</Text>
      </View>
      {summaries.map((summary) => (
        <EquipmentRow key={summary.equipment} summary={summary} />
      ))}
    </View>
  );
}

function ConsumptionRow({ entry }: { entry: PlantInventoryUsageEntry }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cellText, styles.colNarrow, { textAlign: 'left' }]}>{entry.date}</Text>
      <Text style={[styles.cellText, styles.colNarrow, { textAlign: 'left' }]}>{entry.shift}</Text>
      <View style={styles.colWide}>
        <Text style={styles.cellStrong}>{entry.stock}</Text>
        <Text style={styles.cellSub}>{entry.circuitArea}</Text>
      </View>
      <Text style={[styles.cellText, styles.colMid]}>
        {formatQty(entry.amountUsed)} {entry.unit}
      </Text>
      <Text style={[styles.cellText, styles.colMid]}>{entry.loggedBy}</Text>
    </View>
  );
}

function PdfConsumptionLog({
  usageHistory,
}: {
  usageHistory: readonly PlantInventoryUsageEntry[];
}) {
  const visibleEntries = usageHistory.slice(0, MAX_PDF_CONSUMPTION_ROWS);
  return (
    <View style={styles.section}>
      <PdfSectionTitle>Recent Shift Consumption</PdfSectionTitle>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colNarrow, { textAlign: 'left' }]}>Date</Text>
        <Text style={[styles.thText, styles.colNarrow, { textAlign: 'left' }]}>Shift</Text>
        <Text style={[styles.thText, styles.colWide]}>Stock / Circuit</Text>
        <Text style={[styles.thText, styles.colMid]}>Amount Used</Text>
        <Text style={[styles.thText, styles.colMid]}>Logged By</Text>
      </View>
      {visibleEntries.length === 0 ? (
        <Text style={styles.emptyState}>No consumption logged for the selected scope.</Text>
      ) : null}
      {visibleEntries.map((entry) => (
        <ConsumptionRow key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

function PdfSignOff() {
  return (
    <View style={styles.signOffRow} wrap={false}>
      {['Stock Controller', 'Plant Superintendent', 'Approval Date'].map((role) => (
        <View key={role} style={styles.signOffBox}>
          <Text style={styles.signOffLabel}>{role}</Text>
        </View>
      ))}
    </View>
  );
}

function PdfFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Plantcor / Arch OS · Confidential Operational Report</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

export function PlantInventoryPdfDocument(props: PlantInventoryPdfExportOptions) {
  const { analytics, usageHistory } = props;
  return (
    <Document title={`Plant Inventory Executive Report — ${props.today}`} author="Arch OS">
      <Page size="A4" orientation="portrait" style={styles.page}>
        <PdfHeader {...props} />
        <PdfKpiStrip analytics={analytics} />
        <PdfCategoryHealth summaries={analytics.categorySummaries} />
        <PdfStockTable
          title="Prioritized Replenishment Demand"
          items={analytics.prioritizedReplenishment}
          emptyText="All stock lines are at or above par — no replenishment demand."
        />
        <PdfStockTable
          title="Complete Stock Balance Register"
          items={analytics.enrichedItems}
          emptyText="No stock lines match the selected filters."
        />
        <PdfEquipmentDrawdown summaries={analytics.equipmentSummaries} />
        <PdfConsumptionLog usageHistory={usageHistory} />
        <PdfSignOff />
        <PdfFooter />
      </Page>
    </Document>
  );
}
