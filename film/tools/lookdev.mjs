import { chromium } from "playwright";
import { spawn } from "node:child_process";
const b = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on("console", (m) => { if (m.type() !== "debug") console.log("[page]", m.text()); });
await p.goto("http://127.0.0.1:5180/?samples=1");
await p.waitForFunction(() => window.film && window.film.ready);
const variants = JSON.parse(process.argv[2]);
for (const [name, patch] of Object.entries(variants)) {
  const b64 = await p.evaluate(([patch, process_t]) => {
    window.__patch = patch;
    window.film.renderTime(Number(process_t));
    return window.film.read();
  }, [patch, Number(process.argv[3] ?? 3.5)]);
  const buf = Buffer.from(b64, "base64");
  await new Promise((res) => { const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "1920x1080", "-i", "-", "-vf", "vflip,scale=960:-1", "-frames:v", "1", `../out/test/dbg_${name}.png`]); ff.on("close", res); ff.stdin.end(buf); });
  console.log("wrote", name);
}
await b.close();
