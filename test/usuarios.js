// Usuarios, de punta a punta: entrar con el enlace de invitación y crear el PIN, que lo del móvil suba a la cuenta, entrar
// desde otro móvil y que todo baje, que los cambios vayan y vengan, sin conexión, cerrar sesión, y el administrador
// (ver quién la usa, invitar, desactivar, enlace nuevo). La app habla con la nube de pruebas: el mismo SQL que la de verdad.
// Aquí el reloj es el de verdad: quién gana cuando dos móviles cambian lo mismo depende de la hora de cada cambio.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const assert = require('node:assert/strict');
const servidor = require('./servidor.js');

const fecha = (menos) => { const d = new Date(); d.setDate(d.getDate() - menos); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const HOY = fecha(0), AYER = fecha(1);
const comida = (nombre, hora, p, h, g) => ({ nombre, hora, items: [{ id: 'U11367', n: 'Patata', e: 'cocida', gramos: 300 }], t: { kcal: 4 * p + 4 * h + 9 * g, p, h, g, f: 5 } });
// Lo que Abel ya tenía apuntado en su móvil antes de tener usuario
const DE_ANTES = { v: 2, aspecto: 'claro', plato: { items: [], modo: 'macros', objetivo: null, ejemplo: false, comida: null, auto: true, tam: 'normal' },
  perfil: { sexo: 'h', edad: 29, peso: 82, altura: 180, nivel: 3, ejemplo: false }, meta: { modo: 'mano', tipo: null, comidas: 4, mano: { p: 170, h: 240, g: 65 } },
  favs: ['U11367'], propios: [], platos: [{ nombre: 'Cena de Abel', items: [{ id: 'U11367', gramos: 250 }] }],
  dias: { [AYER]: [comida('Comida', '14:00', 60, 70, 20), comida('Cena', '21:30', 40, 50, 15)], [HOY]: [comida('Desayuno', '8:10', 40, 60, 15)] },
  metas: { [AYER]: { kcal: 2225, p: 170, h: 240, g: 65 }, [HOY]: { kcal: 2225, p: 170, h: 240, g: 65 } }, pesos: [{ f: AYER, kg: 82.4 }, { f: HOY, kg: 82 }] };

(async () => {
  const srv = await servidor({ nube: true }), URL = srv.url, nube = srv.nube;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errores = [];
  const movil = async (estado) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|ERR_EMPTY_RESPONSE|ERR_CONNECTION/.test(m.text())) errores.push(m.text()); });
    p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
    if (estado) await p.addInitScript((s) => { if (!localStorage.getItem('algramo.v1') && !sessionStorage.getItem('sembrado')) { localStorage.setItem('algramo.v1', s); sessionStorage.setItem('sembrado', '1'); } }, JSON.stringify(estado));
    const a = {
      p, ctx,
      txt: async (s) => (await p.textContent(s)).replace(/\s+/g, ' ').trim(),
      toca: async (s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); },
      abre: async (u) => { await p.goto(u || URL); await p.waitForTimeout(600); },
      pin: async (n) => { for (const c of n) { await p.locator(`#entrada [data-a="en-tecla"][data-v="${c}"]`).click(); await p.waitForTimeout(60); } await p.waitForTimeout(700); },
      guardado: () => p.evaluate(() => JSON.parse(localStorage.getItem('algramo.v1'))),
      /** Espera a que el móvil y la cuenta estén iguales (nada pendiente, nada en marcha). */
      alDia: async () => { await p.waitForTimeout(450); await p.waitForFunction(() => { const e = window.Nube.estado(); return window.Nube.dentro() && !e.enMarcha && e.pendientes === 0 && !e.fallo; }, null, { timeout: 15000 }); },
      /** Como volver a abrir la app al cabo de un rato: baja lo que haya nuevo. */
      baja: async () => { await p.evaluate(() => window.Nube.sinc()); await p.waitForTimeout(350); },
      dentro: () => p.evaluate(() => window.Nube.dentro()),
      fuera: async () => p.isVisible('#entrada')
    };
    return a;
  };
  const paso = (t) => console.log('  ✓', t);
  const cuenta = async (tabla, donde) => (await nube.sql(`select count(*)::int as n from ag.${tabla} ${donde || ''}`)).rows[0].n;
  const enlace = (c) => URL + '#c=' + c;

  /* ── 1. Sin invitación no se entra ─────────────────────────────── */
  const codAbel = await nube.alta('Abel', false);
  let m1 = await movil(DE_ANTES);
  await m1.abre();
  assert.equal(await m1.fuera(), true, 'la app pide la invitación');
  assert.match(await m1.txt('#entrada'), /Macros Entra con la invitación que te han pasado\..*Sin correo ni contraseña\. Lo que apuntes es solo tuyo\./);
  assert.equal(await m1.p.isDisabled('#entrada [data-a="en-seguir"]'), true, 'sin código no se sigue');
  await m1.p.fill('#en-codigo', 'AAAABBBBCCCC'); await m1.p.waitForTimeout(150);
  assert.equal(await m1.p.inputValue('#en-codigo'), 'aaaa-bbbb-cccc', 'el código se ordena solo mientras se escribe');
  await m1.p.fill('#en-codigo', 'https://macros-wiia.vercel.app/#c=aaaa-bbbb-cccc'); await m1.p.waitForTimeout(150);
  assert.equal(await m1.p.inputValue('#en-codigo'), 'aaaa-bbbb-cccc', 'y si se pega el enlace entero, se queda con el código');
  await m1.toca('#entrada [data-a="en-seguir"]'); await m1.p.waitForTimeout(500);
  assert.equal(await m1.txt('#en-aviso'), 'Ese código no vale. Pide a quien te invitó que te pase otro.');
  assert.equal(await m1.p.locator('#tabs').evaluate((el) => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e.closest('#entrada'); }), true, 'lo de debajo no se puede tocar');
  assert.equal(await m1.p.evaluate(() => document.querySelector('#tabs').closest('[inert]') !== null && document.querySelector('.pantallas').inert), true, 'ni recorrer con el teclado');
  paso('sin invitación no se entra: pide el código, lo ordena al escribirlo y dice si no vale');

  /* ── 2. Con el enlace: crear el PIN, y lo del móvil sube a la cuenta ── */
  await m1.abre(enlace(codAbel));
  assert.equal(await m1.txt('#en-hola'), 'Hola, Abel');
  assert.equal(await m1.txt('#en-texto'), 'Crea tu PIN de 4 números. Solo te lo pedirá si entras desde otro móvil.');
  assert.equal(await m1.p.evaluate(() => location.hash), '', 'el código no se queda en la dirección');
  await m1.pin('25'); assert.equal(await m1.p.getAttribute('#en-puntos', 'data-n'), '2');
  await m1.toca('#entrada [data-a="en-borra"]'); assert.equal(await m1.p.getAttribute('#en-puntos', 'data-n'), '1');
  await m1.pin('580'); assert.equal(await m1.txt('#en-texto'), 'Repite tu PIN.');
  await m1.pin('2581'); assert.equal(await m1.txt('#en-aviso'), 'No coinciden. Empieza otra vez.');
  assert.equal(await m1.txt('#en-texto'), 'Crea tu PIN de 4 números. Solo te lo pedirá si entras desde otro móvil.');
  await m1.pin('2580'); await m1.pin('2580');
  await m1.p.waitForFunction(() => document.querySelector('#entrada').hidden, null, { timeout: 8000 });
  assert.equal(await m1.p.evaluate(() => document.querySelector('.pantallas').inert), false, 'ya dentro, la app vuelve a responder');
  await m1.alDia();
  assert.equal(await cuenta('dias'), 2, 'los dos días que tenía en el móvil están en su cuenta');
  assert.equal(await cuenta('pesos'), 2); assert.equal(await cuenta('estado'), 1);
  const est = (await nube.sql('select datos from ag.estado')).rows[0].datos;
  assert.deepEqual([est.perfil.edad, est.meta.mano.p, est.favs, est.platos[0].nombre], [29, 170, ['U11367'], 'Cena de Abel']);
  assert.equal((await m1.guardado()).dias[HOY].length, 1, 'y en el móvil sigue todo');
  await m1.toca('[data-a="tab"][data-v="macros"]');
  assert.match(await m1.txt('[data-a="cuenta"]'), /^Tu cuenta: Abel Todo guardado/);
  paso('con el enlace: crea su PIN (dos veces), entra, y lo que tenía en el móvil sube a su cuenta');

  /* ── 3. Desde otro móvil: código y PIN, y baja todo ───────────────── */
  let m2 = await movil();
  await m2.abre();
  await m2.p.fill('#en-codigo', codAbel.replace(/-/g, '').toUpperCase()); await m2.toca('#entrada [data-a="en-seguir"]'); await m2.p.waitForTimeout(400);
  assert.equal(await m2.txt('#en-hola'), 'Hola, Abel'); assert.equal(await m2.txt('#en-texto'), 'Escribe tu PIN.');
  await m2.pin('0000'); assert.equal(await m2.txt('#en-aviso'), 'PIN incorrecto. Te quedan 4 intentos.');
  await m2.pin('2580');
  await m2.p.waitForFunction(() => document.querySelector('#entrada').hidden, null, { timeout: 8000 });
  await m2.alDia();
  let g2 = await m2.guardado();
  assert.deepEqual(Object.keys(g2.dias).sort(), [AYER, HOY].sort()); assert.equal(g2.dias[AYER].length, 2);
  assert.deepEqual([g2.perfil.edad, g2.meta.mano.p, g2.pesos.length, g2.platos[0].nombre], [29, 170, 2, 'Cena de Abel']);
  await m2.toca('[data-a="tab"][data-v="hoy"]');
  assert.equal(await m2.p.locator('#hoy-cuerpo .comida').count(), 1, 'se ve el desayuno apuntado en el otro móvil');
  assert.equal(await m2.txt('#ds-p'), 'de 170 g', 'y sus macros');
  assert.equal(await cuenta('dias'), 2, 'bajar no duplica nada');
  paso('desde otro móvil: código y PIN (uno mal, cuatro intentos), y baja todo lo suyo');

  /* ── 4. Los cambios van y vienen ──────────────────────────────────── */
  await m2.toca('[data-a="tab"][data-v="macros"]'); await m2.toca('[data-a="peso"]');
  await m2.p.fill('#kg-in', '81,5'); await m2.toca('[data-a="peso-apuntar"]'); await m2.toca('#sheet [data-a="cerrar"]');
  await m2.alDia();
  assert.equal((await nube.sql(`select kg::float as kg from ag.pesos where dia = $1`, [HOY])).rows[0].kg, 81.5);
  await m1.baja();
  assert.match(await m1.txt('[data-a="peso"]'), /^Mi peso: 81,5 kg/, 'el peso apuntado en un móvil aparece en el otro');
  await m1.toca('[data-a="tab"][data-v="hoy"]'); await m1.toca('#hoy-cuerpo .comida'); await m1.toca('#sheet [data-a="borrar-comida"]');
  await m1.p.waitForTimeout(5300);                                        // pasa el «Deshacer»
  await m1.alDia();
  await m2.toca('[data-a="tab"][data-v="hoy"]'); await m2.baja();
  assert.equal(await m2.p.locator('#hoy-cuerpo .comida').count(), 0, 'la comida borrada en un móvil desaparece del otro');
  assert.equal((await m2.guardado()).dias[HOY], undefined);
  paso('los cambios van y vienen: un peso apuntado en un móvil y una comida borrada en el otro');

  /* ── 5. Sin conexión se apunta igual y sube al volver ─────────────── */
  await m1.ctx.setOffline(true);
  await m1.toca('[data-a="tab"][data-v="macros"]'); await m1.toca('[data-a="peso"]');
  await m1.p.fill('#kg-in', '81,2'); await m1.toca('[data-a="peso-apuntar"]'); await m1.toca('#sheet [data-a="cerrar"]');
  await m1.p.waitForFunction(() => window.Nube.estado().fallo === 'red', null, { timeout: 12000 });
  assert.match(await m1.txt('[data-a="cuenta"]'), /^Tu cuenta: Abel Sin conexión: se guardará al volver/);
  assert.equal((await nube.sql(`select kg::float as kg from ag.pesos where dia = $1`, [HOY])).rows[0].kg, 81.5, 'aún no ha subido');
  await m1.ctx.setOffline(false);
  await m1.p.evaluate(() => window.dispatchEvent(new Event('online')));
  await m1.alDia();
  assert.equal((await nube.sql(`select kg::float as kg from ag.pesos where dia = $1`, [HOY])).rows[0].kg, 81.2, 'al volver la conexión, sube solo');
  assert.match(await m1.txt('[data-a="cuenta"]'), /^Tu cuenta: Abel Todo guardado/);
  paso('sin conexión se apunta igual, lo dice, y sube solo al volver');

  /* ── 6. Cerrar sesión deja el móvil limpio; al volver a entrar está todo ── */
  const sesiones = await cuenta('sesiones');
  await m2.toca('[data-a="tab"][data-v="macros"]'); await m2.toca('[data-a="cuenta"]');
  assert.equal(await m2.txt('#sheet-h'), 'Tu cuenta');
  assert.equal(await m2.p.locator('#sheet [data-a="cu-usuarios"]').count(), 0, 'quien no es administrador no ve «Usuarios»');
  await m2.toca('#sheet [data-a="cu-salir"]');
  assert.match(await m2.txt('#sheet'), /Este móvil se quedará limpio\. Tus datos siguen en tu cuenta/);
  await m2.toca('#sheet [data-a="cu-salir-ya"]'); await m2.p.waitForTimeout(1500);
  assert.equal(await m2.fuera(), true);
  assert.equal(await m2.p.evaluate(() => { const t = localStorage.getItem('algramo.v1'); return t ? Object.keys(JSON.parse(t).dias || {}).length : 0; }), 0, 'en el móvil no queda nada apuntado');
  assert.equal(await m2.p.evaluate(() => localStorage.getItem('macros.nube.v1')), null);
  assert.equal(await cuenta('sesiones'), sesiones - 1, 'y su sesión se cierra en el servidor');
  await m2.p.fill('#en-codigo', codAbel); await m2.toca('#entrada [data-a="en-seguir"]'); await m2.p.waitForTimeout(400); await m2.pin('2580');
  await m2.p.waitForFunction(() => document.querySelector('#entrada').hidden, null, { timeout: 8000 });
  await m2.alDia();
  g2 = await m2.guardado();
  assert.deepEqual([Object.keys(g2.dias), g2.pesos.length, g2.perfil.edad], [[AYER], 2, 29], 'al volver a entrar, todo lo suyo');
  paso('cerrar sesión deja el móvil limpio y cierra la sesión; al volver a entrar está todo');

  /* ── 7. El administrador: quién la usa, sin ver lo que comen ──────── */
  const codJavi = await nube.alta('Javi', true);
  const adm = await movil();
  await adm.abre(enlace(codJavi)); await adm.pin('1379'); await adm.pin('1379');
  await adm.p.waitForFunction(() => document.querySelector('#entrada').hidden, null, { timeout: 8000 });
  await adm.alDia();
  await adm.toca('[data-a="tab"][data-v="macros"]'); await adm.toca('[data-a="cuenta"]'); await adm.toca('#sheet [data-a="cu-usuarios"]'); await adm.p.waitForTimeout(500);
  assert.equal(await adm.txt('#sheet-h'), 'Usuarios');
  let filas = await adm.p.$$eval('#sheet .us-fila', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  assert.equal(filas.length, 2);
  assert.match(filas[0], /^J Javi Hoy, \d{1,2}:\d\d · 0 de 7 días apuntados Tú · admin$/);
  assert.match(filas[1], /^A Abel Hoy, \d{1,2}:\d\d · 1 de 7 días apuntados Activo$/);
  assert.ok(!/Patata|Comida|Cena|81[,.]|82[,.]/.test(await adm.txt('#sheet')), 'ni comidas ni pesos de nadie');
  paso('el administrador ve quién la usa y cuántos días apunta, no lo que comen ni lo que pesan');

  /* ── 8. Invitar: un nombre y sale el enlace ───────────────────────── */
  await adm.toca('#sheet [data-a="us-invitar"]');
  await adm.p.fill('#us-nombre', 'Dani'); await adm.toca('#sheet [data-a="us-crear"]'); await adm.p.waitForTimeout(500);
  const enlaceDani = await adm.txt('#us-enlace');
  assert.match(enlaceDani, new RegExp('^' + URL.replace(/[.\/]/g, '\\$&') + '#c=[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}$'));
  await adm.toca('#sheet [data-a="us-copiar"]');
  assert.equal(await adm.p.evaluate(() => navigator.clipboard.readText()), enlaceDani, 'el enlace se copia');
  await adm.toca('#sheet [data-a="us-volver"]'); await adm.p.waitForTimeout(500);
  filas = await adm.p.$$eval('#sheet .us-fila', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  assert.equal(filas[2], 'D Dani Invitación sin usar · caduca en 7 días Pendiente');
  const m3 = await movil(); await m3.abre(enlaceDani);
  assert.equal(await m3.txt('#en-hola'), 'Hola, Dani'); assert.match(await m3.txt('#en-texto'), /^Crea tu PIN/);
  paso('invitar: un nombre, sale el enlace (se copia) y queda «Pendiente» hasta que se use');

  /* ── 9. Desactivar: fuera al momento; activar: vuelve a entrar y sigue donde estaba ── */
  await adm.toca('#sheet .us-fila[data-nombre="Abel"]');
  assert.equal(await adm.txt('#sheet-h'), 'Abel');
  await adm.toca('#sheet [data-a="us-activar"]'); await adm.p.waitForTimeout(500);
  filas = await adm.p.$$eval('#sheet .us-fila', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  assert.match(filas[1], /Desactivado$/);
  await m1.baja(); await m1.p.waitForTimeout(400);
  assert.equal(await m1.fuera(), true, 'su móvil se queda fuera');
  assert.match(await m1.txt('#entrada'), /Tu sesión se ha cerrado\. Entra otra vez con tu código\./);
  await m1.p.fill('#en-codigo', codAbel); await m1.toca('#entrada [data-a="en-seguir"]'); await m1.p.waitForTimeout(400);
  assert.equal(await m1.txt('#en-aviso'), 'Ese código no vale. Pide a quien te invitó que te pase otro.');
  assert.equal((await m1.guardado()).pesos.length, 2, 'lo que tenía en el móvil no se borra');
  await adm.toca('#sheet .us-fila[data-nombre="Abel"]'); await adm.toca('#sheet [data-a="us-activar"]'); await adm.p.waitForTimeout(500);
  await m1.toca('#entrada [data-a="en-seguir"]'); await m1.p.waitForTimeout(400); await m1.pin('2580');
  await m1.p.waitForFunction(() => document.querySelector('#entrada').hidden, null, { timeout: 8000 });
  await m1.alDia();
  assert.equal(await cuenta('dias'), 2, 'la misma persona en su móvil: sigue donde estaba, sin duplicar nada');
  paso('desactivar deja su móvil fuera al momento, con sus datos; al activarlo vuelve a entrar y sigue donde estaba');

  /* ── 10. En un móvil con los datos de una cuenta no entra otra ─────── */
  await adm.toca('#sheet .us-fila[data-nombre="Abel"]'); await adm.toca('#sheet [data-a="us-activar"]'); await adm.p.waitForTimeout(500);   // Abel, fuera otra vez
  await m1.baja(); await m1.p.waitForTimeout(400); assert.equal(await m1.fuera(), true);
  const codOtra = await nube.alta('Otra', false);
  await m1.p.fill('#en-codigo', codOtra); await m1.toca('#entrada [data-a="en-seguir"]'); await m1.p.waitForTimeout(400);
  await m1.pin('4680'); await m1.pin('4680'); await m1.p.waitForTimeout(600);
  assert.equal(await m1.fuera(), true);
  assert.match(await m1.txt('#en-aviso'), /Este móvil guarda lo de otra cuenta\. Cierra antes su sesión/);
  assert.equal(await cuenta('dias', `where usuario = (select id from ag.usuarios where nombre = 'Otra')`), 0, 'lo de Abel no pasa a la otra cuenta');
  assert.equal(await cuenta('sesiones', `where usuario = (select id from ag.usuarios where nombre = 'Otra')`), 0, 'ni se queda dentro');
  await m1.toca('#entrada [data-a="en-limpiar"]'); await m1.toca('#entrada [data-a="en-limpiar-ya"]'); await m1.p.waitForTimeout(1500);
  assert.equal(await m1.p.evaluate(() => localStorage.getItem('macros.nube.v1')), null);
  assert.equal(await m1.p.evaluate(() => { const t = localStorage.getItem('algramo.v1'); return t ? JSON.parse(t).pesos.length : 0; }), 0, '«Cerrar la sesión de este móvil» lo deja limpio');
  paso('un móvil con los datos de una cuenta no deja entrar a otra sin cerrar antes: nada se mezcla');

  /* ── 11. Enlace nuevo: el viejo deja de valer; con el nuevo, sus datos siguen ── */
  await adm.toca('#sheet .us-fila[data-nombre="Abel"]'); await adm.toca('#sheet [data-a="us-activar"]'); await adm.p.waitForTimeout(500);   // activo de nuevo
  await adm.toca('#sheet .us-fila[data-nombre="Abel"]'); await adm.toca('#sheet [data-a="us-enlace-nuevo"]');
  assert.match(await adm.txt('#sheet'), /El enlace de ahora dejará de valer/);
  await adm.toca('#sheet [data-a="us-enlace-ya"]'); await adm.p.waitForTimeout(500);
  const enlaceNuevo = await adm.txt('#us-enlace');
  assert.notEqual(enlaceNuevo, enlace(codAbel));
  await m2.baja(); await m2.p.waitForTimeout(400); assert.equal(await m2.fuera(), true, 'el otro móvil de Abel también sale');
  await m1.abre(enlace(codAbel)); await m1.p.waitForTimeout(500);
  assert.equal(await m1.txt('#en-aviso'), 'Ese código no vale. Pide a quien te invitó que te pase otro.');
  await m1.abre(enlaceNuevo); assert.equal(await m1.txt('#en-hola'), 'Hola, Abel'); assert.match(await m1.txt('#en-texto'), /^Crea tu PIN/);
  await m1.pin('8642'); await m1.pin('8642');
  await m1.p.waitForFunction(() => document.querySelector('#entrada').hidden, null, { timeout: 8000 });
  await m1.alDia();
  assert.deepEqual([Object.keys((await m1.guardado()).dias), (await m1.guardado()).pesos.length], [[AYER], 2], 'con el enlace nuevo, lo suyo sigue ahí');
  paso('enlace nuevo: el viejo deja de valer, sus móviles salen y, con el nuevo, sus datos siguen');

  /* ── 12. Quien ya está dentro no cambia de cuenta por abrir el enlace de otro ── */
  await adm.abre(enlace(codOtra)); await adm.p.waitForTimeout(500);
  assert.equal(await adm.fuera(), false); assert.equal(await adm.p.evaluate(() => window.Nube.usuario().nombre), 'Javi');
  assert.equal(await adm.p.evaluate(() => location.hash), '');
  paso('abrir el enlace de otra persona estando dentro no cambia nada');

  await b.close(); srv.cierra();
  assert.deepEqual(errores, [], 'errores de consola');
  console.log('USUARIOS BIEN · sin errores de consola');
})().catch((e) => { console.error('\nFALLO:', e.message, '\n', (e.stack || '').split('\n').filter((l) => /usuarios\.js/.test(l)).join('\n')); process.exit(1); });
