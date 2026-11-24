# Diseño: tamaño de cada comida, historial, peso, usuarios y publicación

Decidido el 24 nov 2026. Las dos tandas están construidas: la 1 (tamaño, historial, peso, instalable) y la 2 (usuarios).

## Qué se pidió
- Las comidas no son todas iguales ni todos los días las mismas: lo decide quien la usa, en cada comida.
- Publicarla como app instalable para pasársela a más gente.
- Usuarios: cada uno con sus datos, sin verse entre ellos; un administrador que ve a los usuarios.
- Historial: ver lo que se comió otros días y cuántos días se cumplen los macros. También el peso.
- Sin sobrecargarla: tiene que seguir siendo simple y rápida.

## Decisiones
1. **Tamaño de la comida**: selector «Suave · Normal · Fuerte · Todo» bajo los tres campos. Normal = lo que queda ÷
   comidas que faltan; Suave = la mitad de eso; Fuerte = vez y media (como mucho, todo lo que queda); Todo = lo que
   queda. El resto del día se reajusta solo.
2. **Historial**: en «Hoy», tira con los últimos 7 días (se toca uno y se ve ese día) y, al tocar la fecha, el mes con
   cumplidos / a medias / sin apuntar y la racha. El peso, en «Mis macros». Sin pestañas nuevas.
3. **Cumplir un día**: los tres macros entre el 90 % y el 110 % del objetivo de ese día. «A medias»: hay algo apuntado
   pero no se llega o se pasa. El objetivo se guarda con cada día (si luego cambia, los días viejos no cambian).
4. **Entrar**: código de invitación + PIN de 4 números que crea cada uno (dos veces, para no equivocarse). Sin correo
   ni contraseña. El móvil se queda dentro; 5 PIN mal → 15 minutos bloqueado, y cada fallo de más lo dobla (hasta un
   día). El enlace de invitación lleva el código y vale 7 días si no se usa. Sin invitación no se entra.
5. **Administrador**: ve quién usa la app y su actividad (última vez, días apuntados) y puede invitar, desactivar o dar
   un enlace nuevo. No ve comidas ni pesos.

## Cómo se guarda
- En el móvil (`localStorage`, clave `algramo.v1`): `dias` (comidas por fecha), `metas` (objetivo de cada día),
  `pesos` [{f, kg}] y, en el plato, el tamaño elegido.
- En la nube (Supabase), en un esquema aparte, `ag`, que la API no publica: `usuarios`, `sesiones` (qué móvil es de
  quién), `estado` (perfil, objetivo, favoritos, alimentos y platos propios), `dias` (un renglón por usuario y día) y
  `pesos`. A las tablas no se llega con la clave pública; la app solo llama a las funciones `public.ag_*`, que
  comprueban la sesión que viaja en cada llamada. La app sigue funcionando sin conexión y sincroniza al volver (gana lo
  último, fila a fila).
- Quien ya la use sin cuenta: al entrar por primera vez, lo que tenga en el móvil se sube a su usuario.

## Por qué así (tanda 2)
- **Sesiones propias en vez de las de Supabase**: una función comprueba código y PIN y devuelve una llave al azar que
  el móvil guarda; el servidor solo guarda su huella. Así no se mezclan los usuarios de Macros con los de la otra app
  del mismo proyecto, no hay que renovar nada y todo se puede probar en un Postgres local.
- **El código es el secreto fuerte** (12 de un alfabeto de 31, unos 59 bits) y el PIN, el seguro por si el enlace se
  reenvía: con el bloqueo que se alarga, probar los 10.000 PIN a ciegas no es viable.
- **Gana lo último, fila a fila** (un día, un peso, los ajustes), con la hora del móvil: es lo justo para una persona con
  uno o dos móviles. Si dos móviles cambian el mismo día sin conexión, se queda el cambio más reciente entero.
- **Cerrar sesión limpia el móvil** y un móvil con datos de una cuenta no admite otra: es lo que impide que dos
  personas que comparten móvil se vean los datos.
- **Límites**: quien administra el proyecto de Supabase puede ver las tablas desde su panel (la app no se lo enseña a
  nadie). Cifrar en el móvil lo impediría, pero entonces perder el enlace sería perder los datos.

## Publicación
- `public/` es la app tal como se sirve (la genera `build.py`): una página, su manifiesto, su icono y un service worker
  que la deja abrir sin conexión. Vercel la publica al subir cambios a `main`. No se indexa en buscadores.
- Se sirve con una política de seguridad (`vercel.json`) que solo le deja hablar con su propio servidor y con el de
  las cuentas (la dirección de `nube/config.json`).
- El icono es provisional: el aro del plato repartido entre los tres macros (`src/iconos/hacer.js`).
