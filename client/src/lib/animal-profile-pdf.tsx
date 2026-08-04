import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { AnimalWithRelations } from "@shared/schema";
import type {
  AnimalPerformanceProfile,
  DataConfidence,
} from "@/lib/animal-performance";
import { sanitizePublicNote } from "@/lib/export-template";
import { compressImage, PDF_QUALITY_SETTINGS, type PDFQuality } from "@/lib/pdf-utils";

type FarmSettingsLike = {
  farmName?: string | null;
  studName?: string | null;
  studPrefix?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  farmLocation?: string | null;
  farmAddress?: string | null;
  membershipNumber?: string | null;
  registrationNumber?: string | null;
};

/** One resolved ancestor node — used for the grandparent tier of the pedigree tree. */
export type PedigreeAncestor = {
  tagId: string;
  breed?: string | null;
};

/** Resolved grandparent data to be passed into the PDF. */
export type PedigreeGrandparents = {
  paternalGrandsire: PedigreeAncestor | null;
  paternalGranddam:  PedigreeAncestor | null;
  maternalGrandsire: PedigreeAncestor | null;
  maternalGranddam:  PedigreeAncestor | null;
};

type AnimalProfilePdfDocumentProps = {
  animal: AnimalWithRelations;
  farmSettings?: FarmSettingsLike | null;
  exportDate: string;
  photoBase64: string | null;
  profile: AnimalPerformanceProfile;
  /** Resolved three-generation pedigree data. Null slots render as dashed "Unknown" nodes. */
  grandparents?: PedigreeGrandparents | null;
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#102033",
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.4,
    paddingTop: 112,
    paddingBottom: 68,
    paddingHorizontal: 32,
  },
  header: {
    position: "absolute",
    top: 24,
    left: 32,
    right: 32,
    borderBottom: "2 solid #FFC300",
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandStack: {
    gap: 2,
    maxWidth: 320,
  },
  brandName: {
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  brandTagline: {
    fontSize: 9,
    color: "#444",
  },
  farmStack: {
    gap: 2,
    alignItems: "flex-end",
    textAlign: "right",
    maxWidth: 200,
  },
  farmName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  farmMeta: {
    fontSize: 8.5,
    color: "#555",
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 32,
    right: 32,
    borderTop: "1.5 solid #FFC300",
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerText: {
    fontSize: 7.5,
    color: "#888",
  },
  footerBrand: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#102033",
  },
  footerCreator: {
    fontSize: 6,
    color: "#aaa",
    marginTop: 2,
  },
  footerRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  hero: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 16,
  },
  heroMain: {
    flexGrow: 1,
    flexBasis: 0,
    gap: 10,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#102033",
  },
  subtitle: {
    fontSize: 9.5,
    color: "#546476",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    backgroundColor: "#e8eef4",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1f3b56",
  },
  badgeAccent: {
    backgroundColor: "#f4e7cf",
    color: "#7a4f0f",
  },
  summaryCard: {
    backgroundColor: "#f5f8fb",
    border: "1 solid #d9e1e8",
    borderRadius: 8,
    padding: 12,
    gap: 5,
  },
  cardLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#5f6f80",
    textTransform: "uppercase",
  },
  cardText: {
    fontSize: 10,
    color: "#1f2d3d",
  },
  heroImageWrap: {
    width: 170,
    gap: 6,
  },
  heroImage: {
    width: 170,
    height: 150,
    objectFit: "cover",
    borderRadius: 8,
    border: "1 solid #cbd6df",
  },
  imageCaption: {
    fontSize: 8,
    color: "#607182",
    textAlign: "center",
  },
  section: {
    marginBottom: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    textTransform: "uppercase",
    borderBottom: "1.5 solid #FFC300",
    paddingBottom: 3,
    marginBottom: 2,
  },
  sectionHint: {
    fontSize: 8.5,
    color: "#627384",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cell: {
    width: "48.6%",
    border: "1 solid #d9e1e8",
    borderRadius: 7,
    padding: 8,
    gap: 2,
    backgroundColor: "#ffffff",
  },
  metricValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#102033",
  },
  metricLabel: {
    fontSize: 8.5,
    color: "#627384",
  },
  metricNote: {
    fontSize: 8,
    color: "#7b8895",
  },
  listCard: {
    border: "1 solid #d9e1e8",
    borderRadius: 7,
    padding: 10,
    gap: 4,
  },
  listItem: {
    fontSize: 9.5,
    color: "#1f2d3d",
  },
  // Pedigree page styles
  pedigreePage: {
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 80,
    paddingBottom: 80,
    paddingHorizontal: 32,
  },
  pedigreeTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
    borderBottom: "2 solid #FFC300",
    paddingBottom: 6,
  },
  pedigreeSubtitle: {
    fontSize: 9,
    color: "#666",
    marginBottom: 20,
  },
  pedigreeTree: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    marginTop: 8,
  },
  pedigreeColumn: {
    flexDirection: "column",
    gap: 8,
  },
  pedigreeBox: {
    border: "1 solid #d9e1e8",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#f9f9f9",
    minWidth: 130,
    maxWidth: 150,
    gap: 2,
  },
  pedigreeBoxSubject: {
    border: "2 solid #FFC300",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#fff9e6",
    minWidth: 130,
    gap: 3,
  },
  pedigreeBoxUnknown: {
    border: "1 dashed #ccc",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#fafafa",
    minWidth: 130,
    maxWidth: 150,
    gap: 2,
  },
  pedigreeBoxLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pedigreeBoxId: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  pedigreeBoxIdUnknown: {
    fontSize: 9.5,
    color: "#aaa",
    fontFamily: "Helvetica-Oblique",
  },
  pedigreeBoxBreed: {
    fontSize: 8,
    color: "#666",
  },
  pedigreeConnector: {
    width: 20,
    borderTop: "1 solid #d9e1e8",
    marginTop: 10,
    alignSelf: "center",
  },
  pedigreeConnectorBlock: {
    width: 20,
    flexDirection: "column",
    justifyContent: "center",
    gap: 0,
  },
  pedigreeNote: {
    fontSize: 8,
    color: "#888",
    fontFamily: "Helvetica-Oblique",
    marginTop: 16,
  },
});

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-GB");
}

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Not recorded";
  }
  return `${value}${suffix}`;
}

