import {describe,it,expect} from 'vitest';
import {waitColor,requestClusterPath,renderSandglass,sandglassTeachingCaption} from './render';
import {INITIAL_SANDGLASS,sampleSandglass} from './model';
describe('request material and honest legends',()=>{
 it('maps elapsed wait through three distinguishable stops',()=>{expect(waitColor(0)).toBe('rgb(232,237,245)');expect(waitColor(12)).toBe('rgb(165,155,232)');expect(waitColor(24)).toBe('rgb(217,239,112)');expect(waitColor(99)).toBe(waitColor(24));});
 it('uses one rigid twelve-grain packing in each request state',()=>{const a=sampleSandglass(INITIAL_SANDGLASS,{logicalSeconds:12}).systems[0]!.requests[16]!;expect((requestClusterPath(a,390).match(/M/g)??[]).length).toBe(12);expect(requestClusterPath(a,390)).toBe(requestClusterPath({...a,state:'completed'},390));});
 it('labels the completed-only mean and current longest wait',()=>{const tree=renderSandglass(sampleSandglass(INITIAL_SANDGLASS,{logicalSeconds:12}),{width:1280,height:720,teaching:false,fidelity:'full'});const encoded=JSON.stringify(tree);expect(encoded).toContain('Completed mean wait 2.0 s');expect(encoded).toContain('longest waiting 5.5 s');expect(encoded).not.toContain('Observed mean wait');});
 it('holds each teaching caption long enough to read',()=>{const windows=[0,3,7,15,19,25,27,35,40];for(let i=0;i<windows.length-1;i++){const words=sandglassTeachingCaption(windows[i]!).split(/\s+/).length;expect(words).toBeLessThanOrEqual(10);expect(windows[i+1]!-windows[i]!).toBeGreaterThanOrEqual(Math.max(.8,words/3));}});
});
