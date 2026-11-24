// El arranque. Quien ya usaba la versión anterior (abría en «Pongo los gramos»): al actualizar no pierde nada y la app abre
// ya en lo que toca. Y quien empieza por el plato de ejemplo: en cuanto lo usa, es suyo.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('path');
const servidor = require('./servidor.js');
const base = (plato, extra) => Object.assign({
  v: 1, aspecto: 'claro', plato, perfil: { sexo: 'h', edad: 30, peso: 75, altura: 178, nivel: 3, ejemplo: false },
  meta: { modo: 'calc', tipo: 'definir', comidas: 4, mano: { p: null, h: null, g: null } }, favs: [], propios: [], platos: [], dias: {}
}, extra || {});
const MIO = [{ id: 'U11367', gramos: 320 }, { id: 'U5064', gramos: 180 }];
(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errores = [];
  const abre = async (estado) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); }); p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
    await p.clock.setFixedTime(new Date('2026-11-24T14:00:00+01:00'));
    if (estado) await p.addInitScript((s) => { if (!localStorage.getItem('algramo.v1')) localStorage.setItem('algramo.v1', s); }, JSON.stringify(estado));
    await p.goto(URL); await p.waitForTimeout(600);
    return p;
  };
  const txt = async (p, s) => (await p.textContent(s)).replace(/\s+/g, ' ').trim();
  const toca = async (p, s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); };
  const gramos = (p) => p.$$eval('#plato-filas input', (xs) => xs.map((x) => +x.value));
  const modo = (p) => p.$eval('#modos-plato [aria-selected="true"]', (x) => x.textContent.trim());
  const paso = (t) => console.log('  ✓', t);

  // A. Tenía el plato de ejemplo y no había calculado sus macros: abre en «Pongo los macros», vacío, y pide los macros del día
  let p = await abre(base({ items: [{ id: 'U11367', gramos: 300 }, { id: 'U5064', gramos: 250 }, { id: 'U11053', gramos: 100 }], modo: 'gramos', objetivo: null, ejemplo: true }, { perfil: { sexo: 'h', edad: 30, peso: 75, altura: 178, nivel: 3, ejemplo: true }, meta: { modo: 'calc', tipo: null, comidas: 4, mano: { p: null, h: null, g: null } } }));
  assert.equal(await modo(p), 'Pongo los macros'); assert.deepEqual(await gramos(p), []);
  assert.match(await txt(p, '#plato-extra'), /Dime tus macros del día/);
  await toca(p, '[data-a="platos"]'); assert.doesNotMatch(await txt(p, '#sheet'), /Lo que tenías en el plato/); paso('con el plato de ejemplo: abre vacío en «Pongo los macros»; el ejemplo no se guarda');

  // B. Tenía un plato suyo a medias y sus macros puestos: el plato pasa a «Mis platos» y la app abre en la comida que toca
  p = await abre(base({ items: MIO, modo: 'gramos', objetivo: null, ejemplo: false }));
  assert.equal(await modo(p), 'Pongo los macros'); assert.deepEqual(await gramos(p), []); assert.match(await txt(p, '#obj-rotulo'), /^Comida: te tocan \d+ kcal$/);
  await toca(p, '[data-a="platos"]'); assert.match(await txt(p, '#sheet .guardados'), /Lo que tenías en el plato/);
  await toca(p, '#sheet [data-a="cargar-plato"]'); assert.deepEqual(await gramos(p), [320, 180]); assert.equal(await modo(p), 'Pongo los gramos');
  await p.waitForTimeout(500); await p.reload(); await p.waitForTimeout(600);
  assert.deepEqual(await gramos(p), [320, 180]); await toca(p, '[data-a="platos"]');
  assert.equal((await txt(p, '#sheet .guardados')).match(/Lo que tenías en el plato/g).length, 1, 'solo se guarda una vez'); paso('con un plato a medias: se guarda en «Mis platos» con sus gramos y abre en «Comida: te tocan»');

  // C. Estaba cambiando una comida ya apuntada: se queda como estaba
  p = await abre(base({ items: MIO, modo: 'gramos', objetivo: null, ejemplo: false, cambia: { nombre: 'Desayuno', hora: '8:10', pos: 0, dia: '2026-11-24' } }));
  assert.equal(await modo(p), 'Pongo los gramos'); assert.deepEqual(await gramos(p), [320, 180]); paso('a mitad de cambiar una comida apuntada: no se toca');

  // D. Quien ya está en la versión nueva con un plato en gramos: tampoco se toca
  p = await abre(Object.assign(base({ items: MIO, modo: 'gramos', objetivo: null, ejemplo: false }), { v: 2 }));
  assert.equal(await modo(p), 'Pongo los gramos'); assert.deepEqual(await gramos(p), [320, 180]);
  await toca(p, '[data-a="platos"]'); assert.doesNotMatch(await txt(p, '#sheet'), /Lo que tenías en el plato/); paso('ya en la versión nueva: nada cambia');

  // E. El plato de ejemplo, usado en «Pongo los macros»: añadir un alimento lo suma, no borra los del ejemplo
  p = await abre(null);
  await toca(p, '[data-a="ver-ejemplo"]'); assert.equal((await gramos(p)).length, 3);
  await toca(p, '[data-a="modo"][data-v="macros"]');
  await toca(p, '[data-a="anadir"]'); await p.fill('#sheet input[type="search"]', 'arroz blanco cocido'); await p.waitForTimeout(300);
  await toca(p, '#lista-elegir [data-a="alternar"]'); await toca(p, '#sheet [data-a="cerrar"]');
  assert.equal((await gramos(p)).length, 4, 'siguen la patata, el pollo y las judías'); paso('el ejemplo, ya en «Pongo los macros»: añadir arroz lo suma a lo que había');

  assert.deepEqual(errores, [], 'sin errores de consola');
  console.log('ARRANQUE BIEN · sin errores de consola');
  await b.close(); srv.cierra();
})().catch((e) => { console.error('\nFALLO:', e.message, '\n', (e.stack || '').split('\n').filter((l) => /arranque/.test(l)).join('\n')); process.exit(1); });
