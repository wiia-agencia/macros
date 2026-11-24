"""Monta la app, una sola página con estilos, tipografías, datos y código dentro, en sus dos versiones:
dist/index.html, para abrirla dentro de Claude, y public/, la web que publica Vercel (instalable y con service worker)."""
import base64, hashlib, json, os, re, shutil
R = os.path.dirname(os.path.abspath(__file__))
lee = lambda *p: open(os.path.join(R, *p), encoding='utf-8').read()
FUENTES = os.path.join(R, 'src', 'fuentes')
def cara(familia, ruta, pesos):
    b64 = base64.b64encode(open(ruta, 'rb').read()).decode()
    return "@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}" % (familia, pesos, b64)
fuentes = cara('Bricolage Grotesque', os.path.join(FUENTES, 'bricolage-grotesque-latin-wght-normal.woff2'), '200 800') + '\n' + \
          cara('Figtree', os.path.join(FUENTES, 'figtree-latin-wght-normal.woff2'), '300 900')
datos = json.dumps(json.load(open(os.path.join(R, 'data', 'alimentos.json'), encoding='utf-8')), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
html = lee('src', 'index.tpl.html')
for marca, valor in (('/*FUENTES*/', fuentes), ('/*CSS*/', lee('src', 'app.css')), ('/*DATOS*/', datos), ('/*CORE*/', lee('src', 'core.js')), ('/*UI*/', lee('src', 'ui.js'))):
    assert html.count(marca) == 1, marca
    html = html.replace(marca, valor)
# Lo que solo lleva la web: el manifiesto, los iconos, no indexar y el registro del service worker
CABEZA = """<!--WEB--><meta name="robots" content="noindex, nofollow">
<meta name="description" content="Tus macros del día: cuánto te toca en cada comida y cuántos gramos de cada alimento.">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icono.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icono-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Macros">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<!--/WEB-->"""
PIE = """<!--WEB--><script>
if ('serviceWorker' in navigator) addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
</script>
<!--/WEB-->"""
def escribe(ruta, texto):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    open(ruta, 'w', encoding='utf-8', newline='\n').write(texto)
    print(os.path.relpath(ruta, R), round(len(texto.encode()) / 1024), 'KB')
for marca in ('/*WEB-CABEZA*/', '/*WEB-PIE*/'):
    assert html.count(marca) == 1, marca
escribe(os.path.join(R, 'dist', 'index.html'), html.replace('/*WEB-CABEZA*/', '').replace('/*WEB-PIE*/', ''))

PUB = os.path.join(R, 'public')
web = html.replace('/*WEB-CABEZA*/', CABEZA).replace('/*WEB-PIE*/', PIE)
escribe(os.path.join(PUB, 'index.html'), web)
ICONOS = ('icono.svg', 'icono-180.png', 'icono-192.png', 'icono-512.png', 'icono-maskable-512.png')
huella = hashlib.sha256(web.encode())                       # la versión del service worker cambia cuando cambia algo de lo que guarda
for n in ICONOS:
    shutil.copyfile(os.path.join(R, 'src', 'iconos', n), os.path.join(PUB, n))
    huella.update(open(os.path.join(PUB, n), 'rb').read())
manifiesto = lee('src', 'web', 'manifest.webmanifest')
json.loads(manifiesto)
huella.update(manifiesto.encode())
escribe(os.path.join(PUB, 'manifest.webmanifest'), manifiesto)
sw = lee('src', 'web', 'sw.js')
assert sw.count('/*VERSION*/') == 1
escribe(os.path.join(PUB, 'sw.js'), sw.replace('/*VERSION*/', huella.hexdigest()[:12]))
