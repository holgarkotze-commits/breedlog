import type { Animal, InsertAnimal } from "./schema";
import { splitTagInput, normalizeStudPrefix } from "./tag-utils";

export const BREEDLOG_CSV_HEADERS = [
  "rawTag",
  "studPrefix",
  "displayTag",
  "name",
  "sex",
  "status",
  "classification",
  "animalSource",
  "birthDate",
  "birthType",
  "birthWeightKg",
  "birthWeightEstimated",
  "weaningDate",
  "weaningWeightKg",
  "weaningWeightEstimated",
  "latestWeightKg",
  "sire",
  "dam",
  "externalSire",
  "externalDam",
  "familyLine",
  "matingGroup",
  "eid",
  "tattooId",
  "notes",
] as const;

export type BreedLogCsvHeader = (typeof BREEDLOG_CSV_HEADERS)[number];
export type BreedLogCsvRow = Record<BreedLogCsvHeader, string>;

const HEADER_ALIASES: Record<BreedLogCsvHeader, string[]> = {
  rawTag: ["rawTag", "Tag ID Raw"],
  studPrefix: ["studPrefix", "Stud Prefix"],
  displayTag: ["displayTag", "tagId", "Display Tag"],
  name: ["name", "Name"],
  sex: ["sex", "Sex"],
  status: ["status", "Status"],
  classification: ["classification", "Classification", "breed", "Breed"],
  animalSource: ["animalSource", "Animal Source", "source", "Source"],
  birthDate: ["birthDate", "Birth Date"],
  birthType: ["birthType", "birthStatus", "Birth Type"],
  birthWeightKg: ["birthWeightKg", "birthWeight", "Birth Weight Kg", "Birth Weight"],
  birthWeightEstimated: ["birthWeightEstimated", "Birth Weight Estimated"],
  weaningDate: ["weaningDate", "weight100DayDate", "Weaning Date"],
  weaningWeightKg: ["weaningWeightKg", "weaningWeight", "weight100Day", "Weaning Weight Kg", "Weaning Weight"],
  weaningWeightEstimated: ["weaningWeightEstimated", "weight100DayEstimated", "Weaning Weight Estimated"],
  latestWeightKg: ["latestWeightKg", "currentWeight", "Current Weight Kg"],
  sire: ["sire", "Sire"],
  dam: ["dam", "Dam"],
  externalSire: ["externalSire", "externalSireInfo", "External Sire"],
  externalDam: ["externalDam", "externalDamInfo", "External Dam"],
  familyLine: ["familyLine", "managementGroup", "Family Line", "Management Group"],
  matingGroup: ["matingGroup", "lambingSeason", "Mating Group"],
  eid: ["eid", "rfid", "electronicId", "RFID/EID", "Electronic ID"],
  tattooId: ["tattooId", "tattoo", "Tattoo ID", "Tattoo"],
  notes: ["notes", "Notes"],
};

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFirstRecordValue(record: Record<string, string>, header: BreedLogCsvHeader): string {
  const aliases = HEADER_ALIASES[header];
  for (const alias of aliases) {
    const exact = record[alias];
    if (exact !== undefined) return String(exact ?? "").trim();
  }
  const normalizedEntries = Object.entries(record).map(([key, value]) => [normalizeHeaderKey(key), value] as const);
  for (const alias of aliases) {
    const match = normalizedEntries.find(([key]) => key === normalizeHeaderKey(alias));
    if (match) return String(match[1] ?? "").trim();
  }
  return "";
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function parseBooleanFlag(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function normalizeAnimalSource(value: string): "born_on_farm" | "bought_in" | "unknown_not_recorded" {
  const v = value.trim().toLowerCase();
  if (!v) return "unknown_not_recorded";
  if (["born on farm", "farm born", "born", "born_on_farm"].includes(v)) return "born_on_farm";
  if (["bought in", "bought", "purchased", "bought_in"].includes(v)) return "bought_in";
  if (["unknown", "not recorded", "unknown_not_recorded"].includes(v)) return "unknown_not_recorded";
  return "unknown_not_recorded";
}

function parseDateOrNull(value: string, field: string, rowNum: number, errors: string[]): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`Row ${rowNum}: invalid ${field} "${value}"`);
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function parseWeightOrNull(value: string, field: string, rowNum: number, errors: string[]): string | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    errors.push(`Row ${rowNum}: invalid ${field} "${value}"`);
    return null;
  }
  return parsed.toFixed(2);
}

