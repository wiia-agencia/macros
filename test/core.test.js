const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');

// valores por 100 g tomados de la biblioteca real (data/alimentos.json)
const pollo   = { k: 156, p: 31.0, h: 0,    g: 3.6, f: 0,   r: 150 };   // pechuga asada o plancha
const patata  = { k: 84,  p: 1.7,  h: 18.2, g: 0.1, f: 1.8, r: 250 };   // patata cocida
const judias  = { k: 35,  p: 1.9,  h: 4.7,  g: 0.3, f: 3.2, r: 150 };   // judías verdes cocidas
const arroz   = { k: 125, p: 2.7,  h: 27.8, g: 0.3, f: 0.4, r: 200 };   // arroz blanco cocido
const aceite  = { k: 900, p: 0,    h: 0,    g: 100, f: 0,   r: 10 };
const brocoli = { k: 35,  p: 2.4,  h: 3.9,  g: 0.4, f: 3.3, r: 150 };
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} esperado ${b} ±${tol}, salió ${a}`);

test('macros: escala los valores por 100 g a los gramos pedidos', () => {
  const m = Core.macros(pollo, 250);
  cerca(m.kcal, 390, 0.01); cerca(m.p, 77.5, 0.01); cerca(m.h, 0, 0.01); cerca(m.g, 9, 0.01);
});

test('macros: gramos vacíos, negativos o no numéricos cuentan como 0', () => {
  for (const g of [0, -5, NaN, undefined, null, '']) assert.deepEqual(Core.macros(pollo, g), { kcal: 0, p: 0, h: 0, g: 0, f: 0 });
});

test('totales: el plato de ejemplo (300 g patata, 250 g pollo, 100 g judías)', () => {
  const t = Core.totales([{ a: patata, gramos: 300 }, { a: pollo, gramos: 250 }, { a: judias, gramos: 100 }]);
  cerca(t.kcal, 677, 0.01); cerca(t.p, 84.5, 0.01); cerca(t.h, 59.3, 0.01); cerca(t.g, 9.6, 0.01); cerca(t.f, 8.6, 0.01);
});

test('reparto: qué parte de las kcal aporta cada macro (4/4/9) y suma 1', () => {
  const r = Core.reparto({ p: 84.5, h: 59.3, g: 9.6 });
  cerca(r.p, 0.511, 0.002); cerca(r.h, 0.359, 0.002); cerca(r.g, 0.131, 0.002); cerca(r.p + r.h + r.g, 1, 1e-9);
});

test('reparto: un plato vacío no divide entre cero', () => {
  assert.deepEqual(Core.reparto({ p: 0, h: 0, g: 0 }), { p: 0, h: 0, g: 0 });
});

test('resolver: con tres alimentos que lo permiten, clava los tres macros', () => {
  const r = Core.resolver({ objetivo: { p: 40, h: 60, g: 15 }, items: [{ a: pollo }, { a: arroz }, { a: aceite }] });
  cerca(r.gramos[0], 110, 6, 'pollo'); cerca(r.gramos[1], 216, 6, 'arroz'); cerca(r.gramos[2], 10, 2, 'aceite');
  cerca(r.logrado.p, 40, 1.5); cerca(r.logrado.h, 60, 1.5); cerca(r.logrado.g, 15, 1.5);
  assert.equal(r.cuadra, true);
});

test('resolver: si los alimentos no dan para un macro, lo dice y no dispara los demás', () => {
  const r = Core.resolver({ objetivo: { p: 50, h: 60, g: 15 }, items: [{ a: pollo }, { a: arroz }, { a: judias }] });
  cerca(r.logrado.p, 50, 2.5); cerca(r.logrado.h, 60, 2.5);
  assert.ok(r.desvio.g < -5, `debería faltar grasa, desvío ${r.desvio.g}`);
  assert.equal(r.cuadra, false);
  assert.ok(r.gramos[0] <= 200, 'no infla el pollo para arañar grasa');
});

test('resolver: respeta la cantidad fijada de un alimento y ajusta el resto', () => {
  const r = Core.resolver({ objetivo: { p: 70, h: 80, g: 12 }, items: [{ a: pollo, fijo: 200 }, { a: arroz }, { a: aceite }] });
  assert.equal(r.gramos[0], 200);
  cerca(r.logrado.h, 80, 2); cerca(r.logrado.g, 12, 1.5);
});

test('resolver: la verdura se queda cerca de su ración habitual', () => {
  const r = Core.resolver({ objetivo: { p: 45, h: 55, g: 8 }, items: [{ a: pollo }, { a: arroz }, { a: brocoli }] });
  assert.ok(r.gramos[2] >= 80 && r.gramos[2] <= 250, `brócoli ${r.gramos[2]} g`);
  cerca(r.logrado.p, 45, 2.5); cerca(r.logrado.h, 55, 2.5);
});

test('resolver: con objetivo 0 de hidratos deja el arroz prácticamente a cero', () => {
  const r = Core.resolver({ objetivo: { p: 30, h: 0, g: 10 }, items: [{ a: pollo }, { a: arroz }, { a: aceite }] });
  assert.ok(r.gramos[1] <= 5, `arroz ${r.gramos[1]} g`);
  cerca(r.logrado.p, 30, 1.5);
});

test('resolver: no deja cantidades ridículas (o nada, o al menos una décima parte de la ración)', () => {
  const r = Core.resolver({ objetivo: { p: 30, h: 0, g: 10 }, items: [{ a: pollo }, { a: arroz }, { a: aceite }] });
  assert.equal(r.gramos[1], 0, 'arroz');
  cerca(r.logrado.p, 30, 1.5); cerca(r.logrado.g, 10, 1.5);
});

test('resolver: si falta grasa no la busca a base de kilos de verdura', () => {
  const r = Core.resolver({ objetivo: { p: 50, h: 60, g: 15 }, items: [{ a: pollo }, { a: arroz }, { a: judias }] });
  assert.ok(r.gramos[2] >= 100 && r.gramos[2] <= 220, `judías ${r.gramos[2]} g`);
});

test('resolver: un solo alimento', () => {
  const r = Core.resolver({ objetivo: { p: 31, h: 0, g: 3.6 }, items: [{ a: pollo }] });
  cerca(r.gramos[0], 100, 5);
});

test('resolver: nunca devuelve cantidades negativas ni por encima del tope, y avisa del tope', () => {
  const r = Core.resolver({ objetivo: { p: 300, h: 300, g: 300 }, items: [{ a: judias }] });
  assert.ok(r.gramos[0] >= 0 && r.gramos[0] <= 5 * judias.r);
  assert.equal(r.tope[0], true);
  assert.equal(r.cuadra, false);
});

test('resolver: nunca pone más de lo pedido de un macro para arañar otro (un huevo solo no se va a 265 g)', () => {
  const huevo = { k: 150, p: 12.6, h: 1.1, g: 10.6, f: 0, r: 60 };
  const r = Core.resolver({ objetivo: { p: 41, h: 59, g: 15 }, items: [{ a: huevo }] });
  cerca(r.gramos[0], 140, 10, 'lo que da la grasa pedida'); assert.ok(r.logrado.g <= 16, `grasa ${r.logrado.g}`);
  assert.ok(r.desvio.p < -15 && r.desvio.h < -50, 'faltan proteína e hidratos, y lo dice');
  const pan = { k: 338, p: 9.6, h: 69.4, g: 1.2, f: 4.2, r: 30 };
  const r2 = Core.resolver({ objetivo: { p: 41, h: 59, g: 15 }, items: [{ a: pan }] });
  cerca(r2.gramos[0], 85, 5, 'el pan llega hasta los hidratos pedidos'); assert.ok(r2.logrado.h <= 61);
});

test('resolver: con pollo, 5 g de grasa mandan: no pasa de ahí aunque falte proteína', () => {
  const r = Core.resolver({ objetivo: { p: 90, h: 60, g: 5 }, items: [{ a: pollo }, { a: arroz }] });
  assert.ok(r.logrado.g <= 6, `grasa ${r.logrado.g}`); assert.ok(r.desvio.p < -30, `proteína ${r.logrado.p}`);
  cerca(r.logrado.h, 60, 3);
});

test('resolver: si lo fijado ya se pasa de un macro, eso no deja a cero lo demás (candado en 250 g de pollo)', () => {
  const r = Core.resolver({ objetivo: { p: 50, h: 60, g: 6 }, items: [{ a: patata }, { a: pollo, fijo: 250 }, { a: judias, fijo: 100 }] });
  assert.ok(r.gramos[0] >= 295 && r.gramos[0] <= 310, `patata ${r.gramos[0]}`); cerca(r.logrado.h, 60, 2, 'los hidratos no se quedan cortos por culpa de la proteína, que ya está perdida');
  assert.ok(r.desvio.p > 25, 'la proteína se pasa por el candado, y se dice');
});

test('resolver: un macro que lo fijado ya clava deja de ser un tope para lo demás (130 g de pollo y arroz)', () => {
  const r = Core.resolver({ objetivo: { p: 41, h: 59, g: 15 }, items: [{ a: pollo, fijo: 130 }, { a: arroz }] });
  assert.ok(r.gramos[1] >= 190, `arroz ${r.gramos[1]}: no se queda en 25 g por 1 g de proteína`); cerca(r.logrado.h, 59, 3);
});

test('resolver: un alimento puro del macro que lo fijado ya pasa se queda a cero', () => {
  const atun = { k: 108, p: 23.6, h: 0, g: 1.4, f: 0, r: 60 };
  const r = Core.resolver({ objetivo: { p: 50, h: 60, g: 6 }, items: [{ a: pollo, fijo: 250 }, { a: arroz }, { a: atun }] });
  assert.equal(r.gramos[2], 0); assert.ok(r.gramos[1] >= 180, `arroz ${r.gramos[1]}`);
});

test('resolver: redondea a 5 g (a 1 g las cantidades pequeñas)', () => {
  const r = Core.resolver({ objetivo: { p: 40, h: 60, g: 15 }, items: [{ a: pollo }, { a: arroz }, { a: aceite }] });
  for (const g of r.gramos) assert.ok(g < 20 ? Number.isInteger(g) : g % 5 === 0, `gramos ${g}`);
});

test('resolver: sin alimentos libres devuelve lo fijado sin romperse', () => {
  const vacio = Core.resolver({ objetivo: { p: 40, h: 60, g: 15 }, items: [] });
  assert.deepEqual(vacio.gramos, []); assert.equal(vacio.cuadra, false);
  const fijos = Core.resolver({ objetivo: { p: 31, h: 0, g: 3.6 }, items: [{ a: pollo, fijo: 100 }] });
  assert.deepEqual(fijos.gramos, [100]); assert.equal(fijos.cuadra, true);
});

test('sugerir: si falta grasa propone aceite de oliva con la cantidad justa', () => {
  const cat = [
    { id: 1, n: 'Aceite de oliva', e: '', p: 0, h: 0, g: 100 },
    { id: 2, n: 'Aguacate', e: '', p: 2, h: 1.8, g: 14.7 },
    { id: 3, n: 'Arroz blanco', e: 'cocido', p: 2.7, h: 27.8, g: 0.3 },
    { id: 4, n: 'Clara de huevo', e: 'cruda', p: 10.9, h: 0.7, g: 0.2 },
  ];
  const s = Core.sugerir({ p: 0.4, h: -1, g: -9 }, cat, []);
  assert.equal(s[0].id, 1); assert.equal(s[0].macro, 'g'); cerca(s[0].gramos, 9, 1);
  assert.ok(s.every(x => x.macro === 'g'), 'solo sugiere para el macro que falta de verdad');
  const sinAceite = Core.sugerir({ p: 0, h: 0, g: -9 }, cat, [1]);
  assert.equal(sinAceite[0].id, 2, 'no repite lo que ya está en el plato');
  assert.deepEqual(Core.sugerir({ p: 1, h: -1.5, g: 0.5 }, cat, []), [], 'desvíos pequeños no piden nada');
});

test('masAporta: qué alimento del plato aporta más de un macro', () => {
  assert.equal(Core.masAporta('g', [{ a: pollo, gramos: 200 }, { a: aceite, gramos: 15 }, { a: arroz, gramos: 200 }]), 1);
  assert.equal(Core.masAporta('p', [{ a: pollo, gramos: 200 }, { a: aceite, gramos: 15 }]), 0);
  assert.equal(Core.masAporta('h', []), -1);
});

test('objetivos: gasto en reposo con Mifflin-St Jeor', () => {
  assert.equal(Core.objetivos({ sexo: 'h', edad: 30, peso: 75, altura: 180, actividad: 1.55 }).reposo, 1730);
  assert.equal(Core.objetivos({ sexo: 'm', edad: 30, peso: 75, altura: 180, actividad: 1.55 }).reposo, 1564);
});

test('objetivos: definir −20 %, mantener y ganar +10 % sobre el gasto diario', () => {
  const o = Core.objetivos({ sexo: 'h', edad: 30, peso: 75, altura: 180, actividad: 1.55 });
  cerca(o.gasto, 2682, 1);
  cerca(o.mantener.kcal, 2682, 25); cerca(o.definir.kcal, 2145, 25); cerca(o.ganar.kcal, 2950, 25);
});

test('objetivos: proteína 2,2 / 1,8 / 2,0 g por kilo y los macros suman las kcal', () => {
  const o = Core.objetivos({ sexo: 'h', edad: 30, peso: 75, altura: 180, actividad: 1.55 });
  assert.equal(o.definir.p, 165); assert.equal(o.mantener.p, 135); assert.equal(o.ganar.p, 150);
  for (const k of ['definir', 'mantener', 'ganar']) {
    const x = o[k];
    assert.equal(x.kcal, 4 * x.p + 4 * x.h + 9 * x.g, k);
    const pctGrasa = 9 * x.g / x.kcal;
    assert.ok(pctGrasa >= 0.195 && pctGrasa <= 0.355, `${k}: grasa ${Math.round(pctGrasa * 100)} %`);
    assert.ok(x.h > 0);
  }
});

test('objetivos: ritmo semanal estimado (7.700 kcal por kilo)', () => {
  const o = Core.objetivos({ sexo: 'h', edad: 30, peso: 75, altura: 180, actividad: 1.55 });
  cerca(o.definir.ritmo, -0.49, 0.04); assert.equal(o.mantener.ritmo, 0); cerca(o.ganar.ritmo, 0.24, 0.04);
});

test('objetivos: definir no baja de 1.200 kcal (mujer) ni de 1.500 (hombre) y lo avisa', () => {
  const m = Core.objetivos({ sexo: 'm', edad: 30, peso: 55, altura: 160, actividad: 1.2 });   // gasto 1.487; el 80 % serían 1.190
  cerca(m.definir.kcal, 1200, 20); assert.ok(m.avisos.includes('suelo'));
  const h = Core.objetivos({ sexo: 'h', edad: 30, peso: 75, altura: 180, actividad: 1.55 });
  assert.ok(!h.avisos.includes('suelo'));
});

test('objetivos: si mantener ya queda por debajo del mínimo, definir no supera a mantener', () => {
  const m = Core.objetivos({ sexo: 'm', edad: 60, peso: 48, altura: 150, actividad: 1.2 });   // gasto 1.148
  assert.ok(m.definir.kcal <= m.mantener.kcal + 20, `definir ${m.definir.kcal} · mantener ${m.mantener.kcal}`);
  assert.ok(m.avisos.includes('suelo'));
});

test('objetivos: con IMC de 30 o más, la proteína se calcula sobre un peso de referencia', () => {
  const o = Core.objetivos({ sexo: 'h', edad: 40, peso: 120, altura: 175, actividad: 1.375 });
  assert.ok(o.avisos.includes('peso_ref'));
  assert.ok(o.definir.p < 2.2 * 120 - 40, `proteína ${o.definir.p}`);
  cerca(o.definir.p, 2.2 * 25 * 1.75 * 1.75, 5);
});

test('objetivos: menores de 18 y datos imposibles devuelven error, no números', () => {
  assert.equal(Core.objetivos({ sexo: 'h', edad: 16, peso: 60, altura: 170, actividad: 1.55 }).error, 'menor');
  assert.equal(Core.objetivos({ sexo: 'h', edad: 30, peso: 0, altura: 170, actividad: 1.55 }).error, 'datos');
  assert.equal(Core.objetivos({ sexo: 'h', edad: 30, peso: 75, altura: 17, actividad: 1.55 }).error, 'datos');
  assert.equal(Core.objetivos({}).error, 'datos');
});

test('porComida: reparte el objetivo del día entre las comidas', () => {
  assert.deepEqual(Core.porComida({ kcal: 2140, p: 165, h: 240, g: 58 }, 4), { p: 41, h: 60, g: 15, kcal: 4 * 41 + 4 * 60 + 9 * 15 });
});

const CAT = [
  { id: 0, n: 'Plátano', e: '', s: 'banana', c: 6, k: 89, p: 1.1, h: 20.2, g: 0.3 },
  { id: 1, n: 'Patata', e: 'cocida', s: 'papa,hervida', c: 5, k: 84, p: 1.7, h: 18.2, g: 0.1 },
  { id: 2, n: 'Pechuga de pollo', e: 'asada o plancha', s: 'filete de pollo', c: 0, k: 156, p: 31, h: 0, g: 3.6 },
  { id: 3, n: 'Pollo asado con piel', e: 'asado', s: 'pollo entero', c: 0, k: 232, p: 27.3, h: 0, g: 13.6 },
  { id: 4, n: 'Carne picada de pollo', e: 'cruda', s: '', c: 0, k: 143, p: 17.4, h: 0, g: 8.1 },
  { id: 5, n: 'Judías verdes', e: 'cocidas', s: 'habichuelas,ejotes,vainas', c: 5, k: 35, p: 1.9, h: 4.7, g: 0.3 },
];
const ids = (xs) => xs.map(x => x.id);

test('buscar: ignora tildes y mayúsculas', () => {
  assert.deepEqual(ids(Core.buscar(CAT, 'platano')), [0]);
  assert.deepEqual(ids(Core.buscar(CAT, 'JUDIAS')), [5]);
});

test('buscar: encuentra por sinónimos', () => {
  assert.deepEqual(ids(Core.buscar(CAT, 'banana')), [0]);
  assert.deepEqual(ids(Core.buscar(CAT, 'papa')), [1]);
});

test('buscar: varias palabras en cualquier orden, también el estado', () => {
  assert.deepEqual(ids(Core.buscar(CAT, 'pollo plancha')), [2]);
  assert.deepEqual(ids(Core.buscar(CAT, 'cocida patata')), [1]);
});

test('buscar: primero los que empiezan por lo escrito', () => {
  assert.deepEqual(ids(Core.buscar(CAT, 'pollo')), [3, 2, 4]);
});

test('buscar: sin texto devuelve todo por orden alfabético y filtra por categoría', () => {
  assert.deepEqual(ids(Core.buscar(CAT, '')), [4, 5, 1, 2, 0, 3]);
  assert.deepEqual(ids(Core.buscar(CAT, '', { cat: 5 })), [5, 1]);
});

test('buscar: ordenar por más proteína o por menos calorías', () => {
  assert.deepEqual(ids(Core.buscar(CAT, 'pollo', { orden: 'prot' })), [2, 3, 4]);
  assert.deepEqual(ids(Core.buscar(CAT, '', { orden: 'kcal' })).slice(0, 2), [5, 1]);
});

test('fmt: números a la española', () => {
  assert.equal(Core.fmt(77.5, 1), '77,5'); assert.equal(Core.fmt(390), '390'); assert.equal(Core.fmt(9.04, 1), '9');
  assert.equal(Core.fmt(2682), '2.682'); assert.equal(Core.fmt(-0.49, 1), '−0,5');
});

test('acompañamiento: verdura, leche o yogur (ningún macro llega a 8 g por 100 g)', () => {
  assert.equal(Core.esAcompanamiento(judias), true);
  assert.equal(Core.esAcompanamiento(brocoli), true);
  assert.equal(Core.esAcompanamiento(patata), false);
  assert.equal(Core.esAcompanamiento(pollo), false);
  assert.equal(Core.esAcompanamiento(aceite), false);
});

test('fijados: por defecto los acompañamientos se quedan en su cantidad y el resto se ajusta', () => {
  const items = [{ a: patata, gramos: 300 }, { a: pollo, gramos: 250 }, { a: judias, gramos: 100 }];
  assert.deepEqual(Core.fijados(items), [null, null, 100]);
});

test('fijados: el candado manda (fijo o libre) sobre el valor por defecto', () => {
  const items = [{ a: patata, gramos: 300, modo: 'fijo' }, { a: pollo, gramos: 250 }, { a: judias, gramos: 100, modo: 'libre' }];
  assert.deepEqual(Core.fijados(items), [300, null, null]);
});

test('fijados: un acompañamiento se queda en su cantidad aunque esté solo (nadie cuadra un desayuno con un litro de café con leche)', () => {
  assert.deepEqual(Core.fijados([{ a: judias, gramos: 100 }, { a: brocoli, gramos: 150 }]), [100, 150]);
  assert.deepEqual(Core.fijados([{ a: judias, gramos: 100, modo: 'libre' }]), [null], 'salvo que le quites el candado');
});

test('buscar: a igual acierto, antes los alimentos básicos que las salsas o los platos preparados', () => {
  const lista = [
    { id: 0, n: 'Caldo de pollo', e: '', s: '', c: 11, k: 35, p: 2.5, h: 3.5, g: 1.2 },
    { id: 1, n: 'Nuggets de pollo', e: '', s: '', c: 12, k: 248, p: 13, h: 18, g: 13 },
    { id: 2, n: 'Pechuga de pollo', e: 'cruda', s: '', c: 0, k: 114, p: 22.5, h: 0, g: 2.6 },
    { id: 3, n: 'Carne picada de pollo', e: 'cruda', s: '', c: 0, k: 143, p: 17.4, h: 0, g: 8.1 },
  ];
  assert.deepEqual(ids(Core.buscar(lista, 'pollo')), [2, 3, 0, 1]);
});

test('buscar: ordenar por hidratos, grasa, fibra, más calorías y proteína por caloría', () => {
  const L = [
    { id: 0, n: 'Arroz', e: 'crudo', s: '', c: 3, k: 352, p: 7.1, h: 78.7, g: 0.7, f: 1.3 },
    { id: 1, n: 'Aceite', e: '', s: '', c: 8, k: 900, p: 0, h: 0, g: 100, f: 0 },
    { id: 2, n: 'Clara de huevo', e: '', s: '', c: 2, k: 46, p: 10.9, h: 0.7, g: 0.2, f: 0 },
    { id: 3, n: 'Lentejas', e: 'cocidas', s: '', c: 4, k: 104, p: 9, h: 12.2, g: 0.4, f: 7.9 },
  ];
  assert.deepEqual(ids(Core.buscar(L, '', { orden: 'hid' })), [0, 3, 2, 1]);
  assert.deepEqual(ids(Core.buscar(L, '', { orden: 'gra' })), [1, 0, 3, 2]);
  assert.deepEqual(ids(Core.buscar(L, '', { orden: 'fib' })), [3, 0, 1, 2]);
  assert.deepEqual(ids(Core.buscar(L, '', { orden: 'mkcal' })), [1, 0, 3, 2]);
  assert.deepEqual(ids(Core.buscar(L, '', { orden: 'pk' })), [2, 3, 0, 1]);
});

test('proteinaPorCaloria: gramos de proteína por cada 100 kcal (0 si no tiene calorías)', () => {
  cerca(Core.proteinaPorCaloria({ p: 31, k: 156 }), 19.87, 0.01);
  assert.equal(Core.proteinaPorCaloria({ p: 0.1, k: 0 }), 0);
});

// ── El veredicto de «pongo los macros»: compara lo que se pide con lo que sale del plato ──
function cuadrar(objetivo, lista) {
  const fij = Core.fijados(lista);
  const sol = Core.resolver({ objetivo, items: lista.map((x, i) => ({ a: x.a, fijo: fij[i] })) });
  const items = lista.map((x, i) => ({ a: x.a, gramos: sol.gramos[i], fijo: x.modo === 'fijo', quieto: fij[i] != null && x.modo !== 'fijo' }));
  return { sol, items, v: Core.veredicto(objetivo, items, sol) };
}
const ejemplo = () => [{ a: patata, gramos: 300 }, { a: pollo, gramos: 250 }, { a: judias, gramos: 100 }];

test('veredicto: 90/250/5 con patata, pollo y judías no sale, y dice qué falta y por qué', () => {
  const { v } = cuadrar({ p: 90, h: 250, g: 5 }, ejemplo());
  assert.equal(v.estado, 'no', 'con 1.250 g de patata no puede ser «casi clavado»');
  assert.deepEqual(v.lineas.map((l) => [l.m, l.tipo]), [['p', 'falta'], ['h', 'falta']], 'de grasa no se pasa');
  const [pr, h] = v.lineas;
  assert.equal(pr.pide, 90); assert.ok(pr.sale < 60, `proteína ${pr.sale}`);
  assert.equal(pr.causa.tipo, 'limita'); assert.equal(pr.causa.j, 1); assert.equal(pr.causa.m2, 'g');     // con más pollo te pasarías de grasa
  cerca(pr.causa.hasta, 10, 1, 'la grasa que haría falta para llegar con pollo');
  assert.equal(h.pide, 250); cerca(h.sale, 232, 1.5); assert.deepEqual(h.causa, { tipo: 'tope', j: 0, gramos: 1250 });   // ya van 1.250 g de patata
  assert.deepEqual(v.enormes, [0]);
});

test('veredicto: si el alimento que falta por subir te pasaría de otro macro, lo dice y da hasta dónde subirlo', () => {
  const { v } = cuadrar({ p: 90, h: 250, g: 5 }, ejemplo().concat([{ a: arroz, gramos: 200 }]));
  assert.equal(v.estado, 'falta'); assert.deepEqual(v.lineas.map((l) => [l.m, l.tipo, l.causa.tipo, l.causa.m2]), [['p', 'falta', 'limita', 'g']]);
  cerca(v.lineas[0].causa.hasta, 10, 1);
});

test('veredicto: un alimento que apenas lleva lo que falta no se da como causa (pan y proteína)', () => {
  const pan = { k: 338, p: 9.6, h: 69.4, g: 1.2, f: 4.2, r: 30 };
  const { v } = cuadrar({ p: 41, h: 59, g: 15 }, [{ a: pan, gramos: 30 }]);
  assert.equal(v.estado, 'falta'); assert.deepEqual(v.lineas.map((l) => [l.m, l.causa]), [['p', null], ['g', null]]);
});

test('veredicto: si solo falta (nada sobra, nada al tope, sin candados), no es un fallo: es que aún hay que añadir', () => {
  const { v } = cuadrar({ p: 90, h: 250, g: 20 }, ejemplo().concat([{ a: arroz, gramos: 200 }]));
  assert.equal(v.estado, 'falta'); assert.deepEqual(v.lineas.map((l) => [l.m, l.tipo, l.causa]), [['g', 'falta', null]]);
});

test('veredicto: el primer alimento de una comida no se dispara ni da un aviso: pide añadir más', () => {
  const cafe = { k: 22, p: 1.4, h: 2.3, g: 0.8, f: 0, r: 200 };              // café con leche: un acompañamiento
  const { v, sol } = cuadrar({ p: 41, h: 59, g: 15 }, [{ a: cafe, gramos: 200 }]);
  assert.deepEqual(sol.gramos, [200], 'se queda en su taza');
  assert.equal(v.estado, 'falta'); assert.equal(v.todoFijo, false, 'que venga fijado de serie no es «tener el candado puesto»');
  assert.deepEqual(v.lineas.map((l) => [l.m, l.tipo, l.causa]), [['p', 'falta', null], ['h', 'falta', null], ['g', 'falta', { tipo: 'sin' }]]);
  const pan = { k: 338, p: 9.6, h: 69.4, g: 1.2, f: 4.2, r: 30 };
  const dos = cuadrar({ p: 41, h: 59, g: 15 }, [{ a: cafe, gramos: 200 }, { a: pan, gramos: 30 }]);
  assert.deepEqual(dos.sol.gramos.map((g, i) => (i ? g > 60 && g < 85 : g)), [200, true], 'el pan cubre los hidratos sin pasarse; el café sigue en su taza');
  assert.equal(dos.v.estado, 'falta'); assert.deepEqual(dos.v.lineas.map((l) => l.m), ['p', 'g']);
});

test('veredicto: lo que se pasa por un candado no se da como freno de otro alimento', () => {
  const { v, sol } = cuadrar({ p: 41, h: 59, g: 15 }, [{ a: pollo, gramos: 130, modo: 'fijo' }, { a: arroz, gramos: 200 }]);
  assert.ok(sol.gramos[1] >= 190);
  assert.deepEqual(v.lineas.map((l) => [l.m, l.tipo, l.causa && l.causa.tipo]), [['p', 'sobra', 'fijo'], ['g', 'falta', 'fijo']], 'ni la proteína ni la grasa culpan al arroz');
});

test('veredicto: clavado cuando todo queda a 2 g (o al 5 %) de lo pedido', () => {
  const { v } = cuadrar({ p: 90, h: 250, g: 20 }, ejemplo().concat([{ a: arroz, gramos: 200 }, { a: aceite, gramos: 10 }]));
  assert.equal(v.estado, 'clavado'); assert.deepEqual(v.lineas, []); assert.deepEqual(v.enormes, []);
});

test('veredicto: casi clavado si lo que falla se queda a 3 g (o al 10 %)', () => {
  const { v } = cuadrar({ p: 50, h: 60, g: 8 }, ejemplo());
  assert.equal(v.estado, 'casi'); assert.deepEqual(v.lineas.map((l) => [l.m, l.tipo]), [['g', 'falta']]);
});

test('veredicto: si en el plato no hay nada con ese macro, lo dice', () => {
  const { v } = cuadrar({ p: 5, h: 60, g: 20 }, [{ a: arroz, gramos: 200 }]);
  assert.deepEqual(v.lineas.find((l) => l.m === 'g').causa, { tipo: 'sin' });
});

test('veredicto: si sobra por un alimento con candado, señala el candado', () => {
  const { v } = cuadrar({ p: 50, h: 60, g: 8 }, [{ a: patata, gramos: 300 }, { a: pollo, gramos: 250, modo: 'fijo' }, { a: judias, gramos: 100 }]);
  const p = v.lineas.find((l) => l.m === 'p');
  assert.equal(p.tipo, 'sobra'); assert.equal(p.causa.tipo, 'fijo'); assert.equal(p.causa.j, 1); assert.equal(p.causa.gramos, 250); cerca(p.causa.aporta, 77.5, 0.1);
});

test('veredicto: plato vacío y plato con todo fijado', () => {
  const obj = { p: 40, h: 40, g: 10 };
  assert.equal(Core.veredicto(obj, [], Core.resolver({ objetivo: obj, items: [] })).estado, 'vacio');
  const { v } = cuadrar(obj, [{ a: pollo, gramos: 100, modo: 'fijo' }, { a: arroz, gramos: 100, modo: 'fijo' }]);
  assert.equal(v.todoFijo, true);
});

// ── Hoy: las comidas apuntadas en el día ──
test('claveDia: la fecha local como AAAA-MM-DD', () => {
  assert.equal(Core.claveDia(new Date(2026, 10, 24, 23, 59)), '2026-11-24');
  assert.equal(Core.claveDia(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

test('comidaPorHora: propone el nombre de la comida según la hora', () => {
  const casos = [[8, 'Desayuno'], [11.5, 'Media mañana'], [14.5, 'Comida'], [18, 'Merienda'], [21.5, 'Cena'], [2, 'Cena'], [5, 'Desayuno']];
  for (const [h, n] of casos) assert.equal(Core.comidaPorHora(h), n, `a las ${h}`);
  assert.deepEqual(Core.COMIDAS, ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena']);
});

test('sumaDia: suma lo apuntado en el día (y un día vacío da ceros)', () => {
  const t = Core.sumaDia([{ t: { kcal: 444, p: 17, h: 71, g: 8, f: 9 } }, { t: { kcal: 740, p: 66, h: 77, g: 18, f: 7 } }]);
  assert.deepEqual(t, { kcal: 1184, p: 83, h: 148, g: 26, f: 16 });
  assert.deepEqual(Core.sumaDia([]), { kcal: 0, p: 0, h: 0, g: 0, f: 0 });
  assert.deepEqual(Core.sumaDia(undefined), { kcal: 0, p: 0, h: 0, g: 0, f: 0 });
});

test('estadoDia: un día clavado no es «pasarse» (las kcal de la fibra no cuentan en el objetivo de macros)', () => {
  const meta = { kcal: 2140, p: 165, h: 235, g: 60 };
  assert.deepEqual(Core.estadoDia(meta, { kcal: 2194, p: 165, h: 235, g: 59 }), { sobra: [], hecho: true });       // 54 kcal de más: dentro del 5 %
  assert.deepEqual(Core.estadoDia(meta, { kcal: 2140, p: 160, h: 228, g: 58 }), { sobra: [], hecho: true });       // lo que falta ya es el margen
});

test('estadoDia: avisa de lo que se pasa de verdad (más de 2 g o del 5 %) y sabe si aún queda por comer', () => {
  const meta = { kcal: 2140, p: 165, h: 235, g: 60 };
  assert.deepEqual(Core.estadoDia(meta, { kcal: 1184, p: 83, h: 148, g: 70 }), { sobra: ['g'], hecho: false });
  assert.deepEqual(Core.estadoDia(meta, { kcal: 2400, p: 165, h: 235, g: 62 }), { sobra: ['kcal'], hecho: true });
  assert.deepEqual(Core.estadoDia(meta, { kcal: 1900, p: 150, h: 235, g: 60 }), { sobra: [], hecho: false });      // faltan 15 g de proteína
  assert.deepEqual(Core.estadoDia(meta, { kcal: 0, p: 0, h: 0, g: 0 }), { sobra: [], hecho: false });
});

test('queda: lo que falta para el objetivo del día, nunca negativo, y aparte lo que te pasas', () => {
  const q = Core.queda({ kcal: 2140, p: 165, h: 235, g: 60 }, { kcal: 1184, p: 83, h: 148, g: 70 });
  assert.deepEqual(q.queda, { kcal: 956, p: 82, h: 87, g: 0 });
  assert.deepEqual(q.pasa, { kcal: 0, p: 0, h: 0, g: 10 });
});

test('cuota: el tamaño lo elige quien come: suave es media ración, fuerte ración y media, todo es lo que queda', () => {
  const queda = { p: 165, h: 235, g: 60 };
  assert.deepEqual(Core.cuota(queda, 4, 'normal'), { p: 41, h: 59, g: 15, kcal: 535 });
  assert.deepEqual(Core.cuota(queda, 4, 'suave'), { p: 21, h: 29, g: 8, kcal: 272 });
  assert.deepEqual(Core.cuota(queda, 4, 'fuerte'), { p: 62, h: 88, g: 23, kcal: 807 });
  assert.deepEqual(Core.cuota(queda, 4, 'todo'), { p: 165, h: 235, g: 60, kcal: 2140 });
});

test('cuota: una comida fuerte nunca pide más de lo que queda', () => {
  assert.deepEqual(Core.cuota({ p: 80, h: 100, g: 20 }, 1, 'fuerte'), { p: 80, h: 100, g: 20, kcal: 900 }, 'con una sola comida por delante, fuerte = todo');
  assert.deepEqual(Core.cuota({ p: 80, h: 100, g: 20 }, 1, 'suave'), { p: 40, h: 50, g: 10, kcal: 450 });
  assert.deepEqual(Core.cuota({ p: 90, h: 120, g: 30 }, 2, 'fuerte'), { p: 68, h: 90, g: 23, kcal: 839 }, 'tres cuartos de lo que queda');
});

test('apuntar: guarda la comida con su nombre, su hora, sus alimentos y sus totales', () => {
  const c = Core.apuntar('Comida', new Date(2026, 10, 24, 14, 5), [{ a: Object.assign({ id: 'U1', n: 'Patata', e: 'cocida' }, patata), gramos: 300 }, { a: Object.assign({ id: 'U2', n: 'Pechuga de pollo', e: 'asada o plancha' }, pollo), gramos: 250 }]);
  assert.equal(c.nombre, 'Comida'); assert.equal(c.hora, '14:05');
  assert.equal(Core.apuntar('Desayuno', new Date(2026, 10, 24, 8, 5), []).hora, '8:05', 'la hora, como se dice: 8:05, no 08:05');
  assert.deepEqual(c.items, [{ id: 'U1', n: 'Patata', e: 'cocida', gramos: 300 }, { id: 'U2', n: 'Pechuga de pollo', e: 'asada o plancha', gramos: 250 }]);
  cerca(c.t.kcal, 642, 0.5); cerca(c.t.p, 82.6, 0.1); cerca(c.t.h, 54.6, 0.1); cerca(c.t.g, 9.3, 0.1);
});

test('podarDias: conserva solo los últimos días', () => {
  const dias = { '2026-11-24': [1], '2026-11-23': [2], '2026-10-01': [3], '2026-11-20': [4] };
  assert.deepEqual(Object.keys(Core.podarDias(dias, 3)).sort(), ['2026-11-20', '2026-11-23', '2026-11-24']);
});

// ── El plan del día: qué comida toca y cuánto ──
test('planComidas: qué comidas son según cuántas haces al día (de 2 a 6)', () => {
  assert.deepEqual(Core.planComidas(2), ['Comida', 'Cena']);
  assert.deepEqual(Core.planComidas(3), ['Desayuno', 'Comida', 'Cena']);
  assert.deepEqual(Core.planComidas(4), ['Desayuno', 'Comida', 'Merienda', 'Cena']);
  assert.deepEqual(Core.planComidas(5), ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena']);
  assert.deepEqual(Core.planComidas(6), ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Recena']);
  assert.deepEqual(Core.planComidas(9), Core.planComidas(6)); assert.deepEqual(Core.planComidas(1), Core.planComidas(2));
});

test('comidaQueToca: por la mañana toca el desayuno y quedan todas', () => {
  assert.deepEqual(Core.comidaQueToca(4, [], 8.5), { nombre: 'Desayuno', quedan: 4 });
  assert.deepEqual(Core.comidaQueToca(2, [], 9), { nombre: 'Comida', quedan: 2 }, 'con dos comidas al día, la primera es la comida');
});

test('comidaQueToca: apuntado el desayuno, toca la comida', () => {
  assert.deepEqual(Core.comidaQueToca(4, ['Desayuno'], 9), { nombre: 'Comida', quedan: 3 });
});

test('comidaQueToca: si a mediodía no has desayunado, se lo salta y cuenta solo las que quedan', () => {
  assert.deepEqual(Core.comidaQueToca(3, [], 14), { nombre: 'Comida', quedan: 2 });
  assert.deepEqual(Core.comidaQueToca(4, ['Desayuno', 'Comida'], 21), { nombre: 'Cena', quedan: 1 }, 'a las 21 la merienda ya pasó');
});

test('comidaQueToca: lo apuntado con otro nombre (algo entre horas) no gasta una comida del plan', () => {
  assert.deepEqual(Core.comidaQueToca(3, ['Desayuno', 'Entre horas', 'Media mañana'], 14), { nombre: 'Comida', quedan: 2 });
});

test('comidaQueToca: la última comida vale hasta que acaba el día; con todo apuntado, ninguna', () => {
  assert.deepEqual(Core.comidaQueToca(3, ['Desayuno', 'Comida'], 23.9), { nombre: 'Cena', quedan: 1 });
  assert.equal(Core.comidaQueToca(3, ['Desayuno', 'Comida', 'Cena'], 22), null);
});

test('cuota: lo que queda del día, repartido entre las comidas que faltan', () => {
  assert.deepEqual(Core.cuota({ p: 165, h: 235, g: 60 }, 4), { p: 41, h: 59, g: 15, kcal: 535 });
  assert.deepEqual(Core.cuota({ p: 155, h: 187, g: 47 }, 3), { p: 52, h: 62, g: 16, kcal: 600 });
  assert.deepEqual(Core.cuota({ p: 80, h: 100, g: 20 }, 0), { p: 80, h: 100, g: 20, kcal: 900 }, 'sin más comidas por delante, todo');
});
