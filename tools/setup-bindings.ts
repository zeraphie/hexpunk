// Install platform-appropriate native bindings for oxfmt + oxlint.
//
// Bun normally handles native-binary selection automatically; this script is
// the escape hatch for environments where auto-detection fails (notably
// some Windows setups, but also useful on niche Linux distros or first-time
// CI cache rebuilds).

import process from "node:process";

const { platform, arch } = process;

const PLATFORM_MATRIX: Record<string, Partial<Record<string, string>>> = {
  win32: {
    x64: "win32-x64-msvc",
    arm64: "win32-arm64-msvc",
  },
  darwin: {
    x64: "darwin-x64",
    arm64: "darwin-arm64",
  },
  linux: {
    x64: "linux-x64-gnu",
    arm64: "linux-arm64-gnu",
  },
};

const suffix = PLATFORM_MATRIX[platform]?.[arch];

if (!suffix) {
  console.error(`setup-bindings: unsupported platform ${platform}/${arch}`);
  console.error(
    "Supported: win32-x64, win32-arm64, darwin-x64, darwin-arm64, linux-x64, linux-arm64"
  );
  process.exit(1);
}

const packages = [`@oxlint/binding-${suffix}`, `@oxfmt/binding-${suffix}`];

console.log(`setup-bindings: installing for ${platform}/${arch}:`);
for (const pkg of packages) {
  console.log(`  - ${pkg}`);
}

const proc = Bun.spawnSync(["npm", "install", "--no-save", ...packages], {
  stdout: "inherit",
  stderr: "inherit",
});

if (proc.exitCode !== 0) {
  process.exit(proc.exitCode ?? 1);
}
