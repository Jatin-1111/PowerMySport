const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// mobile is not an npm workspace, so it has its own node_modules and resolves only from there.
// Watching the whole monorepo (every other app's node_modules too) ran Metro out of file handles
// (EMFILE), and a second copy of React from the root would break the app at runtime.
// Watch just the shared source the app imports.
config.watchFolders = [path.resolve(monorepoRoot, "packages/shared-types/src")];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

module.exports = withNativeWind(config, { input: "./global.css" });
