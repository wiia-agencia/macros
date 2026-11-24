// Capturas del historial y del peso con un mes de datos de verdad: las comidas se calculan con la propia calculadora.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const dir = path.resolve(__dirname, '../capturas');
const servidor = require('./servidor.js');
fs.mkdirSync(dir, { recursive: true });

/** Dentro de la página: un mes de días (cumplidos, a medias y sin apuntar) con alimentos y gramos reales. */
function sembrar(hoy) {
  const C = window.Core;
  const base = JSON.parse(document.querySelector('#datos').textContent).map((r) => ({ id: r[12] + r[13], n: r[0], e: r[1], k: r[5], p: r[6], h: r[7], g: r[8], f: r[9] || 0, r: r[15] }));
  const al = (q) => { const a = C.buscar(base, q)[0]; if (!a) throw new Error('no encuentro ' + q); return a; };
  const META = { kcal: 2140, p: 165, h: 235, g: 60 };
  const MENUS = {
    'Desayuno': [['cafe con leche', 'pan tostado', 'aguacate', 'pechuga de pollo en lonchas'], ['copos de avena', 'leche semidesnatada', 'platano', 'queso fresco batido']],
    'Comida': [['arroz blanco cocido', 'pechuga de pollo asada', 'aceite de oliva', 'brocoli cocido'], ['pasta cocida', 'atun al natural', 'tomate', 'aceite de oliva'], ['lentejas cocidas', 'pechuga de pavo asada', 'arroz blanco cocido', 'aceite de oliva']],
    'Merienda': [['pan blanco', 'jamon serrano', 'aceite de oliva'], ['yogur natural', 'platano', 'nueces']],
    'Cena': [['merluza', 'patata cocida', 'aceite de oliva', 'judias verdes cocidas'], ['huevo cocido', 'patata cocida', 'pechuga de pollo asada', 'lechuga']]
  };
  const HORA = { 'Desayuno': [8, 10], 'Comida': [14, 30], 'Merienda': [18, 0], 'Cena': [21, 15] };
  const comida = (nombre, k, objetivo, i) => {
    const lista = MENUS[nombre][i % MENUS[nombre].length].map((q) => ({ a: al(q) }));
    const r = C.resolver({ objetivo, items: lista });
    const f = C.fechaDe(k); f.setHours(HORA[nombre][0], HORA[nombre][1]);
    return C.apuntar(nombre, f, lista.map((x, j) => ({ a: x.a, gramos: r.gramos[j] })).filter((x) => x.gramos > 0));
  };
  const diaEntero = (k, i, cuales) => {
    const cs = []; let queda = { p: META.p, h: META.h, g: META.g };
    const plan = ['Desayuno', 'Comida', 'Merienda', 'Cena'];
    plan.forEach((nombre, j) => {
      if (cuales && cuales.indexOf(nombre) < 0) return;
      const c = comida(nombre, k, C.cuota(queda, plan.length - j, 'normal'), i + j);
      cs.push(c); queda = { p: Math.max(0, queda.p - c.t.p), h: Math.max(0, queda.h - c.t.h), g: Math.max(0, queda.g - c.t.g) };
    });
    return cs;
  };
  const dias = {}, metas = {};
  // 27 días atrás: casi todos cumplidos; alguno a medias (se saltó comidas) y alguno sin apuntar
  const AMEDIAS = { 3: ['Desayuno', 'Comida'], 9: ['Comida', 'Cena'], 10: ['Desayuno', 'Comida', 'Merienda'], 17: ['Comida'], 24: ['Desayuno', 'Cena'] }, SIN = [5, 16, 23];
  for (let n = 1; n <= 27; n++) {
    const k = C.otroDia(hoy, -n);
    if (SIN.indexOf(n) >= 0) continue;
    dias[k] = diaEntero(k, n, AMEDIAS[n]); metas[k] = META;
  }
  dias[hoy] = diaEntero(hoy, 0, ['Desayuno', 'Comida']); metas[hoy] = META;
  const pesos = [[56, 79.8], [49, 79.4], [42, 79.1], [35, 78.6], [28, 78.4], [21, 78.0], [14, 77.5], [7, 77.3], [0, 76.9]].map((x) => ({ f: C.otroDia(hoy, -x[0]), kg: x[1] }));
  return { v: 2, aspecto: 'auto', plato: { items: [], modo: 'macros', objetivo: null, ejemplo: false, comida: null, auto: true, tam: 'normal' },
    perfil: { sexo: 'h', edad: 30, peso: 76.9, altura: 178, nivel: 3, ejemplo: false },
    meta: { modo: 'mano', tipo: null, comidas: 4, mano: { p: 165, h: 235, g: 60 } }, favs: [], propios: [], platos: [], dias, metas, pesos };
}

