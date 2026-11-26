// Usage:
//   node render.js stills out/stills 1.0 5.2 ...      -> PNG stills at given seconds
//   node render.js frames out/frames <from> <to> [fps] -> JPEG frames (frame index from 'from')
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.otf': 'font/otf', '.json': 'application/json' };
function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, resp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { resp.writeHead(404); return resp.end(); }
      resp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(resp);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  const el = await page.$('#wrap');
  if (mode === 'stills') {
    for (const t of rest.map(Number)) {
      await page.evaluate((t) => window.renderAt(t), t);
      await el.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`) });
      console.log('still', t);
    }
  } else {
    const from = Number(rest[0]), to = Number(rest[1]), fps = Number(rest[2] || 30);
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      await page.evaluate((t) => window.renderAt(t), f / fps);
      await el.screenshot({ path: path.join(out, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
      if (f % 60 === 0) console.log(`frame ${f} (${((Date.now() - t0) / (f - from + 1)).toFixed(0)} ms/frame)`);
    }
  }
  await browser.close(); srv.close();
})();
