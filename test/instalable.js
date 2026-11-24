// La app instalable: se publica como web (public/) con su manifiesto, sus iconos y un service worker que la deja abrir
// sin conexión; con conexión, la página nueva llega a la primera. La versión para Claude (dist/) no lleva nada de eso.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const servidor = require('./servidor.js');
const RAIZ = path.resolve(__dirname, '..'), PUB = path.join(RAIZ, 'public');
const paso = (t) => console.log('  ✓', t);
const png = (archivo) => { const b = fs.readFileSync(archivo); assert.equal(b.toString('latin1', 1, 4), 'PNG', archivo); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

(async () => {
  // 1. Lo que se publica: manifiesto, iconos del tamaño que dicen, y la página con sus enlaces
  const web = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8'), claude = fs.readFileSync(path.join(RAIZ, 'dist/index.html'), 'utf8');
  assert.match(web, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(web, /<link rel="apple-touch-icon" href="\/icono-180\.png">/);
  assert.match(web, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(web, /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
  assert.doesNotMatch(claude, /serviceWorker|rel="manifest"|apple-touch-icon/, 'la versión para Claude no lleva service worker ni manifiesto');
  assert.equal(web.replace(/<!--WEB-->[\s\S]*?<!--\/WEB-->/g, ''), claude, 'salvo eso, las dos versiones son la misma página');
  const man = JSON.parse(fs.readFileSync(path.join(PUB, 'manifest.webmanifest'), 'utf8'));
  assert.equal(man.name, 'Macros'); assert.equal(man.short_name, 'Macros'); assert.equal(man.display, 'standalone'); assert.equal(man.start_url, '/'); assert.equal(man.lang, 'es');
  for (const ic of man.icons) assert.deepEqual(png(path.join(PUB, ic.src)), ic.sizes.split('x').map(Number), ic.src);
  assert.ok(man.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'), 'icono adaptable de 512');
  assert.ok(man.icons.some((i) => i.purpose === 'any' && i.sizes === '192x192') && man.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'));
  assert.deepEqual(png(path.join(PUB, 'icono-180.png')), [180, 180]);
  assert.ok(fs.existsSync(path.join(PUB, 'icono.svg')));
  paso('se publica con manifiesto, iconos de 180, 192 y 512 (y el adaptable) y sin indexar; la versión para Claude, sin nada de eso');

  // 2. Las cabeceras con las que se sirve
  const srv = await servidor(), URL = srv.url;
  let r = await fetch(URL);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/); assert.match(csp, /connect-src 'self'(;|$)/, 'la app solo habla con su propio servidor'); assert.match(csp, /frame-ancestors 'none'/);
  r = await fetch(URL + 'sw.js'); assert.equal(r.status, 200); assert.match(r.headers.get('cache-control'), /no-cache/);
  paso('cabeceras: sin indexar y con una política que no deja salir datos a otros servidores');

  // 3. El service worker se instala y toma la página; sin conexión, la app abre y conserva lo guardado
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const p = await ctx.newPage(), errores = [];
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
  await p.goto(URL);
  assert.equal(await p.evaluate(() => navigator.serviceWorker.ready.then((reg) => !!reg.active)), true);
  await p.reload(); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => !!navigator.serviceWorker.controller), true, 'la página ya la lleva el service worker');
  await p.locator('[data-a="tab"][data-v="macros"]').click(); await p.waitForTimeout(300);
  await p.locator('[data-a="meta"][data-v="mantener"]').click(); await p.waitForTimeout(500);
  errores.length = 0;
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(500);
  assert.equal(await p.title(), 'Macros');
  await p.locator('[data-a="tab"][data-v="macros"]').click(); await p.waitForTimeout(300);
  assert.equal(await p.getAttribute('[data-a="meta"][data-v="mantener"]', 'aria-pressed'), 'true', 'lo guardado sigue ahí');
  assert.equal(await p.evaluate(() => fetch('/manifest.webmanifest').then((x) => x.ok)), true, 'el manifiesto también está guardado');
  assert.equal(await p.evaluate(() => fetch('/icono-192.png').then((x) => x.ok)), true);
  paso('sin conexión: la app abre, con lo guardado, el manifiesto y los iconos');

  // 4. Un despliegue nuevo: con conexión llega a la primera recarga y queda guardado para cuando no la haya
  await ctx.setOffline(false); srv.despliega('version-2');
  await p.reload(); await p.waitForTimeout(600);
  assert.match(await p.content(), /<!-- version-2 -->/, 'la página nueva llega a la primera');
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(500);
  assert.match(await p.content(), /<!-- version-2 -->/, 'y es la que queda guardada');
  assert.equal(await p.title(), 'Macros');
  paso('un despliegue nuevo llega a la primera recarga con conexión, y es el que queda para abrir sin ella');

  await b.close(); srv.cierra();
  assert.deepEqual(errores.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)), [], 'errores de consola');
  console.log('INSTALABLE BIEN · sin errores de consola');
})().catch((e) => { console.error(e); process.exit(1); });
