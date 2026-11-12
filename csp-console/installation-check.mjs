import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
const agreementVersion=readFileSync('src/products/csp/agreement.ts','utf8').match(/public-v1-sha256-[a-f0-9]{64}/)[0];
process.env.VITE_APP_PRODUCT='csp';process.env.VITE_APP_TENANT_IDS='10';
const server=await preview({configFile:'vite.config.csp.ts',preview:{host:'127.0.0.1',port:5187,strictPort:true}});
const browser=await chromium.launch({headless:true,channel:process.env.CSP_BROWSER_CHANNEL||undefined});
try {
 for(const width of [1440,375]) {
  const context=await browser.newContext({viewport:{width,height:950}}); const page=await context.newPage(); let step=0,version=0,initialized=false,completed=0;
  await page.route('**/console-api/**',async route=>{
   const path=new URL(route.request().url()).pathname.split('/').pop();
   let data;
   if(path==='session') data={csrf:'test',authenticated:true};
   else if(path==='setup') data={workflow:'SERVICE_ACTIVATION_V3',initialized:false,draftVersion:0,step:0,attempted:false,checks:[],enabledCapabilities:[],checkedAt:null,serviceVersion:'v3',environment:'test'};
   else if(path.startsWith('installation')) {
    if(path==='installation-advance'){step++;version++;}
    if(path==='installation-complete'){initialized=true;completed++;}
    data={initialized,draftVersion:version,step,agreed:step>0,attempted:false,agreementVersion,companyName:'测试权利主体',serviceVersion:'test',environment:'test',checkedAt:null,accounts:['SYSTEM_ADMIN','AUDIT_ADMIN'].map(role=>({role,valid:true}))};
   } else throw new Error('Unexpected endpoint '+path);
   await route.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:5187/csp/installation');
  await expect(page.getByRole('heading',{name:'安装初始化',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'同意并继续'})).toBeDisabled();
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'同意并继续'}).click();
  await page.getByRole('button',{name:'检测并继续'}).click();
  await expect(page.getByRole('list',{name:'两员核验结果'})).toContainText('审计管理员');
  await page.getByRole('button',{name:'核验并继续'}).click();
  await page.reload();await expect(page.getByRole('heading',{name:'确认初始化结果'})).toBeVisible();
  for (const [label, password] of [['系统管理员（admin）','fixture-admin-password'],['审计管理员（auditor）','fixture-auditor-password']]) {
   const group=page.getByRole('group',{name:label});
   await group.getByLabel('新密码',{exact:true}).fill(password);
   await group.getByLabel('确认新密码',{exact:true}).fill(password);
  }
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'确认并完成初始化'}).click();
  await expect(page.getByRole('heading',{name:'初始化成功，请重新登录'})).toBeVisible();
  if(completed!==1) throw new Error('Repeated completion');
  const axe=await new AxeBuilder({page}).analyze();if(axe.violations.length) throw new Error(JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))));
  await page.goto('http://127.0.0.1:5187/csp/setup');
  await expect(page.getByRole('heading',{name:'CSP 已完成初始化',exact:true})).toBeVisible();
  console.log('PASS installation '+width+' restore completion isolation axe0');await context.close();
 }
} finally {await browser.close();await server.httpServer.close();}
