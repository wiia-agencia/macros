// Sirve la app por HTTP en un puerto libre, como la sirve Vercel: la carpeta public/ con las cabeceras de vercel.json.
// Así las pruebas la abren como un navegador de verdad y bajo la misma política de seguridad que en producción.
// (Con file://, el Chrome sin ventana devuelve a veces el almacenamiento vacío al recargar si la máquina va cargada:
//  medido, 3–5 de cada 100 recargas con cuatro navegadores a la vez; por HTTP, 0 de 200.)
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..'), PUB = path.join(RAIZ, 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

module.exports = function servidor() {
  const reglas = (JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8')).headers || []).map((h) => ({ re: new RegExp('^' + h.source + '$'), cabeceras: h.headers }));
  let marca = '';                                     // simula un despliegue nuevo: la página y el service worker cambian
  const s = http.createServer((req, res) => {
    const ruta = decodeURIComponent(req.url.split('?')[0]), rel = ruta === '/' ? '/index.html' : ruta;
    const archivo = path.join(PUB, path.normalize(rel));
    if (archivo.indexOf(PUB) !== 0) { res.writeHead(403); res.end(); return; }
    fs.readFile(archivo, (e, d) => {
      const cab = { 'cache-control': 'public, max-age=0, must-revalidate' };
      reglas.forEach((r) => { if (r.re.test(ruta)) r.cabeceras.forEach((c) => { cab[c.key.toLowerCase()] = c.value; }); });
      if (e) { res.writeHead(404, cab); res.end('No encontrado'); return; }
      cab['content-type'] = TIPOS[path.extname(archivo)] || 'application/octet-stream';
      if (marca && rel === '/index.html') d = Buffer.from(d.toString('utf8').replace('</body>', `<!-- ${marca} --></body>`));
      if (marca && rel === '/sw.js') d = Buffer.from(d.toString('utf8').replace(/const VERSION = '[^']*'/, `const VERSION = '${marca}'`));
      res.writeHead(200, cab); res.end(d);
    });
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${s.address().port}/`, cierra: () => s.close(), despliega: (m) => { marca = m; } })));
};
