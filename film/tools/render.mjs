// Offline renderer: drives the page frame by frame on the GPU and pipes raw
// RGBA into ffmpeg (or writes PNG stills).
//
//   node tools/render.mjs --still 3.2,10.5 --out ../out/stills [--samples 4]
//   node tools/render.mjs --from 0 --to 8.57 --out ../out/seg.mkv [--codec ffv1|x264] [--samples 12]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith("--")) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "1"]);
  return a;
}, []));
const URL = args.url ?? "http://127.0.0.1:5180/";
const W = 1920, H = 1080;

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization",
    "--disable-gpu-vsync", "--disable-frame-rate-limit", "--force-color-profile=srgb"],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.error("[page]", m.text()); });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(URL + "?" + [args.samples ? `samples=${args.samples}` : "", args.scale ? `sampleScale=${args.scale}` : ""].filter(Boolean).join("&"));
await page.waitForFunction(() => window.film && (window.film.ready || window.film.error), null, { timeout: 120000 });
const err = await page.evaluate(() => window.film.error);
if (err) { console.error(err); process.exit(1); }
const info = await page.evaluate(() => ({ fps: window.film.fps, duration: window.film.duration, shots: window.film.shots }));
const fps = Number(args.fps ?? info.fps);

async function grab(t) {
  const b64 = await page.evaluate((tt) => { window.film.renderTime(tt); return window.film.read(); }, t);
  return Buffer.from(b64, "base64");
}

function flipToPng(buf, file) {
  return new Promise((res, rej) => {
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "-",
      "-vf", "vflip", "-frames:v", "1", file]);
    ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c))));
    ff.stdin.end(buf);
  });
}

if (args.still) {
  const out = args.out ?? "../out/stills";
  fs.mkdirSync(out, { recursive: true });
  for (const s of String(args.still).split(",")) {
    const t = Number(s);
    const t0 = Date.now();
    const buf = await grab(t);
    const f = path.join(out, `t${t.toFixed(3)}.png`);
    await flipToPng(buf, f);
    console.log(f, `${Date.now() - t0} ms`);
  }
} else {
  const from = Number(args.from ?? 0), to = Number(args.to ?? info.duration);
  const out = args.out ?? "../out/render.mkv";
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const codec = args.codec ?? (out.endsWith(".mkv") ? "ffv1" : "x264");
  const enc = codec === "ffv1"
    ? ["-c:v", "ffv1", "-level", "3", "-pix_fmt", "rgb24"]
    : ["-c:v", "libx264", "-preset", "medium", "-crf", String(args.crf ?? 14), "-pix_fmt", "yuv420p", "-tune", "film"];
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-framerate", String(fps), "-i", "-",
    "-vf", "vflip", ...enc, out], { stdio: ["pipe", "inherit", "inherit"] });
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  const T0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await grab((f + 0.0) / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if ((f - f0) % 30 === 0) {
      const el = (Date.now() - T0) / 1000, done = f - f0 + 1;
      process.stdout.write(`frame ${f} (${done}/${f1 - f0})  ${(el / done * 1000).toFixed(0)} ms/f  eta ${((f1 - f - 1) * el / done).toFixed(0)} s\n`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", out, `${((Date.now() - T0) / 1000).toFixed(1)} s`);
}
await browser.close();
