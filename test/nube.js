// La nube de pruebas: un Postgres dentro de Node (PGlite) con el esquema de verdad, nube/esquema.sql.
// Las funciones se llaman como las llama la app a través de Supabase: con el papel «anon» y los parámetros por nombre.
// Así se prueba el mismo SQL que va a la base de datos real, sin tocarla.
const fs = require('fs'), path = require('path');
const { PGlite } = require('@electric-sql/pglite');
const ESQUEMA = path.resolve(__dirname, '../nube/esquema.sql');

module.exports = async function nube() {
  const db = new PGlite();
  await db.exec('create role anon nologin; create role authenticated nologin; create role service_role nologin;');
  await db.exec(fs.readFileSync(ESQUEMA, 'utf8'));
  let cola = Promise.resolve();                       // una sola conexión: las llamadas van de una en una
  const enCola = (f) => { const r = cola.then(f, f); cola = r.catch(() => {}); return r; };
  /** Llama a una función pública como lo hace la app (papel «anon»). Devuelve lo que devuelve la función. */
  const rpc = (fn, args = {}) => enCola(async () => {
    if (!/^ag_[a-z_]+$/.test(fn)) throw new Error('función desconocida: ' + fn);
    const claves = Object.keys(args);
    const valores = claves.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
    await db.exec('set role anon');
    try { return (await db.query(`select public.${fn}(${claves.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, valores)).rows[0].r; }
    finally { await db.exec('reset role'); }
  });
  /** SQL como dueño de la base de datos (para preparar datos y mirar por dentro). */
  const sql = (q, p) => enCola(() => db.query(q, p));
  /** SQL con el papel «anon», como alguien que solo tiene la clave pública. */
  const anon = (q, p) => enCola(async () => { await db.exec('set role anon'); try { return await db.query(q, p); } finally { await db.exec('reset role'); } });
  /** Da de alta a alguien (como hace el administrador al invitar) y devuelve su código. */
  const alta = async (nombre, admin) => (await sql('select ag.alta($1, $2) as c', [nombre, !!admin])).rows[0].c;
  return { rpc, sql, anon, alta, cierra: () => db.close() };
};