function formatWeight(value: number | null | undefined) {
  return formatNumber(value, " kg");
}

function formatRate(value: number | null | undefined) {
  return formatNumber(value, "%");
}

function formatAdg(value: number | null | undefined) {
  return formatNumber(value, " g/day");
}

function formatAgeLabel(days: number | null) {
  if (days === null) return "Unknown age";
  if (days < 90) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months`;
  return `${Math.floor(days / 365)} yr ${Math.floor((days % 365) / 30)} mo`;
}

function confidenceLabel(confidence: DataConfidence) {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  if (confidence === "low") return "Low confidence";
  return "Insufficient data";
}

function roleLabel(role: AnimalPerformanceProfile["role"]) {
  if (role === "ram") return "Ram";
  if (role === "ewe") return "Ewe";
  if (role === "young-stud-ram") return "Young stud ram";
  if (role === "young-stud-ewe") return "Young stud ewe";
  if (role === "meat-production") return "Meat production";
  return "Lamb";
}

function metricCell(label: string, value: string, note?: string) {
  return (
    <View style={styles.cell} key={label}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {note ? <Text style={styles.metricNote}>{note}</Text> : null}
    </View>
  );
}

function buildRoleMetrics(profile: AnimalPerformanceProfile) {
  if (profile.role === "ram" || profile.role === "young-stud-ram") {
    const metrics = profile.ramProgenyMetrics;
    if (!metrics) {
      return [metricCell("Progeny record", "No progeny data", "No sire-linked performance records are available yet.")];
    }
    return [
      metricCell("Total progeny", formatNumber(metrics.totalProgeny)),
      metricCell("Male / female progeny", `${metrics.maleProgeny} / ${metrics.femaleProgeny}`),
      metricCell("Live / lost progeny", `${metrics.progenyLive} / ${metrics.progenyDead}`),
      metricCell("Mating events", formatNumber(metrics.matingEvents)),
      metricCell("Lambing events", formatNumber(metrics.lambingEvents)),
      metricCell("Lambing rate", formatRate(metrics.lambingRate)),
      metricCell("Avg progeny birth weight", formatWeight(metrics.avgProgenyBirthWeight)),
      metricCell("Avg progeny 100-day weight", formatWeight(metrics.avgProgeny100Day)),
      metricCell("Avg progeny 270-day weight", formatWeight(metrics.avgProgeny270Day)),
    ];
  }

  if (profile.role === "ewe" || profile.role === "young-stud-ewe") {
    const metrics = profile.eweProductivityMetrics;
    if (!metrics) {
      return [metricCell("Breeding record", "No lambing data", "No ewe productivity records are available yet.")];
    }
    return [
      metricCell("Lambing events", formatNumber(metrics.totalLambingEvents)),
      metricCell("Total lambs born", formatNumber(metrics.totalLambsBorn)),
      metricCell("Lambs live / dead", `${metrics.lambsLive} / ${metrics.lambsDead}`),
      metricCell("Fertility rate", formatRate(metrics.fertilityRate)),
      metricCell("Lamb survival rate", formatRate(metrics.survivalRate)),
      metricCell("Average inter-lambing period", formatNumber(metrics.avgILP, " days")),
      metricCell("Avg lamb birth weight", formatWeight(metrics.avgLambBirthWeight)),
      metricCell("Avg lamb 100-day weight", formatWeight(metrics.avgLamb100Day)),
      metricCell("Avg lamb 270-day weight", formatWeight(metrics.avgLamb270Day)),
    ];
  }

  if (profile.role === "meat-production") {
    const metrics = profile.meatProductionMetrics;
    if (!metrics) {
      return [metricCell("Market readiness", "Not recorded")];
    }
    return [
      metricCell("Current weight", formatWeight(metrics.currentWeight)),
      metricCell("Market target", formatWeight(metrics.marketTargetKg)),
      metricCell("Progress to target", formatRate(metrics.percentToTarget)),
      metricCell("Current ADG", formatAdg(metrics.adgBirthToCurrent)),
      metricCell("Projected days to target", formatNumber(metrics.projectedDaysToTarget, " days")),
    ];
  }

  const metrics = profile.youngAnimalMetrics;
  if (!metrics) {
    return [metricCell("Young stock record", "Growth data pending")];
  }
  return [
    metricCell("Age category", metrics.ageCategory),
    metricCell("Recorded growth points", formatNumber(metrics.growthDataPoints)),
    metricCell("Sire", metrics.sireTagId || "Not recorded"),
    metricCell("Dam", metrics.damTagId || "Not recorded"),
    metricCell("Pedigree data", metrics.hasParentalData ? "Linked" : "Not recorded"),
  ];
}

// Render a pedigree entry box — dashed border when unknown
function PedigreeBox({ label, tagId, breed, isSubject = false }: {
  label: string;
  tagId: string | null | undefined;
  breed?: string | null;
  isSubject?: boolean;
}) {
  const isUnknown = !tagId;
  const boxStyle = isSubject ? styles.pedigreeBoxSubject : isUnknown ? styles.pedigreeBoxUnknown : styles.pedigreeBox;
  const idStyle = isUnknown ? styles.pedigreeBoxIdUnknown : styles.pedigreeBoxId;
  return (
    <View style={boxStyle}>
      <Text style={styles.pedigreeBoxLabel}>{label}</Text>
      <Text style={idStyle}>{tagId || "Unknown"}</Text>
      {breed && !isUnknown ? <Text style={styles.pedigreeBoxBreed}>{breed}</Text> : null}
    </View>
  );
}

function AnimalProfilePdfDocument({
  animal,
  exportDate,
  farmSettings,
  photoBase64,
  profile,
  grandparents,
}: AnimalProfilePdfDocumentProps) {
  const farmDisplayName = farmSettings?.studName || farmSettings?.farmName || "BreedLog";
  const contactLine = [farmSettings?.ownerName, farmSettings?.ownerPhone].filter(Boolean).join(" | ");
  const registrationLine = [
    farmSettings?.membershipNumber ? `Membership: ${farmSettings.membershipNumber}` : null,
    farmSettings?.registrationNumber ? `Registration: ${farmSettings.registrationNumber}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <Document
      title={`${animal.tagId} Performance Datasheet`}
      author="BreedLog"
      subject="Individual animal performance datasheet"
      creator="BreedLog"
      producer="BreedLog"
      language="en-GB"
    >
      <Page size="A4" style={styles.page}>
        <View fixed style={styles.header}>
          <View style={styles.brandStack}>
            <Text style={styles.brandName}>BREEDLOG</Text>
            <Text style={styles.brandTagline}>Professional livestock performance datasheet</Text>
          </View>
          <View style={styles.farmStack}>
            <Text style={styles.farmName}>{farmDisplayName}</Text>
            {contactLine ? <Text style={styles.farmMeta}>{contactLine}</Text> : null}
            {registrationLine ? <Text style={styles.farmMeta}>{registrationLine}</Text> : null}
          </View>
        </View>

        <View fixed style={styles.footer}>
          <View>
            <Text style={styles.footerText}>Exported {exportDate}</Text>
            {contactLine ? <Text style={styles.footerText}>{contactLine}</Text> : null}
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.footerBrand}>BREEDLOG</Text>
            <Text style={styles.footerCreator}>A STITCH WORX Product</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroMain}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{animal.tagId}</Text>
              <Text style={styles.subtitle}>
                {animal.breed || "Breed not recorded"} | {roleLabel(profile.role)} | {animal.status || "Status not recorded"}
              </Text>
            </View>

            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{(animal.sex || "Unknown").toUpperCase()}</Text>
              <Text style={[styles.badge, styles.badgeAccent]}>{profile.overallRating}</Text>
              <Text style={styles.badge}>{confidenceLabel(profile.dataConfidence)}</Text>
              <Text style={styles.badge}>{formatAgeLabel(profile.growthMetrics.ageInDays)}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.cardLabel}>Performance summary</Text>
              <Text style={styles.cardText}>{profile.summary}</Text>
            </View>
          </View>

          {photoBase64 ? (
            <View style={styles.heroImageWrap}>
              <Image src={photoBase64} style={styles.heroImage} />
              <Text style={styles.imageCaption}>Recorded animal image</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recorded facts</Text>
          <Text style={styles.sectionHint}>Core identity, parentage, lifecycle and status values recorded in the workspace.</Text>
          <View style={styles.grid}>
            {metricCell("Breed", animal.breed || "Not recorded")}
            {metricCell("Birth date", formatDate(animal.birthDate))}
            {metricCell("Current weight", formatWeight(profile.growthMetrics.currentWeight))}
            {metricCell("Birth weight", formatWeight(profile.growthMetrics.birthWeight))}
            {metricCell("100-day weight", formatWeight(profile.growthMetrics.weight100Day))}
            {metricCell("270-day weight", formatWeight(profile.growthMetrics.weight270Day))}
            {metricCell("Dam", animal.dam?.tagId || animal.externalDamInfo || "Not recorded")}
            {metricCell("Sire", animal.sire?.tagId || animal.externalSireInfo || "Not recorded")}
            {metricCell("Breeder", animal.breederName || "Not recorded")}
            {metricCell("Owner", animal.ownerName || "Not recorded")}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Derived metrics</Text>
          <Text style={styles.sectionHint}>Calculated from recorded facts. Missing records are shown as not recorded.</Text>
          <View style={styles.grid}>
            {metricCell("Weight data points", formatNumber(profile.growthMetrics.weightDataPoints))}
            {metricCell("ADG birth to 100-day", formatAdg(profile.growthMetrics.adgBirthTo100))}
            {metricCell("ADG birth to 270-day", formatAdg(profile.growthMetrics.adgBirthTo270))}
            {metricCell("ADG birth to current", formatAdg(profile.growthMetrics.adgBirthToCurrent))}
            {buildRoleMetrics(profile)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health and notes</Text>
          <Text style={styles.sectionHint}>Recent health context captured for this workspace-scoped animal record.</Text>
          <View style={styles.listCard}>
            <Text style={styles.listItem}>Health records logged: {formatNumber(profile.healthRecordCount)}</Text>
            {profile.recentHealthNotes.length > 0 ? (
              profile.recentHealthNotes.slice(0, 5).map((note, index) => (
                <Text style={styles.listItem} key={`${index}-${note}`}>
                  - {note}
                </Text>
              ))
            ) : (
              <Text style={styles.listItem}>- No recent health notes recorded.</Text>
            )}
            <Text style={styles.listItem}>- General notes: {sanitizePublicNote(animal.notes) || "No notes recorded."}</Text>
          </View>
        </View>
      </Page>

      {/* Page 2 — Pedigree Tree */}
      <Page size="A4" style={styles.pedigreePage}>
        <View fixed style={styles.header}>
          <View style={styles.brandStack}>
            <Text style={styles.brandName}>BREEDLOG</Text>
            <Text style={styles.brandTagline}>Animal Pedigree Record</Text>
          </View>
          <View style={styles.farmStack}>
            <Text style={styles.farmName}>{farmDisplayName}</Text>
            {contactLine ? <Text style={styles.farmMeta}>{contactLine}</Text> : null}
          </View>
        </View>

        <View fixed style={styles.footer}>
          <View>
            <Text style={styles.footerText}>Exported {exportDate}</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.footerBrand}>BREEDLOG</Text>
            <Text style={styles.footerCreator}>A STITCH WORX Product</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>

        <Text style={styles.pedigreeTitle}>Pedigree — {animal.tagId}</Text>
        <Text style={styles.pedigreeSubtitle}>
          {animal.breed || "Breed not recorded"} · {roleLabel(profile.role)} · Three-generation pedigree from recorded workspace data
        </Text>

        {/* Tree: Subject → Parents → Grandparents (matches in-app direction: left = subject, right = ancestors) */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>

          {/* Column 1: Subject */}
          <View style={{ alignSelf: "center" }}>
            <PedigreeBox
              label="Subject"
              tagId={animal.tagId}
              breed={animal.breed}
              isSubject
            />
          </View>

          {/* Connector — horizontal bar + vertical fork */}
          <View style={{ width: 18, alignSelf: "center" }}>
            <View style={{ borderTop: "1 solid #bbb", width: 18 }} />
          </View>

          {/* Column 2: Parents */}
          <View style={{ flexDirection: "column", gap: 20, alignItems: "flex-start" }}>
            <PedigreeBox
              label="Sire"
              tagId={animal.sire?.tagId || animal.externalSireInfo}
              breed={animal.sire?.breed}
            />
            <PedigreeBox
              label="Dam"
              tagId={animal.dam?.tagId || animal.externalDamInfo}
              breed={animal.dam?.breed}
            />
          </View>

          {/* Connector */}
          <View style={{ width: 18, alignSelf: "center" }}>
            <View style={{ borderTop: "1 solid #bbb", width: 18 }} />
          </View>

          {/* Column 3: Grandparents (4 entries, paired 2+2) */}
          <View style={{ flexDirection: "column", gap: 6, flex: 1 }}>
            {/* Paternal pair */}
            <PedigreeBox
              label="Paternal Grandsire"
              tagId={grandparents?.paternalGrandsire?.tagId ?? null}
              breed={grandparents?.paternalGrandsire?.breed}
            />
            <PedigreeBox
              label="Paternal Granddam"
              tagId={grandparents?.paternalGranddam?.tagId ?? null}
              breed={grandparents?.paternalGranddam?.breed}
            />
            {/* Gap between paternal and maternal */}
            <View style={{ height: 12 }} />
            {/* Maternal pair */}
            <PedigreeBox
              label="Maternal Grandsire"
              tagId={grandparents?.maternalGrandsire?.tagId ?? null}
              breed={grandparents?.maternalGrandsire?.breed}
            />
            <PedigreeBox
              label="Maternal Granddam"
              tagId={grandparents?.maternalGranddam?.tagId ?? null}
              breed={grandparents?.maternalGranddam?.breed}
            />
          </View>
        </View>

        <Text style={styles.pedigreeNote}>
          Dashed nodes indicate animals whose parentage is not recorded in this workspace. Grandparents are resolved from linked
          parent records first; if a parent animal is not linked to its own sire or dam in the workspace, the external sire/dam
          info text is used. To complete the pedigree, link each parent animal to its own parents in the workspace.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Build the individual animal PDF as a Blob.
 *
 * quality controls JPEG compression applied to the embedded animal photo:
 *   high   → original resolution  (no compression; best for printing)
 *   medium → 70% JPEG quality, max 800×800 px  (balanced; good for email)
 *   low    → 50% JPEG quality, max 400×400 px  (smallest file; good for WhatsApp)
 *
 * Text, tables, and layout are vector-based and unaffected by quality.
 */
export async function buildAnimalProfilePdfBlob(
  props: AnimalProfilePdfDocumentProps,
  quality: PDFQuality = 'high',
): Promise<Blob> {
  let { photoBase64 } = props;
  if (photoBase64 && quality !== 'high') {
    photoBase64 = await compressImage(photoBase64, PDF_QUALITY_SETTINGS[quality]);
  }
  return pdf(<AnimalProfilePdfDocument {...props} photoBase64={photoBase64} />).toBlob();
}
