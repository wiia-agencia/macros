// Sirve la app por HTTP en un puerto libre, como la sirve Vercel: la carpeta public/ con las cabeceras de vercel.json.
// Así las pruebas la abren como un navegador de verdad y bajo la misma política de seguridad que en producción.
// (Con file://, el Chrome sin ventana devuelve a veces el almacenamiento vacío al recargar si la máquina va cargada:
//  medido, 3–5 de cada 100 recargas con cuatro navegadores a la vez; por HTTP, 0 de 200.)
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '..'), PUB = path.join(RAIZ, 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

/**
 * opciones.nube: arranca también la nube de pruebas (un Postgres dentro de Node con el esquema de verdad) y hace que la
 * app hable con ella en vez de con Supabase. Sin eso se sirve la app sin cuenta, como la versión que se abre en Claude.
 */
module.exports = async function servidor(opciones) {
  const reglas = (JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8')).headers || []).map((h) => ({ re: new RegExp('^' + h.source + '$'), cabeceras: h.headers }));
  const nube = opciones && opciones.nube ? await require('./nube.js')() : null;
  let marca = '';                                     // simula un despliegue nuevo: la página y el service worker cambian
  let caida = false;                                  // simula que el servidor de la cuenta no responde
  let llamadas = [];                                  // qué funciones de la cuenta se han llamado (para las pruebas)
  let origen = '';
  const s = http.createServer((req, res) => {
    const ruta = decodeURIComponent(req.url.split('?')[0]), rel = ruta === '/' ? '/index.html' : ruta;
    const rpc = /^\/nube\/rest\/v1\/rpc\/([A-Za-z0-9_]+)$/.exec(ruta);
    if (rpc && nube) {                                // lo que en producción es https://…supabase.co/rest/v1/rpc/…
      if (caida) { req.socket.destroy(); return; }
      let cuerpo = '';
      req.on('data', (d) => { cuerpo += d; });
      req.on('end', () => {
        llamadas.push(rpc[1]);
        const responde = (estado, dato) => { res.writeHead(estado, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(dato)); };
        if (req.method !== 'POST' || !req.headers.apikey) return responde(401, { message: 'falta la clave' });
        let args; try { args = JSON.parse(cuerpo || '{}'); } catch (e) { return responde(400, { message: 'cuerpo ilegible' }); }
        nube.rpc(rpc[1], args).then((r) => responde(200, r), (e) => responde(/desconocida|does not exist/.test(e.message) ? 404 : 400, { message: e.message }));
      });
      return;
    }
    const archivo = path.join(PUB, path.normalize(rel));
    if (archivo.indexOf(PUB) !== 0) { res.writeHead(403); res.end(); return; }
    fs.readFile(archivo, (e, d) => {
      const cab = { 'cache-control': 'public, max-age=0, must-revalidate' };
      reglas.forEach((r) => { if (r.re.test(ruta)) r.cabeceras.forEach((c) => { cab[c.key.toLowerCase()] = c.value; }); });
      if (e) { res.writeHead(404, cab); res.end('No encontrado'); return; }
      cab['content-type'] = TIPOS[path.extname(archivo)] || 'application/octet-stream';
      if (rel === '/index.html') {
        let t = d.toString('utf8');
        const aqui = nube ? `<script>window.MACROS_NUBE = ${JSON.stringify({ url: origen + '/nube', clave: 'clave-de-prueba' })};</script>` : '';
        t = t.replace(/<!--NUBE-->[\s\S]*?<!--\/NUBE-->/, aqui);
        if (marca) t = t.replace('</body>', `<!-- ${marca} --></body>`);
        d = Buffer.from(t);
      }
      if (marca && rel === '/sw.js') d = Buffer.from(d.toString('utf8').replace(/const VERSION = '[^']*'/, `const VERSION = '${marca}'`));
      res.writeHead(200, cab); res.end(d);
    });
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => {
    origen = `http://127.0.0.1:${s.address().port}`;
    ok({ url: origen + '/', nube, cierra: () => { s.close(); if (nube) nube.cierra(); }, despliega: (m) => { marca = m; },
      cae: (si) => { caida = !!si; }, llamadas: () => llamadas, olvida: () => { llamadas = []; } });
  }));
};
