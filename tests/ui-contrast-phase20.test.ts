import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("client/src/index.css", "utf8");
const button = fs.readFileSync("client/src/components/ui/button.tsx", "utf8");
const layout = fs.readFileSync("client/src/components/Layout.tsx", "utf8");
const ask = fs.readFileSync("client/src/components/AskBreedLogButton.tsx", "utf8");
const ai = fs.readFileSync("client/src/components/BreedLogAssistantPanel.tsx", "utf8");
const animals = fs.readFileSync("client/src/pages/Animals.tsx", "utf8");

test("theme tokens keep yellow-primary foreground dark in dark mode", () => {
  const darkBlock = css.match(/\.dark\s*\{[\s\S]*?\}/);
  assert.ok(darkBlock, "missing dark block");
  assert.match(darkBlock![0], /--primary:\s*43 75% 60%/);
  assert.match(darkBlock![0], /--primary-foreground:\s*218 47% 10%/);
});

test("shared button variants enforce readable contrast classes", () => {
  assert.match(button, /default:[\s\S]*text-white/); // dark/blue button -> white text
  assert.match(button, /outline:[\s\S]*text-foreground/); // light/outline button -> dark text
  assert.match(button, /disabled:opacity-65/); // disabled remains visible enough
});

test("mobile active nav tabs and ask button use primary foreground", () => {
  assert.match(layout, /active[\s\S]*bg-primary text-primary-foreground/);
  assert.match(layout, /isMoreActive[\s\S]*bg-primary text-primary-foreground/);
  assert.match(ask, /text-primary-foreground/);
  assert.match(ask, /bg-primary/);
});

test("assistant send button and key action buttons rely on shared readable primary styles", () => {
  assert.match(ai, /bg-primary text-primary-foreground/);
  assert.match(animals, /bg-primary text-primary-foreground/);
  assert.match(animals, /variant=\"outline\"/);
});

test("herd sections default collapsed on first render", () => {
  assert.match(animals, /const \[totalHerdExpanded, setTotalHerdExpanded\] = useState\(false\)/);
  assert.match(animals, /const \[ramsExpanded, setRamsExpanded\] = useState\(false\)/);
  assert.match(animals, /const \[ewesExpanded, setEwesExpanded\] = useState\(false\)/);
  assert.match(animals, /const \[lambsExpanded, setLambsExpanded\] = useState\(false\)/);
  assert.match(animals, /const \[culledExpanded, setCulledExpanded\] = useState\(false\)/);
});
