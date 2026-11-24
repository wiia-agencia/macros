// La base de datos de usuarios, función a función: entrar con código y PIN, sincronizar y administrar.
const test = require('node:test');
const assert = require('node:assert/strict');
const nube = require('./nube.js');

const comida = (nombre, kcal) => ({ nombre, hora: '14:00', items: [{ id: 'U11367', n: 'Patata', e: 'cocida', gramos: 300 }], t: { kcal, p: 30, h: 40, g: 10, f: 3 } });
const dia = (d, mod, comidas, meta) => ({ d, mod, comidas: comidas || [comida('Comida', 500)], meta: meta === undefined ? { kcal: 2140, p: 165, h: 235, g: 60 } : meta });
/** Una nube nueva con un usuario ya dentro: devuelve también su código y su sesión. */
async function conUsuario(nombre = 'Abel', admin = false) {
  const n = await nube(), codigo = await n.alta(nombre, admin);
  const r = await n.rpc('ag_crear_pin', { p_codigo: codigo, p_pin: '2580' });
  return Object.assign(n, { codigo, token: r.token, id: r.usuario.id });
}
const entra = async (n, nombre, admin) => { const c = await n.alta(nombre, admin); const r = await n.rpc('ag_crear_pin', { p_codigo: c, p_pin: '1379' }); return { codigo: c, token: r.token, id: r.usuario.id }; };
const sinc = (n, token, desde, cambios) => n.rpc('ag_sinc', { p_token: token, p_desde: desde, p_cambios: cambios || {} });
const AHORA = Date.now();

/* ── Entrar ────────────────────────────────────── */
test('el código de invitación: 12 letras y números sin los que se confunden; vale escrito de cualquier manera', async () => {
  const n = await nube(), c = await n.alta('Abel', false);
  assert.match(c, /^[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}$/);
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: c }), { vale: true, nombre: 'Abel', nuevo: true, espera: 0 });
  assert.equal((await n.rpc('ag_mirar', { p_codigo: '  ' + c.toUpperCase().replace(/-/g, ' ') + ' ' })).vale, true, 'en mayúsculas y con espacios');
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: 'aaaa-bbbb-cccc' }), { vale: false });
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: '' }), { vale: false });
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: null }), { vale: false });
  const otros = new Set(); for (let i = 0; i < 30; i++) otros.add(await n.alta('X' + i, false));
  assert.equal(otros.size, 30, 'cada código es distinto');
});

test('crear el PIN: cuatro números, una sola vez; deja el móvil dentro', async () => {
  const n = await nube(), c = await n.alta('Abel', false);
  for (const malo of ['123', '12345', 'abcd', '', null, '12 4']) assert.deepEqual(await n.rpc('ag_crear_pin', { p_codigo: c, p_pin: malo }), { ok: false, motivo: 'pin' }, String(malo));
  assert.deepEqual(await n.rpc('ag_crear_pin', { p_codigo: 'zzzz-zzzz-zzzz', p_pin: '2580' }), { ok: false, motivo: 'codigo' });
  const r = await n.rpc('ag_crear_pin', { p_codigo: c, p_pin: '2580' });
  assert.equal(r.ok, true); assert.match(r.token, /^[0-9a-f]{64}$/); assert.equal(r.usuario.nombre, 'Abel'); assert.equal(r.usuario.admin, false); assert.match(r.usuario.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(await n.rpc('ag_crear_pin', { p_codigo: c, p_pin: '0000' }), { ok: false, motivo: 'ya' }, 'el PIN no se pisa con el código');
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: c }), { vale: true, nombre: 'Abel', nuevo: false, espera: 0 });
  assert.equal((await sinc(n, r.token, 0)).sesion, true, 'la sesión vale');
});

