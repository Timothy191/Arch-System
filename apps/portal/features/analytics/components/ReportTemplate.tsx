import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// macOS Sonoma light-inspired styles for PDF rendering
const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 15,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  card: {
    width: "48%",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 6,
    padding: 12,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 4,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    padding: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    padding: 8,
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#374151",
    flex: 1,
  },
  tableCell: {
    fontSize: 8,
    color: "#4b5563",
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
});

export interface ReportData {
  title: string;
  subtitle: string;
  kpis: { label: string; value: string }[];
  tableHeaders: string[];
  tableRows: string[][];
}

export function ReportTemplate({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>{data.subtitle}</Text>
        </View>

        {/* KPIs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <View style={styles.grid}>
            {data.kpis.map((kpi, idx) => (
              <View key={idx} style={styles.card}>
                <Text style={styles.cardLabel}>{kpi.label}</Text>
                <Text style={styles.cardValue}>{kpi.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Table Section */}
        {data.tableRows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operational Details</Text>
            <View style={styles.table}>
              {/* Header */}
              <View style={styles.tableHeader}>
                {data.tableHeaders.map((header, idx) => (
                  <Text key={idx} style={styles.tableCellHeader}>
                    {header}
                  </Text>
                ))}
              </View>
              {/* Rows */}
              {data.tableRows.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.tableRow}>
                  {row.map((cell, cellIdx) => (
                    <Text key={cellIdx} style={styles.tableCell}>
                      {cell}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Arch-Systems Mining Operations Portal
          </Text>
          <Text style={styles.footerText}>
            Generated on{" "}
            {new Date().toLocaleDateString("en-ZA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
