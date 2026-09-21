import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const profile=await mkdtemp(resolve(tmpdir(),'semantic-mute-'));
const extension=resolve('dist');
const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const popup=await ctx.newPage();
 await popup.setViewportSize({width:380,height:650});
 await popup.goto(`chrome-extension://${id}/popup.html`);
 await popup.locator('#rule').fill('Startup fundraising announcements');
 await popup.getByRole('button',{name:'+ Add mute rule'}).click();
 await popup.locator('#rules li').waitFor();
 assert.equal(await popup.locator('#rules li').count(),1);
 await popup.screenshot({path:'popup-preview.png',fullPage:true});
 // Seed the model boundary with a deterministic result while exercising real
 // extension messaging, trusted storage, DOM changes, and popup controls.
 await worker.evaluate(()=>{globalThis.fetch=async()=>new Response(JSON.stringify({answers:{r0:{type:'noul',noul:.99}}}),{status:200});});
 await popup.locator('#key').fill('test-only-not-a-real-key');
 await popup.getByRole('button',{name:'Save key',exact:true}).click();
 const page=await ctx.newPage();
 await page.route('https://news.ycombinator.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><table><tr class="athing"><td><span class="titleline">We raised a seed round</span></td></tr><tr><td class="subtext">12 comments</td></tr></table></body></html>'}));
 await page.goto('https://news.ycombinator.com/');
 await page.getByRole('button',{name:'Show post'}).waitFor();
 assert.equal(await page.locator('.athing').isVisible(),false);
 await page.getByRole('button',{name:'Show post'}).click();
 assert.equal(await page.locator('.athing').isVisible(),true);
 await popup.locator('#enabled').uncheck();
 await popup.waitForTimeout(500);
 assert.equal(await page.locator('.athing').isVisible(),true);
 console.log('Chromium smoke passed: popup, storage, classification messaging, collapse, reveal, pause.');
}finally{await ctx.close();await rm(profile,{recursive:true,force:true});}
