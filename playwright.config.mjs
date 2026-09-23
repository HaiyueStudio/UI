import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', testMatch: '*.spec.mjs', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4175', browserName: 'chromium' },
  webServer: { command: 'node scripts/serve-examples.mjs', url: 'http://127.0.0.1:4175/test/browser/expandable.html', env: { HAIYUE_EXAMPLES_PORT: '4175' }, reuseExistingServer: false },
  outputDir: '.artifacts/browser-tests', reporter: [['list']],
});
