import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AccessReportsData } from '../actions';
import { formatAccessGateTimestamp } from './access-control-whatsapp';

/** Maximum number of audit trail rows rendered in the exported A4 PDF document. */
export const MAX_ACCESS_PDF_AUDIT_ROWS = 15;

export interface AccessControlPdfDocumentProps {
  readonly reportData: AccessReportsData;
  readonly reportDate: string;
  readonly rangeLabel: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 38,
    paddingHorizontal: 26,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: '#0f172a',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 7,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brandLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#b8941f',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 7.5,
    color: '#64748b',
    marginTop: 1.5,
  },
  metaBlock: {
    textAlign: 'right',
    fontSize: 7,
    color: '#334155',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 11,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  kpiLabel: {
    fontSize: 5.8,
    color: '#64748b',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 1.5,
  },
  kpiHint: {
    fontSize: 5.8,
    color: '#64748b',
    marginTop: 1,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 2.5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 2.2,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  thText: {
    fontSize: 6.2,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  cellText: {
    fontSize: 6.8,
    color: '#1e293b',
  },
  cellStrong: {
    fontSize: 6.8,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cellSub: {
    fontSize: 5.8,
    color: '#64748b',
  },
  statusGranted: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#15803d',
  },
  statusDenied: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#d22118',
  },
  emptyState: {
    fontSize: 7,
    color: '#64748b',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  colReason: { width: '56%', paddingRight: 4 },
  colMetric: { width: '14%', textAlign: 'right', paddingRight: 4 },
  colBar: { width: '16%', paddingLeft: 4 },
  barTrack: {
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    backgroundColor: '#b45309',
    borderRadius: 2,
  },
  colGateName: { width: '36%', paddingRight: 4 },
  colPeak: { width: '22%', paddingLeft: 4 },
  colAuditId: { width: '11%', paddingRight: 3 },
  colAuditTime: { width: '16%', paddingRight: 3 },
  colAuditGate: { width: '15%', paddingRight: 3 },
  colAuditEntity: { width: '18%', paddingRight: 3 },
  colAuditAction: { width: '14%', paddingRight: 3 },
  colAuditStatus: { width: '9%', paddingRight: 3 },
  colAuditReason: { width: '17%' },
  signOffRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
  },
  signOffBox: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    paddingTop: 3,
  },
  signOffLabel: {
    fontSize: 6.5,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 26,
    right: 26,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6.5,
    color: '#64748b',
  },
});

function PdfHeader(props: { readonly reportDate: string; readonly rangeLabel: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brandLabel}>ARCH OS · ACCESS CONTROL &amp; SITE SECURITY</Text>
        <Text style={styles.title}>Security Access &amp; Gate Telemetry Report</Text>
        <Text style={styles.subtitle}>
          Official access clearance logs, perimeter barrier throughput, and MHSA / DMRE compliance
        </Text>
      </View>
      <View style={styles.metaBlock}>
        <Text>Operational Date: {props.reportDate}</Text>
        <Text>Document ID: AC-RPT-{props.reportDate}</Text>
        <Text>Reporting Window: {props.rangeLabel}</Text>
        <Text>Standard: MHSA / DMRE Sec. 21 &amp; 22</Text>
      </View>
    </View>
  );
}

function PdfKpiBox(props: {
  readonly label: string;
  readonly metric: string;
  readonly hint: string;
}) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiLabel}>{props.label}</Text>
      <Text style={styles.kpiValue}>{props.metric}</Text>
      <Text style={styles.kpiHint}>{props.hint}</Text>
    </View>
  );
}

function PdfKpiStrip({ reportData }: { readonly reportData: AccessReportsData }) {
  const { summary } = reportData;
  return (
    <View style={styles.kpiRow}>
      <PdfKpiBox
        label="Total Events"
        metric={summary.totalEvents.toLocaleString('en-US')}
        hint="Gate &amp; turnstile scans"
      />
      <PdfKpiBox
        label="Granted Clearances"
        metric={summary.grantedCount.toLocaleString('en-US')}
        hint="Authorized entries"
      />
      <PdfKpiBox
        label="Security Interlocks"
        metric={summary.deniedCount.toLocaleString('en-US')}
        hint="Blocked attempts"
      />
      <PdfKpiBox
        label="Compliance Rate"
        metric={`${summary.complianceRate}%`}
        hint="Benchmark: 95%+"
      />
      <PdfKpiBox
        label="Active Credentials"
        metric={summary.activeCredentials.toLocaleString('en-US')}
        hint="RFID &amp; QR badges"
      />
      <PdfKpiBox
        label="Contractor Hours"
        metric={`${summary.contractorHoursLogged.toLocaleString('en-US')}h`}
        hint="On-site billing hours"
      />
    </View>
  );
}