(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const HOY = '2026-11-24';
  const nueva = async (esquema) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: esquema, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('ERROR', m.text()); });
    await p.clock.setFixedTime(new Date(`${HOY}T16:40:00+01:00`));
    await p.goto(URL); await p.waitForTimeout(500);
    const estado = await p.evaluate(sembrar, HOY);
    await p.evaluate((s) => localStorage.setItem('algramo.v1', JSON.stringify(s)), estado);
    await p.goto(URL); await p.waitForTimeout(600);
    return p;
  };
  const toca = async (p, s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); };
  const foto = async (p, n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${dir}/${n}.png` }); console.log('  ✓', n); };
  const quiere = process.argv[2] || 'todo';

  for (const esquema of ['light', 'dark']) {
    const s = esquema === 'light' ? '' : '-osc';
    const p = await nueva(esquema);
    if (quiere === 'todo' || quiere === 'historial') {
      await toca(p, '[data-a="tab"][data-v="hoy"]'); await foto(p, 'h-1-hoy' + s);
      console.log('    frase:', (await p.textContent('#hoy-sem-txt')).trim());
      await toca(p, '#hoy-semana [data-k="2026-11-23"]'); await foto(p, 'h-2-ayer' + s);
      await p.locator('#p-hoy').evaluate((el) => el.scrollTo(0, 9999)); await foto(p, 'h-2b-ayer-abajo' + s);
      await toca(p, '#hoy-semana [data-k="2026-11-21"]'); await p.locator('#p-hoy').evaluate((el) => el.scrollTo(0, 9999)); await foto(p, 'h-3-a-medias' + s);
      await toca(p, '#hoy-semana [data-k="2026-11-19"]'); await foto(p, 'h-4-sin-apuntar' + s);
      await toca(p, '#btn-cuadrar'); await toca(p, '#hoy-fecha'); await foto(p, 'h-5-mes' + s);
      console.log('    mes:', (await p.textContent('#sheet .mes-ley')).replace(/\s+/g, ' ').trim(), '|', ((await p.$('#sheet .racha')) ? (await p.textContent('#sheet .racha')).trim() : 'sin racha'));
      await toca(p, '#sheet [data-a="mes-ir"][data-d="-1"]'); await foto(p, 'h-6-mes-anterior' + s);
      await toca(p, '#sheet [data-a="cerrar"]');
    }
    if (quiere === 'todo' || quiere === 'peso') {
      await toca(p, '[data-a="tab"][data-v="macros"]'); await foto(p, 'w-1-mis-macros' + s);
      if (await p.$('[data-a="peso"]')) { await toca(p, '[data-a="peso"]'); await foto(p, 'w-2-mi-peso' + s); await p.locator('#sheet-cuerpo, #sheet .sheet-cuerpo, #sheet').first().evaluate((el) => { const c = el.querySelector('.sheet-cuerpo') || el; c.scrollTo(0, 9999); }); await foto(p, 'w-2b-mi-peso-abajo' + s); }
    }
    await p.context().close();
  }
  await b.close(); srv.cierra();
})().catch((e) => { console.error(e); process.exit(1); });