test('entrar desde otro móvil: código y PIN; al quinto PIN mal se bloquea, y cada fallo de más lo alarga', async () => {
  const n = await conUsuario('Abel');
  const bien = await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '2580' });
  assert.equal(bien.ok, true); assert.notEqual(bien.token, n.token, 'cada móvil, su sesión'); assert.equal(bien.usuario.id, n.id);
  assert.deepEqual(await n.rpc('ag_entrar', { p_codigo: 'zzzz-zzzz-zzzz', p_pin: '2580' }), { ok: false, motivo: 'codigo' });
  for (const quedan of [4, 3, 2, 1]) assert.deepEqual(await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '0000' }), { ok: false, motivo: 'pin', quedan });
  let r = await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '0000' });
  assert.equal(r.motivo, 'bloqueado'); assert.ok(r.espera > 890 && r.espera <= 900, 'quince minutos: ' + r.espera);
  r = await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '2580' });
  assert.equal(r.motivo, 'bloqueado', 'bloqueado, ni el PIN bueno entra');
  assert.ok((await n.rpc('ag_mirar', { p_codigo: n.codigo })).espera > 880, 'la pantalla de entrada sabe cuánto falta');
  assert.equal((await sinc(n, n.token, 0)).sesion, true, 'el móvil que ya estaba dentro sigue dentro');
  await n.sql(`update ag.usuarios set bloqueado_hasta = now() - interval '1 second'`);      // pasan los quince minutos
  r = await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '0000' });
  assert.equal(r.motivo, 'bloqueado'); assert.ok(r.espera > 1790 && r.espera <= 1800, 'otro fallo: media hora: ' + r.espera);
  await n.sql(`update ag.usuarios set bloqueado_hasta = now() - interval '1 second', fallos = 40`);
  r = await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '0000' });
  assert.ok(r.espera > 86390 && r.espera <= 86400, 'como mucho, un día: ' + r.espera);
  await n.sql(`update ag.usuarios set bloqueado_hasta = now() - interval '1 second'`);
  assert.equal((await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '2580' })).ok, true, 'pasado el bloqueo, el PIN bueno entra');
  assert.deepEqual(await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '0000' }), { ok: false, motivo: 'pin', quedan: 4 }, 'y la cuenta de fallos vuelve a cero');
});

test('entrar sin haber creado el PIN no entra: toca crearlo', async () => {
  const n = await nube(), c = await n.alta('Abel', false);
  assert.deepEqual(await n.rpc('ag_entrar', { p_codigo: c, p_pin: '2580' }), { ok: false, motivo: 'nuevo' });
});

test('una invitación sin usar caduca a los 7 días; con el PIN creado, el código ya no caduca', async () => {
  const n = await nube(), c = await n.alta('Abel', false);
  const dias = (await n.sql(`select extract(epoch from caduca - now()) / 86400 as d from ag.usuarios`)).rows[0].d;
  assert.ok(dias > 6.99 && dias <= 7, 'caduca en 7 días: ' + dias);
  await n.sql(`update ag.usuarios set caduca = now() - interval '1 minute'`);
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: c }), { vale: false });
  assert.deepEqual(await n.rpc('ag_crear_pin', { p_codigo: c, p_pin: '2580' }), { ok: false, motivo: 'codigo' });
  const m = await conUsuario('Bea');
  assert.equal((await m.sql(`select caduca from ag.usuarios`)).rows[0].caduca, null);
  assert.equal((await m.rpc('ag_entrar', { p_codigo: m.codigo, p_pin: '2580' })).ok, true);
});

test('salir cierra esa sesión y solo esa', async () => {
  const n = await conUsuario('Abel'), otra = (await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '2580' })).token;
  assert.deepEqual(await n.rpc('ag_salir', { p_token: n.token }), { ok: true });
  assert.deepEqual(await sinc(n, n.token, 0), { sesion: false });
  assert.equal((await sinc(n, otra, 0)).sesion, true);
  assert.deepEqual(await sinc(n, 'no-es-una-sesion', 0), { sesion: false });
  assert.deepEqual(await sinc(n, null, 0), { sesion: false });
});

