"""Cruza la lista curada (alimentos.txt) con las bases USDA SR y CIQUAL y saca alimentos.json.
Uso: python3 curar.py [--json]   (sin --json solo imprime la tabla de revisión)"""
import os, pickle, re, sys, json, unicodedata
AQUI = os.path.dirname(os.path.abspath(__file__))

# Las dos bases (USDA SR Legacy y CIQUAL 2017) no van en el repositorio: se sacan del paquete de R NutrienTrackeR
# (data/food_composition_data.rda) y se guardan como fcd.pkl. Ruta: variable FCD o data/fcd.pkl.
out = pickle.load(open(os.environ.get('FCD', os.path.join(AQUI, 'fcd.pkl')), 'rb'))
DB = {'U': 'USDA', 'C': 'CIQUAL'}
FAT = {'U': 'Total lipid (fat) (g)', 'C': 'Fat (g)'}
SAT = 'Fatty acids, total saturated (g)'

idx = {}
for k, name in DB.items():
    cols, A = out[name]
    ci = {c: i for i, c in enumerate(cols)}
    byid = {str(r[0]).strip(): r for r in A}
    idx[k] = (ci, A, byid)


def num(v):
    try:
        x = float(v)
        return None if x != x else x
    except Exception:
        return None


def find(spec):
    k = spec[0]
    ci, A, byid = idx[k]
    if spec[1] == '#':
        r = byid.get(spec[2:])
        return r, (1 if r is not None else 0)
    toks = [t.strip().lower() for t in spec[2:].split(';') if t.strip()]
    cands = []
    for r in A:
        nm = (r[1] or '').lower()
        ok = True
        for t in toks:
            if t.startswith('-'):
                if t[1:] in nm: ok = False
            elif t.startswith('^'):
                if not nm.startswith(t[1:]): ok = False
            elif t not in nm:
                ok = False
            if not ok: break
        if ok: cands.append(r)
    cands.sort(key=lambda r: (len(r[1]), str(r[0])))
    return (cands[0] if cands else None), len(cands)


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


rows = []
problems = []
for ln, line in enumerate(open(os.path.join(AQUI, 'alimentos.txt'), encoding='utf-8'), 1):
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('#'): continue
    parts = line.split('|')
    if len(parts) != 6:
        problems.append(f'L{ln}: formato ({len(parts)} campos): {line[:60]}'); continue
    cat, nombre, estado, emoji, sin, spec = [p.strip() for p in parts]
    r, n = find(spec)
    if r is None:
        problems.append(f'L{ln}: SIN COINCIDENCIA {nombre} [{estado}] <- {spec}'); continue
    k = spec[0]
    ci = idx[k][0]
    kcal = num(r[ci['Energy (kcal)']]); p = num(r[ci['Protein (g)']]); ch = num(r[ci['Carbohydrate, by difference (g)']])
    fat = num(r[ci[FAT[k]]]); fib = num(r[ci['Fiber, total dietary (g)']]); sug = num(r[ci['Sugars, total (g)']])
    sat = num(r[ci[SAT]]) if SAT in ci else None
    alc = num(r[ci['Alcohol (g)']]) if 'Alcohol (g)' in ci else None
    if p is None or ch is None or fat is None:
        problems.append(f'L{ln}: FALTA MACRO {nombre} [{estado}] <- {r[1]}'); continue
    fibv = fib or 0.0
    # Hidratos disponibles (convención europea de etiquetado): USDA da hidratos "por diferencia" con la fibra dentro
    carb = max(0.0, ch - fibv) if k == 'U' else ch
    kcal_calc = False
    if kcal is None:
        kcal = 4 * p + 4 * carb + 9 * fat + 2 * fibv + 7 * (alc or 0)
        kcal_calc = True
    rows.append(dict(cat=cat, n=nombre, e=estado, em=emoji, s=sin, src=k, sid=str(r[0]).strip(), sn=r[1],
                     k=kcal, p=p, h=carb, g=fat, f=fib, az=sug, sa=sat, kc=kcal_calc, ncand=n, spec=spec))

if '--json' not in sys.argv:
    for x in rows:
        flag = '' if x['spec'][1] == '#' or x['ncand'] == 1 else f" ({x['ncand']})"
        print(f"{x['cat']} {x['n'][:34]:34} {x['e'][:10]:10} <- {x['src']}{x['sid']:>6} {x['sn'][:70]:70} | {x['k']:.0f} P{x['p']:g} H{x['h']:.1f} G{x['g']:g} f{x['f'] if x['f'] is not None else '-'}{' *kcal calc' if x['kc'] else ''}{flag}")
print(f'\n{len(rows)} alimentos OK · {len(problems)} problemas')
for pb in problems: print('  !!', pb)

if '--json' in sys.argv:
    json.dump(rows, open(os.path.join(AQUI, 'alimentos_raw.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('escrito alimentos_raw.json')
