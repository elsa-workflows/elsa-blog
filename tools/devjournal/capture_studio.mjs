// DevJournal · reference Puppeteer driver for interactive Elsa Studio screenshots.
//
// NOT a repo dependency. Run from a scratch dir against the already-installed
// system Chrome:
//
//   mkdir -p /tmp/shotdriver && cd /tmp/shotdriver
//   npm init -y && npm i puppeteer-core
//   cp <repo>/tools/devjournal/capture_studio.mjs .
//   node capture_studio.mjs
//
// Assumes a Studio shell is already running (see studio-screenshots.md).
// Edit STUDIO, OUT, and the steps at the bottom for the week you are capturing.

import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const STUDIO = process.env.STUDIO || 'http://localhost:5089';
const OUT = process.env.OUT || '/tmp/studio-shots';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  ignoreHTTPSErrors: true,
  defaultViewport: { width: 1600, height: 900 },
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--ignore-certificate-errors'],
});
const page = await browser.newPage();

/** Click the first button/link whose trimmed text exactly matches one of `texts`. */
async function clickText(texts) {
  return page.evaluate((texts) => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')];
    for (const t of texts) {
      const el = els.find((e) => e.textContent.trim() === t);
      if (el) { el.click(); return t; }
    }
    return null;
  }, texts);
}

/** Set a React-controlled input/textarea/select value so change handlers fire. */
async function setValue(selector, value) {
  return page.evaluate((selector, value) => {
    const el = document.querySelector(selector);
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, selector, value);
}

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name, page.url());
}

async function goto(pathname) {
  await page.goto(`${STUDIO}${pathname}`, { waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {});
  await sleep(3000);
}

// ---- Steps: edit for the week you are capturing --------------------------

// Dashboard (backend "Connected" if step 2 of the runbook is running).
await goto('/');
await shot('dashboard');

// Create a workflow through the real UI so Definitions/designer populate.
await goto('/workflows/definitions');
await clickText(['Create']);
await sleep(2500);
await setValue('[role="dialog"] input', 'Order Approval');
await setValue('[role="dialog"] textarea', 'Approve or reject an order based on amount.');
await sleep(500);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.trim() === 'Create');
  b && b.click();
});
await sleep(6000);
await shot('designer');

// Drive a Weaver conversation (select the github-copilot agent first).
await setValue('select', 'github-copilot');
await sleep(1000);
await setValue('textarea', 'Add a Write Line activity to the root that logs "Order received".');
await clickText(['Send']);
for (let i = 1; i <= 12; i++) { await sleep(10000); await shot(`weaver-${String(i).padStart(2, '0')}`); }

await browser.close();
console.log('done');
