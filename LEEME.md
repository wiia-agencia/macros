# Macros

Calculadora de macros para móvil: biblioteca de alimentos, plato en los dos sentidos
(gramos → macros y macros → gramos), objetivos diarios (definir, mantener, ganar) y «Hoy»,
donde se apuntan las comidas del día y se ve lo que llevas, lo que te queda y cómo fueron los días anteriores.
Se instala en el móvil como una app y funciona sin conexión. Todo lo que apuntas se queda en tu móvil.

## Cómo está montada
- `src/core.js` — cálculos puros (macros, calculadora inversa y su veredicto, objetivos, búsqueda, cuentas del día). Sin pantalla.
- `src/ui.js` — la pantalla: estado, pintado y acciones. Guarda en `localStorage` (`algramo.v1`).
- `src/app.css` — estilos. Dos aspectos con `data-aspecto` en `<html>`: `claro` y `oscuro` (o automático, según el móvil).
- `src/index.tpl.html` — esqueleto. `build.py` lo junta todo en una sola página, sin peticiones externas, en dos versiones:
  `public/` (la web que se publica: instalable, con manifiesto, iconos y service worker) y `dist/index.html` (la misma
  página sin eso, para abrirla dentro de Claude).
- `src/web/` — el manifiesto y el service worker. `src/iconos/` — el icono y `hacer.js`, que saca sus tamaños.
- `vercel.json` — cómo se sirve: sin indexar y con una política de seguridad que solo deja hablar con su propio servidor.
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
- **Cumplir un día** (`Core.cumple`): los tres macros entre el 90 y el 110 % del objetivo. Cada día se mide con el
  objetivo que tenía ese día (`S.metas`), no con el de ahora. Los días de antes de empezar a apuntar no cuentan.

## El peso
En «Mis macros», la fila «Mi peso» abre una hoja para apuntarlo: un peso por día (`S.pesos`), el cambio desde el
primero («2,9 kg menos en 8 semanas»), una línea con los últimos 30 y la lista. El peso es uno: apuntarlo cambia el del
cálculo de los macros, y cambiarlo en tus datos también lo apunta. La línea abarca 2 kg como poco, para que dos
décimas no parezcan una caída.

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
    ./probar.sh                       # monta la app y pasa todo: 88 pruebas de cálculo y las 6 de pantalla
Por separado:

    python3 build.py                  # genera public/ (la web) y dist/index.html (para Claude)
    node --test test/core.test.js     # cálculos
    node test/flujo.js                # recorrido completo en un navegador sin ventana
    node test/hoy.js                  # el día guiado: qué toca, tamaño, gramos, apuntar, entre horas, día siguiente
    node test/historial.js            # la tira de 7 días, ver otro día, el mes y la racha
    node test/peso.js                 # apuntar el peso, el cambio, la gráfica y la lista
    node test/arranque.js             # quien venía de la versión anterior no pierde nada; el plato de ejemplo
    node test/instalable.js           # manifiesto, iconos, cabeceras, abrir sin conexión y recibir una versión nueva
    node test/fotos-guiado.js         # capturas del día guiado (g-*.png)
    node test/fotos-historial.js      # capturas del tamaño, el historial y el peso, con un mes de datos
    python3 test/laminas.py           # monta láminas con esas capturas
Las pruebas de pantalla necesitan Node, Playwright y Chrome, y abren la app como la sirve Vercel (`test/servidor.js`:
la carpeta `public/` con las cabeceras de `vercel.json`). Con `file://`, el Chrome sin ventana devuelve a veces el
almacenamiento vacío al recargar si la máquina va cargada (3–5 de cada 100 recargas; por HTTP, 0 de 200).

## Publicar
Vercel publica la carpeta `public/` cada vez que se sube un cambio a `main`; no compila nada. Por eso `public/` va en
el repositorio: **antes de subir, `./probar.sh`** (la vuelve a generar y la prueba).
- El service worker pide siempre la página a la red primero: un cambio llega a la primera vez que se abre con conexión.
  Sin conexión (o si la red tarda más de 3 segundos) sale la última guardada.
- Para instalarla: en Android, Chrome → menú → «Añadir a pantalla de inicio»; en iPhone, Safari → Compartir →
  «Añadir a pantalla de inicio».

## Lo siguiente
- Usuarios con código de invitación y PIN, datos sincronizados y panel de administrador: `docs/diseno-usuarios-historial.md`.
- Ideas en cartera: código de barras con Open Food Facts, guardar un plato como alimento, crudo ↔ cocido y raciones
  de casa (1 huevo, 1 cucharada).
