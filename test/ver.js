// Recorre la app en un navegador sin ventana: capturas de cada pantalla y errores de consola.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const dir = path.resolve(__dirname, '../capturas'); fs.mkdirSync(dir, { recursive: true });
const servidor = require('./servidor.js');
(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errores = [];
  const nueva = async (w, h, esquema) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 600, isMobile: w < 600, colorScheme: esquema || 'light', locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-24T14:00:00+01:00'));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
    await p.goto(URL); await p.waitForTimeout(700);
    return p;
  };
  const foto = async (p, n) => { await p.waitForTimeout(650); await p.screenshot({ path: `${dir}/${n}.png` }); };
  const toca = (p, sel) => p.locator(sel).first().click();

  const p = await nueva(390, 844);
  await foto(p, '00-primera-vez');
  await toca(p, '[data-a="ver-ejemplo"]'); await foto(p, '01-plato');
  await toca(p, '[data-a="modo"][data-v="macros"]'); await foto(p, '02-macros');
  console.log('objetivo inicial:', await p.inputValue('[data-in="obj"][data-m="p"]'), await p.inputValue('[data-in="obj"][data-m="h"]'), await p.inputValue('[data-in="obj"][data-m="g"]'));
  await p.fill('[data-in="obj"][data-m="p"]', '60'); await p.fill('[data-in="obj"][data-m="h"]', '70'); await p.fill('[data-in="obj"][data-m="g"]', '20');
  await foto(p, '03-macros-60-70-20');
  console.log('veredicto:', (await p.textContent('#veredicto')).trim().slice(0, 160));
  console.log('gramos:', await p.$$eval('#plato-filas input', (xs) => xs.map((x) => x.value).join(' / ')));
  await toca(p, '[data-a="sugerido"]'); await foto(p, '04-macros-con-aceite');
  const tras = await p.$$eval('#plato-filas input', (xs) => xs.map((x) => x.value));
  if (tras.length !== 4) throw new Error('al añadir el alimento sugerido deben quedar 4 alimentos, hay ' + tras.length);
  if (!/Clavado/.test(await p.textContent('#veredicto'))) throw new Error('con el aceite añadido debería cuadrar');
  console.log('tras sugerido:', (await p.textContent('#veredicto')).trim().slice(0, 80), '|', await p.$$eval('#plato-filas input', (xs) => xs.map((x) => x.value).join(' / ')));
  await toca(p, '[data-a="anadir"]'); await foto(p, '05-anadir');
  await p.fill('#sheet input[type="search"]', 'arroz'); await foto(p, '06-anadir-arroz');
  await toca(p, '#sheet [data-a="cerrar"]');
  await toca(p, '[data-a="tab"][data-v="alimentos"]'); await foto(p, '07-alimentos');
  await toca(p, '#lista-biblio [data-a="ficha"]'); await foto(p, '08-ficha');
  await toca(p, '#sheet [data-a="cerrar"]');
  await toca(p, '[data-a="tab"][data-v="macros"]'); await foto(p, '09-mis-macros');
  await toca(p, '[data-a="meta"][data-v="definir"]'); await p.waitForTimeout(2600);
  await p.locator('#p-macros').evaluate((el) => el.scrollTo(0, 260)); await foto(p, '10-mis-macros-definir');
  await toca(p, '[data-a="tab"][data-v="plato"]');
  await toca(p, '[data-a="obj-toca"]'); await foto(p, '11-plato-una-comida');
  console.log('una comida:', await p.$$eval('[data-in="obj"]', (xs) => xs.map((x) => x.value).join('/')), '|', (await p.textContent('#veredicto')).trim().slice(0, 90), '|', await p.textContent('#t-dia'));
  await toca(p, '[data-a="modo"][data-v="gramos"]');
  await toca(p, '[data-a="aspecto"]'); await foto(p, '12-aspecto');
  await toca(p, '[data-a="pon-aspecto"][data-v="oscuro"]'); await toca(p, '#sheet [data-a="cerrar"]'); await foto(p, '13-oscuro');
  await toca(p, '[data-a="tab"][data-v="alimentos"]');
  for (const o of ['hid', 'fib', 'pk']) { await p.selectOption('#lista-biblio select[data-in="orden"]', o); await foto(p, '14-orden-' + o); }
  await p.selectOption('#lista-biblio select[data-in="orden"]', 'az'); await toca(p, '[data-a="tab"][data-v="plato"]');
  await toca(p, '[data-a="platos"]'); await foto(p, '15-mis-platos');

  const m = await nueva(360, 740); await foto(m, '20-movil-360');
  const d = await nueva(1280, 860); await foto(d, '21-escritorio');
  console.log('errores:', errores.length ? errores : 'ninguno');
  await b.close(); srv.cierra();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
