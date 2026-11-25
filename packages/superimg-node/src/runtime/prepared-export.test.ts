import { describe, expect, it, vi } from "vitest";
import { collection, image, MEDIA_ELEMENT, type MediaElement } from "@superimg/types";
function Html(props: Record<string, unknown>): MediaElement { return { $$typeof: MEDIA_ELEMENT, type: "Html", props: { width: "fill", height: "fill", ...props }, children: [] }; }
import { prepareNodeMediaExport } from "./prepared-export.js";

describe("host-owned prepared export", () => {
  it("retains inputs/resources across sampling and export without refetching or resolving", async () => {
    const entries = [{ id:"one", title:"Original" },{id:"two",title:"Second"}];
    const resolve = vi.fn(() => ({}));
    const fetch = vi.fn(async () => new Response("original image",{headers:{"content-type":"image/png"}}));
    const media = image<{id:string;title:string}>({ size:{width:80,height:40}, sample:{id:"sample",title:"Sample"}, resolve,
      assets:{logo:{url:"https://example.test/logo.png"}},
      render: ctx => Html({width:"fill",height:"fill",html:`<p>${ctx.data.title}</p><img src="${ctx.asset("logo")}">`}),
    });
    const prepared = await prepareNodeMediaExport(collection({entries,media}),{for:["80x40.html"]},{fetch,defaultFonts:false});
    expect(resolve).toHaveBeenCalledTimes(2);
    const calls=fetch.mock.calls.length;
    entries[0]!.title="Changed";
    const sample=await prepared.sample(prepared.matrix[0]!.coordinates,"0f","html");
    expect(new TextDecoder().decode(sample.bytes)).toContain("Original");
    expect(new TextDecoder().decode(sample.bytes)).toContain("data:image/png;base64,");
    const bundle=await prepared.export();
    try {
      expect(await bundle.artifacts[0]!.text()).toContain("Original");
      expect(await bundle.artifacts[1]!.text()).toContain("Second");
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls.length).toBe(calls);
    } finally {await bundle.dispose();await prepared.dispose();}
    await expect(prepared.sample(prepared.matrix[0]!.coordinates,0,"html")).rejects.toThrow(/disposed/);
  });
  it("never invokes providers and refuses unprepared coordinates", async () => {
    const entries=vi.fn(()=>[{id:"one"}]);
    const media=image<{id:string}>({sample:{id:"sample"},size:{width:80,height:40},render:()=>Html({html:"Hello"})});
    await expect(prepareNodeMediaExport(collection({entries,media}),{for:["80x40.html"]},{defaultFonts:false})).rejects.toThrow(/static collection/);
    expect(entries).not.toHaveBeenCalled();
    const prepared=await prepareNodeMediaExport(media,{for:["80x40.html"]},{defaultFonts:false});
    try {await expect(prepared.sample({...prepared.matrix[0]!.coordinates,editionId:"foreign"},0,"html")).rejects.toThrow(/not prepared/);}
    finally{await prepared.dispose();await prepared.dispose();}
  });
  it("separates preparation request cancellation from retained resource ownership", async () => {
    const controller=new AbortController();
    const media=image({size:{width:80,height:40},assets:{logo:{bytes:new TextEncoder().encode("owned"),mimeType:"image/png"}},render:ctx=>Html({html:`<img src="${ctx.asset("logo")}">`})});
    const prepared=await prepareNodeMediaExport(media,{for:["80x40.html"],signal:controller.signal},{defaultFonts:false});
    controller.abort();
    try {expect((await prepared.sample(prepared.matrix[0]!.coordinates,0,"html")).bytes.length).toBeGreaterThan(0);}
    finally{await prepared.dispose();}
  });
  it("bounds preparation fan-out and accepts independently cancelled executions", async () => {
    const media=image({size:{width:80,height:40},render:()=>Html({html:"Hello"})});
    await expect(prepareNodeMediaExport(media,{for:Array(65).fill("80x40.html")},{defaultFonts:false})).rejects.toThrow(/64 delivery/);
    const prepared=await prepareNodeMediaExport(media,{for:["80x40.html"]},{defaultFonts:false});
    const controller=new AbortController();controller.abort();
    try {
      await expect(prepared.export({signal:controller.signal})).rejects.toBeDefined();
      const bundle=await prepared.export();
      try {expect(bundle.artifacts).toHaveLength(1);}finally{await bundle.dispose();}
    } finally {await prepared.dispose();}
  });

});
