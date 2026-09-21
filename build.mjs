import {build} from 'esbuild';
import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist');
await cp('public','dist',{recursive:true});
await build({entryPoints:['src/background.ts','src/content.ts','src/popup.ts'],outdir:'dist',bundle:true,target:'chrome120',format:'iife'});
