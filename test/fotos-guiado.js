// Capturas del día guiado: la app abre en «Pongo los macros», dice qué comida toca y cuánto, y calcula los gramos.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const dir = path.resolve(__dirname, '../capturas');
const servidor = require('./servidor.js');
(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const nueva = async (hora, opc) => {
    const o = Object.assign({ w: 390, h: 844, esquema: 'light' }, opc || {});
    const ctx = await b.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: 2, hasTouch: o.w < 600, isMobile: o.w < 600, colorScheme: o.esquema, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('ERROR', m.text()); });
    await p.clock.setFixedTime(new Date(`2026-11-24T${hora}:00+01:00`));
    await p.goto(URL); await p.waitForTimeout(600);
    return p;
  };
  const toca = async (p, s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); };
  const arriba = (p) => p.locator('#p-plato').evaluate((el) => el.scrollTo(0, 0));
  const foto = async (p, n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${dir}/${n}.png` }); console.log('  ✓', n); };
  const pon = async (p, lista) => {
    for (const q of lista) {
      await toca(p, '[data-a="anadir"]'); await p.fill('#sheet input[type="search"]', q); await p.waitForTimeout(300);
      await toca(p, '#lista-elegir [data-a="alternar"]'); await toca(p, '#sheet [data-a="cerrar"]');
    }
  };
  const dice = async (p, t) => console.log('    ' + t + ':', (await p.textContent('#veredicto')).replace(/\s+/g, ' ').trim(), '|', await p.$$eval('#plato-filas .fila', (xs) => xs.map((x) => x.querySelector('.fila-nombre').textContent.trim() + ' ' + x.querySelector('input').value + ' g').join(' · ')));
  const conPlan = async (p) => { await toca(p, '[data-a="tab"][data-v="macros"]'); await toca(p, '[data-a="meta"][data-v="definir"]'); await toca(p, '[data-a="tab"][data-v="plato"]'); await p.waitForTimeout(2600); };

  // 0 · La primera vez, sin macros del día
  let p = await nueva('08:10'); await foto(p, 'g-0-primera-vez');

  // 1–4 · El desayuno, paso a paso
  await conPlan(p); await foto(p, 'g-1-toca-desayuno');
  await pon(p, ['cafe con leche', 'pan tostado', 'aguacate']); await p.waitForTimeout(2600); await arriba(p); await foto(p, 'g-2-a-medias'); await dice(p, 'a medias');
  await pon(p, ['pechuga de pollo en lonchas']); await p.waitForTimeout(2600); await arriba(p); await foto(p, 'g-3-clavado'); await dice(p, 'clavado');
  await p.locator('#p-plato').evaluate((el) => el.scrollTo(0, 9999)); await foto(p, 'g-3b-clavado-abajo');
  await toca(p, '#btn-apuntar'); await foto(p, 'g-3c-que-comida'); await toca(p, '#sheet [data-a="apuntar-ya"]'); await foto(p, 'g-4-apuntado');

  // Para elegir: la línea del día con los macros (B, como está) o solo con calorías (A, una maqueta: se oculta el renglón)
  await p.waitForTimeout(5200); await foto(p, 'ab-dia-b');
  await p.evaluate(() => { document.querySelector('#t-dia .dia-macros').style.display = 'none'; }); await foto(p, 'ab-dia-a');

  // 5 · Algo entre horas
  await p.clock.setFixedTime(new Date('2026-11-24T11:30:00+01:00'));
  await toca(p, '#obj-chips [data-a="entre-horas"]'); await pon(p, ['platano']); await p.waitForTimeout(2600); await foto(p, 'g-5-entre-horas');
  await toca(p, '#btn-apuntar'); await toca(p, '#sheet [data-a="apuntar-ya"]'); await p.waitForTimeout(5400);

  // 6 · La comida y «Hoy»
  await p.clock.setFixedTime(new Date('2026-11-24T14:30:00+01:00')); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(400);
  await pon(p, ['arroz blanco cocido', 'pechuga de pollo asada', 'aceite de oliva', 'brocoli cocido']); await p.waitForTimeout(2600); await arriba(p); await foto(p, 'g-6-comida'); await dice(p, 'comida');
  await toca(p, '#btn-apuntar'); await toca(p, '#sheet [data-a="apuntar-ya"]'); await p.waitForTimeout(5400);
  await toca(p, '[data-a="tab"][data-v="hoy"]'); await foto(p, 'g-7-hoy');

  // 7b · El final del día: merienda y cena apuntadas; el plato queda para los extras
  await p.clock.setFixedTime(new Date('2026-11-24T18:00:00+01:00')); await toca(p, '#btn-cuadrar');
  await pon(p, ['pan blanco', 'jamon serrano', 'aceite de oliva']); await p.waitForTimeout(2600); await dice(p, 'merienda');
  await toca(p, '#btn-apuntar'); await toca(p, '#sheet [data-a="apuntar-ya"]'); await p.waitForTimeout(5400);
  await p.clock.setFixedTime(new Date('2026-11-24T21:15:00+01:00')); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(400);
  await pon(p, ['merluza', 'patata cocida', 'aceite de oliva', 'judias verdes cocidas']); await p.waitForTimeout(2600); await arriba(p); await foto(p, 'g-7b-cena'); await dice(p, 'cena');
  await toca(p, '#btn-apuntar'); await toca(p, '#sheet [data-a="apuntar-ya"]'); await p.waitForTimeout(5400); await foto(p, 'g-7c-dia-completo');
  await toca(p, '[data-a="tab"][data-v="hoy"]'); await foto(p, 'g-7d-hoy-completo');

  // 8 · Un caso límite (90 / 250 / 5): no se pasa de la grasa; dice qué falta y por qué
  p = await nueva('14:05'); await toca(p, '[data-a="ver-ejemplo"]'); await toca(p, '[data-a="modo"][data-v="macros"]');
  for (const [m, v] of [['p', '90'], ['h', '250'], ['g', '5']]) await p.fill(`[data-in="obj"][data-m="${m}"]`, v);
  await p.locator('[data-in="obj"][data-m="g"]').blur(); await foto(p, 'g-8-90-250-5'); await dice(p, '90/250/5');
  await pon(p, ['arroz blanco cocido']); await p.waitForTimeout(2600); await arriba(p); await foto(p, 'c-macros-ahora'); await dice(p, '90/250/5 con arroz');

  // 9 · Oscuro, móvil estrecho y escritorio
  p = await nueva('08:10', { esquema: 'dark' }); await conPlan(p); await pon(p, ['cafe con leche', 'pan tostado', 'aguacate', 'pechuga de pollo en lonchas']); await p.waitForTimeout(2600); await arriba(p); await foto(p, 'g-9-oscuro');
  p = await nueva('08:10', { w: 360, h: 740 }); await conPlan(p); await pon(p, ['cafe con leche', 'pan tostado', 'aguacate']); await p.waitForTimeout(2600); await arriba(p); await foto(p, 'g-9-movil-360');
  p = await nueva('08:10', { w: 1280, h: 860 }); await conPlan(p); await pon(p, ['cafe con leche', 'pan tostado', 'aguacate']); await p.waitForTimeout(2600); await foto(p, 'g-9-escritorio');
  await b.close(); srv.cierra();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
