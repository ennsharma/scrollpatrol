import type {Site} from './core';
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const captions=new WeakMap<HTMLVideoElement,{key:string;lines:string[]}>();
export function transcriptFor(el:HTMLElement,site:Site,identity:string):string {
  const video=el.querySelector('video');if(!video)return '';
  const key=identity+'|'+(video.currentSrc||video.getAttribute('src')||'');
  let record=captions.get(video);if(record?.key!==key){record={key,lines:[]};captions.set(video,record);}
  // Read loaded subtitle tracks without switching the user's subtitle selection.
  const tracks=Array.from(video.textTracks).filter(t=>['captions','subtitles'].includes(t.kind));
  const track=tracks.find(t=>t.mode==='showing')||tracks.find(t=>t.mode==='hidden')||tracks.find(t=>t.cues?.length);
  if(track?.cues?.length)return Array.from(track.cues).slice(0,500).map(c=>clean('getCueAsHTML' in c?(c as VTTCue).getCueAsHTML().textContent||'':'')).filter(Boolean).join(' ').slice(0,4000);
  // YouTube renders subtitles separately from native TextTracks. Other platforms
  // may burn subtitles into pixels; those are handled only by optional vision.
  const line=site==='youtube'?clean(Array.from(el.querySelectorAll('.ytp-caption-segment')).map(n=>n.textContent||'').join(' ')):'';
  if(line&&record!.lines.at(-1)!==line&&record!.lines.join(' ').length<4000)record!.lines.push(line);
  return record!.lines.join(' ').slice(0,4000);
}
export function visibleVideo(el:HTMLElement):HTMLVideoElement|null {
  if(document.visibilityState==='hidden')return null;
  return Array.from(el.querySelectorAll('video')).find(video=>{
    const rect=video.getBoundingClientRect();
    return video.readyState>=2&&video.videoWidth>0&&rect.width>0&&rect.height>0&&rect.top<innerHeight&&rect.bottom>0&&rect.left<innerWidth&&rect.right>0;
  })||null;
}
export function captureFrame(video:HTMLVideoElement):string {
  const scale=Math.min(1,384/Math.max(video.videoWidth,video.videoHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Video frame capture is unavailable.');
  try{ctx.drawImage(video,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.75).split(',')[1];}
  catch{throw new Error('This player blocks frame access. Captions and metadata filtering remain active.');}
}
export async function digest(value:string){const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(data),v=>v.toString(16).padStart(2,'0')).join('');}
