"""Monta láminas con las capturas reales (carpeta capturas/): varias pantallas en fila, cada una con su título y su pie.
Antes hay que sacar las capturas:  node test/fotos-guiado.js, node test/fotos-historial.js y node test/fotos-usuarios.js
Si falta alguna captura, esa lámina se salta."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'capturas')
B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def lamina(items, salida):
    faltan = [it['img'] for it in items if not os.path.exists(f"{d}/{it['img']}.png")]
    if faltan: print(salida, '· faltan capturas:', ', '.join(faltan)); return
    ancho, sep, margen = 360, 44, 48; alto = round(1688 * ancho / 780)
    W = margen * 2 + ancho * len(items) + sep * (len(items) - 1); H = margen + 64 + alto + 70 + margen - 10
    lienzo = Image.new('RGB', (W, H), (238, 241, 245)); dr = ImageDraw.Draw(lienzo)
    fT, fP, fL = ImageFont.truetype(B, 26), ImageFont.truetype(R, 19), ImageFont.truetype(B, 24)
    x = margen
    for it in items:
        y = margen
        if it.get('letra'):
            dr.ellipse([x, y, x + 44, y + 44], fill=(20, 24, 31)); tw = dr.textlength(it['letra'], font=fL)
            dr.text((x + 22 - tw / 2, y + 7), it['letra'], font=fL, fill=(255, 255, 255)); dr.text((x + 58, y + 6), it['titulo'], font=fT, fill=(20, 24, 31))
        else:
            dr.text((x, y + 6), it['titulo'], font=fT, fill=(20, 24, 31))
        im = Image.open(f"{d}/{it['img']}.png").convert('RGB').resize((ancho, alto), Image.LANCZOS)
        m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, ancho - 1, alto - 1], radius=30, fill=255)
        s = Image.new('RGBA', (ancho + 80, alto + 80), (0, 0, 0, 0)); ImageDraw.Draw(s).rounded_rectangle([40, 48, 40 + ancho, 48 + alto], radius=30, fill=(16, 24, 40, 70)); s = s.filter(ImageFilter.GaussianBlur(18))
        lienzo.paste(s, (x - 40, y + 24), s); lienzo.paste(im, (x, y + 64), m)
        yy = y + 64 + alto + 18
        for linea in it['pie'].split('\n'): dr.text((x, yy), linea, font=fP, fill=(85, 96, 111)); yy += 26
        x += ancho + sep
    lienzo.save(f'{d}/{salida}.png'); print(salida, lienzo.size)

# El día guiado (test/fotos-guiado.js)
lamina([{'titulo': '1. Abres y ya te dice', 'img': 'g-1-toca-desayuno', 'pie': 'Qué comida toca, cuánto te\ntoca y cuánto llevas hoy.'},
        {'titulo': '2. Dices qué desayunas', 'img': 'g-2-a-medias', 'pie': 'Va calculando los gramos\ny te dice qué falta.'},
        {'titulo': '3. Te pone los gramos', 'img': 'g-3b-clavado-abajo', 'pie': 'De cada cosa, para clavar\nlo que te toca.'},
        {'titulo': '4. Lo apuntas', 'img': 'g-4-apuntado', 'pie': 'Se limpia y prepara la comida\ncon lo que te queda del día.'}], 'macros-dia-guiado')

# El tamaño de la comida, el historial y el peso (test/fotos-historial.js)
lamina([{'titulo': 'Normal', 'img': 't-normal', 'pie': 'Su parte de lo que queda del día.'},
        {'titulo': 'Fuerte', 'img': 't-fuerte', 'pie': 'Parte y media: lo mismo en el plato,\nmás gramos de cada cosa.'},
        {'titulo': 'Suave', 'img': 't-suave', 'pie': 'Media parte. Lo que no comes ahora\nse reparte en las comidas siguientes.'}], 'macros-tamano')
lamina([{'titulo': '1. Los últimos 7 días', 'img': 'h-1-hoy', 'pie': 'Negro: cumplido. Ámbar: a medias.\nGris: sin apuntar. Y la cuenta, debajo.'},
        {'titulo': '2. Tocas un día', 'img': 'h-2b-ayer-abajo', 'pie': 'Y ves lo que comiste ese día\ny si cumpliste.'},
        {'titulo': '3. El mes entero', 'img': 'h-5-mes', 'pie': 'Al tocar la fecha: cumplidos,\na medias, sin apuntar y la racha.'}], 'macros-historial')
lamina([{'titulo': 'En «Mis macros»', 'img': 'w-1-mis-macros', 'pie': 'Una fila con tu último peso\ny cómo va.'},
        {'titulo': 'Mi peso', 'img': 'w-2-mi-peso', 'pie': 'Lo apuntas cuando quieras: ves\nla línea, el cambio y la lista.'},
        {'titulo': 'En oscuro', 'img': 'w-2-mi-peso-osc', 'pie': 'Todo lo nuevo sigue el aspecto\nque tengas puesto.'}], 'macros-peso')

# Usuarios: entrar, la cuenta y el panel del administrador (test/fotos-usuarios.js)
lamina([{'titulo': '1. Abre su enlace', 'img': 'u-1-codigo', 'pie': 'El enlace ya trae el código.\nSin correo ni contraseña.'},
        {'titulo': '2. Crea su PIN', 'img': 'u-2-crear-pin', 'pie': 'Cuatro números, dos veces.\nEl móvil se queda dentro.'},
        {'titulo': '3. Tú ves quién la usa', 'img': 'u-7-usuarios', 'pie': 'Última vez y días apuntados.\nNada de lo que comen ni pesan.'},
        {'titulo': '4. Invitas con un enlace', 'img': 'u-9-enlace', 'pie': 'Pones un nombre y sale el enlace.\nVale 7 días y es para una persona.'}], 'macros-usuarios')
