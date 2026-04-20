import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Vitest configuration — matches the Next.js `@/` path alias so test files
// can import from `@/lib/engine/...` the same way app code does. No jsdom
// environment: every test here is a Node-land unit test of pure functions,
// typed integrations, or utility modules. React component tests (if we add
// them later) can live under tests/ui/ with their own jsdom config.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    // Coverage intentionally off by default — slows the watch loop; enable
    // explicitly with `npm run test -- --coverage` when you want a report.
  },
});
