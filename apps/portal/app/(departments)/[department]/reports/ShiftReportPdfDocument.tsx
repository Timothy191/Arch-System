import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import * as React from 'react';
import type { PdfSiteGroup } from './reports-types';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 28,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brandLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#2563eb',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  headerRight: {
    textAlign: 'right',
    fontSize: 7.5,
    color: '#334155',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 6,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
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
  siteSection: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  siteBanner: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  siteBannerTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  siteBannerMeta: {
    fontSize: 7.5,
    color: '#cbd5e1',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  groupBannerExcavator: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  groupBannerRollover: {
    backgroundColor: '#fefce8',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  groupBannerSiteMachine: {
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  groupBannerText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#1e293b',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  subtotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontWeight: 'bold',
  },
  colMachine: { width: '16%', paddingRight: 4 },
  colSmu: { width: '11%', textAlign: 'right', paddingRight: 4 },
  colWorked: { width: '7%', textAlign: 'right', paddingRight: 4, fontWeight: 'bold' },
  colOperator: { width: '12%', paddingRight: 4 },
  colProdDelay: { width: '7%', textAlign: 'right', paddingRight: 4 },
  colEngDelay: { width: '7%', textAlign: 'right', paddingRight: 4 },
  colNatDelay: { width: '7%', textAlign: 'right', paddingRight: 4 },
  colNonSiteDelay: { width: '8%', textAlign: 'right', paddingRight: 4 },
  colActivity: { width: '25%' },
  thText: {
    fontSize: 6.5,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  cellTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cellSub: {
    fontSize: 6.5,
    color: '#64748b',
  },
  cellText: {
    fontSize: 7.5,
    color: '#1e293b',
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6.5,
    color: '#64748b',
  },
});

export interface ShiftReportPdfDocumentProps {
  departmentName: string;
  todayStr: string;
  currentShift: 'day' | 'night';
  periodLabel: string;
  shiftFilterLabel: string;
  siteGroups: PdfSiteGroup[];
  totals: {
    totalHours: number;
    totalMachines: number;
    prod: number;
    eng: number;
    nat: number;
    nonSite: number;
  };
}

export function ShiftReportPdfDocument({
  departmentName,
  todayStr,
  currentShift,
  periodLabel,
  shiftFilterLabel,
  siteGroups,
  totals,
}: ShiftReportPdfDocumentProps) {
  return (
    <Document title={`${departmentName} — Site-Grouped Shift Report`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandLabel}>
              Plantcor Mining Operations · Official Shift Report PDF
            </Text>
            <Text style={styles.title}>{departmentName} — Site-Grouped Shift Report</Text>
            <Text style={styles.subtitle}>
              Period: {periodLabel} · Shift: {shiftFilterLabel} · Sequence: Site → 1. Excavators
              First → 2. Roll Over → 3. Machines Worked on Site
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text>Generated: {todayStr}</Text>
            <Text>Active Shift: {currentShift.toUpperCase()}</Text>
            <Text>
              Sites: {siteGroups.length} · Machines: {totals.totalMachines}
            </Text>
          </View>
        </View>

        {/* Summary KPI Strip */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total Worked Hours</Text>
            <Text style={styles.kpiValue}>{totals.totalHours.toFixed(2)} h</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Production Delay</Text>
            <Text style={styles.kpiValue}>{totals.prod} min</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Engineering Delay</Text>
            <Text style={styles.kpiValue}>{totals.eng} min</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Natural Delays</Text>
            <Text style={styles.kpiValue}>{totals.nat} min</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Non-Site Related Delays</Text>
            <Text style={styles.kpiValue}>{totals.nonSite} min</Text>
          </View>
        </View>

        {/* Site Groups */}
        {siteGroups.map((siteGroup) => {
          const groups = [
            {
              key: 'excavator',
              label: '1. Excavators First — Excavator Activity',
              items: siteGroup.excavators,
              bannerStyle: styles.groupBannerExcavator,
            },
            {
              key: 'rollover',
              label: '2. Roll Over — Dozer Operations (Hours × 250 BCM)',
              items: siteGroup.rollovers,
              bannerStyle: styles.groupBannerRollover,
            },
            {
              key: 'site_machine',
              label: '3. Machines Worked on Site',
              items: siteGroup.siteMachines,
              bannerStyle: styles.groupBannerSiteMachine,
            },
          ];

          return (
            <View key={siteGroup.site} style={styles.siteSection}>
              <View style={styles.siteBanner}>
                <Text style={styles.siteBannerTitle}>SITE: {siteGroup.site}</Text>
                <Text style={styles.siteBannerMeta}>
                  1. Excavators: {siteGroup.excavators.length} · 2. Roll Over:{' '}
                  {siteGroup.rollovers.length} · 3. Site Machines: {siteGroup.siteMachines.length} |
                  Worked: {siteGroup.totalHours.toFixed(2)}h · Volume:{' '}
                  {Number(siteGroup.totalBcm.toFixed(1)).toLocaleString()} BCM
                </Text>
              </View>

              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, styles.colMachine]}>Machine</Text>
                <Text style={[styles.thText, styles.colSmu]}>Hours Start - Stop</Text>
                <Text style={[styles.thText, styles.colWorked]}>Total Worked</Text>
                <Text style={[styles.thText, styles.colOperator]}>Operator</Text>
                <Text style={[styles.thText, styles.colProdDelay]}>Prod Delay</Text>
                <Text style={[styles.thText, styles.colEngDelay]}>Eng Delay</Text>
                <Text style={[styles.thText, styles.colNatDelay]}>Natural Delays</Text>
                <Text style={[styles.thText, styles.colNonSiteDelay]}>Non-Site Delays</Text>
                <Text style={[styles.thText, styles.colActivity]}>Excavator Activity</Text>
              </View>

              {groups.map((grp) => {
                if (grp.items.length === 0) return null;
                return (
                  <View key={grp.key}>
                    <View style={grp.bannerStyle}>
                      <Text style={styles.groupBannerText}>
                        {grp.label} ({grp.items.length})
                      </Text>
                    </View>
                    {grp.items.map((op) => {
                      const hoursStartStop =
                        op.startSmu != null && op.endSmu != null
                          ? `${op.startSmu.toFixed(1)} - ${op.endSmu.toFixed(1)}`
                          : op.startSmu != null
                            ? `${op.startSmu.toFixed(1)} - Active`
                            : '—';
                      return (
                        <View key={op.id} style={styles.tableRow}>
                          <View style={styles.colMachine}>
                            <Text style={styles.cellTitle}>{op.machineName}</Text>
                            <Text style={styles.cellSub}>
                              {op.machineType} · {op.date} ({op.shift.toUpperCase()})
                            </Text>
                          </View>
                          <Text style={[styles.cellText, styles.colSmu]}>{hoursStartStop}</Text>
                          <Text style={[styles.cellText, styles.colWorked]}>
                            {op.hoursWorked.toFixed(2)}h
                          </Text>
                          <Text style={[styles.cellText, styles.colOperator]}>
                            {op.operatorName}
                          </Text>
                          <Text style={[styles.cellText, styles.colProdDelay]}>
                            {op.productionDelayMinutes ?? 0}m
                          </Text>
                          <Text style={[styles.cellText, styles.colEngDelay]}>
                            {op.engineeringDelayMinutes ?? 0}m
                          </Text>
                          <Text style={[styles.cellText, styles.colNatDelay]}>
                            {op.naturalDelayMinutes ?? 0}m
                          </Text>
                          <Text style={[styles.cellText, styles.colNonSiteDelay]}>
                            {op.nonSiteDelayMinutes ?? 0}m
                          </Text>
                          <Text style={[styles.cellText, styles.colActivity]}>
                            {op.excavatorActivity || '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {/* Site Subtotal */}
              <View style={styles.subtotalRow}>
                <Text style={[styles.cellTitle, styles.colMachine]}>
                  {siteGroup.site} Subtotal ({siteGroup.orderedMachines.length})
                </Text>
                <Text style={[styles.cellText, styles.colSmu]}>—</Text>
                <Text style={[styles.cellTitle, styles.colWorked]}>
                  {siteGroup.totalHours.toFixed(2)}h
                </Text>
                <Text style={[styles.cellText, styles.colOperator]}>—</Text>
                <Text style={[styles.cellTitle, styles.colProdDelay]}>
                  {siteGroup.productionDelayMin}m
                </Text>
                <Text style={[styles.cellTitle, styles.colEngDelay]}>
                  {siteGroup.engineeringDelayMin}m
                </Text>
                <Text style={[styles.cellTitle, styles.colNatDelay]}>
                  {siteGroup.naturalDelayMin}m
                </Text>
                <Text style={[styles.cellTitle, styles.colNonSiteDelay]}>
                  {siteGroup.nonSiteDelayMin}m
                </Text>
                <Text style={[styles.cellTitle, styles.colActivity]}>
                  Excavator: {Number(siteGroup.excavatorBcm.toFixed(1)).toLocaleString()} BCM ·
                  Roll-over: {Number(siteGroup.rolloverBcm.toFixed(1)).toLocaleString()} BCM
                </Text>
              </View>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Plantcor Mining Operations · Arch-System Shift Report PDF · Confidential
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
