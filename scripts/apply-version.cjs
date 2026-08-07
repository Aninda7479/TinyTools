const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nextVersion = process.argv[2];
if (!nextVersion) {
  console.error('Usage: node scripts/apply-version.cjs <next_version>');
  process.exit(1);
}

console.log(`Applying version ${nextVersion} to all project files...`);

// 1. Update package.json & package-lock.json via npm command
try {
  execSync(`npm version ${nextVersion} --no-git-tag-version --allow-same-version`, { stdio: 'inherit' });
  console.log('Successfully updated package.json and package-lock.json using npm version.');
} catch (e) {
  console.error('Failed to update package.json version via npm:', e);
  process.exit(1);
}

// 2. Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  try {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.version = nextVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
    console.log('Successfully updated src-tauri/tauri.conf.json');
  } catch (e) {
    console.error('Failed to update tauri.conf.json:', e);
    process.exit(1);
  }
}

// 3. Update Cargo.toml files
const cargoTomlPaths = [
  path.join(__dirname, '../Cargo.toml'),
  path.join(__dirname, '../src-tauri/Cargo.toml'),
  path.join(__dirname, '../crates/image-core/Cargo.toml'),
  path.join(__dirname, '../src-wasm/Cargo.toml')
];

function updateCargoToml(filePath, nextVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let inPackageSection = false;
  let inWorkspacePackageSection = false;
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('[')) {
      // Check if we entered [package] or [workspace.package]
      inPackageSection = (line === '[package]');
      inWorkspacePackageSection = (line === '[workspace.package]');
    } else if ((inPackageSection || inWorkspacePackageSection) && line.startsWith('version')) {
      // Replace only the version line within this section
      lines[i] = lines[i].replace(/version\s*=\s*"[^"]+"/, `version = "${nextVersion}"`);
      updated = true;
      break; // Exit loop after updating the package version
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Updated version in ${path.relative(path.join(__dirname, '..'), filePath)}`);
  } else {
    console.log(`Skipped (no version field under [package] or [workspace.package]): ${path.relative(path.join(__dirname, '..'), filePath)}`);
  }
}

for (const tomlPath of cargoTomlPaths) {
  if (fs.existsSync(tomlPath)) {
    updateCargoToml(tomlPath, nextVersion);
  } else {
    console.log(`File not found, skipping: ${path.relative(path.join(__dirname, '..'), tomlPath)}`);
  }
}

// 4. Regenerate Cargo.lock to match the new versions
try {
  console.log('Regenerating Cargo.lock...');
  execSync('cargo update --workspace', { stdio: 'inherit' });
  console.log('Successfully regenerated Cargo.lock.');
} catch (e) {
  console.error('Failed to regenerate Cargo.lock:', e);
  process.exit(1);
}

// 5. Ensure src-wasm/pkg/index.js exists (stub for bundler build resolution)
const wasmPkgDir = path.join(__dirname, '../src-wasm/pkg');
const wasmPkgIndex = path.join(wasmPkgDir, 'index.js');
try {
  if (!fs.existsSync(wasmPkgDir)) {
    fs.mkdirSync(wasmPkgDir, { recursive: true });
  }
  if (!fs.existsSync(wasmPkgIndex)) {
    const stubContent = `export function wasm_process_image() { throw new Error("WASM module not built"); }
export function wasm_remove_background() { throw new Error("WASM module not built"); }
export function wasm_strip_metadata() { throw new Error("WASM module not built"); }
export function wasm_redact_regions() { throw new Error("WASM module not built"); }
export function wasm_add_watermark() { throw new Error("WASM module not built"); }\n`;
    fs.writeFileSync(wasmPkgIndex, stubContent, 'utf8');
    console.log('Created WASM resolution stub at src-wasm/pkg/index.js');
  }
} catch (e) {
  console.error('Failed to create WASM stub:', e);
  process.exit(1);
}

