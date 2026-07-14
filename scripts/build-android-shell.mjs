import { spawnSync } from "node:child_process";
import process from "node:process";

function run(command, args, options = {}) {
  const isWindowsScript =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: isWindowsScript,
    ...options,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "android:sync"]);

const gradleCommand = process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew";
run(gradleCommand, ["--no-daemon", ":app:assembleDebug"], {
  cwd: "android",
});
