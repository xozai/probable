import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import type { EstimateExhibit, ExhibitLineItem } from "./estimate-exhibit";

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingRight: 38,
    paddingBottom: 62,
    paddingLeft: 38,
    color: "#17231b",
    fontFamily: "Helvetica",
    fontSize: 8.5,
  },
  header: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#245433",
  },
  logo: { width: 92, height: 38, objectFit: "contain" },
  firmName: { color: "#245433", fontSize: 14, fontWeight: 700 },
  documentLabel: {
    color: "#617167",
    fontSize: 7.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  titleBlock: { paddingTop: 16, paddingBottom: 14 },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { marginTop: 4, color: "#3f5146", fontSize: 10 },
  metaGrid: { display: "flex", flexDirection: "row", marginTop: 10 },
  metaCell: { width: "33.33%" },
  metaLabel: {
    color: "#617167",
    fontSize: 6.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metaValue: { marginTop: 2, fontSize: 8.5 },
  tableHeader: {
    display: "flex",
    flexDirection: "row",
    paddingTop: 6,
    paddingBottom: 6,
    color: "#ffffff",
    backgroundColor: "#245433",
    fontSize: 7,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  sectionHeader: {
    marginTop: 9,
    paddingTop: 5,
    paddingRight: 5,
    paddingBottom: 5,
    paddingLeft: 5,
    color: "#245433",
    backgroundColor: "#e8efe9",
    fontSize: 9,
    fontWeight: 700,
  },
  row: {
    display: "flex",
    flexDirection: "row",
    minHeight: 22,
    paddingTop: 5,
    paddingBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dce5dd",
  },
  description: { width: "46%", paddingRight: 5 },
  quantity: { width: "12%", paddingRight: 5, textAlign: "right" },
  unit: { width: "9%", paddingRight: 5 },
  unitPrice: { width: "15%", paddingRight: 5, textAlign: "right" },
  amount: { width: "18%", textAlign: "right" },
  subtotalRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 5,
    paddingBottom: 5,
    fontWeight: 700,
  },
  subtotalLabel: { width: "30%", paddingRight: 8, textAlign: "right" },
  subtotalAmount: { width: "18%", textAlign: "right" },
  totals: {
    width: "48%",
    marginTop: 16,
    marginLeft: "52%",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#245433",
  },
  totalRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 4,
  },
  grandTotal: {
    marginTop: 3,
    paddingTop: 7,
    borderTopWidth: 1.5,
    borderTopColor: "#245433",
    fontSize: 11,
    fontWeight: 700,
  },
  note: { marginTop: 10, color: "#855b1b", fontSize: 7.5 },
  disclosure: {
    marginTop: 18,
    paddingTop: 9,
    borderTopWidth: 0.5,
    borderTopColor: "#aebbb1",
    color: "#56675c",
    fontSize: 6.8,
    lineHeight: 1.4,
  },
  attribution: { marginTop: 4 },
  footer: {
    position: "absolute",
    right: 38,
    bottom: 24,
    left: 38,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#738077",
    fontSize: 6.5,
  },
});

function money(value: string | null): string {
  if (value === null) return "—";
  const [whole, fraction = "00"] = value.split(".");
  return `$${(whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

function milestoneLabel(milestone: string): string {
  return milestone === "custom" ? "Custom" : `${milestone}%`;
}

function LineItemRow({ item }: { item: ExhibitLineItem }) {
  return (
    <View style={styles.row} wrap={false}>
      <Text style={styles.description}>{item.description}</Text>
      <Text style={styles.quantity}>{item.quantity}</Text>
      <Text style={styles.unit}>{item.unit}</Text>
      <Text style={styles.unitPrice}>{money(item.unitPrice)}</Text>
      <Text style={styles.amount}>{item.extension === null ? "Unpriced" : money(item.extension)}</Text>
    </View>
  );
}

export function EstimatePdfDocument({ exhibit }: { exhibit: EstimateExhibit }) {
  const issued = exhibit.estimate.createdAt.toISOString().slice(0, 10);
  const location = [exhibit.project.location, exhibit.project.district]
    .filter(Boolean)
    .join(" · ") || "Not specified";

  return (
    <Document
      title={`${exhibit.project.name} opinion of probable construction cost`}
      author={exhibit.firm.name}
      subject="Opinion of Probable Construction Cost"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.documentLabel}>Opinion of Probable Construction Cost</Text>
            <Text style={styles.firmName}>{exhibit.firm.name}</Text>
          </View>
          {exhibit.firm.logoUrl ? (
            // React PDF's Image is not a DOM image and has no alt prop.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.logo} src={exhibit.firm.logoUrl} />
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{exhibit.project.name}</Text>
          <Text style={styles.subtitle}>
            {milestoneLabel(exhibit.estimate.milestone)} milestone · Revision {exhibit.estimate.revision}
            {exhibit.estimate.label ? ` · ${exhibit.estimate.label}` : ""}
          </Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Project location</Text>
              <Text style={styles.metaValue}>{location}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Estimate status</Text>
              <Text style={styles.metaValue}>Preliminary</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{issued}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tableHeader} fixed>
          <Text style={styles.description}>Description</Text>
          <Text style={styles.quantity}>Quantity</Text>
          <Text style={styles.unit}>Unit</Text>
          <Text style={styles.unitPrice}>Unit price</Text>
          <Text style={styles.amount}>Amount</Text>
        </View>

        {exhibit.sections.map((section) => (
          <View key={section.id ?? "uncategorized"}>
            <Text style={styles.sectionHeader} minPresenceAhead={42}>{section.name}</Text>
            {section.lineItems.map((item) => <LineItemRow key={item.id} item={item} />)}
            <View style={styles.subtotalRow} wrap={false}>
              <Text style={styles.subtotalLabel}>{section.name} subtotal</Text>
              <Text style={styles.subtotalAmount}>{money(section.subtotal)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text><Text>{money(exhibit.totals.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Contingency ({exhibit.estimate.contingencyPct}%)</Text>
            <Text>{money(exhibit.totals.contingency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text>Total</Text><Text>{money(exhibit.totals.total)}</Text>
          </View>
        </View>

        {exhibit.totals.unpricedCount > 0 ? (
          <Text style={styles.note}>
            {exhibit.totals.unpricedCount} unpriced {exhibit.totals.unpricedCount === 1 ? "item is" : "items are"} excluded from this total.
          </Text>
        ) : null}

        <View style={styles.disclosure} wrap={false}>
          <Text>{exhibit.firm.disclaimer}</Text>
          {exhibit.seedAttributions.map((attribution) => (
            <Text key={attribution} style={styles.attribution}>{attribution}</Text>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>{exhibit.firm.name} · {exhibit.project.name}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderEstimatePdf(exhibit: EstimateExhibit): Promise<Buffer> {
  return renderToBuffer(<EstimatePdfDocument exhibit={exhibit} />);
}
