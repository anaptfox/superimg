import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { ALL_FORMATS, AudioSampleSink, BufferSource, BufferTarget, EncodedAudioPacketSource, EncodedPacket, EncodedPacketSink, Input, MkvOutputFormat, Output } from 'mediabunny';
import { registerMediabunnyServer } from '@mediabunny/server';
import { prepareMediaInput, prepareCuts, exportCuts, extractFrames, extractWaveform } from '@foxworth/superimg-node/media-preparation';
import { projectMappedCaptions } from '@foxworth/superimg/transcript';

const dir = await mkdtemp(join(tmpdir(), 'superimg-cut-plan-'));
registerMediabunnyServer();
const ffmpeg = args => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
async function markerTimes(bytes, centers) {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack(); const found = centers.map(() => undefined);
    for await (const sample of new AudioSampleSink(track).samples()) {
      try {
        const pcm = new Float32Array(sample.numberOfFrames * sample.numberOfChannels); sample.copyTo(pcm, {format:'f32',planeIndex:0});
        for (let i=0; i<sample.numberOfFrames; i++) { const t=sample.timestamp+i/sample.sampleRate; for (let j=0; j<centers.length; j++) if (found[j] === undefined && t >= centers[j]-0.008 && t <= centers[j]+0.015 && Math.abs(pcm[i*sample.numberOfChannels]) > 0.2) found[j]=t; }
      } finally { sample.close(); }
    }
    assert.ok(found.every(t => t !== undefined), `missing markers: ${found}`); return found;
  } finally { input.dispose(); }
}
async function pcmValues(bytes) {
  const input = new Input({source:new BufferSource(bytes),formats:ALL_FORMATS});
  try { const track = await input.getPrimaryAudioTrack(), values = []; let rate;
    for await (const sample of new AudioSampleSink(track).samples()) { try { rate=sample.sampleRate; const data=new Float32Array(sample.numberOfFrames); sample.copyTo(data,{format:'f32',planeIndex:0}); values.push(...data); } finally { sample.close(); } }
    return {values,rate};
  } finally {input.dispose();}
}
async function checkOutput(artifact, kinds, expectedStart, expectedMarkers) {
  const bytes = new Uint8Array(await new Response(artifact.open()).arrayBuffer());
  const owned = await prepareMediaInput({ kind: 'bytes', bytes });
  try {
    const info = await owned.inspect(); assert.deepEqual(info.tracks.map(t => t.kind), kinds);
    const video = info.tracks.find(t => t.kind === 'video'), audio = info.tracks.find(t => t.kind === 'audio');
    if (video) { const frame = await extractFrames(owned, { trackId: video.id, timesSeconds: [0.05], width: 16, height: 16 }); try { const rgba = await sharp(frame.frames[0].png).raw().toBuffer(); assert.ok(rgba[0] > rgba[2] + 80); } finally { frame.dispose(); } }
    if (audio) {
      const wave = await extractWaveform(owned, { trackId: audio.id, bins: 50, startSeconds: 0, endSeconds: 0.5 }); const index = wave.bins.findIndex(b => b.peak > 0.1); assert.ok(index >= 0); assert.ok(Math.abs(wave.bins[index].startSeconds - expectedStart) < 0.05, `audio marker ${wave.bins[index].startSeconds}, expected ${expectedStart}`);
      const decoded = new Input({source:new BufferSource(bytes),formats:ALL_FORMATS});
      try { const track = await decoded.getPrimaryAudioTrack(); let count = 0; for await (const sample of new AudioSampleSink(track).samples()) { try { const ticks = sample.timestamp * sample.sampleRate; assert.ok(Math.abs(ticks - Math.round(ticks)) < 0.05); count += sample.numberOfFrames; } finally { sample.close(); } } assert.ok(count > 0); }
      finally { decoded.dispose(); }
      const actual = await markerTimes(bytes,expectedMarkers); for (let i=0; i<actual.length; i++) assert.ok(Math.abs(actual[i]-expectedMarkers[i]) < 0.005, `decoded marker ${actual[i]}, mapped ${expectedMarkers[i]}`);
      console.log('decoded markers', JSON.stringify({ sampleRate: audio.sampleRate, expected: expectedMarkers, actual, differencesSeconds: actual.map((t,i)=>t-expectedMarkers[i]) }));
    }
  } finally { await owned.dispose(); }
}
try {
  for (const rate of [8000, 44100]) {
    const path = join(dir, `${rate}.mp4`);
    ffmpeg(['-f','lavfi','-i','color=red:size=64x64:rate=10:duration=1','-f','lavfi','-i',`aevalsrc=if(between(t\\,0.4\\,0.45)+between(t\\,0.74\\,0.79)\\,0.7*sin(2*PI*440*t)\\,0):s=${rate}:d=1`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path]);
    const bytes = new Uint8Array(await readFile(path)), owned = await prepareMediaInput({kind:'bytes', bytes});
    try {
      const info = await owned.inspect(), video = info.tracks.find(t => t.kind === 'video'), audio = info.tracks.find(t => t.kind === 'audio'); assert.ok(video && audio);
      const source = { mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds };
      const start = rate === 8000 ? 0.123456 : 0.123, requested = rate === 8000 ? [{startSeconds:start,endSeconds:0.75}] : [{startSeconds:start,endSeconds:0.567},{startSeconds:0.7,endSeconds:0.9}];
      const plan = await prepareCuts(owned, {source, ranges:requested, audioTrackId:audio.id, videoTrackId:video.id, quantization:'nearest'});
      const accepted = Math.round(start * rate) / rate; assert.ok(Math.abs(plan.acceptedMap.ranges[0].startSeconds - accepted) < 1e-9); assert.equal(plan.requestedRanges[0].startSeconds,start);
      if (rate === 44100) { assert.ok(Math.abs(plan.acceptedMap.ranges[0].endSeconds-Math.round(0.567*rate)/rate)<1e-9); assert.ok(Math.abs(plan.acceptedMap.ranges[1].startSeconds-Math.round(0.7*rate)/rate)<1e-9); }
      const doc = {schemaVersion:1,source,revision:'fixture',timeUnit:'seconds',spans:[{id:'tone',text:'tone',timing:{startSeconds:0.4,endSeconds:0.6},granularity:'word',alignment:'recognized'}]};
      const cue = projectMappedCaptions(doc, plan.acceptedMap).cues[0]; assert.ok(Math.abs(cue.startSeconds - (0.4 - accepted)) < 1e-9);
      assert.ok(Math.abs(cue.startSeconds * rate - Math.round(cue.startSeconds * rate)) < 1e-6);
      const sourceMarkers = await markerTimes(bytes,rate === 8000 ? [0.4] : [0.4,0.74]);
      for (const mode of ['av','audio','video']) {
        const p = mode === 'av' ? plan : await prepareCuts(owned, {source:mode === 'audio' ? source : {mediaSha256:info.sha256,trackId:video.id,durationSeconds:video.durationSeconds},ranges:requested,...(mode === 'audio' ? {audioTrackId:audio.id} : {videoTrackId:video.id}),quantization:'nearest'});
        const artifact = (await exportCuts(owned, {plan:p,encoding:{format:'mp4',...(mode !== 'audio' ? {video:{codec:'avc'}} : {}),...(mode !== 'video' ? {audio:{codec:'aac'}} : {})}})).artifact;
        const first = sourceMarkers[0]-p.acceptedMap.ranges[0].startSeconds;
        const expectedMarkers = rate === 8000 ? [first] : [first,p.acceptedMap.ranges[0].endSeconds-p.acceptedMap.ranges[0].startSeconds+sourceMarkers[1]-p.acceptedMap.ranges[1].startSeconds];
        try { await checkOutput(artifact, mode === 'av' ? ['video','audio'] : mode === 'audio' ? ['audio'] : ['video'],0.4-p.acceptedMap.ranges[0].startSeconds,expectedMarkers); }
        finally { await artifact.dispose(); }
      }
      await assert.rejects(exportCuts(owned,{plan:{...plan}}),/forged/);
      const changed = new Uint8Array(bytes.length+1); changed.set(bytes); changed[bytes.length]=1;
      await assert.rejects(exportCuts({kind:'bytes',bytes:changed},{plan}),/identity/);
      await assert.rejects(exportCuts(owned,{plan,encoding:{format:'webm',video:{codec:'avc'},audio:{codec:'opus'}}}),/compatible/);
      console.log(`accepted ${rate} Hz`, JSON.stringify({ requested:start, accepted, captionStart:cue.startSeconds }));
    } finally { await owned.dispose(); }
  }
  const pcmPath=join(dir,'pcm.mkv');
  ffmpeg(['-f','lavfi','-i','sine=frequency=431:sample_rate=44100:duration=1','-c:a','pcm_f32le',pcmPath]);
  const pcmBytes=new Uint8Array(await readFile(pcmPath)), pcmInput=await prepareMediaInput({kind:'bytes',bytes:pcmBytes});
  try { const info=await pcmInput.inspect(), audio=info.tracks.find(t=>t.kind==='audio'), original=await pcmValues(pcmBytes); assert.equal(original.rate,44100);
    const plan=await prepareCuts(pcmInput,{source:{mediaSha256:info.sha256,trackId:audio.id,durationSeconds:audio.durationSeconds},ranges:[{startSeconds:0.123,endSeconds:0.567},{startSeconds:0.7,endSeconds:0.9}],audioTrackId:audio.id,quantization:'nearest'});
    const result=await exportCuts(pcmInput,{plan,encoding:{format:'mkv',audio:{codec:'pcm-f32'}}});
    try { const actual=await pcmValues(new Uint8Array(await new Response(result.artifact.open()).arrayBuffer())); const expected=plan.acceptedMap.ranges.flatMap(r=>original.values.slice(Math.round(r.startSeconds*44100),Math.round(r.endSeconds*44100))); assert.equal(actual.rate,44100); assert.deepEqual(actual.values,expected); console.log('MKV pcm-f32 exact samples',JSON.stringify({count:actual.values.length,ranges:plan.acceptedMap.ranges})); }
    finally {await result.artifact.dispose();}
  } finally {await pcmInput.dispose();}
  for (const second of [0.26,0.24]) {
    const target=new BufferTarget(), out=new Output({format:new MkvOutputFormat(),target}), source=new EncodedAudioPacketSource('pcm-f32'); out.addAudioTrack(source); await out.start();
    for (const t of [0,second]) await source.add(new EncodedPacket(new Uint8Array(8000),'key',t,0.25),{decoderConfig:{codec:'pcm-f32',sampleRate:8000,numberOfChannels:1}});
    await out.finalize(); const bytes=new Uint8Array(target.buffer), raw=new Input({source:new BufferSource(bytes),formats:ALL_FORMATS});
    try { const track=(await raw.getAudioTracks())[0], stamps=[]; for await (const packet of new EncodedPacketSink(track).packets()) stamps.push(packet.timestamp); assert.deepEqual(stamps,[0,second]);
      const decoded=[]; for await (const sample of new AudioSampleSink(track).samples()) { try {decoded.push(sample.timestamp);} finally {sample.close();} } assert.ok(Math.abs(decoded[1]-0.25)<1e-9);
    } finally {raw.dispose();}
    const owned=await prepareMediaInput({kind:'bytes',bytes});
    try {const info=await owned.inspect(), audio=info.tracks[0], plan=await prepareCuts(owned,{source:{mediaSha256:info.sha256,trackId:audio.id,durationSeconds:audio.durationSeconds},ranges:[{startSeconds:0,endSeconds:0.4}],audioTrackId:audio.id,quantization:'nearest'}); await assert.rejects(exportCuts(owned,{plan,encoding:{format:'mkv',audio:{codec:'pcm-f32'}}}),/packet coverage gap or overlap/); console.log('rejected raw PCM discontinuity',second);}
    finally {await owned.dispose();}
  }
  const rotatedPath = join(dir, 'rotated.mp4');
  ffmpeg(['-f','lavfi','-i','color=red:size=64x32:rate=10:duration=1','-vf','drawbox=x=32:y=0:w=32:h=32:color=blue:t=fill','-c:v','libx264','-pix_fmt','yuv420p',rotatedPath]);
  const rotated = await readFile(rotatedPath), tkhd = rotated.indexOf('tkhd'); assert.ok(tkhd > 0); assert.equal(rotated[tkhd + 4], 0);
  [0,65536,0,-65536,0,0,32*65536,0,1073741824].forEach((n,i) => rotated.writeInt32BE(n,tkhd+44+i*4));
  const rotatedInput = await prepareMediaInput({kind:'bytes',bytes:rotated});
  try {
    const info = await rotatedInput.inspect(), video = info.tracks.find(t => t.kind === 'video'); assert.equal(video.rotation,90);
    const plan = await prepareCuts(rotatedInput,{source:{mediaSha256:info.sha256,trackId:video.id,durationSeconds:video.durationSeconds},ranges:[{startSeconds:0.1,endSeconds:0.6}],videoTrackId:video.id,quantization:'nearest'});
    const artifact = (await exportCuts(rotatedInput,{plan,encoding:{format:'mp4',video:{codec:'avc'}}})).artifact;
    try {
      const output = await prepareMediaInput({kind:'bytes',bytes:new Uint8Array(await new Response(artifact.open()).arrayBuffer())});
      try { const facts = await output.inspect(), track = facts.tracks.find(t=>t.kind==='video'); assert.equal(track.width,32); assert.equal(track.height,64); assert.equal(track.rotation,0);
        const frames = await extractFrames(output,{trackId:track.id,timesSeconds:[0.1],width:32,height:64});
        try { const {data,info:raw} = await sharp(frames.frames[0].png).ensureAlpha().raw().toBuffer({resolveWithObject:true}); const pixel = (x,y) => [...data.subarray((y*raw.width+x)*4,(y*raw.width+x)*4+4)]; const top=pixel(16,8),bottom=pixel(16,56); assert.ok(top[0]>top[2]+80 && bottom[2]>bottom[0]+80,`${top} ${bottom}`); } finally { frames.dispose(); }
      } finally { await output.dispose(); }
    } finally { await artifact.dispose(); }
  } finally { await rotatedInput.dispose(); }
  const rgba = Buffer.alloc(32*32*4*2); for (let i=0;i<rgba.length;i+=4) { rgba[i]=240; rgba[i+3]=96; }
  const rawPath=join(dir,'alpha.rgba'), alphaPath=join(dir,'alpha.mov'); await writeFile(rawPath,rgba);
  ffmpeg(['-f','rawvideo','-pixel_format','rgba','-video_size','32x32','-framerate','2','-i',rawPath,'-c:v','prores_ks','-profile:v','4444','-pix_fmt','yuva444p10le',alphaPath]);
  const alphaInput=await prepareMediaInput({kind:'bytes',bytes:new Uint8Array(await readFile(alphaPath))});
  try { const info=await alphaInput.inspect(), video=info.tracks.find(t=>t.kind==='video');
    const plan=await prepareCuts(alphaInput,{source:{mediaSha256:info.sha256,trackId:video.id,durationSeconds:video.durationSeconds},ranges:[{startSeconds:0,endSeconds:0.5}],videoTrackId:video.id,quantization:'nearest'});
    const artifact=(await exportCuts(alphaInput,{plan,encoding:{format:'mov',video:{codec:'prores',alpha:'keep'}}})).artifact;
    try { const output=await prepareMediaInput({kind:'bytes',bytes:new Uint8Array(await new Response(artifact.open()).arrayBuffer())});
      try { const track=(await output.inspect()).tracks.find(t=>t.kind==='video'); assert.equal(track.codec,'prores'); const frames=await extractFrames(output,{trackId:track.id,timesSeconds:[0.1],width:16,height:16});
        try { const pixels=await sharp(frames.frames[0].png).ensureAlpha().raw().toBuffer(); assert.ok(pixels[0]>pixels[2]+80 && pixels[3]>60 && pixels[3]<130,`alpha pixel ${[...pixels.slice(0,4)]}`); console.log('MOV ProRes alpha pixel',JSON.stringify([...pixels.slice(0,4)])); } finally {frames.dispose();}
      } finally {await output.dispose();}
    } finally {await artifact.dispose();}
  } finally {await alphaInput.dispose();}
} finally { await rm(dir,{recursive:true,force:true}); }
