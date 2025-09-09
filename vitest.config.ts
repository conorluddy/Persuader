import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist', 'build'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'coverage/**',
        'dist/**',
        'packages/*/test{,s}/**',
        '**/*.d.ts',
        'cypress/**',
        'test{,s}/**',
        'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
        '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
        '**/*{.,-}spec.{js,cjs,mjs,ts,tsx,jsx}',
        '**/__tests__/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 50,
          lines: 60,
          statements: 60,
        },
      },
    },

    // Global test setup
    globals: true,

    // TypeScript configuration
    typecheck: {
      tsconfig: './tsconfig.json',
    },

    // Reporter configuration
    reporter: ['verbose'],

    // Watch mode
    watch: false,

    // Timeout
    testTimeout: 30000,
    hookTimeout: 30000,
  },

  // Path resolution for imports
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@/types': new URL('./src/types', import.meta.url).pathname,
      '@/utils': new URL('./src/utils', import.meta.url).pathname,
    },
  },
});
