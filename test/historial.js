// El historial dentro de «Hoy»: la tira de los últimos 7 días, ver otro día, el mes con sus días cumplidos y la racha.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const servidor = require('./servidor.js');

const comida = (nombre, hora, p, h, g) => ({ nombre, hora, items: [{ id: 'U11367', n: 'Patata', e: 'cocida', gramos: 300 }], t: { kcal: 4 * p + 4 * h + 9 * g, p, h, g, f: 5 } });
const ESTADO = {
  v: 2, aspecto: 'claro', plato: { items: [], modo: 'gramos', objetivo: null, ejemplo: false, comida: null },
  perfil: { sexo: 'h', edad: 30, peso: 75, altura: 178, nivel: 3, ejemplo: false },
  meta: { modo: 'mano', tipo: null, comidas: 4, mano: { p: 165, h: 235, g: 60 } }, favs: [], propios: [], platos: [],
  dias: {
    '2026-11-20': [comida('Comida', '14:00', 165, 235, 60)],                      // cumplido
    '2026-11-21': [comida('Comida', '14:00', 60, 70, 50), comida('Cena', '21:30', 40, 50, 30)],   // a medias: 100 / 120 / 80
    '2026-11-23': [comida('Comida', '14:00', 120, 180, 50)],                      // cumplido con el objetivo que tenía ese día
    '2026-11-24': [comida('Desayuno', '8:10', 40, 60, 15)]                        // hoy, en marcha
  },
  metas: { '2026-11-23': { kcal: 1650, p: 120, h: 180, g: 50 } }
};

