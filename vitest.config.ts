/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/data/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    testTimeout: 20_000,
    environment: 'node',
  },
});
