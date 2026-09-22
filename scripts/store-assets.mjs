import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const profile=await mkdtemp(resolve(tmpdir(),'scrollpatrol-store-'));
const extension=resolve('dist');
const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const page=await ctx.newPage();
 await page.setViewportSize({width:1280,height:800});
 await page.goto(`chrome-extension://${id}/popup.html`);
 await page.locator('#rule').fill('Startup fundraising announcements');
 await page.getByRole('button',{name:'+ Add mute rule',exact:true}).click();
 await page.locator('#rules li').waitFor();
 await page.addStyleTag({content:`html{background:#edece6}body{margin:24px 0 0 820px;box-shadow:0 8px 40px #172b2422} .store-copy{position:fixed;left:70px;top:150px;width:620px;color:#173c32;font-family:Arial,sans-serif}.store-copy h2{font-size:64px;line-height:1.05;letter-spacing:-3px;margin:0 0 28px}.store-copy p{font-size:24px;line-height:1.5}.store-copy small{font-size:15px;line-height:1.5;display:block;margin-top:34px}`});
 await page.evaluate(()=>{const aside=document.createElement('aside');aside.className='store-copy';aside.innerHTML='<h2>A little less<br>internet.</h2><p>Describe what you’re tired of seeing.<br>Scrollpatrol mutes matching feed posts.</p><p>Natural-language rules.<br>Reversible mutes. Your choice.</p><small>Open source · Bring your own TypeSafe API key<br>Provider usage billed separately</small>';document.body.append(aside);});
 await mkdir('store/assets',{recursive:true});
 await page.screenshot({path:'store/assets/screenshot-1280x800.png'});
 await page.setViewportSize({width:440,height:280});
 await page.evaluate(()=>{document.body.innerHTML='<img src="brand/scrollpatrol-wordmark.png" alt="Scrollpatrol"><p>A little less internet.</p>';document.head.querySelectorAll('style,link').forEach(e=>e.remove());});
 await page.addStyleTag({content:'html,body{margin:0;width:440px;height:280px;background:#edece6}body{display:flex;flex-direction:column;justify-content:center;align-items:center}img{width:365px;height:auto;mix-blend-mode:multiply}p{font:18px Arial;color:#173c32;letter-spacing:1px;margin-top:20px}'});
 await page.locator('img').evaluate(img=>img.decode());
 await page.screenshot({path:'store/assets/promo-440x280.png'});
}finally{await ctx.close();await rm(profile,{recursive:true,force:true});}
