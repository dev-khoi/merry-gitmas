import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';
import './build-demo.mjs';

const outputDir = new URL('../demo/', import.meta.url);
const output = fileURLToPath(new URL('merry-gitmas.mp4', outputDir));
const temporary = fileURLToPath(new URL('merry-gitmas.rendering.mp4', outputDir));
const fps = 30;
const width = 1080;
const height = 1920;
await mkdir(outputDir, { recursive: true });
if (!ffmpeg) throw new Error('No FFmpeg binary is available for this platform.');

const browser = await chromium.launch({ headless: true });
let encoder;
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL('../demo/index.html', import.meta.url);
  url.searchParams.set('video', '1');
  await page.goto(url.href);
  await page.waitForFunction(() => window.gitmasVideo);
  const duration = await page.evaluate(() => window.gitmasVideo.duration);
  const frames = duration * fps;
  encoder = spawn(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-metadata', 'title=Merry Gitmas — From commits to Christmas',
    '-metadata', 'artist=dev-khoi', temporary,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encoderError;
  let stderr = '';
  encoder.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12000); });
  encoder.stdin.on('error', error => { encoderError = error; });
  const finished = new Promise(resolve => {
    encoder.on('error', error => { encoderError = error; resolve(-1); });
    encoder.on('close', code => resolve(code));
  });
  console.log(`Rendering ${duration}s · ${width}×${height} · ${fps} fps (${frames} frames)`);
  for (let frame = 0; frame < frames; frame++) {
    if (encoderError || encoder.exitCode !== null) throw new Error(`FFmpeg stopped: ${stderr || encoderError?.message}`);
    if (errors.length) throw new Error(errors.join('\n'));
    await page.evaluate(time => window.gitmasVideo.renderFrame(time), frame / fps);
    const png = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide', timeout: 30000 });
    await new Promise((resolve, reject) => encoder.stdin.write(png, error => error ? reject(error) : resolve()));
    if (frame % (fps * 2) === 0) console.log(`Rendered ${(frame / fps).toFixed(0)}/${duration} seconds`);
  }
  encoder.stdin.end();
  const code = await finished;
  if (code !== 0 || encoderError) throw new Error(`FFmpeg failed (${code}): ${stderr || encoderError?.message}`);
  await rename(temporary, output);
  await page.evaluate(() => window.gitmasVideo.renderFrame(17));
  await page.screenshot({ path: fileURLToPath(new URL('video-poster.png', outputDir)) });
  const metadata = { file: 'merry-gitmas.mp4', width, height, fps, duration, frames, codec: 'h264', audio: false };
  await writeFile(new URL('video.json', outputDir), JSON.stringify(metadata, null, 2) + '\n');
  const { size } = await stat(output);
  console.log(`Video ready: ${output} (${(size / 1024 / 1024).toFixed(1)} MB)`);
} finally {
  if (encoder && encoder.exitCode === null) encoder.kill();
  await browser.close();
}
