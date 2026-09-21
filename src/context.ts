import type {Site} from './core';
export interface PostContext {
  site?: Site;
  text: string;
  author?: {name: string; headline?: string; role: 'author' | 'submitter'};
  socialContext?: string;
  promoted?: boolean;
  community?: string;
  flair?: string;
  audio?: string;
  contentTypes?: string[];
  linkedArticles?: Array<{title: string; domain?: string}>;
}
const clean=(value:unknown,max:number)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
export function normalizePost(input:unknown):PostContext {
  if(typeof input==='string')return {text:clean(input,6000)};
  if(!input||typeof input!=='object')throw new Error('Invalid post context');
  const raw=input as Record<string,unknown>;
  const post:PostContext={text:clean(raw.text,6000)};
  if(['linkedin','reddit','hn','youtube','tiktok','instagram'].includes(String(raw.site)))post.site=raw.site as Site;
  if(raw.author&&typeof raw.author==='object'){
    const author=raw.author as Record<string,unknown>,name=clean(author.name,200),headline=clean(author.headline,400);
    if(name)post.author={name,role:author.role==='submitter'?'submitter':'author',...(headline?{headline}:{})};
  }
  for(const key of ['socialContext','community','flair','audio'] as const){const value=clean(raw[key],300);if(value)post[key]=value;}
  if(typeof raw.promoted==='boolean')post.promoted=raw.promoted;
  if(Array.isArray(raw.contentTypes))post.contentTypes=[...new Set(raw.contentTypes.filter(v=>['image','video','article','text'].includes(v)))];
  if(Array.isArray(raw.linkedArticles))post.linkedArticles=raw.linkedArticles.slice(0,3).filter(a=>a&&typeof a==='object').map(a=>({title:clean(a.title,300),domain:clean(a.domain,150)})).filter(a=>a.title||a.domain);
  return post;
}
