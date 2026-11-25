import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { startDevServer, type DevServer } from './dev-server.js';
const fixture = vi.hoisted(() => ({ root: '' }));
let server: DevServer | undefined;
let browser: Browser | undefined;
afterEach(async () => { await browser?.close(); browser = undefined; await server?.close(); if (fixture.root) await rm(fixture.root, { recursive: true, force: true }); });
it('library preview uses evaluated dimensions, clock and local audio rather than metadata defaults', async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'superimg-library-config-'));
  await writeFile(join(fixture.root, 'package.json'), '{"type":"module"}');
  await mkdir(join(fixture.root, 'assets'));
  const sound = Buffer.from('RIFFfixture');
  await writeFile(join(fixture.root, 'assets/score.wav'), sound);
  await writeFile(join(fixture.root, 'dimensions.ts'), 'export const W=1080,H=1920;');
  await writeFile(join(fixture.root, 'reel.media.ts'), `import {video,Html} from '@foxworth/superimg';
    import {W,H} from './dimensions';
    export default video({size:{width:W,height:H},fps:24,duration:'28s',
      audio:{id:'score',src:'./assets/score.wav',role:'music'},
      render(){return Html({width:W,height:H,html:'<main>Reel</main>'});}});`);
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw Error('Missing test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(undefined, {port:address.port, projectRoot: fixture.root});
  const response = await fetch(`${server.url}/api/videos/reel/config`);
  expect(response.status).toBe(200);
  const config = await response.json();
  expect(config).toMatchObject({width:1080,height:1920,fps:24,duration:28,audio:{id:'score',src:expect.stringMatching(/^\/api\/assets\//)}});
  expect(config.assetUrls.score).toBe(config.audio.src);
  const audio = await fetch(`${server.url}${config.audio.src}`);
  expect(audio.status).toBe(200);
  expect(Buffer.from(await audio.arrayBuffer())).toEqual(sound);
}, 20000);

it('library config and inspection retain the requested variant and edition', async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'superimg-library-selection-'));
  await writeFile(join(fixture.root, 'package.json'), '{"type":"module"}');
  await writeFile(join(fixture.root, 'reel.media.ts'), `import {video,Html} from '@foxworth/superimg';
    export default video({sample:{title:'Base'},variants:{featured:{title:'Featured'}},
      editions:{square:{size:{width:800,height:800}}},fps:24,duration:'2s',
      render(ctx){return Html({width:ctx.width,height:ctx.height,html:'<main>'+ctx.data.title+'</main>'});}});`);
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw Error('Missing test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(undefined, {port:address.port, projectRoot: fixture.root});

  const configResponse = await fetch(`${server.url}/api/videos/reel/config?variantId=featured&editionId=square`);
  expect(configResponse.status).toBe(200);
  expect(await configResponse.json()).toMatchObject({
    width:800,height:800,variantId:'featured',editionId:'square',
    variants:[{id:'featured'}],editions:[{id:'square'}],
  });

  const inspectResponse = await fetch(`${server.url}/api/videos/reel/inspect?variantId=featured&editionId=square`);
  expect(inspectResponse.status).toBe(200);
  const inspection = await inspectResponse.json();
  expect(inspection).toMatchObject({
    selection:{coordinates:{variantId:'featured',editionId:'square'}},
    report:{coordinates:[{variantId:'featured',editionId:'square'}]},
    source:{id:'reel',revision:expect.any(String)},
  });
});

it('single-source collection config exposes its snapshot and export route', async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'superimg-single-collection-route-'));
  await writeFile(join(fixture.root, 'package.json'), '{"type":"module"}');
  const mediaPath = join(fixture.root, 'cards.media.ts');
  await writeFile(mediaPath, `import { collection, image, Html } from '@foxworth/superimg';
export default collection({ entries: [{ id: 'one', title: 'One' }], media: image({ render: ctx => Html({ width: 'fill', height: 'fill', html: ctx.data.title }) }) });`);

  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw Error('Missing test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(mediaPath, { port: address.port, projectRoot: fixture.root, collectionSource: true });

  const configResponse = await fetch(`${new URL(server.url).origin}/api/config`);
  expect(configResponse.status).toBe(200);
  expect(await configResponse.json()).toMatchObject({
    sourceKind: 'collection',
    collection: { sourcePath: '/api/collection', snapshotId: null, stale: true },
  });
});

