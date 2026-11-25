/** Offline-only original score synthesis. Never import this file into the gallery. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalAudioEvents } from '../sandglass/model';
import { FORMS_SOUND_CUES } from '../borrowed-shapes/model';
import { ATLAS_SOUND_CUES } from '../aster-basin/model';
import { CLEFT_SOUND_CUES } from '../cleft/model';

export const SAMPLE_RATE = 48_000;
export const SAMPLES_PER_FRAME = SAMPLE_RATE / 30;
export interface Cue { id: string; seconds: number; kind: string; pan?: number; frequency?: number; duration?: number; sustained?: boolean }
interface Score { id: string; duration: number; method: string; loop?: boolean; cues: Cue[]; envelope: (t:number)=>number }
const smooth=(p:number)=>{p=Math.max(0,Math.min(1,p));return p*p*(3-2*p);};
const window=(t:number,a:number,b:number)=>smooth((t-a)/.3)*(1-smooth((t-b)/.5));
const dome=(t:number,a:number,b:number)=>{const p=(t-a)/(b-a);return p>0&&p<1?Math.sin(Math.PI*p)**2:0;};
const SCORES: Score[] = [
  {id:'sandglass',duration:40,method:'discrete request event clicks and pebble settles',cues:canonicalAudioEvents().map(e=>({id:e.id,seconds:e.filmSeconds,kind:e.event,pan:e.systemId==='primary'?-.45:.45,frequency:e.event==='arrival'?1400:e.event==='start'?720:320})),envelope:()=>0},
  {id:'cleft',duration:18,method:'stone modal impact and bowed glass',cues:CLEFT_SOUND_CUES.hero.map((c,i)=>({id:c.kind,seconds:c.at,kind:c.kind,duration:c.duration,frequency:180+i*110})),envelope:t=>.28*dome(t,6,12)+.35*dome(t,12,15)},
  {id:'cleft-sting',duration:6,method:'stone modal impact and bowed glass',cues:CLEFT_SOUND_CUES.sting.map(c=>({id:c.kind,seconds:c.at,kind:c.kind,duration:c.duration,frequency:c.kind.includes('stone')?230:432})),envelope:t=>.3*dome(t,2.5,4.8)},
  {id:'cleft-loop',duration:4,loop:true,method:'periodic bowed glass with wrapped resonator tails',cues:CLEFT_SOUND_CUES.loop.map(c=>({id:c.kind,seconds:c.at,kind:c.kind,duration:c.duration,sustained:c.kind==='cyclic-bowed-glass',frequency:c.kind==='cyclic-bowed-glass'?480:240})),envelope:t=>.18+.07*Math.cos(2*Math.PI*t/4)},
  {id:'returning-shore',duration:24,method:'stick-slip bristle friction on plaster',cues:[],envelope:t=>.14*dome(t,0,2.5)+.34*window(t,8.5,11.5)+.10*dome(t,11.5,15.5)},
  {id:'borrowed-shapes',duration:30,method:'porcelain modal partials transforming into stone modes',cues:FORMS_SOUND_CUES.map(c=>({id:c.id,seconds:c.at,kind:c.material,frequency:c.material==='stone'?210:740})),envelope:t=>.24*dome(t,.5,3)+.22*dome(t,6,11)+.26*dome(t,14,19)+.22*dome(t,22,27)},
  {id:'aster-basin',duration:50,method:'low resonant filtered movement and modal buoy tones',cues:ATLAS_SOUND_CUES.filter(c=>c.kind==='modal-buoy').map(c=>({id:c.kind,seconds:c.at,kind:'buoy',frequency:440})),envelope:t=>ATLAS_SOUND_CUES.filter(c=>c.kind!=='modal-buoy').reduce((n,c)=>n+.13*dome(t,c.at,c.at+c.duration),0)},
];
function wav(left:Float32Array,right:Float32Array) {
  const buffer=Buffer.alloc(44+left.length*4);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(SAMPLE_RATE,24);buffer.writeUInt32LE(SAMPLE_RATE*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(left.length*4,40);
  let peak=0;for(let i=0;i<left.length;i++)peak=Math.max(peak,Math.abs(left[i]!),Math.abs(right[i]!));
  const gain=peak>.0001?.72/peak:1;let square=0;
  for(let i=0;i<left.length;i++){const l=Math.max(-1,Math.min(1,left[i]!*gain)),r=Math.max(-1,Math.min(1,right[i]!*gain));buffer.writeInt16LE(Math.round(l*32767),44+i*4);buffer.writeInt16LE(Math.round(r*32767),46+i*4);square+=l*l+r*r;}
  return {buffer,peak:peak*gain,rms:Math.sqrt(square/(left.length*2))};
}
function synth(score:Score) {
  const count=Math.round(score.duration*SAMPLE_RATE),left=new Float32Array(count),right=new Float32Array(count);
  let random=0x345abcde,low=0,previous=0,porcelainPhase=0;
  for(let i=0;i<count;i++) {
    const t=i/SAMPLE_RATE;random^=random<<13;random^=random>>>17;random^=random<<5;
    const noise=(random>>>0)/2147483648-1, env=score.envelope(t);low+=.016*(noise-low);
    let v=0;
    if(score.id==='returning-shore') {const slip=Math.max(0,Math.sin(t*2*Math.PI*27))**8;v=env*((noise-previous)*.18+noise*slip*.55);}
    else if(score.id==='aster-basin')v=env*(low*.8+Math.sin(t*2*Math.PI*57)*.10+Math.sin(t*2*Math.PI*83)*.07);
    else if(score.id==='borrowed-shapes'){const stone=smooth((t-14)/5)*(1-smooth((t-22)/5));const f=740*(1-stone)+210*stone;porcelainPhase+=2*Math.PI*f/SAMPLE_RATE;v=env*(Math.sin(porcelainPhase)*.12+Math.sin(porcelainPhase*2.37)*.07+Math.sin(porcelainPhase*3.8)*.04+low*.1);}
    else if(score.id.startsWith('cleft')){const f=score.loop?480:432;v=env*(Math.sin(t*2*Math.PI*f)*.10+Math.sin(t*2*Math.PI*f*2)*.06+Math.sin(t*2*Math.PI*f*3)*.03);}
    previous=noise;const fade=score.loop?1:smooth(t/.12)*(1-smooth((t-score.duration+.6)/.6));left[i]=v*fade;right[i]=v*fade;
  }
  for(const cue of score.cues) {
    if(cue.sustained)continue;
    const eventLength=cue.duration??(cue.kind==='arrival'?.07:cue.kind==='start'?.10:cue.kind==='completion'?.24:1.8);
    const start=Math.round(cue.seconds*SAMPLE_RATE),pan=cue.pan??0,f=cue.frequency??320;
    for(let j=0;j<eventLength*SAMPLE_RATE;j++) {
      const dt=j/SAMPLE_RATE,index=score.loop?(start+j)%count:start+j;if(index>=count)break;
      const attack=Math.min(1,dt/.002),decay=Math.exp(-dt/(cue.kind==='completion'?.07:cue.kind==='arrival'?.015:.28));
      const modes=Math.sin(2*Math.PI*f*dt)+.43*Math.sin(2*Math.PI*f*2.61*dt)+.21*Math.sin(2*Math.PI*f*4.17*dt);
      const v=modes*attack*decay*(score.id==='sandglass'?.052:.12);
      left[index]!+=v*Math.sqrt((1-pan)/2);right[index]!+=v*Math.sqrt((1+pan)/2);
    }
  }
  return wav(left,right);
}
export async function synthesizeScores(ids?: readonly string[]) {
  const result=[];
  for(const score of SCORES) {
    if(ids&&!ids.includes(score.id))continue;
    const {buffer,peak,rms}=synth(score),folder=score.id.startsWith('cleft')?'cleft':score.id;
    const name=score.id==='cleft'?'hero':score.id==='cleft-sting'?'sting':score.id==='cleft-loop'?'loop':'score';
    const dir=new URL(`../${folder}/assets/`,import.meta.url);await mkdir(dir,{recursive:true});
    const path=new URL(`${name}.wav`,dir);await writeFile(path,buffer);
    const manifest={schemaVersion:1,study:score.id,method:score.method,seed:'345abcde',sampleRate:SAMPLE_RATE,samplesPerFrame:SAMPLES_PER_FRAME,channels:2,bitDepth:16,sampleCount:Math.round(score.duration*SAMPLE_RATE),durationSeconds:score.duration,loop:score.loop??false,peak,rms,sha256:createHash('sha256').update(buffer).digest('hex'),cues:score.cues.map(c=>({...c,sample:Math.round(c.seconds*SAMPLE_RATE)}))};
    await writeFile(new URL(`${name}.audio.json`,dir),JSON.stringify(manifest,null,2)+'\n');result.push({study:score.id,path:fileURLToPath(path),sha256:manifest.sha256});
  }
  return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])console.log(JSON.stringify(await synthesizeScores(process.argv.slice(2).length?process.argv.slice(2):undefined),null,2));
