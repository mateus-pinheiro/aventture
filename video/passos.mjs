// Ferramenta de exploração: node passos.mjs <url> <prefixo> '<js de passos>'
import { chromium } from 'playwright';
const [url, out, passos] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
await page.goto(url);
await page.waitForSelector('#loading', { state: 'hidden', timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.click('#btnHelpOk').catch(() => {});
let n = 0;
const shot = async (t = 0) => { await page.waitForTimeout(t); await page.screenshot({ path: `${out}-${++n}.png` }); };
const vis = () => page.evaluate(() => [...document.querySelectorAll('button,input,select')].filter(e => e.offsetParent).map(e => e.id || e.textContent.trim().slice(0,20)).join(' | '));
await eval(`(async () => { ${passos} })()`);
setTimeout(() => process.exit(0), 3000);
await browser.close();
process.exit(0);
