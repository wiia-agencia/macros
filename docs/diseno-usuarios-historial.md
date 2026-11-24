# Diseño: tamaño de cada comida, historial, peso, usuarios y publicación

Decidido el 24 nov 2026. La tanda 1 está construida; la tanda 2 (usuarios), pendiente.

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
4. **Entrar** (tanda 2): código de invitación + PIN de 4 números que crea cada uno. Sin correo ni contraseña. El móvil
   se queda dentro; 5 PIN mal → 15 minutos bloqueado. El enlace de invitación lleva el código.
5. **Administrador** (tanda 2): ve quién usa la app y su actividad (última vez, días apuntados) y puede invitar o
   desactivar. No ve comidas ni pesos.

## Cómo se guarda
- En el móvil (`localStorage`, clave `algramo.v1`): `dias` (comidas por fecha), `metas` (objetivo de cada día),
  `pesos` [{f, kg}] y, en el plato, el tamaño elegido.
- En la nube, solo con usuarios (tanda 2, Supabase): `ag_usuarios`, `ag_sesiones` (qué móvil es de quién), `ag_estado`
  (perfil, objetivo, favoritos, alimentos y platos propios), `ag_dias` (un renglón por usuario y día) y `ag_pesos`.
  Cada tabla, con acceso solo a su dueño; entrar, invitar y la lista de usuarios, por funciones del servidor.
  La app sigue funcionando sin conexión y sincroniza al volver (gana lo último, día a día).
- Quien ya la use sin cuenta: al entrar por primera vez, lo que tenga en el móvil se sube a su usuario.

## Publicación
- `public/` es la app tal como se sirve (la genera `build.py`): una página, su manifiesto, su icono y un service worker
  que la deja abrir sin conexión. Vercel la publica al subir cambios a `main`. No se indexa en buscadores.
- Se sirve con una política de seguridad (`vercel.json`) que solo le deja hablar con su propio servidor: hoy la app no
  envía nada a nadie. Con usuarios (tanda 2) habrá que abrirle, y solo, la dirección de la base de datos.
- El icono es provisional: el aro del plato repartido entre los tres macros (`src/iconos/hacer.js`).
