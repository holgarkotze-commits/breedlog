import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

const NATIVE_BUILD_TARGETS = new Set(["windows", "android"]);
const REQUIRED_PRODUCTION_APP_ORIGIN = "https://app.breedlog.com";

function assertNativeApiOriginContract() {
  const nativeTarget = process.env.BREEDLOG_NATIVE_BUILD_TARGET?.trim();
  if (!nativeTarget) {
    return;
  }
  if (!NATIVE_BUILD_TARGETS.has(nativeTarget)) {
    throw new Error(`Unsupported BREEDLOG_NATIVE_BUILD_TARGET: ${nativeTarget}`);
  }

  const configuredOrigin = process.env.VITE_BREEDLOG_API_ORIGIN?.trim();
  if (!configuredOrigin) {
    throw new Error(
      `Native ${nativeTarget} candidate builds must set VITE_BREEDLOG_API_ORIGIN to the authenticated BreedLog app origin.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredOrigin);
  } catch {
    throw new Error(`Invalid VITE_BREEDLOG_API_ORIGIN for native ${nativeTarget} build: ${configuredOrigin}`);
  }

  if (parsed.origin !== REQUIRED_PRODUCTION_APP_ORIGIN) {
    throw new Error(
      `Native ${nativeTarget} candidate builds must target ${REQUIRED_PRODUCTION_APP_ORIGIN}, received ${parsed.origin}.`,
    );
  }

  if (["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error(`Native ${nativeTarget} candidate builds must not target localhost.`);
  }
}

async function buildAll() {
  assertNativeApiOriginContract();
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
