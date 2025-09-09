import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Main library entry
    'src/index',
    // CLI entry
    {
      input: 'src/cli/index',
      name: 'cli',
      builder: 'rollup',
    },
  ],

  // Output directory
  outDir: 'dist',

  // Clean output directory before build
  clean: true,

  // Declaration files - now enabled after removing TypeScript compilation dependency
  declaration: true,

  // Source maps
  sourcemap: true,

  // Rollup options - ESM only approach
  rollup: {
    emitCJS: false, // ESM only - no CommonJS compatibility layer
    inlineDependencies: false,
    esbuild: {
      target: 'node22',
      minify: false,
      format: 'esm',
    },
    output: {
      exports: 'named',
    },
  },

  // External dependencies (not bundled)
  externals: ['zod', 'commander', 'chalk', 'ora', 'consola', 'fast-glob'],

  // Replace values
  replace: {
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
  },

  // Fail on warning
  failOnWarn: false,
});
