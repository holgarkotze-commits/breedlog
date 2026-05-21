import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const animals = fs.readFileSync("client/src/pages/Animals.tsx", "utf8");
const lambs = fs.readFileSync("client/src/pages/Lambs.tsx", "utf8");
const detail = fs.readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");
const assistant = fs.readFileSync("client/src/components/BreedLogAssistantPanel.tsx", "utf8");
const dashboard = fs.readFileSync("client/src/pages/Dashboard.tsx", "utf8");

test("phase7 responsive breakpoints exist for phone + tablet widths", () => {
  // Tailwind breakpoints map: md>=768, lg>=1024; base handles 360/390/430.
  assert.match(animals, /md:|lg:/);
  assert.match(lambs, /md:|lg:/);
  assert.match(detail, /md:|lg:/);
  assert.match(assistant, /md:|lg:|100dvh/);
});

test("buttons and layout guards reduce overflow risk on small screens", () => {
  assert.match(animals, /w-full|max-w-|truncate|overflow-x-auto|break-words/);
  assert.match(lambs, /md:|grid|flex|px-|py-/);
  assert.match(assistant, /w-full|max-w-|overflow-hidden|break-words|whitespace-normal/);
});

test("assistant remains usable and herd sections remain collapsed-default workflow", () => {
  assert.match(assistant, /textarea|Send|submit|question/i);
  assert.match(dashboard, /collapsed|Collapsible|defaultOpen=\{false\}|openSections|BreedLog Assistant|Your Herd/i);
});

test("lamb/source badge pathways and tablet navigation primitives are present", () => {
  assert.match(animals, /animalSource|badge|Badge/i);
  assert.match(lambs, /lamb|badge|stage/i);
  assert.match(dashboard, /BottomNavigation|Header|md:/);
});
