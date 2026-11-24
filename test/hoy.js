// Prueba de extremo a extremo del día guiado: la app dice qué comida toca y cuánto,
// calcula los gramos, se apunta en «Hoy», se limpia y prepara la siguiente.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('path');
const servidor = require('./servidor.js');
(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const errores = [];
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
  await p.clock.setFixedTime(new Date('2026-11-24T08:10:00+01:00'));       // martes por la mañana
  await p.goto(URL); await p.waitForTimeout(600);
  const txt = async (s) => (await p.textContent(s)).replace(/\s+/g, ' ').trim();
  const toca = async (s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); };
  const paso = (t) => console.log('  ✓', t);
  const comidas = () => p.$$eval('#hoy-cuerpo .comida', (xs) => xs.map((x) => (x.querySelector('.comida-txt').textContent + ' ' + x.querySelector('.comida-hora').textContent).replace(/\s+/g, ' ').trim()));
  const guardado = () => p.evaluate(() => JSON.parse(localStorage.getItem('algramo.v1')));
  const objetivo = () => p.$$eval('[data-in="obj"]', (xs) => xs.map((x) => x.value));
  const chips = () => p.$$eval('#obj-chips .chip', (xs) => xs.map((x) => x.textContent.trim()));
  const tamanos = () => p.$$eval('#obj-chips .tamanos button', (xs) => xs.map((x) => x.textContent.trim() + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')));
  const modo = () => p.$eval('#modos-plato [aria-selected="true"]', (x) => x.textContent.trim());
  const pon = async (lista) => {            // añade alimentos buscándolos; la app calcula los gramos
    for (const q of lista) {
      await toca('[data-a="anadir"]'); await p.fill('#sheet input[type="search"]', q); await p.waitForTimeout(300);
      await toca('#lista-elegir [data-a="alternar"]'); await toca('#sheet [data-a="cerrar"]');
    }
  };
  const apunta = async (comida) => {
    await toca('#btn-apuntar'); if (comida) await toca(`#sheet [data-a="que-comida"][data-v="${comida}"]`); await toca('#sheet [data-a="apuntar-ya"]');
  };

  // 1. La primera vez: abre en «Pongo los macros» y lo primero que pide son tus macros del día
  assert.deepEqual(await p.$$eval('#tabs button', (xs) => xs.map((x) => x.textContent.trim())), ['Plato', 'Alimentos', 'Hoy', 'Mis macros']);
  assert.deepEqual(await p.$$eval('#modos-plato button', (xs) => xs.map((x) => x.textContent.trim())), ['Pongo los macros', 'Pongo los gramos']);
  assert.equal(await modo(), 'Pongo los macros');
  assert.match(await txt('#plato-extra'), /Dime tus macros del día y en cada comida te diré cuánto te toca/);
  assert.equal(await p.locator('#t-dia').isVisible(), false);
  await toca('#plato-extra [data-a="ir-macros"]'); assert.equal(await p.locator('#p-macros.activa').count(), 1);
  assert.match(await txt('#comidas'), /4 comidas al día/);
  await toca('[data-a="meta"][data-v="definir"]');
  assert.match(await txt('#comidas'), /Desayuno, comida, merienda y cena/); paso('la primera vez abre en «Pongo los macros» y pide los macros del día');

  // 2. Con los macros elegidos, el plato ya dice qué comida toca y cuánto: «llevas 0, en el desayuno te tocan tantos»
  await toca('[data-a="tab"][data-v="plato"]');
  assert.equal(await modo(), 'Pongo los macros');
  assert.match(await txt('#obj-rotulo'), /^Desayuno: te tocan 535 kcal$/); assert.deepEqual(await objetivo(), ['41', '59', '15']);
  assert.equal(await txt('#t-dia .dia-kcal'), 'Hoy llevas 0 de tus 2.140 kcal.');
  const macrosDia = () => p.$$eval('#t-dia .dia-macros .m', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(await macrosDia(), ['P 0 de 165', 'H 0 de 235', 'G 0 de 60'], 'los macros del día y lo que llevas');
  assert.match(await txt('#veredicto'), /Elige qué vas a desayunar/);
  assert.deepEqual(await tamanos(), ['Suave', 'Normal*', 'Fuerte', 'Todo']); assert.deepEqual(await chips(), ['Algo entre horas']);
  assert.equal(await p.locator('#btn-apuntar').isVisible(), false); paso('a las 8:10 con 4 comidas: «Desayuno: te tocan» 41 / 59 / 15 y «Hoy llevas 0 de tus 2.140 kcal»');

  // 3. Dices qué vas a desayunar y te pone los gramos; al apuntarlo se limpia y prepara la comida
  await pon(['cafe con leche']);
  assert.deepEqual(await p.$$eval('#plato-filas input', (xs) => xs.map((x) => +x.value)), [200], 'el café con leche se queda en su taza');
  assert.match(await txt('#veredicto'), /^Añade algo más Aún faltan 38 g de proteína, 54 g de hidratos y 13 g de grasa\.\s*Prueba a añadir algo con hidratos:/);
  await pon(['pan tostado', 'aguacate']); assert.match(await txt('#veredicto'), /^Añade algo más Aún faltan \d+ g de proteína\.\s*Prueba a añadir algo con proteína:/);
  await pon(['pechuga de pollo en lonchas']); assert.match(await txt('#veredicto'), /^Clavado/);
  const g1 = await p.$$eval('#plato-filas input', (xs) => xs.map((x) => +x.value));
  assert.equal(g1.length, 4); assert.equal(g1[0], 200); assert.ok(g1.every((g) => g > 0), 'calcula los gramos de cada cosa: ' + g1.join(' / '));
  assert.match(await txt('#t-dia .dia-kcal'), /^Hoy llevas 0 de tus 2\.140 kcal; con este plato, \d+\.$/);
  await toca('#btn-apuntar');
  assert.deepEqual(await p.$$eval('#sheet [data-a="que-comida"]', (xs) => xs.map((x) => x.textContent.trim() + (x.getAttribute('aria-pressed') === 'true' ? '*' : ''))), ['Desayuno*', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Entre horas']);
  await toca('#sheet [data-a="apuntar-ya"]');
  assert.equal(await p.locator('#p-plato.activa').count(), 1, 'al apuntar te quedas en el plato');
  assert.match(await txt('#toast'), /Apuntado en Hoy: Desayuno.*Deshacer/);
  assert.match(await txt('#plato-filas'), /^$/); assert.match(await txt('#obj-rotulo'), /^Comida: te tocan \d+ kcal$/);
  const trasDesayuno = (await guardado()).dias['2026-11-24'][0].t, resto = (x, de) => String(Math.round((de - x) / 3));
  assert.deepEqual(await objetivo(), [resto(trasDesayuno.p, 165), resto(trasDesayuno.h, 235), resto(trasDesayuno.g, 60)], 'lo que queda, entre las tres comidas que faltan');
  assert.match(await txt('#t-dia .dia-kcal'), /^Hoy llevas \d+ de tus 2\.140 kcal\.$/);
  assert.deepEqual(await macrosDia(), [`P ${Math.round(trasDesayuno.p)} de 165`, `H ${Math.round(trasDesayuno.h)} de 235`, `G ${Math.round(trasDesayuno.g)} de 60`]); paso(`desayuno calculado (${g1.join(' / ')} g) y apuntado: el plato se limpia y pone «Comida: te tocan»`);

  // 4. Algo entre horas: se apunta lo que comes, en gramos y sin objetivo, y no gasta una comida del plan
  await p.clock.setFixedTime(new Date('2026-11-24T11:30:00+01:00'));
  await toca('[data-a="modo"][data-v="gramos"]');                            // pasar a gramos con el plato vacío no es «haber llegado a todo»
  assert.doesNotMatch(await txt('#plato-extra'), /Ya has llegado|ya están apuntadas/); assert.match(await txt('#plato-filas'), /Tu plato está vacío/);
  await toca('[data-a="modo"][data-v="macros"]'); assert.match(await txt('#obj-rotulo'), /^Comida: te tocan/);
  await toca('#obj-chips [data-a="entre-horas"]');
  assert.equal(await modo(), 'Pongo los gramos'); assert.match(await txt('#plato-extra'), /Algo entre horas, sin objetivo/);
  await pon(['platano']); assert.deepEqual(await p.$$eval('#plato-filas input', (xs) => xs.map((x) => +x.value)), [120]);
  await toca('#btn-apuntar');
  assert.equal(await p.getAttribute('#sheet [data-a="que-comida"][data-v="Entre horas"]', 'aria-pressed'), 'true');
  await toca('#sheet [data-a="apuntar-ya"]');
  assert.equal(await modo(), 'Pongo los macros'); assert.match(await txt('#obj-rotulo'), /^Comida: te tocan/);
  await toca('[data-a="tab"][data-v="hoy"]');
  assert.deepEqual((await comidas()).map((c) => c.split(' ')[0] + (/ 11:30$/.test(c) ? '@11:30' : '')), ['Desayuno', 'Entre@11:30']); assert.equal(await txt('#btn-cuadrar'), 'Preparar la comida');
  paso('un plátano entre horas: apuntado en gramos; la app sigue en «Comida: te tocan»');

  // 5. Desde «Hoy», preparar la comida. El tamaño lo decide quien come: suave, normal, fuerte o todo lo que queda
  await p.clock.setFixedTime(new Date('2026-11-24T14:30:00+01:00'));
  await toca('#btn-cuadrar'); assert.equal(await p.locator('#p-plato.activa').count(), 1);
  const cuota = (await objetivo()).map(Number), tam = async (v) => { await toca(`#obj-chips [data-a="tam"][data-v="${v}"]`); return (await objetivo()).map(Number); };
  const todo = await tam('todo'); assert.ok(todo[0] > cuota[0] * 2.8 && todo[0] < cuota[0] * 3.2, 'todo lo que queda es unas tres veces la cuota');
  assert.match(await txt('#obj-rotulo'), /^Comida: todo lo que te queda \d/); assert.deepEqual(await tamanos(), ['Suave', 'Normal', 'Fuerte', 'Todo*']);
  const fuerte = await tam('fuerte'); assert.ok(Math.abs(fuerte[1] - cuota[1] * 1.5) <= 1, `fuerte ${fuerte} es vez y media de ${cuota}`); assert.match(await txt('#obj-rotulo'), /^Comida fuerte: te tocan/);
  const suave = await tam('suave'); assert.ok(Math.abs(suave[1] - cuota[1] / 2) <= 1, `suave ${suave} es la mitad de ${cuota}`); assert.match(await txt('#obj-rotulo'), /^Comida suave: te tocan/);
  assert.deepEqual(await tam('normal'), cuota); assert.match(await txt('#obj-rotulo'), /^Comida: te tocan/);
  await p.fill('[data-in="obj"][data-m="p"]', '70'); await p.waitForTimeout(400);
  assert.match(await txt('#obj-rotulo'), /^En este plato quiero/, 'si escribes tú los números, deja de decir «te tocan»'); assert.deepEqual(await tamanos(), ['Suave', 'Normal', 'Fuerte', 'Todo'], 'y no hay tamaño marcado');
  await tam('normal'); assert.deepEqual(await tamanos(), ['Suave', 'Normal*', 'Fuerte', 'Todo']);
  await pon(['arroz blanco cocido', 'pechuga de pollo asada', 'aceite de oliva']);
  assert.match(await txt('#veredicto'), /Clavado/); await apunta();
  assert.match(await txt('#obj-rotulo'), /^Merienda: te tocan/); paso('comida calculada con su cuota (clavada) y apuntada: ahora toca la merienda');

  // 6. Si te saltas la merienda, por la noche toca la cena con todo lo que queda
  await p.clock.setFixedTime(new Date('2026-11-24T21:00:00+01:00'));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(400);
  assert.match(await txt('#obj-rotulo'), /^Cena: te tocan/);
  const q = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('algramo.v1')), t = s.dias['2026-11-24'].reduce((a, c) => ({ p: a.p + c.t.p, h: a.h + c.t.h, g: a.g + c.t.g }), { p: 0, h: 0, g: 0 }); return [165 - t.p, 235 - t.h, 60 - t.g].map((x) => String(Math.round(x))); });
  assert.deepEqual(await objetivo(), q); assert.deepEqual(await chips(), ['Algo entre horas'], 'ya es todo lo que queda: no hace falta ese botón');
  paso('a las 21:00 sin merendar: «Cena: te tocan» todo lo que queda');

  // 7. En «Hoy»: ver una comida, borrarla y deshacer; cambiarla y volver a apuntarla en su sitio
  await toca('[data-a="tab"][data-v="hoy"]');
  assert.equal((await comidas()).length, 3); assert.match(await txt('#hoy-cuerpo'), /Te queda para hoy/); assert.equal(await txt('#btn-cuadrar'), 'Preparar la cena');
  await toca('#hoy-cuerpo .comida'); assert.match(await txt('#sheet'), /Desayuno.*Café con leche \d+ g.*Pan tostado \d+ g/);
  await toca('#sheet [data-a="borrar-comida"]'); assert.equal((await comidas()).length, 2);
  await toca('#toast [data-a="toast"]'); assert.equal((await comidas()).length, 3); assert.match((await comidas())[0], /^Desayuno .* 8:10$/);
  await toca('#hoy-cuerpo .comida'); await toca('#sheet [data-a="cambiar-comida"]');
  assert.equal(await p.locator('#p-plato.activa').count(), 1); assert.equal(await modo(), 'Pongo los gramos');
  assert.deepEqual(await p.$$eval('#plato-filas input', (xs) => xs.map((x) => +x.value)), g1);
  await toca('#plato-filas .fila:nth-child(1) [data-a="mas"]'); await toca('#btn-apuntar');
  assert.equal(await p.getAttribute('#sheet [data-a="que-comida"][data-v="Desayuno"]', 'aria-pressed'), 'true', 'recuerda que era el desayuno');
  await toca('#sheet [data-a="apuntar-ya"]');
  await toca('[data-a="tab"][data-v="hoy"]'); assert.match((await comidas())[0], /^Desayuno .* 8:10$/, 'vuelve a su sitio y con su hora');
  paso('ver, borrar y deshacer; cambiar el desayuno y que vuelva a su sitio');

  // 8. Todo sigue ahí al recargar; al día siguiente empieza de cero: «llevas 0, en el desayuno te tocan tantos»
  await p.waitForTimeout(500); await p.reload(); await p.waitForTimeout(700);
  assert.match(await txt('#obj-rotulo'), /^Cena: te tocan/); await toca('[data-a="tab"][data-v="hoy"]'); assert.equal((await comidas()).length, 3);
  await p.clock.setFixedTime(new Date('2026-11-25T08:10:00+01:00'));
  await p.reload(); await p.waitForTimeout(700);
  assert.match(await txt('#obj-rotulo'), /^Desayuno: te tocan 535 kcal$/); assert.deepEqual(await objetivo(), ['41', '59', '15']); assert.equal(await txt('#t-dia .dia-kcal'), 'Hoy llevas 0 de tus 2.140 kcal.');
  await toca('[data-a="tab"][data-v="hoy"]');
  assert.match(await txt('#p-hoy .cima'), /miércoles, 25 de noviembre/); assert.match(await txt('#hoy-cuerpo'), /Hoy aún no has apuntado nada/); assert.equal(await p.locator('#btn-cuadrar').isVisible(), false);
  assert.equal((await guardado()).dias['2026-11-24'].length, 3, 'lo de ayer sigue guardado'); paso('al recargar sigue todo; al día siguiente, desayuno otra vez y ayer queda guardado');

  // 9. Si te pasas, lo dice, y deja de proponer cuotas cuando ya no queda nada que repartir
  await toca('#hoy-cuerpo [data-a="tab"][data-v="plato"]'); await toca('#obj-chips [data-a="entre-horas"]');
  await pon(['aceite de oliva']); await p.fill('#plato-filas .fila:nth-child(1) input', '90'); await p.waitForTimeout(400); await apunta();
  await toca('[data-a="tab"][data-v="hoy"]');
  assert.match(await txt('#hoy-cuerpo'), /Te has pasado 30 g de grasa/); assert.equal(await p.locator('#db-g.pasa').count(), 1); paso('90 g de aceite: avisa de que te has pasado 30 g de grasa');

  // 10. Con dos comidas al día, la primera es la comida y le toca la mitad
  await toca('[data-a="tab"][data-v="macros"]'); await toca('[data-a="comidas"][data-v="-1"]'); await toca('[data-a="comidas"][data-v="-1"]');
  assert.match(await txt('#comidas'), /2 comidas al día.*Comida y cena/);
  await toca('[data-a="tab"][data-v="plato"]'); assert.match(await txt('#obj-rotulo'), /^Comida: te tocan/); paso('con 2 comidas al día: comida y cena');

  // 11. Apuntar y cerrar la app al instante: lo apuntado no se pierde
  const antes = (await guardado()).dias['2026-11-25'].length;
  await toca('#obj-chips [data-a="entre-horas"]'); await pon(['platano']); await toca('#btn-apuntar');
  await p.locator('#sheet [data-a="apuntar-ya"]').click(); await p.reload(); await p.waitForTimeout(700);
  assert.equal((await guardado()).dias['2026-11-25'].length, antes + 1, 'se guarda al salir, sin esperar');
  await toca('[data-a="tab"][data-v="hoy"]'); assert.equal((await comidas()).length, antes + 1); paso('apuntar y cerrar al instante: sigue apuntado al volver');

  // 12. Con todas las comidas del plan apuntadas, el plato lo dice y queda para apuntar lo que comas de más
  await toca('[data-a="tab"][data-v="plato"]'); assert.match(await txt('#obj-rotulo'), /^Comida: te tocan/);
  await pon(['arroz blanco cocido']); await apunta(); assert.match(await txt('#obj-rotulo'), /^Cena: te tocan/);
  await pon(['arroz blanco cocido']); await apunta();
  assert.equal(await modo(), 'Pongo los gramos'); assert.match(await txt('#plato-extra'), /Las comidas de hoy ya están apuntadas\. Si comes algo más, apúntalo aquí/);
  await pon(['platano']); assert.equal(await p.locator('#plato-extra .aviso-ej').count(), 0, 'con algo en el plato, el aviso ya no hace falta'); paso('comida y cena apuntadas: el plato lo dice y queda en gramos para los extras');

  // 13. Un día que sigue lo que dice la app (macros clavados) no acaba en «te has pasado» por unas kcal de fibra
  const abreDia = async (t, nombres, hora) => {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    const q = await c2.newPage(); q.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
    await q.clock.setFixedTime(new Date(`2026-11-26T${hora || '22:00'}:00+01:00`));
    const ns = nombres || ['Desayuno', 'Comida', 'Merienda', 'Cena'], k = ns.length;
    const comidasDia = ns.map((n, i) => ({ nombre: n, hora: (8 + 4 * i) + ':00', items: [], t: { kcal: t.kcal / k, p: t.p / k, h: t.h / k, g: t.g / k, f: 6 } }));
    await q.addInitScript((s) => { if (!localStorage.getItem('algramo.v1')) localStorage.setItem('algramo.v1', s); }, JSON.stringify({ v: 2, aspecto: 'claro',
      plato: { items: [], modo: 'gramos', objetivo: null, ejemplo: false, comida: null }, perfil: { sexo: 'h', edad: 30, peso: 75, altura: 178, nivel: 3, ejemplo: false },
      meta: { modo: 'mano', tipo: null, comidas: 4, mano: { p: 165, h: 235, g: 60 } }, favs: [], propios: [], platos: [], dias: { '2026-11-26': comidasDia } }));
    await q.goto(URL); await q.waitForTimeout(600);
    const de = async (s2) => (await q.textContent(s2)).replace(/\s+/g, ' ').trim();
    const plato = { modo: await q.$eval('#modos-plato [aria-selected="true"]', (x) => x.textContent.trim()), extra: await de('#plato-extra') };
    await q.locator('[data-a="tab"][data-v="hoy"]').click(); await q.waitForTimeout(450);
    const r = { plato, dia: await de('#d-dia'), cuerpo: await de('#hoy-cuerpo .veredicto'), ojo: await q.locator('#hoy-cuerpo .veredicto.ojo').count(), preparar: await q.locator('#btn-cuadrar').isVisible() };
    await c2.close(); return r;
  };
  const clavado = await abreDia({ kcal: 2194, p: 165, h: 235, g: 59 });
  assert.equal(clavado.dia, 'Llevas 2.194 de tus 2.140 kcal del día.'); assert.match(clavado.cuerpo, /^Hoy ya has llegado a todo/);
  assert.doesNotMatch(clavado.cuerpo, /pasado/); assert.equal(clavado.ojo, 0, 'sin aviso');
  const pasado = await abreDia({ kcal: 2460, p: 165, h: 235, g: 72 });
  assert.equal(pasado.dia, 'Llevas 2.460 kcal: 320 más que tus 2.140 del día.'); assert.match(pasado.cuerpo, /Te has pasado 12 g de grasa y 320 kcal\./); assert.equal(pasado.ojo, 1);
  paso('un día con los macros clavados no «se pasa» por 54 kcal; pasarse 12 g de grasa y 320 kcal sí se dice');
  const pronto = await abreDia({ kcal: 2150, p: 160, h: 228, g: 58 }, ['Desayuno', 'Comida'], '16:00');       // todo comido a media tarde
  assert.equal(pronto.plato.modo, 'Pongo los gramos'); assert.match(pronto.plato.extra, /Ya has llegado a tus macros de hoy\. Si comes algo más, apúntalo aquí/);
  assert.match(pronto.cuerpo, /^Hoy ya has llegado a todo/); assert.equal(pronto.preparar, false, 'no propone preparar una merienda de 3 g');
  paso('con los macros del día ya cubiertos a media tarde: no reparte migajas; el plato queda para apuntar extras');

  assert.deepEqual(errores, [], 'sin errores de consola');
  console.log('HOY BIEN · sin errores de consola');
  await b.close(); srv.cierra();
})().catch((e) => { console.error('\nFALLO:', e.message); process.exit(1); });
