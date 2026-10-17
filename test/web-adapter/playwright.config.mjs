import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'*.spec.mjs',workers:1,timeout:30000,
  use:{baseURL:'http://127.0.0.1:4186',trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
  webServer:{command:'node scripts/serve-examples.mjs',cwd:new URL('../../',import.meta.url).pathname,url:'http://127.0.0.1:4186/examples/portable-ui/',env:{HAIYUE_EXAMPLES_PORT:'4186'},reuseExistingServer:false},
  outputDir:new URL('../../.artifacts/web-adapter-tests',import.meta.url).pathname,reporter:[['list'],['json',{outputFile:new URL('../../.artifacts/web-adapter-results.json',import.meta.url).pathname}]],
});
