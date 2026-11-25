import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { createServer } from "vite";
import { expect, it } from "vitest";

it("renders an edited SVG through the public browser runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-browser-svg-"));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    await writeFile(join(root, "index.html"), '<style>html,body{margin:0}</style><script type="module" src="/main.js"></script>');
    await writeFile(join(root, "main.js"), `
      import { svgDocument, SvgArtwork, svg } from '@foxworth/superimg';
      import { render } from '@foxworth/superimg/runtime';
      const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect id="subject" width="40" height="40" fill="red"/></svg>';
      const document = svgDocument(new TextEncoder().encode(source));
      const media = svg({size:{width:40,height:40}, render:()=>SvgArtwork({document,id:'art',width:40,height:40,edits:{subject:{fill:'blue'}}})});
      window.document.body.innerHTML = await (await render(media,{as:'svg'})).text();
      window.svgReady = true;
    `);
    server = await createServer({ configFile: false, root, server: { host: "127.0.0.1", port: 0, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 40, height: 40 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForFunction("window.svgReady === true", null, { timeout: 10000 });
    const pixels = await sharp(await page.screenshot()).ensureAlpha().raw().toBuffer();
    expect([...pixels.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
    expect(errors).toEqual([]);
  } finally {
    await browser?.close();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it("renders declared collection faces through the public browser runtime", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "superimg-browser-font-")));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const regular = await readFile(resolve(packageRoot, "../superimg-core/assets/fonts/Inter-400.ttf"));
    const bold = await readFile(resolve(packageRoot, "../superimg-core/assets/fonts/Inter-700.ttf"));
    const header = Buffer.alloc(20);
    header.write("ttcf", 0, "ascii");
    header.writeUInt32BE(0x00010000, 4);
    header.writeUInt32BE(2, 8);
    const padding = Buffer.alloc((4 - regular.length % 4) % 4);
    const offsets = [header.length, header.length + regular.length + padding.length];
    header.writeUInt32BE(offsets[0]!, 12);
    header.writeUInt32BE(offsets[1]!, 16);
    const collection = Buffer.concat([header, regular, padding, bold]);
    for (const [index, font] of [regular, bold].entries()) {
      for (let i = 0; i < font.readUInt16BE(4); i++) {
        const position = offsets[index]! + 12 + 16 * i + 8;
        collection.writeUInt32BE(collection.readUInt32BE(position) + offsets[index]!, position);
      }
    }
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    await Promise.all([
      writeFile(join(root, "collection.ttc"), collection),
      writeFile(join(root, "regular.ttf"), regular),
      writeFile(join(root, "bold.ttf"), bold),
      writeFile(join(root, "index.html"), '<style>html,body{margin:0}iframe{border:0;display:block;width:300px;height:80px}</style><script type="module" src="/main.js"></script>'),
      writeFile(join(root, "main.js"), `
        import { image, svgDocument, SvgArtwork } from '@foxworth/superimg';
        import { init, render } from '@foxworth/superimg/runtime';
        const get = async (path) => new Uint8Array(await (await fetch(path)).arrayBuffer());
        const [collection, regular, bold] = await Promise.all(['/collection.ttc','/regular.ttf','/bold.ttf'].map(get));
        const runtime = await init({defaultFonts:false});
        async function make(weight, fonts) {
          const document = svgDocument(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><rect width="300" height="80" fill="white"/><text x="4" y="55" font-family="Fixture" font-weight="'+weight+'" font-size="42">Wide glyphs</text></svg>'));
          const value = image({size:{width:300,height:80}, fonts, render:()=>SvgArtwork({document,width:300,height:80})});
          return (await render(value,{as:'html',runtime})).text();
        }
        const pairs = [400,700];
        for (const weight of pairs) for (const collected of [true,false]) {
          const fonts = collected ? pairs.map(weight=>({family:'Fixture',weight,src:collection})) : [{family:'Fixture',weight:400,src:regular},{family:'Fixture',weight:700,src:bold}];
          const html = await make(weight, fonts);
          const frame = window.document.createElement('iframe');
          window.document.body.append(frame);
          await new Promise(resolve => { frame.onload = resolve; frame.srcdoc = html; });
          await frame.contentDocument.fonts.ready;
        }
        await runtime.dispose();
        window.fontReady = true;
      `),
    ]);
    server = await createServer({ configFile: false, root, server: { host: "127.0.0.1", port: 0, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 300, height: 320 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForFunction("window.fontReady === true", null, { timeout: 15000 });
    const frames = page.locator("iframe");
    const captures: Buffer[] = [];
    for (let index = 0; index < 4; index++) captures.push(await sharp(await frames.nth(index).screenshot()).ensureAlpha().raw().toBuffer());
    expect(Buffer.compare(captures[0]!, captures[1]!)).toBe(0);
    expect(Buffer.compare(captures[2]!, captures[3]!)).toBe(0);
    expect(Buffer.compare(captures[0]!, captures[2]!)).not.toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await browser?.close();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
