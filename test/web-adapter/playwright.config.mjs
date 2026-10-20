import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const artifacts=fileURLToPath(new URL('../../.artifacts/',import.meta.url));

export default defineConfig({
  testDir:'.',testMatch:'*.spec.mjs',workers:1,timeout:60000,
  use:{baseURL:'http://127.0.0.1:4186',trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],
  webServer:{command:'node scripts/serve-examples.mjs',cwd:root,url:'http://127.0.0.1:4186/examples/portable-ui/',env:{HAIYUE_EXAMPLES_PORT:'4186'},reuseExistingServer:false},
  outputDir:`${artifacts}web-adapter-tests`,reporter:[['list'],['json',{outputFile:`${artifacts}web-adapter-results.json`}]],
});
