// El módulo de la cuenta (src/nube.js) contra la nube de pruebas, sin navegador: aquí se pueden parar las respuestas
// del servidor a mitad de camino y cortar la conexión, que es donde se pierden las cosas si algo está mal pensado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('node:vm');
const nubeDePrueba = require('./nube.js');
const CORE = fs.readFileSync(path.resolve(__dirname, '../src/core.js'), 'utf8'), NUBE = fs.readFileSync(path.resolve(__dirname, '../src/nube.js'), 'utf8');

const plano = (x) => JSON.parse(JSON.stringify(x));
const fecha = (menos) => { const d = new Date(); d.setDate(d.getDate() - menos); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const comida = (nombre, hora, kcal) => ({ nombre, hora, items: [{ id: 'U11367', n: 'Patata', e: 'cocida', gramos: 300 }], t: { kcal, p: 30, h: 40, g: 10, f: 3 } });
const estado = (mas) => Object.assign({ v: 2, aspecto: 'auto', plato: { items: [] }, perfil: { sexo: 'h', edad: 30, peso: 75, altura: 178, nivel: 3, ejemplo: false },
  meta: { modo: 'mano', tipo: null, comidas: 4, mano: { p: 165, h: 235, g: 60 } }, favs: [], propios: [], platos: [], dias: {}, metas: {}, pesos: [] }, mas || {});
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Un móvil: la app (su estado y su memoria) con el módulo de la cuenta hablando con la nube de pruebas. */
function movil(nube, S, memoria) {
  const mem = memoria || new Map(); let red = true, puerta = null; const llamadas = [], repintados = [], cambios = [];
  const ctx = { console, setTimeout, clearTimeout, AbortController };
  ctx.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
  ctx.fetch = async (url, opc) => {
    if (!red) throw new TypeError('sin red');
    const fn = url.split('/rpc/')[1]; llamadas.push(fn);
    let r, codigo = 200;
    try { r = await nube.rpc(fn, JSON.parse(opc.body)); } catch (e) { codigo = 400; r = { message: e.message }; }
    if (puerta) await puerta;                           // el servidor ya ha contestado; la respuesta aún no ha llegado al móvil
    if (!red) throw new TypeError('sin red');
    return { ok: codigo === 200, status: codigo, json: async () => plano(r), text: async () => JSON.stringify(r) };
  };
  ctx.MACROS_NUBE = { url: 'http://nube.prueba', clave: 'clave-publica' }; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(CORE, ctx); vm.runInContext(NUBE, ctx);
  const N = ctx.Nube;
  N.conecta({ S: () => S, guarda: () => { mem.set('algramo.v1', JSON.stringify(S)); N.alGuardar(); }, repinta: (c) => repintados.push(plano(c)), desde: () => '2020-01-01', cambia: () => cambios.push(1) });
  return { N, S, mem, llamadas, repintados, cambios,
    red: (si) => { red = si; },
    /** Retiene las respuestas del servidor hasta que se llama a lo que devuelve. */
    retiene: () => { let abre; puerta = new Promise((ok) => { abre = ok; }); return () => { puerta = null; abre(); }; },
    /** Como la app al apuntar algo: guarda, y eso avisa a la cuenta. */
    guarda: () => { mem.set('algramo.v1', JSON.stringify(S)); N.alGuardar(); } };
}
async function conCuenta(S, nombre = 'Abel') {
  const nube = await nubeDePrueba(), codigo = await nube.alta(nombre, false), m = movil(nube, S || estado());
  const r = await m.N.crearPin(codigo, '2580'); assert.equal(r.ok, true);
  return Object.assign(m, { nube, codigo, id: r.usuario.id });
}
const filas = async (nube, tabla) => (await nube.sql(`select count(*)::int as n from ag.${tabla}`)).rows[0].n;

test('la primera vez sube todo lo del móvil, por tandas, y queda al día', async () => {
  const dias = {}; for (let i = 0; i < 150; i++) dias[fecha(i)] = [comida('Comida', '14:00', 500 + i)];
  const m = await conCuenta(estado({ dias, pesos: [{ f: fecha(0), kg: 76.9 }] }));
  assert.equal(await m.N.sinc(), true);
  assert.equal(await filas(m.nube, 'dias'), 150); assert.equal(await filas(m.nube, 'pesos'), 1); assert.equal(await filas(m.nube, 'estado'), 1);
  assert.deepEqual(plano(m.N.estado()).pendientes, 0);
  assert.deepEqual(m.llamadas.filter((f) => f === 'ag_sinc').length, 1 + 3, 'una para ver qué hay en la cuenta y tres tandas de 60 días');
  m.llamadas.length = 0; assert.equal(await m.N.sinc(), true);
  assert.equal(m.llamadas.length, 1, 'al día: una sola llamada, sin nada que subir');
});

test('lo que se apunta mientras una respuesta está de camino no se pisa con lo que llega', async () => {
  const hoy = fecha(0), a = await conCuenta(estado({ dias: { [hoy]: [comida('Desayuno', '8:10', 500)] } }));
  await a.N.sinc();
  const b = movil(a.nube, estado()); assert.equal((await b.N.entrar(a.codigo, '2580')).ok, true); await b.N.sinc();
  b.S.dias[hoy].push(comida('Merienda del otro móvil', '18:00', 300)); b.guarda(); await b.N.sinc();      // el otro móvil cambia hoy
  const suelta = a.retiene(), enCurso = a.N.sinc();                        // este pide lo nuevo…
  await espera(60);
  a.S.dias[hoy].push(comida('Cena apuntada aquí', '21:00', 600)); a.guarda();          // …y, antes de que llegue, apunta la cena
  suelta(); await enCurso; await espera(30); await a.N.sinc();
  assert.deepEqual(a.S.dias[hoy].map((c) => c.nombre), ['Desayuno', 'Cena apuntada aquí'], 'lo apuntado aquí sigue aquí');
  const servidor = (await a.nube.sql(`select comidas from ag.dias where dia = $1`, [hoy])).rows[0].comidas;
  assert.deepEqual(servidor.map((c) => c.nombre), ['Desayuno', 'Cena apuntada aquí'], 'y, por ser lo último, es lo que queda en la cuenta');
  assert.equal(plano(a.N.estado()).pendientes, 0);
});

test('tampoco se pisa lo recién apuntado que la app aún no ha llegado a guardar (tarda un cuarto de segundo)', async () => {
  const hoy = fecha(0), a = await conCuenta(estado({ dias: { [hoy]: [comida('Desayuno', '8:10', 500)] } }));
  await a.N.sinc();
  const b = movil(a.nube, estado()); await b.N.entrar(a.codigo, '2580'); await b.N.sinc();
  b.S.dias[hoy].push(comida('Merienda del otro móvil', '18:00', 300)); b.guarda(); await b.N.sinc();
  const suelta = a.retiene(), enCurso = a.N.sinc();
  await espera(60);
  a.S.dias[hoy].push(comida('Cena apuntada aquí', '21:00', 600));          // apuntada, pero la app todavía no ha guardado
  suelta(); await enCurso;
  assert.deepEqual(a.S.dias[hoy].map((c) => c.nombre), ['Desayuno', 'Cena apuntada aquí'], 'lo que llega no pisa lo recién apuntado');
  a.guarda(); await a.N.sinc();
  assert.deepEqual((await a.nube.sql(`select comidas from ag.dias where dia = $1`, [hoy])).rows[0].comidas.map((c) => c.nombre), ['Desayuno', 'Cena apuntada aquí']);
});

test('sin conexión se apunta la hora de cada cambio; al volver sube y gana a lo que otro móvil cambió antes', async () => {
  const hoy = fecha(0), a = await conCuenta(estado({ pesos: [{ f: hoy, kg: 80 }] })); await a.N.sinc();
  const b = movil(a.nube, estado()); await b.N.entrar(a.codigo, '2580'); await b.N.sinc();
  b.S.pesos = [{ f: hoy, kg: 79.5 }]; b.guarda(); await b.N.sinc();        // primero cambia el otro móvil (con conexión)
  await espera(15);
  a.red(false); a.S.pesos = [{ f: hoy, kg: 79 }]; a.guarda();              // después, este, sin conexión
  assert.equal(await a.N.sinc(), false); assert.deepEqual(plano(a.N.estado()), Object.assign(plano(a.N.estado()), { pendientes: 1, fallo: 'red' }));
  a.red(true); assert.equal(await a.N.sinc(), true);
  assert.equal((await a.nube.sql(`select kg::float as kg from ag.pesos`)).rows[0].kg, 79, 'gana el cambio más reciente, aunque subiera más tarde');
  await b.N.sinc(); assert.deepEqual(plano(b.S.pesos), [{ f: hoy, kg: 79 }]);
});

test('si el servidor cierra la sesión, el móvil se queda fuera con sus datos; la misma persona vuelve a entrar y sigue donde estaba', async () => {
  const hoy = fecha(0), a = await conCuenta(estado({ dias: { [hoy]: [comida('Desayuno', '8:10', 500)] } })); await a.N.sinc();
  await a.nube.sql('delete from ag.sesiones');
  a.S.dias[hoy].push(comida('Comida', '14:00', 700)); a.guarda();
  assert.equal(await a.N.sinc(), false);
  assert.deepEqual([a.N.dentro(), a.N.cerrada(), a.S.dias[hoy].length], [false, true, 2]); assert.ok(a.cambios.length > 0, 'la pantalla se entera');
  assert.equal((await a.N.entrar(a.codigo, '2580')).ok, true);
  assert.equal(await a.N.sinc(), true);
  assert.equal((await a.nube.sql('select jsonb_array_length(comidas) as n from ag.dias')).rows[0].n, 2, 'lo que apuntó estando fuera sube al volver a entrar');
  assert.equal(a.llamadas.filter((f) => f === 'ag_sinc').length, 4, 'sin volver a empezar de cero');
});

test('en un móvil con lo de una cuenta no entra otra: ni se mezcla ni se queda dentro', async () => {
  const hoy = fecha(0), a = await conCuenta(estado({ dias: { [hoy]: [comida('Secreto de Abel', '8:10', 500)] } })); await a.N.sinc();
  await a.nube.sql('delete from ag.sesiones'); await a.N.sinc();           // la sesión de Abel se cierra en el servidor
  const otra = await a.nube.alta('Bea', false);
  assert.deepEqual(plano(await a.N.crearPin(otra, '1379')), { ok: false, motivo: 'otra' });
  await espera(40);
  assert.equal(await filas(a.nube, 'sesiones'), 0, 'la sesión de Bea no se queda abierta');
  assert.equal(a.N.usuario().nombre, 'Abel'); assert.equal(a.N.cerrada(), true);
  assert.equal((await a.nube.sql(`select count(*)::int as n from ag.dias d join ag.usuarios u on u.id = d.usuario where u.nombre = 'Bea'`)).rows[0].n, 0);
  assert.deepEqual(plano(await a.N.salir(true)), { ok: true });            // «Cerrar la sesión de este móvil»
  assert.deepEqual([a.mem.has('algramo.v1'), a.mem.has('macros.nube.v1'), a.N.usuario()], [false, false, null]);
});

test('cerrar sesión: con cosas sin subir y sin conexión no cierra; con conexión sube, cierra en el servidor y limpia el móvil', async () => {
  const hoy = fecha(0), a = await conCuenta(estado()); await a.N.sinc();
  a.S.pesos = [{ f: hoy, kg: 77 }]; a.guarda(); a.red(false);
  assert.deepEqual(plano(await a.N.salir()), { ok: false, motivo: 'pendiente' });
  assert.deepEqual([a.mem.has('algramo.v1'), a.N.dentro()], [true, true], 'no se pierde nada');
  a.red(true);
  assert.deepEqual(plano(await a.N.salir()), { ok: true });
  assert.equal(await filas(a.nube, 'pesos'), 1, 'lo pendiente sube antes de salir');
  assert.equal(await filas(a.nube, 'sesiones'), 0);
  assert.deepEqual([a.mem.has('algramo.v1'), a.mem.has('macros.nube.v1'), a.N.dentro()], [false, false, false]);
});

test('lo apuntado y lo que se sabe de la cuenta se guardan siempre juntos', async () => {
  const hoy = fecha(0), a = await conCuenta(estado()); await a.N.sinc();
  a.mem.delete('algramo.v1'); a.mem.delete('macros.nube.v1');
  const b = movil(a.nube, estado()); await b.N.entrar(a.codigo, '2580'); b.S.pesos = [{ f: hoy, kg: 81 }]; b.guarda(); await b.N.sinc();
  await a.N.sinc();                                                        // a este le llega el peso del otro
  assert.deepEqual([JSON.parse(a.mem.get('algramo.v1')).pesos, JSON.parse(a.mem.get('macros.nube.v1')).base.pesos[hoy]], [[{ f: hoy, kg: 81 }], '81']);
  a.mem.delete('macros.nube.v1'); a.guarda();
  assert.ok(a.mem.has('macros.nube.v1'), 'cada vez que la app guarda, la cuenta también');
  assert.deepEqual(a.repintados.slice(-1), [{ dias: false, pesos: true, estado: false }], 'y la pantalla sabe qué repintar');
});

test('al reabrir la app sigue dentro, con lo que tenía pendiente', async () => {
  const hoy = fecha(0), a = await conCuenta(estado()); await a.N.sinc();
  a.red(false); a.S.pesos = [{ f: hoy, kg: 77 }]; a.guarda();
  const reabierta = movil(a.nube, JSON.parse(a.mem.get('algramo.v1')), a.mem);          // la misma memoria, otra carga de la página
  assert.deepEqual([reabierta.N.dentro(), reabierta.N.usuario().nombre, plano(reabierta.N.estado()).pendientes], [true, 'Abel', 1]);
  assert.equal(await reabierta.N.sinc(), true);
  assert.equal((await a.nube.sql(`select kg::float as kg from ag.pesos`)).rows[0].kg, 77);
});
