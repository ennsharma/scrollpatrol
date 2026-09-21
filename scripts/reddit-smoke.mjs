import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const profile=await mkdtemp(resolve(tmpdir(),'scrollsafe-reddit-'));
const extension=resolve('dist');
const ctx=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');
 await worker.evaluate(()=>{globalThis.fetch=async(_url,init)=>{
   const {state,questions}=JSON.parse(init.body),post=state.post;
   const rule=questions.r0.instructions.rule;
   const match=rule.includes('target_user')?post.author?.name==='target_user':rule.includes('target_sub')?post.community==='r/target_sub':rule.includes('ads')?post.promoted===true:true;
   return new Response(JSON.stringify({answers:{r0:{type:'noul',noul:match?.99:.01}}}));
 };});
 const popup=await ctx.newPage();
 await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
 await popup.locator('#key').fill('test-only-not-a-real-key');
 await popup.getByRole('button',{name:'Save & test',exact:true}).click();
 await popup.getByText(/Connected to TypeSafe|Connection verified/).waitFor();
 async function setRule(rule){
   const remove=popup.locator('#rules button');if(await remove.count())await remove.click();
   await popup.locator('#rule').fill(rule);await popup.getByRole('button',{name:'+ Add mute rule',exact:true}).click();
 }
 await setRule('Hide posts from u/target_user');
 const page=await ctx.newPage();
 await page.route('https://www.reddit.com/**',route=>route.fulfill({contentType:'text/html',body:`<html><body><style>shreddit-post,shreddit-ad-post{display:block;min-height:80px}</style>
 <shreddit-post id="author-match" author="target_user" subreddit-prefixed-name="r/general" post-title="A neutral title" permalink="/r/general/comments/a/title/"></shreddit-post>
 <shreddit-post id="sub-match" author="another_user" subreddit-prefixed-name="r/target_sub" post-title="Another neutral title" permalink="/r/target_sub/comments/b/title/"></shreddit-post>
 <shreddit-post id="mention" author="someone_else" subreddit-prefixed-name="r/general" post-title="I mentioned target_user and target_sub" permalink="/r/general/comments/c/title/"></shreddit-post>
 <shreddit-ad-post id="ad" author="brand" promoted post-title="A product" permalink="/user/brand/comments/d/title/"></shreddit-ad-post>
 </body></html>`}));
 await page.goto('https://www.reddit.com/');
 await page.locator('#author-match').waitFor({state:'hidden'});
 assert.equal(await page.locator('#mention').isVisible(),true);
 await setRule('Hide posts from r/target_sub');
 await page.locator('#sub-match').waitFor({state:'hidden'});
 await page.locator('#author-match').waitFor({state:'visible'});
 assert.equal(await page.locator('#mention').isVisible(),true);
 await page.evaluate(()=>{
   const post=document.createElement('shreddit-post');post.id='new-post';post.setAttribute('author','new_user');post.setAttribute('subreddit-prefixed-name','r/target_sub');post.setAttribute('post-title','An infinite-scroll addition');document.body.append(post);
 });
 await page.locator('#new-post').waitFor({state:'hidden'});
 await page.evaluate(()=>document.querySelector('#mention').setAttribute('subreddit-prefixed-name','r/target_sub'));
 await page.locator('#mention').waitFor({state:'hidden'});
 await setRule('Hide ads');
 await page.locator('#ad').waitFor({state:'hidden'});
 await page.locator('#sub-match').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Show post',exact:true}).click();
 await page.locator('#ad').waitFor({state:'visible'});
 const old=await ctx.newPage();
 await old.route('https://old.reddit.com/**',route=>route.fulfill({contentType:'text/html',body:'<div class="thing link" data-author="target_user" data-subreddit="general"><a class="title">A neutral title</a><a class="comments" href="/r/general/comments/e/title/">comments</a></div>'}));
 await setRule('Hide posts from u/target_user');
 await old.goto('https://old.reddit.com/');
 await old.locator('.thing.link').waitFor({state:'hidden'});
 console.log('Reddit smoke passed: username-only and subreddit-only rules, no false match from mentions, dynamic posts/metadata, ads, reveal, and old Reddit.');
}finally{await ctx.close();await rm(profile,{recursive:true,force:true});}
