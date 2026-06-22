const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo so Metro picks up changes in shared packages
config.watchFolders = [monorepoRoot];

// Tell Metro to resolve packages from both mobile/node_modules AND root node_modules
// This fixes "required package X cannot be found" errors with npm workspaces hoisting
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativeWind(config, { input: './global.css' });
