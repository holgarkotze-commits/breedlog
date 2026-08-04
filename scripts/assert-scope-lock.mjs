#!/usr/bin/env node
// assert-scope-lock.mjs
// Fails with exit 1 when any changed file (tracked or untracked) is not in the
// comma-separated SCOPE_ALLOWED_FILES allowlist.
//
// Usage:
//   SCOPE_ALLOWED_FILES="path/a.ts,tests/a.test.ts" node scripts/assert-scope-lock.mjs
//
// No external dependencies.

import { execSync } from 'node:child_process';
import path from 'node:path';

const raw = process.env.SCOPE_ALLOWED_FILES ?? '';
if (!raw.trim()) {
  console.error('[scope-lock] SCOPE_ALLOWED_FILES is not set or empty. Refusing to run.');
  process.exit(1);
}

const allowed = new Set(
  raw.split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => path.normalize(p))
);

// git status --porcelain lists both tracked changes and untracked files.
let output;
try {
  output = execSync('git status --porcelain', { encoding: 'utf8' });
} catch (err) {
  console.error('[scope-lock] Failed to run git status:', err.message);
  process.exit(1);
}

const changed = output
  .split('\n')
  .filter(line => line.trim())
  .flatMap(line => {
    // Format: "XY path" or "XY old -> new" (for renames)
    const entry = line.slice(3).trim();
    // Rename: "old -> new" — take the destination (new) path
    const raw = entry.indexOf(' -> ') > -1 ? entry.slice(entry.indexOf(' -> ') + 4) : entry;
    // Strip trailing slash — git shows untracked directories as "dir/"
    const stripped = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    return [path.normalize(stripped)];
  });

if (changed.length === 0) {
  console.log('[scope-lock] Working tree is clean. Nothing to check.');
  process.exit(0);
}

// When git reports an entire untracked directory (e.g. ".githooks"), check
// whether every file the caller intends to add lives inside that directory.
// If so, treat the directory entry as allowed.
const unexpected = changed.filter(p => {
  if (allowed.has(p)) return false;
  // Allow a directory entry when at least one allowed path is inside it
  const dirPrefix = p + path.sep;
  const dirPrefixFwd = p + '/';
  const coveredByAllowed = [...allowed].some(
    a => a.startsWith(dirPrefix) || a.startsWith(dirPrefixFwd)
  );
  return !coveredByAllowed;
});

if (unexpected.length > 0) {
  console.error('[scope-lock] FAIL — unexpected file(s) outside allowlist:');
  unexpected.forEach(p => console.error(`  ${p}`));
  console.error('\nAllowed files:');
  [...allowed].forEach(p => console.error(`  ${p}`));
  process.exit(1);
}

console.log(`[scope-lock] OK — all ${changed.length} changed file(s) are within the allowlist.`);
process.exit(0);
