import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  HEALTH_EVENT_TYPES,
  HEALTH_PLAN_DISCLAIMER,
  HEALTH_PLAN_TOPICS,
  HEALTH_ROUTE_OPTIONS,
} from "../client/src/lib/health-plan-guide";

const REQUIRED_TOPIC_LABELS = [
  "Purpose & Safety Notice",
  "Daily Animal Observation",
  "Health Planning Principles",
  "Disease Sources & Risk Factors",
  "Vaccination & Prevention",
  "Parasite Control",
  "Medicine Failure Warning Signs",
  "Sheep & Goat Health Calendar",
  "Common Conditions",
  "Wounds, Footrot & Mastitis",
  "Deficiencies & Nutrition-Related Health",
  "Health Records & Follow-Up",
];

test("Health Plan has mandatory disclaimer exactly", () => {
  assert.equal(
    HEALTH_PLAN_DISCLAIMER,
    "This is a general livestock health planning guide. Always follow Namibian veterinary regulations, product labels, withdrawal periods, and consult a local veterinarian for diagnosis and treatment."
  );
});

test("Health Plan includes required topic list with non-empty cards", () => {
  const labels = HEALTH_PLAN_TOPICS.map((topic) => topic.label);
  assert.deepEqual(labels, REQUIRED_TOPIC_LABELS);

  for (const topic of HEALTH_PLAN_TOPICS) {
    assert.ok(topic.cards.length > 0, `${topic.label} must have cards`);
    for (const card of topic.cards) {
      assert.ok(card.title.length > 0);
      assert.ok(card.explanation.length > 20);
      assert.ok(card.watchFor.length > 0);
      assert.ok(card.recordInBreedLog.length > 0);
      assert.ok(card.suggestedActionLabel.length > 0);
      assert.ok(HEALTH_EVENT_TYPES.includes(card.suggestedEventType));
    }
  }
});

test("Daily observation topic includes healthy and sick indicators", () => {
  const topic = HEALTH_PLAN_TOPICS.find((t) => t.label === "Daily Animal Observation");
  assert.ok(topic);
  const text = JSON.stringify(topic).toLowerCase();
  assert.match(text, /active/);
  assert.match(text, /alert/);
  assert.match(text, /rough coat/);
  assert.match(text, /lameness/);
  assert.match(text, /diarrhoea/);
  assert.match(text, /nasal discharge/);
});

test("Guide includes required domain sections and condition references", () => {
  const allText = JSON.stringify(HEALTH_PLAN_TOPICS).toLowerCase();
  for (const phrase of [
    "proper husbandry",
    "disease control",
    "parasites",
    "bacteria",
    "viruses",
    "protozoa",
    "pulpy kidney",
    "pasteurellosis",
    "tetanus",
    "malignant oedema",
    "blackquarter",
    "botulism",
    "anthrax",
    "anaplasmosis",
    "sweating sickness",
    "warts",
    "orf",
    "lumpy skin disease",
    "pneumonia",
    "coccidiosis",
    "pink eye",
    "heartwater",
    "footrot",
    "mastitis",
    "abscess",
    "withdrawal",
    "follow-up",
  ]) {
    assert.match(allText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Guide content avoids dosage instructions and copied media references", () => {
  const allText = JSON.stringify(HEALTH_PLAN_TOPICS).toLowerCase();
  assert.doesNotMatch(allText, /give\s+\d+(\.\d+)?\s*(ml|mg)/);
  assert.doesNotMatch(allText, /http.*\.(png|jpg|jpeg|gif|pdf)/);
  assert.doesNotMatch(allText, /<img|image:/);
});

test("Health event type and route options meet Phase 11 requirements", () => {
  assert.deepEqual(HEALTH_EVENT_TYPES, [
    "vaccination",
    "dosing_deworming",
    "external_parasite_treatment",
    "antibiotic_treatment",
    "vitamin_mineral_supplement",
    "injury_wound",
    "abscess",
    "footrot",
    "mastitis",
    "observation_symptom",
    "vet_visit",
  ]);

  assert.deepEqual(HEALTH_ROUTE_OPTIONS, ["oral", "subcutaneous", "intramuscular", "topical", "pour_on", "dip_spray", "other"]);
});

test("Health page wires Health Plan button, topic navigation, and record-action bridge", () => {
  const source = fs.readFileSync("client/src/pages/Health.tsx", "utf8");
  assert.match(source, /button-health-plan/);
  assert.match(source, /health-plan-topic-menu/);
  assert.match(source, /health-plan-topic-content/);
  assert.match(source, /openRecordWithType\(card\.suggestedEventType\)/);
  assert.match(source, /select-event-type/);
  assert.match(source, /input-next-followup-date/);
  assert.match(source, /input-withdrawal-notes/);
});