test('nada se guarda en claro: ni el código, ni el PIN, ni la sesión', async () => {
  const n = await conUsuario('Abel');
  const u = (await n.sql('select * from ag.usuarios')).rows[0], s = (await n.sql('select * from ag.sesiones')).rows[0];
  const todo = JSON.stringify([u, s]);
  assert.match(u.codigo_hash, /^[0-9a-f]{64}$/); assert.match(u.pin_hash, /^[0-9a-f]{64}$/); assert.match(s.token_hash, /^[0-9a-f]{64}$/);
  for (const secreto of [n.codigo, n.codigo.replace(/-/g, '').toUpperCase(), n.token, '2580']) assert.ok(!todo.includes(secreto), 'no aparece ' + secreto.slice(0, 6));
  const m = await conUsuario('Bea');                                    // mismo PIN, otra persona: otra huella
  assert.notEqual((await m.sql('select pin_hash from ag.usuarios')).rows[0].pin_hash, u.pin_hash);
});

test('con la clave pública no se llega a las tablas ni a las funciones de dentro', async () => {
  const n = await conUsuario('Abel');
  for (const q of ['select * from ag.usuarios', 'select * from ag.sesiones', 'select * from ag.dias', 'select * from ag.pesos', 'select * from ag.estado', `select ag.alta('Yo', true)`, `select nextval('ag.sec')`])
    await assert.rejects(n.anon(q), /permission denied/, q);
  await assert.rejects(n.como('authenticated', `select public.ag_mirar('x')`), /permission denied/, 'las funciones solo las llama la clave pública');
  await assert.rejects(n.rpc('ag_no_existe', {}), /does not exist/);
  await assert.rejects(n.rpc('pg_sleep', {}), /desconocida/, 'la nube de pruebas solo deja llamar a las funciones ag_');
});

/* ── Sincronizar ───────────────────────────────── */
test('sincronizar: lo que sube un móvil lo baja el otro, una sola vez', async () => {
  const n = await conUsuario('Abel'), otro = (await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '2580' })).token;
  const sube = await sinc(n, n.token, 0, { dias: [dia('2026-11-24', AHORA)], pesos: [{ d: '2026-11-24', kg: 76.9, mod: AHORA }], estado: { datos: { perfil: { peso: 76.9 }, favs: ['U11367'] }, mod: AHORA } });
  assert.equal(sube.sesion, true); assert.deepEqual(sube.usuario, { id: n.id, nombre: 'Abel', admin: false });
  assert.deepEqual([sube.dias, sube.pesos, sube.estado], [[], [], null], 'lo que acaba de subir no se lo devuelven');
  assert.deepEqual(sube.rechazadas, { dias: [], pesos: [], estado: false }); assert.ok(sube.cursor > 0);
  const baja = await sinc(n, otro, 0);
  assert.deepEqual(baja.dias, [dia('2026-11-24', AHORA)]);
  assert.deepEqual(baja.pesos, [{ d: '2026-11-24', kg: 76.9, mod: AHORA }]);
  assert.deepEqual(baja.estado, { datos: { perfil: { peso: 76.9 }, favs: ['U11367'] }, mod: AHORA });
  assert.equal(baja.cursor, sube.cursor);
  const nada = await sinc(n, otro, baja.cursor);
  assert.deepEqual([nada.dias, nada.pesos, nada.estado, nada.cursor], [[], [], null, baja.cursor], 'con el cursor al día no baja nada');
});

