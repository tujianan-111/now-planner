import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

const mode = process.argv[2] === "release" ? "release" : "debug";
const isWindows = platform() === "win32";
const task = `assemble${mode === "release" ? "Release" : "Debug"}`;
const knownJdk = "C:\\Program Files\\Microsoft\\jdk-21.0.12.101-hotspot";
const javaHome = process.env.JAVA_HOME || (existsSync(knownJdk) ? knownJdk : "");
const env = javaHome
  ? { ...process.env, JAVA_HOME: javaHome, PATH: `${javaHome}\\bin;${process.env.PATH || ""}` }
  : process.env;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false, env, ...options });
  if (result.status !== 0) process.exit(result.status || 1);
}

run(process.execPath, ["node_modules/vite/bin/vite.js", "build"]);
run(process.execPath, ["node_modules/@capacitor/cli/bin/capacitor", "sync", "android"]);

if (isWindows) run("cmd.exe", ["/c", `gradlew.bat ${task}`], { cwd: "android" });
else run("./gradlew", [task], { cwd: "android" });

console.log(`${mode} APK build complete.`);
