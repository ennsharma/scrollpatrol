import {chromium,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const profile=await mkdtemp(resolve(tmpdir(),'scrollsafe-enrichment-'));
const extension=resolve('dist');
const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
 await worker.evaluate(()=>{
  globalThis.visionCalls=0;globalThis.frameSizes=[];globalThis.posts=[];globalThis.failVision=false;globalThis.visionDelay=0;
  globalThis.fetch=async(url,init)=>{
   const body=JSON.parse(init.body);
   if(String(url).includes('generativelanguage')){
    globalThis.visionCalls++;
    const frames=body.contents[0].parts.filter(p=>p.inlineData);
    if(frames.length<1||frames.length>2)throw new Error('Bad frame count');
    for(const frame of frames){
     if(frame.inlineData.mimeType!=='image/jpeg')throw new Error('Wrong frame type');
     const bytes=Uint8Array.from(atob(frame.inlineData.data),c=>c.charCodeAt(0));
     const img=await createImageBitmap(new Blob([bytes],{type:'image/jpeg'}));globalThis.frameSizes.push([img.width,img.height]);img.close();
    }
    if(globalThis.visionDelay)await new Promise(r=>setTimeout(r,globalThis.visionDelay));
    if(globalThis.failVision)return new Response('provider rejection',{status:403});
    return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({description:'A cook preparing a meal.',visibleText:'Recipe'})}]}}],usageMetadata:{promptTokenCount:900,candidatesTokenCount:50}}));
   }
   globalThis.posts.push(body.state.post);
   const match=!!body.state.post.transcript?.includes('cooking')||!!body.state.post.visual?.description?.includes('cook');
   return new Response(JSON.stringify({answers:Object.fromEntries(Object.keys(body.questions).map(k=>[k,{type:'noul',noul:k==='needsVisual'?(match?.01:.99):(match?.99:.01)}]))}));
  };
 });
 const popup=await ctx.newPage();await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
 await popup.locator('#key').fill('fake-jev-key');await popup.getByRole('button',{name:'Save & test',exact:true}).click();await popup.getByText(/Connected to TypeSafe|Connection verified/).waitFor();
 await popup.locator('#rule').fill('Hide cooking videos');await popup.getByRole('button',{name:'+ Add mute rule',exact:true}).click();
 const page=await ctx.newPage();await page.route('https://www.youtube.com/**',r=>{
  const id=new URL(r.request().url()).pathname.split('/').pop();
  return r.fulfill({contentType:'text/html',body:`<style>ytd-reel-video-renderer{display:block;width:240px;height:450px}video{width:240px;height:320px}</style><ytd-reel-video-renderer video-id="${id}"><video autoplay muted></video><span class="ytReelChannelBarViewModelChannelName"><a>neutral_creator</a></span><h1 class="ytShortsVideoTitleViewModelShortsVideoTitle">A moment from today</h1></ytd-reel-video-renderer><script>
  const canvas=document.createElement('canvas');canvas.width=480;canvas.height=640;const c=canvas.getContext('2d');
  function paint(){c.fillStyle='blue';c.fillRect(0,0,480,640);c.fillStyle='yellow';c.fillRect((Date.now()/30)%240,100,120,100);requestAnimationFrame(paint)}paint();
  const v=document.querySelector('video');if(location.pathname.endsWith('/cors'))v.src='https://media.example.test/sample.webm';else v.srcObject=canvas.captureStream(10);v.play().catch(()=>{});
  </script>`});
 });
 await page.goto('https://www.youtube.com/shorts/transcript');
 await page.evaluate(()=>{const t=document.querySelector('video').addTextTrack('captions','English','en');t.mode='hidden';t.addCue(new VTTCue(0,100,'Today we are cooking a meal.'));});
 await page.getByRole('button',{name:'Show video'}).waitFor();
 assert.equal(await worker.evaluate(()=>globalThis.visionCalls),0,'subtitles work without Gemini');
 const sent=await worker.evaluate(()=>globalThis.posts.some(p=>p.transcript?.includes('cooking')));assert.equal(sent,true);
 await popup.locator('#deeper-setup').evaluate(e=>e.open=true);
 await popup.locator('#gemini-key').fill('fake-gemini-key');await popup.locator('#test-vision').click();
 await popup.getByText(/Image connection verified/).waitFor();
 await popup.locator('#daily-budget').fill('0.002');await popup.locator('#daily-budget').dispatchEvent('change');
 await popup.locator('#deeper').check();
 await page.goto('https://www.youtube.com/shorts/frames');await page.bringToFront();
 await page.getByRole('button',{name:'Show video'}).waitFor();
 assert.equal(await worker.evaluate(()=>globalThis.visionCalls),2,'one setup test and one sampled-video analysis');
 assert.equal(await worker.evaluate(()=>globalThis.frameSizes.every(([w,h])=>w<=384&&h<=384)),true);
 const stored=await worker.evaluate(()=>chrome.storage.local.get(['visionUsage','visionCache']));
 assert.equal(stored.visionUsage.reservedUsd,.002);assert.equal(stored.visionCache.length,1);assert.equal(JSON.stringify(stored).includes('/9j/'),false,'frames are never stored');
 await page.reload();await page.getByRole('button',{name:'Show video'}).waitFor();
 assert.equal(await worker.evaluate(()=>globalThis.visionCalls),2,'cached video does not call Gemini again');
 await page.goto('https://www.youtube.com/shorts/budget');await page.bringToFront();
 await popup.getByText(/Daily visual-analysis allowance reached/).waitFor();
 assert.equal(await worker.evaluate(()=>globalThis.visionCalls),2,'exhausted allowance prevents a network call');
 assert.equal(await page.getByRole('button',{name:'Show video'}).count(),0,'budget exhaustion fails open');
 await popup.locator('#clear-vision-cache').click();
 assert.equal((await worker.evaluate(()=>chrome.storage.local.get('visionUsage'))).visionUsage.reservedUsd,.002,'cache clearing preserves budget');
 // A cross-origin player without CORS must fail open before a Gemini request.
 const webm=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,64,64);
  const stream=c.captureStream(10),rec=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
  const stopped=new Promise(resolve=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=resolve;});rec.start();
  for(let i=0;i<4;i++){x.fillRect(i,0,40,40);await new Promise(r=>setTimeout(r,100));}rec.stop();await stopped;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
 });
 await page.route('https://media.example.test/sample.webm',r=>r.fulfill({contentType:'video/webm',body:Buffer.from(webm)}));
 await popup.locator('#deeper').uncheck();await page.goto('https://www.youtube.com/shorts/cors');await page.bringToFront();
 await page.locator('video').evaluate(v=>new Promise(resolve=>{if(v.readyState>=2)resolve();else v.addEventListener('loadeddata',resolve,{once:true});}));
 await popup.locator('#daily-budget').fill('0.004');await popup.locator('#daily-budget').dispatchEvent('change');
 await popup.locator('#deeper').check();await page.bringToFront();
 await expect.poll(()=>worker.evaluate(async()=>{const tabs=await chrome.tabs.query({});const results=await Promise.all(tabs.map(t=>chrome.tabs.sendMessage(t.id,{type:'feedStatus'}).catch(()=>null)));return results.find(r=>r?.site==='youtube')?.visualStatus||'';}),{timeout:10000}).toContain('blocks frame access');
 assert.equal(await worker.evaluate(()=>globalThis.visionCalls),2,'blocked frames are never uploaded');
 // Turning the mode off while a paid request is in flight must not mute later.
 await worker.evaluate(()=>{globalThis.visionDelay=1500;});
 await page.goto('https://www.youtube.com/shorts/cancel');await page.bringToFront();
 await expect.poll(()=>worker.evaluate(()=>globalThis.visionCalls),{timeout:10000}).toBe(3);
 await popup.locator('#deeper').uncheck();await page.waitForTimeout(2000);
 assert.equal(await page.getByRole('button',{name:'Show video'}).count(),0,'in-flight result ignored after opt-out');
 await worker.evaluate(()=>{globalThis.failVision=true;globalThis.visionDelay=0;});
 await popup.locator('#test-vision').click();await popup.getByText(/Gemini rejected the key or model access/).waitFor();
 assert.equal((await worker.evaluate(()=>chrome.storage.local.get('visionUsage'))).visionUsage.reservedUsd,.004,'failed attempt still consumes allowance');
 await popup.locator('#deeper').uncheck();
 await page.goto('https://www.youtube.com/shorts/off');await page.bringToFront();
 await page.waitForTimeout(1500);assert.equal(await page.getByRole('button',{name:'Show video'}).count(),0);
 console.log('Enrichment smoke passed: native subtitles, real JPEG frame capture, provider setup, routing, persistent cache, budget limit, failed-call reservation, blocked cross-origin frames, in-flight cancellation, and opt-out.');
}finally{await ctx.close();await rm(profile,{recursive:true,force:true});}
