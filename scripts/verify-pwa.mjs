#!/usr/bin/env node
// Headless Chrome check of a served/deployed copy: manifest, installability, SW, offline, sign-on, CSV, follow-ups.
// Usage: node scripts/verify-pwa.mjs [url]   (default http://127.0.0.1:8787/hextra-toolbox/)
// Needs: npm i (puppeteer-core) and Google Chrome at /usr/bin/google-chrome (or CHROME_PATH).
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const URL_ = process.argv[2] || 'http://127.0.0.1:8787/hextra-toolbox/';
const OUT = process.env.VERIFY_OUT || '/tmp/hx-verify';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' – ' + detail : ''}`); };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--lang=en-AU'],
  env: { ...process.env, TZ: 'Australia/Sydney' }
});
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
page.on('pageerror', (e) => check('no page JS errors', false, e.message));
page.on('dialog', (d) => d.accept());
const cdp = await page.createCDPSession();

await page.goto(URL_, { waitUntil: 'networkidle0' });
await page.waitForSelector('.talk h1', { timeout: 15000 });
// wait for SW to control the page
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle0' });
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
check('service worker registered and controlling page', controlled);
const swVersion = await page.evaluate(() => new Promise((res) => {
  navigator.serviceWorker.addEventListener('message', (e) => e.data && e.data.type === 'version' && res(e.data.version), { once: true });
  navigator.serviceWorker.controller.postMessage('version'); setTimeout(() => res(null), 3000);
}));
check('service worker reports cache version', !!swVersion, swVersion || '');

const manifest = await cdp.send('Page.getAppManifest');
check('manifest found and parsed without errors', !!manifest.url && manifest.errors.length === 0, manifest.url + (manifest.errors.length ? ' ' + JSON.stringify(manifest.errors) : ''));
const inst = await cdp.send('Page.getInstallabilityErrors');
check('Chrome installability: no errors', inst.installabilityErrors.length === 0, JSON.stringify(inst.installabilityErrors));
const meta = await page.evaluate(() => ({
  apple: !!document.querySelector('link[rel="apple-touch-icon"]'),
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  theme: document.querySelector('meta[name="theme-color"]')?.content
}));
check('iOS meta tags present (apple-touch-icon, web-app-capable, title, theme-color)', meta.apple && meta.capable === 'yes' && !!meta.title && !!meta.theme, JSON.stringify(meta));
const icons = await page.evaluate(async () => {
  const m = await (await fetch('manifest.webmanifest')).json();
  const out = [];
  for (const i of m.icons) { const r = await fetch(i.src); const b = await r.blob(); const bmp = await createImageBitmap(b); out.push(`${i.src} ${bmp.width}x${bmp.height} ${i.purpose}`); }
  const at = await createImageBitmap(await (await fetch('icons/apple-touch-icon.png')).blob());
  out.push(`apple-touch-icon ${at.width}x${at.height}`);
  return { out, name: m.name, short: m.short_name, display: m.display };
});
check('manifest name/short_name/display', icons.name === 'Hextra Toolbox Talks' && icons.short === 'Hextra TB Talk' && icons.display === 'standalone', `${icons.name} / ${icons.short} / ${icons.display}`);
check('icons load at declared sizes', icons.out.length === 5, icons.out.join('; '));

const talk = await page.evaluate(() => ({ title: document.querySelector('.talk h1').textContent, q: document.querySelectorAll('.questions li').length, src: document.querySelectorAll('.sources li').length }));
check('current talk renders', !!talk.title, `${talk.title} (${talk.q} questions, ${talk.src} sources)`);
await page.screenshot({ path: `${OUT}/01-phone-top.png` });

// sign-on
await page.evaluate(() => document.getElementById('signon').scrollIntoView());
await page.type('#signonForm input[name="name"]', 'Test Tech');
await page.click('#signonForm .pill:nth-of-type(1) span');
await page.type('#signonForm input[name="depot"]', 'Jindabyne');
await page.click('#signonForm input[name="attended"]');
const box = await (await page.$('#sigPad')).boundingBox();
await page.mouse.move(box.x + 20, box.y + 120); await page.mouse.down();
for (let i = 0; i <= 30; i++) await page.mouse.move(box.x + 20 + i * 9, box.y + 120 - Math.sin(i / 3) * 50, { steps: 2 });
await page.mouse.up();
await page.screenshot({ path: `${OUT}/02-signon-filled.png` });
await page.click('#signonForm button[type="submit"]');
await page.waitForFunction(() => document.getElementById('signCount').textContent === '1', { timeout: 5000 }).catch(() => {});
const count = await page.$eval('#signCount', (e) => e.textContent);
check('sign-on saved to IndexedDB', count === '1', `count=${count}`);
// validation blocks an empty submit
await page.click('#signonForm button[type="submit"]');
const errShown = await page.$eval('#formError', (e) => !e.hidden && e.textContent);
check('empty sign-on is rejected with a message', !!errShown, errShown || '');
await page.click('[data-export]');
await page.waitForFunction(() => !!window.__lastCSV, { timeout: 5000 }).catch(() => {});
const csv = await page.evaluate(() => window.__lastCSV || '');
const lines = csv.trim().split('\r\n');
check('CSV export has header + 1 row incl. signature', lines.length === 2 && lines[0].startsWith('talk_id,talk_title') && lines[1].includes('Test Tech') && lines[1].includes('data:image/png;base64'), lines[1]?.slice(0, 160));
// follow-up tick persists
await page.evaluate(() => localStorage.setItem('hx-set-supervisor', 'Test Supervisor'));
await page.click('[data-fu-box="0"]');
await new Promise((r) => setTimeout(r, 400));
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForSelector('.talk h1');
await new Promise((r) => setTimeout(r, 500));
const fu = await page.$eval('[data-fu="0"]', (li) => ({ checked: li.querySelector('input').checked, done: li.querySelector('.fu-done').textContent }));
check('follow-up tick persists after reload', fu.checked, fu.done);
await page.evaluate(() => document.getElementById('signon').scrollIntoView());
await page.screenshot({ path: `${OUT}/03-signed.png` });

// print stylesheet -> PDF
await page.emulateMediaType('print');
await page.pdf({ path: `${OUT}/talk-print.pdf`, format: 'A4', printBackground: true });
await page.emulateMediaType(null);
check('print/PDF rendered', true, `${OUT}/talk-print.pdf`);

// offline
await page.setOfflineMode(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.talk h1', { timeout: 10000 }).catch(() => {});
const offTitle = await page.$eval('.talk h1', (e) => e.textContent).catch(() => null);
check('works offline (reload with network off)', !!offTitle, offTitle || '');
await page.goto(URL_ + '#/archive', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForSelector('.archive li', { timeout: 8000 }).catch(() => {});
const arch = await page.$$eval('.archive li', (l) => l.length).catch(() => 0);
check('archive available offline', arch > 0, `${arch} talk(s)`);
await page.screenshot({ path: `${OUT}/04-archive-offline.png` });
await page.setOfflineMode(false);

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
