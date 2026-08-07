const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine bump type
const override = process.env.BUMP_OVERRIDE || 'auto';
let bumpType = 'patch';

if (override === 'auto') {
  let lastTag = '';
  try {
    // Get the most recent tag reachable from the current commit
    lastTag = execSync('git describe --tags --abbrev=0', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    console.log(`Last git tag found: "${lastTag}"`);
  } catch (e) {
    console.log('No prior git tag found. Will scan entire git log.');
  }

  let commitMsgs = '';
  try {
    const logCmd = lastTag ? `git log ${lastTag}..HEAD --pretty=%B` : `git log --pretty=%B`;
    commitMsgs = execSync(logCmd).toString().trim();
  } catch (e) {
    console.error('Failed to get git log:', e);
  }

  // Parse lines to find the highest priority bump type (major > minor > patch)
  const lines = commitMsgs.split('\n');
  let hasMajor = false;
  let hasMinor = false;
  let hasPatch = false;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('BREAKING CHANGE:') || line.startsWith('BREAKING CHANGES:')) {
      hasMajor = true;
    } else if (/^[a-zA-Z0-9_-]+(\([^)]+\))?!:/i.test(line)) {
      hasMajor = true;
    } else if (/^feat(\([^)]+\))?:/i.test(line)) {
      hasMinor = true;
    } else if (/^fix(\([^)]+\))?:/i.test(line)) {
      hasPatch = true;
    }
  }

  if (hasMajor) {
    bumpType = 'major';
  } else if (hasMinor) {
    bumpType = 'minor';
  } else if (hasPatch) {
    bumpType = 'patch';
  } else {
    console.log('No conventional commits found. Defaulting to patch.');
    bumpType = 'patch';
  }
} else if (['major', 'minor', 'patch'].includes(override.toLowerCase())) {
  bumpType = override.toLowerCase();
  console.log(`Using manual override bump type: ${bumpType}`);
} else {
  console.error(`Invalid BUMP_OVERRIDE value: "${override}". Must be "auto", "major", "minor", or "patch".`);
  process.exit(1);
}

// Read current version from package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;
console.log('Current version from package.json:', currentVersion);

const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Invalid current version format: "${currentVersion}"`);
  process.exit(1);
}

if (bumpType === 'major') {
  parts[0]++;
  parts[1] = 0;
  parts[2] = 0;
} else if (bumpType === 'minor') {
  parts[1]++;
  parts[2] = 0;
} else {
  parts[2]++;
}

const nextVersion = parts.join('.');
console.log(`Computed next version: ${nextVersion} (bump: ${bumpType})`);

// Output to GitHub Actions environment
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${nextVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag_name=v${nextVersion}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `bump_type=${bumpType}\n`);
}
