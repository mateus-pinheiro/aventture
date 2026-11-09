// Gera as capturas das demos para o site.
// Uso: node cenas.mjs [girando] [sol] [mapa] [passeio] [calabasas]   (sem argumentos = todas)
// Saída: ./videos/<cena>.mp4 (vídeo original) e ../assets/capturas/<cena>.mp4|.jpg (usados no index.html)
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const DEMO = 'https://demo.aventture.com.br/';
const CALABASAS = 'https://demo.aventture.com.br/calabasas/';
const VIDEOS = './videos';
const CAPTURAS = '../assets/capturas';
const HD = { width: 1280, height: 720 };

const POPUPS = ['#help', '#coach', '#toast', '#tooltip'];
const INTERFACE = ['#btnUI', '#btnHelp', '#tourStop', '#panel', '#interiorBar', '#timebar', '#legal', '#compass',
  '#mbar', '#msheet', '#miniCard', '#mlegend', '#brand', '#topFade'];

const ffmpeg = (...args) => execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', ...args]);

// Abre a página pronta para a cena. Com `video`, grava desde a abertura e devolve `iniciar()`, que marca
// onde o vídeo final começa (o carregamento é cortado depois).
async function abrir(url, { video = false, semUI = false, giro = 0, viewport = HD, escala = 1 } = {}) {
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: escala,
    ...(video && { recordVideo: { dir: `${VIDEOS}/.tmp`, size: viewport } }),
  });
  if (giro) {
    // Liga o autoRotate do OrbitControls direto no bundle.
    await context.route('**/assets/index-*.js', async (route) => {
      const res = await route.fetch();
      const js = (await res.text()).replace(
        'this.autoRotate=!1,this.autoRotateSpeed=2',
        `this.autoRotate=!0,this.autoRotateSpeed=${giro}`,
      );
      await route.fulfill({ response: res, body: js });
    });
  }
  await context.addInitScript((seletores) => {
    const css = document.createElement('style');
    css.textContent = `${seletores}{display:none!important}`;
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
  }, [...POPUPS, ...(semUI ? INTERFACE : [])].join(','));

  const page = await context.newPage();
  const aberto = Date.now();
  await page.goto(url);
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.click('#btnHelpOk', { timeout: 2000 }).catch(() => {});
  await page.mouse.move(0, 0);

  let inicio = 0;
  return {
    page,
    iniciar: () => { inicio = (Date.now() - aberto) / 1000; },
    async fechar(nome, duracao) {
      const bruto = video && (await page.video().path());
      await context.close();
      await browser.close();
      if (!video) return;
      ffmpeg('-ss', String(inicio), '-i', bruto, '-t', String(duracao), '-c:v', 'libx264', '-crf', '18',
        '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${VIDEOS}/${nome}.mp4`);
      rmSync(`${VIDEOS}/.tmp`, { recursive: true, force: true });
    },
  };
}

// Versão leve para o site (<video autoplay muted loop>): 960px, sem áudio, mais o primeiro quadro como poster.
function web(nome, { duracao = 10 } = {}) {
  ffmpeg('-i', `${VIDEOS}/${nome}.mp4`, '-t', String(duracao), '-an', '-vf', 'scale=960:-2:flags=lanczos',
    '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    `${CAPTURAS}/${nome}.mp4`);
  ffmpeg('-i', `${CAPTURAS}/${nome}.mp4`, '-frames:v', '1', '-q:v', '4', `${CAPTURAS}/${nome}.jpg`);
}

const cenas = {
  // Maquete girando sozinha, sem interface.
  async girando() {
    const s = await abrir(DEMO, { video: true, semUI: true, giro: 0.4, viewport: { width: 1920, height: 1080 } });
    s.iniciar();
    await s.page.waitForTimeout(40000);
    await s.fechar('maquete-girando', 40);
    web('maquete-girando', { duracao: 20 });
  },

  // Dentro do apto 1204 (face Sul/Oeste), 21 de junho, das 12h30 às 17h30: o sol entra na sala.
  async sol() {
    const s = await abrir(DEMO, { video: true });
    const { page } = s;
    await page.mouse.click(HD.width * 0.494, HD.height * 0.422);
    await page.click('#btnEnter');
    await page.waitForTimeout(3000);
    await page.click('button[data-d="2026-06-21"]');
    const hora = (h) => page.$eval('#timeRange', (e, v) => {
      e.value = v;
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }, h);
    await hora(12.5);
    await page.waitForTimeout(1500);
    s.iniciar();
    await page.evaluate(() => new Promise((fim) => {
      const e = document.getElementById('timeRange');
      const t0 = performance.now();
      const passo = (t) => {
        const k = Math.min((t - t0) / 12000, 1);
        e.value = 12.5 + 5 * k;
        e.dispatchEvent(new Event('input', { bubbles: true }));
        k < 1 ? requestAnimationFrame(passo) : fim();
      };
      requestAnimationFrame(passo);
    }));
    await page.waitForTimeout(800);
    await s.fechar('sol-direto-na-planta', 13);
    web('sol-direto-na-planta', { duracao: 13 });
  },

  // Mapa de disponibilidade ligado, girando devagar, trocando o filtro de planta.
  async mapa() {
    const s = await abrir(DEMO, { video: true, giro: 0.5 });
    const { page } = s;
    await page.click('label:has(#modeAvail)').catch(() => page.$eval('#modeAvail', (e) => e.click()));
    await page.waitForTimeout(1500);
    s.iniciar();
    await page.waitForTimeout(5000);
    await page.selectOption('#fTyp', { index: 1 });
    await page.waitForTimeout(4500);
    await page.selectOption('#fTyp', { index: 2 });
    await page.waitForTimeout(4500);
    await s.fechar('mapa-de-disponibilidade', 14);
    web('mapa-de-disponibilidade', { duracao: 14 });
  },

  // Calabasas: percurso pelas áreas externas de lazer, sem interface.
  async passeio() {
    const s = await abrir(CALABASAS, { video: true, semUI: true });
    const { page } = s;
    await page.$eval('#btnLazer', (e) => e.click());
    await page.waitForTimeout(3000);
    const ir = (nome) => page.evaluate((n) => {
      [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(n))?.click();
    }, nome);
    await ir('Pergolado');
    await page.waitForTimeout(3000);
    s.iniciar();
    const paradas = ['Piscina', 'Prainha', 'Bar molhado', 'Quiosques', 'Quadra de tênis', 'Vagas de barco'];
    for (const p of paradas) {
      await ir(p);
      await page.waitForTimeout(3500);
    }
    await s.fechar('passeio-pelo-lazer', paradas.length * 3.5);
    web('passeio-pelo-lazer', { duracao: paradas.length * 3.5 });
  },

  // Screenshot 21:9 da maquete do Calabasas, sem interface.
  async calabasas() {
    const s = await abrir(CALABASAS, { semUI: true, viewport: { width: 1680, height: 720 }, escala: 2 });
    await s.page.waitForTimeout(3000);
    await s.page.screenshot({ path: `${VIDEOS}/maquete-do-calabasas.png` });
    await s.fechar();
    ffmpeg('-i', `${VIDEOS}/maquete-do-calabasas.png`, '-vf', 'scale=2400:-1:flags=lanczos', '-q:v', '3',
      `${CAPTURAS}/maquete-do-calabasas.jpg`);
  },
};

mkdirSync(VIDEOS, { recursive: true });
mkdirSync(CAPTURAS, { recursive: true });
const pedidas = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(cenas);
for (const nome of pedidas) {
  console.log(`→ ${nome}`);
  await cenas[nome]();
}
console.log('Pronto.');
process.exit(0);
