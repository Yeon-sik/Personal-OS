// Keep app-specific Android sources outside the ignored Tauri gen directory.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
if (process.argv.includes("--android") || process.env.TAURI_ENV_PLATFORM === "android") {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const android = join(root, "src-tauri/gen/android/app/src/main");
  const manifestPath = join(android, "AndroidManifest.xml");
  if (!existsSync(manifestPath)) throw new Error("Run tauri android init before building Android.");
  const target = join(android, "java/com/yeonsik/note");
  mkdirSync(target, { recursive: true });
  copyFileSync(join(root, "src-tauri/android/DeadlineAlarmPlugin.kt"), join(target, "DeadlineAlarmPlugin.kt"));
  let manifest = readFileSync(manifestPath, "utf8");
  if (!manifest.includes("android.permission.SCHEDULE_EXACT_ALARM")) {
    manifest = manifest.replace(/(<manifest\b[^>]*>)/, '$1\n    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />');
    if (!manifest.includes("android.permission.SCHEDULE_EXACT_ALARM")) throw new Error("Android manifest could not be prepared.");
    writeFileSync(manifestPath, manifest);
  }
}
