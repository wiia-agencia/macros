// Capturas de la parte de usuarios (entrar, la cuenta y el panel del administrador) contra la nube de pruebas.
// Uso: node test/fotos-usuarios.js   → capturas/u-*.png
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const servidor = require('./servidor.js');
const dir = path.resolve(__dirname, '../capturas');
fs.mkdirSync(dir, { recursive: true });
const fecha = (menos) => { const d = new Date(); d.setDate(d.getDate() - menos); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const comida = (nombre, hora, p, h, g) => ({ nombre, hora, items: [{ id: 'U11367', n: 'Patata', e: 'cocida', gramos: 300 }], t: { kcal: 4 * p + 4 * h + 9 * g, p, h, g, f: 5 } });

(async () => {
  const srv = await servidor({ nube: true }), URL = srv.url, nube = srv.nube;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const movil = async (esquema) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: esquema || 'light', locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    return p;
  };
  const toca = async (p, s) => { await p.locator(s).first().click(); await p.waitForTimeout(450); };
  const pin = async (p, n) => { for (const c of n) { await p.locator(`#entrada [data-a="en-tecla"][data-v="${c}"]`).click(); await p.waitForTimeout(60); } await p.waitForTimeout(700); };
  const foto = async (p, n) => { await p.waitForTimeout(600); await p.screenshot({ path: `${dir}/${n}.png` }); console.log('  ✓', n); };
  const dentro = (p) => p.waitForFunction(() => document.querySelector('#entrada').hidden, null, { timeout: 8000 });
  const alDia = async (p) => { await p.waitForTimeout(450); await p.waitForFunction(() => { const e = window.Nube.estado(); return !e.enMarcha && e.pendientes === 0; }, null, { timeout: 15000 }); };

  // Abel: entra con su enlace, crea el PIN y usa la app unos días (para que el administrador vea actividad)
  const codAbel = await nube.alta('Abel', false), codJavi = await nube.alta('Javi', true);
  for (const esquema of ['light', 'dark']) {
    const s = esquema === 'light' ? '' : '-osc', p = await movil(esquema);
    await p.goto(URL); await foto(p, 'u-1-codigo-vacio' + s);
    await p.fill('#en-codigo', 'k7mp2xwd9rtn'); await foto(p, 'u-1-codigo' + s);
    if (esquema === 'dark') { await p.context().close(); continue; }
    await p.goto(URL + '#c=' + codAbel); await p.waitForTimeout(600); await pin(p, '25'); await foto(p, 'u-2-crear-pin');
    await pin(p, '80'); await foto(p, 'u-2b-repite-pin'); await pin(p, '2580'); await dentro(p);
    await p.evaluate((dias) => { const S = JSON.parse(localStorage.getItem('algramo.v1')); S.dias = dias; S.meta = { modo: 'mano', tipo: null, comidas: 4, mano: { p: 170, h: 240, g: 65 } }; localStorage.setItem('algramo.v1', JSON.stringify(S)); },
      Object.fromEntries([0, 1, 2, 4, 5].map((n) => [fecha(n), [comida('Comida', '14:00', 60, 70, 20)]])));
    await p.reload(); await p.waitForTimeout(700); await p.evaluate(() => window.Nube.alGuardar()); await p.evaluate(() => window.Nube.sinc()); await alDia(p);
    await toca(p, '[data-a="tab"][data-v="macros"]'); await p.locator('#p-macros').evaluate((el) => el.scrollTo(0, 9999)); await foto(p, 'u-3-fila-cuenta');
    await toca(p, '[data-a="cuenta"]'); await foto(p, 'u-4-tu-cuenta');
    await toca(p, '#sheet [data-a="cu-salir"]'); await foto(p, 'u-4b-cerrar-sesion');
    // otro móvil: escribir el PIN, y un PIN mal
    const q = await movil(); await q.goto(URL + '#c=' + codAbel); await q.waitForTimeout(600); await pin(q, '0000'); await foto(q, 'u-5-pin-mal'); await q.context().close();
    await p.context().close();
  }
  // Javi, el administrador
  for (const esquema of ['light', 'dark']) {
    const s = esquema === 'light' ? '' : '-osc', p = await movil(esquema);
    await p.goto(URL + '#c=' + codJavi); await p.waitForTimeout(600);
    if (esquema === 'light') { await pin(p, '1379'); await pin(p, '1379'); } else await pin(p, '1379');
    await dentro(p); await alDia(p);
    await toca(p, '[data-a="tab"][data-v="macros"]'); await toca(p, '[data-a="cuenta"]'); await foto(p, 'u-6-cuenta-admin' + s);
    await toca(p, '#sheet [data-a="cu-usuarios"]'); await p.waitForTimeout(500);
    if (esquema === 'light') {
      await toca(p, '#sheet [data-a="us-invitar"]'); await p.fill('#us-nombre', 'Dani'); await foto(p, 'u-8-invitar');
      await toca(p, '#sheet [data-a="us-crear"]'); await p.waitForTimeout(500);
      // en la captura, la dirección de la web publicada en vez de la del servidor de pruebas (el código es de esta nube de pruebas)
      await p.evaluate(() => { const e = document.querySelector('#us-enlace'); e.textContent = e.textContent.replace(location.origin, 'https://macros-wiia.vercel.app'); });
      await foto(p, 'u-9-enlace');
      await toca(p, '#sheet [data-a="us-volver"]'); await p.waitForTimeout(500);
    }
    await foto(p, 'u-7-usuarios' + s);
    if (esquema === 'light') { await toca(p, '#sheet .us-fila[data-nombre="Abel"]'); await foto(p, 'u-10-abel'); }
    await p.context().close();
  }
  await b.close(); srv.cierra();
})().catch((e) => { console.error(e); process.exit(1); });
