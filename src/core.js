/* Macros · cálculos puros (sin pantalla). Se prueba con: node --test test/core.test.js */
(function (root) {
  'use strict';

  var MACROS = ['p', 'h', 'g'];
  var KCAL = { p: 4, h: 4, g: 9 };           // kcal por gramo (factores del etiquetado europeo)

  /** Número positivo o 0. Acepta coma decimal. */
  function num(x) {
    var n = typeof x === 'string' ? parseFloat(x.replace(',', '.')) : Number(x);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Macros de `gramos` de un alimento con valores por 100 g {k,p,h,g,f}. */
  function macros(a, gramos) {
    var q = num(gramos) / 100;
    return { kcal: a.k * q, p: a.p * q, h: a.h * q, g: a.g * q, f: (a.f || 0) * q };
  }

  /** Suma de un plato: items [{a, gramos}]. */
  function totales(items) {
    var t = { kcal: 0, p: 0, h: 0, g: 0, f: 0 };
    items.forEach(function (it) {
      var m = macros(it.a, it.gramos);
      t.kcal += m.kcal; t.p += m.p; t.h += m.h; t.g += m.g; t.f += m.f;
    });
    return t;
  }

  /** Parte de las kcal que aporta cada macro (suma 1; todo 0 si el plato está vacío). */
  function reparto(t) {
    var kp = KCAL.p * num(t.p), kh = KCAL.h * num(t.h), kg = KCAL.g * num(t.g), s = kp + kh + kg;
    return s > 0 ? { p: kp / s, h: kh / s, g: kg / s } : { p: 0, h: 0, g: 0 };
  }

  /** Margen de «clavado»: 2 g o el 5 % de lo pedido. */
  function margen(pide) { return Math.max(2, 0.05 * pide); }
  /** ¿Lo que está fijado ya da (o pasa) lo pedido de un macro? Entonces ese macro deja de ser un tope para lo demás. */
  function cubierto(pide, fijo) { return fijo > 0 && pide - fijo <= margen(pide); }

  /** Redondeo de cocina: de 5 en 5 g; por debajo de 20 g, al gramo. */
  function redondear(g) { return g < 20 ? Math.round(g) : Math.round(g / 5) * 5; }

  /**
   * Calculadora inversa: gramos de cada alimento para acercarse a un objetivo {p,h,g}.
   * items: [{a: alimento por 100 g (con a.r = ración habitual en g), fijo?: gramos bloqueados}]
   * Mínimos cuadrados con cantidades entre 0 y `maxMult` raciones. Un término pequeño (`lambda`, por cada
   * 100 g de más o de menos) mantiene cada alimento cerca de su ración habitual cuando moverlo apenas
   * cambia los macros: así no «arregla» 1 g de grasa con medio kilo de verdura.
   * Pasarse de un macro cuenta `exceso` veces más que quedarse corto: nunca pone más de lo pedido de uno
   * para arañar otro (un huevo solo no se va a 265 g por la proteína). Lo que falte, se dice.
   * La excepción: un macro que lo fijado ya cubre o pasa (un candado en 250 g de pollo) ya no se puede respetar,
   * así que deja de ser un tope y pesa `perdido` (menos que los demás): si no, la patata se quedaría a cero por
   * su gramo de proteína, o los hidratos cortos por no sumar más a una proteína que ya está pasada.
   */
  function resolver(opts) {
    var objetivo = opts.objetivo || {}, items = opts.items || [];
    var lambda = opts.lambda == null ? 10 : opts.lambda, maxMult = opts.maxMult || 5, exceso = opts.exceso || 400;
    var n = items.length, gramos = new Array(n).fill(0), tope = new Array(n).fill(false);
    var base = MACROS.map(function (m) { return num(objetivo[m]); });  // lo que queda por cubrir tras lo fijado
    var libres = [];
    items.forEach(function (it, j) {
      if (it.fijo != null && it.fijo !== '') {
        gramos[j] = num(it.fijo);
        MACROS.forEach(function (m, i) { base[i] -= it.a[m] * gramos[j] / 100; });
      } else libres.push(j);
    });
    var perdido = opts.perdido == null ? 0.25 : opts.perdido;
    var peso = MACROS.map(function (m, i) { var pide = num(objetivo[m]); return cubierto(pide, pide - base[i]) ? perdido : exceso; });
    var r = {};                                                          // ración habitual, en unidades de 100 g
    libres.forEach(function (j) { r[j] = Math.max(5, num(items[j].racion) || num(items[j].a.r) || 100) / 100; });

    /**
     * La mejor cantidad de un alimento con los demás quietos. a: sus macros por 100 g; c: lo que quedaría por cubrir de cada
     * macro sin él. El coste es cuadrático a trozos (pasarse pesa `exceso`): se busca el tramo donde cae su mínimo.
     */
    function mejor(a, c, ri) {
      var cortes = [];                                                   // cantidades a partir de las cuales se pasa de cada macro
      for (var m = 0; m < 3; m++) if (a[m] > 0) cortes.push(c[m] / a[m]);
      cortes.sort(function (p, q) { return p - q; });
      var desde = -Infinity;
      for (var k = 0; k <= cortes.length; k++) {
        var hasta = k < cortes.length ? cortes[k] : Infinity, medio = k === 0 ? hasta - 1 : (k === cortes.length ? desde + 1 : (desde + hasta) / 2);
        var den = lambda, sup = lambda * ri;
        for (m = 0; m < 3; m++) { var w = c[m] - a[m] * medio < 0 ? peso[m] : 1; den += w * a[m] * a[m]; sup += w * a[m] * c[m]; }
        var x = sup / den;
        if (x <= hasta) return Math.max(x, desde);
        desde = hasta;
      }
      return desde;
    }

    function ajustar(activos) {                                          // descenso por coordenadas (problema convexo con cotas)
      var A = activos.map(function (j) { return MACROS.map(function (m) { return items[j].a[m] || 0; }); });
      var x = activos.map(function (j) { return r[j]; }), res = base.slice(), i, m;
      for (i = 0; i < x.length; i++) for (m = 0; m < 3; m++) res[m] -= A[i][m] * x[i];
      for (var vuelta = 0; vuelta < 6000; vuelta++) {
        var cambio = 0;
        for (i = 0; i < x.length; i++) {
          var a = A[i], ri = r[activos[i]];
          var nx = Math.min(ri * maxMult, Math.max(0, mejor(a, [res[0] + a[0] * x[i], res[1] + a[1] * x[i], res[2] + a[2] * x[i]], ri))), d = nx - x[i];
          if (d !== 0) { for (m = 0; m < 3; m++) res[m] -= a[m] * d; x[i] = nx; cambio = Math.max(cambio, Math.abs(d)); }
        }
        if (cambio < 1e-9) break;
      }
      return x;
    }

    var activos = libres.slice(), x = ajustar(activos);
    var utiles = activos.filter(function (j, i) { return x[i] >= 0.1 * r[j]; });   // menos de una décima de ración: fuera
    if (utiles.length < activos.length) { activos = utiles; x = ajustar(activos); }
    activos.forEach(function (j, i) { gramos[j] = redondear(x[i] * 100); tope[j] = x[i] >= r[j] * maxMult - 1e-6; });

    var t = totales(items.map(function (it, j) { return { a: it.a, gramos: gramos[j] }; }));
    var logrado = { p: t.p, h: t.h, g: t.g, kcal: t.kcal, f: t.f }, desvio = {}, cuadra = n > 0;
    MACROS.forEach(function (m) {
      var obj = num(objetivo[m]);
      desvio[m] = logrado[m] - obj;
      if (Math.abs(desvio[m]) > margen(obj)) cuadra = false;
    });
    return { gramos: gramos, tope: tope, logrado: logrado, desvio: desvio, cuadra: cuadra };
  }

  /** Acompañamiento: alimento poco denso (ningún macro llega a 8 g por 100 g): verdura, ensalada, leche, yogur… */
  function esAcompanamiento(a) { return Math.max(a.p || 0, a.h || 0, a.g || 0) < 8; }

  /**
   * Qué cantidades se dan por fijas al calcular «macros → gramos». items: [{a, gramos, modo?}]
   * modo 'fijo' o 'libre' es el candado que pone la persona. Sin candado, los acompañamientos se quedan
   * como están (nadie cuadra la proteína a base de brócoli ni un desayuno con un litro de café con leche),
   * también cuando son lo único del plato: es lo normal mientras se va montando una comida.
   * Devuelve, por alimento, los gramos fijados o null si se puede ajustar.
   */
  function fijados(items) {
    return items.map(function (it) {
      if (it.modo === 'fijo') return num(it.gramos);
      if (it.modo === 'libre') return null;
      return esAcompanamiento(it.a) ? num(it.gramos) : null;
    });
  }

  /** Índice del alimento que más aporta de un macro ('p','h','g'); −1 si no hay. */
  function masAporta(macro, items) {
    var mejor = -1, max = 0;
    items.forEach(function (it, j) { var v = it.a[macro] * num(it.gramos); if (v > max) { max = v; mejor = j; } });
    return mejor;
  }

  var CANDIDATOS = {
    g: [['Aceite de oliva', ''], ['Aguacate', ''], ['Almendras', ''], ['Nueces', '']],
    p: [['Clara de huevo', 'cruda'], ['Pechuga de pollo', 'asada o plancha'], ['Atún al natural (lata, escurrido)', ''], ['Queso fresco batido 0 %', ''], ['Proteína de suero (whey) en polvo', '']],
    h: [['Arroz blanco', 'cocido'], ['Pan blanco (barra)', ''], ['Patata', 'cocida'], ['Plátano', ''], ['Copos de avena', '']]
  };

  /** Qué añadir cuando falta un macro: hasta `max` alimentos «puros» de ese macro que no estén ya en el plato. */
  function sugerir(desvio, catalogo, enPlato, max) {
    var macro = null, falta = 3;                                        // por debajo de 3 g no se propone nada
    MACROS.forEach(function (m) { if (-desvio[m] > falta) { falta = -desvio[m]; macro = m; } });
    if (!macro) return [];
    var out = [];
    CANDIDATOS[macro].some(function (c) {
      var a = catalogo.find(function (x) { return x.n === c[0] && (x.e || '') === c[1]; });
      if (a && enPlato.indexOf(a.id) < 0 && a[macro] > 0) out.push({ id: a.id, macro: macro, gramos: redondear(falta / a[macro] * 100) });
      return out.length >= (max || 3);
    });
    return out;
  }

  /**
   * Qué decir del resultado de «macros → gramos»: compara lo que se pide con lo que sale del plato.
   * objetivo {p,h,g}; items [{a, gramos, fijo, quieto}] ya con los gramos calculados (fijo: candado puesto por la persona;
   * quieto: acompañamiento que no se mueve de serie); sol es lo que devuelve `resolver`.
   * Devuelve { estado: 'vacio' | 'clavado' | 'casi' | 'falta' | 'no', lineas, enormes, todoFijo }.
   *   'falta': solo falta (nada sobra, nada al tope, sin candados de por medio): aún hay que añadir alimentos.
   *   lineas: un renglón por macro que no cuadra → { m, pide, sale, tipo: 'falta' | 'sobra', causa }
   *   causa:  null · {tipo:'sin'} (nada en el plato lleva ese macro) · {tipo:'tope', j, gramos} (ya va una cantidad enorme)
   *           · {tipo:'fijo', j, gramos, aporta} (lo fija un candado) · {tipo:'trae', j, aporta, solo} (el alimento que más trae;
   *           `solo` si él solo ya llega a lo pedido) · {tipo:'limita', j, m2, hasta} (falta porque con más de ese alimento
   *           te pasarías del macro m2; para llegar con él, m2 tendría que subir hasta `hasta` gramos)
   *   enormes: alimentos que han llegado al tope de cantidad. Con alguno al tope nunca es «casi».
   * «Clavado»: cada macro a 2 g (o al 5 %). «Casi»: lo que falla, a 3 g (o al 10 %).
   */
  function veredicto(objetivo, items, sol) {
    items = items || [];
    if (!items.length) return { estado: 'vacio', lineas: [], enormes: [], todoFijo: false };
    var lineas = [], casi = true, enormes = [];
    (sol.tope || []).forEach(function (t, j) { if (t) enormes.push(j); });
    var lleva = function (it, m) { return (it.a[m] || 0) >= 1; };          // menos de 1 g por 100 g no cuenta
    /* ¿Falta de `m` porque subir el alimento que lo lleva haría pasarse de otro macro? Solo cuenta un alimento libre cuyo
       macro principal sea ese y que pudiera cubrirlo sin llegar a una cantidad enorme; entre varios, el que menos se pasa. */
    var fijoDe = {};
    MACROS.forEach(function (m) { fijoDe[m] = 0; items.forEach(function (it) { if (it.fijo || it.quieto) fijoDe[m] += (it.a[m] || 0) * num(it.gramos) / 100; }); });
    var limita = function (m, falta) {
      var mejor = null;
      items.forEach(function (it, j) {
        var a = it.a, am = a[m] || 0;
        if (it.fijo || it.quieto || (sol.tope || [])[j]) return;
        if (am <= 0 || am < Math.max(a.p || 0, a.h || 0, a.g || 0)) return;
        var extra = falta / am * 100;
        if (num(it.gramos) + extra > 5 * Math.max(5, num(a.r) || 100)) return;
        var coste = 0, m2 = null, max = 0, hasta = 0;
        MACROS.forEach(function (o) {
          if (o === m) return;
          var pide = num(objetivo[o]), nuevo = sol.logrado[o] + extra * (a[o] || 0) / 100, pasa = (nuevo - pide) * KCAL[o];
          if (!(a[o] > 0) || nuevo - pide <= margen(pide) || cubierto(pide, fijoDe[o])) return;   // lo ya cubierto por lo fijado no frena
          coste += pasa;
          if (pasa > max) { max = pasa; m2 = o; hasta = nuevo; }
        });
        if (m2 && (!mejor || coste < mejor.coste)) mejor = { coste: coste, causa: { tipo: 'limita', j: j, m2: m2, hasta: hasta } };
      });
      return mejor && mejor.causa;
    };
    MACROS.forEach(function (m) {
      var pide = num(objetivo[m]), d = sol.desvio[m];
      if (Math.abs(d) <= margen(pide)) return;
      if (Math.abs(d) > Math.max(3, 0.1 * pide)) casi = false;
      var tipo = d < 0 ? 'falta' : 'sobra', causa = null, j = masAporta(m, items);
      if (tipo === 'falta') {
        if (!items.some(function (it) { return lleva(it, m); })) causa = { tipo: 'sin' };
        else if (!(causa = limita(m, -d))) {
          var alTope = -1, max = 0;
          enormes.forEach(function (k) { var v = (items[k].a[m] || 0) * num(items[k].gramos); if (lleva(items[k], m) && v > max) { max = v; alTope = k; } });
          if (alTope >= 0) causa = { tipo: 'tope', j: alTope, gramos: num(items[alTope].gramos) };
          else if (items.every(function (it) { return it.fijo || !lleva(it, m); })) causa = { tipo: 'fijo', j: j, gramos: num(items[j].gramos), aporta: items[j].a[m] * num(items[j].gramos) / 100 };
        }
      } else if (j >= 0) {
        var aporta = items[j].a[m] * num(items[j].gramos) / 100;
        causa = items[j].fijo ? { tipo: 'fijo', j: j, gramos: num(items[j].gramos), aporta: aporta } : { tipo: 'trae', j: j, aporta: aporta, solo: aporta >= pide };
      }
      lineas.push({ m: m, pide: pide, sale: sol.logrado[m], tipo: tipo, causa: causa });
    });
    var todoFijo = items.every(function (it) { return it.fijo || it.quieto; }) && items.some(function (it) { return it.fijo; });
    var soloFalta = !todoFijo && lineas.every(function (l) { return l.tipo === 'falta' && (!l.causa || l.causa.tipo === 'sin' || l.causa.tipo === 'limita'); });
    var estado = !lineas.length ? 'clavado' : enormes.length ? 'no' : casi ? 'casi' : soloFalta ? 'falta' : 'no';
    return { estado: estado, lineas: lineas, enormes: enormes, todoFijo: todoFijo };
  }

  /* ── Hoy: las comidas apuntadas en el día ───────────────────────── */
  var COMIDAS = ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena'];
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  /** La fecha local como AAAA-MM-DD: la clave con la que se guarda cada día. */
  function claveDia(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  /** Nombre de comida que se propone según la hora (con decimales: 14.5 = 14:30). */
  function comidaPorHora(h) {
    if (h >= 5 && h < 11) return COMIDAS[0];
    if (h >= 11 && h < 13) return COMIDAS[1];
    if (h >= 13 && h < 16.5) return COMIDAS[2];
    if (h >= 16.5 && h < 20) return COMIDAS[3];
    return COMIDAS[4];
  }
  /* El plan del día: qué comidas se hacen según cuántas son, y a qué hora deja de «tocar» cada una. */
  var PLANES = { 2: [2, 4], 3: [0, 2, 4], 4: [0, 2, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };
  var NOMBRES_PLAN = COMIDAS.concat(['Recena']);
  var HASTA = { 'Desayuno': 12, 'Media mañana': 13.5, 'Comida': 17, 'Merienda': 20.5, 'Cena': 23.5, 'Recena': 24 };
  /** Las comidas del día, en orden, según cuántas se hacen (de 2 a 6). */
  function planComidas(n) {
    n = Math.max(2, Math.min(6, Math.round(num(n)) || 4));
    return PLANES[n].map(function (i) { return NOMBRES_PLAN[i]; });
  }
  /**
   * Qué comida toca ahora: la primera del plan que no está apuntada y cuya hora no ha pasado
   * (la última del plan vale hasta que acaba el día). `apuntadas`: nombres de lo ya apuntado hoy.
   * Devuelve { nombre, quedan } (cuántas comidas del plan faltan, contando esa) o null si no queda ninguna.
   */
  function comidaQueToca(n, apuntadas, hora) {
    var plan = planComidas(n), hechas = apuntadas || [];
    var pendientes = plan.filter(function (c, i) { return hechas.indexOf(c) < 0 && (i === plan.length - 1 || HASTA[c] > hora); });
    return pendientes.length ? { nombre: pendientes[0], quedan: pendientes.length } : null;
  }
  /**
   * Lo que toca en una comida: lo que queda del día repartido entre las comidas que faltan, según el tamaño que elige
   * quien come: 'normal' (su parte), 'suave' (media parte), 'fuerte' (parte y media) o 'todo' (lo que queda).
   * Nunca más de lo que queda: lo que no se coma ahora se reparte solo entre las comidas siguientes.
   */
  var TAMANOS = { suave: 0.5, normal: 1, fuerte: 1.5 };
  function cuota(quedaDia, quedan, tam) {
    var n = Math.max(1, Math.round(num(quedan))), f = tam === 'todo' ? n : (TAMANOS[tam] || 1);
    var parte = function (m) { var q = num(quedaDia[m]); return Math.round(Math.min(q, q * f / n)); };
    var p = parte('p'), h = parte('h'), g = parte('g');
    return { p: p, h: h, g: g, kcal: 4 * p + 4 * h + 9 * g };
  }
  /** Una comida lista para guardar: guarda también nombres y totales, para que siga igual aunque luego se borre un alimento. */
  function apuntar(nombre, fecha, items) {
    var t = totales(items);
    return { nombre: nombre, hora: fecha.getHours() + ':' + dos(fecha.getMinutes()),
      items: items.map(function (it) { return { id: it.a.id, n: it.a.n, e: it.a.e || '', gramos: num(it.gramos) }; }),
      t: { kcal: t.kcal, p: t.p, h: t.h, g: t.g, f: t.f } };
  }
  /** Suma de todo lo apuntado en un día. */
  function sumaDia(comidas) {
    var t = { kcal: 0, p: 0, h: 0, g: 0, f: 0 };
    (comidas || []).forEach(function (c) { Object.keys(t).forEach(function (k) { t[k] += num(c.t && c.t[k]); }); });
    return t;
  }
  /** Lo que queda para el objetivo del día (nunca negativo) y, aparte, lo que ya se ha pasado. */
  function queda(meta, total) {
    var q = {}, pasa = {};
    ['kcal'].concat(MACROS).forEach(function (k) { var d = num(meta[k]) - num(total[k]); q[k] = Math.max(0, d); pasa[k] = Math.max(0, -d); });
    return { queda: q, pasa: pasa };
  }
  /**
   * Cómo va el día frente al objetivo, con el mismo margen que «clavado» (2 g o el 5 %; para las kcal, el 5 %):
   * sobra: de qué te has pasado de verdad ('p','h','g','kcal'); hecho: ya no queda nada apreciable por comer.
   * Un día con los tres macros clavados suele sumar algunas kcal más que el objetivo (la fibra también cuenta
   * en las kcal de los alimentos): eso no es pasarse.
   */
  function estadoDia(meta, total) {
    var sobra = MACROS.concat(['kcal']).filter(function (k) { return num(total[k]) - num(meta[k]) > margen(num(meta[k])); });
    var hecho = MACROS.every(function (m) { return num(meta[m]) - num(total[m]) <= margen(num(meta[m])); });
    return { sobra: sobra, hecho: hecho };
  }
  /* ── Historial: otros días, días cumplidos y racha ───────────────── */
  /** 'AAAA-MM-DD' → fecha local a mediodía (así un cambio de hora no la mueve de día). */
  function fechaDe(clave) { var p = String(clave).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  /** La clave del día que cae `n` días después (o antes, con n negativo). */
  function otroDia(clave, n) { var d = fechaDe(clave); d.setDate(d.getDate() + n); return claveDia(d); }
  /** Las claves de los últimos `n` días, acabando en `hoy`. */
  function ultimosDias(hoy, n) { var out = []; for (var i = n - 1; i >= 0; i--) out.push(otroDia(hoy, -i)); return out; }
  /** Las claves de un mes (mesN de 1 a 12) y los huecos antes de su día 1, con la semana empezando en lunes. */
  function diasDelMes(anio, mesN) {
    var n = new Date(anio, mesN, 0).getDate(), claves = [];
    for (var d = 1; d <= n; d++) claves.push(anio + '-' + dos(mesN) + '-' + dos(d));
    return { claves: claves, huecos: (new Date(anio, mesN - 1, 1).getDay() + 6) % 7 };
  }
  /**
   * Cómo fue un día frente a su objetivo: 'sin' (nada apuntado), 'cumplido' (los tres macros entre el 90 % y el 110 %),
   * 'medias' (hay algo apuntado, pero no llega o se pasa) o 'apuntado' (hay comidas, pero ese día no tenía objetivo).
   */
  function cumple(meta, comidas) {
    if (!comidas || !comidas.length) return 'sin';
    if (!meta) return 'apuntado';
    var t = sumaDia(comidas);
    return MACROS.every(function (m) { var o = num(meta[m]), v = num(t[m]); return o > 0 ? v >= 0.9 * o && v <= 1.1 * o : v <= 2; }) ? 'cumplido' : 'medias';
  }
  /**
   * El estado de cada día de una lista de claves (una semana, un mes) y la cuenta de cumplidos, a medias y sin apuntar.
   * dias {clave: comidas}; metas {clave: objetivo de ese día}; porDefecto: el objetivo de ahora, para los días que no
   * guardaron el suyo. Además de los de `cumple`: 'futuro', 'antes' (anterior al primer día apuntado: no cuenta como
   * «sin apuntar») y 'hoy' (hoy mientras no esté cumplido: sigue en marcha y tampoco cuenta).
   */
  function calendario(dias, metas, claves, hoy, porDefecto) {
    dias = dias || {}; metas = metas || {};
    var primero = Object.keys(dias).filter(function (k) { return dias[k] && dias[k].length; }).sort()[0];
    var cuenta = { cumplido: 0, medias: 0, sin: 0, apuntado: 0 };
    var out = claves.map(function (k) {
      var e;
      if (k > hoy) e = 'futuro';
      else if (!primero || k < primero) e = k === hoy ? 'hoy' : 'antes';
      else { e = cumple(metas[k] || porDefecto || null, dias[k]); if (k === hoy && e !== 'cumplido') e = 'hoy'; }
      if (cuenta[e] != null) cuenta[e]++;
      return { k: k, estado: e };
    });
    return { dias: out, cuenta: cuenta };
  }
  /** Días cumplidos seguidos hasta hoy (si hoy aún no lo está, hasta ayer) y la mejor racha que hay guardada. */
  function racha(dias, metas, hoy, porDefecto) {
    dias = dias || {}; metas = metas || {};
    var ok = function (k) { return cumple(metas[k] || porDefecto || null, dias[k]) === 'cumplido'; };
    var actual = 0, k = ok(hoy) ? hoy : otroDia(hoy, -1);
    while (ok(k)) { actual++; k = otroDia(k, -1); }
    var mejor = 0, seguidos = 0, previo = null;
    Object.keys(dias).sort().forEach(function (d) {
      if (d > hoy) return;
      if (!ok(d)) { seguidos = 0; previo = null; return; }
      seguidos = previo && otroDia(previo, 1) === d ? seguidos + 1 : 1; previo = d;
      if (seguidos > mejor) mejor = seguidos;
    });
    return { actual: actual, mejor: Math.max(mejor, actual) };
  }
  /** Se queda con los `max` días más recientes. */
  function podarDias(dias, max) {
    var out = {};
    Object.keys(dias || {}).sort().slice(-max).forEach(function (k) { out[k] = dias[k]; });
    return out;
  }

  /* ── El peso ──────────────────────────────────────
   * Una lista [{ f: 'AAAA-MM-DD', kg }], un peso por día y ordenada por fecha. Las funciones devuelven una lista nueva. */
  function diasEntre(a, b) { return Math.round((fechaDe(b) - fechaDe(a)) / 864e5); }
  /** Apunta el peso de un día; si ese día ya tenía, lo sustituye. Un peso imposible (fuera de 30–300 kg) no se apunta. */
  function ponPeso(pesos, clave, kg) {
    var lista = (pesos || []).slice(), v = Math.round(num(kg) * 10) / 10;
    if (!(v >= 30 && v <= 300)) return lista;
    lista = lista.filter(function (x) { return x.f !== clave; });
    lista.push({ f: clave, kg: v });
    return lista.sort(function (a, b) { return a.f < b.f ? -1 : a.f > b.f ? 1 : 0; });
  }
  /** Quita el peso apuntado un día. */
  function quitaPeso(pesos, clave) { return (pesos || []).filter(function (x) { return x.f !== clave; }); }
  /** Cuánto ha cambiado el peso del primero al último y en cuántos días; null si no hay dos. */
  function cambioPeso(pesos) {
    if (!pesos || pesos.length < 2) return null;
    var a = pesos[0], b = pesos[pesos.length - 1];
    return { kg: Math.round((b.kg - a.kg) * 10) / 10, dias: diasEntre(a.f, b.f) };
  }
  /** Un plazo dicho como se dice: «5 días», «8 semanas», «4 meses». */
  function plazo(dias) {
    var d = Math.max(1, Math.round(num(dias))), n;
    if (d < 14) return d + (d === 1 ? ' día' : ' días');
    if (d < 63) { n = Math.round(d / 7); return n + ' semanas'; }
    n = Math.round(d / 30.44); return n + (n === 1 ? ' mes' : ' meses');
  }
  /**
   * Los puntos de la gráfica del peso dentro de una caja de ancho × alto con su margen: la fecha manda en horizontal
   * y el peso en vertical (el más alto, arriba). Si el peso no cambia va por el medio; un punto solo, en el centro.
   * `rangoMin` (kg): lo mínimo que abarca la caja de arriba abajo, para que dos décimas no parezcan una caída.
   */
  function trazoPeso(pesos, ancho, alto, margen, rangoMin) {
    var ps = pesos || [], n = ps.length; if (!n) return [];
    var m = num(margen), total = diasEntre(ps[0].f, ps[n - 1].f);
    var min = Math.min.apply(null, ps.map(function (x) { return x.kg; })), max = Math.max.apply(null, ps.map(function (x) { return x.kg; }));
    if (max > min && max - min < num(rangoMin)) { var c = (max + min) / 2; min = c - num(rangoMin) / 2; max = c + num(rangoMin) / 2; }
    return ps.map(function (x) {
      var px = total > 0 ? m + (ancho - 2 * m) * diasEntre(ps[0].f, x.f) / total : ancho / 2;
      var py = max > min ? m + (alto - 2 * m) * (max - x.kg) / (max - min) : alto / 2;
      return { x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10, f: x.f, kg: x.kg };
    });
  }

  /* ── La nube: qué sube, qué baja y cómo se junta ─────
   * Cada día, cada peso y los ajustes (perfil, objetivo, favoritos, alimentos y platos propios) son una «fila».
   * El móvil guarda de cada fila la huella de lo último que sabe que tiene el servidor (base) y, de las que ha
   * cambiado aquí, la hora del cambio (pend). Gana siempre el cambio más reciente, fila a fila.
   *   nube = { cursor, base: { dias: {k: huella}, pesos: {k: huella}, estado: huella },
   *            pend: { dias: {k: {m, f}}, pesos: {k: {m, f}}, estado: {m, f} | null } }                     */

  /** El mismo contenido da siempre el mismo texto, lleguen como lleguen ordenados sus campos (el servidor los reordena). */
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }
  /** Huella corta (53 bits) de cualquier cosa: para saber si una fila ha cambiado sin guardar una copia. */
  function huella(v) {
    var t = typeof v === 'string' ? v : canon(v), h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, c;
    for (i = 0; i < t.length; i++) { c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  /** Un día sin comidas es «nada» (huella vacía), tenga o no objetivo guardado. */
  function huellaDia(comidas, meta) { return comidas && comidas.length ? huella([comidas, meta || null]) : ''; }
  function huellaPeso(kg) { return kg == null ? '' : String(kg); }
  /** Lo que se guarda en la cuenta además de días y pesos. El aspecto y el plato a medias son de cada móvil. */
  function estadoNube(S) { return { perfil: S.perfil, meta: S.meta, favs: S.favs || [], propios: S.propios || [], platos: S.platos || [] }; }
  function mapaPesos(pesos) { var m = {}; (pesos || []).forEach(function (x) { m[x.f] = x.kg; }); return m; }
  function listaPesos(m) { return Object.keys(m).sort().map(function (f) { return { f: f, kg: m[f] }; }); }
  function union(a, b) { var v = {}; Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { v[k] = 1; }); return Object.keys(v); }

  /**
   * Apunta la hora (ahora) de cada fila que ya no coincide con lo que tiene el servidor, y olvida las que han vuelto
   * a coincidir. Los días anteriores a `desde` (los que el móvil ya no guarda) no se miran. Devuelve cuántas quedan.
   */
  function detectaCambios(S, nube, ahora, desde) {
    var base = nube.base, pend = nube.pend, n = 0;
    function mira(lista, baseDe, k, fl) {
      var p = lista[k];
      if (fl === (baseDe[k] || '')) { delete lista[k]; return; }
      if (!p || p.f !== fl) lista[k] = { m: ahora, f: fl };
      n++;
    }
    union(S.dias, union(base.dias, pend.dias).reduce(function (o, k) { o[k] = 1; return o; }, {})).forEach(function (k) {
      if (desde && k < desde) { delete base.dias[k]; delete pend.dias[k]; return; }
      mira(pend.dias, base.dias, k, huellaDia(S.dias[k], S.metas && S.metas[k]));
    });
    var mios = mapaPesos(S.pesos);
    union(mios, union(base.pesos, pend.pesos).reduce(function (o, k) { o[k] = 1; return o; }, {})).forEach(function (k) {
      mira(pend.pesos, base.pesos, k, huellaPeso(mios[k]));
    });
    var fe = huella(estadoNube(S));
    if (fe === (base.estado || '')) pend.estado = null;
    else { if (!pend.estado || pend.estado.f !== fe) pend.estado = { m: ahora, f: fe }; n++; }
    return n;
  }

  /** Lo que toca subir ahora: los días pendientes más recientes (hasta `tope`), los pesos y los ajustes. */
  function loQueSube(S, nube, tope) {
    var pend = nube.pend, cambios = {}, enviado = { dias: {}, pesos: {}, estado: null };
    var ks = Object.keys(pend.dias).sort().reverse(), mios = mapaPesos(S.pesos), kp = Object.keys(pend.pesos).sort().reverse();
    var ahora = ks.slice(0, tope || 60);
    if (ahora.length) cambios.dias = ahora.map(function (k) {
      var cs = S.dias[k] || [];
      enviado.dias[k] = pend.dias[k].f;
      return { d: k, comidas: cs, meta: cs.length ? ((S.metas && S.metas[k]) || null) : null, mod: pend.dias[k].m };
    });
    if (kp.length) cambios.pesos = kp.map(function (k) { enviado.pesos[k] = pend.pesos[k].f; return { d: k, kg: mios[k] == null ? null : mios[k], mod: pend.pesos[k].m }; });
    if (pend.estado) { cambios.estado = { datos: estadoNube(S), mod: pend.estado.m }; enviado.estado = pend.estado.f; }
    return { cambios: cambios, enviado: enviado, quedan: ks.length > ahora.length };
  }

  function ponDia(S, k, comidas, meta) {
    if (comidas && comidas.length) { S.dias[k] = comidas; if (meta) S.metas[k] = meta; else delete S.metas[k]; }
    else { delete S.dias[k]; delete S.metas[k]; }
  }
  function ponEstado(S, d) {
    if (!d || typeof d !== 'object') return;
    if (d.perfil && typeof d.perfil === 'object') S.perfil = d.perfil;
    if (d.meta && typeof d.meta === 'object') S.meta = d.meta;
    S.favs = Array.isArray(d.favs) ? d.favs : []; S.propios = Array.isArray(d.propios) ? d.propios : []; S.platos = Array.isArray(d.platos) ? d.platos : [];
  }

  /**
   * Con la respuesta del servidor: lo que aceptó deja de estar pendiente y lo que llega de fuera (de otro móvil, o lo
   * suyo cuando rechaza lo mío por viejo) entra en este, salvo que aquí haya un cambio más reciente sin subir.
   * Devuelve qué ha cambiado en el móvil: { dias, pesos, estado }.
   */
  function aplicaRespuesta(S, nube, enviado, resp, desde) {
    var base = nube.base, pend = nube.pend, rech = resp.rechazadas || {}, cambia = { dias: false, pesos: false, estado: false };
    function aceptadas(env, lista, baseDe, rechazadas) {
      Object.keys(env || {}).forEach(function (k) {
        if ((rechazadas || []).indexOf(k) >= 0) return;
        baseDe[k] = env[k];
        if (lista[k] && lista[k].f === env[k]) delete lista[k];
      });
    }
    var gana = function (p, mod) { return p && p.m > mod; };                 // aquí hay un cambio más reciente sin subir
    aceptadas(enviado.dias, pend.dias, base.dias, rech.dias);
    aceptadas(enviado.pesos, pend.pesos, base.pesos, rech.pesos);
    if (enviado.estado && !rech.estado) { base.estado = enviado.estado; if (pend.estado && pend.estado.f === enviado.estado) pend.estado = null; }

    (resp.dias || []).forEach(function (r) {
      if (desde && r.d < desde) return;
      base.dias[r.d] = huellaDia(r.comidas, r.meta);
      if (gana(pend.dias[r.d], r.mod)) return;
      ponDia(S, r.d, r.comidas, r.meta); delete pend.dias[r.d]; cambia.dias = true;
    });
    var mios = mapaPesos(S.pesos), tocados = false;
    (resp.pesos || []).forEach(function (r) {
      base.pesos[r.d] = huellaPeso(r.kg);
      if (gana(pend.pesos[r.d], r.mod)) return;
      if (r.kg == null) delete mios[r.d]; else mios[r.d] = r.kg;
      delete pend.pesos[r.d]; tocados = true;
    });
    if (tocados) { S.pesos = listaPesos(mios); cambia.pesos = true; }
    if (resp.estado) {
      base.estado = huella(resp.estado.datos);
      if (!gana(pend.estado, resp.estado.mod)) { ponEstado(S, resp.estado.datos); pend.estado = null; cambia.estado = true; }
    }
    if (typeof resp.cursor === 'number') nube.cursor = resp.cursor;
    return cambia;
  }

  var minutos = function (hora) { var p = String(hora || '').split(':'); return p.length === 2 ? (+p[0]) * 60 + (+p[1]) : 9999; };
  /** Las comidas de dos lados en una sola lista: las repetidas (mismo nombre, hora y calorías) una vez, y por su hora. */
  function unirComidas(a, b) {
    var clave = function (c) { return [c.nombre, c.hora, Math.round(num(c.t && c.t.kcal))].join('|'); }, vistas = {}, out = [];
    (b || []).concat(a || []).forEach(function (c) { var k = clave(c); if (!vistas[k]) { vistas[k] = 1; out.push(c); } });
    return out.map(function (c, i) { return { c: c, i: i }; }).sort(function (x, y) { return (minutos(x.c.hora) - minutos(y.c.hora)) || (x.i - y.i); }).map(function (x) { return x.c; });
  }
  /**
   * La primera vez que un móvil entra en una cuenta (resp = todo lo que tiene la cuenta): junta lo que ya había en el
   * móvil con lo de la cuenta sin perder nada. Días de un solo lado, se quedan; el mismo día en los dos, se juntan sus
   * comidas. Pesos, los de los dos (el mismo día, el de la cuenta). Perfil y objetivo, los de la cuenta si los tiene;
   * favoritos, alimentos y platos propios, los de los dos. Lo que el móvil aporta de más lo detecta luego
   * detectaCambios y sube solo.
   */
  function fusionInicial(S, nube, resp, desde) {
    var base = { dias: {}, pesos: {}, estado: '' };
    (resp.dias || []).forEach(function (r) {
      if (desde && r.d < desde) return;
      base.dias[r.d] = huellaDia(r.comidas, r.meta);
      var mias = S.dias[r.d] || [];
      if (!r.comidas || !r.comidas.length) return;                           // la cuenta lo tiene vacío: lo del móvil se queda
      ponDia(S, r.d, mias.length ? unirComidas(mias, r.comidas) : r.comidas, r.meta || (S.metas && S.metas[r.d]) || null);
    });
    var mios = mapaPesos(S.pesos);
    (resp.pesos || []).forEach(function (r) { base.pesos[r.d] = huellaPeso(r.kg); if (r.kg != null) mios[r.d] = r.kg; });
    S.pesos = listaPesos(mios);
    if (resp.estado && resp.estado.datos) {
      var d = resp.estado.datos, favs = (d.favs || []).slice(), ids = {}, vistos = {};
      base.estado = huella(d);
      (S.favs || []).forEach(function (id) { if (favs.indexOf(id) < 0) favs.push(id); });
      var propios = (d.propios || []).concat(S.propios || []).filter(function (a) { if (!a || ids[a.id]) return false; ids[a.id] = 1; return true; });
      var platos = (d.platos || []).concat(S.platos || []).filter(function (p) { var k = canon(p); if (vistos[k]) return false; vistos[k] = 1; return true; });
      ponEstado(S, { perfil: d.perfil, meta: d.meta, favs: favs, propios: propios, platos: platos });
    }
    nube.base = base; nube.pend = { dias: {}, pesos: {}, estado: null };
    nube.cursor = typeof resp.cursor === 'number' ? resp.cursor : 0;
  }

  /** El código de invitación, ordenado mientras se escribe: «K7MP2XWD9» → «k7mp-2xwd-9». */
  function codigoBonito(t) {
    var c = String(t == null ? '' : t).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    return c.replace(/(.{4})(?=.)/g, '$1-');
  }

  function redondear5(x) { return Math.round(x / 5) * 5; }

  /**
   * Calorías y macros diarios para definir, mantener y ganar.
   * perfil: {sexo:'h'|'m', edad, peso (kg), altura (cm), actividad (factor 1.2–1.9)}
   * Reposo: Mifflin-St Jeor. Definir −20 %, ganar +10 %. Proteína 2,2 / 1,8 / 2,0 g/kg; grasa 0,8 / 1 / 1 g/kg (20–35 % kcal).
   */
  function objetivos(pf) {
    pf = pf || {};
    var sexo = pf.sexo, edad = num(pf.edad), peso = num(pf.peso), altura = num(pf.altura), act = num(pf.actividad);
    if ((sexo !== 'h' && sexo !== 'm') || !(peso >= 30 && peso <= 300) || !(altura >= 120 && altura <= 230) ||
        !(edad >= 1 && edad <= 100) || !(act >= 1.1 && act <= 2.5)) return { error: 'datos' };
    if (edad < 18) return { error: 'menor' };

    var reposo = Math.round(10 * peso + 6.25 * altura - 5 * edad + (sexo === 'h' ? 5 : -161));
    var gasto = Math.round(reposo * act);
    var m = altura / 100, imc = peso / (m * m), avisos = [], pesoRef = peso;
    if (imc >= 30) { pesoRef = 25 * m * m; avisos.push('peso_ref'); }
    var suelo = sexo === 'h' ? 1500 : 1200;

    function plan(factor, pKg, gKg) {
      var kcal = gasto * factor;
      if (factor < 1) {
        var minimo = Math.min(suelo, gasto);
        if (kcal < minimo) { kcal = minimo; avisos.push('suelo'); }
      }
      var p = redondear5(pKg * pesoRef);
      var g = redondear5(Math.min(0.35 * kcal / 9, Math.max(0.20 * kcal / 9, gKg * pesoRef)));
      var h = redondear5((kcal - 4 * p - 9 * g) / 4);
      if (h < 40) {                                                     // muy pocas kcal: se afloja proteína y grasa para dejar sitio a los hidratos
        p = redondear5(Math.min(pKg, 1.6) * pesoRef); g = redondear5(0.20 * kcal / 9);
        h = Math.max(0, redondear5((kcal - 4 * p - 9 * g) / 4));
      }
      return { kcal: 4 * p + 4 * h + 9 * g, p: p, h: h, g: g, ritmo: factor === 1 ? 0 : Math.round((kcal - gasto) * 7 / 7700 * 100) / 100 };
    }
    return {
      reposo: reposo, gasto: gasto, imc: imc, pesoRef: pesoRef,
      definir: plan(0.8, 2.2, 0.8), mantener: plan(1, 1.8, 1), ganar: plan(1.1, 2.0, 1), avisos: avisos
    };
  }

  /** Objetivo de una comida si el día se reparte en n comidas iguales. */
  function porComida(obj, n) {
    var p = Math.round(obj.p / n), h = Math.round(obj.h / n), g = Math.round(obj.g / n);
    return { p: p, h: h, g: g, kcal: 4 * p + 4 * h + 9 * g };
  }

  /** Texto sin tildes ni mayúsculas, para buscar. */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  }

  var cache = new WeakMap();
  function ficha(a) {
    var f = cache.get(a);
    if (!f) { f = { n: norm(a.n), todo: norm(a.n + ' ' + (a.e || '') + ' ' + (a.s || '')) }; cache.set(a, f); }
    return f;
  }

  /** Gramos de proteína por cada 100 kcal: lo «limpia» que es una fuente de proteína. */
  function proteinaPorCaloria(a) { return a.k > 0 ? (a.p || 0) / a.k * 100 : 0; }

  /* Formas de ordenar la biblioteca: cada una da un número y se ordena de mayor a menor. */
  var ORDENES = {
    prot: function (a) { return a.p || 0; }, pk: proteinaPorCaloria,
    hid: function (a) { return a.h || 0; }, gra: function (a) { return a.g || 0; }, fib: function (a) { return a.f || 0; },
    kcal: function (a) { return -(a.k || 0); }, mkcal: function (a) { return a.k || 0; }
  };

  /** Busca en la biblioteca. opts: {cat: índice de categoría, orden: 'az' o una clave de ORDENES} */
  function buscar(lista, texto, opts) {
    opts = opts || {};
    var q = norm(texto), palabras = q ? q.split(' ') : [];
    var out = [];
    lista.forEach(function (a) {
      if (opts.cat != null && a.c !== opts.cat) return;
      var f = ficha(a);
      for (var i = 0; i < palabras.length; i++) if (f.todo.indexOf(palabras[i]) < 0) return;
      var clase = 0;
      if (q) {
        if (f.n.indexOf(q) === 0) clase = 0;                                              // el nombre empieza por lo escrito
        else if ((' ' + f.n).indexOf(' ' + palabras[0]) >= 0) clase = 1;                   // alguna palabra del nombre empieza así
        else if (f.n.indexOf(palabras[0]) >= 0) clase = 2;                                 // está dentro del nombre
        else clase = 3;                                                                    // solo en sinónimos o estado
      }
      out.push({ a: a, clase: clase, n: f.n, nivel: a.c >= 9 && a.c <= 13 ? 1 : 0 });   // dulces, bebidas, salsas, platos y suplementos van detrás
    });
    var alfa = function (x, y) { return x.n < y.n ? -1 : x.n > y.n ? 1 : norm(x.a.e) < norm(y.a.e) ? -1 : norm(x.a.e) > norm(y.a.e) ? 1 : 0; };
    var clave = ORDENES[opts.orden];
    out.sort(function (x, y) {
      if (clave) return (clave(y.a) - clave(x.a)) || alfa(x, y);                         // de más a menos
      if (x.clase !== y.clase) return x.clase - y.clase;
      if (q && x.nivel !== y.nivel) return x.nivel - y.nivel;
      if (q && x.n.length !== y.n.length) return x.n.length - y.n.length;                 // a igual acierto, antes el nombre más corto (más genérico)
      return alfa(x, y);
    });
    return out.map(function (x) { return x.a; });
  }

  /** Número a la española: coma decimal, punto de millar, sin ceros de relleno. */
  function fmt(n, dec) {
    n = Number(n) || 0; dec = dec || 0;
    var s = Math.abs(n).toFixed(dec);
    if (dec) s = s.replace(/\.?0+$/, '');
    var partes = s.split('.');
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    s = partes.join(',');
    return (n < 0 && /[1-9]/.test(s) ? '−' : '') + s;
  }

  var Core = {
    KCAL: KCAL, num: num, macros: macros, totales: totales, reparto: reparto, redondear: redondear, resolver: resolver,
    esAcompanamiento: esAcompanamiento, fijados: fijados, masAporta: masAporta, sugerir: sugerir, objetivos: objetivos, porComida: porComida, norm: norm, buscar: buscar, proteinaPorCaloria: proteinaPorCaloria, fmt: fmt,
    veredicto: veredicto, COMIDAS: COMIDAS, planComidas: planComidas, comidaQueToca: comidaQueToca, cuota: cuota, claveDia: claveDia, comidaPorHora: comidaPorHora, apuntar: apuntar, sumaDia: sumaDia, queda: queda, estadoDia: estadoDia, margen: margen, fechaDe: fechaDe, otroDia: otroDia, ultimosDias: ultimosDias, diasDelMes: diasDelMes, cumple: cumple, calendario: calendario, racha: racha, podarDias: podarDias, ponPeso: ponPeso, quitaPeso: quitaPeso, cambioPeso: cambioPeso, plazo: plazo, trazoPeso: trazoPeso,
    huella: huella, estadoNube: estadoNube, detectaCambios: detectaCambios, loQueSube: loQueSube, aplicaRespuesta: aplicaRespuesta,
    unirComidas: unirComidas, fusionInicial: fusionInicial, codigoBonito: codigoBonito
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof self !== 'undefined' ? self : this);
