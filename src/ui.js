/* Macros · pantalla. Los cálculos viven en core.js (Core). */
(function () {
  'use strict';
  const C = window.Core, F = C.fmt;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const g1 = (v) => F(v, v < 10 ? 1 : 0);
  const MAC = ['p', 'h', 'g'];
  const NOMBRE = { p: 'Proteína', h: 'Hidratos', g: 'Grasa' };
  const DE = { p: 'proteína', h: 'hidratos', g: 'grasa' };
  const EL = { p: 'la proteína', h: 'los hidratos', g: 'la grasa' };
  const CATS = ['Carnes', 'Pescados', 'Huevos y lácteos', 'Cereales y pan', 'Legumbres', 'Verduras', 'Frutas', 'Frutos secos', 'Aceites', 'Dulces', 'Bebidas', 'Salsas', 'Platos', 'Suplementos', 'Míos'];
  const CAT_MIOS = 14;
  const NIVELES = [
    { f: 1.2, n: 'Actividad muy baja', d: 'Trabajo sentado y casi nada de ejercicio' },
    { f: 1.375, n: 'Actividad ligera', d: 'Ejercicio suave 1 a 3 días por semana' },
    { f: 1.55, n: 'Actividad moderada', d: 'Entreno 3 a 5 días por semana' },
    { f: 1.725, n: 'Actividad alta', d: 'Entreno fuerte 6 o 7 días por semana' },
    { f: 1.9, n: 'Actividad muy alta', d: 'Trabajo físico y entreno a diario' }
  ];
  const METAS = { definir: 'Definir', mantener: 'Mantener', ganar: 'Ganar músculo' };
  const svg = (d) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICO = {
    mas: svg('<path d="M12 5v14M5 12h14"/>'), menos: svg('<path d="M5 12h14"/>'), x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), lupa: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    cerrado: svg('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
    abierto: svg('<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 017.6-1.7"/>'),
    estrella: svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>'),
    papelera: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'), flecha: svg('<path d="M9 6l6 6-6 6"/>')
  };

  /* ── Datos ─────────────────────────────────────── */
  const BASE = JSON.parse($('#datos').textContent).map((r) => ({
    id: r[12] + r[13], n: r[0], e: r[1], c: r[2], em: r[3], s: r[4], k: r[5], p: r[6], h: r[7], g: r[8], f: r[9] || 0, az: r[10], sa: r[11], src: r[12], sid: r[13], o: r[14], r: r[15]
  }));
  const CLAVE = 'algramo.v1';
  const EJEMPLO = [{ id: 'U11367', gramos: 300 }, { id: 'U5064', gramos: 250 }, { id: 'U11053', gramos: 100 }];
  const inicial = () => ({
    v: 2, aspecto: 'auto',
    plato: { items: [], modo: 'macros', objetivo: null, ejemplo: false },
    perfil: { sexo: 'h', edad: 30, peso: 75, altura: 178, nivel: 3, ejemplo: true },
    meta: { modo: 'calc', tipo: null, comidas: 4, mano: { p: null, h: null, g: null } },
    favs: [], propios: [], platos: [], dias: {}, metas: {}, pesos: []
  });
  let S = inicial();
  try { const t = localStorage.getItem(CLAVE); if (t) S = Object.assign(inicial(), JSON.parse(t)); } catch (e) { /* sin memoria: se usa igual */ }
  if (['auto', 'claro', 'oscuro'].indexOf(S.aspecto) < 0) S.aspecto = 'auto';   // p. ej. el antiguo «color»
  S.dias = C.podarDias(S.dias && typeof S.dias === 'object' ? S.dias : {}, 400);  // lo apuntado cada día (se guarda algo más de un año)
  S.metas = S.metas && typeof S.metas === 'object' ? S.metas : {};                 // el objetivo que tenía cada día
  Object.keys(S.metas).forEach((k) => { if (!S.dias[k]) delete S.metas[k]; });
  S.pesos = (Array.isArray(S.pesos) ? S.pesos : []).reduce((l, x) => (x && /^\d{4}-\d\d-\d\d$/.test(x.f) ? C.ponPeso(l, x.f, x.kg) : l), []);   // el peso apuntado: [{ f: 'AAAA-MM-DD', kg }]
  let tGuardar = 0;
  const guardaYa = () => { clearTimeout(tGuardar); tGuardar = 0; try { localStorage.setItem(CLAVE, JSON.stringify(S)); } catch (e) { /* nada */ } };
  const guardar = () => { clearTimeout(tGuardar); tGuardar = setTimeout(guardaYa, 250); };
  window.addEventListener('pagehide', () => { if (tGuardar) guardaYa(); });      // apuntar y cerrar al instante no pierde lo apuntado

  let TODOS = [], porId = new Map();
  const indexar = () => { TODOS = BASE.concat(S.propios); porId = new Map(TODOS.map((a) => [a.id, a])); S.plato.items = S.plato.items.filter((it) => porId.has(it.id)); };
  indexar();
  const filas = () => S.plato.items.map((it) => ({ it, a: porId.get(it.id) }));
  const enPlato = (id) => S.plato.items.findIndex((it) => it.id === id);

  const perfilCore = () => ({ sexo: S.perfil.sexo, edad: S.perfil.edad, peso: S.perfil.peso, altura: S.perfil.altura, actividad: NIVELES[(S.perfil.nivel || 3) - 1].f });
  /** Objetivo del día que está activo (o null si aún no lo ha elegido). */
  function metaDia() {
    if (S.meta.modo === 'mano') {
      const m = S.meta.mano, p = C.num(m.p), h = C.num(m.h), g = C.num(m.g);
      return p + h + g > 0 ? { p, h, g, kcal: 4 * p + 4 * h + 9 * g } : null;
    }
    if (!S.meta.tipo) return null;
    const o = C.objetivos(perfilCore());
    return o.error ? null : o[S.meta.tipo];
  }

  /* ── Piezas comunes ────────────────────────────── */
  function mini(a, grande) {
    const rep = C.reparto(a);
    let fondo = 'var(--pista)';
    if (rep.p + rep.h + rep.g > 0) {
      const a1 = (rep.p * 100).toFixed(1), a2 = ((rep.p + rep.h) * 100).toFixed(1);
      fondo = `conic-gradient(var(--p) 0 ${a1}%, var(--h) ${a1}% ${a2}%, var(--g) ${a2}% 100%)`;
    }
    const dentro = a.em ? `<span>${a.em}</span>` : `<span class="letra">${esc(a.n.charAt(0).toUpperCase())}</span>`;
    return `<span class="mini${grande ? ' grande' : ''}" style="background:${fondo}" aria-hidden="true">${dentro}</span>`;
  }
  const trio = (m, letras, clave) => MAC.map((k) => `<span class="m${k === clave ? ' clave' : ''}"><i class="punto ${k}"></i>${letras ? k.toUpperCase() + ' ' : ''}${g1(m[k])}</span>`).join('');
  const estado = (a) => (a.e ? `<span class="estado">${esc(a.e)}</span>` : '');
  const nombre = (a) => esc(a.n) + (a.e ? ` <i>${esc(a.e)}</i>` : '');
  function ponModos(sel, pos) {
    const el = $(sel); el.dataset.pos = pos;
    $$('button', el).forEach((b, i) => b.setAttribute('aria-selected', String(i === pos)));
  }

  let tToast = 0, accionToast = null;
  function toast(msg, etiqueta, accion) {
    const el = $('#toast'); accionToast = accion || null;
    el.innerHTML = `<span>${esc(msg)}</span>` + (etiqueta ? `<button data-a="toast">${esc(etiqueta)}</button>` : '');
    el.classList.add('visto'); clearTimeout(tToast);
    tToast = setTimeout(() => el.classList.remove('visto'), etiqueta ? 5200 : 2400);
  }

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anima(id, v, dec) {
    const el = document.getElementById(id), de = el._v == null ? v : el._v;
    el._v = v;
    if (reduce || Math.abs(de - v) < 0.05) { el.textContent = F(v, dec); return; }
    const t0 = performance.now(); cancelAnimationFrame(el._raf);
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / 320), e = 1 - Math.pow(1 - k, 3);
      el.textContent = F(de + (v - de) * e, dec);
      if (k < 1) el._raf = requestAnimationFrame(paso);
    };
    el._raf = requestAnimationFrame(paso);
  }

  /* ── Pantalla: Mi plato ────────────────────────── */
  let SOL = null;                                   // última solución de «pongo los macros»

  function resolver() {
    const P = S.plato;
    if (P.modo !== 'macros' || !P.objetivo) return null;
    const xs = filas().map((x) => ({ a: x.a, gramos: x.it.gramos, modo: x.it.modo }));
    const fij = C.fijados(xs);
    const r = C.resolver({ objetivo: P.objetivo, items: xs.map((x, i) => ({ a: x.a, fijo: fij[i] })) });
    r.fij = fij;
    r.gramos.forEach((g, i) => { if (fij[i] == null) P.items[i].gramos = g; });
    return r;
  }

  /** Los tres arcos del anillo. `llenado` (0–1) deja el anillo a medias: así el día se va llenando. */
  function arcos(raiz, rep, llenado) {
    const r = 65, c = 2 * Math.PI * r, ancho = 12, hueco = 5;
    const vivos = MAC.filter((m) => rep[m] > 0.004), lleno = llenado == null || llenado >= 0.999, n = vivos.length;
    const util = Math.max(0.03, (lleno ? c : c * Math.max(0, llenado)) - n * ancho - (lleno ? n : n - 1) * hueco);
    let pos = 0;
    MAC.forEach((m) => {
      const el = $(raiz + ' .arco.' + m);
      if (vivos.indexOf(m) < 0) { el.style.opacity = 0; el.style.strokeDasharray = `0 ${c}`; return; }
      el.style.opacity = 1;
      if (n === 1 && lleno) { el.style.strokeDasharray = `${c} 0`; el.style.strokeDashoffset = 0; return; }
      const largo = Math.max(0.01, rep[m] * util);
      el.style.strokeDasharray = `${largo} ${c - largo}`;
      el.style.strokeDashoffset = -(pos + ancho / 2);
      pos += largo + hueco + ancho;
    });
  }

  /**
   * Pinta un resumen (anillo + tres barras). ids: prefijos de los elementos; t: totales; ref: objetivo por macro o null.
   * Con objetivo, cada barra es lo que llevas de lo pedido; si te pasas, se marca dónde estaba lo pedido.
   */
  const IDS_PLATO = { kcal: 't-kcal', v: 't-', s: 's-', b: 'b-' }, IDS_DIA = { kcal: 'd-kcal', v: 'd-', s: 'ds-', b: 'db-' };
  function pintaAnillo(ids, raiz, t, ref, llenado) {
    const rep = C.reparto(t);
    anima(ids.kcal, t.kcal, 0);
    $('#' + ids.kcal).classList.toggle('mil', t.kcal >= 999.5);          // con cuatro cifras, un punto más pequeño: cabe en el anillo
    MAC.forEach((m) => {
      anima(ids.v + m, t[m], t[m] < 10 ? 1 : 0);
      const r = ref ? C.num(ref[m]) : 0, b = $('#' + ids.b + m), pasa = !!ref && t[m] > r + Math.max(2, 0.05 * r);
      $('#' + ids.s + m).textContent = ref ? ` de ${F(r)} g` : 'g';
      b.classList.toggle('pasa', pasa);
      if (pasa) b.style.setProperty('--corte', (r / t[m] * 100).toFixed(1) + '%');
      b.style.width = (ref ? (pasa ? 100 : (r ? Math.min(100, t[m] / r * 100) : 0)) : rep[m] * 100) + '%';
    });
    arcos(raiz, rep, llenado);
  }
  function pintaResumen() {
    const P = S.plato, t = C.totales(filas().map((x) => ({ a: x.a, gramos: x.it.gramos })));
    pintaAnillo(IDS_PLATO, '#p-plato', t, P.modo === 'macros' && P.objetivo ? P.objetivo : null, 1);
    const md = metaDia(), dia = $('#t-dia'), lleva = md ? C.sumaDia(comidasHoy()) : null;
    dia.hidden = !md;                                 // el día: las calorías y, debajo, los tres macros («llevas 0 de 165»)
    const deHoy = !P.cambia || P.cambia.dia === claveHoy();       // una comida de otro día que se está cambiando no se suma a lo de hoy
    if (md) dia.innerHTML = `<span class="dia-kcal">Hoy llevas ${F(lleva.kcal)} de tus ${F(md.kcal)} kcal${deHoy && t.kcal >= 0.5 ? `; con este plato, ${F(lleva.kcal + t.kcal)}.` : '.'}</span>`
      + `<span class="dia-macros">${MAC.map((m) => `<span class="m"><i class="punto ${m}"></i>${m.toUpperCase()} ${F(Math.round(lleva[m]))} de ${F(Math.round(md[m]))}</span>`).join('')}</span>`;
  }

  const subPlato = (m, sobra) => (sobra ? `<span class="sub-k">0 g: no cabe en lo que pides</span>` : `<span class="sub-k">${F(m.kcal)} kcal</span>${trio(m, true)}`);
  function htmlFila(x, i) {
    const a = x.a, it = x.it, macros = S.plato.modo === 'macros', fijo = macros && SOL && SOL.fij[i] != null;
    const m = C.macros(a, it.gramos);
    const boton = (acc, ico, rot) => `<button data-a="${acc}" data-i="${i}" aria-label="${rot}">${ico}</button>`;
    return `<div class="fila de-plato" data-i="${i}">${mini(a)}
      <button class="fila-txt" data-a="ficha" data-id="${a.id}" data-i="${i}"><span class="fila-nombre">${nombre(a)}</span></button>
      <div class="fila-fin">${macros ? `<button class="candado" data-a="candado" data-i="${i}" aria-pressed="${fijo}" aria-label="${fijo ? 'Cantidad fijada: toca para soltarla' : 'Fijar esta cantidad'}">${fijo ? ICO.cerrado : ICO.abierto}</button>` : ''}
        <div class="peso${macros && !fijo ? ' calculado' : ''}">${macros ? '' : boton('menos', ICO.menos, 'Menos gramos')}<label><input inputmode="numeric" pattern="[0-9]*" maxlength="4" data-in="gramos" data-i="${i}" value="${it.gramos}" aria-label="Gramos de ${esc(a.n)}"><em>g</em></label>${macros ? '' : boton('mas', ICO.mas, 'Más gramos')}</div>
      </div><div class="fila-sub">${subPlato(m, macros && !fijo && it.gramos === 0)}</div></div>`;
  }

  /* ── El plan del día: qué comida toca ahora y cuánto ─────────── */
  let platoTocado = false;                      // la persona ha elegido a mano el modo o los números de este plato (no se guarda)
  const horaAhora = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
  /** Lo que queda del día según el objetivo y lo apuntado, o null si no hay objetivo del día. */
  function quedaDia() { const md = metaDia(); return md ? C.queda(md, C.sumaDia(comidasHoy())) : null; }
  /** La comida del plan que toca ahora y su parte de lo que queda. null si no hay plan, no queda ninguna o ya no hay qué repartir. */
  function cuotaAhora(tam) {
    const x = quedaDia(); if (!x || C.estadoDia(metaDia(), C.sumaDia(comidasHoy())).hecho) return null;      // con el día ya cubierto no se reparten migajas
    const toca = C.comidaQueToca(S.meta.comidas, comidasHoy().map((c) => c.nombre), horaAhora()); if (!toca) return null;
    const c = C.cuota(x.queda, toca.quedan, tam);
    return c.p + c.h + c.g >= 5 ? { nombre: toca.nombre, quedan: toca.quedan, objetivo: { p: c.p, h: c.h, g: c.g } } : null;
  }
  /** Un plato nuevo: con plan, la comida que toca ya con sus macros; con todo hecho, apuntar en gramos; sin plan, la calculadora. */
  function nuevoPlato() {
    const c = cuotaAhora();
    S.plato = c ? { items: [], modo: 'macros', objetivo: c.objetivo, ejemplo: false, comida: c.nombre, auto: true, tam: 'normal' }
      : { items: [], modo: metaDia() ? 'gramos' : 'macros', objetivo: null, ejemplo: false, comida: null };
    if (S.plato.modo === 'macros' && !S.plato.objetivo) S.plato.objetivo = objetivoInicial();
    platoTocado = false;
  }
  /** Pone el plato al día antes de pintarlo: uno vacío se prepara para la comida que toca; uno en marcha solo pone su cuota al día. */
  function alDia() {
    const P = S.plato;
    if (!P.items.length && !P.cambia && !platoTocado) { nuevoPlato(); guardar(); return; }
    if (P.auto) { const c = cuotaAhora(P.tam); if (c && c.nombre === P.comida) P.objetivo = c.objetivo; else if (!metaDia()) P.auto = false; }
    if (P.modo === 'macros' && !P.objetivo) P.objetivo = objetivoInicial();
  }
  const VERBO = { 'Desayuno': 'desayunar', 'Comida': 'comer', 'Merienda': 'merendar', 'Cena': 'cenar' };
  const ARTICULO = { 'Desayuno': 'el desayuno', 'Media mañana': 'la media mañana', 'Comida': 'la comida', 'Merienda': 'la merienda', 'Cena': 'la cena', 'Recena': 'la recena' };

  /* El veredicto de «pongo los macros»: qué pides, qué sale del plato y, si no cuadra, por qué y qué hacer. */
  function htmlVeredicto() { return veredictoHtml().replace(/(\d) g\b/g, '$1\u00a0g'); }   // «1.250 g» no se parte entre dos renglones
  function veredictoHtml() {
    const P = S.plato, xs = filas();
    const v = C.veredicto(P.objetivo, xs.map((x, i) => ({ a: x.a, gramos: x.it.gramos, fijo: x.it.modo === 'fijo', quieto: SOL.fij[i] != null && x.it.modo !== 'fijo' })), SOL);
    if (v.estado === 'vacio') return `<div class="veredicto"><h3>Elige qué vas a ${(P.auto && VERBO[P.comida]) || 'comer'}</h3> <p>Añade los alimentos y te digo cuántos gramos de cada uno te tocan.</p>${metaDia() ? '' : `<div class="chips"><button class="chip" data-a="ver-ejemplo">Ver un plato de ejemplo</button></div>`}</div>`;
    const de = (j) => esc(xs[j].a.n.toLowerCase());
    if (v.estado === 'clavado') {
      const muchos = v.enormes.map((j) => `${F(xs[j].it.gramos)} g de ${de(j)}`).join(' y ');
      return `<div class="veredicto bien">${ICO.check}<p><b>Clavado.</b> Con estos gramos, el plato da lo que pides.${muchos ? ` Eso sí: salen ${muchos}.` : ''}</p></div>`;
    }
    const sug = C.sugerir(SOL.desvio, TODOS, P.items.map((it) => it.id));
    const sugeridos = sug.length ? `<p class="v-que">Prueba a añadir algo con ${DE[sug[0].macro]}:</p><div class="chips en-fila">${sug.map((x) => `<button class="chip" data-a="sugerido" data-id="${x.id}">${ICO.mas}${esc(porId.get(x.id).n)}</button>`).join('')}</div>` : '';
    /* Lo que falta porque con más de ese alimento te pasarías de otro macro: se dice, y se ofrece subir ese otro. */
    const topes = {};
    v.lineas.forEach((l) => { const c = l.causa; if (c && c.tipo === 'limita') topes[c.m2] = Math.max(topes[c.m2] || 0, Math.ceil(c.hasta)); });
    const subir = Object.keys(topes).length ? `<div class="chips">${Object.keys(topes).map((m) => `<button class="chip" data-a="aceptar" data-m="${m}" data-v="${topes[m]}">${sug.length ? 'O subir' : 'Subir'} ${EL[m]} a ${F(topes[m])} g</button>`).join('')}</div>` : '';
    const limita = (l) => ` Con más ${de(l.causa.j)} te pasarías de ${DE[l.causa.m2]}.`;
    if (v.estado === 'falta') {
      const partes = v.lineas.map((l) => `<b>${F(Math.round(l.pide - l.sale))} g de ${DE[l.m]}</b>`);
      const frenos = [...new Set(v.lineas.filter((l) => l.causa && l.causa.tipo === 'limita').map(limita))].join('');
      return `<div class="veredicto"><h3>Añade algo más</h3> <p>Aún ${v.lineas.length === 1 && Math.round(v.lineas[0].pide - v.lineas[0].sale) === 1 ? 'falta' : 'faltan'} ${partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0]}.${frenos}</p>${sugeridos}${subir}</div>`;
    }
    const porque = (l) => {
      const c = l.causa; if (!c) return '';
      if (c.tipo === 'sin') return ` En el plato no hay nada con ${DE[l.m]}.`;
      if (c.tipo === 'limita') return limita(l);
      if (c.tipo === 'tope') return ` Y ya van ${F(c.gramos)} g de ${de(c.j)}.`;
      if (c.tipo === 'fijo' && v.todoFijo) return '';                    // se dice una vez, abajo
      if (c.tipo === 'fijo') return l.tipo === 'falta' ? ` Lo que lleva ${DE[l.m]} tiene el candado puesto.` : ` Con el candado en ${F(c.gramos)} g de ${de(c.j)} ya salen ${g1(c.aporta)} g.`;
      return c.solo ? ` Solo con ${de(c.j)} ya salen ${g1(c.aporta)} g.` : ` Lo que más trae es ${de(c.j)}: ${g1(c.aporta)} g.`;
    };
    const lineas = v.lineas.map((l) => `<li><i class="punto ${l.m}"></i><span><b>${NOMBRE[l.m]}:</b> pides ${F(l.pide)} g y salen ${g1(l.sale)} g.${porque(l)}</span></li>`).join('');
    const sobra = v.lineas.filter((l) => l.tipo === 'sobra');
    let salida = '';
    if (v.todoFijo) salida = `<p class="v-que">Todo tiene el candado puesto: suelta alguno para que pueda ajustar.</p>`;
    else if (sug.length || subir) salida = sugeridos + subir;
    else if (sobra.length) salida = `<div class="chips">${sobra.map((l) => `<button class="chip" data-a="aceptar" data-m="${l.m}" data-v="${Math.round(l.sale)}">Dejarlo en ${F(Math.round(l.sale))} g de ${DE[l.m]}</button>`).join('')}</div>`;
    return `<div class="veredicto${v.estado === 'casi' ? '' : ' ojo'}"><h3>${v.estado === 'casi' ? 'Casi clavado' : 'Con estos alimentos no sale'}</h3><ul class="v-lineas">${lineas}</ul>${salida}</div>`;
  }

  /** El rótulo de los tres campos: «Comida: te tocan» si lo pone el plan; «En este plato quiero» si los números son tuyos. */
  function htmlRotulo() {
    const P = S.plato, n = esc(P.comida || ''), t = P.tam;
    const txt = !(P.auto && P.comida) ? 'En este plato quiero'
      : t === 'todo' ? `<b>${n}:</b> todo lo que te queda` : `<b>${n}${t === 'suave' ? ' suave' : t === 'fuerte' ? ' fuerte' : ''}:</b> te tocan`;
    return `<h3>${txt}</h3> <span class="obj-kcal" id="obj-kcal"></span>`;
  }
  const TAMANOS = [['suave', 'Suave'], ['normal', 'Normal'], ['fuerte', 'Fuerte'], ['todo', 'Todo']];
  /** Debajo de los campos: el tamaño de esta comida (lo decide quien come) y «algo entre horas». Sin macros del día, lo primero es calcularlos. */
  function htmlAtajos() {
    const P = S.plato;
    if (!metaDia()) return `<div class="aviso-ej"><span>Dime tus macros del día y en cada comida te diré cuánto te toca</span> <button class="chip" data-a="ir-macros">Calcular mis macros</button></div>`;
    const elegido = P.auto && P.comida ? (P.tam || 'normal') : null;      // con números puestos a mano no hay tamaño marcado
    const tamanos = cuotaAhora() ? `<div class="tamanos" role="group" aria-label="Tamaño de esta comida">${TAMANOS.map(([v, t]) => `<button data-a="tam" data-v="${v}" aria-pressed="${elegido === v}">${t}</button>`).join('')}</div>` : '';
    return tamanos + `<div class="chips"><button class="chip" data-a="entre-horas">Algo entre horas</button></div>`;
  }
  /** «el sábado 21» (u «hoy»): el día de una comida, dicho en una frase. */
  const elDiaDe = (k) => { if (k === claveHoy()) return 'hoy'; const f = C.fechaDe(k); return `el ${SEMANA[f.getDay()]} ${f.getDate()}`; };
  /** Mientras se cambia una comida ya apuntada, el plato lo dice (y de qué día es) y deja volver atrás. */
  function htmlCambio() {
    const cam = S.plato.cambia; if (!cam) return '';
    const cual = ARTICULO[cam.nombre] || `«${esc(cam.nombre)}»`;
    return `<div class="aviso-ej"><span>Cambiando ${cual} ${('de ' + elDiaDe(cam.dia)).replace('de el', 'del')}</span>${cam.antes ? ' <button class="chip" data-a="cambio-fuera">Dejarla como estaba</button>' : ''}</div>`;
  }
  function htmlExtra() {
    const P = S.plato;
    if (P.modo !== 'macros') {
      if (P.ejemplo) return `<div class="aviso-ej"><span>Plato de ejemplo, para que pruebes</span><button class="chip" data-a="vaciar">Empezar el mío</button></div>`;
      if (P.comida == null && !P.cambia && cuotaAhora()) return `<div class="aviso-ej"><span>Algo entre horas, sin objetivo</span> <button class="chip" data-a="obj-toca">Volver a lo que toca</button></div>`;
      if (!P.items.length && !P.cambia && metaDia() && comidasHoy().length && !cuotaAhora()) return `<div class="aviso-ej"><span>${C.comidaQueToca(S.meta.comidas, comidasHoy().map((c) => c.nombre), horaAhora()) ? 'Ya has llegado a tus macros de hoy' : 'Las comidas de hoy ya están apuntadas'}. Si comes algo más, apúntalo aquí.</span></div>`;
      return '';
    }
    const o = P.objetivo;
    const campo = (m) => `<label class="campo-m" data-m="${m}"><span>${NOMBRE[m]}</span><div><input inputmode="numeric" pattern="[0-9]*" maxlength="3" data-in="obj" data-m="${m}" value="${F(C.num(o[m]))}" aria-label="${NOMBRE[m]} que quieres en este plato, en gramos"><em>g</em></div></label>`;
    return `<div class="objetivo">
      <div class="rotulo" id="obj-rotulo">${htmlRotulo()}</div>
      <div class="obj-campos">${MAC.map(campo).join('')}</div>
      <div id="obj-chips">${htmlAtajos()}</div>
      <div id="veredicto">${htmlVeredicto()}</div>
      ${P.items.length ? `<h3 class="rotulo">Te tocan estos gramos</h3>` : ''}</div>`;
  }

  const pintaObjKcal = () => { const el = $('#obj-kcal'), o = S.plato.objetivo; if (el && o) el.textContent = `${F(4 * C.num(o.p) + 4 * C.num(o.h) + 9 * C.num(o.g))} kcal`; };

  /** Pinta la pantalla entera del plato. */
  function pintaPlato() {
    alDia();
    const P = S.plato;
    ponModos('#modos-plato', P.modo === 'macros' ? 0 : 1);
    SOL = resolver();
    $('#plato-extra').innerHTML = htmlCambio() + htmlExtra();
    const xs = filas();
    $('#plato-filas').innerHTML = xs.map(htmlFila).join('') || (P.modo === 'macros' ? '' : `<div class="vacio"><b>Tu plato está vacío</b>Añade lo que vas a comer y verás al momento sus calorías y sus macros.</div>`);
    $('#plato-nota').textContent = !xs.length ? '' : P.modo === 'macros'
      ? 'El candado deja fija una cantidad. Lo ligero (verdura, leche, café con leche…) viene fijado en su ración; suéltalo si quieres que también se ajuste.'
      : 'Toca un alimento para ver su detalle o quitarlo.';
    pintaObjKcal(); pintaResumen(); pintaPie();
  }

  /** Recalcula sin volver a pintar los campos (para no perder el foco al escribir). */
  function refrescaPlato() {
    const macros = S.plato.modo === 'macros';
    if (macros) SOL = resolver();
    filas().forEach((x, i) => {
      const fila = $(`#plato-filas .fila[data-i="${i}"]`); if (!fila) return;
      const m = C.macros(x.a, x.it.gramos), inp = $('input', fila);
      $('.fila-sub', fila).innerHTML = subPlato(m, macros && SOL.fij[i] == null && x.it.gramos === 0);
      if (inp !== document.activeElement && inp.value !== String(x.it.gramos)) {
        inp.value = x.it.gramos;
        const caja = $('.peso', fila); caja.classList.remove('cambia'); void caja.offsetWidth; caja.classList.add('cambia');
      }
      if (macros) {
        const fijo = SOL.fij[i] != null, cand = $('.candado', fila);
        cand.setAttribute('aria-pressed', String(fijo)); cand.innerHTML = fijo ? ICO.cerrado : ICO.abierto;
        $('.peso', fila).classList.toggle('calculado', !fijo);
      }
    });
    if (macros) { const v = $('#veredicto'); if (v) v.innerHTML = htmlVeredicto(); pintaObjKcal(); }
    pintaResumen();
  }

  function tocado() { if (S.plato.ejemplo) { S.plato.ejemplo = false; const av = $('.aviso-ej'); if (av) av.remove(); } guardar(); }
  const paso = (a) => (a.r <= 20 ? 1 : 5);
  function sumaGramos(i, signo) {
    const x = filas()[i]; if (!x) return;
    x.it.gramos = Math.max(0, Math.min(5000, Math.round((x.it.gramos + signo * paso(x.a)) / paso(x.a)) * paso(x.a)));
    $(`#plato-filas .fila[data-i="${i}"] input`).value = x.it.gramos;
    tocado(); refrescaPlato();
  }
  /** Añade un alimento con su ración habitual. Si el plato es el de ejemplo, lo sustituye (salvo `conserva`). */
  function anade(id, callado, conserva) {
    const a = porId.get(id); if (!a) return;
    if (S.plato.ejemplo && !conserva) S.plato.items = [];
    S.plato.ejemplo = false;
    S.plato.items.push({ id, gramos: a.r });
    guardar();
    if (!callado) toast(`${a.n}: ${a.r} g en el plato`);
  }
  function quita(i) {
    const previo = JSON.stringify(S.plato), x = filas()[i]; if (!x) return;
    S.plato.items.splice(i, 1); S.plato.ejemplo = false; guardar(); pintaPlato();
    toast(`${x.a.n}, fuera del plato`, 'Deshacer', () => { S.plato = JSON.parse(previo); platoTocado = true; guardar(); pintaPlato(); });
  }
  function objetivoInicial() {
    const md = metaDia();
    if (md) return C.porComida(md, S.meta.comidas);
    const t = C.totales(filas().map((x) => ({ a: x.a, gramos: x.it.gramos })));
    return t.kcal > 0 ? { p: Math.round(t.p), h: Math.round(t.h), g: Math.round(t.g) } : { p: 40, h: 60, g: 15 };
  }

  /* ── Biblioteca (pantalla Alimentos y hoja «Añadir») ─ */
  const FIL = { biblio: { q: '', cat: null, orden: 'az' }, elegir: { q: '', cat: null, orden: 'az' } };
  function htmlBuscador(k) {
    const f = FIL[k], chip = (v, t) => `<button class="chip" data-a="cat" data-k="${k}" data-v="${v}" aria-pressed="${String(f.cat) === String(v)}">${t}</button>`;
    let chips = '';
    if (S.favs.length) chips += chip('fav', 'Favoritos');
    if (S.propios.length) chips += chip(CAT_MIOS, 'Míos');
    CATS.slice(0, CAT_MIOS).forEach((c, i) => { chips += chip(i, c); });
    return `<div class="buscador">${ICO.lupa}<input type="search" data-in="q" data-k="${k}" value="${esc(f.q)}" placeholder="Busca entre ${TODOS.length} alimentos" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Buscar alimento"></div>
      <div class="cinta" id="cinta-${k}">${chips}</div>`;
  }
  /* Formas de ordenar la lista. En cada fila se resalta el dato por el que está ordenada. */
  const ORDENES = [['az', 'Por nombre'], ['prot', 'Más proteína'], ['hid', 'Más hidratos'], ['gra', 'Más grasa'], ['fib', 'Más fibra'],
    ['kcal', 'Menos calorías'], ['mkcal', 'Más calorías'], ['pk', 'Más proteína por caloría']];
  const MACRO_ORDEN = { prot: 'p', hid: 'h', gra: 'g' };
  function subLista(a, orden) {
    let s = trio(a, true, MACRO_ORDEN[orden]);
    if (orden === 'fib') s += `<span class="m clave">Fibra ${g1(a.f)}</span>`;
    if (orden === 'pk') s += `<span class="m clave">${g1(C.proteinaPorCaloria(a))} g de proteína cada 100 kcal</span>`;
    return s;
  }
  function htmlLista(k) {
    const f = FIL[k];
    let base = TODOS, cat = f.cat;
    if (cat === 'fav') { base = TODOS.filter((a) => S.favs.indexOf(a.id) >= 0); cat = null; }
    const res = C.buscar(base, f.q, { cat: cat == null ? undefined : Number(cat), orden: f.orden });
    const cab = `<div class="orden"><span>${res.length === 1 ? '1 alimento' : F(res.length) + ' alimentos'}</span><select data-in="orden" data-k="${k}" aria-label="Ordenar la lista">${ORDENES.map((o) => `<option value="${o[0]}"${f.orden === o[0] ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div>`;
    if (!res.length) return cab + `<div class="vacio"><b>No lo encuentro</b>Prueba con otra palabra o créalo tú con los datos de su etiqueta.<div style="margin-top:14px"><button class="btn suave" data-a="nuevo" data-k="${k}">Crear este alimento</button></div></div>`;
    return cab + `<div class="filas">` + res.map((a) => {
      const dentro = enPlato(a.id) >= 0;
      return `<div class="fila">${mini(a)}
        <button class="fila-txt" data-a="ficha" data-id="${a.id}"><span class="fila-nombre">${nombre(a)}</span><span class="fila-sub">${subLista(a, f.orden)}</span></button>
        <div class="fila-fin"><div class="fila-kcal">${F(a.k)}<small>kcal</small></div><button class="anadir${dentro ? ' puesto' : ''}" data-a="alternar" data-id="${a.id}" aria-label="${dentro ? 'Quitar del plato' : 'Añadir al plato'}: ${esc(a.n)}" aria-pressed="${dentro}">${dentro ? ICO.check : ICO.mas}</button></div></div>`;
    }).join('') + `</div>`;
  }
  function pintaLista(k) { const el = $('#lista-' + k); if (el) el.innerHTML = htmlLista(k); }
  function pintaBiblio() { $('#busca-biblio').innerHTML = htmlBuscador('biblio'); pintaLista('biblio'); }

  /* ── Hojas emergentes ──────────────────────────── */
  const sheet = $('#sheet'), velo = $('#velo');
  let alCerrar = null, abierta = false;
  function abre(cab, cuerpo, opts) {
    opts = opts || {};
    sheet.className = 'sheet' + (opts.alta ? ' alta' : '');
    sheet.innerHTML = `<div class="sheet-cab"><div class="sheet-tit">${cab}<button class="cerrar" data-a="cerrar" aria-label="Cerrar">${ICO.x}</button></div>${opts.bajoCab || ''}</div><div class="sheet-cuerpo">${cuerpo}</div>`;
    alCerrar = opts.alCerrar || null; abierta = true;
    requestAnimationFrame(() => { sheet.classList.add('abierto'); velo.classList.add('abierto'); });
  }
  function cierra() {
    if (!abierta) return;
    abierta = false; sheet.classList.remove('abierto'); velo.classList.remove('abierto');
    if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
    const f = alCerrar; alCerrar = null; if (f) f();
  }
  const h2 = (t) => `<h2 id="sheet-h">${esc(t)}</h2>`;

  function abreElegir() {
    FIL.elegir.q = '';
    abre(h2('Añadir al plato'), `<div id="lista-elegir">${htmlLista('elegir')}</div>`, { alta: true, bajoCab: htmlBuscador('elegir'), alCerrar: pintaPlato });
    if (window.matchMedia && matchMedia('(pointer: fine)').matches) setTimeout(() => { const q = $('#sheet input[type="search"]'); if (q) q.focus(); }, 360);
  }

  function abreFicha(id, i) {
    const a = porId.get(id); if (!a) return;
    const idx = i != null && S.plato.items[i] && S.plato.items[i].id === id ? i : enPlato(id);
    const g = idx >= 0 ? S.plato.items[idx].gramos : a.r, m = C.macros(a, g);
    const v = (x, dec) => (x == null ? '–' : F(x, dec == null ? 1 : dec));
    const fila = (t, c100, cg, sub) => `<tr${sub ? ' class="sub"' : ''}><th>${t}</th><td>${c100}</td><td>${cg}</td></tr>`;
    const q = g / 100;
    const fuente = a.src === 'U' ? `Fuente: USDA FoodData Central (SR Legacy), n.º ${a.sid}. Nombre original: «${esc(a.o)}».`
      : a.src === 'C' ? `Fuente: tabla CIQUAL 2017 (Anses, Francia), código ${a.sid}. Nombre original: «${esc(a.o)}».` : 'Alimento creado por ti con los datos de su etiqueta.';
    const fav = S.favs.indexOf(id) >= 0;
    const cuerpo = `<table class="tabla">
        <tr class="cab"><th></th><td>100 g</td><td>${F(g)} g</td></tr>
        ${fila('Calorías', F(a.k) + ' kcal', F(m.kcal) + ' kcal')}
        ${fila('<span class="m"><i class="punto p"></i>Proteína</span>', v(a.p) + ' g', v(m.p) + ' g')}
        ${fila('<span class="m"><i class="punto h"></i>Hidratos</span>', v(a.h) + ' g', v(m.h) + ' g')}
        ${a.az == null ? '' : fila('de los que azúcares', v(a.az) + ' g', v(a.az * q) + ' g', true)}
        ${fila('<span class="m"><i class="punto g"></i>Grasa</span>', v(a.g) + ' g', v(m.g) + ' g')}
        ${a.sa == null ? '' : fila('de la que saturada', v(a.sa) + ' g', v(a.sa * q) + ' g', true)}
        ${fila('Fibra', v(a.f) + ' g', v(m.f) + ' g')}
      </table>
      <p class="fuente">${fuente}</p>
      <div style="display:grid;gap:10px;margin-top:16px">
        ${idx >= 0 ? `<button class="btn suave peligro" data-a="quitar" data-i="${idx}">Quitar del plato</button>` : `<button class="btn" data-a="anadir-ficha" data-id="${id}">${ICO.mas}Añadir al plato</button>`}
        ${a.src === 'P' ? `<button class="btn suave peligro" data-a="borrar-propio" data-id="${id}">Borrar este alimento</button>` : ''}
      </div>`;
    abre(`<div class="ficha-cab">${mini(a, true)}<div><h2 id="sheet-h">${esc(a.n)}</h2><div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${estado(a)}<button class="chip" data-a="fav" data-id="${id}" aria-pressed="${fav}">${ICO.estrella}Favorito</button></div></div></div>`, cuerpo);
  }

  function abreAspecto() {
    const op = (v, t) => `<button class="aspecto asp-${v}" data-a="pon-aspecto" data-v="${v}" aria-pressed="${S.aspecto === v}"><i></i><span>${t}</span></button>`;
    abre(h2('Aspecto'), `<div class="aspectos">${op('auto', 'Automático')}${op('claro', 'Claro')}${op('oscuro', 'Oscuro')}</div><p class="nota">Automático sigue el modo de tu móvil.</p>`);
  }

  function resumenPlato(items) {
    const t = C.totales(items.map((it) => ({ a: porId.get(it.id), gramos: it.gramos })).filter((x) => x.a));
    return `${F(t.kcal)} kcal · P ${g1(t.p)} · H ${g1(t.h)} · G ${g1(t.g)}`;
  }
  function abrePlatos() {
    const hay = S.plato.items.length > 0;
    const lista = S.platos.length ? `<div class="guardados">${S.platos.map((p, i) => `<div class="guardado"><button class="txt" data-a="cargar-plato" data-i="${i}"><b>${esc(p.nombre)}</b><small>${resumenPlato(p.items)}</small></button><button class="cerrar" data-a="borrar-plato" data-i="${i}" aria-label="Borrar ${esc(p.nombre)}">${ICO.papelera}</button></div>`).join('')}</div>`
      : `<p class="nota" style="margin-top:4px">Aquí verás los platos que guardes para repetirlos sin volver a montarlos.</p>`;
    abre(h2('Mis platos'), `${hay ? `<label class="campo"><span>Nombre para guardar el plato de ahora</span><div><input type="text" class="largo" id="nombre-plato" maxlength="40" placeholder="Pollo con patatas" autocomplete="off"></div></label>
      <div class="btn-fila" style="margin-top:10px"><button class="btn suave" data-a="vaciar">Vaciar el plato</button><button class="btn suave" data-a="guardar-plato">Guardarlo</button></div>` : ''}
      <h3 class="subtitulo" style="margin:20px 2px 2px">Guardados</h3>${lista}`);
  }

  function abreDatos() {
    abre(h2('De dónde salen los datos'), `<div class="prosa">
      <p><b>${BASE.length} alimentos</b> de uso diario. Los valores son por 100 g de la parte que se come.</p>
      <p>Los macros vienen de dos tablas públicas de referencia: <a href="https://fdc.nal.usda.gov/">USDA FoodData Central</a> (Estados Unidos, edición SR Legacy) y <a href="https://ciqual.anses.fr/">CIQUAL 2017</a> (Anses, Francia). En la ficha de cada alimento pone de cuál sale y con qué código, para que lo puedas comprobar.</p>
      <p><b>Hidratos</b> son los disponibles, sin contar la fibra, igual que en las etiquetas de aquí. La tabla americana los da con la fibra dentro, así que se la he restado.</p>
      <p><b>Calorías</b>: se calculan con los factores del etiquetado europeo (4 kcal por gramo de proteína y de hidratos, 9 por gramo de grasa y 2 por gramo de fibra). Así cuadran con tus macros y con lo que ves en los envases. En las bebidas alcohólicas se usa la cifra de la tabla.</p>
      <p>Son medias: una patata o un filete concreto pueden variar un 10 % arriba o abajo. Para un producto de marca, fíate de su etiqueta y créalo en «Alimentos».</p></div>`);
  }

  function abreNuevo(sugerido) {
    const c = (id, t, u, extra) => `<label class="campo"><span>${t}</span><div><input id="${id}" ${extra || 'inputmode="decimal"'} autocomplete="off"><em>${u}</em></div></label>`;
    abre(h2('Crear un alimento'), `<p class="nota" style="margin:0 2px 12px">Copia los datos de la etiqueta, por 100 g.</p>
      <div class="form" style="margin-top:0">
        <label class="campo"><span>Nombre</span><div><input type="text" class="largo" id="n-nombre" maxlength="50" placeholder="Yogur proteico de vainilla" autocomplete="off"></div></label>
        <div class="form-3">${c('n-p', 'Proteína', 'g')}${c('n-h', 'Hidratos', 'g')}${c('n-g', 'Grasa', 'g')}</div>
        <div class="form-3">${c('n-f', 'Fibra', 'g')}${c('n-k', 'Calorías', 'kcal')}${c('n-r', 'Ración', 'g')}</div>
        <p class="nota" style="margin:0 2px">Si dejas las calorías en blanco, las calculo con los macros. La ración es lo que sueles ponerte.</p>
        <p class="aviso" id="n-error" hidden></p>
        <button class="btn" data-a="guardar-nuevo">Guardar alimento</button>
      </div>`);
    if (sugerido) $('#n-nombre').value = sugerido.charAt(0).toUpperCase() + sugerido.slice(1);
  }

  /* ── Pantalla: Hoy (lo que llevas apuntado) ────── */
  const claveHoy = () => C.claveDia(new Date());
  const comidasHoy = () => S.dias[claveHoy()] || [];
  /* Otros días: «Hoy» puede enseñar cualquier día ya pasado (la tira de la semana y el mes llevan hasta él). */
  let diaVisto = null;                          // el día que se está viendo; null = hoy (no se guarda)
  const claveVista = () => (diaVisto && diaVisto < claveHoy() ? diaVisto : claveHoy());
  const comidasDe = (k) => S.dias[k] || [];
  const metaDe = (k) => S.metas[k] || metaDia();                       // el objetivo que tenía ese día; si no lo guardó, el de ahora
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const CLASE_DIA = { cumplido: 'ok', medias: 'med', sin: 'sin', apuntado: 'apu', futuro: 'fut', antes: 'fut', hoy: 'ya' };
  const DICE_DIA = { cumplido: 'cumplido', medias: 'a medias', sin: 'sin apuntar', apuntado: 'apuntado', futuro: 'aún no ha llegado', antes: 'sin apuntar', hoy: 'en marcha' };
  /** Guarda con el día el objetivo que tenía, para que el historial lo mida con lo que tocaba entonces. */
  function ponMeta(k, md) {
    const a = S.metas[k];
    if (!a || a.kcal !== md.kcal || a.p !== md.p || a.h !== md.h || a.g !== md.g) { S.metas[k] = { kcal: md.kcal, p: md.p, h: md.h, g: md.g }; guardar(); }
  }
  /** Un día de la tira o del mes: su marca redonda (llena si cumplió, aro ámbar a medias, aro gris sin apuntar; hoy, lo que lleva). */
  function htmlDia(d, visto, enTira) {
    const f = C.fechaDe(d.k);
    let v = '';
    if (d.estado === 'hoy') { const md = metaDia(), t = C.sumaDia(comidasHoy()); v = ` style="--v:${md && md.kcal ? Math.round(Math.min(1, t.kcal / md.kcal) * 100) : (t.kcal ? 50 : 0)}%"`; }
    return `<button class="${enTira ? 'sem-d' : 'mes-d'}" data-a="ver-dia" data-k="${d.k}" aria-current="${d.k === visto}" aria-label="${SEMANA[f.getDay()]} ${f.getDate()}: ${DICE_DIA[d.estado]}"${d.estado === 'futuro' ? ' disabled' : ''}>${enTira ? LETRAS[f.getDay()] : ''}<span class="marca ${CLASE_DIA[d.estado]}"${v}><span>${f.getDate()}</span></span></button>`;
  }
  /** «Últimos 7 días: 3 cumplidos, 2 a medias y 1 sin apuntar.» Sin objetivo del día, solo cuántos se apuntaron. */
  function fraseSemana(c) {
    const n = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`;
    const p = (metaDia() || c.cumplido + c.medias ? [c.cumplido + c.medias + c.sin ? `<b>${n(c.cumplido, 'cumplido', 'cumplidos')}</b>` : '', c.medias ? `${c.medias} a medias` : '']
      : [c.apuntado ? `<b>${n(c.apuntado, 'apuntado', 'apuntados')}</b>` : '']).concat([c.sin ? `${c.sin} sin apuntar` : '']).filter(Boolean);
    return p.length ? `Últimos 7 días: ${p.length > 1 ? p.slice(0, -1).join(', ') + ' y ' + p[p.length - 1] : p[0]}.` : '';
  }
  /** El mes de un vistazo: cada día con su marca, la cuenta y la racha. */
  function htmlMes(a, m) {
    const hoy = claveHoy(), md = metaDia(), dm = C.diasDelMes(a, m), cal = C.calendario(S.dias, S.metas, dm.claves, hoy, md), c = cal.cuenta;
    const con = Object.keys(S.dias).filter((k) => S.dias[k].length).sort(), primero = (con[0] || hoy).slice(0, 7), este = dm.claves[0].slice(0, 7);
    const ir = (d) => { const x = new Date(a, m - 1 + d, 1); return x.getFullYear() + '-' + (x.getMonth() + 1); };
    const ley = (n, clase, t) => `<div><b>${n}</b> <span class="marca ${clase}"></span>${t}</div>`;
    const r = md ? C.racha(S.dias, S.metas, hoy, md) : null;
    const racha = !r || (!r.actual && !r.mejor) ? '' : `<div class="racha">${r.actual > 1 ? `Llevas <b>${r.actual} días seguidos</b> cumpliendo.` : r.actual === 1 ? 'Llevas <b>1 día</b> cumpliendo.' : 'Ahora no llevas racha.'}${r.mejor > r.actual ? ` Tu mejor racha: ${r.mejor} días.` : ''}</div>`;
    const cuenta = (md || c.cumplido + c.medias ? [ley(c.cumplido, 'ok', c.cumplido === 1 ? 'cumplido' : 'cumplidos'), ley(c.medias, 'med', 'a medias')] : [ley(c.apuntado, 'apu', c.apuntado === 1 ? 'apuntado' : 'apuntados')]).concat([ley(c.sin, 'sin', 'sin apuntar')]);
    return { titulo: capital(MESES[m - 1]) + (a !== +hoy.slice(0, 4) ? ' ' + a : ''),
      cuerpo: `<div class="mes-nav"><button data-a="mes-ir" data-d="-1" data-v="${ir(-1)}" aria-label="Mes anterior"${este <= primero ? ' disabled' : ''}>‹</button><p>${con.length ? 'Toca un día para ver lo que comiste.' : 'Aún no has apuntado ningún día.'}</p><button data-a="mes-ir" data-d="1" data-v="${ir(1)}" aria-label="Mes siguiente"${este >= hoy.slice(0, 7) ? ' disabled' : ''}>›</button></div>
        <div class="mes">${'LMXJVSD'.split('').map((l) => `<small>${l}</small>`).join('')}${'<span></span>'.repeat(dm.huecos)}${cal.dias.map((d) => htmlDia(d, claveVista(), false)).join('')}</div>
        ${con.length ? `<div class="mes-ley">${cuenta.join(' ')}</div>${racha}` : `<p class="nota">Cuando apuntes tus comidas, aquí verás qué días cumples tus macros y tu racha.</p>`}` };
  }
  function abreMes() { const f = C.fechaDe(claveVista()), x = htmlMes(f.getFullYear(), f.getMonth() + 1); abre(h2(x.titulo), `<div id="mes-cuerpo">${x.cuerpo}</div>`); }
  function pintaMes(a, m) { const x = htmlMes(a, m); $('#sheet-h').textContent = x.titulo; $('#mes-cuerpo').innerHTML = x.cuerpo; }
  /** Lo que queda para el objetivo del día, o null si no hay objetivo o no se ha apuntado nada. */
  function quedaHoy() {
    const md = metaDia(), cs = comidasHoy();
    return md && cs.length ? C.queda(md, C.sumaDia(cs)) : null;
  }
  const ICONO_COMIDA = { 'Desayuno': '☕', 'Media mañana': '🍎', 'Comida': '🍽️', 'Merienda': '🥪', 'Cena': '🌙', 'Recena': '🥛', 'Entre horas': '🍏' };
  const lineaMacros = (t) => `${F(t.kcal)} kcal · P ${g1(t.p)} · H ${g1(t.h)} · G ${g1(t.g)}`;
  function htmlHoy() {
    const esHoy = claveVista() === claveHoy(), cs = comidasDe(claveVista()), md = esHoy ? metaDia() : metaDe(claveVista());
    if (!cs.length && !esHoy) return `<div class="vacio"><b>Ese día no apuntaste nada</b>Toca otro día de la tira para ver lo que comiste.</div>`;
    if (!cs.length) return `<div class="vacio"><b>Hoy aún no has apuntado nada</b>Monta lo que vas a comer en «Plato» y pulsa «Apuntar en Hoy».<div style="margin-top:14px"><button class="btn suave" data-a="tab" data-v="plato">Ir a mi plato</button></div></div>`;
    let h = `<h3 class="subtitulo" style="margin:2px 4px 0">${esHoy ? 'Lo que llevas' : 'Lo que comiste'}</h3><div class="comidas">` + cs.map((c, i) =>
      `<button class="comida" data-a="ver-comida" data-i="${i}">${mini({ p: c.t.p, h: c.t.h, g: c.t.g, n: c.nombre, em: ICONO_COMIDA[c.nombre] })}
        <span class="comida-txt"><b>${esc(c.nombre)}</b> <small>${lineaMacros(c.t)}</small></span> <span class="comida-hora">${esc(c.hora)}</span></button>`).join('') + `</div>`;
    if (!md && !esHoy) return h;
    if (!md) return h + `<div class="veredicto" style="margin-top:12px"><h3>¿Cuánto te toca al día?</h3> <p>Calcula tus macros y te digo cómo vas y cuánto te queda.</p><div class="chips"><button class="chip" data-a="ir-macros">Calcular mis macros</button></div></div>`;
    if (!esHoy) {                                                        // otro día: cumplido, o en qué se quedó corto o se pasó
      const t = C.sumaDia(cs);
      if (C.cumple(md, cs) === 'cumplido') return h + `<div class="veredicto bien" style="margin-top:12px">${ICO.check}<p><b>Día cumplido.</b> Los tres macros, dentro de tu objetivo.</p></div>`;
      const fuera = MAC.filter((m) => { const o = C.num(md[m]); return o > 0 ? t[m] < 0.9 * o || t[m] > 1.1 * o : t[m] > 2; });
      return h + `<div class="veredicto" style="margin-top:12px"><h3>A medias</h3> <p>${fuera.map((m) => `<span class="junto"><b>${NOMBRE[m]}:</b> ${F(t[m])} de ${F(md[m])} g</span>`).join(' · ')}</p></div>`;
    }
    const x = quedaHoy(), q = x.queda, e = C.estadoDia(md, C.sumaDia(cs));       // pasarse y «ya está» se miden con el margen de «clavado»
    const partes = e.sobra.map((k) => k === 'kcal' ? `${F(x.pasa.kcal)} kcal` : `${F(x.pasa[k])} g de ${DE[k]}`);
    const pasado = partes.length ? `<p>Te has pasado ${partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0]}.</p>` : '';
    const nada = e.hecho;
    return h + `<div class="veredicto${partes.length ? ' ojo' : ''}" style="margin-top:12px"><h3>${nada ? 'Hoy ya has llegado a todo' : 'Te queda para hoy'}</h3> ` +
      (nada ? '' : `<div class="fila-sub" style="font-size:14px;margin:0"><span class="m clave">${F(q.kcal)} kcal</span> ${MAC.map((m) => `<span class="m"><i class="punto ${m}"></i>${m.toUpperCase()} ${F(Math.round(q[m]))}</span>`).join(' ')}</div>`) + ` ${pasado}</div>`;
  }
  function pintaHoy() {
    const hoy = claveHoy(), k = claveVista(), esHoy = k === hoy, cs = comidasDe(k), t = C.sumaDia(cs), md = esHoy ? metaDia() : metaDe(k), f = C.fechaDe(k);
    if (esHoy && md && cs.length) ponMeta(hoy, md);
    $('#hoy-titulo').textContent = esHoy ? 'Hoy' : `${capital(SEMANA[f.getDay()])} ${f.getDate()}`;
    $('#hoy-fecha').innerHTML = `${esHoy ? `${SEMANA[f.getDay()]}, ${f.getDate()} de ${MESES[f.getMonth()]}` : MESES[f.getMonth()]} <small>▾</small>`;
    const sem = C.calendario(S.dias, S.metas, C.ultimosDias(hoy, 7), hoy, metaDia());
    $('#hoy-semana').innerHTML = sem.dias.map((d) => htmlDia(d, k, true)).join('');
    const frase = fraseSemana(sem.cuenta), st = $('#hoy-sem-txt'); st.hidden = !frase; st.innerHTML = frase;
    pintaAnillo(IDS_DIA, '#p-hoy', t, md, md ? Math.min(1, t.kcal / md.kcal) : 1);
    const dia = $('#d-dia'), demas = md && C.estadoDia(md, t).sobra.indexOf('kcal') >= 0 ? t.kcal - md.kcal : 0;
    dia.hidden = !(md && cs.length);
    if (md) dia.textContent = !esHoy ? `Ese día: ${F(t.kcal)} de tus ${F(md.kcal)} kcal.` : demas >= 1 ? `Llevas ${F(t.kcal)} kcal: ${F(demas)} más que tus ${F(md.kcal)} del día.` : `Llevas ${F(t.kcal)} de tus ${F(md.kcal)} kcal del día.`;
    $('#hoy-cuerpo').innerHTML = htmlHoy();
    pintaPie();
  }
  /** Los botones de abajo cambian con la pestaña y con lo que haya en el plato o en el día. */
  function pintaPie() {
    const otro = pestana === 'hoy' && claveVista() !== claveHoy();          // viendo otro día: el botón devuelve a hoy
    const c = !otro && pestana === 'hoy' && comidasHoy().length ? cuotaAhora() : null, b = $('#btn-cuadrar');
    $('#pie-plato').hidden = pestana !== 'plato';
    $('#btn-apuntar').hidden = !(pestana === 'plato' && S.plato.items.length > 0);
    $('#btn-apuntar').textContent = S.plato.cambia && S.plato.cambia.dia !== claveHoy() ? 'Guardar el cambio' : 'Apuntar en Hoy';
    b.hidden = !(c || otro); if (otro) b.textContent = 'Volver a hoy'; else if (c) b.textContent = 'Preparar ' + ARTICULO[c.nombre];
  }
  function abreApuntar() {
    if (!S.plato.items.length) return;
    const cam = S.plato.cambia, plan = metaDia() ? C.planComidas(S.meta.comidas) : [];
    const propuesta = cam ? cam.nombre : (S.plato.comida || (plan.length ? 'Entre horas' : C.comidaPorHora(horaAhora())));
    const nombres = C.COMIDAS.concat(plan.indexOf('Recena') >= 0 ? ['Recena'] : [], ['Entre horas']);
    const suelta = nombres.indexOf(propuesta) < 0;                        // un nombre propio que ya tenía la comida
    abre(h2('¿Qué comida es?'), `<p class="nota" style="margin:0 2px 12px">${resumenPlato(S.plato.items)}</p>
      <div class="chips">${nombres.map((n) => `<button class="chip" data-a="que-comida" data-v="${n}" aria-pressed="${n === propuesta}">${n}</button>`).join('')}</div>
      <div class="form" style="margin-top:14px">
        <label class="campo"><span>O ponle otro nombre</span><div><input type="text" class="largo" id="otra-comida" data-in="otra" maxlength="24" placeholder="Pre-entreno" autocomplete="off" value="${suelta ? esc(propuesta) : ''}"></div></label>
        <button class="btn" data-a="apuntar-ya">${cam && cam.dia !== claveHoy() ? 'Guardar en ' + elDiaDe(cam.dia) : 'Apuntar en Hoy'}</button>
      </div>`);
  }
  function abreComida(i) {
    const c = comidasDe(claveVista())[i]; if (!c) return;
    abre(`<div><h2 id="sheet-h">${esc(c.nombre)}</h2><p class="nota" style="margin:4px 0 0;padding:0">${esc(c.hora)} · ${lineaMacros(c.t)}</p></div>`,
      `<div>${c.items.map((it) => `<div class="de-comida"><span>${esc(it.n)}${it.e ? ` <i>${esc(it.e)}</i>` : ''}</span> <b>${F(it.gramos)} g</b></div>`).join('')}</div>
      <div class="btn-fila" style="margin-top:16px"><button class="btn suave peligro" data-a="borrar-comida" data-i="${i}">Borrarla</button><button class="btn suave" data-a="cambiar-comida" data-i="${i}">Cambiarla</button></div>`);
  }
  /* ── Pantalla: Mis macros ──────────────────────── */
  function htmlMetas() {
    const o = C.objetivos(perfilCore());
    if (o.error === 'menor') return `<div class="aviso">Estas fórmulas están hechas para adultos. Si tienes menos de 18 años, es mejor que te oriente un profesional.</div>`;
    if (o.error) return `<div class="aviso">Revisa la edad, el peso y la altura para que pueda calcular.</div>`;
    const ritmo = (r) => (r === 0 ? 'Para quedarte como estás' : `Unos ${F(Math.abs(r), 1)} kg ${r < 0 ? 'menos' : 'más'} por semana`);
    let h = `<div class="metas">` + Object.keys(METAS).map((k) => {
      const x = o[k];
      return `<button class="meta" data-a="meta" data-v="${k}" aria-pressed="${S.meta.tipo === k}"><span class="meta-ok">${ICO.check}</span>
        <span class="meta-cab"><span><span class="meta-nombre">${METAS[k]}</span><span class="meta-ritmo">${ritmo(x.ritmo)}</span></span><span class="meta-kcal">${F(x.kcal)}<small>kcal</small></span></span>
        <span class="meta-macros">${MAC.map((m) => `<span class="m"><i class="punto ${m}"></i>${NOMBRE[m]} <b>${F(x[m])} g</b></span>`).join('')}</span></button>`;
    }).join('') + `</div>`;
    if (o.avisos.indexOf('suelo') >= 0) h += `<div class="aviso">Con tus datos no conviene bajar más las calorías por tu cuenta: «Definir» se queda en el mínimo razonable.</div>`;
    if (o.avisos.indexOf('peso_ref') >= 0) h += `<div class="aviso">La proteína y la grasa están calculadas sobre un peso de referencia de ${F(o.pesoRef)} kg, no sobre tu peso de ahora.</div>`;
    h += `<p class="nota">En reposo gastas unas ${F(o.reposo)} kcal y, con tu actividad, unas ${F(o.gasto)} al día.</p>`;
    return h;
  }
  function htmlComidas() {
    const md = metaDia();
    const pc = md ? C.porComida(md, S.meta.comidas) : null, plan = C.planComidas(S.meta.comidas).map((x) => x.toLowerCase());
    const cuales = plan.slice(0, -1).join(', ') + ' y ' + plan[plan.length - 1];
    return `<div class="linea-dato"><span><b>${S.meta.comidas} comidas al día</b> <small>${cuales.charAt(0).toUpperCase() + cuales.slice(1)}. ${pc ? `Cada una: P ${F(pc.p)} · H ${F(pc.h)} · G ${F(pc.g)} · ${F(pc.kcal)} kcal` : 'Elige arriba lo que buscas y te las reparto.'}</small></span>
      <div class="peso"><button data-a="comidas" data-v="-1" aria-label="Una comida menos">${ICO.menos}</button><button data-a="comidas" data-v="1" aria-label="Una comida más">${ICO.mas}</button></div></div>`;
  }
  const COMO = `<details class="como"><summary>Cómo se calcula ${ICO.flecha}</summary><ul>
      <li><b>Gasto en reposo:</b> ecuación de Mifflin-St Jeor, la más fiable de las que comparó la revisión de <a href="https://pubmed.ncbi.nlm.nih.gov/15883556/">Frankenfield y otros (2005)</a>. Se multiplica por tu nivel de actividad.</li>
      <li><b>Definir:</b> un 20 % menos de calorías, para perder en torno al 0,5–1 % del peso por semana y conservar músculo (<a href="https://pubmed.ncbi.nlm.nih.gov/24864135/">Helms y otros, 2014</a>).</li>
      <li><b>Ganar músculo:</b> un 10 % más, en la parte baja del 10–20 % que recomiendan <a href="https://pubmed.ncbi.nlm.nih.gov/31247944/">Iraki y otros (2019)</a>, para no acumular grasa de más.</li>
      <li><b>Proteína:</b> 2,2 g por kilo al definir, 1,8 al mantener y 2 al ganar. Por encima de unos 1,6 g por kilo ya no se gana más músculo de media (<a href="https://pubmed.ncbi.nlm.nih.gov/28698222/">Morton y otros, 2018</a>); al definir se sube para proteger el músculo.</li>
      <li><b>Grasa:</b> de 0,8 a 1 g por kilo, siempre entre el 20 y el 35 % de las calorías. <b>Hidratos:</b> lo que queda.</li>
      <li>Es un punto de partida. Si en dos o tres semanas el peso no se mueve como esperabas, sube o baja las calorías entre un 5 y un 10 %.</li></ul></details>`;

  function pintaMacros() {
    const M = S.meta, p = S.perfil;
    ponModos('#modos-meta', M.modo === 'mano' ? 1 : 0);
    const el = $('#macros-cuerpo');
    if (M.modo === 'mano') {
      const campo = (m) => `<label class="campo-m" data-m="${m}"><span>${NOMBRE[m]}</span><div><input inputmode="numeric" pattern="[0-9]*" maxlength="3" data-in="mano" data-m="${m}" value="${M.mano[m] == null ? '' : M.mano[m]}" placeholder="0" aria-label="${NOMBRE[m]} al día, en gramos"><em>g</em></div></label>`;
      el.innerHTML = `<p class="nota" style="margin:16px 4px 10px">Pon los gramos al día que te haya dado tu entrenador o tu nutricionista.</p>
        <div class="obj-campos">${MAC.map(campo).join('')}</div><p class="subtitulo" id="mano-kcal"></p><div id="comidas">${htmlComidas()}</div><div id="fila-peso">${htmlFilaPeso()}</div>`;
      pintaManoKcal(); return;
    }
    const n = NIVELES[p.nivel - 1];
    const campo = (k, t, u, modo) => `<label class="campo"><span>${t}</span><div><input inputmode="${modo}" maxlength="5" data-in="perfil" data-k="${k}" value="${String(p[k]).replace('.', ',')}" aria-label="${t}"><em>${u}</em></div></label>`;
    el.innerHTML = `<div class="form">
        <div class="modos" id="modos-sexo" role="tablist" aria-label="Sexo"><button role="tab" data-a="sexo" data-v="h">Hombre</button><button role="tab" data-a="sexo" data-v="m">Mujer</button></div>
        <div class="form-3">${campo('edad', 'Edad', 'años', 'numeric')}${campo('peso', 'Peso', 'kg', 'decimal')}${campo('altura', 'Altura', 'cm', 'numeric')}</div>
        <div class="actividad"><b id="act-n">${n.n}</b><small id="act-d">${n.d}</small><input type="range" min="1" max="5" step="1" value="${p.nivel}" data-in="nivel" aria-label="Nivel de actividad"></div>
      </div>
      ${p.ejemplo ? `<p class="nota" id="nota-ej">Son datos de ejemplo: cámbialos por los tuyos.</p>` : ''}
      <h2 class="subtitulo">Elige lo que buscas</h2>
      <div id="metas">${htmlMetas()}</div><div id="comidas">${htmlComidas()}</div><div id="fila-peso">${htmlFilaPeso()}</div>${COMO}`;
    ponModos('#modos-sexo', p.sexo === 'm' ? 1 : 0);
  }
  function pintaManoKcal() { const md = metaDia(), el = $('#mano-kcal'); if (el) el.textContent = md ? `En total, ${F(md.kcal)} kcal al día` : 'Rellena los tres para empezar'; }
  function refrescaMetas() { const m = $('#metas'); if (m) m.innerHTML = htmlMetas(); const c = $('#comidas'); if (c) c.innerHTML = htmlComidas(); }

  /* ── El peso ───────────────────────────────────── */
  const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  /** «hoy», «ayer» o «17 nov» (con el año si no es este). */
  function diaCorto(k) {
    const hoy = claveHoy();
    if (k === hoy) return 'hoy';
    if (k === C.otroDia(hoy, -1)) return 'ayer';
    const f = C.fechaDe(k);
    return `${f.getDate()} ${MES3[f.getMonth()]}` + (k.slice(0, 4) !== hoy.slice(0, 4) ? ' ' + k.slice(0, 4) : '');
  }
  const elDia = (k) => { const d = diaCorto(k); return /^\d/.test(d) ? 'el ' + d : d; };       // «el 17 nov», «ayer», «hoy»
  const kilos = (v) => F(v, 1) + ' kg';
  const PESOS_VISTOS = 30;                               // la gráfica y el resumen miran los últimos pesos apuntados
  const fraseCambio = (c) => (c.kg === 0 ? `Igual que hace ${C.plazo(c.dias)}` : `${kilos(Math.abs(c.kg))} ${c.kg < 0 ? 'menos' : 'más'} en ${C.plazo(c.dias)}`);
  /** La fila de «Mis macros»: el último peso y cómo va; al tocarla se abre la hoja. */
  function htmlFilaPeso() {
    const ps = S.pesos, u = ps[ps.length - 1], c = C.cambioPeso(ps.slice(-PESOS_VISTOS));
    const sub = !u ? 'Apúntalo de vez en cuando y verás cómo va.' : c ? fraseCambio(c) : `Apuntado ${elDia(u.f)}`;
    return `<button class="linea-dato toca" data-a="peso"><span><b>${u ? `Mi peso: ${kilos(u.kg)}` : 'Mi peso'}</b> <small>${sub}</small></span><span class="pildora">${u && u.f === claveHoy() ? 'Ver' : 'Apuntar'}</span></button>`;
  }
  let trazo = [];                                        // los puntos de la gráfica abierta, para leerlos al tocarla
  const G_ANCHO = 340, G_ALTO = 104, G_AIRE = 24;        // la caja de la línea y el aire de arriba para los rótulos
  function htmlPeso() {
    const hoy = claveHoy(), ps = S.pesos, u = ps[ps.length - 1], vistos = ps.slice(-PESOS_VISTOS), c = C.cambioPeso(vistos);
    const propone = u ? u.kg : (S.perfil.ejemplo ? 0 : S.perfil.peso);
    let h = `<div class="kg-pon"><label class="kg-campo"><input id="kg-in" data-in="kg" inputmode="decimal" enterkeyhint="done" maxlength="5" value="${propone ? F(propone, 1) : ''}" placeholder="0,0" aria-label="Tu peso de hoy, en kilos"><em>kg</em></label>
      <button class="btn" data-a="peso-apuntar">${u && u.f === hoy ? 'Cambiar el peso de hoy' : 'Apuntar el peso de hoy'}</button></div>`;
    trazo = [];
    if (c) {
      trazo = C.trazoPeso(vistos, G_ANCHO, G_ALTO, 14, 2);              // la caja abarca 2 kg como poco
      const a = trazo[0], z = trazo[trazo.length - 1], muchos = trazo.length > 12;
      h += `<p class="kg-resumen" id="kg-resumen">${fraseCambio(c)}</p>
        <svg id="kg-grafica" viewBox="0 0 ${G_ANCHO} ${G_ALTO + G_AIRE}" role="img" aria-label="Tu peso: de ${kilos(a.kg)} ${elDia(a.f)} a ${kilos(z.kg)} ${elDia(z.f)}">
          <g transform="translate(0 ${G_AIRE})">
            <line class="kg-guia" id="kg-guia" x1="0" x2="0" y1="${-G_AIRE + 4}" y2="${G_ALTO}" hidden></line>
            <polyline class="kg-linea" points="${trazo.map((p) => p.x + ',' + p.y).join(' ')}"></polyline>
            ${trazo.map((p, i) => `<circle class="kg-pt${muchos && i < trazo.length - 1 ? ' chico' : ''}" cx="${p.x}" cy="${p.y}" r="${i === trazo.length - 1 ? 5 : muchos ? 2.5 : 4}"></circle>`).join('')}
            <circle class="kg-sel" id="kg-sel" r="6.5" hidden></circle>
            <text class="kg-rot" x="${a.x - 6}" y="${a.y - 11}">${F(a.kg, 1)}</text><text class="kg-rot fin" x="${z.x + 6}" y="${z.y - 12}" text-anchor="end">${F(z.kg, 1)}</text>
          </g></svg>
        <p class="kg-lectura" id="kg-lectura">${`De ${elDia(a.f)} a ${elDia(z.f)}`.replace('De el', 'Del').replace('a el', 'al')}</p>`;
    }
    if (ps.length) h += `<div class="kg-lista">` + ps.slice().reverse().map((x) =>
      `<div class="kg-fila"><span>${capital(diaCorto(x.f))}</span> <b>${kilos(x.kg)}</b> <button data-a="peso-quitar" data-f="${x.f}" aria-label="Borrar el peso de ${elDia(x.f)}">${ICO.x}</button></div>`).join('') + `</div>`;
    return h;
  }
  function abrePeso() { abre(h2('Mi peso'), `<div id="kg-cuerpo">${htmlPeso()}</div>`); }
  /** Tras apuntar o borrar un peso: la hoja (si sigue abierta) y la pantalla de detrás, que también lo enseña. */
  function pintaPeso() { const el = $('#kg-cuerpo'); if (el) el.innerHTML = htmlPeso(); if (pestana === 'macros') pintaMacros(); }
  /** Al tocar o pasar por la gráfica: marca el peso más cercano y lo dice debajo. */
  function leePeso(e) {
    const g = e.target.closest && e.target.closest('#kg-grafica'); if (!g || !trazo.length) return;
    const r = g.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * G_ANCHO;
    const p = trazo.reduce((m, q) => (Math.abs(q.x - x) < Math.abs(m.x - x) ? q : m), trazo[0]);
    const guia = $('#kg-guia'), sel = $('#kg-sel');
    guia.setAttribute('x1', p.x); guia.setAttribute('x2', p.x); guia.removeAttribute('hidden');
    sel.setAttribute('cx', p.x); sel.setAttribute('cy', p.y); sel.removeAttribute('hidden');
    $('#kg-lectura').innerHTML = `<b>${capital(diaCorto(p.f))}:</b> ${kilos(p.kg)}`;
  }
  document.addEventListener('pointerdown', leePeso);
  document.addEventListener('pointermove', leePeso);

  /* ── Navegación y aspecto ──────────────────────── */
  const TABS = ['plato', 'alimentos', 'hoy', 'macros'];
  let pestana = 'plato';
  function irA(t) {
    pestana = t;
    $$('.pantalla').forEach((p) => p.classList.toggle('activa', p.id === 'p-' + t));
    const nav = $('#tabs'); nav.dataset.pos = TABS.indexOf(t);
    $$('button', nav).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === t)));
    if (t === 'plato') pintaPlato(); else if (t === 'alimentos') pintaLista('biblio'); else if (t === 'hoy') pintaHoy(); else pintaMacros();
    pintaPie();
  }
  function aplicaAspecto() {
    const r = document.documentElement;
    let a = S.aspecto;
    if (a === 'auto') { const t = r.getAttribute('data-theme'); a = t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'oscuro' : 'claro'; }
    r.setAttribute('data-aspecto', a);
    const mt = $('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', getComputedStyle(r).getPropertyValue('--fondo').trim());
  }
  try {
    new MutationObserver(aplicaAspecto).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aplicaAspecto);
  } catch (e) { /* navegadores antiguos */ }

  /* ── Acciones (clics) ──────────────────────────── */
  let conPuntero = false;
  const ACC = {
    tab: (el) => { if (el.dataset.v === 'hoy') diaVisto = null; irA(el.dataset.v); },
    'ver-dia': (el) => { const k = el.dataset.k, hoy = claveHoy(); if (k > hoy) return; diaVisto = k === hoy ? null : k; cierra(); pintaHoy(); $('#p-hoy').scrollTop = 0; },
    mes: abreMes,
    peso: abrePeso,
    'peso-apuntar': () => {
      const el = $('#kg-in'), v = Math.round(C.num(el.value) * 10) / 10;
      if (!(v >= 30 && v <= 300)) { toast('Pon un peso entre 30 y 300 kg'); el.focus(); return; }
      S.pesos = C.ponPeso(S.pesos, claveHoy(), v); S.perfil.peso = v; guardar(); pintaPeso();
      toast(`Peso de hoy apuntado: ${kilos(v)}`);
    },
    'peso-quitar': (el) => {
      const previo = JSON.stringify({ pesos: S.pesos, peso: S.perfil.peso });
      S.pesos = C.quitaPeso(S.pesos, el.dataset.f);
      const u = S.pesos[S.pesos.length - 1]; if (u) S.perfil.peso = u.kg;        // el cálculo usa el último peso que queda
      guardar(); pintaPeso();
      toast('Peso borrado', 'Deshacer', () => { const x = JSON.parse(previo); S.pesos = x.pesos; S.perfil.peso = x.peso; guardar(); pintaPeso(); });
    },
    'mes-ir': (el) => { const v = el.dataset.v.split('-').map(Number); pintaMes(v[0], v[1]); },
    cerrar: cierra,
    toast: () => { const f = accionToast; accionToast = null; $('#toast').classList.remove('visto'); if (f) f(); },
    modo: (el) => {
      const P = S.plato; if (P.modo === el.dataset.v) return;
      P.modo = el.dataset.v; platoTocado = true; P.ejemplo = false;        // quien usa el ejemplo lo hace suyo: lo que añada se suma
      if (P.modo === 'macros') {
        const c = cuotaAhora();                                          // con plan, «macros» es la comida que toca
        if (c && !P.cambia && (!P.objetivo || P.comida == null)) { P.comida = c.nombre; P.objetivo = c.objetivo; P.auto = true; P.tam = 'normal'; }
        else if (!P.objetivo) P.objetivo = objetivoInicial();
      }
      guardar(); pintaPlato();
    },
    menos: (el) => { if (conPuntero) { conPuntero = false; return; } sumaGramos(+el.dataset.i, -1); },
    mas: (el) => { if (conPuntero) { conPuntero = false; return; } sumaGramos(+el.dataset.i, 1); },
    candado: (el) => {
      const i = +el.dataset.i, it = S.plato.items[i]; if (!it) return;
      it.modo = SOL && SOL.fij[i] != null ? 'libre' : 'fijo';
      tocado(); refrescaPlato();
    },
    anadir: abreElegir,
    alternar: (el) => {
      const id = el.dataset.id, i = enPlato(id);
      if (i >= 0) { S.plato.items.splice(i, 1); S.plato.ejemplo = false; guardar(); } else anade(id);
      const dentro = enPlato(id) >= 0;
      el.classList.toggle('puesto', dentro); el.innerHTML = dentro ? ICO.check : ICO.mas; el.setAttribute('aria-pressed', String(dentro));
    },
    'anadir-ficha': (el) => { anade(el.dataset.id); cierra(); if (pestana === 'plato') pintaPlato(); else pintaLista('biblio'); },
    sugerido: (el) => { anade(el.dataset.id, true, true); pintaPlato(); },
    quitar: (el) => { cierra(); quita(+el.dataset.i); if (pestana !== 'plato') pintaLista('biblio'); },
    ficha: (el) => {
      if (abierta) { const id = el.dataset.id; alCerrar = null; cierra(); setTimeout(() => abreFicha(id), 200); return; }
      abreFicha(el.dataset.id, el.dataset.i == null ? null : +el.dataset.i);
    },
    fav: (el) => {
      const id = el.dataset.id, i = S.favs.indexOf(id);
      if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
      el.setAttribute('aria-pressed', String(i < 0));
      if (!S.favs.length && FIL.biblio.cat === 'fav') FIL.biblio.cat = null;
      guardar(); pintaBiblio();
    },
    cat: (el) => {
      const k = el.dataset.k, v = el.dataset.v;
      FIL[k].cat = String(FIL[k].cat) === v ? null : v;
      $$(`#cinta-${k} .chip`).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === String(FIL[k].cat))));
      pintaLista(k);
    },
    vaciar: () => {
      const previo = JSON.stringify(S.plato);
      nuevoPlato(); guardar(); cierra(); pintaPlato();
      toast('Plato vacío', 'Deshacer', () => { S.plato = JSON.parse(previo); platoTocado = true; guardar(); pintaPlato(); });
    },
    /* El tamaño de esta comida: vuelve a lo que toca según el plan, en la medida elegida. */
    tam: (el) => { const P = S.plato, c = cuotaAhora(el.dataset.v); if (!c) return; P.modo = 'macros'; P.comida = c.nombre; P.tam = el.dataset.v; P.objetivo = c.objetivo; P.auto = true; platoTocado = true; guardar(); pintaPlato(); },
    'obj-toca': () => ACC.tam({ dataset: { v: 'normal' } }),
    'entre-horas': () => { const P = S.plato; P.modo = 'gramos'; P.comida = null; P.auto = false; platoTocado = true; guardar(); pintaPlato(); },
    'ver-ejemplo': () => { S.plato = { items: EJEMPLO.map((x) => ({ id: x.id, gramos: x.gramos })), modo: 'gramos', objetivo: null, ejemplo: true, comida: null }; platoTocado = true; guardar(); pintaPlato(); },
    'ir-macros': () => irA('macros'),
    aceptar: (el) => { const P = S.plato; P.objetivo = Object.assign({}, P.objetivo, { [el.dataset.m]: C.num(el.dataset.v) }); P.auto = false; platoTocado = true; guardar(); pintaPlato(); },
    cuadrar: () => { if (claveVista() !== claveHoy()) { diaVisto = null; pintaHoy(); $('#p-hoy').scrollTop = 0; } else irA('plato'); },   // «Volver a hoy» o «Preparar la cena»
    apuntar: abreApuntar,
    'que-comida': (el) => { $$('#sheet [data-a="que-comida"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); $('#otra-comida').value = ''; },
    'apuntar-ya': () => {
      const elegida = $('#sheet [data-a="que-comida"][aria-pressed="true"]');
      const nombre = ($('#otra-comida').value || '').trim() || (elegida ? elegida.dataset.v : 'Comida');
      const previo = JSON.stringify({ plato: S.plato, dias: S.dias }), cam = S.plato.cambia, k = cam ? cam.dia : claveHoy();   // una comida que se estaba cambiando vuelve a su día
      const c = C.apuntar(nombre, new Date(), filas().map((x) => ({ a: x.a, gramos: x.it.gramos })));
      const lista = S.dias[k] || (S.dias[k] = []);
      if (cam) { c.hora = cam.hora; lista.splice(Math.min(cam.pos, lista.length), 0, c); } else lista.push(c);
      if (k === claveHoy() && metaDia()) ponMeta(k, metaDia());
      nuevoPlato(); guardar(); cierra(); pintaPlato();
      toast(cam && k !== claveHoy() ? `Guardada en ${elDiaDe(k)}: ${nombre}` : `Apuntado en Hoy: ${nombre}`, 'Deshacer', () => { const x = JSON.parse(previo); S.plato = x.plato; S.dias = x.dias; platoTocado = true; guardar(); irA('plato'); });
    },
    'ver-comida': (el) => abreComida(+el.dataset.i),
    'borrar-comida': (el) => {
      const k = claveVista(), i = +el.dataset.i, previo = JSON.stringify(S.dias), c = (S.dias[k] || [])[i]; if (!c) return;
      S.dias[k].splice(i, 1); guardar(); cierra(); pintaHoy();
      toast(`${c.nombre}, borrada${k === claveHoy() ? ' de hoy' : ''}`, 'Deshacer', () => { S.dias = JSON.parse(previo); guardar(); pintaHoy(); });
    },
    'cambiar-comida': (el) => {
      const k = claveVista(), i = +el.dataset.i, c = (S.dias[k] || [])[i]; if (!c) return;
      const previo = JSON.stringify({ plato: S.plato, dias: S.dias });
      S.plato = { items: c.items.filter((it) => porId.has(it.id)).map((it) => ({ id: it.id, gramos: it.gramos })), modo: 'gramos', objetivo: null, ejemplo: false, comida: null,
        cambia: { nombre: c.nombre, hora: c.hora, pos: i, dia: k, antes: c } };
      platoTocado = true;
      S.dias[k].splice(i, 1); guardar(); cierra(); irA('plato');
      toast('Cámbiala y vuelve a apuntarla', 'Deshacer', () => { const x = JSON.parse(previo); S.plato = x.plato; S.dias = x.dias; platoTocado = true; guardar(); irA('hoy'); });
    },
    'cambio-fuera': () => {                                               // la comida que se estaba cambiando vuelve a su día tal como estaba
      const cam = S.plato.cambia; if (!cam || !cam.antes) return;
      const lista = S.dias[cam.dia] || (S.dias[cam.dia] = []);
      lista.splice(Math.min(cam.pos, lista.length), 0, cam.antes);
      nuevoPlato(); guardar();
      diaVisto = cam.dia === claveHoy() ? null : cam.dia; irA('hoy');
      toast(`${cam.nombre}: queda como estaba`);
    },
    aspecto: abreAspecto,
    'pon-aspecto': (el) => { S.aspecto = el.dataset.v; guardar(); aplicaAspecto(); $$('.aspecto').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === S.aspecto))); },
    platos: abrePlatos,
    'guardar-plato': () => {
      const nombre = ($('#nombre-plato').value || '').trim() || 'Plato ' + (S.platos.length + 1);
      S.platos.unshift({ nombre, items: S.plato.items.map((it) => ({ id: it.id, gramos: it.gramos })) });
      S.plato.ejemplo = false; guardar(); cierra(); pintaPlato(); toast(`«${nombre}» guardado`);
    },
    'cargar-plato': (el) => {
      const p = S.platos[+el.dataset.i]; if (!p) return;
      const previo = JSON.stringify(S.plato);
      S.plato.items = p.items.filter((it) => porId.has(it.id)).map((it) => ({ id: it.id, gramos: it.gramos })); S.plato.ejemplo = false; delete S.plato.cambia;
      S.plato.modo = 'gramos'; platoTocado = true;                         // un plato guardado trae sus gramos: se respetan
      guardar(); cierra(); pintaPlato();
      toast(`«${p.nombre}» en el plato`, 'Deshacer', () => { S.plato = JSON.parse(previo); platoTocado = true; guardar(); pintaPlato(); });
    },
    'borrar-plato': (el) => { S.platos.splice(+el.dataset.i, 1); guardar(); abrePlatos(); },
    datos: abreDatos,
    nuevo: (el) => {
      const q = el.dataset.k ? FIL[el.dataset.k].q.trim() : '';          // desde «No lo encuentro»: se propone lo que buscaba
      if (abierta) { alCerrar = null; cierra(); setTimeout(() => abreNuevo(q), 220); } else abreNuevo(q);
    },
    'guardar-nuevo': () => {
      const val = (id) => { const t = $('#' + id).value.trim(); return t === '' ? null : C.num(t); };
      const nombre = $('#n-nombre').value.trim(), p = val('n-p'), h = val('n-h'), g = val('n-g'), f = val('n-f') || 0, err = $('#n-error');
      const fallo = !nombre ? 'Ponle un nombre.' : (p == null || h == null || g == null) ? 'Faltan proteína, hidratos o grasa. Si no lleva, pon 0.' : (p + h + g + f > 100.5) ? 'Los gramos suman más de 100: revisa que sean por 100 g.' : '';
      if (fallo) { err.hidden = false; err.textContent = fallo; return; }
      const a = { id: 'P' + Date.now(), n: nombre, e: '', c: CAT_MIOS, em: '', s: '', k: val('n-k') || Math.round(4 * p + 4 * h + 9 * g + 2 * f), p, h, g, f, az: null, sa: null, src: 'P', sid: '', o: '', r: Math.max(1, Math.round(val('n-r') || 100)) };
      S.propios.push(a); indexar(); guardar(); cierra(); pintaBiblio(); toast(`${nombre}, guardado en «Míos»`);
    },
    'borrar-propio': (el) => { S.propios = S.propios.filter((a) => a.id !== el.dataset.id); S.favs = S.favs.filter((id) => id !== el.dataset.id); indexar(); if (!S.propios.length && String(FIL.biblio.cat) === String(CAT_MIOS)) FIL.biblio.cat = null; guardar(); cierra(); pintaBiblio(); if (pestana === 'plato') pintaPlato(); },
    'meta-modo': (el) => { S.meta.modo = el.dataset.v; guardar(); pintaMacros(); },
    sexo: (el) => { S.perfil.sexo = el.dataset.v; S.perfil.ejemplo = false; guardar(); ponModos('#modos-sexo', el.dataset.v === 'm' ? 1 : 0); refrescaMetas(); const n = $('#nota-ej'); if (n) n.remove(); },
    meta: (el) => { S.meta.tipo = S.meta.tipo === el.dataset.v ? null : el.dataset.v; guardar(); refrescaMetas(); if (S.meta.tipo) toast(`Tu objetivo: ${METAS[S.meta.tipo].toLowerCase()}`); },
    comidas: (el) => { S.meta.comidas = Math.max(2, Math.min(6, S.meta.comidas + (+el.dataset.v))); guardar(); $('#comidas').innerHTML = htmlComidas(); }
  };
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-a]'); if (el && ACC[el.dataset.a]) ACC[el.dataset.a](el, e); });

  /* Mantener pulsado − o + va sumando solo */
  let tRep = 0, iRep = 0;
  const paraRep = () => { clearTimeout(tRep); clearInterval(iRep); };
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-a="mas"],[data-a="menos"]'); if (!el) return;
    const i = +el.dataset.i, s = el.dataset.a === 'mas' ? 1 : -1;
    conPuntero = true; sumaGramos(i, s); paraRep();
    tRep = setTimeout(() => { iRep = setInterval(() => sumaGramos(i, s), 70); }, 420);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => document.addEventListener(ev, paraRep, true));

  /* ── Escritura en campos ───────────────────────── */
  const ENT = {
    gramos: (el) => {
      const i = +el.dataset.i, it = S.plato.items[i]; if (!it) return;
      el.value = el.value.replace(/\D/g, '');
      it.gramos = Math.min(5000, C.num(el.value));
      if (S.plato.modo === 'macros') it.modo = 'fijo';
      tocado(); refrescaPlato();
    },
    obj: (el) => {
      const P = S.plato; el.value = el.value.replace(/\D/g, '');
      P.objetivo = Object.assign({}, P.objetivo, { [el.dataset.m]: C.num(el.value) }); platoTocado = true;
      if (P.auto) { P.auto = false; $('#obj-rotulo').innerHTML = htmlRotulo(); $('#obj-chips').innerHTML = htmlAtajos(); }
      guardar(); refrescaPlato();
    },
    q: (el) => { FIL[el.dataset.k].q = el.value; pintaLista(el.dataset.k); },
    otra: (el) => { if (el.value.trim()) $$('#sheet [data-a="que-comida"]').forEach((b) => b.setAttribute('aria-pressed', 'false')); },
    orden: (el) => { FIL[el.dataset.k].orden = el.value; pintaLista(el.dataset.k); },
    perfil: (el) => {
      S.perfil[el.dataset.k] = C.num(el.value); S.perfil.ejemplo = false;
      if (el.dataset.k === 'peso') { S.pesos = C.ponPeso(S.pesos, claveHoy(), S.perfil.peso); $('#fila-peso').innerHTML = htmlFilaPeso(); }   // el peso es uno: también queda apuntado hoy
      guardar(); refrescaMetas(); const n = $('#nota-ej'); if (n) n.remove();
    },
    nivel: (el) => { S.perfil.nivel = +el.value; S.perfil.ejemplo = false; const n = NIVELES[S.perfil.nivel - 1]; $('#act-n').textContent = n.n; $('#act-d').textContent = n.d; guardar(); refrescaMetas(); const x = $('#nota-ej'); if (x) x.remove(); },
    mano: (el) => { el.value = el.value.replace(/\D/g, ''); S.meta.mano[el.dataset.m] = el.value === '' ? null : C.num(el.value); guardar(); pintaManoKcal(); $('#comidas').innerHTML = htmlComidas(); }
  };
  const alEscribir = (e) => { const k = e.target.dataset && e.target.dataset.in; if (k && ENT[k]) ENT[k](e.target); };
  document.addEventListener('input', alEscribir);
  document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') alEscribir(e); });
  document.addEventListener('focusin', (e) => { if (e.target.tagName === 'INPUT' && e.target.dataset.in && e.target.type !== 'range' && e.target.type !== 'search') e.target.select(); });
  document.addEventListener('focusout', (e) => {
    const el = e.target; if (!el.dataset || el.dataset.in !== 'gramos') return;
    const it = S.plato.items[+el.dataset.i]; if (it) el.value = it.gramos;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cierra();
    if (e.key === 'Enter' && e.target.id === 'kg-in') { ACC['peso-apuntar'](); return; }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur();
  });

  /* Con el teclado del móvil abierto, las hojas suben lo que ocupa: si no, el campo en el que se escribe queda tapado.
     (El teclado encoge la parte visible de la pantalla, no la página: se mide con visualViewport.) */
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const teclado = () => {
      const t = vv.scale > 1.01 ? 0 : Math.round(window.innerHeight - vv.height - vv.offsetTop);   // con la pantalla ampliada no se mide
      document.documentElement.style.setProperty('--teclado', (t > 80 ? t : 0) + 'px');      // menos de 80 px no es un teclado (barras del navegador)
    };
    vv.addEventListener('resize', teclado); vv.addEventListener('scroll', teclado);
  }

  /* El marco de la app nunca se desplaza (el foco en un campo oculto no debe mover la pantalla) */
  const marco = $('#app');
  marco.addEventListener('scroll', () => { if (marco.scrollTop) marco.scrollTop = 0; });
  window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (tGuardar) guardaYa(); return; }
    if (!S.plato.items.length) platoTocado = false;
    if (pestana === 'plato') pintaPlato(); else if (pestana === 'hoy') pintaHoy();
  });

  /* ── Arranque ──────────────────────────────────── */
  if ((S.v || 1) < 2) {                           // guardado por la versión anterior, que abría en «pongo los gramos»
    S.v = 2;
    const P = S.plato;
    if (!P.cambia) {                              // un plato propio a medias no se pierde ni se recalcula: pasa a «Mis platos»
      if (P.items.length && !P.ejemplo) S.platos.unshift({ nombre: 'Lo que tenías en el plato', items: P.items.map((it) => ({ id: it.id, gramos: it.gramos })) });
      nuevoPlato();
    }
    guardar();
  }
  aplicaAspecto();
  pintaBiblio();
  irA('plato');
})();
