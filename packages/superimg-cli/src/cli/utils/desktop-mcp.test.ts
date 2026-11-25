import { describe, expect, it, vi } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { admitAll, bindProjection, compileInteractions, defineInteraction, installInteractions, projectAllDirect, realizeDirect } from "@foxworth/boundary";
import { portableSchema } from "@foxworth/boundary/program";
import { serveHost, toolsFor } from "@foxworth/boundary/mcp";
import { createDesktopMcpRelay } from "./desktop-mcp.js";

async function fixture(mode: "legacy" | "modern" = "legacy") {
  const operations = { read: defineInteraction({ id: "film.read", input: portableSchema<{filmId:string}>({type:"object",properties:{filmId:{type:"string"}},required:["filmId"],additionalProperties:false}), output: portableSchema<{filmId:string}>({type:"object",properties:{filmId:{type:"string"}},required:["filmId"],additionalProperties:false}), reads:["film"] }) };
  const compiled = compileInteractions(operations), projection = projectAllDirect(compiled);
  const dispatch = vi.fn((input: {filmId:string}) => input);
  const installed = installInteractions(compiled, { installationId: "relay-test", realizations: { read: realizeDirect(dispatch, "read:1") } });
  const bound = bindProjection(projection, installed.installation, { admit: admitAll });
  if(bound.status!=="bound")throw new Error("fixture binding failed");
  const host=serveHost({doors:[],mcp:{path:"/mcp",name:"test",version:"1",binding:bound.binding,context:()=>({}),tools:toolsFor(projection)}});
  let offline=false;
  const fetcher=vi.fn<typeof fetch>(async (url,init)=>{const response=await host.handler(new Request(url,init));if(offline)throw new Error("lost response");return response;});
  const relay=await createDesktopMcpRelay({version:1,baseUrl:"http://127.0.0.1:1234",token:"test-token",sessionId:"test"},fetcher);
  const client=new Client({name:"legacy-terminal",version:"1"},{versionNegotiation:{mode:mode === "legacy" ? "legacy" : {pin:"2026-07-28"}}});
  const [a,b]=InMemoryTransport.createLinkedPair();
  relay.serve({transport:a}); await client.connect(b);
  return {client,dispatch,fetcher,disconnect:()=>{offline=true;},close:async()=>{await client.close();await relay.close();await host.dispose();}};
}
describe("desktop MCP protocol relay",()=>{
  it.each(["legacy", "modern"] as const)("lets a %s terminal client list and call the host's exact tools",async mode=>{
    const f=await fixture(mode);try{
      const list=await f.client.listTools();expect(list.tools.map(t=>t.name)).toEqual(["film.read"]);
      const result=await f.client.callTool({name:"film.read",arguments:{filmId:"one"}});
      expect(result.isError).not.toBe(true);expect(f.dispatch).toHaveBeenCalledTimes(1);
      expect(f.dispatch.mock.calls[0]?.[0]).toEqual({filmId:"one"});
      expect(f.fetcher.mock.calls.every(([,init])=>init?.redirect==="error")).toBe(true);
    }finally{await f.close();}
  });
  it.each(["legacy", "modern"] as const)("preserves unknown transport outcome without retries for %s clients",async mode=>{
    const f=await fixture(mode);try{
      await f.client.listTools();f.disconnect();const before=f.fetcher.mock.calls.length;
      await expect(f.client.callTool({name:"film.read",arguments:{filmId:"one"}})).rejects.toMatchObject({data:{certainty:"unknown"}});
      expect(f.fetcher.mock.calls.length-before).toBe(1);expect(f.dispatch).toHaveBeenCalledTimes(1);
    }finally{await f.close();}
  });
});
