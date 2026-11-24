// Dibuja el icono de Macros (el plato visto desde arriba: un aro repartido entre proteína, hidratos y grasa)
// y saca los tamaños que piden el navegador, Android y el iPhone. Solo hay que volver a pasarlo si cambia el dibujo:
//   node src/iconos/hacer.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const AQUI = __dirname;

const TINTA = '#14181F', P = '#3987E5', H = '#EB6834', G = '#1BAF7A';
/** El dibujo en un lienzo de 512: fondo (redondeado o a sangre) y el aro en tres tramos con las puntas redondas. */
function svg(aSangre) {
  const r = 132, grosor = 46, vuelta = 2 * Math.PI * r, hueco = 20 + grosor;       // el hueco visible es de 20: las puntas redondas se comen el resto
  const reparto = [[P, 0.31], [H, 0.44], [G, 0.25]], largo = vuelta - 3 * hueco;
  let desde = hueco / 2;
  const tramos = reparto.map(([color, parte]) => {
    const l = largo * parte, t = `<circle cx="256" cy="256" r="${r}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linecap="round" stroke-dasharray="${l.toFixed(1)} ${vuelta.toFixed(1)}" stroke-dashoffset="${(-desde).toFixed(1)}" transform="rotate(-90 256 256)"/>`;
    desde += l + hueco; return t;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${aSangre ? 0 : 116}" fill="${TINTA}"/>${tramos}</svg>`;
}

(async () => {
  fs.writeFileSync(path.join(AQUI, 'icono.svg'), svg(false) + '\n');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const saca = async (nombre, lado, aSangre) => {
    const p = await b.newPage({ viewport: { width: lado, height: lado } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg(aSangre)}`);
    await p.screenshot({ path: path.join(AQUI, nombre), omitBackground: true, clip: { x: 0, y: 0, width: lado, height: lado } });
    await p.close(); console.log('  ✓', nombre);
  };
  await saca('icono-192.png', 192, false);
  await saca('icono-512.png', 512, false);
  await saca('icono-maskable-512.png', 512, true);    // Android lo recorta con su forma: fondo a sangre y el aro dentro de la zona segura
  await saca('icono-180.png', 180, true);             // iPhone: sin transparencia; las esquinas las redondea él
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
