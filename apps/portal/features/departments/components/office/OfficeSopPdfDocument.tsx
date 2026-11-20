import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type {
  OfficeDocumentRecord,
  OfficeSopBreakdownSummary,
  OfficeSopLiveReportData,
  OfficeSopProtocolStep,
} from './actions';

const INK = '#0f172a';
const MUTED = '#64748b';
const RULE = '#cbd5e1';
const HAIRLINE = '#e2e8f0';
const PANEL = '#f8fafc';
const BRAND = '#b8941f';
const ALERT = '#d22118';
const HEALTHY = '#15803d';
const ACCENT = '#0284c7';

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
  title: { fontSize: 14, fontWeight: 'bold', color: INK, marginTop: 2 },
  subtitle: { fontSize: 7.5, color: MUTED, marginTop: 2, maxWidth: 330 },
  metaBlock: { textAlign: 'right', fontSize: 7, color: '#334155' },
  syncBanner: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncLabel: { fontSize: 7, fontWeight: 'bold', color: ACCENT },
  syncMeta: { fontSize: 6.5, color: MUTED },
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
    paddingVertical: 2.5,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  thText: { fontSize: 6.3, fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' },
  cellText: { fontSize: 7, color: '#1e293b' },
  cellStrong: { fontSize: 7, fontWeight: 'bold', color: INK },
  cellSub: { fontSize: 6, color: MUTED },
  emptyState: { fontSize: 7, color: HEALTHY, paddingVertical: 4, paddingHorizontal: 4 },
  colStep: { width: '8%', paddingRight: 4 },
  colStage: { width: '24%', paddingRight: 4 },
  colWide: { width: '48%', paddingRight: 4 },
  colOwner: { width: '20%', paddingLeft: 4 },
  colFleet: { width: '24%', paddingRight: 4 },
  colReason: { width: '40%', paddingRight: 4 },
  colNarrow: { width: '12%', paddingRight: 4 },
  colStatus: { width: '12%', paddingLeft: 4 },
  noteBox: {
    backgroundColor: PANEL,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 3,
    padding: 6,
    marginBottom: 8,
  },
  signOffRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
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

function PdfKpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiHint}>{hint}</Text>
    </View>
  );
}

function BreakdownRow({ entry }: { entry: OfficeSopBreakdownSummary }) {
  const isClosed = ['resolved', 'closed', 'completed'].includes(entry.status.toLowerCase());
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cellStrong, styles.colFleet]}>{entry.fleetLabel}</Text>
      <Text style={[styles.cellText, styles.colReason]}>{entry.reason}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{entry.delayHours}h</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{entry.dateIn}</Text>
      <Text style={[styles.cellStrong, styles.colStatus, { color: isClosed ? HEALTHY : ALERT }]}>
        {entry.status.toUpperCase()}
      </Text>
    </View>
  );
}

function ProtocolRow({ step }: { step: OfficeSopProtocolStep }) {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cellStrong, styles.colStep]}>{step.stepNumber}</Text>
      <Text style={[styles.cellStrong, styles.colStage]}>{step.stage}</Text>
      <Text style={[styles.cellText, styles.colWide]}>{step.requirement}</Text>
      <Text style={[styles.cellText, styles.colOwner]}>{step.escalationOwner}</Text>
    </View>
  );
}

function DossierRow({ doc }: { doc: OfficeDocumentRecord }) {
  const formattedUpdated = new Date(doc.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <View style={styles.tableRow} wrap={false}>
      <View style={styles.colWide}>
        <Text style={styles.cellStrong}>{doc.title}</Text>
        <Text style={styles.cellSub}>{doc.summary}</Text>
      </View>
      <Text style={[styles.cellText, styles.colStage]}>{doc.authorRole}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{doc.docType.toUpperCase()}</Text>
      <Text style={[styles.cellText, styles.colNarrow]}>{formattedUpdated}</Text>
    </View>
  );
}

