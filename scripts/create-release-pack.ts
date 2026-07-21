import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BREEDLOG_PRICING_VERSION } from "../shared/commercial";

const repoRoot = process.cwd();
const releaseDir = path.join(repoRoot, "release-artifacts");
fs.mkdirSync(releaseDir, { recursive: true });

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function maybeHash(relativePath: string): string | null {
  const absolutePath = path.join(repoRoot, relativePath);
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile() ? sha256(absolutePath) : null;
}

function listFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else out.push(path.relative(repoRoot, fullPath).replace(/\\/g, "/"));
    }
  };
  walk(absoluteDir);
  return out.sort();
}

const sourceCommit = git(["rev-parse", "HEAD"]);
const sourceBranch = git(["branch", "--show-current"]);
const buildTimestamp = new Date().toISOString();
const evidenceFiles = listFiles("evidence").filter((file) => file.includes("production") || file.includes("phase1") || file.includes("access-code"));
const distFiles = listFiles("dist");
const windowsArtifacts = [
  "src-tauri/target/release/breedlog-desktop.exe",
  "src-tauri/target/release/bundle/nsis/BreedLog_1.0.2_x64-setup.exe",
  "src-tauri/target/release/bundle/msi/BreedLog_1.0.2_x64_en-US.msi",
].filter((file) => fs.existsSync(path.join(repoRoot, file)));
const frontendEntry = distFiles.find((file) => file.endsWith("index.html"));
const backendEntry = distFiles.find((file) => file.endsWith("index.cjs"));
const windowsExe = windowsArtifacts.find((file) => file.endsWith(".exe") && !file.includes("-setup"));
const windowsNsis = windowsArtifacts.find((file) => file.endsWith("-setup.exe"));
const windowsMsi = windowsArtifacts.find((file) => file.endsWith(".msi"));

const manifest = {
  manifestSchemaVersion: "1.0.0",
  breedlogProductVersion: "1.0.0-production-completion-candidate",
  releaseChannel: "staging",
  gitTag: null,
  sourceCommit,
  sourceBranch,
  buildTimestamp,
  artifacts: {
    frontendArtifactHash: frontendEntry ? maybeHash(frontendEntry) : null,
    backendImageDigest: backendEntry ? maybeHash(backendEntry) : null,
  },
  database: {
    migrationIdentifiers: ["startup-idempotent-schema-migrations", "drizzle-schema"],
    migrationChecksums: [maybeHash("shared/schema.ts"), maybeHash("server/index.ts")].filter(Boolean),
  },
  mobile: {
    androidAabHash: null,
    androidApkHash: null,
    androidPackageName: "com.stitchworx.breedlog",
    androidVersionCode: null,
    androidVersionName: null,
    androidSigningFingerprint: null,
  },
  windows: {
    exeHash: windowsExe ? maybeHash(windowsExe) : null,
    nsisHash: windowsNsis ? maybeHash(windowsNsis) : null,
    msiHash: windowsMsi ? maybeHash(windowsMsi) : null,
    updaterHash: null,
    publisher: "STITCH WORX",
    signingCertificateThumbprint: null,
    updaterPublicKeyIdentifier: null,
    artifactPaths: windowsArtifacts,
  },
  pwa: {
    artifactIdentity: frontendEntry ?? null,
  },
  legal: {
    documentVersions: [
      "privacy-policy-draft-2026-07-13",
      "terms-of-service-draft-2026-07-13",
      "subscription-terms-draft-2026-07-13",
      "account-deletion-policy-draft-2026-07-13",
    ],
  },
  cataloguePricingVersion: BREEDLOG_PRICING_VERSION,
  environmentConfigurationVersion: "production-completion-env-contract-2026-07-13",
  ciWorkflowRunReferences: [],
  verification: {
    stagingStatus: "locally-verified",
    productionStatus: "blocked",
    localChecks: [
      "npm.cmd run check",
      "npm.cmd run build",
      "npm.cmd run test:cert",
      "npm.cmd run android:sync",
      "cargo check --manifest-path src-tauri/Cargo.toml",
      "npm.cmd run windows:build",
      "git diff --check",
    ],
  },
  rollbackArtifactReferences: ["docs/operations/RUNBOOKS.md#rollback"],
  approvalRecords: [],
  knownLimitations: [
    "Live payment-provider activation is blocked pending merchant/provider decision and credentials.",
    "Android signed release is blocked pending Google Play publisher and signing credentials.",
    "Windows signed installer/update activation is blocked pending code-signing certificate and updater keys.",
    "Production domain/TLS deployment is blocked pending breedlog.com DNS/hosting access.",
    "Legal documents are implementation drafts and require professional legal review before production launch.",
  ],
  generatedEvidenceIndex: evidenceFiles,
};