function PdfDenialTaxonomySection({
  denialTaxonomy,
}: {
  readonly denialTaxonomy: AccessReportsData['denialTaxonomy'];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Security Interlock &amp; Denial Reason Taxonomy</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colReason]}>Denial Reason</Text>
        <Text style={[styles.thText, styles.colMetric]}>Events</Text>
        <Text style={[styles.thText, styles.colMetric]}>Share %</Text>
        <Text style={[styles.thText, styles.colBar]}>Distribution</Text>
      </View>
      {denialTaxonomy.length === 0 ? (
        <Text style={styles.emptyState}>No denial reasons recorded in this window.</Text>
      ) : (
        denialTaxonomy.map((denial) => {
          const fillPct = Math.max(0, Math.min(100, denial.percentage));
          return (
            <View key={denial.reason} style={styles.tableRow} wrap={false}>
              <Text style={[styles.cellStrong, styles.colReason]}>{denial.reason}</Text>
              <Text style={[styles.cellText, styles.colMetric]}>
                {denial.count.toLocaleString('en-US')}
              </Text>
              <Text style={[styles.cellText, styles.colMetric]}>{denial.percentage}%</Text>
              <View style={styles.colBar}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${fillPct}%` }]} />
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function PdfGateTrafficSection({
  gateTraffic,
}: {
  readonly gateTraffic: AccessReportsData['gateTraffic'];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Perimeter Barrier Traffic &amp; Peak Load</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colGateName]}>Gate Location</Text>
        <Text style={[styles.thText, styles.colMetric]}>Inbound</Text>
        <Text style={[styles.thText, styles.colMetric]}>Outbound</Text>
        <Text style={[styles.thText, styles.colMetric]}>Total Scans</Text>
        <Text style={[styles.thText, styles.colPeak]}>Last Peak Activity</Text>
      </View>
      {gateTraffic.length === 0 ? (
        <Text style={styles.emptyState}>No perimeter gate traffic recorded in this window.</Text>
      ) : (
        gateTraffic.map((gate) => {
          const totalScans = gate.inbound + gate.outbound;
          return (
            <View key={gate.gateName} style={styles.tableRow} wrap={false}>
              <Text style={[styles.cellStrong, styles.colGateName]}>{gate.gateName}</Text>
              <Text style={[styles.cellText, styles.colMetric]}>
                {gate.inbound.toLocaleString('en-US')}
              </Text>
              <Text style={[styles.cellText, styles.colMetric]}>
                {gate.outbound.toLocaleString('en-US')}
              </Text>
              <Text style={[styles.cellStrong, styles.colMetric]}>
                {totalScans.toLocaleString('en-US')}
              </Text>
              <Text style={[styles.cellText, styles.colPeak]}>
                {formatAccessGateTimestamp(gate.peakHour)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function PdfAuditTrailSection({
  recentAudits,
}: {
  readonly recentAudits: AccessReportsData['recentAudits'];
}) {
  const visibleAudits = recentAudits.slice(0, MAX_ACCESS_PDF_AUDIT_ROWS);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Audit Event Trail &amp; Security Exceptions</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colAuditId]}>Audit ID</Text>
        <Text style={[styles.thText, styles.colAuditTime]}>Timestamp</Text>
        <Text style={[styles.thText, styles.colAuditGate]}>Gate</Text>
        <Text style={[styles.thText, styles.colAuditEntity]}>Entity</Text>
        <Text style={[styles.thText, styles.colAuditAction]}>Action</Text>
        <Text style={[styles.thText, styles.colAuditStatus]}>Status</Text>
        <Text style={[styles.thText, styles.colAuditReason]}>Note / Reason</Text>
      </View>
      {visibleAudits.length === 0 ? (
        <Text style={styles.emptyState}>No security audit events recorded in this window.</Text>
      ) : (
        visibleAudits.map((audit) => (
          <View key={audit.id} style={styles.tableRow} wrap={false}>
            <Text style={[styles.cellText, styles.colAuditId]}>{audit.id.slice(0, 8)}</Text>
            <Text style={[styles.cellText, styles.colAuditTime]}>{audit.timestamp}</Text>
            <Text style={[styles.cellStrong, styles.colAuditGate]}>{audit.gate}</Text>
            <View style={styles.colAuditEntity}>
              <Text style={styles.cellStrong}>{audit.entityName}</Text>
              <Text style={styles.cellSub}>{audit.entityType}</Text>
            </View>
            <Text style={[styles.cellText, styles.colAuditAction]}>{audit.action}</Text>
            <Text
              style={[
                audit.granted ? styles.statusGranted : styles.statusDenied,
                styles.colAuditStatus,
              ]}
            >
              {audit.granted ? 'GRANTED' : 'DENIED'}
            </Text>
            <Text style={[styles.cellText, styles.colAuditReason]}>
              {audit.reason || 'Standard Badge Verification'}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function PdfSignOff() {
  return (
    <View style={styles.signOffRow} wrap={false}>
      {['Security Officer', 'Site Safety Manager', 'Approval Date'].map((roleTitle) => (
        <View key={roleTitle} style={styles.signOffBox}>
          <Text style={styles.signOffLabel}>{roleTitle}</Text>
        </View>
      ))}
    </View>
  );
}

function PdfFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Plantcor / Arch OS · Confidential Security Compliance Report
      </Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

/**
 * Vector A4 PDF document for Access Control security and gate telemetry compliance reporting.
 */
export function AccessControlPdfDocument(props: AccessControlPdfDocumentProps) {
  const { reportData, reportDate, rangeLabel } = props;
  return (
    <Document title={`Security Access Compliance Report — ${reportDate}`} author="Arch OS">
      <Page size="A4" orientation="portrait" style={styles.page}>
        <PdfHeader reportDate={reportDate} rangeLabel={rangeLabel} />
        <PdfKpiStrip reportData={reportData} />
        <PdfDenialTaxonomySection denialTaxonomy={reportData.denialTaxonomy} />
        <PdfGateTrafficSection gateTraffic={reportData.gateTraffic} />
        <PdfAuditTrailSection recentAudits={reportData.recentAudits} />
        <PdfSignOff />
        <PdfFooter />
      </Page>
    </Document>
  );
}
