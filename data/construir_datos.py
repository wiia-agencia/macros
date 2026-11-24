"""alimentos_raw.json -> alimentos.json (formato compacto para la app)."""
import json, os, re
AQUI = os.path.dirname(os.path.abspath(__file__))
rows = json.load(open(os.path.join(AQUI, 'alimentos_raw.json'), encoding='utf-8'))
CATS = ['carn','pesc','lact','cere','legu','verd','frut','seco','gras','dulc','bebi','sals','plat','supl']
ALCOHOL_USDA = {'14003','14096','14106','14037'}   # USDA no trae gramos de alcohol: se conserva su energía publicada

def racion(r):
    n, e, c = r['n'].lower(), r['e'].lower(), r['cat']
    def has(*w): return any(x in n for x in w)
    if c == 'carn':
        if has('serrano','lonchas','york','chorizo','salchich','morcilla','mortadela'): return 100 if has('frankfurt','fresca') else 40
        if has('bacon','panceta'): return 30
        return 150
    if c == 'pesc':
        if has('anchoas'): return 20
        if has('ahumado'): return 50
        if has('lata','conserva','surimi'): return 60
        return 150
    if c == 'lact':
        if has('huevo','tortilla francesa'): return 60
        if has('clara'): return 100
        if has('yema'): return 20
        if has('leche condensada'): return 20
        if has('leche evaporada'): return 50
        if has('leche'): return 250
        if has('kéfir'): return 200
        if has('batido'): return 150
        if has('yogur'): return 125
        if has('requesón','cottage'): return 100
        if has('mozzarella fresca'): return 60
        if has('nata'): return 30
        return 30
    if c == 'cere':
        if has('pan rallado','biscotes','picos','tortitas'): return 20
        if has('maicena'): return 10
        if has('harina','avena','salvado'): return 50
        if n.startswith('pan tostado'): return 30
        if has('pan','tortilla'): return 60
        if has('corn flakes','muesli','granola','cereales'): return 40
        if has('palomitas'): return 30
        return 80 if e.startswith('crud') else 200
    if c == 'legu':
        if has('tofu'): return 125
        if has('hummus'): return 50
        if has('texturizada'): return 40
        if has('tempeh','falafel','hamburguesa','edamame'): return 100
        return 80 if e.startswith('crud') else 200
    if c == 'verd':
        if has('ajo'): return 5
        if has('aceitunas','pepinillos'): return 30
        if has('lechuga','rúcula','canónigos','kale','endibia') or (has('espinacas') and e.startswith('crud')): return 60
        if has('maíz'): return 60
        if has('cebolla'): return 80
        if has('patata','puré'): return 250 if not has('fritas') else 150
        if has('boniato','pisto'): return 200
        return 150
    if c == 'frut':
        if has('dátiles','pasas','orejones','higos secos','coco'): return 30
        if has('limón'): return 30
        if has('aguacate'): return 80
        if has('plátano','lata','almíbar'): return 120
        if has('fresas','arándanos','frambuesas','moras','compota'): return 100
        return 150
    if c == 'seco':
        if has('crema','tahini'): return 15
        if has('chía','lino','sésamo','coco'): return 10
        if has('castañas'): return 60
        return 30
    if c == 'gras': return 10
    if c == 'dulc':
        if has('cacao','azúcar'): return 10
        if has('miel','sirope','crema de cacao'): return 15
        if has('mermelada'): return 20
        if has('magdalenas','croissant','napolitana','donut','bizcocho'): return 60
        if has('helado'): return 100
        if has('natillas','arroz con leche'): return 125
        return 30
    if c == 'bebi':
        if has('café con leche'): return 200
        if has('café'): return 100
        if has('cerveza','refresco','tónica','energética','isotónica'): return 330
        if has('vino'): return 150
        if has('destilados'): return 50
        if has('zumo'): return 200
        return 250
    if c == 'sals':
        if has('puré de tomate'): return 100
        if has('caldo'): return 250
        if has('bechamel'): return 60
        return 20
    if c == 'plat':
        if has('tortilla','quiche'): return 150
        if has('gazpacho'): return 250
        if has('nuggets'): return 120
        if has('hamburguesa','bocadillo','sushi'): return 200
        return 300
    return 30

out = []
for r in rows:
    fib = r['f'] or 0.0
    if r['src'] == 'U' and r['sid'] not in ALCOHOL_USDA:
        kcal = 4*r['p'] + 4*r['h'] + 9*r['g'] + 2*fib      # factores del etiquetado europeo (Regl. UE 1169/2011)
    else:
        kcal = r['k']
    az = r['az']
    if az is not None: az = min(az, r['h']) if r['h'] > 0 else 0.0
    sa = r['sa']
    if sa is not None: sa = min(sa, r['g'])
    rd = lambda v: None if v is None else round(v + 1e-9, 1)
    orig = re.sub(r"\s*\(Includes foods for USDA's Food Distribution Program\)", '', r['sn']).strip()
    out.append([r['n'], r['e'], CATS.index(r['cat']), r['em'], r['s'], round(kcal), rd(r['p']), rd(r['h']), rd(r['g']),
                rd(fib), rd(az), rd(sa), r['src'], r['sid'], orig, racion(r)])
json.dump(out, open(os.path.join(AQUI, 'alimentos.json'),'w',encoding='utf-8'), ensure_ascii=False, separators=(',',':'))
import os
print(len(out), 'alimentos ·', os.path.getsize(os.path.join(AQUI, 'alimentos.json')), 'bytes')
for nm in ['Patata','Pechuga de pollo','Judías verdes','Salvado de avena','Cacao puro en polvo','Cerveza','Lentejas','Almendras']:
    for x in out:
        if x[0]==nm: print(x[:2], 'kcal',x[5],'P',x[6],'H',x[7],'G',x[8],'fib',x[9],'az',x[10],'sat',x[11],x[12]+x[13],'ración',x[15])
