# Macros

Calculadora de macros para móvil: biblioteca de alimentos, plato en los dos sentidos
(gramos → macros y macros → gramos), objetivos diarios (definir, mantener, ganar) y «Hoy»,
donde se apuntan las comidas del día y se ve lo que llevas, lo que te queda y cómo fueron los días anteriores.
Se instala en el móvil como una app y funciona sin conexión. Se entra con un código de invitación y un PIN: lo que
apuntas se guarda en tu cuenta (y en tu móvil) y solo lo ves tú.

## Cómo está montada
- `src/core.js` — cálculos puros (macros, calculadora inversa y su veredicto, objetivos, búsqueda, cuentas del día). Sin pantalla.
- `src/ui.js` — la pantalla: estado, pintado y acciones. Guarda en `localStorage` (`algramo.v1`).
- `src/app.css` — estilos. Dos aspectos con `data-aspecto` en `<html>`: `claro` y `oscuro` (o automático, según el móvil).
- `src/index.tpl.html` — esqueleto. `build.py` lo junta todo en una sola página, sin peticiones externas, en dos versiones:
  `public/` (la web que se publica: instalable, con manifiesto, iconos y service worker) y `dist/index.html` (la misma
  página sin eso, para abrirla dentro de Claude).
- `src/nube.js` — la cuenta: entrar y mantener iguales el móvil y el servidor. `nube/esquema.sql` — la base de datos de
  usuarios (Supabase); `nube/config.json` — su dirección y su clave pública.
- `src/web/` — el manifiesto y el service worker. `src/iconos/` — el icono y `hacer.js`, que saca sus tamaños.
- `vercel.json` — cómo se sirve: sin indexar y con una política de seguridad que solo le deja hablar con su propio
  servidor y con el de las cuentas.
- `data/alimentos.txt` — la lista curada: categoría, nombre, estado, icono, sinónimos y de qué registro sale.
- `data/curar.py` → cruza esa lista con USDA SR Legacy y CIQUAL 2017 (sacadas del paquete de R `NutrienTrackeR`,
  github.com/cran/NutrienTrackeR, `data/food_composition_data.rda`) y saca `alimentos_raw.json`.
- `data/construir_datos.py` → `alimentos.json` (formato compacto que lleva la app).

## El día guiado (la pantalla principal)
La app abre en **«Pongo los macros»**. Con macros del día en «Mis macros», el plato ya sale con la comida que toca
(«Desayuno: te tocan 41 / 59 / 15») y «Hoy llevas X de tus Y kcal». Se añaden alimentos y calcula los gramos.
- **Qué comida toca** (`Core.comidaQueToca`): la primera del plan que no esté apuntada y cuya hora no haya pasado
  (desayuno hasta las 12:00, media mañana 13:30, comida 17:00, merienda 20:30, cena 23:30; la última no caduca).
  Plan según el número de comidas: 2 = comida y cena; 3 = + desayuno; 4 = + merienda; 5 = + media mañana; 6 = + recena.
- **Cuánto toca** (`Core.cuota`): lo que queda del día entre las comidas que faltan. Si una comida sale corta o larga,
  o se salta, las siguientes se recalculan solas.
- **El tamaño lo elige quien come**, en cada comida: «Suave» (media parte), «Normal» (su parte), «Fuerte» (parte y
  media, como mucho lo que queda) o «Todo» (lo que queda del día). También se pueden escribir los tres números a mano.
- **Al apuntar**, el plato se vacía y prepara la siguiente; te quedas en «Plato». «Algo entre horas» apunta en gramos,
  sin objetivo, y no gasta una comida del plan. Un plato vacío se pone al día al abrir o volver a la app.
- Sin macros del día, pide calcularlos; el plato de ejemplo es un botón («Ver un plato de ejemplo»).
- Quien venía de la versión anterior con un plato a medias lo encuentra en «Mis platos» («Lo que tenías en el plato»).

## Cómo calcula y cómo habla «Pongo los macros»
Compara siempre **lo que pides** (los tres números del plato) con **lo que sale** moviendo los gramos. Nunca mira el
peso ni la edad: eso es «Mis macros».
- `Core.resolver` **no pone más de lo pedido de un macro para arañar otro** (pasarse pesa 400 veces más que quedarse
  corto; en la práctica, como mucho 1–2 g). Lo que falte, se dice. Excepción: un macro que lo fijado ya cubre o pasa
  (un candado) deja de ser tope, para que lo demás no se quede a cero.
- Lo ligero (ningún macro llega a 8 g por 100 g: verdura, leche, café con leche) se queda en su ración salvo que se
  suelte el candado, también cuando es lo único del plato.