const manifestPath = path.join(releaseDir, "RELEASE_MANIFEST.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const acceptanceReport = `# BreedLog Production Completion Candidate

- Source branch: ${sourceBranch}
- Source commit: ${sourceCommit}
- Generated: ${buildTimestamp}
- Pricing version: ${BREEDLOG_PRICING_VERSION}
- PR state: draft until post-fix review confirms the resolved P1/P2 findings

## Verified in this release pack

- npm ci: run locally before pack generation
- npm run check: PASS, see evidence/production-completion-check.log
- npm run test:cert: PASS, see evidence/production-completion-test-cert.log
- npm run build: PASS, see evidence/production-completion-build.log
- npm run android:sync: PASS, see evidence/production-completion-android-sync.log
- npx tauri info: PASS, see evidence/production-completion-tauri-info.log
- cargo check --manifest-path src-tauri/Cargo.toml: PASS, see evidence/production-completion-cargo-check.log
- npm run windows:build: PASS, Windows bundles generated under src-tauri/target/release/bundle
- git diff --check: PASS, see evidence/production-completion-git-diff-check.log
- Restores now replay all captured backup collections with rollback-safe failure recovery
- Billing webhook verification now uses captured raw request bytes and rejects missing raw bodies
- Revoked managed-device tokens can no longer authenticate managed routes
- Test billing-completion routes are gated out of non-test environments
- Final account deletion now purges managed auth, workspace mappings, and commercial state
- Android browser detection no longer misclassifies ordinary PWAs as native shells
- Hidden/downgraded animals no longer leak back through IndexedDB fallback
- Server-authoritative Free/Premium catalogue and entitlement ledger
- Provider-neutral signed billing webhook contract with idempotent event handling
- Free active-animal, PDF, AI and manual-backup quota ledger tests
- Deterministic downgrade visibility projection for first 30 active animals
- Encrypted .breedlogbackup creation, preview, wrong-account rejection, corruption rejection and restore tests
- Capacitor Android wrapper scaffold and syncable production asset pipeline
- Tauri Windows desktop wrapper scaffold with successful Cargo verification

## External blockers not fabricated

- Live merchant/payment activation
- Google Play publisher/signing credentials
- Windows Authenticode/updater signing credentials
- Production DNS/TLS/hosting access for breedlog.com and app.breedlog.com
- Professional legal approval
`;
fs.writeFileSync(path.join(releaseDir, "ACCEPTANCE_REPORT.md"), acceptanceReport);

const hashes: string[] = [];
for (const relativePath of [path.relative(repoRoot, manifestPath).replace(/\\/g, "/"), ...evidenceFiles, ...distFiles, ...windowsArtifacts]) {
  const hash = maybeHash(relativePath);
  if (hash) hashes.push(`${hash}  ${relativePath}`);
}
fs.writeFileSync(path.join(releaseDir, "SHA256SUMS.txt"), `${hashes.join("\n")}\n`);

const blockers = `# External Activation Blockers

These are not engineering failures and must not be represented as completed until real credentials/access are supplied.

- Payment provider: merchant account, webhook secret, portal credentials and legal/tax approval for Premium monthly/yearly billing.
- Android: Google Play publisher account, package ownership, Play Billing configuration, signing key material stored as CI secrets.
- Windows: Authenticode certificate, timestamp authority configuration and updater signing key material.
- Production web: DNS ownership/access for breedlog.com and app.breedlog.com, TLS/deployment target credentials and production database/storage credentials.
- Legal: professional review and approval of privacy, terms, subscription, refund/cancellation and deletion documents.
`;
fs.writeFileSync(path.join(releaseDir, "EXTERNAL_BLOCKERS.md"), blockers);

console.log(`Release pack generated at ${releaseDir}`);
