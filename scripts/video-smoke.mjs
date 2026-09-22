import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const profile=await mkdtemp(resolve(tmpdir(),'scrollpatrol-video-'));
const extension=resolve('dist');
const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
 await worker.evaluate(()=>{globalThis.fetch=async(_url,init)=>{
  const {state,questions}=JSON.parse(init.body);const match=state.post.author?.name==='target';
  return new Response(JSON.stringify({answers:Object.fromEntries(Object.keys(questions).map(k=>[k,{type:'noul',noul:match?.99:.01}]))}));
 };});
 const popup=await ctx.newPage();await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
 await popup.locator('#key').fill('test-only-key');await popup.getByRole('button',{name:'Save & test',exact:true}).click();await popup.getByText(/Connected to TypeSafe|Connection verified/).waitFor();
 await popup.locator('#rule').fill('Posts from target');await popup.getByRole('button',{name:'+ Add mute rule',exact:true}).click();
 const fixtures=[
  {site:'youtube',url:'https://www.youtube.com/shorts/test',card:'<ytd-reel-video-renderer id="card"><video src="/one.mp4"></video><span class="ytReelChannelBarViewModelChannelName"><a id="owner">target</a></span><h1 class="ytShortsVideoTitleViewModelShortsVideoTitle">Neutral caption</h1></ytd-reel-video-renderer>'},
  {site:'tiktok',url:'https://www.tiktok.com/',card:'<article id="card" data-e2e="recommend-list-item-container"><video src="/one.mp4"></video><a id="owner" data-e2e="video-author-avatar" href="/@target">target</a><div data-e2e="video-desc">Neutral caption</div></article>'},
  {site:'instagram',url:'https://www.instagram.com/reels/test/',card:'<section id="card"><div><video src="/one.mp4"></video></div><a id="owner" href="/target/reels/">target</a><div role="button">Neutral caption</div></section>'}
 ];
 for(const f of fixtures){
  const page=await ctx.newPage();await page.route(new URL(f.url).origin+'/**',r=>r.request().resourceType()==='document'?r.fulfill({contentType:'text/html',body:`<style>#card{display:block;position:relative;height:450px;width:300px}video{width:100%;height:300px}</style>${f.card}`}):r.abort());
  await page.goto(f.url);await page.getByRole('button',{name:'Show video'}).waitFor();
  assert.equal(await page.locator('video').evaluate(v=>v.paused&&v.muted),true);
  assert.equal(await page.locator('#card').evaluate(e=>e.getBoundingClientRect().height),450);
  assert.equal(await page.locator('#owner').isVisible(),false);
  // A site attempting to resume a muted video is stopped again.
  await page.locator('video').evaluate(v=>{v.muted=false;v.dispatchEvent(new Event('play'));});
  assert.equal(await page.locator('video').evaluate(v=>v.muted),true);
  await page.getByRole('button',{name:'Show video'}).click();await page.locator('#owner').waitFor({state:'visible'});
  assert.equal(await page.locator('video').evaluate(v=>v.muted),false);
  // Toggling the site rechecks existing cards and clears a prior reveal.
  await popup.locator('#'+f.site).uncheck();await popup.locator('#'+f.site).check();
  await page.getByRole('button',{name:'Show video'}).waitFor();
  // Recycled cards must not retain an earlier mute decision.
  await page.locator('#owner').evaluate((e,site)=>{e.textContent='other';e.setAttribute('href',site==='tiktok'?'/@other':'/other/reels/');},f.site);
  await page.locator('#owner').waitFor({state:'visible'});assert.equal(await page.getByRole('button',{name:'Show video'}).count(),0);
  await page.evaluate(site=>{const card=document.querySelector('#card').cloneNode(true);card.id='new';const owner=card.querySelector('#owner');owner.textContent='target';owner.setAttribute('href',site==='tiktok'?'/@target':'/target/reels/');document.body.append(card);},f.site);
  await page.getByRole('button',{name:'Show video'}).waitFor();
  // SPA route changes restore covered players outside the supported surface.
  await page.evaluate(()=>history.pushState({},'', '/messages'));
  await page.getByRole('button',{name:'Show video'}).waitFor({state:'detached'});
  await page.evaluate(url=>history.pushState({},'',url),f.url);
  await page.getByRole('button',{name:'Show video'}).waitFor();
  await page.close();
 }
 console.log('Video smoke passed: all three platforms, cover/reveal, audio guard, site toggles, recycled cards, infinite scroll, and SPA route cleanup.');
}finally{await ctx.close();await rm(profile,{recursive:true,force:true});}
