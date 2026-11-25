import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:4193/';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.materialStudies?.state()?.accepted);
  await page.evaluate(() => window.materialStudies.refreshAvailability());
  const available = await page.evaluate(() => window.materialStudies.available());
  for (const id of available) {
    await page.evaluate(id => window.materialStudies.select(id), id);
    await page.evaluate(() => window.materialStudies.update({ fidelity: 'reduced' }));
    const seconds = { sandglass: 12, cleft: 4.8, 'returning-shore': 6, 'borrowed-shapes': 12.5, 'aster-basin': 13 }[id];
    const record = await page.evaluate(logicalSeconds => window.materialStudies.freeze({ logicalSeconds }), seconds);
    const verified = await page.evaluate(record => window.materialStudies.verify(record), record);
    if (!verified || record.snapshot.readiness.status !== 'ready') throw new Error(`Frozen ${id} revision was not verified`);
    console.log(JSON.stringify({ study: id, counts: await page.evaluate(() => window.materialStudies.state().counts), frozenRevision: record.snapshot.presented, verified }));
    await page.evaluate(() => window.materialStudies.release());
  }
  await page.evaluate(() => window.materialStudies.select('sandglass'));
  await page.fill('#worker', '4'); await page.dispatchEvent('#worker', 'input');
  await page.waitForFunction(() => window.materialStudies.state().accepted.data.workers === 4);
  await page.check('#compare');
  await page.waitForFunction(() => window.materialStudies.state().accepted.data.compare === true);
  await page.click('#watch-rough');
  await page.waitForFunction(() => document.querySelector('#rough-video').readyState >= 2);
  const video = await page.evaluate(() => { const video = document.querySelector('#rough-video'); return { width: video.videoWidth, height: video.videoHeight, duration: video.duration }; });
  if (!video.width || !video.duration) throw new Error('Motion rough did not decode');
  await page.click('#close-rough');
  const diagnostic = await page.evaluate(() => window.materialStudies.benchmark({ repetitions: 1, warmupMs: 100, durationMs: 400 }));
  if (diagnostic.measured || !diagnostic.heldScenesIdle) throw new Error('Diagnostic benchmark incorrectly qualified a profile or rendered during hold');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ controls: 'accepted', rough: video, diagnostic: { measured: diagnostic.measured, heldScenesIdle: diagnostic.heldScenesIdle }, errors }));
} finally { await browser.close(); }
