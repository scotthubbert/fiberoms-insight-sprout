#!/usr/bin/env node

// Simple version bump script
import fs from 'fs';
import { execSync } from 'child_process';

const packageJsonPath = './package.json';

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Parse current version
const [major, minor, patch] = packageJson.version.split('.').map(Number);

// Determine bump type from command line argument
const bumpType = process.argv[2] || 'patch';

let newVersion;
switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version bumped from ${major}.${minor}.${patch} to ${newVersion}`);

// Optionally create a git tag
if (process.argv.includes('--tag')) {
  try {
    execSync(`git add package.json`);
    execSync(`git commit -m "Bump version to ${newVersion}"`);
    execSync(`git tag v${newVersion}`);
    console.log(`Created git tag v${newVersion}`);
  } catch (error) {
    console.error('Failed to create git tag:', error.message);
  }
}