test('sincronizar: gana lo último, día a día; lo que llega más viejo se rechaza y se devuelve lo que hay', async () => {
  const n = await conUsuario('Abel'), otro = (await n.rpc('ag_entrar', { p_codigo: n.codigo, p_pin: '2580' })).token;
  const a = await sinc(n, n.token, 0, { dias: [dia('2026-11-24', AHORA, [comida('Comida', 500)])], pesos: [{ d: '2026-11-24', kg: 77, mod: AHORA }], estado: { datos: { v: 1 }, mod: AHORA } });
  const viejo = await sinc(n, otro, a.cursor, { dias: [dia('2026-11-24', AHORA - 5000, [comida('Cena', 300)])], pesos: [{ d: '2026-11-24', kg: 80, mod: AHORA - 1 }], estado: { datos: { v: 0 }, mod: AHORA } });
  assert.deepEqual(viejo.rechazadas, { dias: ['2026-11-24'], pesos: ['2026-11-24'], estado: true }, 'más viejo (o igual de viejo) no entra');
  assert.equal(viejo.dias[0].comidas[0].nombre, 'Comida'); assert.equal(viejo.pesos[0].kg, 77); assert.deepEqual(viejo.estado.datos, { v: 1 }, 'y recibe lo que hay, aunque su cursor ya lo hubiera pasado');
  const nuevo = await sinc(n, otro, viejo.cursor, { dias: [dia('2026-11-24', AHORA + 5000, [])], pesos: [{ d: '2026-11-24', kg: null, mod: AHORA + 5000 }] });
  assert.deepEqual(nuevo.rechazadas, { dias: [], pesos: [], estado: false });
  const ve = await sinc(n, n.token, a.cursor);
  assert.deepEqual(ve.dias, [dia('2026-11-24', AHORA + 5000, [])], 'un día vaciado baja vacío');
  assert.deepEqual(ve.pesos, [{ d: '2026-11-24', kg: null, mod: AHORA + 5000 }], 'un peso borrado baja borrado');
  assert.equal(ve.estado, null, 'el estado no cambió');
});

test('sincronizar: una hora del futuro se recorta, las fechas imposibles se saltan y hay un tope por llamada', async () => {
  const n = await conUsuario('Abel');
  const r = await sinc(n, n.token, 0, { dias: [dia('2026-11-24', AHORA + 9e9), dia('1999-01-01', AHORA), dia('2999-01-01', AHORA), { d: 'no-es-fecha', mod: AHORA, comidas: [] }], pesos: [{ d: '2026-11-24', kg: 7, mod: AHORA }, { d: '2026-11-23', kg: 78.44, mod: AHORA }] });
  const filas = (await n.sql('select dia::text as d, mod from ag.dias')).rows;
  assert.deepEqual(filas.map((f) => f.d), ['2026-11-24'], 'solo entra la fecha posible');
  assert.ok(Number(filas[0].mod) < Date.now() + 6 * 60000, 'la hora del futuro se queda en «ahora» (con cinco minutos de margen)');
  assert.deepEqual((await n.sql('select dia::text as d, kg::float as kg from ag.pesos')).rows, [{ d: '2026-11-23', kg: 78.4 }], 'un peso imposible no entra; el bueno, con un decimal');
  assert.equal(r.sesion, true);
  await assert.rejects(sinc(n, n.token, 0, { dias: Array.from({ length: 81 }, (_, i) => dia('2026-01-01', AHORA + i)) }), /demasiado/);
  await assert.rejects(sinc(n, n.token, 0, { dias: [dia('2026-11-20', AHORA, Array.from({ length: 400 }, () => comida('x'.repeat(100), 1)))] }), /demasiado/);
  await assert.rejects(sinc(n, n.token, 0, { estado: { datos: { x: 'y'.repeat(400000) }, mod: AHORA } }), /demasiado/);
});

test('cada uno ve solo lo suyo', async () => {
  const n = await conUsuario('Abel'), bea = await entra(n, 'Bea');
  await sinc(n, n.token, 0, { dias: [dia('2026-11-24', AHORA, [comida('Secreto de Abel', 500)])], pesos: [{ d: '2026-11-24', kg: 76.9, mod: AHORA }], estado: { datos: { de: 'Abel' }, mod: AHORA } });
  const b0 = await sinc(n, bea.token, 0);
  assert.deepEqual([b0.dias, b0.pesos, b0.estado, b0.cursor], [[], [], null, 0], 'Bea no baja nada de Abel');
  const b1 = await sinc(n, bea.token, 0, { dias: [dia('2026-11-24', AHORA + 1, [comida('De Bea', 300)])], estado: { datos: { de: 'Bea' }, mod: AHORA + 1 } });
  assert.deepEqual(b1.rechazadas, { dias: [], pesos: [], estado: false }, 'el mismo día de otra persona no choca');
  const a = await sinc(n, n.token, 0);
  assert.equal(a.dias.length, 1); assert.equal(a.dias[0].comidas[0].nombre, 'Secreto de Abel'); assert.deepEqual(a.estado.datos, { de: 'Abel' });
  assert.ok(!JSON.stringify(await sinc(n, bea.token, 0)).includes('Abel'), 'ni rastro de Abel en lo de Bea');
});