- `Core.veredicto` decide qué decir:
  - *Clavado*: cada macro a 2 g (o al 5 %). *Casi clavado*: lo que falla, a 3 g (o al 10 %) y sin cantidades enormes.
  - *Añade algo más*: solo falta (nada sobra, nada al tope, sin candados). Dice cuánto falta y propone alimentos. Si
    falta porque con más de un alimento te pasarías de otro macro, lo dice y ofrece «Subir la grasa a N g».
  - *Con estos alimentos no sale*: un renglón por macro («pides X y salen Y») con la causa cuando se sabe (un alimento
    al tope, un candado, nada lleva ese macro, otro macro que frena) y una salida.

## Hoy y los días anteriores
`S.dias` guarda, por fecha local (`AAAA-MM-DD`), las comidas apuntadas: nombre, hora, alimentos con su nombre y
gramos, y los totales (así un alimento borrado después no cambia lo ya apuntado). Se conservan 400 días.
Solo dice lo que te queda o si te pasas cuando hay objetivo del día en «Mis macros». El botón de abajo prepara la
comida siguiente («Preparar la cena»). Lo apuntado se guarda también al salir de la app, sin esperar.
- **La tira de arriba** son los últimos 7 días. Cada uno, con su marca: llena = cumplido, aro ámbar = a medias, aro
  gris = sin apuntar; hoy, un aro que se va llenando. Se toca un día y «Hoy» enseña ese día (y se puede borrar o
  cambiar una comida suya). Al tocar la fecha sale el mes entero con la cuenta y la racha.
- **Corregir un día pasado**: «Cambiarla» lleva esa comida al plato, que avisa de cuál es («Cambiando la comida del
  sábado 21») y no la suma a lo de hoy; al guardarla vuelve a su día, a su sitio y con su hora. «Dejarla como estaba»
  la devuelve sin tocar.
- **Cumplir un día** (`Core.cumple`): los tres macros entre el 90 y el 110 % del objetivo. Cada día se mide con el
  objetivo que tenía ese día (`S.metas`), no con el de ahora. Los días de antes de empezar a apuntar no cuentan.

## El peso
En «Mis macros», la fila «Mi peso» abre una hoja para apuntarlo: un peso por día (`S.pesos`), el cambio desde el
primero («2,9 kg menos en 8 semanas»), una línea con los últimos 30 y la lista. El peso es uno: apuntarlo cambia el del
cálculo de los macros, y cambiarlo en tus datos también lo apunta. La línea abarca 2 kg como poco, para que dos
décimas no parezcan una caída.

## Usuarios
Sin invitación no se entra: la web pide el **código** (12 letras y números, `k7mp-2xwd-9rtn`) y, la primera vez, crear
un **PIN de 4 números**. El móvil se queda dentro; el PIN solo se vuelve a pedir desde otro móvil. Sin correo ni
contraseña. El enlace de invitación lleva el código detrás de `#c=`, la parte de la dirección que no viaja a ningún
servidor; la app lo lee y lo quita.
- **Qué se guarda en la cuenta**: cada día (sus comidas y su objetivo), cada peso y los ajustes (perfil, objetivo,
  favoritos, alimentos y platos propios). El aspecto y el plato a medias son de cada móvil.
- **Cómo se sincroniza** (`Core.detectaCambios`, `loQueSube`, `aplicaRespuesta`): fila a fila, gana el cambio más
  reciente. La app funciona igual sin conexión: apunta la hora de cada cambio y lo sube al volver. Los días de hace más
  de 400 días no se guardan en el móvil, pero en la cuenta se quedan.
- **La primera vez en una cuenta** (`Core.fusionInicial`): lo que ya había en el móvil se junta con lo de la cuenta sin
  perder nada (días de un solo lado, se quedan; el mismo día en los dos, se juntan sus comidas).
- **Cerrar sesión** sube antes lo pendiente (si no puede, no cierra) y deja el móvil limpio. Un móvil con los datos de
  una cuenta no deja entrar a otra sin cerrar antes: nada se mezcla.
- **El administrador** («Tu cuenta» → «Usuarios») ve quién la usa, cuándo entró por última vez y cuántos de los últimos
  7 días apuntó; puede invitar (un nombre → un enlace que vale 7 días), desactivar (fuera al momento, los datos se
  quedan) y dar un enlace nuevo (el viejo deja de valer y hay que crear PIN otra vez). No ve comidas ni pesos.
- **La base de datos** (`nube/esquema.sql`): todo en el esquema `ag`, que la API de Supabase no publica; la app solo
  puede llamar a las funciones `public.ag_*`, que comprueban la sesión antes de tocar nada. Código, PIN y sesión se
  guardan solo como huella (SHA-256). Al quinto PIN mal, 15 minutos de bloqueo; cada fallo de más lo dobla, hasta un día.
  Quien administra el proyecto de Supabase puede ver las tablas desde su panel: la app no se lo enseña a nadie.
- La versión que se abre dentro de Claude (`dist/`) no lleva nada de esto: allí la app es solo del móvil.

## De dónde sale cada cosa
- **Datos de los alimentos**: USDA FoodData Central, edición SR Legacy (dominio público) y tabla CIQUAL 2017 de la
  Anses (Francia, licencia abierta Etalab). La ficha de cada alimento dice de cuál sale y con qué código.
