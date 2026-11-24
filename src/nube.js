/* Macros · la nube: entrar con código y PIN, y mantener iguales el móvil y la cuenta.
 * Solo existe en la web publicada, que trae window.MACROS_NUBE = { url, clave } (la dirección de Supabase y su clave
 * pública). Sin eso (la versión que se abre dentro de Claude) la app es solo del móvil y nada de esto se usa.
 * Aquí está lo que habla con el servidor y lleva la cuenta de qué falta por subir; las reglas (qué gana, cómo se junta
 * lo del móvil la primera vez) están en core.js, probadas una a una. */
(function (root) {
  'use strict';
  var C = root.Core, CFG = root.MACROS_NUBE || null, CLAVE = 'macros.nube.v1';
  var vacia = function () { return { token: null, u: null, cursor: 0, base: { dias: {}, pesos: {}, estado: '' }, pend: { dias: {}, pesos: {}, estado: null }, primera: false, cerrada: false, visto: 0 }; };
  var N = vacia(), app = null;            // app = lo que la pantalla le presta: { S(), guarda(), repinta(cambia), desde(), cambia() }
  var enMarcha = null, otraVez = false, reloj = null, firma = '', fallo = null, aplicando = false;

  try { var t = root.localStorage.getItem(CLAVE); if (t) N = Object.assign(vacia(), JSON.parse(t)); } catch (e) { /* sin memoria: como si nadie hubiera entrado */ }
  function recuerda() { try { root.localStorage.setItem(CLAVE, JSON.stringify(N)); } catch (e) { /* sin memoria */ } }
  /** El móvil guarda siempre a la vez lo apuntado y lo que sabe de la cuenta: así, con dos pestañas abiertas, no queda
   *  lo de una con la cuenta de la otra (que haría pasar por borrado lo que solo falta en la pestaña vieja). */
  function fija() { if (app) { aplicando = true; try { app.guarda(); } finally { aplicando = false; } } recuerda(); }
  function avisa() { if (app && app.cambia) app.cambia(); }

  /** Llama a una función del servidor. Rechaza con { red: true } si no hay conexión o tarda, o con { estado } si el servidor dice que no. */
  function rpc(fn, args, alSalir) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var corta = ctl ? setTimeout(function () { ctl.abort(); }, 15000) : null;
    var cuerpo = JSON.stringify(args || {});
    return root.fetch(CFG.url + '/rest/v1/rpc/' + fn, {
      method: 'POST', body: cuerpo, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', apikey: CFG.clave, Authorization: 'Bearer ' + CFG.clave },
      signal: ctl ? ctl.signal : undefined,
      keepalive: !!alSalir && cuerpo.length < 60000          // al salir de la app, el navegador termina la llamada aunque la página se cierre
    }).then(function (r) {
      clearTimeout(corta);
      if (r.ok) return r.json();
      return r.text().then(function (x) { var e = new Error('el servidor dice ' + r.status); e.estado = r.status; e.cuerpo = String(x).slice(0, 200); throw e; });
    }, function () { clearTimeout(corta); var e = new Error('sin conexión'); e.red = true; throw e; });
  }

  var dentro = function () { return !!(CFG && N.token && N.u && !N.cerrada); };
  var pendientes = function () { return Object.keys(N.pend.dias).length + Object.keys(N.pend.pesos).length + (N.pend.estado ? 1 : 0); };

  /** El servidor ya no reconoce esta sesión (desactivada, enlace nuevo o caducada): el móvil se queda fuera, con sus datos. */
  function vale(r) {
    if (r && r.sesion === false) { N.cerrada = true; recuerda(); avisa(); return false; }
    return !!(r && r.sesion);
  }

  /** Lo que mira la sincronización de este móvil, como texto: si no cambia, no hay nada que buscar. */
  function firmaDe(S) { return JSON.stringify([S.dias, S.metas, S.pesos, C.estadoNube(S)]); }

  /** Sube lo pendiente y baja lo nuevo, por tandas, hasta que el móvil y la cuenta quedan iguales. Una sola a la vez. */
  function sinc(alSalir) {
    if (!dentro() || !app) return Promise.resolve(false);
    if (enMarcha) { otraVez = true; return enMarcha; }
    clearTimeout(reloj); reloj = null;
    var S = app.S(), desde = app.desde();
    var tanda = function (vueltas) {
      C.detectaCambios(S, N, Date.now(), desde);
      var s = C.loQueSube(S, N, 60);
      return rpc('ag_sinc', { p_token: N.token, p_desde: N.cursor, p_cambios: s.cambios }, alSalir).then(function (r) {
        if (!vale(r)) return false;
        C.detectaCambios(S, N, Date.now(), desde);                        // lo apuntado mientras la llamada iba y venía es más reciente que lo que llega: no se pisa
        var cambia = C.aplicaRespuesta(S, N, s.enviado, r, desde);
        N.u = r.usuario || N.u; N.visto = Date.now(); fija();
        if (cambia.dias || cambia.pesos || cambia.estado) app.repinta(cambia);
        firma = firmaDe(S);
        if ((s.quedan || C.detectaCambios(S, N, Date.now(), desde) > 0) && vueltas < 15) return tanda(vueltas + 1);
        return true;
      });
    };
    var primero = !N.primera ? Promise.resolve(true) : rpc('ag_sinc', { p_token: N.token, p_desde: 0, p_cambios: {} }).then(function (r) {
      if (!vale(r)) return false;                                         // la primera vez: se junta lo del móvil con lo de la cuenta
      C.fusionInicial(S, N, r, desde); N.primera = false; N.u = r.usuario || N.u; fija();
      app.repinta({ dias: true, pesos: true, estado: true });
      return true;
    });
    enMarcha = primero.then(function (sigue) { return sigue ? tanda(0) : false; }).then(function (bien) {
      fallo = null; return bien;
    }, function (e) {
      fallo = e && e.red ? 'red' : 'servidor'; return false;
    }).then(function (bien) {
      enMarcha = null; avisa();
      if (otraVez) { otraVez = false; programa(1500); }
      return bien;
    });
    avisa();
    return enMarcha;
  }
  function programa(ms) { clearTimeout(reloj); reloj = setTimeout(function () { reloj = null; sinc(); }, ms); }

  /** La app avisa cada vez que guarda: si ha cambiado algo de la cuenta, se apunta la hora del cambio y se sube enseguida. */
  function alGuardar() {
    if (aplicando || !app || !CFG || !N.token) return;
    recuerda();                                                           // siempre a la vez que lo apuntado (ver «fija»)
    if (!dentro()) return;
    var S = app.S(), f = firmaDe(S);
    if (f === firma) return;
    firma = f;
    C.detectaCambios(S, N, Date.now(), app.desde()); recuerda();
    programa(2500); avisa();
  }

  function trasEntrar(r) {
    if (r && r.ok && r.token) {
      if (N.u && N.u.id && r.usuario && N.u.id !== r.usuario.id) {
        // Este móvil guarda los datos de otra cuenta (su sesión se cerró): no se mezclan con los de quien entra ahora.
        // Antes hay que cerrar esa sesión en el móvil, que lo deja limpio.
        rpc('ag_salir', { p_token: r.token }).then(null, function () {});
        return { ok: false, motivo: 'otra' };
      }
      if (N.u && N.cerrada) { N.token = r.token; N.u = r.usuario; N.cerrada = false; }          // la misma persona vuelve a su móvil: sigue donde estaba
      else { N = vacia(); N.token = r.token; N.u = r.usuario; N.primera = true; }
      firma = ''; fallo = null; recuerda(); avisa();
    }
    return r;
  }

  root.Nube = {
    activa: !!CFG,
    /** La pantalla presta lo que hace falta: el estado, guardar, repintar y desde qué día guarda el móvil. */
    conecta: function (a) { app = a; },
    dentro: dentro,
    /** Entró en este móvil pero el servidor cerró la sesión: hay que volver a entrar. */
    cerrada: function () { return !!(CFG && N.cerrada && N.u); },
    usuario: function () { return N.u; },
    /** Cómo va: { pendientes, enMarcha, fallo: 'red' | 'servidor' | null, visto } */
    estado: function () { return { pendientes: pendientes(), enMarcha: !!enMarcha, fallo: fallo, visto: N.visto }; },
    mirar: function (codigo) { return rpc('ag_mirar', { p_codigo: codigo }); },
    crearPin: function (codigo, pin) { return rpc('ag_crear_pin', { p_codigo: codigo, p_pin: pin }).then(trasEntrar); },
    entrar: function (codigo, pin) { return rpc('ag_entrar', { p_codigo: codigo, p_pin: pin }).then(trasEntrar); },
    sinc: sinc, alGuardar: alGuardar,
    /** Al salir de la app o volver a ella: se intenta subir lo pendiente, o bajar lo que haya nuevo. */
    alOcultar: function () { if (dentro() && (pendientes() > 0 || reloj)) sinc(true); },
    alVolver: function () { if (dentro() && Date.now() - (N.visto || 0) > 60000) sinc(); },
    /**
     * Cerrar sesión: sube antes lo pendiente (si no puede, no cierra: { ok: false, motivo: 'pendiente' }) y deja el móvil
     * limpio. Con `aunque`, cierra igualmente (lo que no se haya subido se pierde): para una sesión que el servidor ya cerró.
     */
    salir: function (aunque) {
      var limpia = function () {
        try { root.localStorage.removeItem(CLAVE); root.localStorage.removeItem('algramo.v1'); } catch (e) { /* sin memoria */ }
        N = vacia(); return { ok: true };
      };
      if (aunque || !dentro()) return Promise.resolve(limpia());
      var esperando = enMarcha || Promise.resolve();
      return esperando.then(function () { return sinc(); }).then(function (bien) {
        if (N.cerrada) return { ok: false, motivo: 'cerrada' };                 // el servidor la cerró mientras tanto: decide la pantalla de entrada
        if (!bien || pendientes() > 0) return { ok: false, motivo: 'pendiente' };
        var token = N.token;
        return rpc('ag_salir', { p_token: token }).then(limpia, limpia);
      });
    },
    admin: {
      usuarios: function () { return rpc('ag_admin_usuarios', { p_token: N.token }); },
      invitar: function (nombre) { return rpc('ag_admin_invitar', { p_token: N.token, p_nombre: nombre }); },
      activar: function (id, activo) { return rpc('ag_admin_activar', { p_token: N.token, p_usuario: id, p_activo: !!activo }); },
      enlace: function (id) { return rpc('ag_admin_enlace', { p_token: N.token, p_usuario: id }); }
    }
  };
})(typeof self !== 'undefined' ? self : this);
