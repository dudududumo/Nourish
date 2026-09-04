import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: {
    '@': fileURLToPath(new URL('.', import.meta.url)),
    'next/navigation': fileURLToPath(new URL('./tests/ui/next-navigation.ts', import.meta.url)),
  } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/ui/setup.ts'],
    include: ['tests/ui/**/*.test.tsx'],
    restoreMocks: true,
  },
});