- **Tipografías**: Bricolage Grotesque y Figtree, con licencia SIL Open Font 1.1 (su texto, en `src/fuentes/`).
  Van dentro de la página: la app no pide nada a servidores de terceros.

## Criterios de datos
- Por 100 g de parte comestible. Hidratos = disponibles (USDA los da con la fibra dentro: se resta).
- Kcal con los factores del etiquetado europeo: 4·P + 4·H + 9·G + 2·fibra (salvo bebidas alcohólicas de USDA).
- Cada alimento conserva base y código de origen (`U5064` = USDA n.º 5064; `C28845` = CIQUAL 28845).
- No se usa BEDCA: sus condiciones piden permiso para usos que no sean personales.

## Probar y montar
    (cd test && npm install)          # una vez: el Postgres que corre dentro de Node para probar los usuarios
    ./probar.sh                       # monta la app y pasa todo: 124 pruebas (cálculo, base de datos, cuenta) y 7 de pantalla
Por separado:

    python3 build.py                  # genera public/ (la web) y dist/index.html (para Claude)
    node --test test/core.test.js     # cálculos
    node test/flujo.js                # recorrido completo en un navegador sin ventana
    node test/hoy.js                  # el día guiado: qué toca, tamaño, gramos, apuntar, entre horas, día siguiente
    node test/historial.js            # la tira de 7 días, ver otro día, el mes y la racha
    node test/peso.js                 # apuntar el peso, el cambio, la gráfica y la lista
    node test/arranque.js             # quien venía de la versión anterior no pierde nada; el plato de ejemplo
    node test/instalable.js           # manifiesto, iconos, cabeceras, abrir sin conexión y recibir una versión nueva
    node --test test/nube.test.js     # la base de datos: entrar, bloqueo, caducidad, sincronizar, aislamiento, administrador
    node --test test/nube-cliente.test.js   # el módulo de la cuenta, parando respuestas y cortando la conexión
    node test/usuarios.js             # usuarios de punta a punta en pantalla: dos móviles, sin conexión, administrador
    node test/fotos-usuarios.js       # capturas de la entrada, la cuenta y el panel (u-*.png)
    node test/fotos-guiado.js         # capturas del día guiado (g-*.png)
    node test/fotos-historial.js      # capturas del tamaño, el historial y el peso, con un mes de datos
    python3 test/laminas.py           # monta láminas con esas capturas
Las pruebas de pantalla necesitan Node, Playwright y Chrome, y abren la app como la sirve Vercel (`test/servidor.js`:
la carpeta `public/` con las cabeceras de `vercel.json`). Los usuarios se prueban contra `test/nube.js`: un Postgres 17
dentro de Node (PGlite) con el mismo `nube/esquema.sql` que la base de datos real, llamado como lo llama la app (papel
`anon`). Las demás pruebas abren la app sin cuenta, como la versión de Claude. Con `file://`, el Chrome sin ventana devuelve a veces el
almacenamiento vacío al recargar si la máquina va cargada (3–5 de cada 100 recargas; por HTTP, 0 de 200).

## Publicar
La base de datos: `nube/esquema.sql` se pasa entero al proyecto de Supabase (no borra nada y se puede repetir). Si
cambia de proyecto, hay que cambiar `nube/config.json` y la dirección que deja pasar `vercel.json` (`connect-src`).
Vercel publica la carpeta `public/` cada vez que se sube un cambio a `main`; no compila nada. Por eso `public/` va en
el repositorio: **antes de subir, `./probar.sh`** (la vuelve a generar y la prueba).
- El service worker pide siempre la página a la red primero: un cambio llega a la primera vez que se abre con conexión.
  Sin conexión (o si la red tarda más de 3 segundos) sale la última guardada.
- Para instalarla: en Android, Chrome → menú → «Añadir a pantalla de inicio»; en iPhone, Safari → Compartir →
  «Añadir a pantalla de inicio».
- Lo apuntado vive en el almacenamiento del navegador. En iPhone conviene instalarla antes de empezar: Safari borra
  los datos de las webs que llevan siete días de uso del navegador sin abrirse, y las apps añadidas a la pantalla de
  inicio llevan su propia cuenta (webkit.org/blog/10218). Además, en iPhone la app instalada no comparte datos con Safari.
- Con el teclado del móvil abierto, las hojas (añadir alimento, peso, nombre de la comida) suben lo que ocupa el
  teclado (`visualViewport`), para que el campo no quede tapado. Está probado con un teclado simulado, no en un móvil.

## Lo siguiente
- Usuarios con código de invitación y PIN, datos sincronizados y panel de administrador: `docs/diseno-usuarios-historial.md`.
- Ideas en cartera: código de barras con Open Food Facts, guardar un plato como alimento, crudo ↔ cocido y raciones
  de casa (1 huevo, 1 cucharada).
