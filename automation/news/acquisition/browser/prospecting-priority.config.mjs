import {defineConfig} from '@playwright/test';
import {getTestPort} from './server.mjs';
const baseURL=`http://127.0.0.1:${getTestPort()}`;
export default defineConfig({
  testDir:'.',testMatch:'prospecting-priority.spec.mjs',timeout:45000,
  outputDir:'test-results/prospecting-priority',
  fullyParallel:true,workers:3,reporter:[['list']],
  use:{baseURL,headless:true,channel:process.env.BROWSER_CHANNEL||undefined},
  projects:[{name:'mobile',use:{viewport:{width:375,height:812}}},{name:'tablet',use:{viewport:{width:768,height:1024}}},{name:'desktop',use:{viewport:{width:1440,height:900}}}],
  webServer:{command:'node server.mjs',url:`${baseURL}/uk_renewables_pipeline/202611161747/`,reuseExistingServer:false}
});
