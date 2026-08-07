const fs = require('fs');
const path = require('path');

const version = process.env.RELEASE_VERSION;
if (!version) {
  console.error('RELEASE_VERSION environment variable is required.');
  process.exit(1);
}

const artifactsDir = path.join(__dirname, '../artifacts');
if (!fs.existsSync(artifactsDir)) {
  console.error('Artifacts directory does not exist:', artifactsDir);
  process.exit(1);
}

console.log(`Generating updater.json for version v${version}...`);

const updater = {
  version: version,
  notes: `Changelog for v${version} is available on GitHub.`,
  pub_date: new Date().toISOString(),
  platforms: {}
};

const repo = 'Aninda7479/TinyTools';
const files = fs.readdirSync(artifactsDir);

for (const file of files) {
  if (file.endsWith('.sig')) {
    const targetFile = file.slice(0, -4); // Remove .sig
    if (!files.includes(targetFile)) {
      console.warn(`Signature file found but target file does not exist: ${file} -> ${targetFile}`);
      continue;
    }

    const sigContent = fs.readFileSync(path.join(artifactsDir, file), 'utf8').trim();
    const url = `https://github.com/${repo}/releases/download/v${version}/${targetFile}`;

    let platform = '';
    const lowerFile = file.toLowerCase();

    // 1. macOS Apple Silicon (built on macos-latest runner which is ARM64 by default)
    if (lowerFile.includes('aarch64') || lowerFile.includes('arm64') || (lowerFile.includes('tinytools.app.tar.gz') && !lowerFile.includes('x64') && !lowerFile.includes('x86_64'))) {
      platform = 'darwin-aarch64';
    } 
    // 2. macOS Intel x64
    else if ((lowerFile.includes('x64') || lowerFile.includes('x86_64')) && (lowerFile.includes('tar.gz') || lowerFile.includes('app') || lowerFile.includes('dmg')) && (lowerFile.includes('darwin') || lowerFile.includes('macos'))) {
      platform = 'darwin-x86_64';
    } 
    // 3. Windows x64 (matches .msi, .exe, or .zip installers)
    else if ((lowerFile.includes('x64') || lowerFile.includes('x86_64')) && (lowerFile.includes('zip') || lowerFile.includes('msi') || lowerFile.includes('exe'))) {
      platform = 'windows-x86_64';
    } 
    // 4. Linux x64 (matches .AppImage, .deb, or .tar.gz installers)
    else if ((lowerFile.includes('amd64') || lowerFile.includes('x86_64') || lowerFile.includes('x64')) && (lowerFile.includes('appimage') || lowerFile.includes('deb') || lowerFile.includes('tar.gz'))) {
      platform = 'linux-x86_64';
    }

    if (platform) {
      // Prioritize .msi over .exe for Windows updater, or just assign whatever matches
      // Tauri updater will use the matched platform url
      updater.platforms[platform] = {
        signature: sigContent,
        url: url
      };
      console.log(`Added platform ${platform} with installer ${targetFile}`);
    } else {
      console.warn(`Could not determine updater platform for file: ${file}`);
    }
  }
}

const outputPath = path.join(artifactsDir, 'updater.json');
fs.writeFileSync(outputPath, JSON.stringify(updater, null, 2) + '\n', 'utf8');
console.log('Successfully generated updater.json at:', outputPath);