export function buildBreedLogCsvRows(
  animals: Animal[],
  fallbackStudPrefix?: string | null,
  allAnimalsForLookup?: Animal[]
): BreedLogCsvRow[] {
  const byId = new Map((allAnimalsForLookup ?? animals).map((animal) => [animal.id, animal]));

  return animals.map((animal) => {
    const prefix = animal.studPrefix || fallbackStudPrefix || "";
    const tagParts = splitTagInput(animal.rawTag || animal.tagId, prefix);
    const sireTag = animal.sireId ? byId.get(animal.sireId)?.tagId || String(animal.sireId) : "";
    const damTag = animal.damId ? byId.get(animal.damId)?.tagId || String(animal.damId) : "";

    return {
      rawTag: tagParts.rawTag || animal.rawTag || "",
      studPrefix: tagParts.studPrefix || normalizeStudPrefix(prefix),
      displayTag: tagParts.canonicalTag || animal.tagId || "",
      name: animal.name || "",
      sex: animal.sex || "",
      status: animal.status || "",
      classification: animal.ramType || animal.classification || "",
      animalSource: animal.animalSource || "unknown_not_recorded",
      birthDate: animal.birthDate || "",
      birthType: animal.birthStatus || "",
      birthWeightKg: animal.birthWeight ? String(animal.birthWeight) : "",
      birthWeightEstimated: animal.birthWeightEstimated ? "true" : "false",
      weaningDate: animal.weight100DayDate || "",
      weaningWeightKg: animal.weight100Day ? String(animal.weight100Day) : "",
      weaningWeightEstimated: animal.weight100DayEstimated ? "true" : "false",
      latestWeightKg: animal.currentWeight ? String(animal.currentWeight) : "",
      sire: sireTag,
      dam: damTag,
      externalSire: animal.externalSireInfo || "",
      externalDam: animal.externalDamInfo || "",
      familyLine: animal.managementGroup || "",
      matingGroup: animal.lambingSeason || "",
      eid: animal.electronicId || "",
      tattooId: animal.tattooId || "",
      notes: animal.notes || "",
    };
  });
}

export function buildBreedLogCsvContent(rows: BreedLogCsvRow[]): string {
  const lines = [BREEDLOG_CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(BREEDLOG_CSV_HEADERS.map((header) => csvEscape(row[header] || "")).join(","));
  }
  return lines.join("\n");
}

export interface BreedLogImportParseResult {
  rowsToCreate: Omit<InsertAnimal, "userId">[];
  createdCandidates: number;
  skipped: number;
  duplicates: number;
  failed: number;
  validationErrors: string[];
}

