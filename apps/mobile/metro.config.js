// Metro config for the YouMart Expo app inside the pnpm monorepo.
// It lets Metro find + transpile the workspace package @youmart/shared-client (TS source).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so Metro sees changes in workspace packages (e.g. shared-client).
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the workspace root (pnpm's shared store).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. pnpm links workspace packages + the virtual store via symlinks: follow them. Keep Metro's
//    hierarchical lookup ENABLED (unlike npm/yarn hoisted monorepos) so it finds each package's
//    co-located deps inside pnpm's `.pnpm/<pkg>/node_modules` store.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
