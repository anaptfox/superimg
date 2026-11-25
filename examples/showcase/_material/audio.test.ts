import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { canonicalAudioEvents } from '../sandglass/model';
import { CLEFT_SOUND_CUES } from '../cleft/model';

describe('original material score clocks and portable source bytes',()=>{
  it('binds PCM bytes and sample counts to each audio manifest',async()=>{
    for(const [folder,name,duration] of [['sandglass','score',40],['cleft','hero',18],['cleft','sting',6],['cleft','loop',4],['returning-shore','score',24],['borrowed-shapes','score',30],['aster-basin','score',50],['aster-basin','tide-ledger',18]] as const){
      const path=new URL(`../${folder}/assets/${name}.wav`,import.meta.url);
      const bytes=await readFile(path),manifest=JSON.parse(await readFile(new URL(`../${folder}/assets/${name}.audio.json`,import.meta.url),'utf8'));
      expect(bytes.subarray(0,4).toString()).toBe('RIFF');expect(bytes.readUInt16LE(22)).toBe(2);expect(bytes.readUInt32LE(24)).toBe(48000);expect(bytes.readUInt16LE(34)).toBe(16);expect(bytes.readUInt32LE(40)).toBe(duration*48000*4);expect(manifest.sampleCount).toBe(duration*48000);expect(manifest.samplesPerFrame).toBe(1600);expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
    }
  });
  it('uses one cue for each real queue event, including subframe completion',async()=>{
    const manifest=JSON.parse(await readFile(new URL('../sandglass/assets/score.audio.json',import.meta.url),'utf8'));
    expect(manifest.cues).toHaveLength(288);expect(new Set(manifest.cues.map((c:{id:string})=>c.id)).size).toBe(288);
    for(const e of canonicalAudioEvents()){const cue=manifest.cues.find((c:{id:string})=>c.id===e.id);expect(cue.seconds).toBe(e.filmSeconds);expect(cue.sample).toBe(Math.round(e.filmSeconds*48000));}
    const last=manifest.cues.find((c:{id:string})=>c.id==='comparison/48/completion');expect(last.seconds).toBeCloseTo(27.64);expect(last.sample).toBe(1326720);
  });
  it('derives every Cleft cue from the canonical model table',async()=>{for(const [kind,rows] of Object.entries(CLEFT_SOUND_CUES)){const m=JSON.parse(await readFile(new URL(`../cleft/assets/${kind}.audio.json`,import.meta.url),'utf8'));expect(m.cues.map((c:{id:string;seconds:number;kind:string;duration:number})=>({at:c.seconds,kind:c.kind,duration:c.duration}))).toEqual(rows);}});
  it('has a quiet cyclic audio seam relative to normal sample movement',async()=>{
    const bytes=await readFile(new URL('../cleft/assets/loop.wav',import.meta.url));const count=(bytes.length-44)/4;
    const sample=(i:number)=>bytes.readInt16LE(44+i*4);let maximumStep=0;for(let i=1;i<count;i++)maximumStep=Math.max(maximumStep,Math.abs(sample(i)-sample(i-1)));
    expect(Math.abs(sample(0)-sample(count-1))).toBeLessThanOrEqual(maximumStep);expect(count).toBe(192000);
  });
});
