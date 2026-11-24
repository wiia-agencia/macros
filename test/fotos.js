// Capturas de las pantallas que faltan por revisar y de los dos aspectos (para enseñarlos).
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const dir = path.resolve(__dirname, '../capturas'); fs.mkdirSync(dir, { recursive: true });
const servidor = require('./servidor.js');
(async () => {
  const srv = await servidor(), URL = srv.url;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const nueva = async (aspecto) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
    const p = await ctx.newPage(); await p.clock.setFixedTime(new Date('2026-11-24T14:00:00+01:00')); await p.goto(URL); await p.waitForTimeout(500);
    if (aspecto) { await p.evaluate((a) => { const s = JSON.parse(localStorage.getItem('algramo.v1') || '{}'); s.aspecto = a; localStorage.setItem('algramo.v1', JSON.stringify(s)); }, aspecto); await p.reload(); await p.waitForTimeout(600); }
    return p;
  };
  const foto = async (p, n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${dir}/${n}.png` }); };
  const toca = async (p, s) => { await p.locator(s).first().click(); await p.waitForTimeout(350); };
  for (const a of ['claro', 'oscuro']) {
    const p = await nueva(a);
    await toca(p, '[data-a="ver-ejemplo"]');
    await toca(p, '[data-a="tab"][data-v="macros"]'); await toca(p, '[data-a="meta"][data-v="definir"]');
    await toca(p, '[data-a="tab"][data-v="plato"]'); await toca(p, '#plato-filas .fila:nth-child(1) [data-a="mas"]'); await toca(p, '#plato-filas .fila:nth-child(1) [data-a="menos"]');
    await p.waitForTimeout(2600); await foto(p, `a-${a}-plato`);
    await toca(p, '[data-a="modo"][data-v="macros"]'); await foto(p, `a-${a}-macros`);
    await toca(p, '[data-a="tab"][data-v="alimentos"]'); await p.fill('#busca-biblio input', 'pollo'); await foto(p, `a-${a}-alimentos`);
    if (a === 'claro') {
      await toca(p, '[data-a="nuevo"]'); await foto(p, 'b-crear');
      await toca(p, '#sheet [data-a="cerrar"]'); await p.fill('#busca-biblio input', 'zzz'); await foto(p, 'b-no-encuentro');
      await toca(p, '[data-a="datos"]'); await foto(p, 'b-datos'); await toca(p, '#sheet [data-a="cerrar"]');
      await toca(p, '[data-a="tab"][data-v="macros"]'); await toca(p, '[data-a="meta-modo"][data-v="mano"]'); await foto(p, 'b-a-mano');
      await toca(p, '[data-a="meta-modo"][data-v="calc"]'); await p.locator('#p-macros').evaluate((el) => el.scrollTo(0, 9999)); await p.locator('details.como summary').click(); await p.locator('#p-macros').evaluate((el) => el.scrollTo(0, 9999)); await foto(p, 'b-como');
      await toca(p, '[data-a="tab"][data-v="plato"]'); await toca(p, '[data-a="modo"][data-v="gramos"]'); await toca(p, '[data-a="platos"]'); await toca(p, '#sheet [data-a="vaciar"]'); await p.waitForTimeout(5500); await foto(p, 'b-vacio');
    }
  }
  await b.close(); srv.cierra();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
