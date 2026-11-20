import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PresentationSnapshot } from './presentation-data';
import {
  buildExecutivePresentationSlides,
  PRESENTATION_MODULE_FLOWS,
} from './presentation-slides-data';

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 26,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#0f172a',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#b45309',
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brandKicker: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2,
  },
  headerMeta: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#334155',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 7,
  },
  kpiLabel: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 3,
  },
  kpiSub: {
    fontSize: 6.5,
    color: '#475569',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
  },
  slideCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 7,
    backgroundColor: '#f8fafc',
  },
  slideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  slideChapter: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  slideHeadlineMetric: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#b45309',
  },
  slideTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  slideSubtitle: {
    fontSize: 7.5,
    color: '#475569',
    marginTop: 2,
    marginBottom: 4,
  },
  bulletRow: {
    fontSize: 7.5,
    color: '#1e293b',
    marginTop: 1.5,
    paddingLeft: 6,
  },
  flowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 5,
    gap: 8,
  },
  flowStage: {
    width: '22%',
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  flowSummary: {
    width: '50%',
    fontSize: 7.5,
    color: '#1e293b',
  },
  flowTables: {
    width: '28%',
    fontSize: 7,
    color: '#475569',
    fontFamily: 'Helvetica',
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 26,
    right: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#64748b',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
  },
});

const FIRST_PAGE_SLIDE_LIMIT = 6;

export interface InvestorBriefPdfDocumentProps {
  readonly snapshot: PresentationSnapshot;
}

export function InvestorBriefPdfDocument({ snapshot }: InvestorBriefPdfDocumentProps) {
  const slides = buildExecutivePresentationSlides(snapshot);
  const generatedLabel = new Date(snapshot.generatedAtIso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });

  const firstHalfSlides = slides.slice(0, FIRST_PAGE_SLIDE_LIMIT);
  const secondHalfSlides = slides.slice(FIRST_PAGE_SLIDE_LIMIT);

  return (
    <Document
      title="Arch-System Executive & Investor Presentation"
      author="Arch-System Platform"
      subject="CEO & Investor Briefing Deck"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandKicker}>ARCH SYSTEMS · EXECUTIVE &amp; INVESTOR BRIEFING</Text>
            <Text style={styles.title}>Arch-System (Arch OS) Platform Presentation</Text>
            <Text style={styles.subtitle}>
              Unified Pit-to-Plant Mining Operations, SCADA Telemetry, Workshop Reliability &amp;
              Gate Security
            </Text>
          </View>
          <View style={styles.headerMeta}>
            <Text>Snapshot Date: {generatedLabel}</Text>
            <Text>
              Telemetry Status:{' '}
              {snapshot.isLiveTelemetry ? 'Live Production Data' : 'System Baseline'}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Integrated Modules</Text>
            <Text style={styles.kpiValue}>{snapshot.totalDepartments}</Text>
            <Text style={styles.kpiSub}>Pit, Plant, Engineering &amp; Exec</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Fleet Availability</Text>
            <Text style={styles.kpiValue}>{snapshot.fleetAvailabilityPct.toFixed(1)}%</Text>
            <Text style={styles.kpiSub}>
              {snapshot.activeMachines}/{snapshot.totalMachines} active machines
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Breakdowns (24h)</Text>
            <Text style={styles.kpiValue}>{snapshot.resolvedBreakdowns24h} Resolved</Text>
            <Text style={styles.kpiSub}>{snapshot.activeBreakdowns} active workshop open</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Tyre Fleet Tracked</Text>
            <Text style={styles.kpiValue}>{snapshot.totalTires}</Text>
            <Text style={styles.kpiSub}>{snapshot.installedTires} installed active</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>DB Security &amp; QA</Text>
            <Text style={styles.kpiValue}>{snapshot.rlsCoveragePct}% RLS</Text>
            <Text style={styles.kpiSub}>
              {snapshot.migrationsCount} migrations · {snapshot.verificationGatesCount} gates
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Executive Briefing Slides (01 – 06)</Text>
        {firstHalfSlides.map((slide) => (
          <View key={slide.id} style={styles.slideCard} wrap={false}>
            <View style={styles.slideCardHeader}>
              <Text style={styles.slideChapter}>
                Slide {String(slide.slideNumber).padStart(2, '0')} · {slide.chapter}
              </Text>
              <Text style={styles.slideHeadlineMetric}>
                {slide.headlineMetric.label}: {slide.headlineMetric.value}
              </Text>
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
            {slide.highlights.map((bullet) => (
              <Text key={bullet} style={styles.bulletRow}>
                • {bullet}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Arch-System · Plantcor / Arch OS Confidential Investor Pack</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.sectionHeading}>Executive Briefing Slides (07 – 12)</Text>
        {secondHalfSlides.map((slide) => (
          <View key={slide.id} style={styles.slideCard} wrap={false}>
            <View style={styles.slideCardHeader}>
              <Text style={styles.slideChapter}>
                Slide {String(slide.slideNumber).padStart(2, '0')} · {slide.chapter}
              </Text>
              <Text style={styles.slideHeadlineMetric}>
                {slide.headlineMetric.label}: {slide.headlineMetric.value}
              </Text>
            </View>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
            {slide.highlights.map((bullet) => (
              <Text key={bullet} style={styles.bulletRow}>
                • {bullet}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.sectionHeading}>
          End-to-End Mining Value Chain &amp; Data Persistence
        </Text>
        {PRESENTATION_MODULE_FLOWS.map((node) => (
          <View key={node.slug} style={styles.flowRow} wrap={false}>
            <Text style={styles.flowStage}>
              {node.stage} ({node.name})
            </Text>
            <Text style={styles.flowSummary}>{node.roleSummary}</Text>
            <Text style={styles.flowTables}>{node.tablesFed}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Arch-System · Plantcor / Arch OS Confidential Investor Pack</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
