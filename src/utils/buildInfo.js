// Build information utility
// These values are injected at build time by Vite

export const buildInfo = {
  version: typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : '1.0.0',
  hash: typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : 'dev',
  branch: typeof __BUILD_BRANCH__ !== 'undefined' ? __BUILD_BRANCH__ : 'local',
  buildId: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '1.0.0-dev',
  buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
  buildDate: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toLocaleDateString(),
  environment: import.meta.env.MODE || 'development',
  isProduction: import.meta.env.PROD,
  isDevelopment: import.meta.env.DEV,
};

// Format build info for display
export function getFormattedBuildInfo() {
  return {
    fullVersion: buildInfo.buildId,
    shortVersion: `v${buildInfo.version}`,
    buildHash: buildInfo.hash,
    branch: buildInfo.branch,
    buildDate: buildInfo.buildDate,
    environment: buildInfo.environment,
    displayVersion: buildInfo.isProduction
      ? `v${buildInfo.version} (${buildInfo.hash})`
      : `v${buildInfo.version}-${buildInfo.branch} (${buildInfo.hash})`
  };
}

// Store build info in localStorage for version checking
export function storeBuildInfo() {
  localStorage.setItem('app-build-hash', buildInfo.hash);
  localStorage.setItem('app-build-version', buildInfo.version);
  localStorage.setItem('app-build-id', buildInfo.buildId);
  localStorage.setItem('app-build-time', buildInfo.buildTime);
}

// Get stored build info
export function getStoredBuildInfo() {
  return {
    hash: localStorage.getItem('app-build-hash') || 'unknown',
    version: localStorage.getItem('app-build-version') || 'unknown',
    buildId: localStorage.getItem('app-build-id') || 'unknown',
    buildTime: localStorage.getItem('app-build-time') || 'unknown'
  };
}

// Compare build versions
export function isNewerVersion(storedVersion, currentVersion) {
  // If versions are different, it's a new version
  return storedVersion !== currentVersion;
}