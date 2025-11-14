import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  test: {
    pool: 'threads',
    projects: [
      {
        test: {
          name: '[unit] core',
          include: ['packages/core/tests/unit/**/*.{test,spec}.ts', 'packages/core/tests/**/*.unit.{test,spec}.ts'],
          css: true,
        },
      },
      {
        test: {
          name: '[browser] core',
          include: [
            'packages/core/tests/browser/**/*.{test,spec}.ts',
            'packages/core/tests/**/*.browser.{test,spec}.ts',
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              contextOptions: {
                extraHTTPHeaders: {
                  'Cross-Origin-Embedder-Policy': 'require-corp',
                  'Cross-Origin-Opener-Policy': 'same-origin',
                },
              },
            }) as never,

            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        test: {
          name: '[unit] react',
          include: ['packages/react/tests/unit/**/*.{test,spec}.ts', 'packages/react/tests/**/*.unit.{test,spec}.ts'],
          css: true,
        },
      },
      {
        test: {
          name: '[browser] react',
          include: [
            'packages/react/tests/browser/**/*.{test,spec}.ts',
            'packages/react/tests/**/*.browser.{test,spec}.ts',
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright() as never,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    reporters: [['verbose', { summary: true }]],
    coverage: {
      provider: 'v8',
    },
  },
});