it('home collection pages keep source snapshots and tab selections isolated through exact-receipt export', async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'superimg-home-collections-'));
  await writeFile(join(fixture.root, 'package.json'), '{"type":"module"}');
  for (const [name, label] of [['alpha', 'Alpha'], ['beta', 'Beta']] as const) {
    const dir = join(fixture.root, name);
    await mkdir(dir);
    await writeFile(join(dir, 'entries.server.ts'), `import { appendFileSync } from 'node:fs';\nexport function entries() { appendFileSync(new URL('./provider.log', import.meta.url), 'called\\n'); return [{ id: '${name}-one', title: '${label} one' }, { id: '${name}-two', title: '${label} two' }]; }`);
    await writeFile(join(dir, 'render.ts'), `import { Html } from '@foxworth/superimg';\nexport function render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<main>' + ctx.data.title + '</main>' }); }`);
    await writeFile(join(dir, `${name}.media.ts`), `import { collection, image } from '@foxworth/superimg';\nimport { entries } from './entries.server';\nimport { render } from './render';\nexport default collection({ entries, media: image({ size: { width: 64, height: 64 }, render }) });`);
  }
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw Error('Missing test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(undefined, { port: address.port, projectRoot: fixture.root });
  const origin = new URL(server.url).origin;

  const libraryResponse = await fetch(`${origin}/api/videos`);
  expect(await libraryResponse.json()).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'alpha/alpha', sourceKind: 'collection' }),
    expect.objectContaining({ name: 'beta/beta', sourceKind: 'collection' }),
  ]));
  for (const name of ['alpha', 'beta']) {
    const config = await fetch(`${origin}/api/videos/${name}%2F${name}/config`);
    expect(config.status).toBe(200);
    expect(await config.json()).toMatchObject({ sourceKind: 'collection', previewKind: 'collection-unavailable', collection: { snapshotId: null, entries: [], stale: true } });
    await expect(readFile(join(fixture.root, name, 'provider.log'))).rejects.toThrow();
  }

  const session = await fetch(`${origin}/api/media/session`);
  const token = (await session.json() as { token: string }).token;
  const cookie = session.headers.get('set-cookie')!.split(';', 1)[0]!;
  const headers = { Cookie: cookie, Origin: origin, 'X-Superimg-Session': token, 'Content-Type': 'application/json' };
  const snapshot = async (name: string) => {
    const response = await fetch(`${origin}/api/videos/${name}%2F${name}/collection/snapshot`, { method: 'POST', headers, body: '{}' });
    expect(response.status).toBe(200);
    return await response.json() as { snapshotId: string; generation: number; entries: Array<{ id: string }> };
  };
  const [alpha, beta] = await Promise.all([snapshot('alpha'), snapshot('beta')]);
  expect(alpha.entries.map(entry => entry.id)).toEqual(['alpha-one', 'alpha-two']);
  expect(beta.entries.map(entry => entry.id)).toEqual(['beta-one', 'beta-two']);

  // These are two tabs over the same home server. Their entry choices live in
  // the request URLs, while each source's retained snapshot stays independent.
  const tabA = `${origin}/api/videos/alpha%2Falpha/config?snapshotId=${alpha.snapshotId}&generation=${alpha.generation}&entryId=alpha-two`;
  const tabB = `${origin}/api/videos/beta%2Fbeta/config?snapshotId=${beta.snapshotId}&generation=${beta.generation}&entryId=beta-one`;
  expect(await (await fetch(tabA)).json()).toMatchObject({ entryId: 'alpha-two', collection: { snapshotId: alpha.snapshotId } });
  expect(await (await fetch(tabB)).json()).toMatchObject({ entryId: 'beta-one', collection: { snapshotId: beta.snapshotId } });
  expect(await (await fetch(`${origin}/api/videos/alpha%2Falpha/config?snapshotId=${alpha.snapshotId}&generation=${alpha.generation}&entryId=alpha-one`)).json()).toMatchObject({ entryId: 'alpha-one' });

  const exported = await fetch(`${origin}/api/videos/alpha%2Falpha/collection/export`, {
    method: 'POST', headers,
    body: JSON.stringify({ snapshotId: alpha.snapshotId, generation: alpha.generation, entryId: 'alpha-two', destinations: ['64x64.png'] }),
  });
  expect(exported.status, await exported.clone().text()).toBe(200);
  expect(await exported.json()).toMatchObject({ schemaVersion: 0, targetId: 'project-output', publicationId: expect.any(String), manifestDigest: expect.any(String), manifest: expect.any(Object) });
  expect((await readFile(join(fixture.root, 'alpha', 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(1);
  expect((await readFile(join(fixture.root, 'beta', 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(1);
  await writeFile(join(fixture.root, 'alpha', 'render.ts'), `import { Html } from '@foxworth/superimg';\nexport function render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<main>Changed ' + ctx.data.title + '</main>' }); }`);
  expect(await (await fetch(tabA)).json()).toMatchObject({ sourceKind: 'collection', previewKind: 'collection-unavailable', collection: { stale: true, snapshotId: null } });
});

it('home collection snapshots freeze dynamically read rows until explicit refresh', async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'superimg-home-frozen-rows-'));
  await writeFile(join(fixture.root, 'package.json'), '{"type":"module"}');
  const sourceDir = join(fixture.root, 'cards');
  await mkdir(sourceDir);
  await writeFile(join(sourceDir, 'rows.json'), JSON.stringify([{ id: 'before-refresh', title: 'Before refresh' }]));
  await writeFile(join(sourceDir, 'entries.server.ts'), `import { appendFileSync, readFileSync } from 'node:fs';
export function entries() {
  appendFileSync(new URL('./provider.log', import.meta.url), 'called\\n');
  return JSON.parse(readFileSync(new URL('./rows.json', import.meta.url), 'utf8'));
}`);
  await writeFile(join(sourceDir, 'render.ts'), `import { Html } from '@foxworth/superimg';
export function render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<main>' + ctx.data.title + '</main>' }); }`);
  await writeFile(join(sourceDir, 'cards.media.ts'), `import { collection, image } from '@foxworth/superimg';
import { entries } from './entries.server';
import { render } from './render';
export default collection({ entries, media: image({ size: { width: 64, height: 64 }, render }) });`);

  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw Error('Missing test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(undefined, { port: address.port, projectRoot: fixture.root });
  const origin = new URL(server.url).origin;
  const sourcePath = '/api/videos/cards%2Fcards';

  await (await fetch(`${origin}/api/videos`)).json();
  const initialConfig = await (await fetch(`${origin}${sourcePath}/config`)).json() as { inputIdentity: string; previewKind: string };
  expect(initialConfig.previewKind).toBe('collection-unavailable');
  expect(initialConfig.inputIdentity).toEqual(expect.any(String));
  await expect(readFile(join(sourceDir, 'provider.log'))).rejects.toThrow();

  const session = await fetch(`${origin}/api/media/session`);
  const token = (await session.json() as { token: string }).token;
  const cookie = session.headers.get('set-cookie')!.split(';', 1)[0]!;
  const headers = { Cookie: cookie, Origin: origin, 'X-Superimg-Session': token, 'Content-Type': 'application/json' };
  const refresh = async () => {
    const response = await fetch(`${origin}${sourcePath}/collection/snapshot`, { method: 'POST', headers, body: '{}' });
    expect(response.status).toBe(200);
    return await response.json() as { snapshotId: string; generation: number; entries: Array<{ id: string }> };
  };
  const unauthorized = await fetch(`${origin}${sourcePath}/collection/snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  expect(unauthorized.status).toBe(403);
  await expect(readFile(join(sourceDir, 'provider.log'))).rejects.toThrow();
  const first = await refresh();
  expect(first.entries.map(entry => entry.id)).toEqual(['before-refresh']);

  await writeFile(join(sourceDir, 'rows.json'), JSON.stringify([{ id: 'after-refresh', title: 'After refresh' }]));
  const oldSelection = `${origin}${sourcePath}/config?snapshotId=${first.snapshotId}&generation=${first.generation}&entryId=before-refresh`;
  expect(await (await fetch(oldSelection)).json()).toMatchObject({
    entryId: 'before-refresh',
    collection: { snapshotId: first.snapshotId, entries: [{ id: 'before-refresh' }] },
  });
  expect((await readFile(join(sourceDir, 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(1);

  const exported = await fetch(`${origin}${sourcePath}/collection/export`, {
    method: 'POST', headers,
    body: JSON.stringify({ snapshotId: first.snapshotId, generation: first.generation, entryId: 'before-refresh', destinations: ['64x64.png'] }),
  });
  expect(exported.status, await exported.clone().text()).toBe(200);
  expect(await exported.json()).toMatchObject({ manifest: { entries: [{ id: 'before-refresh' }] } });
  expect((await readFile(join(sourceDir, 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(1);

  const second = await refresh();
  expect(second.entries.map(entry => entry.id)).toEqual(['after-refresh']);
  expect((await readFile(join(sourceDir, 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(2);
});

it('home UI materializes and exports two collection sources independently across tabs', async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'superimg-home-tabs-'));
  await writeFile(join(fixture.root, 'package.json'), '{"type":"module"}');
  for (const [name, label] of [['alpha', 'Alpha'], ['beta', 'Beta']] as const) {
    const dir = join(fixture.root, name);
    await mkdir(dir);
    await writeFile(join(dir, 'entries.server.ts'), `import { appendFileSync } from 'node:fs';\nexport function entries() { appendFileSync(new URL('./provider.log', import.meta.url), 'called\\n'); return [{ id: '${name}-one', title: '${label} one' }, { id: '${name}-two', title: '${label} two' }]; }`);
    await writeFile(join(dir, 'render.ts'), `import { Html } from '@foxworth/superimg';\nexport function render(ctx) { return Html({ width: 'fill', height: 'fill', html: '<main>' + ctx.data.title + '</main>' }); }`);
    await writeFile(join(dir, `${name}.media.ts`), `import { collection, image } from '@foxworth/superimg';\nimport { entries } from './entries.server';\nimport { render } from './render';\nexport default collection({ entries, media: image({ size: { width: 64, height: 64 }, render }) });`);
  }
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw Error('Missing test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(undefined, { port: address.port, projectRoot: fixture.root });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const firstTab = await context.newPage();
  const secondTab = await context.newPage();
  const browserErrors: string[] = [];
  const collectionResponses: string[] = [];
  firstTab.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  firstTab.on('pageerror', error => browserErrors.push(error.message));
  firstTab.on('response', response => { if (response.url().includes('/api/')) collectionResponses.push(`${response.request().method()} ${response.status()} ${response.url()}`); });
  await firstTab.goto(server.url);
  try {
    await firstTab.locator('.si-card').filter({ hasText: 'Alpha' }).click({ timeout: 5000 });
  } catch (error) {
    throw new Error(`Home card unavailable; body=${(await firstTab.locator('body').innerText()).slice(0, 1000)}; errors=${browserErrors.join(' | ')}`, { cause: error });
  }
  await firstTab.locator('#collection-controls').waitFor({ state: 'visible' });
  await expect(readFile(join(fixture.root, 'alpha', 'provider.log'))).rejects.toThrow();
  await secondTab.goto(server.url);
  await secondTab.locator('.si-card').filter({ hasText: 'Beta' }).click();
  await secondTab.locator('#collection-controls').waitFor({ state: 'visible' });
  await expect(readFile(join(fixture.root, 'beta', 'provider.log'))).rejects.toThrow();

  await Promise.all([firstTab.locator('#collection-refresh').click(), secondTab.locator('#collection-refresh').click()]);
  try {
    await firstTab.waitForFunction(() => document.querySelector('#collection-status')?.textContent?.includes('Snapshot ready') === true, undefined, { timeout: 10000 });
  } catch (error) {
    throw new Error(`Snapshot did not complete; url=${firstTab.url()}; body=${(await firstTab.locator('body').innerText()).slice(0, 700)}; status=${await firstTab.locator('#collection-status').innerText()}; responses=${collectionResponses.join(' | ')}; errors=${browserErrors.join(' | ')}`, { cause: error });
  }
  await secondTab.waitForFunction(() => document.querySelector('#collection-status')?.textContent?.includes('Snapshot ready') === true);
  await firstTab.locator('#collection-entry').selectOption('alpha-two');
  await secondTab.locator('#collection-entry').selectOption('beta-one');
  await firstTab.waitForFunction(() => document.querySelector('#preview-selection-status')?.textContent === 'Selection accepted');
  await secondTab.waitForFunction(() => document.querySelector('#preview-selection-status')?.textContent === 'Selection accepted');
  expect(new URL(firstTab.url()).searchParams.get('entryId')).toBe('alpha-two');
  expect(new URL(secondTab.url()).searchParams.get('entryId')).toBe('beta-one');

  const sameSourceTab = await context.newPage();
  await sameSourceTab.goto(server.url);
  await sameSourceTab.locator('.si-card').filter({ hasText: 'Alpha' }).click();
  await sameSourceTab.locator('#collection-entry').waitFor({ state: 'visible' });
  await sameSourceTab.locator('#collection-entry').selectOption('alpha-one');
  await sameSourceTab.waitForFunction(() => document.querySelector('#preview-selection-status')?.textContent === 'Selection accepted');
  expect(await firstTab.locator('#collection-entry').inputValue()).toBe('alpha-two');
  expect(await sameSourceTab.locator('#collection-entry').inputValue()).toBe('alpha-one');
  expect(new URL(firstTab.url()).searchParams.get('snapshotId')).toBe(new URL(sameSourceTab.url()).searchParams.get('snapshotId'));

  await firstTab.locator('#export').click();
  await firstTab.locator('#export-start').click();
  await firstTab.waitForFunction(() => document.querySelector('#collection-export-status')?.textContent?.startsWith('Exported frozen entry “alpha-two”') === true, undefined, { timeout: 30_000 });
  expect((await readFile(join(fixture.root, 'alpha', 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(1);
  expect((await readFile(join(fixture.root, 'beta', 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(1);

  await firstTab.reload();
  await firstTab.locator('#collection-entry').waitFor({ state: 'visible' });
  expect(await firstTab.locator('#collection-entry').inputValue()).toBe('alpha-two');
  expect(await secondTab.locator('#collection-entry').inputValue()).toBe('beta-one');

  const origin = new URL(server.url).origin;
  const session = await fetch(`${origin}/api/media/session`);
  const token = (await session.json() as { token: string }).token;
  const cookie = session.headers.get('set-cookie')!.split(';', 1)[0]!;
  const active = new URL(firstTab.url()).searchParams;
  const crossSource = await fetch(`${origin}/api/videos/alpha%2Falpha/collection/export`, {
    method: 'POST', headers: { Cookie: cookie, Origin: origin, 'X-Superimg-Session': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshotId: new URL(secondTab.url()).searchParams.get('snapshotId'), generation: Number(new URL(secondTab.url()).searchParams.get('generation')), entryId: 'beta-one', destinations: ['64x64.png'] }),
  });
  expect(crossSource.status).toBe(409);
  expect(active.get('entryId')).toBe('alpha-two');

  const deniedSnapshot = '**/collection/snapshot';
  await firstTab.route(deniedSnapshot, route => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({ error: { message: 'session_forbidden' } }),
  }));
  const beforeDeniedRefresh = firstTab.url();
  await firstTab.locator('#collection-refresh').click();
  await firstTab.waitForFunction(() => document.querySelector('#collection-status')?.textContent?.includes('Snapshot refresh failed: session_forbidden') === true);
  expect(firstTab.url()).toBe(beforeDeniedRefresh);
  expect(await firstTab.locator('#collection-entry').inputValue()).toBe('alpha-two');
  expect(await firstTab.locator('#player-view').getAttribute('class')).toMatch(/visible/);
  await firstTab.unroute(deniedSnapshot);
  await firstTab.locator('#collection-refresh').click();
  await firstTab.waitForFunction(() => document.querySelector('#collection-status')?.textContent?.includes('Snapshot ready') === true);
  await firstTab.waitForFunction(() => document.querySelector('#preview-selection-status')?.textContent === 'Selection accepted');
  expect(await firstTab.locator('#collection-entry').inputValue()).toBe('alpha-two');
  expect((await readFile(join(fixture.root, 'alpha', 'provider.log'), 'utf8')).trim().split('\n')).toHaveLength(2);
  await context.close();
}, 60_000);
