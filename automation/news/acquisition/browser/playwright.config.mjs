import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'evidence.spec.mjs', timeout: 45000,
  fullyParallel: true, workers: 3,
  reporter: [['list']],
  use: {baseURL: 'http://127.0.0.1:4173', headless: true},
  projects: [
    {name:'mobile', use:{viewport:{width:375,height:812}}},
    {name:'phone390', use:{viewport:{width:390,height:844}}},
    {name:'phone393', use:{viewport:{width:393,height:852}}},
    {name:'tablet', use:{viewport:{width:768,height:1024}}},
    {name:'desktop', use:{viewport:{width:1440,height:900}}}
  ],
  webServer: {command:'node server.mjs', url:'http://127.0.0.1:4173/uk_renewables_pipeline/202611161630/', reuseExistingServer:false}
});
