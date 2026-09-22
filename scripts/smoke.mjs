import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const profile=await mkdtemp(resolve(tmpdir(),'scrollpatrol-'));
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
 await popup.getByText('Key entered. Click Save & test to connect.').waitFor();
 await popup.getByRole('button',{name:'Save & test',exact:true}).click();
 await popup.getByText(/Connected to TypeSafe|Connection verified/).waitFor();
 const page=await ctx.newPage();
 await page.route('https://news.ycombinator.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><table><tr class="athing" id="123"><td><span class="titleline">We raised a seed round</span></td></tr><tr><td class="subtext">12 comments</td></tr></table></body></html>'}));
 await page.goto('https://news.ycombinator.com/');
 await page.getByRole('button',{name:'Show post'}).waitFor();
 assert.equal(await page.locator('.athing').isVisible(),false);
 await popup.locator('#debug summary').click();
 await popup.locator('#hidden-posts a').waitFor();
 assert.equal(await popup.locator('#hidden-posts a').getAttribute('href'),'https://news.ycombinator.com/item?id=123');
 await page.getByRole('button',{name:'Show post'}).click();
 assert.equal(await page.locator('.athing').isVisible(),true);
 const linkedin=await ctx.newPage();
 await linkedin.route('https://www.linkedin.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><main>Network</main></body></html>'}));
 await linkedin.goto('https://www.linkedin.com/mynetwork/');
 await linkedin.evaluate(()=>{
   history.pushState({},'', '/feed/');
   document.querySelector('main').innerHTML='<div role="listitem" componentkey="update-card-focusabc"><h2>Feed post</h2><span data-testid="expandable-text-box">A technology startup raised a seed round</span><div componentkey="replaceableComment_123"><span data-testid="expandable-text-box">Comment about cooking</span></div></div>';
 });
 await linkedin.getByRole('button',{name:'Show post'}).waitFor();
 assert.equal(await linkedin.locator('[componentkey="update-card-focusabc"]').isVisible(),false);
 const reports=await worker.evaluate(async()=>Promise.all((await chrome.tabs.query({})).map(tab=>chrome.tabs.sendMessage(tab.id,{type:'feedStatus'}).catch(()=>null))));
 const report=reports.find(r=>r?.site==='linkedin');
 assert.equal(report.detected,1);assert.equal(report.readable,1);assert.equal(report.checked,1);assert.equal(report.muted,1);assert.equal(report.recent[0].score,.99);
 assert.equal(report.recent[0].text,'A technology startup raised a seed round');
 // Changing rules must re-evaluate cards already seen on the page.
 await popup.getByRole('button',{name:'Remove Startup fundraising announcements',exact:true}).click();
 await linkedin.locator('[componentkey="update-card-focusabc"]').waitFor({state:'visible'});
 await popup.locator('#rule').fill('All posts about technology and startups');
 await popup.getByRole('button',{name:'+ Add mute rule',exact:true}).click();
 await linkedin.locator('[componentkey="update-card-focusabc"]').waitFor({state:'hidden'});
 // Infinite-scroll additions are classified when they approach the viewport.
 await linkedin.evaluate(()=>{
   const spacer=document.createElement('div');spacer.style.height='3000px';document.body.append(spacer);
   const card=document.createElement('div');card.setAttribute('role','listitem');card.setAttribute('componentkey','update-card-focusnew');
   card.innerHTML='<span data-testid="expandable-text-box">A newly loaded technology startup post</span>';document.body.append(card);
 });
 await linkedin.locator('[componentkey="update-card-focusnew"]').scrollIntoViewIfNeeded();
 await linkedin.locator('[componentkey="update-card-focusnew"]').waitFor({state:'hidden'});
 // Author-only rules must reach the model, and metadata changes must invalidate a cached decision.
 await worker.evaluate(()=>{globalThis.fetch=async(_url,init)=>{
   const request=JSON.parse(init.body);
   if(!request.state.post||typeof request.state.post.text!=='string')throw new Error('Missing structured post');
   return new Response(JSON.stringify({answers:{r0:{type:'noul',noul:request.state.post.author?.name==='Arvind Jain'?.99:.01}}}),{status:200});
 };});
 await popup.getByRole('button',{name:'Remove All posts about technology and startups',exact:true}).click();
 await linkedin.evaluate(()=>{
   const card=document.querySelector('[componentkey="update-card-focusnew"]');
   const owner=document.createElement('button');owner.setAttribute('aria-label','Hide post by Arvind Jain');card.prepend(owner);
 });
 await popup.locator('#rule').fill('Hide posts from Arvind Jain');
 await popup.getByRole('button',{name:'+ Add mute rule',exact:true}).click();
 await linkedin.locator('[componentkey="update-card-focusnew"]').waitFor({state:'hidden'});
 await linkedin.evaluate(()=>document.querySelector('[componentkey="update-card-focusnew"] button').setAttribute('aria-label','Hide post by Someone Else'));
 await linkedin.locator('[componentkey="update-card-focusnew"]').waitFor({state:'visible'});
 await linkedin.close();
 await popup.locator('#enabled').uncheck();
 await page.locator('.athing').waitFor({state:'visible'});
 assert.equal(await page.locator('.athing').isVisible(),true);
 await popup.getByRole('button',{name:'Clear history',exact:true}).click();
 await popup.getByText('No muted posts recorded yet.').waitFor();
 await worker.evaluate(()=>{globalThis.fetch=async()=>new Response('{}',{status:401});});
 await popup.locator('#key').fill('rejected-test-key');
 await popup.getByRole('button',{name:'Save & test',exact:true}).click();
 await popup.getByText(/TypeSafe rejected this key/).waitFor();
 assert.equal(await popup.locator('#key').inputValue(),'rejected-test-key','Failed verification must preserve the draft');
 const feedback=await popup.locator('#connection-status').boundingBox();
 assert.ok(feedback&&feedback.y>=0&&feedback.y+feedback.height<=650,'Connection feedback must be in view');
 await worker.evaluate(()=>{globalThis.fetch=async()=>new Response('{}',{status:200});});
 await popup.getByRole('button',{name:'Save & test',exact:true}).click();
 await popup.getByText(/Invalid model response/).waitFor();
 await popup.evaluate(()=>{window.originalSet=chrome.storage.local.set;chrome.storage.local.set=async()=>{throw new Error('Storage unavailable');};});
 await popup.locator('#key').fill('storage-test-key');
 await popup.getByRole('button',{name:'Save & test',exact:true}).click();
 await popup.getByText(/Could not save or check the key/).waitFor();
 assert.equal(await popup.locator('#key').inputValue(),'storage-test-key');
 await popup.evaluate(()=>{chrome.storage.local.set=window.originalSet;chrome.runtime.sendMessage=async()=>{throw new Error('Worker unavailable');};});
 await popup.getByRole('button',{name:'Save & test',exact:true}).click();
 await popup.getByText(/Could not save or check the key/).waitFor();
 assert.equal(await popup.getByRole('button',{name:'Save & test',exact:true}).isEnabled(),true);
 console.log('Chromium smoke passed: popup, storage, classification messaging, collapse, reveal, pause.');
}finally{await ctx.close();await rm(profile,{recursive:true,force:true});}
