// El peso en «Mis macros»: apuntarlo, ver cómo va (cambio, gráfica y lista), cambiarlo, borrarlo y que mueva los macros calculados.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const servidor = require('./servidor.js');

const PESOS = [['2026-09-29', 79.8], ['2026-10-06', 79.4], ['2026-10-13', 79.1], ['2026-10-20', 78.6], ['2026-10-27', 78.4], ['2026-11-03', 78], ['2026-11-10', 77.5], ['2026-11-17', 77.3]].map((x) => ({ f: x[0], kg: x[1] }));
const CON_HISTORIA = {
  v: 2, aspecto: 'claro', plato: { items: [], modo: 'macros', objetivo: null, ejemplo: false, comida: null, auto: true, tam: 'normal' },
  perfil: { sexo: 'h', edad: 30, peso: 77.3, altura: 178, nivel: 3, ejemplo: false },
  meta: { modo: 'mano', tipo: null, comidas: 4, mano: { p: 165, h: 235, g: 60 } }, favs: [], propios: [], platos: [], dias: {}, metas: {}, pesos: PESOS
};

(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errores = [];
  const nueva = async (estado) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
    await p.clock.setFixedTime(new Date('2026-11-24T10:00:00+01:00'));
    if (estado) await p.addInitScript((s) => { if (!localStorage.getItem('algramo.v1')) localStorage.setItem('algramo.v1', s); }, JSON.stringify(estado));
    await p.goto(URL); await p.waitForTimeout(600);
    return p;
  };
  const paso = (t) => console.log('  ✓', t);
  const ayudas = (p) => ({
    txt: async (s) => (await p.textContent(s)).replace(/\s+/g, ' ').trim(),
    toca: async (s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); },
    guardado: () => p.evaluate(() => JSON.parse(localStorage.getItem('algramo.v1'))),
    filas: () => p.$$eval('#sheet .kg-fila', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim())),
    apunta: async (v) => { await p.fill('#kg-in', v); await p.locator('[data-a="peso-apuntar"]').click(); await p.waitForTimeout(450); }
  });

  // 1. La primera vez: la fila invita a apuntarlo; se apunta desde la hoja y cambia el peso del cálculo
  let p = await nueva(), a = ayudas(p);
  await a.toca('[data-a="tab"][data-v="macros"]');
  assert.match(await a.txt('[data-a="peso"]'), /^Mi peso Apúntalo de vez en cuando y verás cómo va\./);
  const antes = await a.txt('[data-a="meta"][data-v="mantener"] .meta-kcal');
  await a.toca('[data-a="peso"]');
  assert.equal(await a.txt('#sheet-h'), 'Mi peso');
  assert.equal(await p.inputValue('#kg-in'), '', 'con el perfil de ejemplo no propone un peso');
  assert.equal(await a.txt('[data-a="peso-apuntar"]'), 'Apuntar el peso de hoy');
  await a.apunta('78,4');
  let g = await a.guardado();
  assert.deepEqual(g.pesos, [{ f: '2026-11-24', kg: 78.4 }]); assert.equal(g.perfil.peso, 78.4);
  assert.deepEqual(await a.filas(), ['Hoy 78,4 kg']);
  assert.equal(await a.txt('[data-a="peso-apuntar"]'), 'Cambiar el peso de hoy');
  assert.equal(await p.locator('#kg-grafica').count(), 0, 'con un solo peso no hay gráfica');
  await a.toca('#sheet [data-a="cerrar"]');
  assert.match(await a.txt('[data-a="peso"]'), /^Mi peso: 78,4 kg Apuntado hoy/);
  assert.equal(await p.inputValue('[data-in="perfil"][data-k="peso"]'), '78,4');
  assert.notEqual(await a.txt('[data-a="meta"][data-v="mantener"] .meta-kcal'), antes, 'los macros calculados se mueven con el peso');
  paso('la primera vez: se apunta desde la hoja, queda en la fila y mueve los macros calculados');

  // 2. Cambiar el peso del perfil también lo apunta (uno por día); un valor a medio escribir, no
  await p.fill('[data-in="perfil"][data-k="peso"]', '80'); await p.waitForTimeout(450);
  g = await a.guardado(); assert.deepEqual(g.pesos, [{ f: '2026-11-24', kg: 80 }]);
  assert.match(await a.txt('[data-a="peso"]'), /^Mi peso: 80 kg/);
  await p.fill('[data-in="perfil"][data-k="peso"]', '8'); await p.waitForTimeout(450);
  g = await a.guardado(); assert.deepEqual(g.pesos, [{ f: '2026-11-24', kg: 80 }], '«8» no es un peso');
  paso('cambiar el peso en tus datos también lo apunta; «8» a medio escribir, no');
  await p.context().close();

  // 3. Con dos meses apuntados: cuánto ha cambiado, la gráfica y la lista (lo último, arriba)
  p = await nueva(CON_HISTORIA); a = ayudas(p);
  await a.toca('[data-a="tab"][data-v="macros"]');
  assert.match(await a.txt('[data-a="peso"]'), /^Mi peso: 77,3 kg 2,5 kg menos en 7 semanas/);
  await a.toca('[data-a="peso"]');
  assert.equal(await p.inputValue('#kg-in'), '77,3');
  assert.equal(await a.txt('#kg-resumen'), '2,5 kg menos en 7 semanas');
  assert.equal(await p.$$eval('#kg-grafica .kg-pt', (xs) => xs.length), 8);
  assert.match(await p.getAttribute('#kg-grafica', 'aria-label'), /de 79,8 kg el 29 sep a 77,3 kg el 17 nov/);
  let filas = await a.filas(); assert.equal(filas.length, 8); assert.equal(filas[0], '17 nov 77,3 kg'); assert.equal(filas[7], '29 sep 79,8 kg');
  await a.apunta('76,9');
  assert.equal(await a.txt('#kg-resumen'), '2,9 kg menos en 8 semanas');
  filas = await a.filas(); assert.equal(filas.length, 9); assert.equal(filas[0], 'Hoy 76,9 kg');
  assert.equal(await p.$$eval('#kg-grafica .kg-pt', (xs) => xs.length), 9);
  paso('con historia: «2,5 kg menos en 7 semanas», gráfica con sus puntos y lista; al apuntar hoy, 8 semanas');

  // 4. Tocar la gráfica dice el peso de ese día
  assert.equal(await a.txt('#kg-lectura'), 'Del 29 sep a hoy');
  const caja = await p.locator('#kg-grafica').boundingBox();
  await p.mouse.click(caja.x + 4, caja.y + caja.height / 2); await p.waitForTimeout(200);
  assert.equal(await a.txt('#kg-lectura'), '29 sep: 79,8 kg');
  await p.mouse.click(caja.x + caja.width - 4, caja.y + caja.height / 2); await p.waitForTimeout(200);
  assert.equal(await a.txt('#kg-lectura'), 'Hoy: 76,9 kg');
  paso('tocar la gráfica dice el peso de ese día');

  // 5. Cambiar el de hoy no añade otro
  await a.apunta('77');
  filas = await a.filas(); assert.equal(filas.length, 9); assert.equal(filas[0], 'Hoy 77 kg');
  g = await a.guardado(); assert.equal(g.pesos.length, 9); assert.equal(g.perfil.peso, 77);
  paso('cambiar el peso de hoy lo sustituye');

  // 6. Borrar uno: el peso del cálculo vuelve al anterior; «Deshacer» lo devuelve
  await a.toca('#sheet [data-a="peso-quitar"][data-f="2026-11-24"]');
  g = await a.guardado(); assert.equal(g.pesos.length, 8); assert.equal(g.perfil.peso, 77.3);
  assert.equal((await a.filas())[0], '17 nov 77,3 kg');
  await a.toca('#toast [data-a="toast"]');
  g = await a.guardado(); assert.equal(g.pesos.length, 9); assert.equal(g.perfil.peso, 77);
  assert.equal((await a.filas())[0], 'Hoy 77 kg');
  paso('borrar un peso y deshacer');

  // 7. Un peso imposible no se apunta y lo dice; al recargar sigue todo
  await a.apunta('7');
  g = await a.guardado(); assert.equal(g.pesos.length, 9);
  assert.match(await a.txt('#toast'), /entre 30 y 300 kg/);
  await p.reload(); await p.waitForTimeout(600);
  await a.toca('[data-a="tab"][data-v="macros"]');
  assert.match(await a.txt('[data-a="peso"]'), /^Mi peso: 77 kg 2,8 kg menos en 8 semanas/);
  paso('un peso imposible no se apunta; al recargar sigue todo');

  // 7b. Intro en el campo lo apunta; con el teclado abierto la hoja sube para no quedar tapada (teclado simulado)
  await a.toca('[data-a="peso"]');
  await p.fill('#kg-in', '76,5'); await p.press('#kg-in', 'Enter'); await p.waitForTimeout(450);
  g = await a.guardado(); assert.equal(g.pesos[g.pesos.length - 1].kg, 76.5, 'Intro apunta el peso');
  const alto = await p.evaluate(() => window.innerHeight);
  await p.evaluate(() => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 444 }); window.visualViewport.dispatchEvent(new Event('resize')); });
  await p.waitForTimeout(450);
  assert.equal(await p.evaluate(() => Math.round(window.innerHeight - document.querySelector('#sheet').getBoundingClientRect().bottom)), alto - 444, 'la hoja queda justo encima del teclado');
  assert.ok(await p.evaluate(() => document.querySelector('#sheet').getBoundingClientRect().top >= 0), 'y no se sale por arriba');
  await p.evaluate(() => { delete window.visualViewport.height; window.visualViewport.dispatchEvent(new Event('resize')); });
  await p.waitForTimeout(450);
  assert.equal(await p.evaluate(() => Math.round(window.innerHeight - document.querySelector('#sheet').getBoundingClientRect().bottom)), 0, 'al cerrarse el teclado vuelve abajo');
  paso('Intro apunta el peso; con el teclado abierto la hoja sube y, al cerrarse, vuelve');

  // 8. Un estado guardado con pesos rotos no rompe nada
  await p.context().close();
  p = await nueva(Object.assign({}, CON_HISTORIA, { pesos: [{ f: '2026-11-17', kg: 77.3 }, { f: 'ayer', kg: 70 }, null, { f: '2026-11-10', kg: 5 }] })); a = ayudas(p);
  await a.toca('[data-a="tab"][data-v="macros"]');
  assert.match(await a.txt('[data-a="peso"]'), /^Mi peso: 77,3 kg Apuntado el 17 nov/);
  paso('unos pesos guardados a medias no rompen nada');

  await b.close(); srv.cierra();
  assert.deepEqual(errores, [], 'errores de consola');
  console.log('PESO BIEN · sin errores de consola');
})().catch((e) => { console.error(e); process.exit(1); });
