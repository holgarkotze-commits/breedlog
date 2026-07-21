import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("settings exports use the native desktop save bridge before browser download fallback", () => {
  const source = readFileSync("client/src/pages/Settings.tsx", "utf8");
  assert.match(source, /saveFileInNativeDownloads/);
  assert.match(source, /const nativePath = await saveFileInNativeDownloads\(content, filename, type\);/);
  assert.match(source, /if \(nativePath\) \{/);
});

test("native save bridge invokes the Tauri export command", () => {
  const source = readFileSync("client/src/lib/native-file-save.ts", "utf8");
  assert.match(source, /invoke<string>\("save_export_file"/);
  assert.match(source, /detectRuntimePlatform\(\) === "windows"/);
});

test("desktop shell registers the native export command", () => {
  const source = readFileSync("src-tauri/src/lib.rs", "utf8");
  assert.match(source, /#\[tauri::command\]\s*fn save_export_file/);
  assert.match(source, /generate_handler!\[save_export_file\]/);
  assert.match(source, /download_dir\(\)/);
});
