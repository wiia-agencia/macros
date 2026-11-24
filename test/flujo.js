// Prueba de extremo a extremo: usa la app como una persona y comprueba que responde bien.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('path');
const servidor = require('./servidor.js');
(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-11-24T14:00:00+01:00'));       // un martes a la hora de comer
  const errores = [];
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
  await p.goto(URL); await p.waitForTimeout(600);
  const txt = async (s) => (await p.textContent(s)).replace(/\u00a0/g, ' ');
  const toca = async (s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); };
  const gramos = () => p.$$eval('#plato-filas input', (xs) => xs.map((x) => +x.value));
  const nombres = () => p.$$eval('#plato-filas .fila-nombre', (xs) => xs.map((x) => x.textContent.trim()));
  const paso = (t) => console.log('  ✓', t);

  // 1. La primera vez abre en «Pongo los macros», vacío; el plato de ejemplo es un botón
  assert.equal(await p.$eval('#modos-plato [aria-selected="true"]', (x) => x.textContent.trim()), 'Pongo los macros');
  assert.match(await txt('#veredicto'), /Elige qué vas a comer/); assert.equal((await gramos()).length, 0);
  await toca('#veredicto [data-a="ver-ejemplo"]');
  assert.equal(await p.$eval('#modos-plato [aria-selected="true"]', (x) => x.textContent.trim()), 'Pongo los gramos');
  assert.match(await txt('.aviso-ej'), /Plato de ejemplo/);
  assert.equal(await txt('#t-kcal'), '677'); paso('la primera vez abre en «Pongo los macros»; «Ver un plato de ejemplo» carga uno de 677 kcal');
  // 2. Botón + suma 5 g y cambian las kcal
  await toca('#plato-filas .fila:nth-child(1) [data-a="mas"]');
  assert.deepEqual(await gramos(), [305, 250, 100]); assert.equal(await txt('#t-kcal'), '681'); paso('+ suma 5 g (681 kcal)');
  assert.equal(await p.locator('.aviso-ej').count(), 0, 'al tocar el plato deja de ser «de ejemplo»');
  // 3. Escribir gramos
  await p.fill('#plato-filas .fila:nth-child(2) input', '200'); await p.waitForTimeout(450);
  assert.equal(await txt('#t-p'), '69'); paso('escribir 200 g de pollo: proteína 69 g');
  // 4. Vaciar desde «Mis platos» y deshacer
  await toca('[data-a="platos"]'); await toca('#sheet [data-a="vaciar"]');
  assert.equal((await gramos()).length, 0); assert.match(await txt('#veredicto'), /Elige qué vas a comer/);
  await toca('#toast [data-a="toast"]'); assert.deepEqual(await gramos(), [305, 200, 100]);
  assert.equal(await p.$eval('#modos-plato [aria-selected="true"]', (x) => x.textContent.trim()), 'Pongo los gramos'); paso('vaciar y deshacer');
  // 5. Añadir desde el buscador (sin tildes)
  await toca('[data-a="anadir"]'); await p.fill('#sheet input[type="search"]', 'salmon'); await p.waitForTimeout(300);
  assert.match(await txt('#lista-elegir .fila-nombre'), /^Salmón/);
  await toca('#lista-elegir [data-a="alternar"]'); await toca('#sheet [data-a="cerrar"]');
  assert.equal((await nombres()).length, 4); assert.match((await nombres())[3], /^Salmón/); paso('añadir salmón buscando «salmon»');
  // 6. Quitar desde la ficha y deshacer
  await toca('#plato-filas .fila:nth-child(4) [data-a="ficha"]'); await toca('#sheet [data-a="quitar"]');
  assert.equal((await nombres()).length, 3); await toca('#toast [data-a="toast"]'); assert.equal((await nombres()).length, 4);
  await toca('#plato-filas .fila:nth-child(4) [data-a="ficha"]'); await toca('#sheet [data-a="quitar"]'); paso('quitar desde la ficha, deshacer y quitar');
  // 7. Pongo los macros: candados
  await toca('[data-a="modo"][data-v="macros"]');
  for (const [m, v] of [['p', '50'], ['h', '60'], ['g', '8']]) await p.fill(`[data-in="obj"][data-m="${m}"]`, v);
  await p.waitForTimeout(450);
  const g0 = await gramos();
  assert.equal(g0[2], 100, 'la verdura se queda en su cantidad');
  assert.equal(await p.getAttribute('#plato-filas .fila:nth-child(3) .candado', 'aria-pressed'), 'true');
  assert.match(await txt('#veredicto'), /Casi clavado.*Grasa: pides 8 g y salen 5,\d g/); paso(`macros 50/60/8 → ${g0.join(' / ')} g: casi clavado, dice cuánta grasa pides y cuánta sale`);
  assert.match(await txt('#plato-extra'), /En este plato quiero/); assert.match(await txt('#plato-extra'), /Te tocan estos gramos/);
  await p.fill('[data-in="obj"][data-m="g"]', '6'); await p.waitForTimeout(450);
  assert.match(await txt('#veredicto'), /^Clavado\. Con estos gramos, el plato da lo que pides/); paso('con 6 g de grasa: clavado');
  await p.fill('#plato-filas .fila:nth-child(2) input', '250'); await p.waitForTimeout(450);
  assert.equal(await p.getAttribute('#plato-filas .fila:nth-child(2) .candado', 'aria-pressed'), 'true');
  assert.match(await txt('#veredicto'), /Proteína: pides 50 g y salen \d+ g\. Con el candado en 250 g de pechuga de pollo ya salen 78 g/); paso('fijar 250 g de pollo: dice que sale más proteína de la pedida y que es por el candado');
  await toca('#plato-filas .fila:nth-child(2) .candado');
  assert.equal(await p.getAttribute('#plato-filas .fila:nth-child(2) .candado', 'aria-pressed'), 'false');
  for (const i of [1, 2, 3]) if (await p.getAttribute(`#plato-filas .fila:nth-child(${i}) .candado`, 'aria-pressed') === 'false') await toca(`#plato-filas .fila:nth-child(${i}) .candado`);
  await p.fill('[data-in="obj"][data-m="p"]', '80'); await p.waitForTimeout(450);
  const todo = (await txt('#veredicto')).replace(/\s+/g, ' ');
  assert.match(todo, /Proteína: pides 80 g y salen \d+ g\.\s*Todo tiene el candado puesto/); assert.equal(todo.match(/candado/g).length, 1, 'lo del candado se dice una vez');
  for (const i of [1, 2]) await toca(`#plato-filas .fila:nth-child(${i}) .candado`);
  await p.fill('#plato-filas .fila:nth-child(3) input', '100'); await p.locator('#plato-filas .fila:nth-child(3) input').blur();
  await p.fill('[data-in="obj"][data-m="p"]', '50'); await p.waitForTimeout(450); paso('con todo fijado lo dice una sola vez');
  assert.match(await txt('#veredicto'), /Clavado/); paso('soltar el candado: vuelve a cuadrar');
  // 7b. Pedir algo que estos alimentos no pueden dar (90/250/5): lo explica sin jerga y da la salida
  for (const [m, v] of [['p', '90'], ['h', '250'], ['g', '5']]) await p.fill(`[data-in="obj"][data-m="${m}"]`, v);
  await p.waitForTimeout(450);
  let v7 = (await txt('#veredicto')).replace(/\s+/g, ' ');
  const botones = () => p.$$eval('#veredicto .chip', (xs) => xs.map((x) => x.textContent.replace(/\u00a0/g, ' ').trim()));
  assert.match(v7, /^Con estos alimentos no sale/); assert.doesNotMatch(v7, /Casi clavado|Te faltan|Te sobran|cantidades enormes|Grasa:/);
  assert.match(v7, /Proteína: pides 90 g y salen 59 g\. Con más pechuga de pollo te pasarías de grasa\./);
  assert.match(v7, /Hidratos: pides 250 g y salen 232 g\. Y ya van 1\.250 g de patata\./);
  assert.equal(await p.locator('#b-g.pasa').count(), 0, 'nunca pone más grasa de la pedida'); assert.ok(+(await txt('#t-g')).replace(',', '.') <= 6);
  assert.deepEqual(await botones(), ['Clara de huevo', 'Atún al natural (lata, escurrido)', 'Queso fresco batido 0 %', 'O subir la grasa a 10 g']);
  paso('90/250/5: no pasa de la grasa pedida; dice qué falta, que con más pollo te pasarías de grasa, y da dos salidas');
  await toca('#veredicto [data-a="aceptar"]'); v7 = (await txt('#veredicto')).replace(/\s+/g, ' ');
  assert.equal(await p.inputValue('[data-in="obj"][data-m="g"]'), '10'); assert.doesNotMatch(v7, /Proteína/);
  assert.match(v7, /Hidratos: pides 250 g y salen 232 g\. Y ya van 1\.250 g de patata\./);
  assert.deepEqual(await botones(), ['Arroz blanco', 'Pan blanco (barra)', 'Plátano']);
  await toca('#veredicto .chip');
  assert.equal((await nombres()).length, 4); assert.match(await txt('#veredicto'), /^Clavado/);
  paso('«O subir la grasa a 10 g» arregla la proteína; con arroz salen los hidratos y queda clavado');
  await toca('#plato-filas .fila:nth-child(4) [data-a="ficha"]'); await toca('#sheet [data-a="quitar"]'); await p.waitForTimeout(5400);
  await toca('[data-a="modo"][data-v="gramos"]');
  // 8. Crear un alimento propio, añadirlo y borrarlo
  await toca('[data-a="tab"][data-v="alimentos"]'); await toca('[data-a="nuevo"]');
  await toca('[data-a="guardar-nuevo"]'); assert.match(await txt('#n-error'), /nombre/);
  await p.fill('#n-nombre', 'Yogur proteico'); await p.fill('#n-p', '10'); await p.fill('#n-h', '3,5'); await p.fill('#n-g', '0,2'); await p.fill('#n-r', '120');
  await toca('[data-a="guardar-nuevo"]');
  await p.fill('#busca-biblio input', 'yogur prot'); await p.waitForTimeout(300);
  assert.match(await txt('#lista-biblio .fila-nombre'), /Yogur proteico/); assert.equal((await txt('#lista-biblio .fila-kcal')).replace(/\D/g, ''), '56');
  await toca('#lista-biblio [data-a="alternar"]'); await toca('[data-a="tab"][data-v="plato"]');
  assert.equal((await gramos())[3], 120); paso('alimento propio: 56 kcal, entra en el plato con su ración de 120 g');
  await toca('[data-a="tab"][data-v="alimentos"]'); await toca('#lista-biblio [data-a="ficha"]'); await toca('#sheet [data-a="borrar-propio"]');
  await toca('[data-a="tab"][data-v="plato"]'); assert.equal((await gramos()).length, 3); paso('borrar el alimento propio lo quita también del plato');
  // 9. Favoritos
  await toca('[data-a="tab"][data-v="alimentos"]'); await p.fill('#busca-biblio input', 'lentejas'); await p.waitForTimeout(300);
  await toca('#lista-biblio [data-a="ficha"]'); await toca('#sheet [data-a="fav"]'); await toca('#sheet [data-a="cerrar"]');
  await p.fill('#busca-biblio input', ''); await p.waitForTimeout(200); await toca('#cinta-biblio [data-v="fav"]');
  assert.equal(await p.locator('#lista-biblio .fila').count(), 1); paso('favoritos: aparece el filtro y deja 1 alimento');
  await toca('#cinta-biblio [data-v="fav"]');
  // 9b. Ordenar la biblioteca: por cada macro, por fibra, por calorías y por proteína por caloría
  const orden = async (v) => { await p.selectOption('#lista-biblio select[data-in="orden"]', v); await p.waitForTimeout(250); };
  const primero = () => txt('#lista-biblio .fila-nombre');
  assert.deepEqual(await p.$$eval('#lista-biblio select[data-in="orden"] option', (xs) => xs.map((x) => x.value)), ['az', 'prot', 'hid', 'gra', 'fib', 'kcal', 'mkcal', 'pk']);
  await orden('hid'); assert.match(await primero(), /^Azúcar/); assert.match(await txt('#lista-biblio .fila-sub .clave'), /^H 100/);
  await orden('gra'); assert.match(await primero(), /^Aceite/); assert.match(await txt('#lista-biblio .fila-sub .clave'), /^G 100/);
  await orden('fib'); assert.match(await primero(), /^Cacao puro/); assert.match(await txt('#lista-biblio .fila-sub .clave'), /^Fibra 37/);
  await orden('pk'); assert.match(await primero(), /^Gambas/); assert.match(await txt('#lista-biblio .fila-sub .clave'), /^24 g de proteína cada 100 kcal/);
  await orden('mkcal'); assert.match(await primero(), /^Aceite/); assert.equal(await p.locator('#lista-biblio .fila-sub .clave').count(), 0);
  await orden('az'); paso('ordenar la biblioteca: hidratos, grasa, fibra, calorías y proteína por caloría');
  // 10. Mis macros
  await toca('[data-a="tab"][data-v="macros"]');
  const kcal = async (k) => +(await txt(`[data-a="meta"][data-v="${k}"] .meta-kcal`)).replace(/\D/g, '');
  const antes = await kcal('mantener');
  await p.fill('[data-in="perfil"][data-k="peso"]', '90'); await p.waitForTimeout(300);
  assert.ok(await kcal('mantener') > antes); assert.equal(await p.locator('#nota-ej').count(), 0); paso('cambiar el peso recalcula');
  await toca('[data-a="sexo"][data-v="m"]'); const mujer = await kcal('mantener'); await toca('[data-a="sexo"][data-v="h"]');
  assert.ok(mujer < await kcal('mantener')); paso('hombre / mujer cambia el cálculo');
  await p.fill('[data-in="perfil"][data-k="edad"]', '16'); await p.waitForTimeout(300);
  assert.match(await txt('#metas'), /adultos/); await p.fill('[data-in="perfil"][data-k="edad"]', '31'); await p.waitForTimeout(300); paso('menor de 18: no da cifras');
  await toca('[data-a="meta"][data-v="ganar"]'); await toca('[data-a="comidas"][data-v="1"]');
  assert.match(await txt('#comidas'), /5 comidas al día/); paso('elegir «ganar músculo» y 5 comidas');
  await toca('[data-a="meta-modo"][data-v="mano"]');
  for (const [m, v] of [['p', '160'], ['h', '250'], ['g', '70']]) await p.fill(`[data-in="mano"][data-m="${m}"]`, v);
  await p.waitForTimeout(300); assert.match(await txt('#mano-kcal'), /2\.270 kcal/); paso('macros a mano: 160/250/70 = 2.270 kcal');
  await toca('[data-a="tab"][data-v="plato"]'); assert.match(await txt('#t-dia .dia-kcal'), /^Hoy llevas 0 de tus 2\.270 kcal; con este plato, [\d.]+\.$/); paso('el plato dice cuánto llevas hoy y cuánto suma este plato');
  // 11. Guardar el plato y que todo siga ahí al recargar
  await toca('[data-a="platos"]'); await p.fill('#nombre-plato', 'Pollo con patatas'); await toca('[data-a="guardar-plato"]');
  await toca('[data-a="aspecto"]');
  assert.deepEqual(await p.$$eval('#sheet [data-a="pon-aspecto"]', (xs) => xs.map((x) => x.dataset.v)), ['auto', 'claro', 'oscuro'], 'solo se elige entre automático, claro y oscuro');
  await toca('[data-a="pon-aspecto"][data-v="oscuro"]'); await toca('#sheet [data-a="cerrar"]');
  const antesRecarga = await gramos(); await p.waitForTimeout(500); await p.reload(); await p.waitForTimeout(700);
  assert.deepEqual(await gramos(), antesRecarga); assert.equal(await p.getAttribute('html', 'data-aspecto'), 'oscuro');
  await toca('[data-a="platos"]'); assert.match(await txt('#sheet .guardados'), /Pollo con patatas/);
  await toca('#sheet [data-a="vaciar"]'); await p.waitForTimeout(5600); await toca('[data-a="platos"]'); await toca('[data-a="cargar-plato"]');
  assert.deepEqual(await gramos(), antesRecarga); paso('al recargar siguen el plato, el aspecto y los platos guardados');
  // 12. Mantener pulsado + va sumando
  const c = await p.locator('#plato-filas .fila:nth-child(1) [data-a="mas"]').boundingBox();
  const g1 = (await gramos())[0];
  await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.mouse.down(); await p.waitForTimeout(900); await p.mouse.up(); await p.waitForTimeout(300);
  assert.ok((await gramos())[0] >= g1 + 20, 'mantener pulsado suma varias veces'); paso(`mantener pulsado +: de ${g1} a ${(await gramos())[0]} g`);

  // 13. Quien tuviera guardado el aspecto «Color» (ya no existe) vuelve al automático, sin quedarse a medias
  await p.waitForTimeout(400);
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('algramo.v1')); s.aspecto = 'color'; localStorage.setItem('algramo.v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(700);
  assert.equal(await p.getAttribute('html', 'data-aspecto'), 'claro');
  await toca('[data-a="aspecto"]'); assert.equal(await p.getAttribute('#sheet [data-a="pon-aspecto"][data-v="auto"]', 'aria-pressed'), 'true');
  await toca('#sheet [data-a="cerrar"]'); paso('un aspecto guardado que ya no existe vuelve al automático');

  assert.deepEqual(errores, [], 'sin errores de consola');
  console.log('TODO BIEN · sin errores de consola');
  await b.close(); srv.cierra();
})().catch((e) => { console.error('\nFALLO:', e.message); process.exit(1); });