export function OfficeSopPdfDocument({ reportData }: { reportData: OfficeSopLiveReportData }) {
  const sourceBadge =
    reportData.dataSourceStatus === 'live_supabase'
      ? 'LIVE SUPABASE SYNC VERIFIED'
      : 'OPERATIONAL TEMPLATE BASELINE';

  return (
    <Document
      title={`${reportData.documentTitle} — ${reportData.operationalDate}`}
      author="Arch OS Office Suite"
    >
      <Page size="A4" orientation="portrait" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandLabel}>ARCH OS · EXECUTIVE OFFICE &amp; SAFETY SOP</Text>
            <Text style={styles.title}>{reportData.documentTitle}</Text>
            <Text style={styles.subtitle}>{reportData.documentSummary}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text>Operational Date: {reportData.operationalDate}</Text>
            <Text>Generated (UTC): {reportData.generatedAtFormatted}</Text>
            <Text>Owner: {reportData.authorRole}</Text>
            <Text>Document ID: {reportData.documentId}</Text>
          </View>
        </View>

        {/* Live Data Sync Status Strip */}
        <View style={styles.syncBanner}>
          <Text style={styles.syncLabel}>{sourceBadge}</Text>
          <Text style={styles.syncMeta}>Latest Gate Event: {reportData.latestGateEvent}</Text>
        </View>

        {/* Live KPI Summary */}
        <View style={styles.kpiRow}>
          <PdfKpiCard
            label="Active Breakdowns"
            value={String(reportData.activeBreakdownsCount)}
            hint={`${reportData.recent24hBreakdownsCount} logged in 24h`}
          />
          <PdfKpiCard
            label="Fleet Tires"
            value={String(reportData.installedTiresCount)}
            hint={`${reportData.criticalTiresCount} critical alerts`}
          />
          <PdfKpiCard
            label="Site Visitors"
            value={String(reportData.checkedInVisitorsCount)}
            hint={`${reportData.recentAccessScansCount} gate scans`}
          />
          <PdfKpiCard
            label="Shift Daily Logs"
            value={String(reportData.recentDailyLogsCount)}
            hint="Latest cycle count"
          />
          <PdfKpiCard
            label="Office Dossier"
            value={String(reportData.officeDocuments.length)}
            hint="Synced artifacts"
          />
        </View>

        {/* Latest Shift Handover Note */}
        <View style={styles.noteBox}>
          <Text style={styles.kpiLabel}>Latest Shift Daily Log Handover Note</Text>
          <Text style={[styles.cellText, { marginTop: 2 }]}>{reportData.latestShiftNote}</Text>
        </View>

        {/* Active Breakdowns & Engineering Escalation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Engineering Breakdowns &amp; Escalations</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colFleet]}>Fleet Unit</Text>
            <Text style={[styles.thText, styles.colReason]}>Incident Reason</Text>
            <Text style={[styles.thText, styles.colNarrow]}>Delay</Text>
            <Text style={[styles.thText, styles.colNarrow]}>Date In</Text>
            <Text style={[styles.thText, styles.colStatus]}>Status</Text>
          </View>
          {reportData.recentBreakdowns.length === 0 ? (
            <Text style={styles.emptyState}>
              No breakdown incidents recorded in current sync window — fleet availability nominal.
            </Text>
          ) : (
            reportData.recentBreakdowns.map((entry) => (
              <BreakdownRow key={entry.id} entry={entry} />
            ))
          )}
        </View>

        {/* Statutory Shift Handover SOP Checklist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Mandatory Shift Handover &amp; Safety Escalation Procedure
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colStep]}>Step</Text>
            <Text style={[styles.thText, styles.colStage]}>Control Stage</Text>
            <Text style={[styles.thText, styles.colWide]}>Statutory Verification Requirement</Text>
            <Text style={[styles.thText, styles.colOwner]}>Escalation Owner</Text>
          </View>
          {reportData.protocolSteps.map((step) => (
            <ProtocolRow key={step.stepNumber} step={step} />
          ))}
        </View>

        {/* Active Executive Dossier Register */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Updated Executive Dossier Register</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colWide]}>Document &amp; Scope</Text>
            <Text style={[styles.thText, styles.colStage]}>Author Role</Text>
            <Text style={[styles.thText, styles.colNarrow]}>Type</Text>
            <Text style={[styles.thText, styles.colNarrow]}>Updated</Text>
          </View>
          {reportData.officeDocuments.slice(0, 6).map((doc) => (
            <DossierRow key={doc.id} doc={doc} />
          ))}
        </View>

        {/* Sign-Off Block */}
        <View style={styles.signOffRow} wrap={false}>
          {[
            'Outgoing Shift Superintendent',
            'Incoming Shift Superintendent',
            'Control Room Safety Officer',
            'Sign-Off Timestamp',
          ].map((roleLabel) => (
            <View key={roleLabel} style={styles.signOffBox}>
              <Text style={styles.signOffLabel}>{roleLabel}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Plantcor / Arch OS · Executive Shift Handover &amp; Safety Escalation SOP
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
