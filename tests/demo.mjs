import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

await mkdir(new URL('../test-output/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => assert.equal(request.url().startsWith('http'), false, 'Preview works offline'));
const url = new URL('../demo/index.html', import.meta.url).href;
const screenshot = name => page.screenshot({ path: fileURLToPath(new URL(`../test-output/short-${name}.png`, import.meta.url)) });
const seek = time => page.evaluate(time => window.gitmasVideo.renderFrame(time), time);
try {
  await page.goto(`${url}?video=1`);
  await page.waitForFunction(() => window.gitmasVideo);
  assert.deepEqual(await page.evaluate(() => ({ duration: gitmasVideo.duration, width: gitmasVideo.width, height: gitmasVideo.height })), { duration: 18, width: 1080, height: 1920 });
  assert.equal(await page.locator('.studio').evaluate(element => element.getBoundingClientRect().height), 640);
  assert.equal(await page.locator('.inspector').count(), 0, 'Explanation panel removed');
  assert.equal(await page.locator('.credit').isVisible(), true);
  assert.equal(await page.locator('.transport').isVisible(), false);
  assert.equal(await page.evaluate(() => choreography.spin.at), 12, 'Spin starts immediately at 12 seconds');
  assert.ok(await page.evaluate(() => choreography.ornaments.at - choreography.garland.at) < 0.5, 'Ornaments join gold almost immediately');
  assert.ok(await page.evaluate(() => choreography.gifts.at(-1).at - choreography.gifts[0].at) < 1, 'All gifts start within one second');
  assert.ok(await page.evaluate(() => choreography.gifts[0].at - choreography.illuminate.at) > 0, 'Lights start before gifts');
  assert.ok(await page.evaluate(() => choreography.gifts[0].at - choreography.illuminate.at) < 0.5, 'Light-up leads gifts only slightly');
  const waitAfterGifts = await page.evaluate(() => choreography.spin.at - (choreography.gifts.at(-1).at + 0.85));
  assert.ok(Math.abs(waitAfterGifts) <= 0.25, 'Spin overlaps the end of the final gift reveal without a dead hold');
  assert.ok(await page.evaluate(() => renderer.weekLights.every(light => renderer.geometry.reveal[light.index] <= 10.6)), 'Every light is on within 0.6 seconds');
  assert.ok(await page.evaluate(() => renderer.counts.flakes) >= 1500, 'Heavy snow substantially increases particle count');
  await seek(0);
  assert.ok(await page.evaluate(() => context.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)), 'Snow visible immediately');
  await seek(0.65); await screenshot('base');
  await seek(6); await screenshot('overlap');
  const transform = await page.locator('#code-flow').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m42);
  await seek(6 + 1 / 30);
  const moved = await page.locator('#code-flow').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m42);
  assert.ok(Math.abs(moved - transform + 11.2) < 0.01, 'Code scrolls continuously by 11.2px every frame');
  await seek(17); await screenshot('final');
  const first = await page.screenshot();
  await seek(4); await seek(17);
  assert.deepEqual(await page.screenshot(), first, 'Frame rendering is seek-order independent');
  await page.waitForTimeout(150);
  assert.deepEqual(await page.screenshot(), first, 'Video export has no live animation');
  for (const time of [12, 13.5, 15, 16.5, 17.9]) {
    await seek(time);
    assert.ok(await page.evaluate(() => renderer.giftLabels.every(label => label.y < canvas.height - 25)), `Gift labels stay inside scene at ${time}s`);
  }
  await page.goto(url);
  await page.waitForFunction(() => window.gitmasVideo);
  await page.locator('#play').click();
  await page.locator('#timeline').evaluate(input => { input.value = '8'; input.dispatchEvent(new Event('input')); });
  assert.equal(await page.evaluate(() => seconds), 8);
  await page.locator('#replay').click();
  assert.ok(await page.evaluate(() => seconds) < 1);
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Preview fits ${width}px viewport`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForFunction(() => window.gitmasVideo);
  assert.deepEqual(await page.evaluate(() => ({ seconds, playing })), { seconds: 18, playing: false });
  assert.deepEqual(errors, []);
  console.log('Short-form preview verified: 9:16, 18s, instant gift-to-spin transition, 0.6s light-up, continuous scan, deterministic frames.');
} finally {
  await browser.close();
}
