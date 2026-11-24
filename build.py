"""Monta dist/index.html: una sola página con estilos, tipografías, datos y código dentro."""
import base64, json, os, re
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
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
open(os.path.join(R, 'dist', 'index.html'), 'w', encoding='utf-8').write(html)
print('dist/index.html', round(len(html.encode()) / 1024), 'KB')