/* ── Administrar ───────────────────────────────── */
test('el administrador ve quién la usa y su actividad, nunca comidas ni pesos', async () => {
  const n = await conUsuario('Javi', true), abel = await entra(n, 'Abel'); await n.alta('Carla', false);
  const hoy = (await n.sql(`select (now() at time zone 'Europe/Madrid')::date::text as d`)).rows[0].d, f = (k) => (await_dia(hoy, k));
  function await_dia(base, menos) { const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - menos); return d.toISOString().slice(0, 10); }
  await sinc(n, abel.token, 0, { dias: [dia(f(0), AHORA, [comida('Lentejas de Abel', 600)]), dia(f(1), AHORA), dia(f(6), AHORA), dia(f(7), AHORA), dia(f(3), AHORA, [])], pesos: [{ d: f(0), kg: 91.7, mod: AHORA }] });
  const r = await n.rpc('ag_admin_usuarios', { p_token: n.token });
  assert.equal(r.ok, true); assert.deepEqual(r.usuarios.map((u) => u.nombre), ['Javi', 'Abel', 'Carla'], 'yo primero; los demás, por orden de llegada');
  const [javi, ab, carla] = r.usuarios;
  assert.deepEqual([javi.yo, javi.admin, javi.pendiente, javi.activo], [true, true, false, true]);
  assert.deepEqual([ab.yo, ab.admin, ab.pendiente, ab.activo, ab.dias7, ab.dias], [false, false, false, true, 3, 4], 'tres de los últimos 7 días (uno vacío no cuenta) y cuatro en total');
  assert.ok(ab.visto, 'cuándo entró por última vez');
  assert.deepEqual([carla.pendiente, carla.dias7, carla.visto], [true, 0, null]); assert.equal(carla.caduca_dias, 7);
  const texto = JSON.stringify(r);
  assert.ok(!/Lentejas|91\.7|comidas|kg|codigo|pin|token/i.test(texto), 'ni comidas, ni pesos, ni códigos: ' + texto.slice(0, 80));
  for (const fn of ['ag_admin_usuarios']) assert.deepEqual(await n.rpc(fn, { p_token: abel.token }), { ok: false }, 'quien no es administrador no ve la lista');
  assert.deepEqual(await n.rpc('ag_admin_usuarios', { p_token: 'nada' }), { ok: false });
});

test('el administrador invita: un nombre, y sale un código que vale 7 días', async () => {
  const n = await conUsuario('Javi', true), abel = await entra(n, 'Abel');
  const r = await n.rpc('ag_admin_invitar', { p_token: n.token, p_nombre: '  Dani  ' });
  assert.equal(r.ok, true); assert.match(r.codigo, /^[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}-[2-9a-hjkmnp-z]{4}$/);
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: r.codigo }), { vale: true, nombre: 'Dani', nuevo: true, espera: 0 });
  for (const malo of ['', '   ', null, 'x'.repeat(41)]) assert.deepEqual(await n.rpc('ag_admin_invitar', { p_token: n.token, p_nombre: malo }), { ok: false, motivo: 'nombre' }, String(malo));
  assert.deepEqual(await n.rpc('ag_admin_invitar', { p_token: abel.token, p_nombre: 'Colado' }), { ok: false }, 'solo invita el administrador');
  assert.equal((await n.sql('select count(*)::int as n from ag.usuarios')).rows[0].n, 3);
});

