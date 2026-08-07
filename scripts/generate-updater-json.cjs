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
    if (file.includes('aarch64') && (file.includes('tar.gz') || file.includes('app') || file.includes('dmg'))) {
      platform = 'darwin-aarch64';
    } else if ((file.includes('x64') || file.includes('x86_64')) && (file.includes('tar.gz') || file.includes('app') || file.includes('dmg'))) {
      platform = 'darwin-x86_64';
    } else if (file.includes('amd64') && (file.includes('AppImage') || file.includes('deb') || file.includes('tar.gz'))) {
      platform = 'linux-x86_64';
    } else if ((file.includes('x64') || file.includes('x86_64')) && file.includes('zip')) {
      platform = 'windows-x86_64';
    }

    if (platform) {
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
