import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const edgeDir = process.env.SUPERIMG_EDGE_DIR ?? `${root}/packages/superimg/dist`;
const edge = await import(pathToFileURL(`${edgeDir}/runtime.edge.js`));
const types = await import(pathToFileURL(`${root}/packages/superimg-types/dist/index.js`));
const media = types.svg({size:{width:16,height:16},render:()=>({$$typeof:types.MEDIA_ELEMENT,type:'Vector',props:{width:'fill',height:'fill',viewBox:{x:0,y:0,width:16,height:16}},children:[{$$typeof:types.MEDIA_ELEMENT,type:'VectorPath',props:{d:'M0 0H16V16H0Z',fill:'#000'},children:[]}]})});
const wasm = await readFile(`${root}/packages/superimg-core/node_modules/@resvg/resvg-wasm/index_bg.wasm`);
const documentRuntime = await edge.init({ defaultFonts:false });
if (documentRuntime.capabilities.rasters.length !== 0) throw Error("document runtime advertised raster");
await documentRuntime.dispose();
const raster = await import(pathToFileURL(`${edgeDir}/runtime.edge-raster.js`));
const runtime = await raster.initEdgeRaster(process.argv.includes("--invalid") ? new Uint8Array([0,1,2]) : new Uint8Array(wasm), { defaultFonts:false });
try {if (process.argv.includes('--invalid')) { const error = await edge.render(media,{runtime,as:'png'}).catch(error => error); if (!error.findings?.some(f => f.code === 'RESVG_WASM_UNAVAILABLE')) throw error; console.log('invalid WASM rejected'); process.exitCode = 0; } else {const result = await edge.render(media,{runtime,as:'png'}); const bytes=await result.bytes(); if (bytes[0]!==137 || bytes[1]!==80) throw Error('not PNG'); console.log(`PNG ${bytes.length} bytes`);}} finally {await runtime.dispose();}