export function parseBreedLogCsvRecords(records: Record<string, string>[], existingAnimals: Animal[], fallbackStudPrefix?: string | null): BreedLogImportParseResult {
  const existingCanonical = new Set(existingAnimals.map((animal) => splitTagInput(animal.rawTag || animal.tagId, animal.studPrefix || fallbackStudPrefix || "").canonicalTag).filter(Boolean));
  const existingEid = new Set(existingAnimals.map((animal) => (animal.electronicId || "").trim().toLowerCase()).filter(Boolean));
  const seenCanonical = new Set<string>();
  const seenEid = new Set<string>();
  const validationErrors: string[] = [];
  const rowsToCreate: Omit<InsertAnimal, "userId">[] = [];

  let skipped = 0;
  let duplicates = 0;

  for (let i = 0; i < records.length; i++) {
    const rowNum = i + 2;
    const record = records[i];

    const studPrefix = getFirstRecordValue(record, "studPrefix") || normalizeStudPrefix(fallbackStudPrefix);
    const displayTag = getFirstRecordValue(record, "displayTag");
    const rawTag = getFirstRecordValue(record, "rawTag");
    const tagSource = displayTag || rawTag;

    if (!tagSource) {
      validationErrors.push(`Row ${rowNum}: missing displayTag/rawTag`);
      continue;
    }

    const tagParts = splitTagInput(tagSource, studPrefix);
    if (!tagParts.canonicalTag) {
      validationErrors.push(`Row ${rowNum}: invalid tag`);
      continue;
    }

    const canonicalLower = tagParts.canonicalTag.toLowerCase();
    if (existingCanonical.has(tagParts.canonicalTag) || seenCanonical.has(canonicalLower)) {
      duplicates += 1;
      skipped += 1;
      continue;
    }

    const sex = (getFirstRecordValue(record, "sex") || "ewe").toLowerCase();
    if (!sex || !["ram", "ewe", "wether"].includes(sex)) {
      validationErrors.push(`Row ${rowNum}: invalid sex "${sex}"`);
      continue;
    }

    const birthDate = parseDateOrNull(getFirstRecordValue(record, "birthDate"), "birthDate", rowNum, validationErrors);
    const weaningDate = parseDateOrNull(getFirstRecordValue(record, "weaningDate"), "weaningDate", rowNum, validationErrors);
    const birthWeight = parseWeightOrNull(getFirstRecordValue(record, "birthWeightKg"), "birthWeightKg", rowNum, validationErrors);
    const weaningWeight = parseWeightOrNull(getFirstRecordValue(record, "weaningWeightKg"), "weaningWeightKg", rowNum, validationErrors);
    const latestWeight = parseWeightOrNull(getFirstRecordValue(record, "latestWeightKg"), "latestWeightKg", rowNum, validationErrors);

    const eidRaw = getFirstRecordValue(record, "eid");
    const normalizedEid = eidRaw.trim().toLowerCase();
    if (normalizedEid && (existingEid.has(normalizedEid) || seenEid.has(normalizedEid))) {
      duplicates += 1;
      skipped += 1;
      continue;
    }

    seenCanonical.add(canonicalLower);
    if (normalizedEid) seenEid.add(normalizedEid);

    rowsToCreate.push({
      tagId: tagParts.canonicalTag,
      rawTag: tagParts.rawTag || null,
      studPrefix: tagParts.studPrefix || null,
      name: getFirstRecordValue(record, "name") || null,
      sex,
      status: getFirstRecordValue(record, "status") || "active",
      classification: getFirstRecordValue(record, "classification") || "unclassified",
      animalSource: normalizeAnimalSource(getFirstRecordValue(record, "animalSource")),
      birthDate,
      birthStatus: getFirstRecordValue(record, "birthType") || null,
      birthWeight,
      birthWeightEstimated: parseBooleanFlag(getFirstRecordValue(record, "birthWeightEstimated")),
      weight100Day: weaningWeight,
      weight100DayDate: weaningDate,
      weight100DayEstimated: parseBooleanFlag(getFirstRecordValue(record, "weaningWeightEstimated")),
      currentWeight: latestWeight,
      externalSireInfo: getFirstRecordValue(record, "externalSire") || getFirstRecordValue(record, "sire") || null,
      externalDamInfo: getFirstRecordValue(record, "externalDam") || getFirstRecordValue(record, "dam") || null,
      managementGroup: getFirstRecordValue(record, "familyLine") || null,
      lambingSeason: getFirstRecordValue(record, "matingGroup") || null,
      electronicId: eidRaw || null,
      tattooId: getFirstRecordValue(record, "tattooId") || null,
      notes: getFirstRecordValue(record, "notes") || null,
      breed: "Meatmaster",
    });
  }

  return {
    rowsToCreate,
    createdCandidates: rowsToCreate.length,
    skipped,
    duplicates,
    failed: validationErrors.length,
    validationErrors,
  };
}

export function buildBreedLogImportTemplateCsv(): string {
  return `${BREEDLOG_CSV_HEADERS.join(",")}\n`;
}