test('el administrador desactiva y vuelve a activar: fuera al momento, y los datos se quedan', async () => {
  const n = await conUsuario('Javi', true), abel = await entra(n, 'Abel');
  await sinc(n, abel.token, 0, { dias: [dia('2026-11-24', AHORA)] });
  assert.deepEqual(await n.rpc('ag_admin_activar', { p_token: n.token, p_usuario: abel.id, p_activo: false }), { ok: true });
  assert.deepEqual(await sinc(n, abel.token, 0), { sesion: false }, 'su móvil se queda fuera');
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: abel.codigo }), { vale: false });
  assert.deepEqual(await n.rpc('ag_entrar', { p_codigo: abel.codigo, p_pin: '1379' }), { ok: false, motivo: 'codigo' });
  assert.equal((await n.rpc('ag_admin_usuarios', { p_token: n.token })).usuarios[1].activo, false);
  assert.deepEqual(await n.rpc('ag_admin_activar', { p_token: n.token, p_usuario: abel.id, p_activo: true }), { ok: true });
  const vuelve = await n.rpc('ag_entrar', { p_codigo: abel.codigo, p_pin: '1379' });
  assert.equal(vuelve.ok, true, 'activado otra vez, entra con su código y su PIN');
  assert.equal((await sinc(n, vuelve.token, 0)).dias.length, 1, 'y sus datos siguen ahí');
  assert.deepEqual(await n.rpc('ag_admin_activar', { p_token: n.token, p_usuario: n.id, p_activo: false }), { ok: false, motivo: 'tu' }, 'no se puede desactivar a uno mismo');
  assert.deepEqual(await n.rpc('ag_admin_activar', { p_token: abel.token, p_usuario: n.id, p_activo: false }), { ok: false });
  assert.deepEqual(await n.rpc('ag_admin_activar', { p_token: n.token, p_usuario: '00000000-0000-4000-8000-000000000000', p_activo: false }), { ok: false, motivo: 'usuario' });
});

test('el administrador da un enlace nuevo: el código viejo deja de valer, hay que crear PIN otra vez y los datos se quedan', async () => {
  const n = await conUsuario('Javi', true), abel = await entra(n, 'Abel');
  await sinc(n, abel.token, 0, { dias: [dia('2026-11-24', AHORA)] });
  await n.sql(`update ag.usuarios set fallos = 9, bloqueado_hasta = now() + interval '1 day' where id = $1`, [abel.id]);
  const r = await n.rpc('ag_admin_enlace', { p_token: n.token, p_usuario: abel.id });
  assert.equal(r.ok, true); assert.notEqual(r.codigo, abel.codigo);
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: abel.codigo }), { vale: false }, 'el código viejo ya no vale');
  assert.deepEqual(await sinc(n, abel.token, 0), { sesion: false }, 'sus móviles se quedan fuera');
  assert.deepEqual(await n.rpc('ag_mirar', { p_codigo: r.codigo }), { vale: true, nombre: 'Abel', nuevo: true, espera: 0 }, 'el nuevo pide crear PIN y llega sin bloqueo');
  const de_nuevo = await n.rpc('ag_crear_pin', { p_codigo: r.codigo, p_pin: '4680' });
  assert.equal(de_nuevo.usuario.id, abel.id, 'sigue siendo la misma persona');
  assert.equal((await sinc(n, de_nuevo.token, 0)).dias.length, 1, 'con sus datos');
  assert.deepEqual(await n.rpc('ag_admin_enlace', { p_token: n.token, p_usuario: n.id }), { ok: false, motivo: 'tu' });
  assert.deepEqual(await n.rpc('ag_admin_enlace', { p_token: de_nuevo.token, p_usuario: n.id }), { ok: false });
});

test('una sesión sin usar seis meses deja de valer', async () => {
  const n = await conUsuario('Abel');
  await n.sql(`update ag.sesiones set vista = now() - interval '181 days'`);
  assert.deepEqual(await sinc(n, n.token, 0), { sesion: false });
});