(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
  await p.clock.setFixedTime(new Date('2026-11-24T18:00:00+01:00'));       // martes por la tarde
  await p.addInitScript((s) => { if (!localStorage.getItem('algramo.v1')) localStorage.setItem('algramo.v1', s); }, JSON.stringify(ESTADO));
  await p.goto(URL); await p.waitForTimeout(600);
  const txt = async (s) => (await p.textContent(s)).replace(/\s+/g, ' ').trim();
  const toca = async (s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); };
  const paso = (t) => console.log('  ✓', t);
  const guardado = () => p.evaluate(() => JSON.parse(localStorage.getItem('algramo.v1')));
  const marcas = (raiz) => p.$$eval(`${raiz} .marca`, (xs) => xs.map((x) => x.className.replace('marca', '').trim()));
  const dia = async (k) => toca(`#hoy-semana [data-a="ver-dia"][data-k="${k}"]`);

  // 1. La tira: los últimos 7 días con su marca, hoy al final y resaltado, y la cuenta en una frase
  await toca('[data-a="tab"][data-v="hoy"]');
  assert.equal(await txt('#hoy-titulo'), 'Hoy');
  assert.deepEqual(await p.$$eval('#hoy-semana [data-a="ver-dia"]', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ''))), ['X18', 'J19', 'V20', 'S21', 'D22', 'L23', 'M24']);
  assert.deepEqual(await marcas('#hoy-semana'), ['fut', 'fut', 'ok', 'med', 'sin', 'ok', 'ya'], 'antes de empezar · antes · cumplido · a medias · sin apuntar · cumplido · hoy');
  assert.equal(await p.getAttribute('#hoy-semana [data-k="2026-11-24"]', 'aria-current'), 'true');
  assert.equal(await txt('#hoy-sem-txt'), 'Últimos 7 días: 2 cumplidos, 1 a medias y 1 sin apuntar.');
  assert.match(await txt('#hoy-cuerpo'), /Lo que llevas.*Desayuno/); paso('la tira de 7 días: cumplidos, a medias, sin apuntar y hoy en marcha');

  // 2. Tocar un día enseña ese día, medido con el objetivo que tenía entonces
  await dia('2026-11-23');
  assert.equal(await txt('#hoy-titulo'), 'Lunes 23'); assert.equal(await p.getAttribute('#hoy-semana [data-k="2026-11-23"]', 'aria-current'), 'true');
  assert.equal(await txt('#d-p'), '120'); assert.equal(await txt('#ds-p'), 'de 120 g'); assert.equal(await txt('#d-dia'), 'Ese día: 1.650 de tus 1.650 kcal.');
  assert.match(await txt('#hoy-cuerpo'), /Lo que comiste.*Comida.*Día cumplido/); assert.equal(await txt('#btn-cuadrar'), 'Volver a hoy');
  paso('el lunes 23: lo que comió y «día cumplido» con su objetivo de entonces (120 / 180 / 50)');

  // 3. Un día a medias dice en qué se quedó corto o se pasó; uno sin apuntar lo dice
  await dia('2026-11-21');
  assert.equal(await txt('#hoy-titulo'), 'Sábado 21');
  assert.match(await txt('#hoy-cuerpo .veredicto'), /^A medias Proteína: 100 de 165 g · Hidratos: 120 de 235 g · Grasa: 80 de 60 g$/);
  await dia('2026-11-22'); assert.equal(await txt('#hoy-titulo'), 'Domingo 22'); assert.match(await txt('#hoy-cuerpo'), /Ese día no apuntaste nada/);
  await toca('#btn-cuadrar'); assert.equal(await txt('#hoy-titulo'), 'Hoy'); assert.match(await txt('#hoy-cuerpo'), /Lo que llevas/); paso('a medias: dice qué faltó y qué sobró; sin apuntar: lo dice; «Volver a hoy»');

  // 4. El mes: al tocar la fecha, cada día con su marca, la cuenta y la racha
  await toca('#hoy-fecha');
  assert.equal(await txt('#sheet-h'), 'Noviembre'); assert.equal(await p.locator('#sheet .mes [data-a="ver-dia"]').count(), 30);
  const m = await marcas('#sheet .mes'); assert.equal(m.length, 30);
  assert.deepEqual(m.slice(18, 24), ['fut', 'ok', 'med', 'sin', 'ok', 'ya'], 'del 19 al 24'); assert.ok(m.slice(24).every((x) => x === 'fut'), 'lo que aún no ha llegado');
  assert.equal(await txt('#sheet .mes-ley'), '2 cumplidos 1 a medias 1 sin apuntar');
  assert.equal(await txt('#sheet .racha'), 'Llevas 1 día cumpliendo.');
  assert.equal(await p.locator('#sheet [data-a="mes-ir"][data-d="-1"]').isDisabled(), true, 'antes de noviembre no hay nada'); assert.equal(await p.locator('#sheet [data-a="mes-ir"][data-d="1"]').isDisabled(), true);
  await toca('#sheet .mes [data-k="2026-11-20"]');
  assert.equal(await p.locator('#sheet.abierto').count(), 0); assert.equal(await txt('#hoy-titulo'), 'Viernes 20'); paso('el mes: 30 días con su marca, 2 cumplidos · 1 a medias · 1 sin apuntar, y al tocar un día se abre');

  // 5. Otro día también se puede corregir: borrar una comida y deshacer
  await dia('2026-11-21'); assert.equal(await p.locator('#hoy-cuerpo .comida').count(), 2);
  await toca('#hoy-cuerpo .comida'); assert.match(await txt('#sheet'), /Comida.*Patata/); await toca('#sheet [data-a="borrar-comida"]');
  assert.equal(await p.locator('#hoy-cuerpo .comida').count(), 1); assert.equal((await guardado()).dias['2026-11-21'].length, 1); assert.equal((await guardado()).dias['2026-11-24'].length, 1, 'lo de hoy no se toca');
  await toca('#toast [data-a="toast"]'); assert.equal(await p.locator('#hoy-cuerpo .comida').count(), 2); paso('borrar una comida de otro día y deshacer');

  // 5b. Cambiar una comida de otro día: el plato avisa de cuál es, se guarda en su día y en su sitio, o se deja como estaba
  await toca('#hoy-cuerpo .comida'); await toca('#sheet [data-a="cambiar-comida"]');
  assert.match(await txt('#plato-extra'), /Cambiando la comida del sábado 21/);
  assert.equal(await txt('#btn-apuntar'), 'Guardar el cambio');
  assert.doesNotMatch(await txt('#t-dia'), /con este plato/, 'ese plato no es de hoy: no se suma a lo de hoy');
  await p.waitForTimeout(5300);                                           // se va el aviso de «Deshacer»
  await p.fill('#plato-filas .fila input', '150'); await p.locator('#plato-filas .fila input').blur(); await p.waitForTimeout(300);
  await toca('#btn-apuntar'); assert.equal(await txt('#sheet [data-a="apuntar-ya"]'), 'Guardar en el sábado 21');
  await toca('#sheet [data-a="apuntar-ya"]');
  assert.match(await txt('#toast'), /Guardada en el sábado 21: Comida/);
  let s21 = (await guardado()).dias['2026-11-21'];
  assert.deepEqual(s21.map((c) => [c.nombre, c.hora]), [['Comida', '14:00'], ['Cena', '21:30']], 'vuelve a su día, en su sitio y con su hora');
  assert.equal(s21[0].items[0].gramos, 150); assert.equal((await guardado()).dias['2026-11-24'].length, 1, 'lo de hoy no se toca');
  assert.equal(await p.locator('#plato-extra [data-a="cambio-fuera"]').count(), 0, 'el plato ya no está cambiando nada');
  await toca('[data-a="tab"][data-v="hoy"]'); await dia('2026-11-21');
  await p.locator('#hoy-cuerpo .comida').nth(1).click(); await p.waitForTimeout(450); await toca('#sheet [data-a="cambiar-comida"]');
  assert.match(await txt('#plato-extra'), /Cambiando la cena del sábado 21/);
  assert.equal((await guardado()).dias['2026-11-21'].length, 1, 'mientras se cambia, está en el plato');
  await toca('#plato-extra [data-a="cambio-fuera"]');
  s21 = (await guardado()).dias['2026-11-21'];
  assert.deepEqual(s21.map((c) => [c.nombre, c.hora, c.items[0].gramos]), [['Comida', '14:00', 150], ['Cena', '21:30', 300]], '«Dejarla como estaba» la devuelve tal cual');
  assert.equal(await txt('#hoy-titulo'), 'Sábado 21'); assert.equal(await p.locator('#hoy-cuerpo .comida').count(), 2);
  assert.equal((await guardado()).plato.items.length, 0, 'y el plato queda limpio');
  paso('cambiar una comida de otro día: el plato avisa, se guarda en su día y en su sitio; o se deja como estaba');

  // 6. Al salir de «Hoy» y volver, se ve hoy; y lo que se apunta guarda el objetivo del día
  await toca('[data-a="tab"][data-v="plato"]'); await toca('[data-a="tab"][data-v="hoy"]'); assert.equal(await txt('#hoy-titulo'), 'Hoy');
  await p.waitForTimeout(400); assert.deepEqual((await guardado()).metas['2026-11-24'], { kcal: 2140, p: 165, h: 235, g: 60 }, 'hoy guarda su objetivo');
  assert.deepEqual((await guardado()).metas['2026-11-23'], { kcal: 1650, p: 120, h: 180, g: 50 }, 'y el del lunes sigue siendo el suyo'); paso('volver a la pestaña enseña hoy; cada día guarda su objetivo');

  // 7. Sin objetivo del día, la tira solo dice qué días se apuntó algo
  await p.waitForTimeout(400);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('algramo.v1')); s.metas = {}; s.meta.mano = { p: null, h: null, g: null }; localStorage.setItem('algramo.v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(600); await toca('[data-a="tab"][data-v="hoy"]');
  assert.deepEqual(await marcas('#hoy-semana'), ['fut', 'fut', 'apu', 'apu', 'sin', 'apu', 'ya']); assert.equal(await txt('#hoy-sem-txt'), 'Últimos 7 días: 3 apuntados y 1 sin apuntar.');
  paso('sin macros del día: la tira marca los días apuntados, sin juzgarlos');

  // 8. Recién estrenada: el mes no enseña ceros, dice para qué sirve
  await p.evaluate(() => localStorage.setItem('algramo.v1', JSON.stringify({ v: 2 })));   // sin nada apuntado (la siembra de arriba solo actúa si no hay nada guardado)
  await p.reload(); await p.waitForTimeout(600); await toca('[data-a="tab"][data-v="hoy"]');
  assert.deepEqual(await marcas('#hoy-semana'), ['fut', 'fut', 'fut', 'fut', 'fut', 'fut', 'ya']);
  assert.equal(await p.isHidden('#hoy-sem-txt'), true, 'sin días apuntados no hay frase');
  await toca('#hoy-fecha');
  assert.equal(await p.locator('#sheet .mes-ley').count(), 0, 'sin días apuntados no hay cuenta a cero');
  assert.match(await txt('#mes-cuerpo'), /Cuando apuntes tus comidas, aquí verás qué días cumples tus macros y tu racha\./);
  assert.equal(await p.$$eval('#sheet .mes [data-a="ver-dia"]', (xs) => xs.length), 30);
  paso('recién estrenada: el mes explica para qué sirve en vez de enseñar ceros');

  assert.deepEqual(errores, [], 'sin errores de consola');
  console.log('HISTORIAL BIEN · sin errores de consola');
  await b.close(); srv.cierra();
})().catch((e) => { console.error('\nFALLO:', e.message, '\n', (e.stack || '').split('\n').filter((l) => /historial/.test(l)).join('\n')); process.exit(1); });
