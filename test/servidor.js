// Sirve la app por HTTP en un puerto libre, para que las pruebas la abran como un navegador de verdad.
// Con file://, el Chrome sin ventana devuelve a veces el almacenamiento vacío al recargar si la máquina va cargada
// (medido: 3–5 de cada 100 recargas con cuatro navegadores a la vez; por HTTP, 0 de 200).
const http = require('http'), fs = require('fs'), path = require('path');
module.exports = function servidor() {
  const archivo = path.resolve(__dirname, '../dist/index.html');
  const s = http.createServer((req, res) => {
    fs.readFile(archivo, (e, d) => {
      if (e) { res.writeHead(500); res.end(String(e)); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(d);
    });
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${s.address().port}/`, cierra: () => s.close() })));
};
